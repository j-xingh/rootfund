import React from 'react';

/** Dot chart: x = hours since the round opened, y = project. Red = flagged, big green ring = real PayPal donation. */
export default function Timeline({ data }) {
  if (!data) return null;
  const W = 900, rowH = 30, left = 170, top = 14, bottom = 34;
  const H = top + rowH * data.projects.length + bottom;
  const x = (t) => left + (Math.min(Math.max(t, 0), data.hours) / data.hours) * (W - left - 16);
  const rowOf = Object.fromEntries(data.projects.map((p, i) => [p.id, i]));
  const y = (id, jitter) => top + rowH * rowOf[id] + rowH / 2 + jitter;
  // stable pseudo-jitter so dots do not move between renders
  const jit = (i) => ((i * 2654435761) % 1000) / 1000 * 14 - 7;
  const flagged = data.points.filter((p) => p.flagged).length;
  return (
    <div>
      <p className="muted">{data.points.length} donations plotted, {flagged} flagged. Fake-donor rings show up as dense red clusters.</p>
      <div className="scroll-x">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Donation timeline" style={{ width: '100%', minWidth: 640 }}>
          {data.projects.map((p, i) => (
            <g key={p.id}>
              <line x1={left} x2={W - 16} y1={top + rowH * i + rowH} y2={top + rowH * i + rowH} stroke="#263329" />
              <text x={left - 8} y={top + rowH * i + rowH / 2 + 4} textAnchor="end" fill="#8fa396" fontSize="12">{p.name}</text>
            </g>
          ))}
          {[0, 24, 48, 72, 96, 120, 144, 168].map((h) => (
            <g key={h}>
              <text x={x(h)} y={H - 12} textAnchor="middle" fill="#8fa396" fontSize="11">{h}h</text>
            </g>
          ))}
          {data.points.map((p, i) => (
            <circle key={i} cx={x(p.t)} cy={y(p.projectId, jit(i))} r={p.source === 'paypal' ? 6 : 2.4}
              fill={p.source === 'paypal' ? 'none' : p.flagged ? '#ff6b5e' : '#5f7d66'}
              stroke={p.source === 'paypal' ? '#b6f23a' : 'none'} strokeWidth={p.source === 'paypal' ? 2.5 : 0}
              opacity={p.flagged ? 0.75 : 0.55}>
              <title>{`${p.source === 'paypal' ? 'REAL PayPal' : 'simulated'} $${p.amountUsd} at hour ${p.t}${p.flagged ? ' (flagged)' : ''}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="legend">
        <span className="dot honest" /> honest (simulated) <span className="dot naive" /> flagged <span className="ring" /> real PayPal donation
      </div>
    </div>
  );
}
