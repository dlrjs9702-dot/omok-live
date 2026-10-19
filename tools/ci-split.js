#!/usr/bin/env node
'use strict';
// CI 2차 단축 (gamecenter-notes docs/ci-speedup-20261019.md, 사용자 2026-10-19 「두 가지 다 해 보자」): the browser suite in
// parts of about the same length by time, not by count. `node tools/ci-split.js <chromium|mobile> <parts> <index>` prints
// the tests of one part (tests/e2e/<file>:<line>); every part job works out the same split from the same commit, so the
// parts never overlap and together are the whole set (checked here: every test in exactly one part).
//   chromium: every spec on PC; mobile: the general specs (PLAYWRIGHT_SKIP_ISLAND) and the island specs in $PLAZA_MOBILE
// Each test's time is tools/ci-timings.json (seconds, from a green run's logs: tools/ci-timings.js); a new one counts 60 s.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const [kind, partsArg, indexArg] = process.argv.slice(2);
const parts = Number(partsArg); const index = Number(indexArg);
if (!['chromium', 'mobile'].includes(kind) || !(parts >= 1) || !(index >= 1 && index <= parts)) { console.error('usage: ci-split.js <chromium|mobile> <parts> <index>'); process.exit(2); }
const root = path.join(__dirname, '..');
const cli = require.resolve('@playwright/test/cli', { paths: [root] });
function list(project, files = [], env = {}) {
  const out = execFileSync(process.execPath, [cli, 'test', '--list', `--project=${project}`, ...files], { cwd: root, env: { ...process.env, ...env, PLAYWRIGHT_TEST_GROUP: '' }, encoding: 'utf8', maxBuffer: 1 << 26 });
  return out.split('\n').map((l) => l.match(/^\s+\[[\w-]+\] › (\S+?):(\d+):\d+ › /)).filter(Boolean).map((m) => `tests/e2e/${m[1].split(path.sep).join('/')}:${m[2]}`);
}
const project = kind === 'chromium' ? 'chromium' : 'mobile-chromium';
const tests = [...new Set(kind === 'chromium' ? list(project) : [...list(project, [], { PLAYWRIGHT_SKIP_ISLAND: '1' }), ...list(project, (process.env.PLAZA_MOBILE || '').split(/\s+/).filter(Boolean))])];
const timings = require('./ci-timings.json');
const time = (t) => timings[`${project} ${t}`] ?? 60;
// longest first, each to the part with the least so far (ties: the lower part, the test's own order)
const load = Array(parts).fill(0); const assigned = Array.from({ length: parts }, () => []);
for (const t of [...tests].sort((a, b) => time(b) - time(a) || a.localeCompare(b))) {
  const k = load.indexOf(Math.min(...load)); load[k] += time(t); assigned[k].push(t);
}
const all = assigned.flat();
if (all.length !== tests.length || new Set(all).size !== tests.length) { console.error('split: a test missing or twice'); process.exit(1); }
const mine = assigned[index - 1].sort();
console.error(`${kind} part ${index}/${parts}: ${mine.length} of ${tests.length} tests, about ${(load[index - 1] / 60).toFixed(1)} min (parts ${load.map((s) => (s / 60).toFixed(1)).join(' ')})`);
if (!mine.length) { console.error('split: an empty part'); process.exit(1); }
console.log(mine.join(' '));
