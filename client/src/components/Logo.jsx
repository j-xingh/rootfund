import React from 'react';
// The supplied logo files are used unmodified. Variant is chosen by the background it sits on.
import primary from '../assets/logo/rootfund-symbol-primary.svg';   // full colour: for Burgundy
import burgundyMono from '../assets/logo/rootfund-symbol-burgundy.svg'; // for Blush
import ivoryMono from '../assets/logo/rootfund-symbol-ivory.svg';       // for Emerald (the full-colour version loses a node on Emerald)

const FILES = { burgundy: primary, blush: burgundyMono, emerald: ivoryMono };

export function LogoMark({ on = 'burgundy', className, height }) {
  return <img src={FILES[on]} alt="" aria-hidden="true" className={className} style={height ? { height } : undefined} />;
}

/** Symbol + the word 'Rootfund' set as live text (the supplied artwork has no wordmark). */
export default function Logo({ on = 'burgundy', href = '#/' }) {
  return (
    <a className="logo" href={href} aria-label="Rootfund home">
      <LogoMark on={on} />
      <span>Rootfund</span>
    </a>
  );
}
