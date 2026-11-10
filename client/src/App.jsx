import React, { useCallback, useEffect, useState } from 'react';
import { api, getAdminKey, setAdminKey } from './api.js';

const usd = (n) => `$${Number(n).toFixed(2)}`;

function Bars({ data, other, mode }) {
  const max = Math.max(1, ...data.items.map((i) => i.sharePct), ...(other ? other.items.map((i) => i.sharePct) : []));
  return (
    <div className="bars">
      {data.items.map((i) => (
        <div className="bar-row" key={i.projectId}>
          <div className="bar-name">{i.name}</div>
          <div className="bar-track">
            <div className={`bar-fill ${mode}`} style={{ width: `${(i.sharePct / max) * 100}%` }} />
          </div>
          <div className="bar-val">{usd(i.matchUsd)} <span className="muted">({i.sharePct}%) · {i.donors} donors</span></div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [round, setRound] = useState(null);
  const [naive, setNaive] = useState(null);
  const [prot, setProt] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [settlement, setSettlement] = useState(null);
  const [mode, setMode] = useState('protected');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ projectId: 'p0', amountUsd: 5 });
  const [adminKey, setKey] = useState(getAdminKey());
  const params = new URLSearchParams(window.location.search);

  const load = useCallback(async () => {
    try {
      const [r, n, p, i, l, s] = await Promise.all([api.round(), api.allocations('naive'), api.allocations('protected'), api.integrity(), api.donations(), api.settlement()]);
      setRound(r); setNaive(n); setProt(p); setIntegrity(i); setLedger(l.items); setSettlement(s);
      setErr('');
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const donate = () => act(async () => {
    const { approveUrl } = await api.checkout(form.projectId, Number(form.amountUsd));
    window.location.href = approveUrl; // leave for PayPal
  });

  if (!round || !naive || !prot) return <div className="page"><h1>Rootfund</h1><p>{err || 'Loading…'}</p></div>;
  const shown = mode === 'naive' ? naive : prot;

  return (
    <div className="page">
      <header>
        <h1>Rootfund</h1>
        <p className="muted">Quadratic funding that resists fake donors. Pool: <b>{usd(round.round.poolUsd)}</b> · PayPal mode: <b>{round.paypalMode}</b></p>
        {params.get('donation') === 'ok' && <div className="notice ok">Thank you! Your donation was captured.</div>}
        {params.get('donation') === 'error' && <div className="notice bad">Donation did not complete. Please try again.</div>}
        {err && <div className="notice bad">{err}</div>}
      </header>

      <section className="card">
        <div className="row spread">
          <h2>Matching pool allocation</h2>
          <div className="toggle">
            <button className={mode === 'naive' ? 'on' : ''} onClick={() => setMode('naive')}>Naive QF</button>
            <button className={mode === 'protected' ? 'on' : ''} onClick={() => setMode('protected')}>Rootfund protected</button>
          </div>
        </div>
        <Bars data={shown} other={mode === 'naive' ? prot : naive} mode={mode} />
        <p className="muted">{round.totals.real} real PayPal sandbox donations · {round.totals.simulated} simulated donations (labeled, not real money)</p>
      </section>

      <section className="card">
        <h2>Donate (PayPal sandbox)</h2>
        <div className="row">
          <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
            {round.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="number" min="1" max="100" step="1" value={form.amountUsd} onChange={(e) => setForm({ ...form, amountUsd: e.target.value })} />
          <button disabled={busy} onClick={donate}>Donate with PayPal</button>
        </div>
      </section>

      <section className="card">
        <h2>Integrity review</h2>
        <p>{integrity.counts.flagged} of {integrity.counts.donors} donors flagged.</p>
        <table>
          <thead><tr><th>Donor</th><th>Score</th><th>Why flagged</th><th>Source</th></tr></thead>
          <tbody>
            {integrity.flagged.slice(0, 8).map((f) => (
              <tr key={f.donorKey}><td>{f.emailMasked}</td><td>{f.score}</td><td>{f.reasons.join('; ')}</td><td>{f.source}</td></tr>
            ))}
          </tbody>
        </table>
        {integrity.metrics && (
          <details><summary>Detector evaluation (simulated data)</summary>
            <pre>{JSON.stringify(Object.fromEntries(Object.entries(integrity.metrics.attacks).map(([k, v]) => [k, { precision: v.precision, recall: v.recall, targetPoolShare: v.targetPoolShare }])), null, 2)}</pre>
          </details>
        )}
      </section>

      <section className="card">
        <h2>Ledger (real PayPal donations)</h2>
        {ledger.length === 0 ? <p className="muted">No real donations yet.</p> : (
          <table><thead><tr><th>Project</th><th>Amount</th><th>Status</th><th>Capture</th></tr></thead>
            <tbody>{ledger.map((d) => <tr key={d.id}><td>{d.projectId}</td><td>{usd(d.amountUsd)}</td><td>{d.status}</td><td>{d.captureId || '—'}</td></tr>)}</tbody></table>
        )}
      </section>

      <section className="card">
        <h2>Settlement</h2>
        {settlement?.settlement ? (
          <div><p>Batch <code>{settlement.settlement.batchId}</code> — <b>{settlement.settlement.status}</b></p>
            <table><tbody>{settlement.settlement.items.map((i) => <tr key={i.senderItemId}><td>{i.projectId}</td><td>{i.receiver}</td><td>{usd(i.amountUsd)}</td><td>{i.status}</td></tr>)}</tbody></table></div>
        ) : <p className="muted">Not settled yet. An admin must approve payouts.</p>}
      </section>

      <section className="card admin">
        <h2>Admin (demo controls)</h2>
        <div className="row">
          <input type="password" placeholder="admin key" value={adminKey} onChange={(e) => { setKey(e.target.value); setAdminKey(e.target.value); }} />
          <button disabled={busy} onClick={() => act(() => api.attack('jitter', 250, 'p7'))}>Launch sybil attack (250 fake donors → Tool Lending Library)</button>
          <button disabled={busy} onClick={() => act(() => api.refundFlagged())}>Refund flagged real donations</button>
          <button disabled={busy} onClick={() => act(() => api.settle())}>Approve and settle via PayPal Payouts</button>
          <button disabled={busy} onClick={() => act(() => api.reset(true))}>Reset demo</button>
        </div>
      </section>
    </div>
  );
}
