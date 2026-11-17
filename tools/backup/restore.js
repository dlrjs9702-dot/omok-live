'use strict';
// 1.10.349 되살리기 연습: a backup's rows put into a LOCAL Postgres whose tables the game already made (start the server once
// against it). Each table emptied, then filled from the backup. Refuses any database that is not on this PC.
//   node tools/backup/restore.js <file.bak> postgres://localhost:5432/island_restore
const fs = require('fs');
const C = require('./common');
const B = require('../../lib/db-backup');

async function main() {
  const [file, url] = process.argv.slice(2);
  if (!file || !url) throw new Error('사용: node tools/backup/restore.js <file.bak> postgres://localhost/<db>');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error('이 PC의 Postgres(localhost)에만 되살려요.');
  const p = B.parse(B.open(fs.readFileSync(file), fs.readFileSync(C.PRIVATE_KEY, 'utf8')));
  if (!p.complete) throw new Error('끝이 잘린 백업이에요.');
  const { Client } = require('pg'); const client = new Client({ connectionString: url }); await client.connect();
  try {
    await client.query('BEGIN');
    for (const [t, rows] of Object.entries(p.tables)) {
      const name = `"${t.replace(/"/g, '""')}"`; await client.query(`TRUNCATE ${name}`);
      for (const r of rows) {
        const cols = Object.keys(r); const vals = cols.map((c) => (r[c] !== null && typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c]));
        await client.query(`INSERT INTO ${name} (${cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, vals);
      }
      console.log(`${t}: ${rows.length}`);
    }
    await client.query('COMMIT'); console.log('되살리기 끝');
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { await client.end(); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
