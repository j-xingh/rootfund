# Rootfund

**Quadratic funding that resists fake donors, running on PayPal.**

Communities fund local projects with small donations, and a sponsor-funded matching pool is split by
[quadratic funding](https://en.wikipedia.org/wiki/Quadratic_funding): many small donors count for more than one big donor.
That rule is also easy to cheat with fake accounts. Rootfund adds an AI detector that scores every donor, excludes suspected
fake donors from the match, explains each flag in plain language, and then pays the real match out through PayPal.

- **Donations in:** PayPal Orders API (create order, buyer approval, capture)
- **State changes:** PayPal webhooks with signature verification
- **Matches out:** PayPal Payouts API (one batch, idempotent)
- **Quarantine:** PayPal refunds for flagged real donations
- **AI:** a gradient-boosted-trees fraud detector (scikit-learn, trained offline, scored in Node) plus a burst rule, with a per-project cap and a human approval step before payouts

## Quick start (no PayPal account needed)

```bash
npm run install:all
cp .env.example .env        # Windows: copy .env.example .env
npm run build
npm start                   # http://localhost:3000  (PAYPAL_MODE=mock)
```

In mock mode a fake PayPal page stands in so you can build and test offline. For the real thing set `PAYPAL_MODE=sandbox`
and follow [docs/SETUP-BEGINNER.md](docs/SETUP-BEGINNER.md).

Run the tests: `npm test` (money math, detector parity with scikit-learn, API flows, PayPal request shapes).

## How it works

1. Donors give $1 to $100 to a project through PayPal checkout. Every capture is stored in a ledger.
2. At any time `/api/allocations` computes the match twice: **naive** QF and **protected** QF.
3. Protected QF scores every donor (10 behavioral features), excludes flagged donors, and caps any project at 40% of the pool.
4. An admin reviews flagged donors, optionally refunds flagged real donations, and approves settlement.
5. Settlement sends one PayPal Payouts batch to the project owners.

## Real versus simulated data (please read)

Every donation has `source: paypal` (a real sandbox payment) or `source: simulated` (the seeded honest crowd and the injected attack).
Only `paypal` donations touch PayPal. The UI labels both. The detector is trained and evaluated on simulated data.

## Detector evaluation (simulated data, 15 seeded runs, 250 honest donors, ring of 250 fake donors)

Share of the matching pool captured by the attacked project (lower is better; with no attack it is about 1.3%):

| Attack | Model precision | Model recall | Naive QF | Rootfund (model OR burst rule) |
|---|---|---|---|---|
| naive (burst, odd emails) | 0.99 | 1.00 | 24.9% | 1.1% |
| jitter (spread out, normal emails) | 0.99 | 1.00 | 40.9% | 1.1% |
| adaptive (adds decoy donations) | 0.98 | 0.99 | 33.4% | 1.2% |
| evasive (held out of training) | 0.92 | 0.54 | 30.9% | 3.2% |

**Limits, stated plainly.** The model does not generalize across attack families: trained without a family, recall on it was
1.00 (naive), 0.40 (jitter) and 0.00 (adaptive). The burst rule catches the held-out evasive family because it still comes in bursts;
an attacker who avoids bursts and every other pattern would evade both. That is why the system also has a per-project cap
and a human approval step before money moves. Regenerate all numbers with `npm run ml:all` (needs Python 3.10+).

## Project layout

```
server/   Express API: PayPal client, QF engine, simulator, features, scorer, store (memory or MongoDB)
client/   React + Vite dashboard (built into client/dist and served by the server)
ml/       Python training script (offline). Features are computed in JavaScript only, so training and serving match
scripts/  dataset export, evaluation, ML pipeline, Gate 1 PayPal check
docs/     setup guide, API, tasks, decisions
```

## License

MIT. See [LICENSE](LICENSE).
