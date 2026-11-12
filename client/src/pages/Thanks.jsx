import React from 'react';
import { usd } from '../lib/format.js';
import { StatusPill } from '../components/ui.jsx';

const REASONS = {
  unknown_order: 'We could not match this payment to a donation.',
  capture_failed: 'PayPal did not complete the payment.',
};

export default function Thanks({ result, ledger, projects }) {
  if (!result) {
    return (
      <section className="band light"><div className="wrap page-narrow">
        <h1 className="display-m">Nothing to show</h1><p>There is no recent donation on this page.</p><a className="btn btn-primary" href="#/">Back to projects</a>
      </div></section>
    );
  }
  const d = ledger.find((x) => x.id === result.id);
  const project = d && projects.find((p) => p.id === d.projectId);

  if (result.kind === 'ok') {
    return (
      <section className="band light"><div className="wrap page-narrow">
        <h1 className="display-m">Thank you.</h1>
        <p className="lead">Your donation was received. It now counts toward the community match.</p>
        <div className="receipt" aria-label="Receipt">
          <dl>
            <dt>Project</dt><dd>{project ? project.name : 'Your chosen project'}</dd>
            <dt>Your gift</dt><dd className="num">{d ? usd(d.amountUsd) : 'Shown in your PayPal receipt'}</dd>
            <dt>Status</dt><dd>{d ? <StatusPill status={d.status} /> : <StatusPill status="CAPTURED" />}</dd>
            {d?.captureId && (<><dt>PayPal reference</dt><dd>{d.captureId}</dd></>)}
          </dl>
        </div>
        <p style={{ marginTop: 18 }}>The estimated match changes as others give and is final only when the round closes and an admin approves payouts.</p>
        <div className="cta-row"><a className="btn btn-primary" href="#/">Back to projects</a><a className="btn" href="#/how">How matching works</a></div>
      </div></section>
    );
  }
  if (result.kind === 'cancelled') {
    return (
      <section className="band light"><div className="wrap page-narrow">
        <h1 className="display-m">Donation cancelled.</h1>
        <p className="lead">You left PayPal before paying. No donation was made.</p>
        <div className="cta-row"><a className="btn btn-primary" href="#/">Try again</a></div>
      </div></section>
    );
  }
  return (
    <section className="band light"><div className="wrap page-narrow">
      <h1 className="display-m">The donation did not complete.</h1>
      <p className="lead">{REASONS[result.reason] || 'Something went wrong while finishing the payment.'}</p>
      <p>If PayPal shows a charge for this attempt, contact the organizers before trying again.</p>
      <div className="cta-row"><a className="btn btn-primary" href="#/">Try again</a></div>
    </div></section>
  );
}
