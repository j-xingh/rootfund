'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const env = process.env;
const cfg = {
  port: Number(env.PORT || 3000),
  publicBaseUrl: (env.PUBLIC_BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/$/, ''),
  paypalMode: env.PAYPAL_MODE || 'mock', // 'mock' (no credentials needed) or 'sandbox' (real PayPal sandbox)
  paypalBaseUrl: env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com',
  paypalClientId: env.PAYPAL_CLIENT_ID || '',
  paypalClientSecret: env.PAYPAL_CLIENT_SECRET || '',
  paypalWebhookId: env.PAYPAL_WEBHOOK_ID || '',
  mongoUri: env.MONGODB_URI || '',
  adminKey: env.ADMIN_KEY || 'dev-admin-key',
  poolUsd: Number(env.POOL_USD || 100),
  ownerEmails: (env.PROJECT_OWNER_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean),
};

function validate(c = cfg) {
  const problems = [];
  if (c.paypalMode === 'sandbox') {
    for (const k of ['paypalClientId', 'paypalClientSecret']) if (!c[k]) problems.push(`${k} is missing (set it in .env)`);
    if (!c.paypalWebhookId) problems.push('PAYPAL_WEBHOOK_ID is missing: webhooks will be rejected until you set it');
    if (c.ownerEmails.length === 0) problems.push('PROJECT_OWNER_EMAILS is empty: payouts need sandbox personal account emails');
  }
  if (c.adminKey === 'dev-admin-key' && c.publicBaseUrl.startsWith('https://')) problems.push('ADMIN_KEY is still the default on a public URL: change it');
  return problems;
}

module.exports = { cfg, validate };
