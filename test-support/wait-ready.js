'use strict';
// A spawned test server's /health, waited for as test-server.js's boot does (up to 30 s -- 1.10.362, 총괄: the files with their own
// 8~9 s wait failed the first CI try on two PRs in a row; under CI's load a server takes longer to come up, and a loop that only
// gave up then left the next request to fail as 「fetch failed」). Throws with the server's own output when it never answers.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitReady(base, child, ms = 30000) {
  let out = ''; child.stdout?.on('data', (d) => { out += d; }); child.stderr?.on('data', (d) => { out += d; });
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (child.exitCode !== null || child.signalCode) throw new Error(`test server exited (${child.exitCode ?? child.signalCode}): ${out.slice(-1500)}`);
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* not up yet */ }
    await sleep(100);
  }
  throw new Error(`test server not ready in ${ms} ms: ${out.slice(-1500)}`);
}

module.exports = { waitReady };
