# Deploy (Render + MongoDB Atlas + PayPal sandbox)

The short path. The click-by-click version for first-timers is [SETUP-BEGINNER.md](SETUP-BEGINNER.md) parts D to F.
Do Gate 1 (`npm run gate1`) locally first, so you know the PayPal credentials work before deploying.

## 1. Create the service from the blueprint

Render dashboard, **New, Blueprint**, pick the `rootfund` repo. Render reads [`render.yaml`](../render.yaml) and creates a free Node web service:

| Setting | Value |
|---|---|
| Build | `npm run build` (installs server and client, builds `client/dist`) |
| Start | `npm start` |
| Health check | `/api/health` |
| Auto deploy | on every push to `main` |

It then asks for the values marked `sync: false`:

| Variable | Where it comes from |
|---|---|
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | developer.paypal.com, Apps & Credentials, Sandbox, your app |
| `PROJECT_OWNER_EMAILS` | 3 sandbox **personal** account emails, comma separated (they receive payouts) |
| `MONGODB_URI` | Atlas, Connect, Drivers. Network Access must allow `0.0.0.0/0` |
| `PAYPAL_WEBHOOK_ID` | leave empty for now, filled in at step 3 |

Set automatically: `PAYPAL_MODE=sandbox`, `NODE_VERSION=22`, `POOL_USD=100` (lower it if the sandbox business balance is under $300), and a random `ADMIN_KEY`. Find it under the service's **Environment** tab and share it with Jay; it is what the admin box in the UI needs.

`PUBLIC_BASE_URL` is optional: the app uses `RENDER_EXTERNAL_URL`, which Render sets to `https://<service>.onrender.com`. Set it only if you add a custom domain.

## 2. Check the deploy

```bash
npm run smoke -- https://<service>.onrender.com
```

Read-only, moves no money. Every line should say PASS: health (`paypal=sandbox`, `store=mongo`), round, both allocations, ledger, the webhook endpoint rejecting an unsigned event, admin rejecting a wrong key, and the dashboard page. The first request can take about a minute while a sleeping free service wakes up.

## 3. Register the webhook

PayPal developer dashboard, your app, **Webhooks, Add webhook**:

- URL: `https://<service>.onrender.com/api/webhooks/paypal`
- Events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`, `PAYMENT.PAYOUTSBATCH.PROCESSING`, `PAYMENT.PAYOUTSBATCH.SUCCESS`, `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `PAYMENT.PAYOUTS-ITEM.DENIED`

Copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID` on Render (saving env vars redeploys). Then send a test event from the dashboard's webhook simulator. Simulator events are usually not verifiable against your webhook ID, so a `400 INVALID_SIGNATURE` reply is normal there; it still proves PayPal reaches the URL (the request shows in the Render logs). Real events from a donation are verified and return `200`; check the dashboard's webhook event history after the step 5 donation.

## 4. Keep it awake

Free services sleep after 15 minutes idle. Create a free job at https://cron-job.org (or UptimeRobot) that GETs `https://<service>.onrender.com/api/health` every 10 minutes. Keep it running until judging ends (15 December).

## 5. End-to-end check

Open the site in a private window, donate $1 as a sandbox donor, and confirm the donation shows **CAPTURED** in the ledger.
If someone approved on PayPal but closed the tab before returning, the admin **Reconcile** action captures it.

## Limits and safety already in the app

- Per-IP rate limits: checkout 20/min, admin 60/min, all `/api` 600/min. Over the limit returns `429 RATE_LIMITED` with `Retry-After`. PayPal webhooks are never limited.
- Webhook signatures are verified against the raw request bytes, and events are deduplicated by id.
- The payout `sender_batch_id` changes after every **Reset demo**, so rehearsals can settle more than once.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `store=memory` in health | `MONGODB_URI` missing or wrong. Check the Render logs for `startup failed` |
| Startup log says `MongoServerSelectionError` | Atlas Network Access is missing `0.0.0.0/0`, or the password has special characters that need URL encoding |
| Checkout fails with a PayPal error and a `debugId` | Wrong client id or secret, or a live (not sandbox) app. Run `npm run gate1` locally with the same values |
| Donations stay CREATED | Webhook not registered or `PAYPAL_WEBHOOK_ID` wrong. Use admin **Reconcile** in the meantime |
| Payout `DENIED` / `INSUFFICIENT_FUNDS` | Lower `POOL_USD`, or check that Payouts is enabled for the sandbox app |
| Config warnings at startup | Shown in the Render logs; each one names the missing variable |
