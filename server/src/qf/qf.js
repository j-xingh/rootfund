'use strict';
/**
 * Quadratic funding (QF) engine. Pure functions, no I/O.
 *
 * For each project p, with each donor's contribution c (multiplied by that donor's weight w):
 *   raw(p)   = (sum over donors of sqrt(c))^2 - (sum over donors of c)
 *   match(p) = pool * raw(p) / sum(raw over all projects)
 * Optional cap: no project may receive more than `capShare` of the pool; the excess is
 * redistributed to the others in proportion to their share (repeated until stable).
 * The cap is skipped when it cannot be satisfied (projects with raw > 0 times capShare < 1).
 * Money is returned in integer cents using largest-remainder rounding, so the total
 * never exceeds the pool.
 */

function aggregate(donations, weights) {
  // Map projectId -> Map donorKey -> weighted contribution
  const byProject = new Map();
  for (const d of donations) {
    if (d.status === 'REFUNDED' || d.status === 'CREATED' || d.status === 'FAILED') continue;
    const w = weights && weights.has(d.donorKey) ? weights.get(d.donorKey) : 1;
    if (w <= 0) continue;
    if (!byProject.has(d.projectId)) byProject.set(d.projectId, new Map());
    const m = byProject.get(d.projectId);
    m.set(d.donorKey, (m.get(d.donorKey) || 0) + d.amountUsd * w);
  }
  return byProject;
}

function rawMatch(contribs) {
  let sumSqrt = 0;
  let sum = 0;
  for (const c of contribs.values()) {
    sumSqrt += Math.sqrt(c);
    sum += c;
  }
  return Math.max(0, sumSqrt * sumSqrt - sum);
}

function applyCap(shares, capShare) {
  const ids = Object.keys(shares).filter((k) => shares[k] > 0);
  if (!capShare || ids.length * capShare < 1) return { ...shares };
  const out = { ...shares };
  for (let i = 0; i < 50; i++) {
    const over = ids.filter((k) => out[k] > capShare + 1e-12);
    if (over.length === 0) break;
    let excess = 0;
    for (const k of over) {
      excess += out[k] - capShare;
      out[k] = capShare;
    }
    const rest = ids.filter((k) => !over.includes(k) && out[k] < capShare - 1e-12);
    const restSum = rest.reduce((a, k) => a + out[k], 0);
    if (restSum <= 0) break;
    for (const k of rest) out[k] += (excess * out[k]) / restSum;
  }
  return out;
}

function toCents(shares, poolCents) {
  const ids = Object.keys(shares);
  const floored = ids.map((k) => {
    const v = shares[k] * poolCents;
    const c = Math.floor(v + 1e-9);
    return { k, c, r: v - c };
  });
  let left = Math.round(Object.values(shares).reduce((a, b) => a + b, 0) * poolCents) - floored.reduce((a, e) => a + e.c, 0);
  floored.sort((a, b) => b.r - a.r);
  for (let i = 0; left > 0 && i < floored.length; i++, left--) floored[i].c += 1;
  const res = {};
  for (const e of floored) res[e.k] = e.c;
  return res;
}

/**
 * @param {Array} donations  [{projectId, donorKey, amountUsd, status?}]
 * @param {Array} projects   [{id}]
 * @param {Object} opts      {poolUsd, weights: Map<donorKey, 0..1>, capShare: number|null}
 */
function computeAllocations(donations, projects, opts = {}) {
  const poolUsd = opts.poolUsd ?? 100;
  const poolCents = Math.round(poolUsd * 100);
  const byProject = aggregate(donations, opts.weights);
  const raw = {};
  for (const p of projects) raw[p.id] = byProject.has(p.id) ? rawMatch(byProject.get(p.id)) : 0;
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const shares = {};
  for (const p of projects) shares[p.id] = total > 0 ? raw[p.id] / total : 0;
  const capped = applyCap(shares, opts.capShare ?? null);
  const cents = total > 0 ? toCents(capped, poolCents) : {};
  const items = projects.map((p) => ({
    projectId: p.id,
    matchCents: cents[p.id] || 0,
    matchUsd: (cents[p.id] || 0) / 100,
    sharePct: poolCents > 0 ? ((cents[p.id] || 0) / poolCents) * 100 : 0,
    donors: byProject.has(p.id) ? byProject.get(p.id).size : 0,
    rawMatch: raw[p.id],
  }));
  return { poolUsd, items };
}

module.exports = { computeAllocations, rawMatch, applyCap, toCents };
