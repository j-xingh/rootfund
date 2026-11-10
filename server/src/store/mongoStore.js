'use strict';
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

/** MongoDB store (Atlas). Same interface as memoryStore. Filters are simple equality (dotted keys allowed). */
async function createMongoStore(uri, dbName = 'rootfund') {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  const db = client.db(dbName);
  const col = (n) => db.collection(n);
  const clean = (d) => d; // _id is already a string we control
  return {
    kind: 'mongo',
    async insert(coll, doc) { const d = { ...doc, _id: doc._id || crypto.randomUUID() }; await col(coll).insertOne(d); return clean(d); },
    async insertMany(coll, docs) { if (!docs.length) return 0; const withIds = docs.map((d) => ({ ...d, _id: d._id || crypto.randomUUID() })); await col(coll).insertMany(withIds); return withIds.length; },
    async insertOnce(coll, doc) {
      try { await col(coll).insertOne(doc); return true; } catch (e) { if (e.code === 11000) return false; throw e; }
    },
    async get(coll, id) { return clean(await col(coll).findOne({ _id: id })); },
    async find(coll, filter = {}) { return (await col(coll).find(filter).toArray()).map(clean); },
    async patch(coll, id, patch) { const r = await col(coll).findOneAndUpdate({ _id: id }, { $set: patch }, { returnDocument: 'after' }); return clean(r); },
    async remove(coll, filter = {}) { return (await col(coll).deleteMany(filter)).deletedCount; },
    async close() { await client.close(); },
  };
}
module.exports = { createMongoStore };
