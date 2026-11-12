import React from 'react';
import { usd, pct1 } from '../lib/format.js';

/** Plain quadratic funding (striped bar) versus Rootfund (solid bar). Labels are in text, not only colour. */
export default function Compare({ naive, prot }) {
  const max = Math.max(1, ...naive.items.map((i) => i.sharePct), ...prot.items.map((i) => i.sharePct));
  const top = naive.items.reduce((a, b) => (b.sharePct > a.sharePct ? b : a), naive.items[0]);
  const protTop = prot.items.find((i) => i.projectId === top.projectId);
  const attacked = top.sharePct >= 30 && protTop && protTop.sharePct < top.sharePct / 2;
  return (
    <div>
      {attacked && (
        <div className="headline" role="status">
          <b>{top.name}</b> would take {pct1(top.sharePct)} of the pool under plain quadratic funding, but only {pct1(protTop.sharePct)} with Rootfund.
        </div>
      )}
      <div className="key" aria-hidden="true"><span><i className="naive" />Plain quadratic funding</span><span><i className="prot" />With Rootfund</span></div>
      <div className="compare">
        {naive.items.map((n) => {
          const p = prot.items.find((x) => x.projectId === n.projectId);
          return (
            <div className="compare-row" key={n.projectId}>
              <div><b>{n.name}</b></div>
              <div className="pair">
                <div className="bar-track" aria-hidden="true"><div className="bar-fill bar-naive" style={{ width: `${(n.sharePct / max) * 100}%` }} /></div>
                <div className="bar-track" aria-hidden="true"><div className="bar-fill bar-protected" style={{ width: `${(p.sharePct / max) * 100}%` }} /></div>
              </div>
              <div className="vals num">
                <div><span className="lab">Plain:</span> {usd(n.matchUsd)} ({pct1(n.sharePct)})</div>
                <div><span className="lab">Rootfund:</span> {usd(p.matchUsd)} ({pct1(p.sharePct)})</div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="small muted">
        Summary: the largest plain-quadratic share goes to {top.name} ({pct1(top.sharePct)}); with Rootfund it receives {pct1(protTop.sharePct)}.
      </p>
    </div>
  );
}
