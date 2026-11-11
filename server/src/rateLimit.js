'use strict';
/**
 * Tiny fixed-window rate limiter keyed by client IP, kept in memory (one Render instance, so that is enough).
 * Over the limit the request gets 429 with a Retry-After header, in the app's usual error shape.
 */
function rateLimit({ windowMs = 60_000, max, name = 'requests', now = Date.now } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }
  return (req, res, next) => {
    const t = now();
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k); // lazy cleanup, no timers
    const key = req.ip || 'unknown';
    let h = hits.get(key);
    if (!h || h.resetAt <= t) { h = { count: 0, resetAt: t + windowMs }; hits.set(key, h); }
    h.count += 1;
    if (h.count <= max) return next();
    const retry = Math.ceil((h.resetAt - t) / 1000);
    res.set('Retry-After', String(retry));
    res.status(429).json({ error: { code: 'RATE_LIMITED', message: `too many ${name}, try again in ${retry}s`, debugId: null } });
  };
}

module.exports = { rateLimit };
