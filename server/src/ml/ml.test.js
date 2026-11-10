'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { buildScenario, simulateBaseline, PROJECT_IDS } = require('./simulator');
const { extractFeatures, FEATURE_NAMES } = require('./features');
const { allocate } = require('../qf/qf');

test('same seed gives identical scenarios', () => {
  const a = JSON.stringify(buildScenario(42, 'naive', 7));
  const b = JSON.stringify(buildScenario(42, 'naive', 7));
  assert.strictEqual(a, b);
});

test('scenario has 250 honest + 120 attackers and 10 features each', () => {
  const sc = buildScenario(1, 'jitter', 3);
  const rows = extractFeatures(sc.donations, sc.baseline);
  assert.strictEqual(rows.length, 370);
  assert.strictEqual(Object.values(sc.labels).filter((x) => x === 1).length, 120);
  rows.forEach((r) => { assert.strictEqual(r.features.length, FEATURE_NAMES.length); r.features.forEach((v) => assert.ok(Number.isFinite(v))); });
});

test('naive attackers have much higher burst than honest donors', () => {
  const sc = buildScenario(5, 'naive', 7);
  const rows = extractFeatures(sc.donations, sc.baseline);
  const avg = (lab) => { const r = rows.filter((x) => sc.labels[x.donorKey] === lab); return r.reduce((a, x) => a + x.features[3], 0) / r.length; };
  assert.ok(avg(1) > 10 * avg(0));
});

test('baseline is a donor count per project', () => {
  const b = simulateBaseline(9);
  assert.deepStrictEqual(Object.keys(b), PROJECT_IDS);
  assert.ok(b.p1 > b.p8);
});

test('the attack really hijacks the pool under naive QF', () => {
  const sc = buildScenario(7, 'naive', 7);
  const r = allocate(sc.donations, { poolUsd: 1000, projectIds: PROJECT_IDS });
  const clean = allocate(sc.donations.filter((d) => d.label === 'honest'), { poolUsd: 1000, projectIds: PROJECT_IDS });
  console.log(`   target share: attacked ${r.items[7].sharePct}% vs clean ${clean.items[7].sharePct}%`);
  assert.ok(r.items[7].sharePct > 3 * clean.items[7].sharePct);
});
