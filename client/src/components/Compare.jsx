import React from 'react';

const usd = (n) => `$${Number(n).toFixed(2)}`;

/** Side-by-side bars: naive QF (red) versus Rootfund protected (lime), same scale. */
export default function Compare({ naive, prot }) {
  const max = Math.max(1, ...naive.items.map((i) => i.sharePct), ...prot.items.map((i) => i.sharePct));
  const top = naive.items.reduce((a, b) => (b.sharePct > a.sharePct ? b : a), naive.items[0]);
  const protTop = prot.items.find((i) => i.projectId === top.projectId);
  const attacked = top.sharePct >= 30 && protTop && protTop.sharePct < top.sharePct / 2;

  return (
    <div>
      {attacked && (
        <div className="headline">
          <b>{top.name}</b> takes <span className="bad-text">{top.sharePct}%</span> of the pool under naive QF,
          but only <span className="good-text">{protTop.sharePct}%</span> with Rootfund.
        </div>
      )}
      <div className="legend"><span className="dot naive" /> Naive QF <span className="dot protected" /> Rootfund protected</div>
      <div className="compare">
        {naive.items.map((n) => {
          const p = prot.items.find((x) => x.projectId === n.projectId);
          return (
            <div className="compare-row" key={n.projectId}>
              <div className="bar-name">{n.name}</div>
              <div className="pair">
                <div className="bar-track"><div className="bar-fill naive" style={{ width: `${(n.sharePct / max) * 100}%` }} /></div>
                <div className="bar-track"><div className="bar-fill protected" style={{ width: `${(p.sharePct / max) * 100}%` }} /></div>
              </div>
              <div className="vals">
                <div className="bad-text">{usd(n.matchUsd)} <span className="muted">({n.sharePct}%)</span></div>
                <div className="good-text">{usd(p.matchUsd)} <span className="muted">({p.sharePct}%)</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
