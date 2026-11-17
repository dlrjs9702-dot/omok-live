'use strict';
// 1.10.349: a backup opened with this PC's private key -- the tables and their rows counted; with an output path, the JSON lines
// written there (they hold everyone's data: keep them on this PC, never in the repo or anywhere public)
//   node tools/backup/open.js <file.bak> [out.jsonl]
const fs = require('fs');
const C = require('./common');
const B = require('../../lib/db-backup');

const [file, outPath] = process.argv.slice(2);
if (!file) { console.error('사용: node tools/backup/open.js <file.bak> [out.jsonl]'); process.exit(1); }
const text = B.open(fs.readFileSync(file), fs.readFileSync(C.PRIVATE_KEY, 'utf8')); const p = B.parse(text);
console.log(`만든 때 ${p.meta?.at} · ${p.meta?.source} · ${p.complete ? '끝까지 있음' : '끝이 잘림!'} · 줄 ${p.rows}`);
for (const [t, rows] of Object.entries(p.tables)) console.log(`  ${t}: ${rows.length}`);
if (outPath) { fs.writeFileSync(outPath, text); console.log(`풀어 쓴 파일: ${outPath}`); }
if (!p.complete) process.exit(2);
