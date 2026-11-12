import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api, getAdminKey, setAdminKey } from './api.js';
import { useHashRoute } from './lib/useHashRoute.js';
import PublicShell from './shells/PublicShell.jsx';
import AdminShell from './shells/AdminShell.jsx';
import Home from './pages/Home.jsx';
import HowItWorks from './pages/HowItWorks.jsx';
import Thanks from './pages/Thanks.jsx';
import AdminLock from './pages/admin/AdminLock.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Review from './pages/admin/Review.jsx';
import Payouts from './pages/admin/Payouts.jsx';
import Lab from './pages/admin/Lab.jsx';
import Detector from './pages/admin/Detector.jsx';
import { Notice } from './components/ui.jsx';

const readResult = () => { try { return JSON.parse(sessionStorage.getItem('rf_result') || 'null'); } catch { return null; } };

export default function App() {
  const route = useHashRoute();
  const [data, setData] = useState(null);
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState(false);
  const [adminOk, setAdminOk] = useState(false);
  const timer = useRef(null);

  const say = useCallback((type, msg) => {
    setToast({ type, msg });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 8000);
  }, []);

  const load = useCallback(async () => {
    try {
      const [r, n, p, i, t, l, s] = await Promise.all([api.round(), api.allocations('naive'), api.allocations('protected'), api.integrity(), api.timeline(), api.donations(), api.settlement()]);
      setData({ round: r, naive: n, prot: p, integrity: i, timeline: t, ledger: l.items, settlement: s });
    } catch (e) { say('error', `Could not load data: ${e.message}`); }
  }, [say]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (getAdminKey()) api.ping().then(() => setAdminOk(true)).catch(() => {}); }, []);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try { const out = await fn(); await load(); if (okMsg) say('success', typeof okMsg === 'function' ? okMsg(out) : okMsg); }
    catch (e) { say('error', e.message); }
    finally { setBusy(false); }
  };
  const donate = async (projectId, amountUsd) => {
    setBusy(true);
    try { const { approveUrl } = await api.checkout(projectId, amountUsd); window.location.href = approveUrl; }
    catch (e) { say('error', e.message); setBusy(false); }
  };
  const unlock = async (key) => {
    setAdminKey(key);
    try { await api.ping(); setAdminOk(true); } catch { say('error', 'Wrong admin key.'); }
  };

  const isAdmin = route.startsWith('admin');
  const testMode = data?.round?.paypalMode;
  const notice = toast && <div className="wrap"><Notice type={toast.type}>{toast.msg}</Notice></div>;

  let page;
  if (!data) page = <div className="wrap band"><p>Loading…</p></div>;
  else if (isAdmin) {
    if (!adminOk) page = <div className="wrap band"><AdminLock onUnlock={unlock} /></div>;
    else {
      const props = { data, act, busy };
      page = route === 'admin/review' ? <Review {...props} /> : route === 'admin/payouts' ? <Payouts {...props} /> : route === 'admin/lab' ? <Lab {...props} /> : route === 'admin/detector' ? <Detector {...props} /> : <Dashboard {...props} />;
    }
  } else if (route === 'how') page = <HowItWorks />;
  else if (route === 'thanks') page = <Thanks result={readResult()} ledger={data.ledger} projects={data.round.projects} />;
  else page = <Home data={data} onDonate={donate} busy={busy} />;

  if (isAdmin) return <AdminShell route={route} testMode={testMode}>{notice}{page}</AdminShell>;
  return <PublicShell route={route} testMode={testMode}>{notice}{page}</PublicShell>;
}
