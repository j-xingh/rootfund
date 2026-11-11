'use strict';
// Runs the real MongoDB store (store/mongoStore.js) through the main API flows on a throwaway in-memory MongoDB.
// First run downloads a MongoDB binary (~100 MB, cached). If that is impossible (offline), the test is skipped.
const test = require('node:test');
const assert = require('node:assert');
const { createMongoStore } = require('../src/store/mongoStore');
const { createMockPayPal } = require('../src/paypal/mock');
const { loadModel } = require('../src/ml/scorer');
const { ensureSeeded } = require('../src/rounds');
const { createApp } = require('../src/app');

const cfg = { publicBaseUrl: 'http://x', poolUsd: 100, adminKey: 'k', ownerEmails: ['a@example.com', 'b@example.com', 'c@example.com'], paypalMode: 'mock' };
const ADMIN = { 'x-admin-key': 'k', 'content-type': 'application/json' };
const JSONH = { 'content-type': 'application/json' };

test('MongoDB store: seed, donate, webhook dedupe, attack, refund, settle, reset', { timeout: 180_000 }, async (t) => {
  let mongod;
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongod = await MongoMemoryServer.create();
  } catch (e) {
    t.skip(`in-memory MongoDB unavailable: ${e.message}`);
    return;
  }
  const store = await createMongoStore(mongod.getUri());
  const paypal = createMockPayPal(cfg);
  await ensureSeeded(store, cfg);
  const app = createApp({ store, paypal, cfg, model: loadModel(), metrics: null });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = async (p, o = {}) => { const r = await fetch(base + p, { redirect: 'manual', ...o }); return { r, body: r.headers.get('content-type')?.includes('json') ? await r.json() : null }; };

  try {
    assert.strictEqual((await j('/api/health')).body.store, 'mongo');
    const round = (await j('/api/round')).body;
    assert.strictEqual(round.projects.length, 8);
    assert.ok(round.totals.simulated > 400);

    // donation through mock checkout and the return URL
    const { body: co } = await j('/api/donations/checkout', { method: 'POST', headers: JSONH, body: JSON.stringify({ projectId: 'p2', amountUsd: 2 }) });
    const pay = await fetch(`${base}/mock-paypal/pay?order=${new URL(co.approveUrl).searchParams.get('order')}&payer=0`, { redirect: 'manual' });
    await fetch(pay.headers.get('location').replace('http://x', base), { redirect: 'manual' });
    const d = await store.get('donations', co.donationId);
    assert.strictEqual(d.status, 'CAPTURED');
    assert.ok(d.paypal.captureId && d.paypal.orderId, 'dotted-key patches must land in nested fields');

    // webhook is processed once per event id (unique _id in Mongo)
    const ev = JSON.stringify({ id: 'WH-M1', event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: d.paypal.captureId } });
    const hook = () => fetch(base + '/api/webhooks/paypal', { method: 'POST', headers: JSONH, body: ev }).then((r) => r.json());
    assert.deepStrictEqual(await hook(), { ok: true });
    assert.deepStrictEqual(await hook(), { ok: true, duplicate: true });

    // attack and protection
    await j('/api/admin/attack', { method: 'POST', headers: ADMIN, body: JSON.stringify({ kind: 'naive', size: 250, targetProjectId: 'p7' }) });
    const share = async (m) => (await j('/api/allocations?mode=' + m)).body.items.find((i) => i.projectId === 'p7').sharePct;
    assert.ok((await share('naive')) > 20 && (await share('protected')) < 5);

    // refund, settle (idempotent), reset keeps the real donation when asked
    assert.strictEqual((await j('/api/admin/refund-flagged', { method: 'POST', headers: ADMIN, body: JSON.stringify({ donationIds: [d._id] }) })).body.refunded, 1);
    assert.strictEqual((await store.get('donations', d._id)).status, 'REFUNDED');
    const s1 = (await j('/api/admin/settle', { method: 'POST', headers: ADMIN, body: JSON.stringify({ approve: true }) })).body.settlement;
    const s2 = (await j('/api/admin/settle', { method: 'POST', headers: ADMIN, body: JSON.stringify({ approve: true }) })).body.settlement;
    assert.strictEqual(s1.status, 'SUCCESS');
    assert.strictEqual(s1.batchId, s2.batchId);
    assert.ok((await j('/api/donations')).body.items.length === 1);
    await j('/api/admin/reset-demo', { method: 'POST', headers: ADMIN, body: JSON.stringify({ keepReal: true }) });
    assert.strictEqual((await j('/api/donations')).body.items.length, 1, 'keepReal keeps real donations');
    assert.strictEqual((await j('/api/round')).body.round.status, 'OPEN');
    assert.strictEqual((await j('/api/settlement')).body.settlement, null);
  } finally {
    server.closeAllConnections();
    server.close();
    await store.close();
    await mongod.stop();
  }
});
