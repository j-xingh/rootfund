'use strict';
const { computeAllocations } = require('./qf/qf');
const { scoreDonors, explain } = require('./ml/scorer');
const { weightsFromScores, CAP_SHARE, isFlagged } = require('./ml/policy');
const { ROUND_ID } = require('./rounds');

const maskEmail = (e = '') => {
  const [l, d] = e.split('@');
  return d ? `${l.slice(0, 2)}***@${d}` : '***';
};

/** Loads the round and computes naive and protected allocations plus the flagged donor list. */
async function analyze(store, model, cfg) {
  const round = await store.get('rounds', ROUND_ID);
  const projects = (await store.find('projects')).map((p) => ({ ...p, id: p._id }));
  const all = await store.find('donations', { roundId: ROUND_ID });
  const counted = all.filter((d) => d.status === 'CAPTURED');
  const scores = scoreDonors(model, counted, round.baseline);
  const weights = weightsFromScores(scores, 'hybrid');
  const naive = computeAllocations(counted, projects, { poolUsd: round.poolUsd });
  const protectedAlloc = computeAllocations(counted, projects, { poolUsd: round.poolUsd, weights, capShare: CAP_SHARE });
  const name = (id) => projects.find((p) => p.id === id)?.name;
  const decorate = (a, mode) => ({
    mode, poolUsd: a.poolUsd, capShare: mode === 'protected' ? CAP_SHARE : null,
    items: a.items.map((i) => ({ projectId: i.projectId, name: name(i.projectId), matchUsd: i.matchUsd, matchCents: i.matchCents, sharePct: Math.round(i.sharePct * 10) / 10, donors: i.donors })),
  });
  const flagged = [];
  for (const [donorKey, s] of scores) {
    if (!isFlagged(s)) continue;
    const mine = counted.filter((d) => d.donorKey === donorKey);
    flagged.push({
      donorKey, emailMasked: maskEmail(mine[0]?.email), score: Math.round(s.score * 1000) / 1000,
      reasons: s.reasons.length ? s.reasons : explain(model, s.x),
      source: mine.some((d) => d.source === 'paypal') ? 'paypal' : 'simulated',
      donationIds: mine.map((d) => d._id), simLabel: s.label,
    });
  }
  flagged.sort((a, b) => b.score - a.score);
  return { round, projects, all, counted, scores, naive: decorate(naive, 'naive'), protected: decorate(protectedAlloc, 'protected'), flagged };
}

module.exports = { analyze, maskEmail };
