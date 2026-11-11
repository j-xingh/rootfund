# Tasks

Status legend: DONE = written and tested here. CODE = written and unit-tested against a fake PayPal, **not yet run against the real sandbox** (Gate 1 proves it). TODO = not started.

## Backend developer

| ID | Task | Status |
|---|---|---|
| B1 | GitHub collaborator access, Atlas cluster, Render service, env vars, `/api/health` live | TODO (manual, see docs/SETUP-BEGINNER.md) |
| B2 | PayPal client, checkout, return, capture | CODE |
| B3 | Webhook endpoint (raw body, verify, dedupe, handlers) | CODE |
| B4 | Payouts batch, status refresh | CODE |
| B5 | Refund flow | CODE |
| B6 | Round lifecycle, seed, attack injector, reset | DONE |
| B7 | Integrity plumbing, admin refund and settle | DONE |
| B8 | Hardening: validation, constant-time admin key, closed-round guard, raw-body webhook verify, PENDING/REVERSED webhooks, throttled payout polling, reconcile captures abandoned approvals, fresh payout batch id per reset, per-IP rate limits | DONE |
| B9 | Uptime ping, clean-clone test, deploy README | CODE: `render.yaml` blueprint, `npm run smoke`, docs/DEPLOY.md; clean clone installs, builds, passes 35 tests and both smoke modes (11 Nov). Left (manual): the cron-job.org ping once deployed |
| B10 | Run the MongoDB store against Atlas (`MONGODB_URI`) and fix anything that breaks | PARTIAL: full flow passes on an in-memory MongoDB (`test/mongo-store.test.js`); still to run against the real Atlas cluster |

## Jay

| ID | Task | Status |
|---|---|---|
| J1 | QF engine and tests | DONE |
| J2 | Simulator, 10 features, dataset export | DONE |
| J3 | Training, evaluation, leave-one-out, parity | DONE (review it, understand it, extend it) |
| J4 | Scorer, policy, templated explanations | DONE |
| J5 | Client scaffold | DONE |
| J6 | Dashboard design and animation | BASELINE working, needs design |
| J7 | Integrity panel: ring timeline plot, metrics card, attack kind selector | BASELINE (table only) |
| J8 | Settlement screen, refund action polish | BASELINE |
| J9 | Loading, error and empty states, responsive polish | TODO |
| J10 | README numbers (rerun `npm run ml:all`), diagram, demo script, video | TODO |

## Gate 1 (do first, together)

1. `npm run gate1` prints PASS for: credentials and order, capture, refund, payout.
2. Webhook registered on the deployed URL; a simulated event reaches it (shows in the Render logs) and `npm run smoke -- <url>` passes.
3. A real donation made through the deployed site appears in the ledger.
