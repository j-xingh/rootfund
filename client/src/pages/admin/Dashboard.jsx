import React from 'react';
import Compare from '../../components/Compare.jsx';
import { Tile, StatusPill } from '../../components/ui.jsx';
import { usd, int, sumCents } from '../../lib/format.js';

export default function Dashboard({ data }) {
  const { round, naive, prot, integrity, settlement } = data;
  const people = integrity.counts.donors - integrity.counts.flagged;
  const s = settlement?.settlement;
  const total = sumCents(prot.items) / 100;
  return (
    <div>
      <h1 className="admin-title">Dashboard</h1>
      <div className="tiles" aria-label="System status">
        <Tile label="Matching pool" value={usd(round.round.poolUsd)} note={`Allocated: ${usd(total)}`} />
        <Tile label="Supporters (people)" value={int(people)} note={`${int(round.totals.donations)} gifts in total`} />
        <Tile label="Excluded from match" value={int(integrity.counts.flagged)} note="Flagged donors" />
        <Tile label="Real PayPal gifts" value={int(round.totals.real)} note="Sandbox test payments" />
        <Tile label="PayPal mode" value={round.paypalMode === 'mock' ? 'Local mock' : 'Sandbox'} />
        <div className="tile"><span>Payout state</span><b style={{ fontSize: 16, marginTop: 6 }}>{s ? <StatusPill status={s.status} /> : 'Not paid yet'}</b></div>
      </div>
      <div className="card">
        <h2>Who gets the matching pool?</h2>
        <p className="muted">Striped bars: what plain quadratic funding would pay. Solid bars: what Rootfund pays after excluding suspected fake donors.</p>
        <Compare naive={naive} prot={prot} />
      </div>
      <div className="row">
        <a className="btn" href="#/admin/review">Review flagged donors</a>
        <a className="btn btn-primary" href="#/admin/payouts">Allocation and payouts</a>
      </div>
    </div>
  );
}
