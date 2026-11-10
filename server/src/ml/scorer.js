'use strict';
const fs = require('fs');
const path = require('path');
const { computeFeatures, FEATURE_NAMES } = require('./features');

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

function loadModel(file = path.join(__dirname, 'model.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Gradient-boosted trees exported from scikit-learn; matches sklearn to ~1e-16 (see test). */
function scoreRow(model, x) {
  let raw = model.init;
  for (const t of model.trees) {
    let n = 0;
    while (t.left[n] !== -1) n = x[t.feat[n]] <= t.thr[n] ? t.left[n] : t.right[n];
    raw += model.lr * t.val[n];
  }
  return sigmoid(raw);
}

const pct = (v) => `${Math.round(v * 100)}%`;
const TEMPLATES = {
  burst_30min: { dir: 1, text: (v) => `gave within 30 minutes of ${Math.round(v)} other donations to the same project` },
  email_domain_share: { dir: 1, text: (v) => `email domain shared with ${pct(v)} of all donors` },
  email_digit_ratio: { dir: 1, text: (v) => `email username is ${pct(v)} digits` },
  same_project_set_share: { dir: 1, text: (v) => `${pct(v)} of donors gave to exactly the same set of projects` },
  surge_vs_round0: { dir: 1, text: (v) => `donor count for their project is ${Math.exp(v).toFixed(1)}x the previous round` },
  tiny_round_flag: { dir: 1, text: () => 'only tiny whole-dollar donations ($2 or less)' },
  n_projects: { dir: -1, text: (v) => `gave to only ${Math.round(v)} project${Math.round(v) === 1 ? '' : 's'}` },
  log_mean_amount: { dir: -1, text: (v) => `unusually small average donation ($${Math.expm1(v).toFixed(2)})` },
  std_amount: { dir: 1, text: (v) => `donation amounts vary unusually (std $${v.toFixed(2)})` },
};

/** Plain-language reasons: the biggest outliers versus the honest population. */
function explain(model, x, max = 3) {
  const out = [];
  model.features.forEach((name, i) => {
    const tpl = TEMPLATES[name];
    if (!tpl) return;
    const z = (x[i] - model.honestStats.median[i]) / model.honestStats.scale[i];
    if (z * tpl.dir > 1) out.push({ z: Math.abs(z), text: tpl.text(x[i]) });
  });
  return out.sort((a, b) => b.z - a.z).slice(0, max).map((o) => o.text);
}

/** Score every donor in a set of donations. Returns Map donorKey -> {score, x, reasons}. */
function scoreDonors(model, donations, baseline) {
  const rows = computeFeatures(donations, baseline);
  const res = new Map();
  for (const r of rows) {
    const score = scoreRow(model, r.x);
    res.set(r.donorKey, { score, x: r.x, label: r.label, reasons: score >= 0.5 ? explain(model, r.x) : [] });
  }
  return res;
}

module.exports = { loadModel, scoreRow, scoreDonors, explain, FEATURE_NAMES };
