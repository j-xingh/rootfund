#!/bin/sh
# One command to rebuild the whole ML pipeline from the repo root:  sh scripts/build_model.sh
set -e
cd "$(dirname "$0")/.."
(cd server && node src/ml/exportCsv.js)      # simulator + features -> CSV
python3 ml/train.py                          # train, evaluate, export model.json
(cd server && node src/ml/evalPolicy.js)     # pool-share evaluation -> ml/metrics.json
(cd server && node --test)                   # all tests incl. parity
