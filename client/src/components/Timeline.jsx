import React from 'react';

/** Dot chart: x = hours since the round opened, y = project. Circle = included, diamond = excluded (flagged), ring = real PayPal gift. */
export default function Timeline({ data }) {
  if (!data) return null;
  const W = 900, rowH = 30, left = 170, top = 14, bottom = 34;
  const H = top + rowH * data.projects.length + bottom;
  const x = (t) => left + (Math.min(Math.max(t, 0), data.hours) / data.hours) * (W - left - 16);
  const rowOf = Object.fromEntries(data.projects.map((p, i) => [p.id, i]));
  const y = (id, j) => top + rowH * rowOf[id] + rowH / 2 + j;
  const jit = (i) => (((i * 2654435761) % 1000) / 1000) * 14 - 7;
  const flagged = data.points.filter((p) => p.flagged);
  const perProject = {};
  flagged.forEach((p) => { perProject[p.projectId] = (perProject[p.projectId] || 0) + 1; });
  const worst = Object.entries(perProject).sort((a, b) => b[1] - a[1])[0];
  const worstName = worst && data.projects.find((p) => p.id === worst[0])?.name;
  return (
    <div>
      <p className="small">
        {data.points.length} gifts plotted; {flagged.length} excluded from the match.
        {worst ? ` Most excluded gifts are aimed at ${worstName} (${worst[1]}).` : ' No gifts are excluded.'}
      </p>
      <div className="scroll-x">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Timeline of gifts by project. Excluded gifts are drawn as diamonds." style={{ width: '100%', minWidth: 640 }}>
          {data.projects.map((p, i) => (
            <g key={p.id}>
              <line x1={left} x2={W - 16} y1={top + rowH * i + rowH} y2={top + rowH * i + rowH} stroke="#37162B" strokeOpacity="0.18" />
              <text x={left - 8} y={top + rowH * i + rowH / 2 + 4} textAnchor="end" fill="#37162B" fontSize="12" fontFamily="Montserrat Variable, sans-serif">{p.name}</text>
            </g>
          ))}
          {[0, 24, 48, 72, 96, 120, 144, 168].map((h) => <text key={h} x={x(h)} y={H - 12} textAnchor="middle" fill="#37162B" fontSize="11" fontFamily="Montserrat Variable, sans-serif">{h}h</text>)}
          {data.points.map((p, i) => {
            const cx = x(p.t), cy = y(p.projectId, jit(i));
            const tip = <title>{`${p.source === 'paypal' ? 'Real PayPal gift' : 'Simulated gift'} $${p.amountUsd} at hour ${p.t}${p.flagged ? ' (excluded)' : ''}`}</title>;
            if (p.source === 'paypal') return <circle key={i} cx={cx} cy={cy} r="6" fill="none" stroke="#004D3E" strokeWidth="2.5">{tip}</circle>;
            if (p.flagged) return <path key={i} d={`M${cx} ${cy - 4.2}L${cx + 4.2} ${cy}L${cx} ${cy + 4.2}L${cx - 4.2} ${cy}Z`} fill="#B84A00" opacity="0.85">{tip}</path>;
            return <circle key={i} cx={cx} cy={cy} r="2.4" fill="#6B5BB0" opacity="0.6">{tip}</circle>;
          })}
        </svg>
      </div>
      <p className="small key" aria-hidden="true"><span>● Included (simulated)</span><span>◆ Excluded from match</span><span>◯ Real PayPal gift</span></p>
    </div>
  );
}
