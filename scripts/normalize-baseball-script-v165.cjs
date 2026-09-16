'use strict';
const fs = require('node:fs');
const path = 'scripts/apply-baseball-v165.cjs';
const source = fs.readFileSync(path, 'utf8');
// Replace two consecutive backslashes before a backtick with one.
const slash = String.fromCharCode(92);
const tick = String.fromCharCode(96);
const before = slash + slash + tick;
const after = slash + tick;
const count = source.split(before).length - 1;
if (count < 5) throw new Error(`Expected escaped template markers, found ${count}`);
fs.writeFileSync(path, source.replaceAll(before, after));
console.log(`Normalized ${count} template markers.`);
