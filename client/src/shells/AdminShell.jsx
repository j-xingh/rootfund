import React from 'react';
import Logo from '../components/Logo.jsx';

const LINKS = [['admin', 'Dashboard'], ['admin/review', 'Review'], ['admin/payouts', 'Allocation and payouts'], ['admin/lab', 'Test lab'], ['admin/detector', 'Detector']];

export default function AdminShell({ route, testMode, children }) {
  return (
    <div>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header dark">
        <div className="wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Logo on="burgundy" href="#/admin" />
            <span className="small" style={{ fontWeight: 700, borderLeft: '1.5px solid var(--line-dark)', paddingLeft: 16 }}>Operations</span>
          </div>
          <a className="small" href="#/">Back to public site</a>
        </div>
      </header>
      {testMode && <div className="testbar" role="note">{testMode === 'mock' ? 'Local test mode (not PayPal).' : 'PayPal sandbox: test payments only.'}</div>}
      <div className="admin-bar">
        <div className="wrap">
          <nav className="admin-nav" aria-label="Operations">
            {LINKS.map(([r, l]) => <a key={r} href={`#/${r}`} aria-current={route === r ? 'page' : undefined}>{l}</a>)}
          </nav>
        </div>
      </div>
      <main id="main" tabIndex={-1} className="wrap" style={{ paddingTop: 28, paddingBottom: 64 }}>{children}</main>
    </div>
  );
}
