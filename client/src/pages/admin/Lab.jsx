import React, { useState } from 'react';
import { api } from '../../api.js';
import Timeline from '../../components/Timeline.jsx';
import Modal from '../../components/Modal.jsx';

const ATTACKS = [['naive', 'Naive ring (burst, odd emails)'], ['jitter', 'Jitter ring (spread out)'], ['adaptive', 'Adaptive ring (adds decoys)'], ['evasive', 'Evasive ring (hardest)']];

export default function Lab({ data, act, busy }) {
  const { round, timeline } = data;
  const [attack, setAttack] = useState({ kind: 'jitter', size: 250, target: 'p7' });
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div>
      <h1 className="admin-title">Test lab</h1>
      <p className="lead"><b>Prototype tools: simulated data.</b> Simulate a gang of fake donors flooding one project, then watch the Dashboard and Review pages respond.</p>
      <div className="card">
        <h2>Simulate an attack</h2>
        <div className="row">
          <div><label htmlFor="atk">Attack type</label>
            <select id="atk" value={attack.kind} onChange={(e) => setAttack({ ...attack, kind: e.target.value })}>{ATTACKS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
          <div><label htmlFor="sz">Fake donors (1 to 600)</label>
            <input id="sz" type="number" min="1" max="600" value={attack.size} onChange={(e) => setAttack({ ...attack, size: e.target.value })} style={{ width: 110 }} /></div>
          <div><label htmlFor="tg">Target project</label>
            <select id="tg" value={attack.target} onChange={(e) => setAttack({ ...attack, target: e.target.value })}>{round.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <button className="btn btn-primary" disabled={busy} onClick={() => act(() => api.attack(attack.kind, Number(attack.size), attack.target), (o) => `Added ${o.added} simulated fake donations.`)}>Launch attack</button>
        </div>
      </div>
      <div className="card"><h2>Timeline of gifts</h2><Timeline data={timeline} /></div>
      <div className="card" style={{ borderColor: 'var(--error)' }}>
        <h2>Danger zone</h2>
        <p>Removes injected attacks and reseeds the sample crowd. Real donation records are kept.</p>
        <button className="btn btn-danger" disabled={busy} onClick={() => setConfirmReset(true)}>Reset test data</button>
      </div>
      <Modal open={confirmReset} title="Reset the test data?" onClose={() => setConfirmReset(false)}>
        <p>This removes any injected attack and reseeds the simulated crowd. Real donation records are kept.</p>
        <div className="row end">
          <button className="btn" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { setConfirmReset(false); act(() => api.reset(true), 'Test data reset.'); }}>Reset</button>
        </div>
      </Modal>
    </div>
  );
}
