'use strict';
/**
 * Mock PayPal for local development WITHOUT credentials. Same interface as client.js.
 * It is NOT PayPal: it exists so the UI and API can be built and tested offline.
 * The final demo must run with PAYPAL_MODE=sandbox.
 */
const crypto = require('crypto');

const MOCK_DONORS = [
  { payerId: 'MOCKPAYER1', email: 'mock-donor-1@example.com' },
  { payerId: 'MOCKPAYER2', email: 'mock-donor-2@example.com' },
  { payerId: 'MOCKPAYER3', email: 'mock-donor-3@example.com' },
  { payerId: 'MOCKPAYER4', email: 'mock-donor-4@example.com' },
];

function createMockPayPal(cfg) {
  const orders = new Map();
  const batches = new Map();
  const id = (p) => `${p}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  return {
    mode: 'mock',
    MOCK_DONORS,
    async createOrder({ donationId, amountUsd, returnUrl }) {
      const orderId = id('MOCKORDER');
      orders.set(orderId, { orderId, donationId, amountUsd, returnUrl, status: 'CREATED', payer: null });
      return { orderId, approveUrl: `${cfg.publicBaseUrl}/mock-paypal/approve?order=${orderId}` };
    },
    // called by the mock approve page
    _approve(orderId, payerIndex) {
      const o = orders.get(orderId);
      if (!o) return null;
      o.payer = MOCK_DONORS[Math.max(0, Math.min(MOCK_DONORS.length - 1, payerIndex))];
      o.status = 'APPROVED';
      return o;
    },
    _order: (orderId) => orders.get(orderId),
    async captureOrder(orderId) {
      const o = orders.get(orderId);
      if (!o || o.status === 'CREATED') throw Object.assign(new Error('order not approved'), { code: 'ORDER_NOT_APPROVED', status: 422 });
      if (o.status === 'CAPTURED') throw Object.assign(new Error('already captured'), { code: 'ORDER_ALREADY_CAPTURED', status: 422 });
      o.status = 'CAPTURED';
      o.captureId = id('MOCKCAP');
      return { orderId, status: 'COMPLETED', captureId: o.captureId, amountUsd: o.amountUsd, payerId: o.payer.payerId, email: o.payer.email, accountStatus: 'VERIFIED' };
    },
    async getOrder(orderId) {
      const o = orders.get(orderId);
      return { orderId, status: o?.status === 'CAPTURED' ? 'COMPLETED' : o?.status, captureId: o?.captureId, payerId: o?.payer?.payerId, email: o?.payer?.email };
    },
    async refundCapture({ captureId }) { return { refundId: id('MOCKREFUND'), status: 'COMPLETED', captureId }; },
    async createPayoutBatch({ senderBatchId, items }) {
      const batchId = id('MOCKBATCH');
      const denied = (i) => (i.note || '').includes('ERRPYO002');
      const out = items.map((i) => ({ senderItemId: i.senderItemId, receiver: i.receiver, amountUsd: i.amountUsd, status: denied(i) ? 'FAILED' : 'SUCCESS', error: denied(i) ? 'SENDER_EMAIL_UNCONFIRMED' : null }));
      const status = out.some((i) => i.status === 'FAILED') ? 'DENIED' : 'SUCCESS';
      batches.set(batchId, { batchId, status, items: out, senderBatchId });
      return { batchId, status: 'PENDING' };
    },
    async getPayoutBatch(batchId) { return batches.get(batchId) || { batchId, status: 'UNKNOWN', items: [] }; },
    async verifyWebhook() { return true; },
  };
}
module.exports = { createMockPayPal, MOCK_DONORS };
