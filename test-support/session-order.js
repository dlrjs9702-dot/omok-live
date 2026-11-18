'use strict';
// plaza-session-order*.test.js's helpers (1.10.362, #513: each test boots its own server, ~11 s on CI -- the file passed the runner's 120 s a file, so it is split)
const rmAtExit = require('./rm-at-exit');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { boot } = require('./test-server');

function hold(base, route, token, body) {
  const bytes = JSON.stringify(body);
  let complete;
  const result = new Promise((resolve, reject) => {
    const req = http.request(base + route, { method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bytes), 'X-Session-Token': token,
    } }, res => {
      let text = ''; res.on('data', data => text += data);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(text) }));
    });
    req.on('error', reject); req.flushHeaders(); req.write(bytes.slice(0, 1));
    complete = () => req.end(bytes.slice(1));
  });
  return { complete, result };
}

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'presence-order-'));
  // Cleanup registered after boot: node:test runs a test's after-hooks in the order they were added, so the server's
  // shutdown (added in boot) comes first. (CI 3차 후속: added before boot, the folder went while the server still wrote
  // to it -- 'ENOTEMPTY: directory not empty, rmdir' after 「열린 광장 SSE」, #271 run 39805183750)
  let fx;
  try { fx = await boot(t, dir); } finally { rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */ }
  const token = await fx.enter(await fx.issue('입퇴장'));
  return { ...fx, token };
}

module.exports = { hold, fixture };
