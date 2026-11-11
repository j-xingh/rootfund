import React, { useEffect, useState } from 'react';
import { api, getAdminKey, setAdminKey } from '../api.js';
import Compare from '../components/Compare.jsx';
import Timeline from '../components/Timeline.jsx';
import MetricsCard from '../components/MetricsCard.jsx';
import Modal from '../components/Modal.jsx';

const usd = (n) => `$${Number(n).toFixed(2)}`;
const ATTACKS = [
  ['naive', 'Naive ring (burst, odd emails)'],
  ['jitter', 'Jitter ring (spread out)'],
  ['adaptive', 'Adaptive ring (adds decoys)'],
  ['evasive', 'Evasive ring (hardest)'],
];
const TABS = [['overview', 'Overview'], ['lab', 'Attack lab'], ['review', 'Review'], ['payouts', 'Payouts'], ['detector', 'Detector']];

export default function Admin({ data, act, busy, say }) {
  const { round, naive, prot, integrity, timeline, ledger, settlement } = data;
  const [unlocked, setUnlocked] = useState(false);
  const [keyInput, setKeyInput] = useState(getAdminKey());
  const [tab, setTab] = useState('overview');
  const [attack, setAttack] = useState({ kind: 'jitter', size: 250, target: 'p7' });
  const [modal, setModal] = useState(null);

  useEffect(() => { if (getAdminKey()) api.ping().then(() => setUnlocked(true)).catch(() => {}); }, []);
  const unlock = async () => {
    setAdminKey(keyInput);
    try { await api.ping(); setUnlocked(true); } catch { say('bad', 'Wrong admin key.'); }
  };

  if (!unlocked) {
    return (
      <div className="page-narrow">
        <h1>Admin</h1>
        <p className="lead">Review flagged donors, test attacks, and approve payouts. Enter the admin key to continue.</p>
        <div className="card">
          <div className="row">
            <input type="password" placeholder="admin key" aria-label="admin key" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && unlock()} />
            <button className="primary" onClick={unlock}>Unlock</button>
          </div>
        </div>
      </div>
    );
  }

  const realFlagged = integrity.flagged.filter((f) => f.source === 'paypal').length;
  const protTotal = prot.items.reduce((a, i) => a + i.matchUsd, 0);
  const confirm = (cfg) => setModal(cfg);

  return (
    <div>
      <h1>Admin</h1>
      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'overview' && (
        <section className="card">
          <h2>Who gets the matching pool?</h2>
          <p className="muted">Red is what plain quadratic funding would pay. Green is what Rootfund pays after removing suspected fake donors.</p>
          <Compare naive={naive} prot={prot} />
          <p className="muted">{round.totals.real} real PayPal test donations · {round.totals.simulated} seeded sample donations</p>
        </section>
      )}

      {tab === 'lab' && (
        <>
          <section className="card">
            <h2>Attack lab</h2>
            <p className="muted">Simulate a gang of fake donors flooding one project, then watch Overview and Review respond.</p>
            <div className="row">
              <select aria-label="attack type" value={attack.kind} onChange={(e) => setAttack({ ...attack, kind: e.target.value })}>
                {ATTACKS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <input type="number" min="1" max="600" aria-label="number of fake donors" value={attack.size} onChange={(e) => setAttack({ ...attack, size: e.target.value })} style={{ width: 90 }} />
              <select aria-label="target project" value={attack.target} onChange={(e) => setAttack({ ...attack, target: e.target.value })}>
                {round.projects.map((p) => <option key={p.id} value={p.id}>→ {p.name}</option>)}
              </select>
              <button className="primary" disabled={busy} onClick={() => act(() => api.attack(attack.kind, Number(attack.size), attack.target), (o) => `Added ${o.added} simulated fake donations.`)}>Launch attack</button>
              <button disabled={busy} onClick={() => confirm({ title: 'Reset the test data?', confirmLabel: 'Reset', danger: true, body: 'Removes injected attacks and reseeds the sample crowd. Real donation records are kept.', run: () => act(() => api.reset(true), 'Test data reset.') })}>Reset</button>
            </div>
          </section>
          <section className="card"><h2>Timeline</h2><Timeline data={timeline} /></section>
        </>
      )}

      {tab === 'review' && (
        <section className="card">
          <h2>Flagged donors</h2>
          <p>{integrity.counts.flagged} of {integrity.counts.donors} donors are excluded from the match{realFlagged ? ` (${realFlagged} real PayPal donors)` : ''}.</p>
          {integrity.flagged.length === 0 ? <p className="muted">Nothing flagged.</p> : (
            <div className="scroll-x"><table>
              <thead><tr><th>Donor</th><th>Score</th><th>Why flagged</th><th>Source</th></tr></thead>
              <tbody>{integrity.flagged.slice(0, 12).map((f) => <tr key={f.donorKey}><td>{f.emailMasked}</td><td>{f.score}</td><td>{f.reasons.join('; ')}</td><td>{f.source}</td></tr>)}</tbody>
            </table></div>
          )}
          <div className="row">
            <button disabled={busy || realFlagged === 0} onClick={() => confirm({ title: 'Refund flagged real donations?', confirmLabel: 'Refund via PayPal', danger: true, body: `Refunds ${realFlagged} real PayPal test donor(s) through the PayPal refund API.`, run: () => act(() => api.refundFlagged(), (o) => `Refunded ${o.refunded} donation(s).`) })}>Refund flagged real donations</button>
            {realFlagged === 0 && <span className="muted">No real donations are flagged.</span>}
          </div>
          <h3>Real PayPal donations</h3>
          {ledger.length === 0 ? <p className="muted">None yet.</p> : (
            <div className="scroll-x"><table>
              <thead><tr><th>Project</th><th>Amount</th><th>Status</th><th>Capture</th></tr></thead>
              <tbody>{ledger.map((d) => <tr key={d.id}><td>{d.projectId}</td><td>{usd(d.amountUsd)}</td><td><span className={`badge ${d.status}`}>{d.status}</span></td><td>{d.captureId || '—'}</td></tr>)}</tbody>
            </table></div>
          )}
        </section>
      )}

      {tab === 'payouts' && (
        <section className="card">
          <h2>Payouts</h2>
          {settlement?.settlement ? (
            <div>
              <p>Batch <code>{settlement.settlement.batchId}</code> <span className={`badge ${settlement.settlement.status}`}>{settlement.settlement.status}</span></p>
              <div className="scroll-x"><table>
                <thead><tr><th>Project</th><th>Receiver</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>{settlement.settlement.items.map((i) => <tr key={i.senderItemId}><td>{i.projectId}</td><td>{i.receiver}</td><td>{usd(i.amountUsd)}</td><td><span className={`badge ${i.status}`}>{i.status}</span></td></tr>)}</tbody>
              </table></div>
            </div>
          ) : (
            <div>
              <p className="muted">Nothing paid yet. Payouts only happen after a human approves them, once per round.</p>
              <button className="primary" disabled={busy} onClick={() => confirm({ title: 'Approve and pay out?', confirmLabel: 'Approve and pay', body: `Sends ${usd(protTotal)} in matched funds to the project owners in one PayPal Payouts batch.`, run: () => act(() => api.settle(), 'Payout batch submitted.') })}>Approve and pay via PayPal</button>
            </div>
          )}
        </section>
      )}

      {tab === 'detector' && (
        <section className="card"><h2>How good is the detector?</h2><MetricsCard metrics={integrity.metrics} /></section>
      )}

      <Modal open={Boolean(modal)} title={modal?.title} confirmLabel={modal?.confirmLabel} danger={modal?.danger} onCancel={() => setModal(null)} onConfirm={() => { const m = modal; setModal(null); m.run(); }}>
        <p>{modal?.body}</p>
      </Modal>
    </div>
  );
}
