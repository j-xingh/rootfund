'use strict';
/**
 * The 10 donor features. This file is the single source of truth: it is used to build the
 * training CSV, to evaluate, and to score live donors. Do not re-implement it in Python.
 */
const FEATURE_NAMES = [
  'n_projects',
  'log_mean_amount',
  'std_amount',
  'burst_30min',
  'email_domain_share',
  'email_digit_ratio',
  'same_project_set_share',
  'inv_n_projects',
  'tiny_round_flag',
  'surge_vs_round0',
];

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const std = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length);
};

/** donations: [{donorKey,email,projectId,amountUsd,t,simLabel?}], baseline: {projectId: count} */
function computeFeatures(donations, baseline) {
  const byDonor = new Map();
  const byProject = new Map();
  for (const d of donations) {
    if (!byDonor.has(d.donorKey)) byDonor.set(d.donorKey, []);
    byDonor.get(d.donorKey).push(d);
    if (!byProject.has(d.projectId)) byProject.set(d.projectId, []);
    byProject.get(d.projectId).push(d);
  }
  const N = byDonor.size;
  const domainCount = new Map();
  const setCount = new Map();
  const setKey = new Map();
  for (const [k, ds] of byDonor) {
    const dom = (ds[0].email || '@unknown').split('@')[1] || 'unknown';
    domainCount.set(dom, (domainCount.get(dom) || 0) + 1);
    const key = [...new Set(ds.map((x) => x.projectId))].sort().join(',');
    setKey.set(k, key);
    setCount.set(key, (setCount.get(key) || 0) + 1);
  }
  // distinct donors per project this round (for surge)
  const projDonors = new Map();
  for (const [p, ds] of byProject) projDonors.set(p, new Set(ds.map((x) => x.donorKey)).size);
  // sort each project's donations by time for the burst feature
  for (const ds of byProject.values()) ds.sort((a, b) => a.t - b.t);
  const burstFor = (d) => {
    const list = byProject.get(d.projectId);
    let c = 0;
    // linear scan outward is fine at demo scale (a few thousand rows)
    for (const o of list) {
      if (o.donorKey === d.donorKey) continue;
      if (Math.abs(o.t - d.t) <= 0.5) c++;
    }
    return c;
  };
  const rows = [];
  for (const [k, ds] of byDonor) {
    const amounts = ds.map((x) => x.amountUsd);
    const email = ds[0].email || '@unknown';
    const [local, dom] = [email.split('@')[0], email.split('@')[1] || 'unknown'];
    const projects = [...new Set(ds.map((x) => x.projectId))];
    const surge = Math.max(...projects.map((p) => Math.log(((projDonors.get(p) || 0) + 1) / ((baseline[p] || 0) + 1))));
    const digits = [...local].filter((ch) => ch >= '0' && ch <= '9').length;
    const x = [
      projects.length,
      Math.log1p(mean(amounts)),
      std(amounts),
      mean(ds.map(burstFor)),
      domainCount.get(dom) / N,
      local.length ? digits / local.length : 0,
      (setCount.get(setKey.get(k)) - 1) / N,
      1 / projects.length,
      amounts.every((a) => Number.isInteger(a) && a <= 2) ? 1 : 0,
      surge,
    ];
    rows.push({ donorKey: k, x, label: ds.some((d) => d.simLabel === 1) ? 1 : 0 });
  }
  return rows;
}

module.exports = { FEATURE_NAMES, computeFeatures };
