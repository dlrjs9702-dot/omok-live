'use strict';
// Loaded before every unit test file (package.json `node --test --require`). Hundreds of tests check a whole source file
// against a pattern -- assert.match(app, /…/) over public/app.js, styles.css, server.js. When one misses, the error
// carries the whole file as `actual`, and CI's reporter (Node 20, TAP) did not finish writing an 825 KB string: the unit
// job sat silent 45 minutes and was cancelled instead of failing (v1.10.187). A miss on a long string now keeps its
// head and its length -- the pattern and the message are all a reader needs.
const assert = require('node:assert');

const LONG = 2000;
const short = (s) => `${s.slice(0, 300)}… (${s.length.toLocaleString('en-US')} chars)`;
for (const target of new Set([assert, assert.strict])) {
  for (const name of ['match', 'doesNotMatch']) {
    const original = target[name];
    target[name] = function quietMatch(actual, expected, message) {
      try { return original.call(this, actual, expected, message); } catch (error) {
        if (typeof actual === 'string' && actual.length > LONG && error instanceof assert.AssertionError) {
          const quiet = new assert.AssertionError({ message: typeof message === 'string' ? message : `${name === 'match' ? 'no match for' : 'unexpected match of'} ${expected} in ${short(actual)}`, actual: short(actual), expected, operator: name });
          quiet.stack = error.stack.replace(/^[\s\S]*?\n(\s+at )/, `${quiet.name}: ${quiet.message}\n$1`);
          throw quiet;
        }
        throw error;
      }
    };
  }
}
