'use strict';
// v1.10.77 A port for a server test's own game server. The old way -- listen(0), read the port, close, then start the
// server on it -- raced across the test files `node --test` runs side by side: another file's probe could be handed
// the same just-freed port, its server took it first, and this test talked to that server (CI 2026-10-13: an admin
// login answered 403 BAD_PASSWORD, the other server's password). Each port is now claimed with a lock file created
// exclusively in one shared folder, so no two test processes are ever given the same one; a claim older than 30
// minutes is a finished run's and may be taken again. The port is still checked to be free right now.
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');

const DIR = path.join(os.tmpdir(), 'omok-live-test-ports');
const FIRST = 20000; const COUNT = 10000; const STALE_MS = 30 * 60 * 1000;
fs.mkdirSync(DIR, { recursive: true });

const isFree = (port) => new Promise((resolve) => {
  const s = net.createServer();
  s.once('error', () => resolve(false));
  s.listen(port, '127.0.0.1', () => s.close(() => resolve(true)));
});

async function freePort() {
  const start = Math.floor(Math.random() * COUNT);
  for (let i = 0; i < COUNT; i += 1) {
    const port = FIRST + ((start + i) % COUNT);
    const lock = path.join(DIR, String(port));
    try { if (Date.now() - fs.statSync(lock).mtimeMs < STALE_MS) continue; fs.rmSync(lock, { force: true }); } catch {}
    try { fs.writeFileSync(lock, String(process.pid), { flag: 'wx' }); } catch { continue; } // someone else's
    if (await isFree(port)) return port;
  }
  throw new Error('no free test port');
}

module.exports = freePort;

if (require.main === module) { // self-check: claims from two "processes" never repeat
  (async () => { const got = new Set(); for (let i = 0; i < 50; i += 1) { const p = await freePort(); if (got.has(p)) throw new Error(`repeat ${p}`); got.add(p); } console.log('ok', got.size); })();
}
