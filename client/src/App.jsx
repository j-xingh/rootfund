import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import Public from './pages/Public.jsx';
import Admin from './pages/Admin.jsx';
import HowItWorks from './pages/HowItWorks.jsx';

const useHash = () => {
  const [h, setH] = useState(window.location.hash.replace(/^#\/?/, '') || '');
  useEffect(() => { const f = () => setH(window.location.hash.replace(/^#\/?/, '')); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return h;
};

export default function App() {
  const route = useHash();
  const [data, setData] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  const params = new URLSearchParams(window.location.search);

  const say = useCallback((type, msg) => {
    setToast({ type, msg });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [r, n, p, i, t, l, s] = await Promise.all([api.round(), api.allocations('naive'), api.allocations('protected'), api.integrity(), api.timeline(), api.donations(), api.settlement()]);
      setData({ round: r, naive: n, prot: p, integrity: i, timeline: t, ledger: l.items, settlement: s });
    } catch (e) { say('bad', `Could not load data: ${e.message}`); }
  }, [say]);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { const out = await fn(); await load(); if (okMsg) say('ok', typeof okMsg === 'function' ? okMsg(out) : okMsg); }
    catch (e) { say('bad', e.message); }
    finally { setBusy(false); }
  };

  const donate = async (projectId, amountUsd) => {
    setBusy(true);
    try { const { approveUrl } = await api.checkout(projectId, amountUsd); window.location.href = approveUrl; }
    catch (e) { say('bad', e.message); setBusy(false); }
  };

  const page = route.startsWith('admin') ? 'admin' : route.startsWith('how') ? 'how' : 'home';
  const testMode = data?.round?.paypalMode;

  return (
    <div>
      <nav className="nav">
        <a className="brand" href="#/">Rootfund</a>
        <div className="navlinks">
          <a className={page === 'home' ? 'on' : ''} href="#/">Fund projects</a>
          <a className={page === 'how' ? 'on' : ''} href="#/how">How it works</a>
          <a className={page === 'admin' ? 'on' : ''} href="#/admin">Admin</a>
        </div>
      </nav>
      {testMode && (
        <div className="testbar">
          {testMode === 'mock' ? 'Local test mode: payments are simulated on this computer.' : 'PayPal sandbox: these are test payments. No real money moves.'}
        </div>
      )}
      <main className="page">
        {params.get('donation') === 'ok' && <div className="notice ok">Thank you! Your donation was received.</div>}
        {params.get('donation') === 'cancelled' && <div className="notice bad">Donation cancelled. You were not charged.</div>}
        {params.get('donation') === 'error' && <div className="notice bad">The donation did not complete. Please try again.</div>}
        {toast && <div className={`notice ${toast.type}`} role="status">{toast.msg}</div>}
        {!data ? <p className="muted">Loading…</p> : page === 'how' ? <HowItWorks /> : page === 'admin' ? <Admin data={data} act={act} busy={busy} say={say} /> : <Public data={data} onDonate={donate} busy={busy} />}
      </main>
      <footer className="footer">
        Rootfund is a hackathon prototype running on the PayPal sandbox. Some community activity shown here is seeded sample data.
      </footer>
    </div>
  );
}
