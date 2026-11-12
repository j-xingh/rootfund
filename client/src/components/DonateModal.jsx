import React, { useEffect, useState } from 'react';
import Modal from './Modal.jsx';
import { usd } from '../lib/format.js';

const CHIPS = [5, 10, 25, 50];

export default function DonateModal({ project, testMode, busy, onClose, onSubmit }) {
  const [amount, setAmount] = useState('10');
  const [slow, setSlow] = useState(false);
  useEffect(() => { setAmount('10'); setSlow(false); }, [project?.id]);
  useEffect(() => {
    if (!busy) { setSlow(false); return undefined; }
    const t = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(t);
  }, [busy]);
  if (!project) return null;
  const n = Number(amount);
  const valid = amount !== '' && Number.isInteger(n) && n >= 1 && n <= 100;
  return (
    <Modal open title={`Fund: ${project.name}`} onClose={busy ? () => {} : onClose}>
      <p className="muted">{project.description}</p>
      <div role="group" aria-label="Choose an amount" className="chips">
        {CHIPS.map((c) => <button key={c} className="chip" aria-pressed={n === c} onClick={() => setAmount(String(c))} disabled={busy}>${c}</button>)}
      </div>
      <label htmlFor="amt">Or enter an amount (whole dollars, 1 to 100)</label>
      <input id="amt" type="number" min="1" max="100" step="1" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} aria-invalid={!valid} aria-describedby="amt-err" />
      <div id="amt-err" className="field-error" role={valid ? undefined : 'alert'}>{valid ? '' : 'Enter a whole number of dollars from 1 to 100.'}</div>
      <div className="gift-line"><span>Your gift</span><span className="num">{valid ? usd(n) : '-'}</span></div>
      <p className="small">
        Your gift goes to this project. The community matching pool then adds an <b>estimated</b> match. That estimate changes as other people give and is final only when the round closes and an admin approves payouts.
        {' '}{testMode ? 'This is a PayPal sandbox test payment: no real money moves.' : ''}
      </p>
      {busy && <p role="status"><b>Opening PayPal…</b> {slow ? 'This is taking longer than usual. You can close this and try again.' : 'Please wait.'}</p>}
      <div className="row end">
        <button className="btn" onClick={onClose} disabled={busy && !slow}>Cancel</button>
        <button className="btn btn-primary" disabled={!valid || busy} onClick={() => onSubmit(n)}>{busy ? 'Opening PayPal…' : `Continue to PayPal${valid ? ` (${usd(n)})` : ''}`}</button>
      </div>
    </Modal>
  );
}
