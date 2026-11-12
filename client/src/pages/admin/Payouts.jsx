import React, { useState } from 'react';
import { api } from '../../api.js';
import { StatusPill } from '../../components/ui.jsx';
import { usd, int, pct1, sumCents } from '../../lib/format.js';

export default function Payouts({ data, act, busy }) {
  const { round, prot, settlement } = data;
  const s = settlement?.settlement;
  const [typed, setTyped] = useState('');
  const totalCents = sumCents(prot.items);
  const poolCents = Math.round(round.round.poolUsd * 100);
  const rows = prot.items.filter((i) => i.matchCents > 0);
  const reconciles = totalCents === poolCents;

  if (s) {
    return (
      <div>
        <h1 className="admin-title">Payouts</h1>
        <p className="lead">Payouts were approved and sent as one PayPal batch. This can happen only once per round.</p>
        <div className="card">
          <h2>Step 3. Track the payout</h2>
          <p>Batch <code>{s.batchId}</code> <StatusPill status={s.status} /></p>
          <div className="scroll-x"><table>
            <caption className="sr-only">Payout status per project owner</caption>
            <thead><tr><th>Project</th><th>Recipient</th><th className="r">Amount</th><th>Status</th></tr></thead>
            <tbody>{s.items.map((i) => <tr key={i.senderItemId}><td>{i.projectId}</td><td>{i.receiver}</td><td className="r num">{usd(i.amountUsd)}</td><td><StatusPill status={i.status} />{i.error ? <span className="small"> {i.error}</span> : null}</td></tr>)}</tbody>
          </table></div>
          <div className="row"><button className="btn" disabled={busy} onClick={() => act(() => api.settlement(), 'Status refreshed from PayPal.')}>Refresh status</button></div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <h1 className="admin-title">Allocation and payouts</h1>
      <p className="lead">Check the allocation, then approve it. Nothing is paid until you complete step 2.</p>
      <div className="card">
        <h2>Step 1. Check the allocation</h2>
        <p className="muted">This is the protected allocation: suspected fake donors are excluded and no project may exceed 40% of the pool.</p>
        <div className="scroll-x"><table>
          <caption className="sr-only">Protected allocation by project</caption>
          <thead><tr><th>Project</th><th className="r">Supporters</th><th className="r">Share</th><th className="r">Amount</th></tr></thead>
          <tbody>{rows.map((i) => <tr key={i.projectId}><td>{i.name}</td><td className="r num">{int(i.donors)}</td><td className="r num">{pct1(i.sharePct)}</td><td className="r num">{usd(i.matchUsd)}</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={3}>Total to pay</td><td className="r num">{usd(totalCents / 100)}</td></tr></tfoot>
        </table></div>
        <p className="small" role="note">{reconciles ? `The total equals the ${usd(round.round.poolUsd)} pool to the cent.` : `Warning: the total ${usd(totalCents / 100)} does not equal the ${usd(round.round.poolUsd)} pool. Do not approve.`} Recipients are the project owners' PayPal accounts set in the server configuration.</p>
      </div>
      <div className="confirm-box">
        <h2>Step 2. Approve and pay</h2>
        <ul>
          <li>You will send <b className="num">{usd(totalCents / 100)}</b> as <b>{rows.length}</b> payouts (one per project) in a single PayPal Payouts batch.</li>
          <li>Rootfund cannot undo a PayPal payout, and only one batch is allowed per round.</li>
          <li>Estimates become final amounts when you approve.</li>
        </ul>
        <label htmlFor="pay">Type PAY to confirm</label>
        <div className="row" style={{ marginTop: 6 }}>
          <input id="pay" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          <button className="btn btn-primary" disabled={busy || !reconciles || typed.trim() !== 'PAY'} onClick={() => act(() => api.settle(), 'Payout batch submitted.')}>Approve and pay via PayPal</button>
        </div>
      </div>
    </div>
  );
}
