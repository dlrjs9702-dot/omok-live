'use strict';
const fs = require('node:fs');
const file = '.release/integrate-twentyquestions.cjs';
let script = fs.readFileSync(file, 'utf8');
const before = `replace('package-lock.json', '"version": "1.6.31"', '"version": "1.6.69"');`;
const after = `const lock = read('package-lock.json');\nif ((lock.match(/"version": "1\\.6\\.31"/g) || []).length !== 2) throw Error('Unexpected package-lock version layout');\nfiles.set('package-lock.json', lock.replace(/^  "version": "1\\.6\\.31",/m, '  "version": "1.6.69",').replace(/^      "version": "1\\.6\\.31",/m, '      "version": "1.6.69",'));`;
const second = `replace('package-lock.json', '      "version": "1.6.31",', '      "version": "1.6.69",');`;
if (script.includes(before) && script.includes(second)) {
  script = script.replace(before, after).replace(second, '');
  fs.writeFileSync(file, script, 'utf8');
  console.log('Patched duplicate version anchors in integration script');
} else if (script.includes('Unexpected package-lock version layout')) {
  console.log('Integration script already corrected');
} else throw Error('Unexpected integration script layout');
require('./refresh-twenty-cache-tests.cjs');
require('./refresh-twenty-registry-tests.cjs');
