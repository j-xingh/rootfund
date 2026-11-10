'use strict';
/**
 * Policy evaluation (J3 part c + e). Reads the out-of-sample scores written by ml/train.py,
 * runs the REAL qf.js under each policy, and writes ml/metrics.json (used by the UI's metrics card).
 * Metric: the TARGET project's share of a $1000 pool, averaged over scenarios of each attack type.
 */
const fs = require('fs');
const path = require('path');
const { allocate } = require('../qf/qf');

const DATA = path.resolve(__dirname, '../../../ml/data');
const POOL = 1000;
const PROJECTS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
const CAP = 0.25;

const readCsv = (f) => {
  const [head, ...lines] = fs.readFileSync(path.join(DATA, f), 'utf8').trim().split('\n');
  const cols = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v])));
};

const policies = {
  naive: () => 1,                                         // plain QF
  hard: (s) => (s > 0.5 ? 0 : 1),                         // exclude suspected donors
  hardCap: (s) => (s > 0.5 ? 0 : 1),                      // exclude + 25% cap  == "Rootfund protected"
  soft: (s) => 1 - s,                                     // down-weight by score
  tiered: (s) => (s > 0.8 ? 0 : s > 0.5 ? 0.5 : 1),
};

function evaluateSet(set, donFile, featFile) {
  const preds = readCsv('predictions.csv').filter((r) => r.set === set);
  const score = new Map(preds.map((r) => [`${r.scenario}|${r.donor_key}`, parseFloat(r.score)]));
  const info = new Map(readCsv(featFile).map((r) => [r.scenario, { type: r.attack_type, target: r.target }]));
  const byScenario = new Map();
  for (const r of readCsv(donFile)) {
    if (!byScenario.has(r.scenario)) byScenario.set(r.scenario, []);
    byScenario.get(r.scenario).push({ projectId: r.project_id, donorKey: r.donor_key, amountUsd: +r.amount_usd, label: +r.label });
  }
  const acc = {}; // type -> policy -> [shares]
  const clean = [];
  for (const [sc, dons] of byScenario) {
    const { type, target } = info.get(sc);
    const idx = PROJECTS.indexOf(target);
    const share = (ds, cap) => allocate(ds, { poolUsd: POOL, projectIds: PROJECTS, capShare: cap }).items[idx].sharePct;
    clean.push(share(dons.filter((d) => d.label === 0), null));
    acc[type] = acc[type] || {};
    for (const [name, w] of Object.entries(policies)) {
      const weighted = dons.map((d) => ({ ...d, weight: w(score.get(`${sc}|${d.donorKey}`)) }));
      (acc[type][name] = acc[type][name] || []).push(share(weighted, name === 'hardCap' ? CAP : null));
    }
  }
  const mean = (a) => Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10;
  const out = { noAttack: mean(clean), byAttack: {} };
  for (const [type, pol] of Object.entries(acc)) {
    out.byAttack[type] = Object.fromEntries(Object.entries(pol).map(([n, a]) => [n, mean(a)]));
  }
  return out;
}

const detector = JSON.parse(fs.readFileSync(path.join(DATA, 'detector_metrics.json'), 'utf8'));
const metrics = {
  ...detector,
  policy: { poolUsd: POOL, capShare: CAP, threshold: 0.5, note: 'target project pool share (%), mean over scenarios; hardCap = Rootfund protected mode' },
  poolShare: {
    ring120: evaluateSet('ring120', 'donations.csv', 'features.csv'),
    ring250: evaluateSet('ring250', 'donations_ring250.csv', 'features_ring250.csv'),
  },
};
fs.writeFileSync(path.resolve(DATA, '../metrics.json'), JSON.stringify(metrics, null, 2));

for (const k of ['ring120', 'ring250']) {
  console.log(`\nTarget pool share %, ${k} (no attack = ${metrics.poolShare[k].noAttack})`);
  console.log('attack'.padEnd(10) + Object.keys(policies).map((p) => p.padStart(9)).join(''));
  for (const [t, pol] of Object.entries(metrics.poolShare[k].byAttack)) {
    console.log(t.padEnd(10) + Object.keys(policies).map((p) => String(pol[p]).padStart(9)).join(''));
  }
}
