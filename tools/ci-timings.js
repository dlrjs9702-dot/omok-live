#!/usr/bin/env node
'use strict';
// CI 2차 단축: refresh tools/ci-timings.json (each browser test's seconds, `<project> tests/e2e/<file>:<line>`) from a
// green CI run's part logs -- `node tools/ci-timings.js <run id>` (needs the gh CLI). The parts run one worker each, so
// a test's time is from the result line before it (or the part's start) to its own; a retry adds to the first try.
// Refresh now and then (tests move lines, new ones count 60 s until then): tools/ci-split.js reads the table.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const run = process.argv[2];
if (!/^\d+$/.test(run || '')) { console.error('usage: ci-timings.js <run id>'); process.exit(2); }
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const jobs = JSON.parse(gh('run', 'view', run, '--json', 'jobs')).jobs.filter((j) => /^e2e part/.test(j.name) && j.conclusion === 'success');
const out = {};
for (const job of jobs) {
  let prev = null;
  for (const raw of gh('run', 'view', '--job', String(job.databaseId), '--log').split('\n')) {
    const l = raw.replace(/\x1b\[[0-9;]*m/g, '');
    const ts = l.match(/(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d+Z)/); if (!ts) continue; const t = Date.parse(ts[1]);
    if (/Running \d+ tests? using/.test(l)) { prev = t; continue; }
    const m = l.match(/[✓✘-]\s+\d+ \[(chromium|mobile-chromium)\] › (tests\/e2e\/[^ ]+\.spec\.js:\d+):\d+ ›/);
    if (!m || prev === null) continue;
    const key = `${m[1]} ${m[2]}`; out[key] = Math.round(((out[key] || 0) + (t - prev) / 1000) * 10) / 10; prev = t;
  }
}
if (!Object.keys(out).length) { console.error('no test lines (is the run green, are its logs kept?)'); process.exit(1); }
const file = path.join(__dirname, 'ci-timings.json');
fs.writeFileSync(file, `${JSON.stringify(Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b))), null, 1)}\n`);
console.log(`${Object.keys(out).length} tests from ${jobs.length} parts -> ${path.relative(process.cwd(), file)}`);
