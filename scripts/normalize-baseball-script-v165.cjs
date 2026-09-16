'use strict';
const fs = require('node:fs');
const path = 'scripts/apply-baseball-v165.cjs';
const source = fs.readFileSync(path, 'utf8');
// Nested template literals have to be escaped once in the migration script,
// not twice; preserve the escape before their ${...} placeholders.
const before = String.raw`\\\``;
const after = String.raw`\``;
const count = source.split(before).length - 1;
if (count < 5) throw new Error(`Expected escaped template markers, found ${count}`);
fs.writeFileSync(path, source.replaceAll(before, after));
console.log(`Normalized ${count} template markers.`);
