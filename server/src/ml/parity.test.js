'use strict';
// Required by the guide: Node must reproduce scikit-learn's scores (max difference < 1e-9) on 500 rows.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { score } = require('./scorer');

test('Node scorer matches scikit-learn on 500 rows', () => {
  const file = path.resolve(__dirname, '../../../ml/data/parity.json');
  const { rows, scores } = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.strictEqual(rows.length, 500);
  let maxDiff = 0;
  rows.forEach((x, i) => { maxDiff = Math.max(maxDiff, Math.abs(score(x) - scores[i])); });
  console.log(`   max |node - sklearn| = ${maxDiff.toExponential(2)}`);
  assert.ok(maxDiff < 1e-9);
});
