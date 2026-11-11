'use strict';
// Adds ONE line to server/src/app.js so the new /api/timeline endpoint is registered. Safe to run more than once.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'server', 'src', 'app.js');
let s = fs.readFileSync(file, 'utf8');
if (s.includes('routes/timeline')) { console.log('app.js already has the timeline line. Nothing to do.'); process.exit(0); }
const marker = /^([ \t]*)app\.use\(express\.json\(\)\);[ \t]*\r?$/m;
if (!marker.test(s)) {
  console.error("Could not find the line app.use(express.json()); in server/src/app.js.");
  console.error("Add this line right after it by hand:  require('./routes/timeline')(app, { store, model, cfg });");
  process.exit(1);
}
s = s.replace(marker, (m, indent) => `${m}\n${indent}require('./routes/timeline')(app, { store, model, cfg }); // /api/timeline`);
fs.writeFileSync(file, s);
console.log('app.js updated: timeline endpoint registered.');
