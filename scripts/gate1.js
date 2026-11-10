'use strict';
/**
 * Gate 1 helper: proves your REAL PayPal sandbox setup works, step by step.
 *   npm run gate1            (needs PAYPAL_MODE=sandbox and credentials in .env)
 * 1) gets an access token  2) creates a $1 order and waits while you approve it in the browser
 * 3) captures it and prints the payer  4) refunds it  5) sends a $1 payout to the first owner email
 */
const readline = require('readline');
const { cfg } = require('../server/src/config');
const { createPayPalClient } = require('../server/src/paypal/client');

const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a); }); });
const ok = (m) => console.log('  PASS  ' + m);
const bad = (m, e) => { console.log('  FAIL  ' + m + (e ? ' -> ' + e.message + (e.debugId ? ` (debug_id ${e.debugId})` : '') : '')); };

(async () => {
  if (cfg.paypalMode !== 'sandbox') { console.log('Set PAYPAL_MODE=sandbox in .env first.'); process.exit(1); }
  const pp = createPayPalClient(cfg);
  let cap;
  try {
    const o = await pp.createOrder({ donationId: 'gate1-' + Date.now(), amountUsd: 1, description: 'Gate 1 test', returnUrl: `${cfg.publicBaseUrl}/gate1-return`, cancelUrl: `${cfg.publicBaseUrl}/gate1-cancel` });
    ok('credentials work and order created: ' + o.orderId);
    console.log('\nOpen this link, log in with a SANDBOX PERSONAL (donor) account and approve:\n' + o.approveUrl + '\n');
    await ask('After approving (your browser may show an error page for the return URL: that is fine), press Enter here... ');
    cap = await pp.captureOrder(o.orderId);
    ok(`captured ${cap.amountUsd} USD, capture ${cap.captureId}, payer ${cap.payerId} (${cap.email}), account_status ${cap.accountStatus}`);
  } catch (e) { return bad('order/capture step', e); }
  try {
    const r = await pp.refundCapture({ captureId: cap.captureId, amountUsd: cap.amountUsd, note: 'Gate 1 test refund', requestId: 'gate1-refund-' + cap.captureId });
    ok('refund ' + r.refundId + ' ' + r.status);
  } catch (e) { bad('refund step', e); }
  try {
    const to = cfg.ownerEmails[0];
    if (!to) return bad('PROJECT_OWNER_EMAILS is empty');
    const b = await pp.createPayoutBatch({ senderBatchId: 'gate1-' + Date.now(), items: [{ receiver: to, amountUsd: 1, note: 'Gate 1 payout', senderItemId: 'gate1-item-1' }] });
    ok('payout batch ' + b.batchId + ' ' + b.status);
    await new Promise((r) => setTimeout(r, 4000));
    const s = await pp.getPayoutBatch(b.batchId);
    ok('batch status now ' + s.status + ' items: ' + JSON.stringify(s.items.map((i) => i.status)));
  } catch (e) { bad('payout step (check app Features for Payouts and business balance)', e); }
  console.log('\nIf every line says PASS, Gate 1 money loop is proven. Send the output to your teammate/Claude if anything FAILS.');
})();
