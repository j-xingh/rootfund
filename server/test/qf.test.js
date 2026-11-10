'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { computeAllocations, applyCap } = require('../src/qf/qf');

const P = (ids) => ids.map((id) => ({ id }));
const don = (projectId, donorKey, amountUsd) => ({ projectId, donorKey, amountUsd, status: 'CAPTURED' });

test('worked example: A=$75, C=$25, B gets nothing', () => {
  const d = [];
  for (let i = 0; i < 4; i++) d.push(don('A', 'a' + i, 1));
  d.push(don('B', 'b0', 4));
  d.push(don('C', 'c0', 2), don('C', 'c1', 2));
  const r = computeAllocations(d, P(['A', 'B', 'C']), { poolUsd: 100 });
  const m = Object.fromEntries(r.items.map((i) => [i.projectId, i.matchUsd]));
  assert.strictEqual(m.A, 75);
  assert.strictEqual(m.C, 25);
  assert.strictEqual(m.B, 0);
});

test('total never exceeds pool and rounds to cents', () => {
  const d = [];
  for (let i = 0; i < 7; i++) d.push(don('A', 'a' + i, 3));
  for (let i = 0; i < 5; i++) d.push(don('B', 'b' + i, 7));
  for (let i = 0; i < 3; i++) d.push(don('C', 'c' + i, 11));
  const r = computeAllocations(d, P(['A', 'B', 'C']), { poolUsd: 100 });
  const cents = r.items.reduce((a, i) => a + i.matchCents, 0);
  assert.strictEqual(cents, 10000);
});

test('weight 0 removes a donor entirely (fraud exclusion)', () => {
  const d = [];
  for (let i = 0; i < 100; i++) d.push(don('X', 'fake' + i, 1));
  for (let i = 0; i < 4; i++) d.push(don('A', 'a' + i, 1));
  for (let i = 0; i < 4; i++) d.push(don('B', 'b' + i, 1));
  const naive = computeAllocations(d, P(['X', 'A', 'B']), { poolUsd: 100 });
  const weights = new Map();
  for (let i = 0; i < 100; i++) weights.set('fake' + i, 0);
  const prot = computeAllocations(d, P(['X', 'A', 'B']), { poolUsd: 100, weights });
  assert.ok(naive.items.find((i) => i.projectId === 'X').sharePct > 90);
  assert.strictEqual(prot.items.find((i) => i.projectId === 'X').matchUsd, 0);
  assert.strictEqual(prot.items.find((i) => i.projectId === 'A').matchUsd, 50);
});

test('cap limits a project to 25% when feasible and redistributes', () => {
  const shares = { a: 0.7, b: 0.1, c: 0.1, d: 0.05, e: 0.05 };
  const out = applyCap(shares, 0.25);
  assert.ok(out.a <= 0.25 + 1e-9);
  const sum = Object.values(out).reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('cap skipped when infeasible (2 projects, 25% cap)', () => {
  const out = applyCap({ a: 0.75, b: 0.25 }, 0.25);
  assert.deepStrictEqual(out, { a: 0.75, b: 0.25 });
});

test('empty input gives zeros', () => {
  const r = computeAllocations([], P(['A', 'B']), { poolUsd: 50 });
  assert.ok(r.items.every((i) => i.matchCents === 0));
});

test('refunded and unpaid donations are ignored', () => {
  const d = [{ ...don('A', 'x', 5), status: 'REFUNDED' }, { ...don('A', 'y', 5), status: 'CREATED' }, don('B', 'z', 5)];
  const r = computeAllocations(d, P(['A', 'B']), { poolUsd: 10 });
  assert.strictEqual(r.items.find((i) => i.projectId === 'A').donors, 0);
});
