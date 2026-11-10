'use strict';
// How fraud scores turn into QF weights. Decision (docs/DECISIONS.md): hybrid exclusion (model OR burst rule), 40% cap per project.
const FLAG_THRESHOLD = 0.5;
const CAP_SHARE = 0.4; // honest winners reach ~33% in simulation, so 25% would clip them

const BURST_RULE = 10; // rule: 10+ other donations to the same project within 30 minutes

// Each policy maps one donor's {score, x} to a QF weight (0 = excluded).
const policies = {
  hybrid: (s) => (s.score > FLAG_THRESHOLD || s.x[3] >= BURST_RULE ? 0 : 1), // model OR burst rule (default)
  hard: (s) => (s.score > FLAG_THRESHOLD ? 0 : 1),
  soft: (s) => 1 - s.score,
  tiered: (s) => (s.score > 0.8 ? 0 : s.score > 0.4 ? 0.25 : 1),
};

function weightsFromScores(scores, policy = 'hybrid') {
  const f = policies[policy];
  const w = new Map();
  for (const [donorKey, s] of scores) w.set(donorKey, f(s));
  return w;
}

const isFlagged = (s) => policies.hybrid(s) === 0;

module.exports = { FLAG_THRESHOLD, CAP_SHARE, BURST_RULE, policies, weightsFromScores, isFlagged };
