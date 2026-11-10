'use strict';
// Builds ml/data/train.csv from seeded simulations. Run: node scripts/export-dataset.js
const fs = require('fs');
const path = require('path');
const { buildScenario } = require('../server/src/ml/sim');
const { computeFeatures, FEATURE_NAMES } = require('../server/src/ml/features');

const KINDS = ['naive', 'jitter', 'adaptive'];
const lines = [['scenario', 'kind', 'donor', 'label', ...FEATURE_NAMES].join(',')];
for (let s = 0; s < 45; s++) {
  const kind = KINDS[s % 3];
  const sc = buildScenario({ seed: 200 + s, honest: 250, attacks: [{ kind, k: 120, target: 'p' + (s % 8) }] });
  for (const r of computeFeatures(sc.donations, sc.baseline)) {
    lines.push([s, kind, r.donorKey, r.label, ...r.x.map((v) => Number(v.toFixed(8)))].join(','));
  }
}
const out = path.join(__dirname, '..', 'ml', 'data', 'train.csv');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log('wrote', out, (lines.length - 1) + ' rows');
