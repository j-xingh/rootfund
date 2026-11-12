import React, { useState } from 'react';
import { api } from '../../api.js';
import { StatusPill } from '../../components/ui.jsx';
import Modal from '../../components/Modal.jsx';
import { usd, int } from '../../lib/format.js';

const band = (max) => (max >= 0.9 ? 'Strong signal' : max >= 0.7 ? 'Moderate signal' : max >= 0.5 ? 'Weak signal' : 'Burst rule');

export default function Review({ data, act, busy }) {
  const { integrity, ledger } = data;
  const [confirm, setConfirm] = useState(false);
  const groups = {};
  integrity.flagged.forEach((f) => {
    const key = f.reasons.join(' | ') || 'Flagged by a pattern rule';
    (groups[key] ||= { reasons: f.reasons.length ? f.reasons : ['Flagged by a pattern rule'], donors: [] }).donors.push(f);
  });
  const list = Object.values(groups).sort((a, b) => b.donors.length - a.donors.length);
  const realFlagged = integrity.flagged.filter((f) => f.source === 'paypal').length;

  return (
    <div>
      <h1 className="admin-title">Review</h1>
      <p className="lead">{int(integrity.counts.flagged)} of {int(integrity.counts.donors)} donors are excluded from the match. Donors are grouped by the pattern that flagged them.</p>
      <p className="small muted">Only two states exist: <b>Excluded from match</b> (flagged automatically) and <b>Refunded</b> (an admin refunded a real donation). The system does not decide that anyone committed fraud.</p>
      {list.length === 0 && <div className="card"><p style={{ margin: 0 }}>Nothing is flagged.</p></div>}
      {list.map((g, i) => {
        const max = Math.max(...g.donors.map((d) => d.score));
        return (
          <section className="group" key={i} aria-label={`Group of ${g.donors.length} donors`}>
            <div className="row" style={{ marginTop: 0, justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{int(g.donors.length)} donors share this pattern</h3>
              <span><StatusPill status="FLAGGED" /> <span className="small" style={{ marginLeft: 8 }}><b>{band(max)}</b> (top score <span className="num">{max.toFixed(2)}</span>)</span></span>
            </div>
            <ul>{g.reasons.map((r, j) => <li key={j}>{r}</li>)}</ul>
            <p className="small muted" style={{ margin: '10px 0 0' }}>What happens: these donors are left out of the match calculation. Real PayPal donors in this group can be refunded below.</p>
            <details>
              <summary>Show donors ({Math.min(g.donors.length, 25)} of {g.donors.length})</summary>
              <div className="scroll-x"><table>
                <thead><tr><th>Donor</th><th className="r">Score</th><th>Source</th></tr></thead>
                <tbody>{g.donors.slice(0, 25).map((d) => <tr key={d.donorKey}><td>{d.emailMasked}</td><td className="r num">{d.score.toFixed(3)}</td><td>{d.source === 'paypal' ? 'Real PayPal test gift' : 'Simulated'}</td></tr>)}</tbody>
              </table></div>
            </details>
          </section>
        );
      })}
      <div className="card">
        <h2>Refund flagged real donations</h2>
        <p>{realFlagged ? `${realFlagged} real PayPal test donor(s) are flagged. Refunding sends their money back through the PayPal refund API.` : 'No real PayPal donations are flagged.'}</p>
        <button className="btn btn-danger" disabled={busy || realFlagged === 0} onClick={() => setConfirm(true)}>Refund flagged real donations</button>
      </div>
      <div className="card">
        <h2>Real PayPal gifts</h2>
        {ledger.length === 0 ? <p className="muted">None yet.</p> : (
          <div className="scroll-x"><table>
            <thead><tr><th>Project</th><th className="r">Amount</th><th>Status</th><th>PayPal reference</th></tr></thead>
            <tbody>{ledger.map((d) => <tr key={d.id}><td>{d.projectId}</td><td className="r num">{usd(d.amountUsd)}</td><td><StatusPill status={d.status} /></td><td>{d.captureId || '-'}</td></tr>)}</tbody>
          </table></div>
        )}
      </div>
      <Modal open={confirm} title="Refund flagged real donations?" onClose={() => setConfirm(false)}>
        <p>This refunds {realFlagged} real PayPal test donor(s) through the PayPal refund API. Simulated donors are not refunded. Refunds cannot be undone from Rootfund.</p>
        <div className="row end">
          <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { setConfirm(false); act(() => api.refundFlagged(), (o) => `Refunded ${o.refunded} donation(s).`); }}>Refund via PayPal</button>
        </div>
      </Modal>
    </div>
  );
}
