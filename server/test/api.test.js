'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createMemoryStore } = require('../src/store/memoryStore');
const { createMockPayPal } = require('../src/paypal/mock');
const { loadModel } = require('../src/ml/scorer');
const { ensureSeeded } = require('../src/rounds');
const { createApp } = require('../src/app');

const cfg = { publicBaseUrl: 'http://x', poolUsd: 100, adminKey: 'k', ownerEmails: ['a@example.com', 'b@example.com', 'c@example.com'], paypalMode: 'mock' };
const ADMIN = { 'x-admin-key': 'k', 'content-type': 'application/json' };
const JSONH = { 'content-type': 'application/json' };

async function boot(over = {}) {
  const store = createMemoryStore();
  const paypal = createMockPayPal(cfg);
  await ensureSeeded(store, cfg);
  const app = createApp({ store, paypal, cfg: { ...cfg, ...over }, model: loadModel(), metrics: null });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = async (p, o = {}) => { const r = await fetch(base + p, { redirect: 'manual', ...o }); return { r, body: r.headers.get('content-type')?.includes('json') ? await r.json() : null }; };
  const stop = () => { server.closeAllConnections(); server.close(); };
  return { store, paypal, base, j, stop };
}

test('seeded round has 8 projects and simulated donors', async () => {
  const { j, stop } = await boot();
  const { body } = await j('/api/round');
  assert.strictEqual(body.projects.length, 8);
  assert.ok(body.totals.simulated > 400 && body.totals.real === 0);
  stop();
});

test('admin endpoints reject a missing key', async () => {
  const { j, stop } = await boot();
  const { r } = await j('/api/admin/attack', { method: 'POST', headers: JSONH, body: '{}' });
  assert.strictEqual(r.status, 401);
  stop();
});

test('attack inflates naive allocation; protection restores it', async () => {
  const { j, stop } = await boot();
  const share = async (mode) => (await j('/api/allocations?mode=' + mode)).body.items.find((i) => i.projectId === 'p7').sharePct;
  const before = await share('naive');
  const { body } = await j('/api/admin/attack', { method: 'POST', headers: ADMIN, body: JSON.stringify({ kind: 'jitter', size: 250, targetProjectId: 'p7' }) });
  assert.strictEqual(body.added, 250);
  const naive = await share('naive');
  const prot = await share('protected');
  assert.ok(naive > 25 && naive > before * 5, `naive ${naive} before ${before}`);
  assert.ok(prot < 5, `protected ${prot}`);
  const integ = (await j('/api/integrity')).body;
  assert.ok(integ.counts.flagged >= 240);
  assert.ok(integ.flagged[0].reasons.length > 0 && integ.flagged[0].simLabel === undefined);
  stop();
});

test('full donation flow with mock PayPal: checkout, approve, return, ledger', async () => {
  const { j, base, stop } = await boot();
  const { body: co } = await j('/api/donations/checkout', { method: 'POST', headers: JSONH, body: JSON.stringify({ projectId: 'p2', amountUsd: 10 }) });
  assert.ok(co.approveUrl.includes('/mock-paypal/approve'));
  const pay = await fetch(`${base}/mock-paypal/pay?order=${new URL(co.approveUrl).searchParams.get('order')}&payer=1`, { redirect: 'manual' });
  assert.strictEqual(pay.status, 302);
  const back = await fetch(pay.headers.get('location').replace('http://x', base), { redirect: 'manual' });
  assert.ok(back.headers.get('location').includes('donation=ok'));
  const { body: led } = await j('/api/donations');
  assert.strictEqual(led.items.length, 1);
  assert.strictEqual(led.items[0].status, 'CAPTURED');
  const again = await fetch(pay.headers.get('location').replace('http://x', base), { redirect: 'manual' });
  assert.ok(again.headers.get('location').includes('donation=ok'));
  assert.strictEqual((await j('/api/donations')).body.items.length, 1);
  stop();
});

