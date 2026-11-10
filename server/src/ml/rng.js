'use strict';
// Small seeded random number generator (mulberry32) so simulations are reproducible.
function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const uniform = (lo, hi) => lo + (hi - lo) * next();
  const int = (lo, hi) => Math.floor(uniform(lo, hi + 1)); // inclusive
  const normal = () => {
    const u = Math.max(next(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  const lognormal = (mu, sigma) => Math.exp(mu + sigma * normal());
  const pick = (arr, weights) => {
    if (!weights) return arr[Math.floor(next() * arr.length)];
    const tot = weights.reduce((x, y) => x + y, 0);
    let r = next() * tot;
    for (let i = 0; i < arr.length; i++) {
      r -= weights[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  };
  const sample = (arr, k, weights) => {
    const items = arr.slice();
    const w = weights ? weights.slice() : items.map(() => 1);
    const out = [];
    for (let n = 0; n < k && items.length; n++) {
      const idx = items.indexOf(pick(items, w));
      out.push(items[idx]);
      items.splice(idx, 1);
      w.splice(idx, 1);
    }
    return out;
  };
  const letters = (lo, hi) => {
    const n = int(lo, hi);
    let s = '';
    for (let i = 0; i < n; i++) s += String.fromCharCode(97 + Math.floor(next() * 26));
    return s;
  };
  return { next, uniform, int, normal, lognormal, pick, sample, letters };
}
module.exports = { makeRng };
