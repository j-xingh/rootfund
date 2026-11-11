import React, { useState } from 'react';
import DonateModal from '../components/DonateModal.jsx';

const usd = (n) => `$${Number(n).toFixed(0)}`;

export default function Public({ data, onDonate, busy }) {
  const { round, prot, integrity } = data;
  const [selected, setSelected] = useState(null);
  const supporters = integrity.counts.donors - integrity.counts.flagged;
  const max = Math.max(1, ...prot.items.map((i) => i.sharePct));
  const testMode = true;

  return (
    <div>
      <section className="hero">
        <h1>Fund your community.<br />Small gifts, matched.</h1>
        <p className="lead">
          Give $1 to $100 to a local project. A shared pool tops up every project, and the more people who give, the bigger the top-up.
          Our AI screens out fake accounts so the pool goes where real people want it.
        </p>
        <div className="row">
          <a className="btn primary" href="#projects">Choose a project</a>
          <a className="btn" href="#/how">How it works</a>
        </div>
        <div className="stats">
          <div><b>{usd(round.round.poolUsd)}</b><span>matching pool</span></div>
          <div><b>{supporters}</b><span>verified supporters</span></div>
          <div><b>{round.projects.length}</b><span>projects</span></div>
        </div>
      </section>

      <h2 id="projects" className="section-title">Projects to fund</h2>
      <div className="grid">
        {round.projects.map((p) => {
          const item = prot.items.find((i) => i.projectId === p.id);
          return (
            <article className="project" key={p.id}>
              <h3>{p.name}</h3>
              <p className="muted">{p.description}</p>
              <div className="bar-track"><div className="bar-fill protected" style={{ width: `${(item.sharePct / max) * 100}%` }} /></div>
              <div className="project-meta">
                <span><b>{item.donors}</b> supporters</span>
                <span>Estimated match <b>{usd(item.matchUsd)}</b></span>
              </div>
              <button className="primary" onClick={() => setSelected(p)}>Fund this project</button>
            </article>
          );
        })}
      </div>

      <section className="card protect">
        <h2>Protected against fake donors</h2>
        <p>Every donor is screened. {integrity.counts.flagged > 0 ? `${integrity.counts.flagged} suspicious accounts are currently excluded from the match.` : 'No suspicious accounts are currently excluded.'} <a href="#/how">See how it works</a>.</p>
      </section>

      <DonateModal project={selected} testMode={testMode} busy={busy} onClose={() => setSelected(null)}
        onSubmit={async (amt) => { await onDonate(selected.id, amt); }} />
    </div>
  );
}