test('checkout validates input', async () => {
  const { j, stop } = await boot();
  const post = (b) => j('/api/donations/checkout', { method: 'POST', headers: JSONH, body: JSON.stringify(b) });
  assert.strictEqual((await post({ projectId: 'nope', amountUsd: 5 })).r.status, 400);
  assert.strictEqual((await post({ projectId: 'p1', amountUsd: 0 })).r.status, 400);
  assert.strictEqual((await post({ projectId: 'p1', amountUsd: 5.5 })).r.status, 400);
  assert.strictEqual((await post({ projectId: 'p1', amountUsd: 101 })).r.status, 400);
  stop();
});

test('refund marks donation REFUNDED; webhook is processed once per event id', async () => {
  const { j, base, store, stop } = await boot();
  const { body: co } = await j('/api/donations/checkout', { method: 'POST', headers: JSONH, body: JSON.stringify({ projectId: 'p0', amountUsd: 5 }) });
  const order = new URL(co.approveUrl).searchParams.get('order');
  const pay = await fetch(`${base}/mock-paypal/pay?order=${order}&payer=0`, { redirect: 'manual' });
  await fetch(pay.headers.get('location').replace('http://x', base), { redirect: 'manual' });
  const [d] = await store.find('donations', { source: 'paypal' });
  const ref = await j('/api/admin/refund-flagged', { method: 'POST', headers: ADMIN, body: JSON.stringify({ donationIds: [d._id] }) });
  assert.strictEqual(ref.body.refunded, 1);
  assert.strictEqual((await store.get('donations', d._id)).status, 'REFUNDED');
  const ev = { id: 'WH-1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: d.paypal.captureId } };
  const send = () => fetch(base + '/api/webhooks/paypal', { method: 'POST', headers: JSONH, body: JSON.stringify(ev) }).then((r) => r.json());
  assert.deepStrictEqual(await send(), { ok: true });
  assert.deepStrictEqual(await send(), { ok: true, duplicate: true });
  assert.strictEqual((await store.get('donations', d._id)).status, 'REFUNDED', 'a late COMPLETED event must not un-refund');
  stop();
});

test('settlement requires approval, pays protected matches, and is idempotent', async () => {
  const { j, stop } = await boot();
  await j('/api/admin/attack', { method: 'POST', headers: ADMIN, body: JSON.stringify({ kind: 'naive', size: 250, targetProjectId: 'p7' }) });
  assert.strictEqual((await j('/api/admin/settle', { method: 'POST', headers: ADMIN, body: '{}' })).r.status, 400);
  const first = (await j('/api/admin/settle', { method: 'POST', headers: ADMIN, body: JSON.stringify({ approve: true }) })).body;
  assert.strictEqual(first.settlement.status, 'SUCCESS');
  const total = first.settlement.items.reduce((a, i) => a + i.amountUsd, 0);
  assert.ok(total <= 100.0001 && total > 99.9, 'total ' + total);
  const p7 = first.settlement.items.find((i) => i.projectId === 'p7');
  assert.ok(!p7 || p7.amountUsd < 5, 'attacked project must not capture the pool');
  const second = (await j('/api/admin/settle', { method: 'POST', headers: ADMIN, body: JSON.stringify({ approve: true }) })).body;
  assert.strictEqual(second.settlement.batchId, first.settlement.batchId);
  stop();
});

test('ledger works while a donation is still unpaid (email is null)', async () => {
  const { j, stop } = await boot();
  await j('/api/donations/checkout', { method: 'POST', headers: JSONH, body: JSON.stringify({ projectId: 'p1', amountUsd: 3 }) });
  const { r, body } = await j('/api/donations');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(body.items[0].status, 'CREATED');
  assert.strictEqual(body.items[0].emailMasked, '***');
  stop();
});

test('checkout rejects non-string projectId and closed rounds', async () => {
  const { j, stop } = await boot();
  const post = (b) => j('/api/donations/checkout', { method: 'POST', headers: JSONH, body: JSON.stringify(b) });
  assert.strictEqual((await post({ projectId: { $ne: null }, amountUsd: 5 })).r.status, 400);
  await j('/api/admin/settle', { method: 'POST', headers: ADMIN, body: JSON.stringify({ approve: true }) });
  const closed = await post({ projectId: 'p1', amountUsd: 5 });
  assert.strictEqual(closed.r.status, 409);
  assert.strictEqual(closed.body.error.code, 'ROUND_CLOSED');
  stop();
});

test('admin endpoints reject a wrong key of any length', async () => {
  const { j, stop } = await boot();
  for (const key of ['x', 'kk', 'K']) {
    const { r } = await j('/api/admin/reset-demo', { method: 'POST', headers: { ...JSONH, 'x-admin-key': key }, body: '{}' });
    assert.strictEqual(r.status, 401, `key ${key}`);
  }
  assert.strictEqual((await j('/api/admin/reset-demo', { method: 'POST', headers: ADMIN, body: '{}' })).r.status, 200);
  stop();
});

test('each reset gets a new payout sender_batch_id', async () => {
  const { j, stop } = await boot();
  const settle = async () => (await j('/api/admin/settle', { method: 'POST', headers: ADMIN, body: JSON.stringify({ approve: true }) })).body.settlement.senderBatchId;
  const first = await settle();
  await new Promise((r) => setTimeout(r, 5)); // settleKey is time-based
  await j('/api/admin/reset-demo', { method: 'POST', headers: ADMIN, body: '{}' });
  const second = await settle();
  assert.ok(first && second && first !== second, `${first} vs ${second}`);
  stop();
});

test('webhooks: COMPLETED falls back to order id; PENDING and REVERSED are handled', async () => {
  const { j, base, store, stop } = await boot();
  const checkout = async (p) => (await j('/api/donations/checkout', { method: 'POST', headers: JSONH, body: JSON.stringify({ projectId: p, amountUsd: 4 }) })).body.donationId;
  const hook = (ev) => fetch(base + '/api/webhooks/paypal', { method: 'POST', headers: JSONH, body: JSON.stringify(ev) }).then((r) => r.json());
  const related = (orderId) => ({ related_ids: { order_id: orderId } });

  const a = await store.get('donations', await checkout('p1')); // never returned to us: no captureId yet
  await hook({ id: 'WH-A', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP-A', supplementary_data: related(a.paypal.orderId) } });
  const a2 = await store.get('donations', a._id);
  assert.strictEqual(a2.status, 'CAPTURED');
  assert.strictEqual(a2.paypal.captureId, 'CAP-A');

  const b = await store.get('donations', await checkout('p2'));
  await hook({ id: 'WH-B', event_type: 'PAYMENT.CAPTURE.PENDING', resource: { id: 'CAP-B', supplementary_data: related(b.paypal.orderId) } });
  assert.strictEqual((await store.get('donations', b._id)).status, 'PENDING_REVIEW');

  await hook({ id: 'WH-C', event_type: 'PAYMENT.CAPTURE.PENDING', resource: { id: 'CAP-A', supplementary_data: related(a.paypal.orderId) } });
  assert.strictEqual((await store.get('donations', a._id)).status, 'CAPTURED', 'a late PENDING must not downgrade a capture');

  await hook({ id: 'WH-D', event_type: 'PAYMENT.CAPTURE.REVERSED', resource: { id: 'REV-1', links: [{ rel: 'up', href: 'https://api/v2/payments/captures/CAP-A' }] } });
  assert.strictEqual((await store.get('donations', a._id)).status, 'REVERSED');
  stop();
});

test('settlement polling does not call PayPal once the batch is final', async () => {
  const { j, paypal, stop } = await boot();
  let calls = 0;
  const real = paypal.getPayoutBatch.bind(paypal);
  paypal.getPayoutBatch = (id) => { calls++; return real(id); };
  await j('/api/admin/settle', { method: 'POST', headers: ADMIN, body: JSON.stringify({ approve: true }) });
  assert.strictEqual(calls, 1, 'settle refreshes once');
  const a = (await j('/api/settlement')).body.settlement;
  await j('/api/settlement');
  assert.strictEqual(a.status, 'SUCCESS');
  assert.strictEqual(calls, 1, 'final batch is served from the store');
  await j('/api/admin/reconcile', { method: 'POST', headers: ADMIN, body: '{}' });
  assert.strictEqual(calls, 2, 'reconcile always re-reads PayPal');
  stop();
});

test('reconcile captures an order the buyer approved but never returned from', async () => {
  const { j, base, store, stop } = await boot();
  const { body: co } = await j('/api/donations/checkout', { method: 'POST', headers: JSONH, body: JSON.stringify({ projectId: 'p3', amountUsd: 7 }) });
  const order = new URL(co.approveUrl).searchParams.get('order');
  await fetch(`${base}/mock-paypal/pay?order=${order}&payer=2`, { redirect: 'manual' }); // approve, but skip the return URL
  assert.strictEqual((await store.get('donations', co.donationId)).status, 'CREATED');
  const { body } = await j('/api/admin/reconcile', { method: 'POST', headers: ADMIN, body: '{}' });
  assert.strictEqual(body.donationsUpdated, 1);
  assert.deepStrictEqual(body.errors, []);
  const d = await store.get('donations', co.donationId);
  assert.strictEqual(d.status, 'CAPTURED');
  assert.ok(d.paypal.captureId && d.email === 'mock-donor-3@example.com');
  stop();
});

test('rate limits: checkout and admin get 429 per client IP; webhooks are never limited', async () => {
  const { j, base, stop } = await boot({ rateLimits: { checkout: 2, admin: 3 } });
  const co = (ip) => j('/api/donations/checkout', { method: 'POST', headers: { ...JSONH, 'x-forwarded-for': ip }, body: JSON.stringify({ projectId: 'p1', amountUsd: 1 }) });
  assert.strictEqual((await co('1.1.1.1')).r.status, 200);
  assert.strictEqual((await co('1.1.1.1')).r.status, 200);
  const blocked = await co('1.1.1.1');
  assert.strictEqual(blocked.r.status, 429);
  assert.strictEqual(blocked.body.error.code, 'RATE_LIMITED');
  assert.ok(Number(blocked.r.headers.get('retry-after')) > 0);
  assert.strictEqual((await co('2.2.2.2')).r.status, 200, 'another client is not affected');

  const adm = () => j('/api/admin/reconcile', { method: 'POST', headers: { 'x-admin-key': 'wrong', 'x-forwarded-for': '3.3.3.3' } });
  for (let i = 0; i < 3; i++) assert.strictEqual((await adm()).r.status, 401);
  assert.strictEqual((await adm()).r.status, 429, 'guessing the admin key is throttled');

  for (let i = 0; i < 5; i++) {
    const r = await fetch(base + '/api/webhooks/paypal', { method: 'POST', headers: { ...JSONH, 'x-forwarded-for': '1.1.1.1' }, body: JSON.stringify({ id: 'WH-RL-' + i, event_type: 'X' }) });
    assert.strictEqual(r.status, 200);
  }
  stop();
});

test('admin ping accepts the right key and rejects a wrong one with the standard 401', async () => {
  const { j, stop } = await boot();
  assert.deepStrictEqual((await j('/api/admin/ping', { headers: { 'x-admin-key': 'k' } })).body, { ok: true });
  const bad = await j('/api/admin/ping', { headers: { 'x-admin-key': 'x' } });
  assert.strictEqual(bad.r.status, 401);
  assert.strictEqual(bad.body.error.code, 'UNAUTHORIZED');
  assert.strictEqual((await j('/api/admin/ping')).r.status, 401);
  stop();
});
