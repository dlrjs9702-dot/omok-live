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
    // (1.10.353 Codex 341-350 #7: all emptied in one TRUNCATE -- tables that point at each other together -- then filled parents
    // first, by the target's own foreign keys)
    const q = (t) => `"${t.replace(/"/g, '""')}"`; const tables = Object.keys(p.tables);
    const deps = (await client.query(`SELECT tc.table_name AS child, ccu.table_name AS parent FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`)).rows;
    if (tables.length) await client.query(`TRUNCATE ${tables.map(q).join(', ')}`);
    for (const t of B.restoreOrder(tables, deps)) {
      const rows = p.tables[t]; const name = q(t);
      for (const r of rows) {
        const cols = Object.keys(r); const vals = cols.map((c) => (r[c] !== null && typeof r[c] === 'object' ? JSON.stringify(r[c]) : r[c]));
        await client.query(`INSERT INTO ${name} (${cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`, vals);
      }
      console.log(`${t}: ${rows.length}`);
    }
    // (362 Codex 351-360 #8: the serial columns' sequences after the rows put in -- point_ledger.seq went on from 1, under the restored
    // ones, the newest history sorted below the old and a page's edge losing rows)
    const serials = (await client.query(`SELECT table_name AS t, column_name AS c, pg_get_serial_sequence(quote_ident(table_name), column_name) AS s FROM information_schema.columns
      WHERE table_schema = 'public' AND column_default LIKE 'nextval(%'`)).rows.filter((r) => r.s && tables.includes(r.t));
    for (const { t, c, s } of serials) { const col = `"${c.replace(/"/g, '""')}"`; await client.query(`SELECT setval($1, COALESCE((SELECT MAX(${col}) FROM ${q(t)}), 1), (SELECT MAX(${col}) IS NOT NULL FROM ${q(t)}))`, [s]); console.log(`${t}.${c}: 순번 이어 감`); }
    await client.query('COMMIT'); console.log('되살리기 끝');
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); throw e; } finally { await client.end(); }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
