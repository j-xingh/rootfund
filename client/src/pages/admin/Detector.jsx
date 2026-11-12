import React from 'react';
import MetricsCard from '../../components/MetricsCard.jsx';

export default function Detector({ data }) {
  return (
    <div>
      <h1 className="admin-title">Detector</h1>
      <div className="card"><h2>How well does it work?</h2><MetricsCard metrics={data.integrity.metrics} /></div>
    </div>
  );
}
