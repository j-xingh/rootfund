import React from 'react';

/** Status pill: always text + shape + colour (never colour alone). */
const SHAPES = {
  circle: <circle cx="5" cy="5" r="4" fill="currentColor" />,
  ring: <circle cx="5" cy="5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />,
  diamond: <path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill="currentColor" />,
  triangle: <path d="M5 0.8 9.6 9.2H0.4Z" fill="currentColor" />,
  square: <rect x="1" y="1" width="8" height="8" fill="currentColor" />,
};
const MAP = {
  CAPTURED: ['success', 'circle', 'Received'], SUCCESS: ['success', 'circle', 'Paid'], COMPLETED: ['success', 'circle', 'Complete'],
  PENDING: ['pending', 'ring', 'Pending'], PROCESSING: ['pending', 'ring', 'Processing'], PENDING_REVIEW: ['pending', 'ring', 'Pending review'], CREATED: ['pending', 'ring', 'Started'],
  REFUNDED: ['flag', 'square', 'Refunded'], FLAGGED: ['flag', 'diamond', 'Excluded from match'],
  FAILED: ['error', 'triangle', 'Failed'], DENIED: ['error', 'triangle', 'Denied'], UNCLAIMED: ['pending', 'ring', 'Unclaimed'], CANCELED: ['error', 'triangle', 'Cancelled'],
};
export function StatusPill({ status, label }) {
  const [tone, shape, text] = MAP[status] || ['neutral', 'ring', status];
  return (
    <span className={`pill ${tone}`}><svg viewBox="0 0 10 10" aria-hidden="true">{SHAPES[shape]}</svg>{label || text}</span>
  );
}

export function Notice({ type = 'info', children }) {
  return <div className={`notice ${type}`} role={type === 'error' ? 'alert' : 'status'}><b>{type === 'error' ? 'Error: ' : type === 'success' ? 'Done: ' : ''}</b>{children}</div>;
}

export function Tile({ label, value, note }) {
  return <div className="tile"><span>{label}</span><b className="num">{value}</b>{note && <small>{note}</small>}</div>;
}
