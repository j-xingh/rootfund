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

async function boot() {
  const store = createMemoryStore();
  const paypal = createMockPayPal(cfg);
  await ensureSeeded(store, cfg);
  const app = createApp({ store, paypal, cfg, model: loadModel(), metrics: null });
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
