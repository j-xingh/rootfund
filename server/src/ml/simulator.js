'use strict';
/**
 * Simulator (J2): honest donors + 4 attack types. Everything is seeded.
 * Time `t` = hours since the round opened (round length 168h).
 * A donation: { donorKey, email, projectId, amountUsd, t, source:'simulated', label }
 *   label = 'honest' | 'naive' | 'jitter' | 'adaptive' | 'evasive'   (ground truth, never a feature)
 */
const { makeRng } = require('./rng');

const ROUND_HOURS = 168;
const PROJECT_IDS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
// most popular ~22% of picks, least popular ~4%
const POPULARITY = [22, 17, 15, 13, 11, 10, 8, 4];

const ATTACK_KINDS = ['naive', 'jitter', 'adaptive', 'evasive'];

const FIRST = ['maria', 'james', 'priya', 'chen', 'olu', 'sara', 'liam', 'aisha', 'noah', 'emma', 'raj', 'lucia', 'omar', 'ana', 'ken', 'zoe', 'ivan', 'mei', 'leo', 'nina'];
const LAST = ['smith', 'patel', 'garcia', 'kim', 'nguyen', 'brown', 'lopez', 'khan', 'silva', 'jones', 'cohen', 'ali', 'rossi', 'sato', 'dubois'];
const COMMON_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
const COMMON_WEIGHTS = [55, 15, 12, 8, 10];
const ODD_DOMAINS = ['mailnest.top', 'quickmail.xyz', 'tmpbox.site'];

function normalEmail(rng, digitChance = 0.25) {
  const first = rng.pick(FIRST);
  const last = rng.pick(LAST);
  let local = rng.next() < 0.5 ? `${first}.${last}` : `${first}${last[0]}`;
  if (rng.next() < digitChance) local += String(rng.int(0, 99));
  return `${local}@${COMMON_DOMAINS[rng.weighted(COMMON_WEIGHTS)]}`;
}

function logNormalAmount(rng) {
  const a = Math.round(Math.exp(Math.log(10) + 0.7 * rng.normal()));
  return Math.min(100, Math.max(1, a));
}

function pickProjectsFor(rng, k, exclude = []) {
  const ids = PROJECT_IDS.filter((p) => !exclude.includes(p));
  const w = ids.map((p) => POPULARITY[PROJECT_IDS.indexOf(p)]);
  return rng.sampleDistinct(ids, w, k);
}

function simulateHonest(rng, n = 250, keyPrefix = 'h') {
  const out = [];
  for (let i = 0; i < n; i++) {
    const donorKey = `${keyPrefix}${i + 1}`;
    const email = normalEmail(rng);
    const k = [1, 2, 3, 4][rng.weighted([0.35, 0.35, 0.2, 0.1])];
    for (const projectId of pickProjectsFor(rng, k)) {
      out.push({ donorKey, email, projectId, amountUsd: logNormalAmount(rng), t: rng.uniform(0, ROUND_HOURS), source: 'simulated', label: 'honest' });
    }
  }
  return out;
}

// Round 0: a separate honest round, used only to know each project's usual donor count.
function simulateBaseline(seed, n = 250) {
  const donations = simulateHonest(makeRng(seed), n, 'b');
  const baseline = Object.fromEntries(PROJECT_IDS.map((p) => [p, 0]));
  const seen = new Set();
  for (const d of donations) {
    const k = `${d.donorKey}|${d.projectId}`;
    if (!seen.has(k)) { seen.add(k); baseline[d.projectId] += 1; }
  }
  return baseline;
}

function oddEmail(rng) {
  return `user${rng.int(100, 99999)}@${rng.pick(ODD_DOMAINS)}`;
}

/**
 * Create `size` fake donors aimed at targetProjectId.
 * burstStart (hours) defaults to a random time after hour 100 (live-demo rule).
 */
function injectAttack(rng, kind, { size = 120, targetProjectId, burstStart, keyPrefix = 'a' }) {
  if (!ATTACK_KINDS.includes(kind)) throw new Error(`unknown attack kind: ${kind}`);
  const out = [];
  const start = burstStart !== undefined ? burstStart : rng.uniform(100, 164);
  const bursts = kind === 'evasive' ? [rng.uniform(100, 120), rng.uniform(122, 142), rng.uniform(144, 164)] : null;
  const push = (donorKey, email, projectId, amountUsd, t) =>
    out.push({ donorKey, email, projectId, amountUsd, t, source: 'simulated', label: kind });

  for (let i = 0; i < size; i++) {
    const donorKey = `${keyPrefix}${i + 1}`;
    if (kind === 'naive') {
      push(donorKey, oddEmail(rng), targetProjectId, rng.int(1, 2), start + rng.uniform(0, 2));
      continue;
    }
    const email = normalEmail(rng, 0.3);
    if (kind === 'jitter' || kind === 'adaptive') {
      push(donorKey, email, targetProjectId, rng.int(1, 2), rng.uniform(0, ROUND_HOURS));
    } else { // evasive: three short bursts, higher amounts
      push(donorKey, email, targetProjectId, rng.int(3, 8), rng.pick(bursts) + rng.uniform(0, 3));
    }
    if (kind === 'adaptive' || kind === 'evasive') {
      const nDecoys = kind === 'adaptive' ? rng.int(1, 2) : rng.int(2, 3);
      for (const p of pickProjectsFor(rng, nDecoys, [targetProjectId])) {
        push(donorKey, email, p, kind === 'adaptive' ? rng.int(1, 5) : rng.int(2, 10), rng.uniform(0, ROUND_HOURS));
      }
    }
  }
  return out;
}

/**
 * One full labelled scenario: honest crowd + one attack ring.
 * Donor keys are shuffled into neutral ids (d001...) so a key never leaks the label.
 */
function buildScenario(seed, kind, targetIdx, { honest = 250, size = 120 } = {}) {
  const rng = makeRng(seed);
  const baseline = simulateBaseline(seed + 777777);
  let donations = simulateHonest(rng, honest, 'h');
  const target = PROJECT_IDS[targetIdx];
  if (kind && kind !== 'none') donations = donations.concat(injectAttack(rng, kind, { size, targetProjectId: target }));

  const keys = rng.shuffle([...new Set(donations.map((d) => d.donorKey))]);
  const rename = new Map(keys.map((k, i) => [k, `d${String(i + 1).padStart(3, '0')}`]));
  donations = donations.map((d) => ({ ...d, donorKey: rename.get(d.donorKey) }));
  const labels = {};
  for (const d of donations) labels[d.donorKey] = d.label === 'honest' ? 0 : 1;
  return { seed, kind, target, donations, baseline, labels };
}

module.exports = { PROJECT_IDS, POPULARITY, ATTACK_KINDS, ROUND_HOURS, simulateHonest, simulateBaseline, injectAttack, buildScenario };
