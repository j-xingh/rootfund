'use strict';
/**
 * Smoke check for a running Rootfund (local or deployed). Read-only: it never moves money.
 *   npm run smoke                                   (checks PUBLIC_BASE_URL from .env, else http://localhost:3000)
 *   npm run smoke -- https://rootfund.onrender.com  (checks the deployed site; the first request may take ~1 min while Render wakes it)
 * Exits with code 1 if any check fails, so it can also run in CI or a cron job.
 */
const { cfg } = require('../server/src/config');

const base = (process.argv[2] || cfg.publicBaseUrl).replace(/\/$/, '');
let failed = 0;
const ok = (m) => console.log('  PASS  ' + m);
const warn = (m) => console.log('  WARN  ' + m);
const bad = (m) => { failed += 1; console.log('  FAIL  ' + m); };

async function get(path, opts = {}) {
  const r = await fetch(base + path, { signal: AbortSignal.timeout(90_000), redirect: 'manual', ...opts });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* html or empty */ }
  return { status: r.status, json, text };
}

(async () => {
  console.log(`Smoke check: ${base}\n`);
  const t0 = Date.now();
  let health;
  try { health = await get('/api/health'); } catch (e) { bad(`cannot reach ${base}/api/health: ${e.message}`); process.exit(1); }
  if (health.status !== 200 || !health.json?.ok) { bad(`/api/health returned ${health.status}`); process.exit(1); }
  ok(`health in ${Date.now() - t0} ms: paypal=${health.json.paypalMode}, store=${health.json.store}`);
  const deployed = base.startsWith('https://');
  if (deployed && health.json.paypalMode !== 'sandbox') warn('deployed site is not on PAYPAL_MODE=sandbox');
  if (deployed && health.json.store !== 'mongo') warn('deployed site is not using MongoDB: data is lost on every restart (set MONGODB_URI)');

  const round = await get('/api/round');
  if (round.status === 200 && round.json?.projects?.length === 8) ok(`round ${round.json.round?.status}: 8 projects, ${round.json.totals?.real ?? 0} real donations`);
  else bad(`/api/round returned ${round.status} with ${round.json?.projects?.length ?? 0} projects`);

  for (const mode of ['naive', 'protected']) {
    const a = await get('/api/allocations?mode=' + mode);
    if (a.status === 200 && Array.isArray(a.json?.items) && a.json.items.length === 8) ok(`allocations (${mode}) computed`);
    else bad(`/api/allocations?mode=${mode} returned ${a.status}`);
  }

  const led = await get('/api/donations');
  if (led.status === 200 && Array.isArray(led.json?.items)) ok(`ledger readable (${led.json.items.length} real donations)`);
  else bad(`/api/donations returned ${led.status}`);

  // An unsigned event must be rejected in sandbox mode (the mock accepts anything, so it is skipped there).
  if (health.json.paypalMode === 'sandbox') {
    const hook = await get('/api/webhooks/paypal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'WH-SMOKE-' + Date.now(), event_type: 'SMOKE.TEST' }) });
    if (hook.status === 400 && hook.json?.error?.code === 'INVALID_SIGNATURE') ok('webhook endpoint is up and rejects unsigned events');
    else bad(`unsigned webhook got ${hook.status} (expected 400 INVALID_SIGNATURE)`);
  }

  const admin = await get('/api/admin/reconcile', { method: 'POST', headers: { 'x-admin-key': 'smoke-wrong-key' } });
  if (admin.status === 401) ok('admin routes reject a wrong key');
  else bad(`admin route with a wrong key got ${admin.status} (expected 401)`);

  const page = await get('/');
  if (page.status === 200 && /<div id="root"/.test(page.text)) ok('dashboard page served');
  else bad(`/ returned ${page.status}: run "npm run build" so client/dist exists`);

  console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
  process.exit(failed ? 1 : 0);
})();
