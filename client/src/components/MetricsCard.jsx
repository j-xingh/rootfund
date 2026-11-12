import React from 'react';
import { pct1 } from '../lib/format.js';

const LABEL = { naive: 'Naive ring (burst, odd emails)', jitter: 'Jitter ring (spread out)', adaptive: 'Adaptive ring (adds decoys)', evasive: 'Evasive ring (never seen in training)' };
const f2 = (v) => Number(v).toFixed(2);

export default function MetricsCard({ metrics }) {
  if (!metrics) return <p className="muted">No metrics yet. Run <code>npm run ml:all</code>.</p>;
  const m = metrics.meta;
  const share = (s) => (s.hybridCapped ?? s.hybrid) * 100;
  return (
    <div>
      <p className="small">
        <b>Simulated data.</b> {m.honestDonors} honest donors, a ring of {m.ringSize} fake donors, {m.seeds} seeded runs. Figures are the share of the matching pool captured by the attacked project; with no attack it is {pct1(metrics.attacks.naive.targetPoolShare.clean * 100)}.
      </p>
      <div className="scroll-x">
        <table>
          <caption className="sr-only">Detector results by attack type</caption>
          <thead><tr><th>Attack</th><th className="r">Precision</th><th className="r">Recall</th><th className="r">Plain quadratic funding</th><th className="r">With Rootfund</th></tr></thead>
          <tbody>
            {Object.entries(metrics.attacks).map(([k, v]) => (
              <tr key={k}><td>{LABEL[k] || k}</td><td className="r num">{f2(v.precision)}</td><td className="r num">{f2(v.recall)}</td><td className="r num">{pct1(v.targetPoolShare.naive * 100)}</td><td className="r num">{pct1(share(v.targetPoolShare))}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 style={{ marginTop: 22 }}>Honest limits</h3>
      <p>The model alone does not generalize across attack families. With one family left out of training, recall on it was:</p>
      <div className="scroll-x">
        <table>
          <caption className="sr-only">Leave-one-family-out results</caption>
          <thead><tr><th>Family left out</th><th className="r">Recall</th><th className="r">Precision</th></tr></thead>
          <tbody>
            {Object.entries(metrics.leaveOneOut || {}).map(([k, v]) => <tr key={k}><td>{LABEL[k] || k}</td><td className="r num">{f2(v.recall)}</td><td className="r num">{f2(v.precision)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="small muted">That is why Rootfund pairs the model with a burst rule, a per-project cap, and a human approval step before any money moves.</p>
    </div>
  );
}
