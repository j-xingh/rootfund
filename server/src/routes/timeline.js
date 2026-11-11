'use strict';
// GET /api/timeline: one dot per counted donation, for the attack timeline chart.
const { analyze } = require('../service');

module.exports = function registerTimeline(app, { store, model, cfg, requireAdmin }) {
  // GET /api/admin/ping: lets the admin screen check the admin key without changing anything.
  // requireAdmin is app.js's constant-time check, so a wrong key gets the same 401 as every admin route.
  app.get('/api/admin/ping', requireAdmin, (_req, res) => res.json({ ok: true }));

  app.get('/api/timeline', async (_req, res, next) => {
    try {
      const a = await analyze(store, model, cfg);
      const flaggedDonors = new Set(a.flagged.map((f) => f.donorKey));
      res.json({
        hours: 168,
        projects: a.projects.map((p) => ({ id: p.id, name: p.name })),
        points: a.counted.map((d) => ({
          t: Math.round(d.t * 100) / 100,
          projectId: d.projectId,
          amountUsd: d.amountUsd,
          source: d.source,
          flagged: flaggedDonors.has(d.donorKey),
        })),
      });
    } catch (e) { next(e); }
  });
};
