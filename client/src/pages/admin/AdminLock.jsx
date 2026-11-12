import React, { useState } from 'react';

export default function AdminLock({ onUnlock }) {
  const [key, setKey] = useState('');
  return (
    <div className="page-narrow">
      <h1 className="admin-title">Operations</h1>
      <p className="lead">Review flagged donors, test attacks, and approve payouts. Enter the admin key to continue.</p>
      <div className="card">
        <label htmlFor="adminkey">Admin key</label>
        <div className="row" style={{ marginTop: 6 }}>
          <input id="adminkey" type="password" autoComplete="current-password" value={key} onChange={(e) => setKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onUnlock(key)} />
          <button className="btn btn-primary" onClick={() => onUnlock(key)}>Unlock</button>
        </div>
      </div>
    </div>
  );
}
