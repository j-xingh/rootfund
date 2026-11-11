'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createMemoryStore } = require('../src/store/memoryStore');
const { createMockPayPal } = require('../src/paypal/mock');
const { loadModel } = require('../src/ml/scorer');
const { ensureSeeded } = require('../src/rounds');
const { createApp } = require('../src/app');

test('timeline returns one point per donation and flags the attack', async () => {
  const cfg = { publicBaseUrl: 'http://x', poolUsd: 100, adminKey: 'k', ownerEmails: [], paypalMode: 'mock' };
  const store = createMemoryStore();
  await ensureSeeded(store, cfg);
  const app = createApp({ store, paypal: createMockPayPal(cfg), cfg, model: loadModel(), metrics: null });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const before = await (await fetch(base + '/api/timeline')).json();
  assert.ok(before.points.length > 400 && before.points.every((p) => !p.flagged || p.source === 'simulated'));
  await fetch(base + '/api/admin/attack', { method: 'POST', headers: { 'x-admin-key': 'k', 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'jitter', size: 100, targetProjectId: 'p7' }) });
  const after = await (await fetch(base + '/api/timeline')).json();
  assert.strictEqual(after.points.length, before.points.length + 100);
  assert.ok(after.points.filter((p) => p.flagged).length >= 95);
  server.closeAllConnections(); server.close();
});
