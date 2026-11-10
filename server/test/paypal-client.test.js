'use strict';
// Checks the REAL PayPal client builds requests exactly as the PayPal docs require, using a fake fetch.
const test = require('node:test');
const assert = require('node:assert');
const { createPayPalClient } = require('../src/paypal/client');

const cfg = { paypalBaseUrl: 'https://api-m.sandbox.paypal.com', paypalClientId: 'id', paypalClientSecret: 'secret', paypalWebhookId: 'WH123' };

function fakeFetch(routes) {
  const calls = [];
  const f = async (url, opts) => {
    calls.push({ url, opts });
    const key = `${opts.method} ${url.replace(cfg.paypalBaseUrl, '')}`;
    const hit = routes[key] || (key.startsWith('POST /v1/oauth2/token') && { status: 200, json: { access_token: 'TOK', expires_in: 3000 } });
    if (!hit) return { ok: false, status: 404, text: async () => JSON.stringify({ message: 'no route ' + key }), json: async () => ({}) };
    const body = JSON.stringify(hit.json);
    return { ok: hit.status < 400, status: hit.status, text: async () => body, json: async () => hit.json };
  };
  return { f, calls };
}

test('oauth token uses Basic auth and client_credentials', async () => {
  const { f, calls } = fakeFetch({ 'GET /v2/checkout/orders/O1': { status: 200, json: { id: 'O1', status: 'CREATED' } } });
  await createPayPalClient(cfg, f).getOrder('O1');
  assert.strictEqual(calls[0].opts.headers.Authorization, 'Basic ' + Buffer.from('id:secret').toString('base64'));
  assert.strictEqual(calls[0].opts.body, 'grant_type=client_credentials');
  assert.strictEqual(calls[1].opts.headers.Authorization, 'Bearer TOK');
});

test('createOrder sends the documented body and returns the payer-action link', async () => {
  const { f, calls } = fakeFetch({ 'POST /v2/checkout/orders': { status: 200, json: { id: 'ORD1', status: 'PAYER_ACTION_REQUIRED', links: [{ rel: 'payer-action', href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD1' }] } } });
  const r = await createPayPalClient(cfg, f).createOrder({ donationId: 'D1', amountUsd: 5, description: 'x', returnUrl: 'https://app/return?d=D1', cancelUrl: 'https://app/cancel' });
  assert.deepStrictEqual(r, { orderId: 'ORD1', approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=ORD1' });
  const c = calls[1];
  assert.strictEqual(c.opts.headers['PayPal-Request-Id'], 'order-D1');
  const b = JSON.parse(c.opts.body);
  assert.strictEqual(b.intent, 'CAPTURE');
  assert.strictEqual(b.purchase_units[0].amount.value, '5.00');
  assert.strictEqual(b.purchase_units[0].amount.currency_code, 'USD');
  assert.strictEqual(b.payment_source.paypal.experience_context.user_action, 'PAY_NOW');
  assert.strictEqual(b.payment_source.paypal.experience_context.return_url, 'https://app/return?d=D1');
});

test('captureOrder extracts capture id and payer identity', async () => {
  const { f } = fakeFetch({ 'POST /v2/checkout/orders/ORD1/capture': { status: 201, json: { id: 'ORD1', status: 'COMPLETED', payer: { payer_id: 'PAYER1', email_address: 'b@example.com' }, payment_source: { paypal: { account_status: 'VERIFIED' } }, purchase_units: [{ payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', amount: { value: '5.00', currency_code: 'USD' } }] } }] } } });
  const r = await createPayPalClient(cfg, f).captureOrder('ORD1');
  assert.deepStrictEqual(r, { orderId: 'ORD1', status: 'COMPLETED', captureId: 'CAP1', amountUsd: 5, payerId: 'PAYER1', email: 'b@example.com', accountStatus: 'VERIFIED' });
});

test('payout batch body matches the Payouts API', async () => {
  const { f, calls } = fakeFetch({ 'POST /v1/payments/payouts': { status: 201, json: { batch_header: { payout_batch_id: 'B1', batch_status: 'PENDING' } } } });
  const r = await createPayPalClient(cfg, f).createPayoutBatch({ senderBatchId: 'round-1-settle-1', items: [{ receiver: 'a@example.com', amountUsd: 12.5, note: 'n', senderItemId: 'round-1-p0' }] });
  assert.deepStrictEqual(r, { batchId: 'B1', status: 'PENDING' });
  const b = JSON.parse(calls[1].opts.body);
  assert.strictEqual(b.sender_batch_header.sender_batch_id, 'round-1-settle-1');
  assert.deepStrictEqual(b.items[0], { recipient_type: 'EMAIL', receiver: 'a@example.com', note: 'n', sender_item_id: 'round-1-p0', amount: { value: '12.50', currency: 'USD' } });
  assert.strictEqual(calls[1].opts.headers['PayPal-Request-Id'], 'round-1-settle-1');
});

test('refund uses the capture refund endpoint with explicit amount', async () => {
  const { f, calls } = fakeFetch({ 'POST /v2/payments/captures/CAP1/refund': { status: 201, json: { id: 'R1', status: 'COMPLETED' } } });
  const r = await createPayPalClient(cfg, f).refundCapture({ captureId: 'CAP1', amountUsd: 5, note: 'n', requestId: 'refund-D1' });
  assert.deepStrictEqual(r, { refundId: 'R1', status: 'COMPLETED' });
  assert.deepStrictEqual(JSON.parse(calls[1].opts.body).amount, { value: '5.00', currency_code: 'USD' });
});

test('verifyWebhook posts PayPal transmission headers and the event', async () => {
  const { f, calls } = fakeFetch({ 'POST /v1/notifications/verify-webhook-signature': { status: 200, json: { verification_status: 'SUCCESS' } } });
  const headers = { 'paypal-auth-algo': 'SHA256withRSA', 'paypal-cert-url': 'https://c', 'paypal-transmission-id': 'T1', 'paypal-transmission-sig': 'S', 'paypal-transmission-time': '2026-11-10T00:00:00Z' };
  const ok = await createPayPalClient(cfg, f).verifyWebhook({ headers, rawBody: Buffer.from('{"id":"WH-1","event_type":"X"}') });
  assert.strictEqual(ok, true);
  const b = JSON.parse(calls[1].opts.body);
  assert.strictEqual(b.webhook_id, 'WH123');
  assert.strictEqual(b.transmission_id, 'T1');
  assert.deepStrictEqual(b.webhook_event, { id: 'WH-1', event_type: 'X' });
});

test('PayPal errors are normalized', async () => {
  const { f } = fakeFetch({ 'GET /v2/checkout/orders/BAD': { status: 422, json: { name: 'UNPROCESSABLE_ENTITY', message: 'bad', debug_id: 'dbg1', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] } } });
  await assert.rejects(() => createPayPalClient(cfg, f).getOrder('BAD'), (e) => e.status === 422 && e.debugId === 'dbg1' && e.details[0].issue === 'ORDER_ALREADY_CAPTURED');
});
