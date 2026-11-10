'use strict';
// Usage: npm run export:csv   -> writes ml/data/features.csv and ml/data/donations.csv
// 60 labelled scenarios: 15 each of naive, jitter, adaptive, evasive. Same seeds => identical files.
const fs = require('fs');
const path = require('path');
const { ATTACK_KINDS, buildScenario } = require('./simulator');
const { FEATURE_NAMES, extractFeatures } = require('./features');

const OUT = path.resolve(__dirname, '../../../ml/data');
fs.mkdirSync(OUT, { recursive: true });

const feat = [['scenario', 'attack_type', 'target', ...FEATURE_NAMES, 'label'].join(',')];
const don = [['scenario', 'donor_row', 'project_id', 'amount_usd', 'label'].join(',')];

for (let i = 0; i < 60; i++) {
  const kind = ATTACK_KINDS[i % 4];
  const j = Math.floor(i / 4);              // 0..14 within this attack type
  const sc = buildScenario(1000 + i, kind, j % 8); // target project rotates
  const rows = extractFeatures(sc.donations, sc.baseline);
  for (const r of rows) feat.push([i, kind, sc.target, ...r.features, sc.labels[r.donorKey]].join(','));
  for (const d of sc.donations) don.push([i, d.donorKey, d.projectId, d.amountUsd, sc.labels[d.donorKey]].join(','));
}
fs.writeFileSync(path.join(OUT, 'features.csv'), feat.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'donations.csv'), don.join('\n') + '\n');
console.log(`wrote ${feat.length - 1} donor rows and ${don.length - 1} donation rows to ${OUT}`);
