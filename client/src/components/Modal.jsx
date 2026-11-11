import React from 'react';

export default function Modal({ open, title, children, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        <div>{children}</div>
        <div className="row end">
          <button onClick={onCancel}>Cancel</button>
          <button className={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
