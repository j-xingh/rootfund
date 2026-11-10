# Decisions log

One line per decision so nobody re-debates it.

- Node 22, Express, React + Vite, one deployed service (the server serves `client/dist`).
- No PayPal SDK: direct REST calls (see `server/src/paypal/client.js`).
- Features are computed in JavaScript only. Python trains on a CSV exported by Node, so training and serving cannot drift.
- Model is exported as JSON and scored in Node. A parity test proves the match with scikit-learn (difference below 1e-9).
- Donors are identified by PayPal `payer_id`. No accounts or login. Admin actions use `x-admin-key`.
- Donations are whole dollars from $1 to $100, USD only.
- Real and simulated donations are labeled (`source`) everywhere.
- Settlement requires an explicit human approval and uses an idempotent batch id.

## Changes since the Team Build Guide (this file wins where they differ)

1. **Policy is hybrid:** exclude a donor if the model score is above 0.5 OR the donor made 10+ donations to one project within 30 minutes of others. In evaluation this beat the model alone on the held-out evasive attack (3.2% versus 19.4% pool share).
2. **Cap is 40%, not 25%:** honest winners reach about 33% of the pool in simulation, so a 25% cap clipped honest results.
3. **Mock PayPal mode** (`PAYPAL_MODE=mock`) so the UI can be built before credentials work. The final demo must run in `sandbox` mode.
4. **Storage:** an in-memory store is used when `MONGODB_URI` is empty. The MongoDB store is written but has not been run against a live Atlas cluster yet.
5. **Evaluation runs in JavaScript** (same code path as serving), not in Python.

## Known limitations (also state these in the README and video)

- Detector generalizes poorly across attack families (leave-one-family-out recall: naive 1.00, jitter 0.40, adaptive 0.00).
- All detector numbers come from simulated data.
- Real PayPal behavior has not been exercised by this code yet: Gate 1 does that.
