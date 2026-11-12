import React, { useState } from 'react';
import { LogoMark } from '../components/Logo.jsx';
import ProjectCard from '../components/ProjectCard.jsx';
import DonateModal from '../components/DonateModal.jsx';
import { usd, int, pct1, sumCents } from '../lib/format.js';

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

export default function Home({ data, onDonate, busy }) {
  const { round, prot, integrity } = data;
  const [selected, setSelected] = useState(null);
  const supporters = integrity.counts.donors - integrity.counts.flagged;
  const total = sumCents(prot.items) / 100;
  const sim = integrity.metrics?.attacks?.jitter?.targetPoolShare;
  const testMode = round.paypalMode;

  return (
    <div>
      <section className="band dark">
        <div className="wrap">
          <div className="hero">
            <div>
              <p className="small" style={{ fontWeight: 700 }}>Community funding that is matched and protected</p>
              <h1 className="display">Small contributions. Collective impact.</h1>
              <p className="lead">Neighbours fund local projects together. A shared pool matches every gift, so the number of people who give matters more than the size of any one gift. AI screens out fake accounts to keep it fair.</p>
              <div className="cta-row">
                <button className="btn btn-primary" onClick={() => scrollTo('projects')}>Fund a project</button>
                <a className="btn" href="#/how">How it works</a>
              </div>
            </div>
            <div className="hero-logo"><LogoMark on="burgundy" /></div>
          </div>
          <div className="stats">
            <div className="stat"><b className="num">{usd(round.round.poolUsd)}</b><span>Matching pool from a sponsor</span></div>
            <div className="stat"><b className="num">{int(supporters)}</b><span>Supporters (unique people)</span></div>
            <div className="stat"><b className="num">{round.projects.length}</b><span>Projects</span></div>
          </div>
        </div>
      </section>

      <section className="band green" aria-labelledby="steps-h">
        <div className="wrap">
          <h2 id="steps-h" className="display-m">How it works in three steps</h2>
          <div className="steps">
            <div className="step"><b className="n" aria-hidden="true">1</b><h3>You give</h3><p>Give $1 to $100 to a project you care about, paid through PayPal.</p></div>
            <div className="step"><b className="n" aria-hidden="true">2</b><h3>The community matches</h3><p>A shared sponsor pool tops up each project. More supporters means a bigger top-up.</p></div>
            <div className="step"><b className="n" aria-hidden="true">3</b><h3>AI protects the pool</h3><p>Every donor is screened. Suspected fake accounts are left out, then a person approves the payout.</p></div>
          </div>
          <p style={{ marginTop: 24 }}><a href="#/how">Read the longer explanation</a></p>
        </div>
      </section>

      <section id="projects" className="band light" aria-labelledby="proj-h">
        <div className="wrap">
          <h2 id="proj-h" className="display-m">Projects to fund</h2>
          <p className="lead">Pick a project. Estimated matches change as others give and are final when the round closes.</p>
          <div className="grid">
            {round.projects.map((p, i) => <ProjectCard key={p.id} project={p} index={i} item={prot.items.find((x) => x.projectId === p.id)} onFund={setSelected} />)}
          </div>
          <p className="reconcile" role="note">
            Estimated matches add up to <b className="num">{usd(total)}</b> of the <b className="num">{usd(round.round.poolUsd)}</b> pool.
            {' '}Supporters are people. One person can support several projects, so the project counts add up to more than the {int(supporters)} supporters overall.
          </p>
        </div>
      </section>

      <section className="band dark" aria-labelledby="prot-h">
        <div className="wrap">
          <h2 id="prot-h" className="display-m">Protected against fake donors</h2>
          <p className="lead">The same rule that rewards many small gifts is easy to cheat with fake accounts. Rootfund scores every donor, leaves suspicious accounts out of the match, and shows why.
            {' '}{integrity.counts.flagged > 0 ? `Right now ${int(integrity.counts.flagged)} accounts are excluded.` : 'Right now no accounts are excluded.'}</p>
          {sim && (
            <figure style={{ margin: 0 }}>
              <div className="before-after">
                <div className="ba-row"><span>Plain quadratic funding</span><div className="bar-track" aria-hidden="true"><div className="bar-fill bar-naive" style={{ width: `${sim.naive * 100}%` }} /></div><b className="num">{pct1(sim.naive * 100)}</b></div>
                <div className="ba-row"><span>With Rootfund</span><div className="bar-track" aria-hidden="true"><div className="bar-fill bar-protected" style={{ width: `${(sim.hybridCapped ?? sim.hybrid) * 100}%` }} /></div><b className="num">{pct1((sim.hybridCapped ?? sim.hybrid) * 100)}</b></div>
              </div>
              <figcaption className="small muted" style={{ marginTop: 14, maxWidth: '70ch' }}>
                Share of the matching pool captured by one project when {integrity.metrics.meta.ringSize} fake donors target it. From our own simulation, not real-world data.
              </figcaption>
            </figure>
          )}
          <p style={{ marginTop: 20 }}><a href="#/how">See how the protection works</a></p>
        </div>
      </section>

      <DonateModal project={selected} testMode={testMode} busy={busy} onClose={() => setSelected(null)} onSubmit={(amt) => onDonate(selected.id, amt)} />
    </div>
  );
}
