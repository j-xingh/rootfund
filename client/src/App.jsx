import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, getAdminKey, setAdminKey } from './api.js';
import Compare from './components/Compare.jsx';
import Timeline from './components/Timeline.jsx';
import MetricsCard from './components/MetricsCard.jsx';
import Modal from './components/Modal.jsx';

const usd = (n) => `$${Number(n).toFixed(2)}`;
const ATTACKS = [
  ['naive', 'Naive ring (burst, odd emails)'],
  ['jitter', 'Jitter ring (spread out)'],
  ['adaptive', 'Adaptive ring (adds decoys)'],
  ['evasive', 'Evasive ring (hardest)'],
];

export default function App() {
  const [round, setRound] = useState(null);
  const [naive, setNaive] = useState(null);
  const [prot, setProt] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [settlement, setSettlement] = useState(null);
  const [toast, setToast] = useState(null); // {type: 'ok'|'bad', msg}
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null); // {title, body, confirmLabel, danger, run}
  const [form, setForm] = useState({ projectId: 'p0', amountUsd: 5 });
  const [attack, setAttack] = useState({ kind: 'jitter', size: 250, target: 'p7' });
  const [adminKey, setKey] = useState(getAdminKey());
  const timer = useRef(null);
  const params = new URLSearchParams(window.location.search);

  const say = useCallback((type, msg) => {
    setToast({ type, msg });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [r, n, p, i, t, l, s] = await Promise.all([
        api.round(), api.allocations('naive'), api.allocations('protected'), api.integrity(), api.timeline(), api.donations(), api.settlement(),
      ]);
      setRound(r); setNaive(n); setProt(p); setIntegrity(i); setTimeline(t); setLedger(l.items); setSettlement(s);
    } catch (e) { say('bad', `Could not load data: ${e.message}`); }
  }, [say]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { const out = await fn(); await load(); if (okMsg) say('ok', typeof okMsg === 'function' ? okMsg(out) : okMsg); }
    catch (e) { say('bad', e.message); }
    finally { setBusy(false); }
  };
  const confirm = (cfg) => setModal(cfg);

  const donate = async () => {
    const amt = Number(form.amountUsd);
    if (!Number.isInteger(amt) || amt < 1 || amt > 100) return say('bad', 'Enter a whole number of dollars from 1 to 100.');
    setBusy(true);
    try {
      const { approveUrl } = await api.checkout(form.projectId, amt);
      window.location.href = approveUrl; // go to PayPal
    } catch (e) { say('bad', e.message); setBusy(false); }
  };

  if (!round || !naive || !prot || !integrity) {
    return (
      <div className="page">
        <h1>Rootfund</h1>
        <p className="muted">Loading…</p>
        {toast && <div className={`notice ${toast.type}`}>{toast.msg}</div>}
      </div>
    );
  }

  const realFlagged = integrity.flagged.filter((f) => f.source === 'paypal').length;
  const protTotal = prot.items.reduce((a, i) => a + i.matchUsd, 0);

  return (
    <div className="page">
      <header>
        <h1>Rootfund</h1>
        <p className="muted">Quadratic funding that resists fake donors. Matching pool <b>{usd(round.round.poolUsd)}</b> · PayPal mode <b>{round.paypalMode}</b></p>
        {params.get('donation') === 'ok' && <div className="notice ok">Thank you! Your donation was captured.</div>}
        {params.get('donation') === 'cancelled' && <div className="notice bad">Donation cancelled. You were not charged.</div>}
        {params.get('donation') === 'error' && <div className="notice bad">The donation did not complete. Please try again.</div>}
        {toast && <div className={`notice ${toast.type}`} role="status">{toast.msg}</div>}
      </header>

      <section className="card">
        <h2>Demo controls</h2>
        <div className="row">
          <input type="password" placeholder="admin key" aria-label="admin key" value={adminKey} onChange={(e) => { setKey(e.target.value); setAdminKey(e.target.value); }} />
          <select aria-label="attack type" value={attack.kind} onChange={(e) => setAttack({ ...attack, kind: e.target.value })}>
            {ATTACKS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input type="number" min="1" max="600" aria-label="number of fake donors" value={attack.size} onChange={(e) => setAttack({ ...attack, size: e.target.value })} style={{ width: 90 }} />
          <select aria-label="target project" value={attack.target} onChange={(e) => setAttack({ ...attack, target: e.target.value })}>
            {round.projects.map((p) => <option key={p.id} value={p.id}>→ {p.name}</option>)}
          </select>
          <button className="primary" disabled={busy} onClick={() => act(() => api.attack(attack.kind, Number(attack.size), attack.target), (o) => `Injected ${o.added} simulated fake donations.`)}>Launch attack</button>
        </div>
      </section>

      <section className="card">
        <h2>Who gets the matching pool?</h2>
        <Compare naive={naive} prot={prot} />
        <p className="muted">{round.totals.real} real PayPal sandbox donations · {round.totals.simulated} simulated donations (labeled, not real money)</p>
      </section>

      <section className="card">
        <h2>Attack timeline</h2>
        <Timeline data={timeline} />
      </section>

      <section className="card">
        <h2>Integrity review</h2>
        <p>{integrity.counts.flagged} of {integrity.counts.donors} donors flagged{realFlagged ? ` (${realFlagged} real PayPal donors)` : ''}.</p>
        {integrity.flagged.length === 0 ? <p className="muted">Nothing flagged.</p> : (
          <div className="scroll-x">
            <table>
              <thead><tr><th>Donor</th><th>Score</th><th>Why flagged</th><th>Source</th></tr></thead>
              <tbody>
                {integrity.flagged.slice(0, 8).map((f) => (
                  <tr key={f.donorKey}><td>{f.emailMasked}</td><td>{f.score}</td><td>{f.reasons.join('; ')}</td><td>{f.source}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="row">
          <button disabled={busy || realFlagged === 0} onClick={() => confirm({
            title: 'Refund flagged real donations?', confirmLabel: 'Refund via PayPal', danger: true,
            body: `This refunds ${realFlagged} real PayPal sandbox donor(s) through the PayPal refund API. Simulated donors are not refunded.`,
            run: () => act(() => api.refundFlagged(), (o) => `Refunded ${o.refunded} donation(s).`),
          })}>Refund flagged real donations</button>
          {realFlagged === 0 && <span className="muted">No real donations are flagged.</span>}
        </div>
      </section>

      <section className="card">
        <h2>Donate (PayPal sandbox)</h2>
        <div className="row">
          <select aria-label="project" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            {round.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="number" min="1" max="100" step="1" aria-label="amount in dollars" value={form.amountUsd} onChange={(e) => setForm({ ...form, amountUsd: e.target.value })} style={{ width: 90 }} />
          <button className="primary" disabled={busy} onClick={donate}>Donate with PayPal</button>
        </div>
        <h3>Ledger (real PayPal donations)</h3>
        {ledger.length === 0 ? <p className="muted">No real donations yet.</p> : (
          <div className="scroll-x">
            <table>
              <thead><tr><th>Project</th><th>Amount</th><th>Status</th><th>Capture</th></tr></thead>
              <tbody>{ledger.map((d) => <tr key={d.id}><td>{d.projectId}</td><td>{usd(d.amountUsd)}</td><td><span className={`badge ${d.status}`}>{d.status}</span></td><td>{d.captureId || '—'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Settlement</h2>
        {settlement?.settlement ? (
          <div>
            <p>Batch <code>{settlement.settlement.batchId}</code> — <span className={`badge ${settlement.settlement.status}`}>{settlement.settlement.status}</span></p>
            <div className="scroll-x">
              <table>
                <thead><tr><th>Project</th><th>Receiver</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>{settlement.settlement.items.map((i) => <tr key={i.senderItemId}><td>{i.projectId}</td><td>{i.receiver}</td><td>{usd(i.amountUsd)}</td><td><span className={`badge ${i.status}`}>{i.status}</span></td></tr>)}</tbody>
              </table>
            </div>
          </div>
        ) : (
          <div>
            <p className="muted">Not settled yet. Payouts only happen after a human approves them.</p>
            <button className="primary" disabled={busy} onClick={() => confirm({
              title: 'Approve and pay out?', confirmLabel: 'Approve and settle',
              body: `This sends ${usd(protTotal)} in matched funds to the project owners through one PayPal Payouts batch. It can only be done once per round.`,
              run: () => act(() => api.settle(), 'Payout batch submitted.'),
            })}>Approve and settle via PayPal Payouts</button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>How good is the detector?</h2>
        <MetricsCard metrics={integrity.metrics} />
      </section>

      <section className="card">
        <h2>Reset</h2>
        <button disabled={busy} onClick={() => confirm({
          title: 'Reset the demo?', confirmLabel: 'Reset', danger: true,
          body: 'This removes the injected attack and reseeds the simulated crowd. Real donation records are kept.',
          run: () => act(() => api.reset(true), 'Demo reset.'),
        })}>Reset demo</button>
      </section>

      <Modal open={Boolean(modal)} title={modal?.title} confirmLabel={modal?.confirmLabel} danger={modal?.danger}
        onCancel={() => setModal(null)} onConfirm={() => { const m = modal; setModal(null); m.run(); }}>
        <p>{modal?.body}</p>
      </Modal>
    </div>
  );
}
