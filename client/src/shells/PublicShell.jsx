import React, { useState } from 'react';
import Logo from '../components/Logo.jsx';

export default function PublicShell({ route, testMode, children }) {
  const [open, setOpen] = useState(false);
  const cur = (r) => (route === r ? 'page' : undefined);
  return (
    <div>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header dark">
        <div className="wrap">
          <Logo on="burgundy" />
          <button className="btn btn-small menu-btn" aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>{open ? 'Close' : 'Menu'}</button>
          <nav id="site-nav" className={open ? 'nav open' : 'nav'} aria-label="Main" onClick={() => setOpen(false)}>
            <a href="#/" aria-current={cur('')}>Fund projects</a>
            <a href="#/how" aria-current={cur('how')}>How it works</a>
          </nav>
        </div>
      </header>
      {testMode && (
        <div className="testbar" role="note">
          {testMode === 'mock' ? 'Local test mode: payments are simulated on this computer.' : 'PayPal sandbox: these are test payments. No real money moves.'}
        </div>
      )}
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="site-footer dark">
        <div className="wrap">
          <div>
            <b>Small contributions. Collective impact.</b>
            <p className="small muted" style={{ margin: '6px 0 0', maxWidth: '60ch' }}>Rootfund is a hackathon prototype on the PayPal sandbox. Some community activity shown here is seeded sample data.</p>
          </div>
          <a href="#/admin">Operations (admin)</a>
        </div>
      </footer>
    </div>
  );
}
