'use strict';
// v1.10.274 (CI #421·#423 「ENOTEMPTY: directory not empty」): a test's data folder removed once its servers are gone. node:test runs
// a test's after hooks first-registered-first, and the folder's was set before the server's stop -- so it went while the server
// still wrote. At the test file's exit (its own process) every server it started has been stopped: their after hooks waited.
const fs = require('node:fs');
const dirs = new Set();
process.on('exit', () => { for (const dir of dirs) { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {} } });
module.exports = (dir) => { dirs.add(dir); };
