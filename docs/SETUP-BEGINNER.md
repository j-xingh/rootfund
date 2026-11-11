# Setup guide for beginners

Follow the parts in order. Each part ends with a check so you know it worked. If a check fails, stop and fix it before moving on.
Windows users: use **Git Bash** (installed with Git) or PowerShell. Commands are the same except where noted.

## Part A. Install tools (about 20 minutes)

1. **Node.js 22 LTS**: https://nodejs.org (download the LTS installer). Check: `node -v` prints v22.x (v20 or higher also works).
2. **Git**: https://git-scm.com/downloads. Check: `git --version`.
3. **VS Code** (editor): https://code.visualstudio.com
4. **Python 3.10 or newer** (only the person doing ML needs it): https://www.python.org. Check: `python --version` (on Mac/Linux it may be `python3 --version`).
5. Tell Git who you are (once per computer):
   ```
   git config --global user.name "Your Name"
   git config --global user.email "you@example.com"
   ```

## Part B. Put the code on GitHub (about 10 minutes)

One person (Jay) does this, then adds the teammate.

1. Create a free account at https://github.com if you do not have one.
2. Click **New repository**. Name: `rootfund`. Choose **Public**. Do **not** tick "Add a README", ".gitignore" or "license" (they are already in the project). Click **Create repository**. Copy the repository URL it shows (looks like `https://github.com/YOURNAME/rootfund.git`).
3. Unzip `rootfund-starter.zip`, open the `rootfund` folder in VS Code, and open the terminal (View, then Terminal). Run:
   ```
   git init
   git add .
   git commit -m "Initial Rootfund starter"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/rootfund.git
   git push -u origin main
   ```
   If a browser window asks you to sign in to GitHub, sign in. If it asks for a password in the terminal, GitHub needs a Personal Access Token instead of your password (GitHub, Settings, Developer settings, Personal access tokens).
4. **Add your teammate:** repo page, Settings, Collaborators, Add people, enter their GitHub username. They accept the email invite.
5. Check: refresh the repo page. You should see all the files, and the right-hand **About** area should show **MIT license**. (Devpost requires a visible license.)

**Teammate:** `git clone https://github.com/YOURNAME/rootfund.git` then `cd rootfund`.

### Daily Git routine (both of you)

```
git pull                               # get the other person's latest work
git checkout -b be/payouts             # new branch (prefix: be/ backend, fe/ frontend, ml/ machine learning)
# ...edit files...
git add .
git commit -m "Describe what you did"
git push -u origin be/payouts          # then open a Pull Request on GitHub, the other person clicks Merge
```
Never commit `.env` (it is already ignored). Commit and push at least every two hours.

## Part C. Run it on your computer without PayPal (about 10 minutes)

```
npm run install:all
cp .env.example .env          # Windows PowerShell: copy .env.example .env
npm run build
npm start
```
Open http://localhost:3000. You should see the funding bars. In `.env`, `ADMIN_KEY=change-me`; type that into the admin box at the bottom of the page, then click **Launch sybil attack**, then flip between **Naive QF** and **Rootfund protected**.
Try a donation: the mock PayPal page lets you "pay" as a fake donor.
Run the tests: `npm test`. Expected: 35 passing.

For live editing while you work, open two terminals: `npm run dev:server` and `npm run dev:client`, then use http://localhost:5173.

## Part D. Real PayPal sandbox (backend developer, about 30 minutes)

1. Go to https://developer.paypal.com and log in or sign up. Make sure you are in **Sandbox** (not Live).
2. **Apps & Credentials**, Sandbox, **Create App**. Name `Rootfund`, type **Merchant**, keep the default sandbox business account. Copy the **Client ID** and **Secret**.
3. In the developer dashboard open **Sandbox accounts** (under Testing tools). Create **7 Personal accounts**, all with country **United States** so everything is USD: 4 will be donors, 3 will be project owners. Open each one (View/Edit) and note its email and password.
4. Check your sandbox **business** account balance: open https://www.sandbox.paypal.com and log in with the business account's email and password. If the balance is under $300 use `POOL_USD=50`.
5. On your app's page look under **Features** for **Payouts**; if it is listed and not enabled, enable it. (The wording on screen may differ slightly.)
6. Fill in `.env`:
   ```
   PAYPAL_MODE=sandbox
   PAYPAL_CLIENT_ID=...
   PAYPAL_CLIENT_SECRET=...
   PROJECT_OWNER_EMAILS=owner1@...,owner2@...,owner3@...      # the 3 owner accounts' emails
   ```
