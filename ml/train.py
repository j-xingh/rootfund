"""Train the donor fraud detector and export it as JSON for the Node server.

Usage (from repo root):
    node scripts/export-dataset.js
    python ml/train.py                      # writes server/src/ml/model.json
    python ml/train.py --exclude jitter --out ml/data/model_loo_jitter.json   # leave-one-attack-out
"""
import argparse, json, math
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier

p = argparse.ArgumentParser()
p.add_argument('--csv', default='ml/data/train.csv')
p.add_argument('--out', default='server/src/ml/model.json')
p.add_argument('--exclude', default=None, help='attack kind to leave out of training')
a = p.parse_args()

df = pd.read_csv(a.csv)
if a.exclude:
    df = df[df.kind != a.exclude]
feat = [c for c in df.columns if c not in ('scenario', 'kind', 'donor', 'label')]
X, y = df[feat].to_numpy(), df['label'].to_numpy()

clf = GradientBoostingClassifier(n_estimators=80, max_depth=3, random_state=0).fit(X, y)

prior = float(clf.init_.class_prior_[1])
trees = []
for est in clf.estimators_[:, 0]:
    t = est.tree_
    trees.append({
        'left': t.children_left.tolist(), 'right': t.children_right.tolist(),
        'feat': t.feature.tolist(), 'thr': t.threshold.tolist(), 'val': t.value[:, 0, 0].tolist(),
    })

honest = X[y == 0]
stats = {
    'median': np.median(honest, axis=0).tolist(),
    'scale': (np.percentile(honest, 90, axis=0) - np.percentile(honest, 10, axis=0) + 1e-6).tolist(),
}
model = {
    'features': feat, 'init': math.log(prior / (1 - prior)), 'lr': clf.learning_rate,
    'trees': trees, 'honestStats': stats,
    'meta': {'trainedOn': sorted(df.kind.unique().tolist()), 'rows': int(len(df)), 'excluded': a.exclude},
}
json.dump(model, open(a.out, 'w'))

# parity vectors so Node can prove it reproduces scikit-learn exactly
rng = np.random.default_rng(1)
idx = rng.choice(len(X), size=min(500, len(X)), replace=False)
json.dump({'X': X[idx].tolist(), 'p': clf.predict_proba(X[idx])[:, 1].tolist()},
          open('ml/data/' + a.out.split('/')[-1].replace('.json', '.parity.json'), 'w'))
print('trained on', model['meta'], '->', a.out)
