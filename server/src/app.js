'use strict';
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { ROUND_ID, seedDemo, injectAttack, httpError } = require('./rounds');
const { analyze, maskEmail } = require('./service');

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function createApp({ store, paypal, cfg, model, metrics }) {
  const app = express();
  const hoursSince = (iso) => (Date.now() - new Date(iso).getTime()) / 3_600_000;
  const isAdmin = (req) => {
    const given = Buffer.from(String(req.get('x-admin-key') || ''));
    const want = Buffer.from(String(cfg.adminKey));
    return given.length === want.length && crypto.timingSafeEqual(given, want); // constant-time compare
  };
  const requireAdmin = (req, _res, next) => {
    if (!isAdmin(req)) return next(httpError(401, 'admin key missing or wrong', 'UNAUTHORIZED'));
    next();
  };

  // ---------- webhook (must see the RAW body, so it is registered before express.json) ----------
  // The UI polls GET /api/settlement, so only ask PayPal when something can still change (at most every 3 s).
  const BATCH_FINAL = ['SUCCESS', 'DENIED', 'CANCELED'];
  const ITEM_OPEN = ['PENDING', 'UNCLAIMED', 'ONHOLD', undefined, null];
  async function refreshSettlement({ force = false } = {}) {
    const s = await store.get('settlements', ROUND_ID);
    if (!s || !s.batchId) return s;
    const done = BATCH_FINAL.includes(s.status) && s.items.every((it) => !ITEM_OPEN.includes(it.status));
    const recent = s.checkedAt && Date.now() - new Date(s.checkedAt).getTime() < 3000;
    if (!force && (done || recent)) return s;
    const b = await paypal.getPayoutBatch(s.batchId);
    const items = s.items.map((it) => {
      const f = (b.items || []).find((x) => x.senderItemId === it.senderItemId);
      return f ? { ...it, status: f.status, error: f.error } : it;
    });
    const patch = { status: b.status, items, checkedAt: new Date().toISOString() };
    await store.patch('settlements', ROUND_ID, patch);
    if (b.status === 'SUCCESS') await store.patch('rounds', ROUND_ID, { status: 'SETTLED' });
    return store.get('settlements', ROUND_ID);
  }

  async function processEvent(event) {
    const r = event.resource || {};
    // Find the donation by capture id; if the webhook beats the return handler, fall back to the order id.
    const findByCapture = async () => {
      let [d] = await store.find('donations', { 'paypal.captureId': r.id });
      const orderId = r.supplementary_data?.related_ids?.order_id;
      if (!d && orderId) [d] = await store.find('donations', { 'paypal.orderId': orderId });
      return d;
    };
    const finalStates = ['REFUNDED', 'REVERSED'];
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const d = await findByCapture();
        if (d && !finalStates.includes(d.status)) await store.patch('donations', d._id, { status: 'CAPTURED', 'paypal.captureId': r.id, 'paypal.status': 'COMPLETED' });
        break;
      }
      case 'PAYMENT.CAPTURE.PENDING': {
        const d = await findByCapture();
        if (d && !finalStates.includes(d.status) && d.status !== 'CAPTURED') await store.patch('donations', d._id, { status: 'PENDING_REVIEW', 'paypal.captureId': r.id, 'paypal.status': 'PENDING' });
        break;
      }
      case 'PAYMENT.CAPTURE.REVERSED': {
        // resource is a refund-like object whose "up" link points at the capture
        const capId = ((r.links || []).find((l) => l.rel === 'up')?.href || '').split('/').pop();
        const [d] = capId ? await store.find('donations', { 'paypal.captureId': capId }) : [];
        if (d) await store.patch('donations', d._id, { status: 'REVERSED', 'paypal.status': 'REVERSED' });
        break;
      }
      case 'PAYMENT.CAPTURE.DENIED': {
        const [d] = await store.find('donations', { 'paypal.captureId': r.id });
        if (d) await store.patch('donations', d._id, { status: 'FAILED', 'paypal.status': 'DENIED' });
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED': {
        let [d] = await store.find('donations', { 'refund.id': r.id });
        if (!d) {
          const up = (r.links || []).find((l) => l.rel === 'up')?.href || '';
          const capId = up.split('/').pop();
          [d] = await store.find('donations', { 'paypal.captureId': capId });
        }
        if (d) await store.patch('donations', d._id, { status: 'REFUNDED', 'refund.id': r.id, 'refund.status': r.status || 'COMPLETED' });
        break;
      }
      case 'PAYMENT.PAYOUTSBATCH.PROCESSING':
      case 'PAYMENT.PAYOUTSBATCH.SUCCESS':
      case 'PAYMENT.PAYOUTSBATCH.DENIED':
      case 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED':
      case 'PAYMENT.PAYOUTS-ITEM.DENIED':
      case 'PAYMENT.PAYOUTS-ITEM.FAILED':
        await refreshSettlement({ force: true });
        break;
      default:
        break; // events we do not use are acknowledged and ignored
    }
  }

  app.post('/api/webhooks/paypal', express.raw({ type: '*/*', limit: '1mb' }), ah(async (req, res) => {
    let ok = false;
    try { ok = await paypal.verifyWebhook({ headers: req.headers, rawBody: req.body }); } catch (e) { console.error('webhook verify error:', e.message); }
    if (!ok) return res.status(400).json({ error: { code: 'INVALID_SIGNATURE', message: 'webhook signature not verified' } });
    const event = JSON.parse(req.body.toString('utf8'));
    const fresh = await store.insertOnce('webhookEvents', { _id: event.id, type: event.event_type, receivedAt: new Date().toISOString() });
    if (!fresh) return res.json({ ok: true, duplicate: true });
    try { await processEvent(event); } catch (e) {
      await store.remove('webhookEvents', { _id: event.id }); // let PayPal retry
      throw e;
    }
    res.json({ ok: true });
  }));

  app.use(express.json());

  // ---------- mock PayPal pages (dev only) ----------
  if (paypal.mode === 'mock') {
    app.get('/mock-paypal/approve', (req, res) => {
      const buttons = paypal.MOCK_DONORS.map((d, i) => `<p><a href="/mock-paypal/pay?order=${encodeURIComponent(req.query.order)}&payer=${i}">Pay as ${d.email}</a></p>`).join('');
      res.type('html').send(`<h2>MOCK PayPal sandbox</h2><p>Development stand-in. Not PayPal.</p>${buttons}`);
    });
    app.get('/mock-paypal/pay', (req, res) => {
      const o = paypal._approve(String(req.query.order), Number(req.query.payer || 0));
      if (!o) return res.status(404).send('unknown order');
      res.redirect(`${o.returnUrl}&token=${o.orderId}&PayerID=${o.payer.payerId}`);
    });
  }

  // ---------- public API ----------
  app.get('/api/health', (_req, res) => res.json({ ok: true, paypalMode: paypal.mode, store: store.kind, time: new Date().toISOString() }));

  app.get('/api/round', ah(async (_req, res) => {
    const round = await store.get('rounds', ROUND_ID);
    const projects = await store.find('projects');
    const ds = (await store.find('donations', { roundId: ROUND_ID })).filter((d) => d.status === 'CAPTURED');
    res.json({
      round: { id: round._id, status: round.status, poolUsd: round.poolUsd, openedAt: round.openedAt },
      projects: projects.map((p) => ({ id: p._id, name: p.name, description: p.description })),
      totals: {
        donations: ds.length, donors: new Set(ds.map((d) => d.donorKey)).size,
        real: ds.filter((d) => d.source === 'paypal').length, simulated: ds.filter((d) => d.source === 'simulated').length,
        realUsd: ds.filter((d) => d.source === 'paypal').reduce((a, d) => a + d.amountUsd, 0),
      },
      paypalMode: paypal.mode,
    });
  }));

  app.get('/api/allocations', ah(async (req, res) => {
    const a = await analyze(store, model, cfg);
    const mode = req.query.mode === 'naive' ? 'naive' : 'protected';
    res.json({ ...a[mode], flaggedDonors: a.flagged.length });
  }));

  app.get('/api/integrity', ah(async (req, res) => {
    const a = await analyze(store, model, cfg);
    const admin = isAdmin(req);
    res.json({
      counts: { donors: a.scores.size, flagged: a.flagged.length },
      flagged: a.flagged.slice(0, 200).map(({ simLabel, ...f }) => (admin ? { ...f, simLabel } : f)),
      metrics,
    });
  }));

  app.get('/api/donations', ah(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const real = await store.find('donations', { source: 'paypal' });
    real.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ items: real.slice(0, limit).map((d) => ({ id: d._id, projectId: d.projectId, amountUsd: d.amountUsd, status: d.status, emailMasked: maskEmail(d.email), captureId: d.paypal?.captureId, refund: d.refund || null, createdAt: d.createdAt })) });
  }));

  app.post('/api/donations/checkout', ah(async (req, res) => {
    const { projectId, amountUsd } = req.body || {};
    if (typeof projectId !== 'string') throw httpError(400, 'projectId must be a string'); // blocks {"$ne":null} in Mongo
    const project = await store.get('projects', projectId);
    if (!project) throw httpError(400, 'unknown projectId');
    const amt = Number(amountUsd);
    if (!Number.isInteger(amt) || amt < 1 || amt > 100) throw httpError(400, 'amountUsd must be a whole number from 1 to 100');
    const round = await store.get('rounds', ROUND_ID);
    if (round.status !== 'OPEN') throw httpError(409, 'this round is closed to new donations', 'ROUND_CLOSED');
    const d = await store.insert('donations', {
      roundId: ROUND_ID, projectId, donorKey: 'pending', email: null, amountUsd: amt, t: hoursSince(round.openedAt),
      source: 'paypal', status: 'CREATED', createdAt: new Date().toISOString(), paypal: {},
    });
    const o = await paypal.createOrder({
      donationId: d._id, amountUsd: amt, description: `Donation to ${project.name}`,
      returnUrl: `${cfg.publicBaseUrl}/api/donations/return?d=${d._id}`, cancelUrl: `${cfg.publicBaseUrl}/?donation=cancelled`,
    });
    await store.patch('donations', d._id, { donorKey: `pending-${d._id}`, 'paypal.orderId': o.orderId });
    res.json({ donationId: d._id, approveUrl: o.approveUrl });
  }));

  app.get('/api/donations/return', ah(async (req, res) => {
    const { d: id, token } = req.query;
    const d = id && (await store.get('donations', String(id)));
    if (!d || d.paypal?.orderId !== token) return res.redirect('/?donation=error&reason=unknown_order');
    if (d.status === 'CAPTURED') return res.redirect(`/?donation=ok&d=${d._id}`);
    let cap;
    try {
      cap = await paypal.captureOrder(token);
    } catch (e) {
      const already = e.code === 'ORDER_ALREADY_CAPTURED' || (e.details || []).some((x) => x.issue === 'ORDER_ALREADY_CAPTURED');
      if (!already) { console.error('capture failed:', e.message, e.debugId || ''); return res.redirect('/?donation=error&reason=capture_failed'); }
      cap = await paypal.getOrder(token);
    }
    await saveCapture(d, cap);
    res.redirect(`/?donation=ok&d=${d._id}`);
  }));

  // One place that writes a capture onto a donation (used by the return URL and by reconcile).
  async function saveCapture(d, cap) {
    const completed = !cap.status || cap.status === 'COMPLETED';
    await store.patch('donations', d._id, {
      status: completed ? 'CAPTURED' : 'PENDING_REVIEW', donorKey: cap.payerId || d._id, email: cap.email || d.email || null,
      'paypal.captureId': cap.captureId, 'paypal.payerId': cap.payerId, 'paypal.accountStatus': cap.accountStatus || d.paypal?.accountStatus || null, 'paypal.status': cap.status || 'COMPLETED',
    });
  }

  // ---------- admin API ----------
  app.post('/api/admin/attack', requireAdmin, ah(async (req, res) => {
    const { kind = 'jitter', size = 250, targetProjectId = 'p7' } = req.body || {};
    const added = await injectAttack(store, { kind, size, targetProjectId });
    res.json({ ok: true, added });
  }));

  app.post('/api/admin/reset-demo', requireAdmin, ah(async (req, res) => {
    await seedDemo(store, cfg, { keepReal: Boolean(req.body?.keepReal) });
    res.json({ ok: true });
  }));

  app.post('/api/admin/refund-flagged', requireAdmin, ah(async (req, res) => {
    const a = await analyze(store, model, cfg);
    const wanted = Array.isArray(req.body?.donationIds) ? new Set(req.body.donationIds) : null;
    const flaggedIds = new Set(a.flagged.flatMap((f) => f.donationIds));
    const targets = (await store.find('donations', { source: 'paypal', status: 'CAPTURED' })).filter((d) => d.paypal?.captureId && (wanted ? wanted.has(d._id) : flaggedIds.has(d._id)));
    const results = [];
    for (const d of targets) {
      try {
        const r = await paypal.refundCapture({ captureId: d.paypal.captureId, amountUsd: d.amountUsd, note: 'Refunded by Rootfund integrity review', requestId: `refund-${d._id}` });
        await store.patch('donations', d._id, { status: 'REFUNDED', 'refund.id': r.refundId, 'refund.status': r.status });
        results.push({ donationId: d._id, ok: true, refundId: r.refundId });
      } catch (e) { results.push({ donationId: d._id, ok: false, error: e.message, debugId: e.debugId || null }); }
    }
    res.json({ refunded: results.filter((r) => r.ok).length, results });
  }));

  app.post('/api/admin/settle', requireAdmin, ah(async (req, res) => {
    if (req.body?.approve !== true) throw httpError(400, 'human approval required: send {"approve": true}');
    const existing = await store.get('settlements', ROUND_ID);
    if (existing) return res.json({ settlement: await refreshSettlement(), alreadySettled: true });
    const a = await analyze(store, model, cfg);
    const items = a.protected.items.filter((i) => i.matchCents > 0).map((i) => ({
      projectId: i.projectId, receiver: a.projects.find((p) => p.id === i.projectId).ownerEmail, amountUsd: i.matchUsd,
      senderItemId: `${ROUND_ID}-${i.projectId}`, note: req.body?.simulateFailure && i === a.protected.items.find((x) => x.matchCents > 0) ? 'ERRPYO002' : `Rootfund match for ${i.name}`,
    }));
    if (!items.length) throw httpError(400, 'nothing to settle: no matched amounts yet');
    const round = await store.get('rounds', ROUND_ID);
    const senderBatchId = `${round.settleKey || ROUND_ID}-settle`;
    const b = await paypal.createPayoutBatch({ senderBatchId, items });
    await store.insert('settlements', { _id: ROUND_ID, roundId: ROUND_ID, senderBatchId, batchId: b.batchId, status: b.status, createdAt: new Date().toISOString(), items: items.map((i) => ({ projectId: i.projectId, receiver: i.receiver, amountUsd: i.amountUsd, senderItemId: i.senderItemId, status: 'PENDING' })) });
    res.json({ settlement: await refreshSettlement({ force: true }) });
  }));

  app.get('/api/settlement', ah(async (_req, res) => {
    const s = await refreshSettlement();
    if (s) return res.json({ settlement: s });
    const a = await analyze(store, model, cfg);
    res.json({ settlement: null, preview: a.protected });
  }));

  app.post('/api/admin/reconcile', requireAdmin, ah(async (_req, res) => {
    const out = { donationsUpdated: 0, errors: [], settlement: null };
    for (const d of await store.find('donations', { source: 'paypal' })) {
      if (!['CREATED', 'PENDING_REVIEW'].includes(d.status) || !d.paypal?.orderId) continue;
      try {
        let o = await paypal.getOrder(d.paypal.orderId);
        // Buyer approved but never came back to our return URL: take the money now.
        if (o.status === 'APPROVED') o = await paypal.captureOrder(d.paypal.orderId);
        if (o.status === 'COMPLETED' && o.captureId) {
          await saveCapture(d, o);
          out.donationsUpdated++;
        }
      } catch (e) {
        out.errors.push({ donationId: d._id, error: e.message, debugId: e.debugId || null });
      }
    }
    out.settlement = await refreshSettlement({ force: true });
    res.json(out);
  }));

  // ---------- serve the built React app (client/dist) ----------
  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/|mock-paypal\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // ---------- errors ----------
  app.use((err, _req, res, _next) => {
    const status = err.status && err.status < 600 ? err.status : 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: { code: err.code || 'ERROR', message: err.message, debugId: err.debugId || null } });
  });
  return app;
}

module.exports = { createApp };
