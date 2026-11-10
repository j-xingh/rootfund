'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { allocate } = require('./qf');

const gifts = (projectId, n, amt, prefix) =>
  Array.from({ length: n }, (_, i) => ({ projectId, donorKey: `${prefix}${i}`, amountUsd: amt }));

test('worked example: A (4 x $1) gets $75, C (2 x $2) gets $25', () => {
  const d = [...gifts('A', 4, 1, 'a'), ...gifts('C', 2, 2, 'c')];
  const r = allocate(d, { poolUsd: 100, projectIds: ['A', 'C'] });
  assert.strictEqual(r.items[0].matchUsd, 75);
  assert.strictEqual(r.items[1].matchUsd, 25);
});

test('a single donor gets no match (raw = 0)', () => {
  const d = [...gifts('A', 4, 1, 'a'), { projectId: 'B', donorKey: 'x', amountUsd: 4 }];
  const r = allocate(d, { poolUsd: 100, projectIds: ['A', 'B'] });
  assert.strictEqual(r.items[1].matchUsd, 0);
  assert.strictEqual(r.items[0].matchUsd, 100);
});

test('same donor giving twice to one project counts as one donor', () => {
  const d = [
    { projectId: 'A', donorKey: 'x', amountUsd: 1 },
    { projectId: 'A', donorKey: 'x', amountUsd: 1 },
  ];
  const r = allocate(d, { poolUsd: 100, projectIds: ['A'] });
  assert.strictEqual(r.items[0].donors, 1);
  assert.strictEqual(r.items[0].matchUsd, 0);
});

test('weight 0 excludes a donor from matching', () => {
  const d = [...gifts('A', 4, 1, 'a'), ...gifts('C', 4, 1, 'c')];
  d.forEach((x) => { if (x.projectId === 'C') x.weight = 0; });
  const r = allocate(d, { poolUsd: 100, projectIds: ['A', 'C'] });
  assert.strictEqual(r.items[0].matchUsd, 100);
  assert.strictEqual(r.items[1].matchUsd, 0);
});

test('25% cap: dominant project is held to 25% and excess is redistributed', () => {
  const ids = 'ABCDEFGH'.split('');
  const d = gifts('A', 20, 1, 'a');
  for (const id of ids.slice(1)) d.push(...gifts(id, 4, 1, id));
  const uncapped = allocate(d, { poolUsd: 100, projectIds: ids });
  assert.ok(uncapped.items[0].sharePct > 80);
  const capped = allocate(d, { poolUsd: 100, projectIds: ids, capShare: 0.25 });
  assert.strictEqual(capped.items[0].matchUsd, 25);
  const others = capped.items.slice(1).map((i) => i.matchUsd);
  others.forEach((m) => assert.ok(Math.abs(m - 10.71) < 0.02));
  const total = capped.items.reduce((a, i) => a + i.matchUsd, 0);
  assert.ok(Math.abs(total - 100) < 1e-9);
});

test('rounding never exceeds the pool', () => {
  const ids = 'ABC'.split('');
  const d = [...gifts('A', 3, 1, 'a'), ...gifts('B', 3, 1, 'b'), ...gifts('C', 3, 1, 'c')];
  const r = allocate(d, { poolUsd: 100, projectIds: ids });
  const total = r.items.reduce((a, i) => a + Math.round(i.matchUsd * 100), 0);
  assert.strictEqual(total, 10000);
});

test('no donations at all: everything unallocated, no crash', () => {
  const r = allocate([], { poolUsd: 100, projectIds: ['A', 'B'] });
  assert.strictEqual(r.unallocatedUsd, 100);
});
