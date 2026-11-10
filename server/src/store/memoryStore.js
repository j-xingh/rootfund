'use strict';
const crypto = require('crypto');

const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
const setPath = (o, p, v) => {
  const ks = p.split('.');
  let cur = o;
  ks.slice(0, -1).forEach((k) => { if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}; cur = cur[k]; });
  cur[ks[ks.length - 1]] = v;
};
const matches = (doc, filter) => Object.entries(filter).every(([k, v]) => getPath(doc, k) === v);

/** In-memory store. Same interface as mongoStore. Data is lost on restart (fine for dev and tests). */
function createMemoryStore() {
  const colls = new Map();
  const c = (name) => { if (!colls.has(name)) colls.set(name, new Map()); return colls.get(name); };
  return {
    kind: 'memory',
    async insert(coll, doc) { const d = { ...doc, _id: doc._id || crypto.randomUUID() }; c(coll).set(d._id, d); return structuredClone(d); },
    async insertMany(coll, docs) { for (const doc of docs) { const d = { ...doc, _id: doc._id || crypto.randomUUID() }; c(coll).set(d._id, d); } return docs.length; },
    async insertOnce(coll, doc) { if (c(coll).has(doc._id)) return false; c(coll).set(doc._id, structuredClone(doc)); return true; },
    async get(coll, id) { const d = c(coll).get(id); return d ? structuredClone(d) : null; },
    async find(coll, filter = {}) { return [...c(coll).values()].filter((d) => matches(d, filter)).map((d) => structuredClone(d)); },
    async patch(coll, id, patch) {
      const d = c(coll).get(id);
      if (!d) return null;
      for (const [k, v] of Object.entries(patch)) setPath(d, k, v);
      return structuredClone(d);
    },
    async remove(coll, filter = {}) { let n = 0; for (const [id, d] of c(coll)) if (matches(d, filter)) { c(coll).delete(id); n++; } return n; },
    async close() {},
  };
}
module.exports = { createMemoryStore };
