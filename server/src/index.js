'use strict';
const fs = require('fs');
const path = require('path');
const { cfg, validate } = require('./config');
const { createStore } = require('./store');
const { createPayPalClient } = require('./paypal/client');
const { createMockPayPal } = require('./paypal/mock');
const { loadModel } = require('./ml/scorer');
const { ensureSeeded } = require('./rounds');
const { createApp } = require('./app');

(async () => {
  for (const p of validate()) console.warn('config warning:', p);
  const store = await createStore(cfg);
  const paypal = cfg.paypalMode === 'sandbox' ? createPayPalClient(cfg) : createMockPayPal(cfg);
  const model = loadModel();
  const metricsFile = path.join(__dirname, 'ml', 'metrics.json');
  const metrics = fs.existsSync(metricsFile) ? JSON.parse(fs.readFileSync(metricsFile, 'utf8')) : null;
  await ensureSeeded(store, cfg);
  const app = createApp({ store, paypal, cfg, model, metrics });
  app.listen(cfg.port, () => console.log(`Rootfund on ${cfg.publicBaseUrl} (paypal=${paypal.mode}, store=${store.kind})`));
})().catch((e) => { console.error('startup failed:', e); process.exit(1); });
