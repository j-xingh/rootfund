import React, { useEffect, useState } from 'react';

const CHIPS = [5, 10, 25, 50];

export default function DonateModal({ project, testMode, busy, onClose, onSubmit }) {
  const [amount, setAmount] = useState(10);
  useEffect(() => { setAmount(10); }, [project?.id]);
  if (!project) return null;
  const valid = Number.isInteger(Number(amount)) && Number(amount) >= 1 && Number(amount) <= 100;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Donate to ${project.name}`}>
        <h3>Fund: {project.name}</h3>
        <p className="muted">{project.description}</p>
        <div className="chips">
          {CHIPS.map((c) => (
            <button key={c} className={Number(amount) === c ? 'chip on' : 'chip'} onClick={() => setAmount(c)}>${c}</button>
          ))}
          <label className="custom">$<input type="number" min="1" max="100" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="custom amount in dollars" /></label>
        </div>
        {!valid && <p className="bad-text">Enter a whole number of dollars from 1 to 100.</p>}
        <p className="muted small">
          {testMode ? 'Test payment on the PayPal sandbox: no real money moves.' : 'You will pay with PayPal.'} Your gift is topped up from the community matching pool.
        </p>
        <div className="row end">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" disabled={!valid || busy} onClick={() => onSubmit(Number(amount))}>{busy ? 'Opening PayPal…' : `Continue to PayPal ($${valid ? amount : '–'})`}</button>
        </div>
      </div>
    </div>
  );
}
