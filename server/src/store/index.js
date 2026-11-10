'use strict';
const { createMemoryStore } = require('./memoryStore');

async function createStore(cfg) {
  if (cfg.mongoUri) {
    const { createMongoStore } = require('./mongoStore');
    return createMongoStore(cfg.mongoUri);
  }
  return createMemoryStore();
}
module.exports = { createStore };
