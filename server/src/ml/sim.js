'use strict';
/**
 * Simulator: honest donors and four kinds of sybil (fake donor) attacks.
 * Everything is seeded, so the same seed always gives the same data.
 * Times are in hours since the round opened (a round is 168 hours).
 * Every record has source 'simulated' and simLabel 1 if it belongs to an attacker.
 */
const { makeRng } = require('./rng');

const NUM_PROJECTS = 8;
const ROUND_HOURS = 168;
const PROJECT_IDS = Array.from({ length: NUM_PROJECTS }, (_, i) => 'p' + i);
const POPULARITY = [0.22, 0.18, 0.16, 0.14, 0.12, 0.08, 0.06, 0.04];
const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'proton.me', 'icloud.com', 'hotmail.com'];
const DOMAIN_W = [0.5, 0.15, 0.15, 0.08, 0.07, 0.05];
const ATTACK_KINDS = ['naive', 'jitter', 'adaptive', 'evasive'];

const clip = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const money = (rng, mu, sigma, lo, hi) => Math.round(clip(rng.lognormal(mu, sigma), lo, hi));

function honestDonations(rng, n, prefix = 'sim-h') {
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = rng.pick([1, 2, 3, 4], [0.35, 0.35, 0.2, 0.1]);
    const projects = rng.sample(PROJECT_IDS, k, POPULARITY);
    const domain = rng.pick(DOMAINS, DOMAIN_W);
    let local = rng.letters(5, 9);
    if (rng.next() < 0.25) local += rng.int(1, 98);
    for (const p of projects) {
      out.push({
        donorKey: `${prefix}-${i}`,
        email: `${local}@${domain}`,
        projectId: p,
        amountUsd: money(rng, 2.3, 0.7, 1, 100),
        t: rng.uniform(0, ROUND_HOURS),
        source: 'simulated',
        simLabel: 0,
        status: 'CAPTURED',
      });
    }
  }
  return out;
}

function attackDonations(rng, kind, k, target, opts = {}) {
  const [t0lo, t0hi] = opts.t0Range || [10, ROUND_HOURS - 10];
  const prefix = opts.prefix || 'sim-ring';
  const others = PROJECT_IDS.filter((p) => p !== target);
  const out = [];
  const t0 = rng.uniform(t0lo, t0hi);
  const bursts = [rng.uniform(t0lo, t0hi), rng.uniform(t0lo, t0hi), rng.uniform(t0lo, t0hi)];
  const rec = (i, email, projectId, amountUsd, t) =>
    out.push({ donorKey: `${prefix}-${i}`, email, projectId, amountUsd, t, source: 'simulated', simLabel: 1, status: 'CAPTURED' });
  for (let i = 0; i < k; i++) {
    if (kind === 'naive') {
      const email = `user${rng.int(1000, 9999)}@${rng.pick(['mailbox.xyz', 'tempmail.io'])}`;
      rec(i, email, target, rng.pick([1, 2]), t0 + rng.uniform(0, 2));
    } else if (kind === 'jitter') {
      const email = `${rng.letters(5, 9)}@${rng.pick(DOMAINS)}`;
      rec(i, email, target, money(rng, 1.2, 0.5, 1, 10), rng.uniform(0, ROUND_HOURS));
    } else if (kind === 'adaptive') {
      const local = rng.letters(5, 9) + (rng.next() < 0.25 ? rng.int(1, 98) : '');
      const email = `${local}@${rng.pick(DOMAINS, DOMAIN_W)}`;
      rec(i, email, target, money(rng, 1.5, 0.6, 1, 15), rng.uniform(0, ROUND_HOURS));
      for (const d of rng.sample(others, rng.int(1, 2))) rec(i, email, d, money(rng, 1.0, 0.4, 1, 5), rng.uniform(0, ROUND_HOURS));
    } else if (kind === 'evasive') {
      const local = rng.letters(5, 9) + (rng.next() < 0.3 ? rng.int(1, 98) : '');
      const email = `${local}@${rng.pick(DOMAINS, DOMAIN_W)}`;
      const b = bursts[rng.int(0, 2)];
      rec(i, email, target, money(rng, 2.0, 0.6, 2, 30), b + rng.uniform(0, 1.5));
      for (const d of rng.sample(others, rng.int(2, 3))) rec(i, email, d, money(rng, 1.6, 0.5, 1, 10), rng.uniform(0, ROUND_HOURS));
    } else {
      throw new Error('unknown attack kind: ' + kind);
    }
  }
  return out;
}

/** Baseline = distinct donors per project in an independent honest "Round 0". */
function baselineFromRound0(seed, n = 250) {
  const rng = makeRng(seed);
  const d = honestDonations(rng, n, 'r0');
  const seen = new Set();
  const base = {};
  for (const x of d) {
    const key = x.donorKey + '|' + x.projectId;
    if (seen.has(key)) continue;
    seen.add(key);
    base[x.projectId] = (base[x.projectId] || 0) + 1;
  }
  for (const p of PROJECT_IDS) base[p] = base[p] || 0;
  return base;
}

/** attacks: [{kind, k, target}] */
function buildScenario({ seed, honest = 250, attacks = [] }) {
  const rng = makeRng(seed);
  let donations = honestDonations(rng, honest);
  attacks.forEach((a, idx) => {
    donations = donations.concat(attackDonations(rng, a.kind, a.k, a.target, { prefix: `sim-ring${idx}`, t0Range: a.t0Range }));
  });
  return { donations, baseline: baselineFromRound0(seed + 777, honest) };
}

module.exports = { NUM_PROJECTS, ROUND_HOURS, PROJECT_IDS, POPULARITY, ATTACK_KINDS, honestDonations, attackDonations, baselineFromRound0, buildScenario };
