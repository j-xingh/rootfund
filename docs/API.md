# API

All responses are JSON. Admin endpoints need the header `x-admin-key: <ADMIN_KEY>`.

| Method and path | Purpose |
|---|---|
| `GET /api/health` | status, PayPal mode, store type |
| `GET /api/round` | round, projects, totals (real and simulated counts) |
| `GET /api/allocations?mode=naive\|protected` | match per project: `{mode, poolUsd, capShare, items[{projectId,name,matchUsd,matchCents,sharePct,donors}], flaggedDonors}` |
| `GET /api/integrity` | `{counts, flagged[{donorKey,emailMasked,score,reasons[],source,donationIds[]}], metrics}` (admin key adds `simLabel`) |
| `GET /api/donations?limit=` | ledger of real PayPal donations |
| `POST /api/donations/checkout` | body `{projectId, amountUsd}` (whole dollars 1 to 100); returns `{donationId, approveUrl}` |
| `GET /api/donations/return?d=&token=` | PayPal return URL: captures the order, then redirects to `/?donation=ok` |
| `POST /api/webhooks/paypal` | PayPal webhook receiver (raw body, signature verified, deduped by event id) |
| `POST /api/admin/attack` | body `{kind: naive\|jitter\|adaptive\|evasive, size, targetProjectId}` injects simulated fake donors |
| `POST /api/admin/reset-demo` | body `{keepReal}` reseeds projects and the honest simulated crowd |
| `POST /api/admin/refund-flagged` | refunds flagged real donations (or the `donationIds` you pass) |
| `POST /api/admin/settle` | body `{approve: true}` required; one idempotent Payouts batch of protected matches |
| `GET /api/settlement` | settlement and per-item status (refreshes from PayPal), or a preview |
| `POST /api/admin/reconcile` | re-reads order and payout state from PayPal |

Errors look like `{error: {code, message, debugId}}`.

Rate limits per client IP, per minute: `POST /api/donations/checkout` 20, `/api/admin/*` 60, all `/api` 600. Over the limit: `429` with code `RATE_LIMITED` and a `Retry-After` header (seconds). `POST /api/webhooks/paypal` is never limited.
