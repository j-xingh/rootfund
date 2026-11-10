'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { loadModel, scoreRow, scoreDonors } = require('../src/ml/scorer');
const { buildScenario } = require('../src/ml/sim');

const model = loadModel();

test('JS scorer matches scikit-learn exactly (parity)', () => {
  const par = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'ml', 'data', 'model.parity.json'), 'utf8'));
  let maxd = 0;
  par.X.forEach((x, i) => { maxd = Math.max(maxd, Math.abs(scoreRow(model, x) - par.p[i])); });
  assert.ok(maxd < 1e-9, 'max diff ' + maxd);
});

test('a naive ring is flagged and honest donors mostly are not', () => {
  const s = buildScenario({ seed: 4242, attacks: [{ kind: 'naive', k: 120, target: 'p7' }] });
  const sc = scoreDonors(model, s.donations, s.baseline);
  let tp = 0, fp = 0, ring = 0, honest = 0;
  for (const [k, v] of sc) {
    if (v.label === 1) { ring++; if (v.score > 0.5) tp++; } else { honest++; if (v.score > 0.5) fp++; }
  }
  assert.ok(tp / ring > 0.95, 'recall ' + tp / ring);
  assert.ok(fp / honest < 0.05, 'false positive rate ' + fp / honest);
});
