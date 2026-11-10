'use strict';
// One command for the whole ML pipeline: npm run ml:all
// export dataset -> train production model -> train leave-one-attack-out models -> evaluate (writes metrics.json)
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  return r.status === 0;
}
function python(args) {
  for (const exe of ['python', 'python3', 'py']) {
    const r = spawnSync(exe, ['--version'], { cwd: root });
    if (r.status === 0 && /Python 3/.test(String(r.stdout) + String(r.stderr))) return run(exe, args);
  }
  console.error('Python 3 not found. Install Python 3.10+ and run: pip install -r ml/requirements.txt');
  return false;
}

const steps = [
  () => run(process.execPath, ['scripts/export-dataset.js']),
  () => python(['ml/train.py']),
  ...['naive', 'jitter', 'adaptive'].map((k) => () => python(['ml/train.py', '--exclude', k, '--out', `ml/data/model_loo_${k}.json`])),
  () => run(process.execPath, ['scripts/evaluate.js']),
];
for (const [i, s] of steps.entries()) {
  if (!s()) { console.error(`ml:all failed at step ${i + 1}`); process.exit(1); }
}
console.log('ml:all finished. Metrics: server/src/ml/metrics.json');
