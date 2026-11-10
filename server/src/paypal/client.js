'use strict';
/**
 * Real PayPal REST client (sandbox or live base URL). Uses Node's built-in fetch, no SDK.
 * Every endpoint, field and header below was checked against PayPal's documentation on 10 Nov 2026.
 * Interface is identical to mock.js so the rest of the app does not care which is used.
 */
class PayPalError extends Error {
  constructor(status, body, where) {
    super(`${where}: ${body?.message || body?.error_description || 'PayPal request failed'}`);
    this.name = 'PayPalError';
    this.status = status;
    this.code = body?.name || body?.error || 'UNKNOWN';
    this.debugId = body?.debug_id || null;
    this.details = body?.details || null;
  }
}

const usd = (n) => (Math.round(n * 100) / 100).toFixed(2);

function createPayPalClient(cfg, fetchImpl = globalThis.fetch) {
  let token = null; // {value, expiresAt}

  async function getToken() {
    if (token && token.expiresAt > Date.now() + 60_000) return token.value;
    const basic = Buffer.from(`${cfg.paypalClientId}:${cfg.paypalClientSecret}`).toString('base64');
    const res = await fetchImpl(`${cfg.paypalBaseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new PayPalError(res.status, json, 'oauth token');
    token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in || 300) * 1000 };
    return token.value;
  }

  async function request(method, path, { body, requestId, prefer } = {}) {
    const headers = { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' };
    if (requestId) headers['PayPal-Request-Id'] = requestId;
    if (prefer) headers.Prefer = prefer;
    const res = await fetchImpl(`${cfg.paypalBaseUrl}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
    if (!res.ok) throw new PayPalError(res.status, json, `${method} ${path}`);
    return json;
  }

  return {
    mode: 'sandbox',
    PayPalError,

    async createOrder({ donationId, amountUsd, description, returnUrl, cancelUrl }) {
      const o = await request('POST', '/v2/checkout/orders', {
        requestId: `order-${donationId}`,
        prefer: 'return=representation',
        body: {
          intent: 'CAPTURE',
          purchase_units: [{ reference_id: donationId, description, amount: { currency_code: 'USD', value: usd(amountUsd) } }],
          payment_source: {
            paypal: {
              experience_context: {
                payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
                brand_name: 'Rootfund',
                shipping_preference: 'NO_SHIPPING',
                user_action: 'PAY_NOW',
                return_url: returnUrl,
                cancel_url: cancelUrl,
              },
            },
          },
        },
      });
      const link = (o.links || []).find((l) => l.rel === 'payer-action') || (o.links || []).find((l) => l.rel === 'approve');
      if (!link) throw new PayPalError(502, { message: 'no payer-action link in response' }, 'create order');
      return { orderId: o.id, approveUrl: link.href };
    },

    async captureOrder(orderId) {
      const c = await request('POST', `/v2/checkout/orders/${orderId}/capture`, { requestId: `capture-${orderId}`, prefer: 'return=representation' });
      const cap = c.purchase_units?.[0]?.payments?.captures?.[0];
      return {
        orderId: c.id,
        status: cap?.status || c.status,
        captureId: cap?.id,
        amountUsd: cap ? Number(cap.amount.value) : undefined,
        payerId: c.payer?.payer_id,
        email: c.payer?.email_address,
        accountStatus: c.payment_source?.paypal?.account_status,
      };
    },

    async getOrder(orderId) {
      const o = await request('GET', `/v2/checkout/orders/${orderId}`);
      const cap = o.purchase_units?.[0]?.payments?.captures?.[0];
      return { orderId: o.id, status: o.status, captureId: cap?.id, payerId: o.payer?.payer_id, email: o.payer?.email_address };
    },

    async refundCapture({ captureId, amountUsd, note, requestId }) {
      const r = await request('POST', `/v2/payments/captures/${captureId}/refund`, {
        requestId,
        body: { amount: { value: usd(amountUsd), currency_code: 'USD' }, note_to_payer: note },
      });
      return { refundId: r.id, status: r.status };
    },

    async createPayoutBatch({ senderBatchId, items }) {
      const r = await request('POST', '/v1/payments/payouts', {
        requestId: senderBatchId,
        body: {
          sender_batch_header: { sender_batch_id: senderBatchId, email_subject: 'Your Rootfund match payout' },
          items: items.map((i) => ({
            recipient_type: 'EMAIL', receiver: i.receiver, note: i.note, sender_item_id: i.senderItemId,
            amount: { value: usd(i.amountUsd), currency: 'USD' },
          })),
        },
      });
      return { batchId: r.batch_header.payout_batch_id, status: r.batch_header.batch_status };
    },

    async getPayoutBatch(batchId) {
      const r = await request('GET', `/v1/payments/payouts/${batchId}`);
      return {
        batchId: r.batch_header.payout_batch_id,
        status: r.batch_header.batch_status,
        items: (r.items || []).map((i) => ({
          senderItemId: i.payout_item?.sender_item_id,
          receiver: i.payout_item?.receiver,
          amountUsd: Number(i.payout_item?.amount?.value),
          status: i.transaction_status,
          error: i.errors?.name || null,
        })),
      };
    },

    /** Uses PayPal's verify-webhook-signature endpoint. rawBody must be the exact bytes PayPal sent. */
    async verifyWebhook({ headers, rawBody }) {
      if (!cfg.paypalWebhookId) return false;
      const r = await request('POST', '/v1/notifications/verify-webhook-signature', {
        body: {
          auth_algo: headers['paypal-auth-algo'],
          cert_url: headers['paypal-cert-url'],
          transmission_id: headers['paypal-transmission-id'],
          transmission_sig: headers['paypal-transmission-sig'],
          transmission_time: headers['paypal-transmission-time'],
          webhook_id: cfg.paypalWebhookId,
          webhook_event: JSON.parse(rawBody.toString('utf8')),
        },
      });
      return r.verification_status === 'SUCCESS';
    },
  };
}

module.exports = { createPayPalClient, PayPalError };
