'use strict';
// Update ONLY assertions about the CURRENT cache/version in existing smoke tests.
// Historical descriptions, game fixtures, and other version references are untouched.
const fs = require('node:fs');
const path = require('node:path');
const testDirectory = 'test';
const changed = [];
for (const file of fs.readdirSync(testDirectory).filter(name => name.endsWith('.test.js'))) {
  const name = path.join(testDirectory, file);
  const old = fs.readFileSync(name, 'utf8');
  const lines = old.split('\n');
  let updates = 0;
  const next = lines.map(line => {
    if (!/\bassert\.(?:match|equal|strictEqual|ok|includes)\(/.test(line)) return line;
    let revised = line.replaceAll('1\\.6\\.68', '1\\.6\\.69');
    revised = revised.replaceAll('1.6.68', '1.6.69');
    if (revised !== line) updates++;
    return revised;
  }).join('\n');
  if (updates) {
    fs.writeFileSync(name, next, 'utf8');
    changed.push(`${name}: ${updates} current-version assertions`);
  }
}
console.log('Updated version assertions only:', changed.length ? changed.join('; ') : 'none');
