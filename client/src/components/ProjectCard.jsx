import React from 'react';
import { usd, int } from '../lib/format.js';

const COLOURS = ['emerald', 'lavender', 'orange', 'yellow'];

export default function ProjectCard({ project, item, index, onFund }) {
  return (
    <article className={`pcard c-${COLOURS[index % COLOURS.length]}`}>
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      <div className="figures">
        <div><b className="num">{int(item.donors)}</b><span>Supporters</span></div>
        <div><b className="num">{usd(item.matchUsd)}</b><span>Estimated match</span></div>
      </div>
      <button className="btn" onClick={() => onFund(project)} aria-label={`Fund ${project.name}`}>Fund this project</button>
    </article>
  );
}
