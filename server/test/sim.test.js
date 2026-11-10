'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { buildScenario } = require('../src/ml/sim');
const { computeFeatures, FEATURE_NAMES } = require('../src/ml/features');

test('same seed gives identical data', () => {
  const a = buildScenario({ seed: 5, attacks: [{ kind: 'naive', k: 50, target: 'p7' }] });
  const b = buildScenario({ seed: 5, attacks: [{ kind: 'naive', k: 50, target: 'p7' }] });
  assert.deepStrictEqual(a, b);
});

test('features have the right shape and rings look bursty', () => {
  const s = buildScenario({ seed: 9, attacks: [{ kind: 'naive', k: 120, target: 'p7' }] });
  const rows = computeFeatures(s.donations, s.baseline);
  assert.ok(rows.every((r) => r.x.length === FEATURE_NAMES.length && r.x.every(Number.isFinite)));
  const burst = (label) => {
    const xs = rows.filter((r) => r.label === label).map((r) => r.x[3]);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  assert.ok(burst(1) > 10 * Math.max(1, burst(0)));
  assert.strictEqual(rows.filter((r) => r.label === 1).length, 120);
});

test('all four attack kinds generate', () => {
  for (const kind of ['naive', 'jitter', 'adaptive', 'evasive']) {
    const s = buildScenario({ seed: 3, attacks: [{ kind, k: 20, target: 'p7' }] });
    assert.ok(s.donations.some((d) => d.simLabel === 1), kind);
  }
});
