'use strict';
const { buildScenario, attackDonations, ATTACK_KINDS, PROJECT_IDS } = require('./ml/sim');
const { makeRng } = require('./ml/rng');

const ROUND_ID = 'round-1';
const PROJECT_INFO = [
  ['Community Garden', 'Raised beds and tools for a shared neighborhood garden.'],
  ['Open Library Fund', 'Free books and a reading room for local kids.'],
  ['Youth Robotics Club', 'Parts and mentoring for a school robotics team.'],
  ['River Cleanup Crew', 'Gear and transport for monthly river cleanups.'],
  ['Street Mural Collective', 'Paint and permits for public murals.'],
  ['Free Coding Bootcamp', 'Laptops and instructors for a free evening bootcamp.'],
  ['Neighborhood Clinic Fund', 'Supplies for a volunteer-run weekend clinic.'],
  ['Tool Lending Library', 'A shared shelf of tools anyone can borrow.'],
];

/** Wipes demo data and seeds: 8 projects, a baseline (Round 0) and 250 honest simulated donors. */
async function seedDemo(store, cfg, { keepReal = false } = {}) {
  await store.remove('donations', keepReal ? { source: 'simulated' } : {});
  for (const c of ['rounds', 'projects', 'settlements']) await store.remove(c, {});
  const sc = buildScenario({ seed: 2026, honest: 250, attacks: [] });
  // settleKey changes on every reset, so each rehearsal gets a new PayPal sender_batch_id (PayPal refuses reused ones).
  const settleKey = `${ROUND_ID}-${Date.now().toString(36)}`;
  await store.insert('rounds', { _id: ROUND_ID, status: 'OPEN', poolUsd: cfg.poolUsd, openedAt: new Date().toISOString(), baseline: sc.baseline, settleKey });
  await store.insertMany('projects', PROJECT_IDS.map((id, i) => ({
    _id: id, name: PROJECT_INFO[i][0], description: PROJECT_INFO[i][1],
    ownerEmail: cfg.ownerEmails.length ? cfg.ownerEmails[i % cfg.ownerEmails.length] : `owner-${id}@example.com`,
  })));
  await store.insertMany('donations', sc.donations.map((d) => ({ ...d, roundId: ROUND_ID })));
}

async function ensureSeeded(store, cfg) {
  if (!(await store.get('rounds', ROUND_ID))) await seedDemo(store, cfg);
}

/** Injects a simulated sybil attack. Bursts are placed after hour 100 so real donations never collide with them. */
async function injectAttack(store, { kind, size, targetProjectId }) {
  if (!ATTACK_KINDS.includes(kind)) throw httpError(400, `kind must be one of ${ATTACK_KINDS.join(', ')}`);
  const n = Number(size);
  if (!Number.isInteger(n) || n < 1 || n > 600) throw httpError(400, 'size must be an integer from 1 to 600');
  if (!PROJECT_IDS.includes(targetProjectId)) throw httpError(400, 'unknown targetProjectId');
  const prefix = `sim-ring-${Date.now().toString(36)}`;
  const ds = attackDonations(makeRng(Date.now() % 2147483647), kind, n, targetProjectId, { prefix, t0Range: [100, 150] });
  await store.insertMany('donations', ds.map((d) => ({ ...d, roundId: ROUND_ID })));
  return ds.length;
}

function httpError(status, message, code) {
  return Object.assign(new Error(message), { status, code: code || 'BAD_REQUEST' });
}

module.exports = { ROUND_ID, seedDemo, ensureSeeded, injectAttack, httpError, PROJECT_INFO };
