'use strict';
/**
 * Evaluates the detector the same way it is served (same JS features + scorer + QF engine).
 * Writes server/src/ml/metrics.json (shown in the UI and README).
 * Run: node scripts/evaluate.js   (after: node scripts/export-dataset.js && python ml/train.py)
 */
const fs = require('fs');
const path = require('path');
const { buildScenario, PROJECT_IDS, ATTACK_KINDS } = require('../server/src/ml/sim');
const { loadModel, scoreDonors } = require('../server/src/ml/scorer');
const { weightsFromScores, CAP_SHARE, isFlagged } = require('../server/src/ml/policy');
const { computeAllocations } = require('../server/src/qf/qf');

const SEEDS = Array.from({ length: 15 }, (_, i) => 900 + i);
const HONEST = 250, RING = 250, POOL = 1000, TARGET = 'p7';
const projects = PROJECT_IDS.map((id) => ({ id }));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const r3 = (v) => Math.round(v * 1000) / 1000;

function share(donations, weights, cap) {
  const r = computeAllocations(donations, projects, { poolUsd: POOL, weights, capShare: cap });
  return r.items.find((i) => i.projectId === TARGET).sharePct / 100;
}

function prf(scores, flagFn) {
  let tp = 0, fp = 0, fn = 0;
  for (const s of scores.values()) {
    const flagged = flagFn(s);
    if (s.label === 1 && flagged) tp++;
    else if (s.label === 0 && flagged) fp++;
    else if (s.label === 1 && !flagged) fn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return { precision, recall, f1: precision + recall ? (2 * precision * recall) / (precision + recall) : 0, fp };
}

function evaluateKind(model, kind) {
  const acc = { p: [], r: [], f: [], fp: [], bp: [], br: [], s: { naive: [], hybrid: [], hybridCapped: [], hard: [], soft: [], tiered: [], rule: [], clean: [] }, hf: [], hr: [] };
  for (const seed of SEEDS) {
    const sc = buildScenario({ seed, honest: HONEST, attacks: [{ kind, k: RING, target: TARGET }] });
    const scores = scoreDonors(model, sc.donations, sc.baseline);
    const m = prf(scores, (s) => s.score > 0.5);
    acc.p.push(m.precision); acc.r.push(m.recall); acc.f.push(m.f1); acc.fp.push(m.fp);
    const b = prf(scores, (s) => s.x[3] >= 10); // baseline rule: 10+ other donations to same project within 30 min
    acc.bp.push(b.precision); acc.br.push(b.recall);
    const ruleW = new Map([...scores].map(([k, s]) => [k, s.x[3] >= 10 ? 0 : 1]));
    acc.s.naive.push(share(sc.donations, null, null));
    acc.s.hybrid.push(share(sc.donations, weightsFromScores(scores, 'hybrid'), null));
    acc.s.hybridCapped.push(share(sc.donations, weightsFromScores(scores, 'hybrid'), CAP_SHARE));
    const h = prf(scores, isFlagged); acc.hf.push(h.fp); acc.hr.push(h.recall);
    acc.s.hard.push(share(sc.donations, weightsFromScores(scores, 'hard'), null));
    acc.s.soft.push(share(sc.donations, weightsFromScores(scores, 'soft'), null));
    acc.s.tiered.push(share(sc.donations, weightsFromScores(scores, 'tiered'), null));
    acc.s.rule.push(share(sc.donations, ruleW, null));
    acc.s.clean.push(share(sc.donations.filter((d) => d.simLabel === 0), null, null));
  }
  const poolShare = Object.fromEntries(Object.entries(acc.s).map(([k, v]) => [k, r3(mean(v))]));
  return {
    precision: r3(mean(acc.p)), recall: r3(mean(acc.r)), f1: r3(mean(acc.f)), honestDonorsFlagged: r3(mean(acc.fp)),
    hybrid: { recall: r3(mean(acc.hr)), honestDonorsFlagged: r3(mean(acc.hf)) },
    baselineRule: { precision: r3(mean(acc.bp)), recall: r3(mean(acc.br)), poolShareAfterExclusion: poolShare.rule },
    targetPoolShare: poolShare,
  };
}

const main = () => {
  const model = loadModel();
  const out = {
    meta: { seeds: SEEDS.length, honestDonors: HONEST, ringSize: RING, poolUsd: POOL, targetProject: TARGET,
      trainedOn: model.meta.trainedOn, note: 'Simulated data. evasive is never seen in training.', generatedAt: new Date().toISOString() },
    attacks: {}, leaveOneOut: {},
  };
  for (const kind of ATTACK_KINDS) out.attacks[kind] = evaluateKind(model, kind);
  for (const kind of ['naive', 'jitter', 'adaptive']) {
    const f = path.join(__dirname, '..', 'ml', 'data', `model_loo_${kind}.json`);
    if (fs.existsSync(f)) out.leaveOneOut[kind] = evaluateKind(loadModel(f), kind);
  }
  const dest = path.join(__dirname, '..', 'server', 'src', 'ml', 'metrics.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(Object.fromEntries(Object.entries(out.attacks).map(([k, v]) => [k, { P: v.precision, R: v.recall, fp: v.honestDonorsFlagged, share: v.targetPoolShare, hybrid: v.hybrid }])), null, 1));
  console.log('leave-one-out:', JSON.stringify(Object.fromEntries(Object.entries(out.leaveOneOut).map(([k, v]) => [k, { P: v.precision, R: v.recall, naive: v.targetPoolShare.naive, hard: v.targetPoolShare.hard }]))));
};
main();