7. **Gate 1 check:** run `npm run gate1`. It creates a $1 order and prints a link. Open the link in a **private/incognito window**, log in with a donor account and approve, return to the terminal and press Enter. Every line should say PASS (order, capture, refund, payout). If anything says FAIL, copy the whole output and send it to Claude or your teammate.

## Part E. Database: MongoDB Atlas (backend developer, about 15 minutes)

1. Create a free account at https://www.mongodb.com/atlas and create a free shared cluster (M0).
2. **Database Access:** add a database user with a simple alphanumeric password (special characters need URL-encoding in the connection string).
3. **Network Access:** add IP address `0.0.0.0/0` (allow from anywhere). Render's outgoing addresses change, so this is needed. This is acceptable only because the data is sandbox-only.
4. **Connect, Drivers:** copy the connection string, replace `<password>`, and put it in `.env` as `MONGODB_URI=...`.
5. Check: `npm start`, then open http://localhost:3000/api/health. It should say `"store":"mongo"`. Make a mock donation and confirm it survives a server restart. (The Mongo code is written but has not been run against a real cluster yet, so report any error text.)

## Part F. Deploy on Render and register the webhook (backend developer, about 30 minutes)

Shortcut: [DEPLOY.md](DEPLOY.md) does steps 1 to 4 with the `render.yaml` blueprint (**New, Blueprint**), and `npm run smoke -- <your Render URL>` checks the result.

1. https://render.com, sign up with GitHub. **New, Web Service**, pick the `rootfund` repo.
2. Settings: Runtime **Node**. Build Command `npm run build`. Start Command `npm start`. Instance type **Free**.
3. Environment variables: everything from your `.env` (`PAYPAL_MODE=sandbox`, client ID and secret, `PROJECT_OWNER_EMAILS`, `MONGODB_URI`, `ADMIN_KEY` set to a **new** secret, `POOL_USD`), plus `NODE_VERSION=22`.
4. After the first deploy Render shows your URL (`https://something.onrender.com`). The app picks it up automatically (Render sets `RENDER_EXTERNAL_URL`); set `PUBLIC_BASE_URL` only for a custom domain.
5. **Register the webhook:** PayPal developer dashboard, your app, **Features, Webhooks, Add webhook**. URL: `https://something.onrender.com/api/webhooks/paypal`. Subscribe to: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`, `PAYMENT.PAYOUTSBATCH.PROCESSING`, `PAYMENT.PAYOUTSBATCH.SUCCESS`, `PAYMENT.PAYOUTS-ITEM.SUCCEEDED`, `PAYMENT.PAYOUTS-ITEM.DENIED`. Save, copy the **Webhook ID**, set `PAYPAL_WEBHOOK_ID` in Render, redeploy.
6. **Keep it awake:** Render's free service sleeps after 15 minutes without traffic and takes about a minute to wake. Create a free monitor at https://cron-job.org (or UptimeRobot) that requests `https://something.onrender.com/api/health` every 10 minutes. Judging runs 1 to 15 December, so keep this running.
7. Checks: open your Render URL and make a real sandbox donation (use a donor account in a private window). It should appear in the Ledger as CAPTURED. In the PayPal dashboard use the webhook simulator to send a test event to your URL and confirm it shows in the Render logs (simulator events usually fail signature checks, so a 400 there is normal). After the real donation, the webhook event history should show your events delivered with 200.

## Part G. Before you record the video

- Log in to each donor sandbox account in its own private window or browser profile ahead of time.
- Open your Render URL a few minutes early so the service is awake.
- Run **Reset demo** (keep real donations off for a clean start), then rehearse the whole script twice.
