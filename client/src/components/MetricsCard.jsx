import React from 'react';

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const LABEL = {
  naive: 'Naive ring (burst, odd emails)',
  jitter: 'Jitter ring (spread out)',
  adaptive: 'Adaptive ring (adds decoys)',
  evasive: 'Evasive ring (never seen in training)',
};

export default function MetricsCard({ metrics }) {
  if (!metrics) return <p className="muted">No metrics yet. Run npm run ml:all.</p>;
  const m = metrics.meta;
  return (
    <div>
      <p className="muted">
        Simulated data: {m.honestDonors} honest donors, a ring of {m.ringSize} fake donors, {m.seeds} seeded runs. Numbers show the share of the
        matching pool captured by the attacked project (with no attack it is {pct(metrics.attacks.naive.targetPoolShare.clean)}).
      </p>
      <div className="scroll-x">
        <table>
          <thead><tr><th>Attack</th><th>Precision</th><th>Recall</th><th>Naive QF</th><th>Rootfund</th></tr></thead>
          <tbody>
            {Object.entries(metrics.attacks).map(([k, v]) => (
              <tr key={k}>
                <td>{LABEL[k] || k}</td>
                <td>{v.precision.toFixed(2)}</td>
                <td>{v.recall.toFixed(2)}</td>
                <td className="bad-text">{pct(v.targetPoolShare.naive)}</td>
                <td className="good-text">{pct(v.targetPoolShare.hybridCapped ?? v.targetPoolShare.hybrid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Honest limits</h3>
      <p>The model alone does not generalize across attack families. When one family is left out of training, recall on it is:</p>
      <div className="scroll-x">
        <table>
          <thead><tr><th>Family left out</th><th>Recall</th><th>Precision</th></tr></thead>
          <tbody>
            {Object.entries(metrics.leaveOneOut || {}).map(([k, v]) => (
              <tr key={k}><td>{LABEL[k] || k}</td><td>{v.recall.toFixed(2)}</td><td>{v.precision.toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">That is why Rootfund combines the model with a burst rule, a per-project cap, and a human approval step before any money moves.</p>
    </div>
  );
}
