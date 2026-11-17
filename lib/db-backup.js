'use strict';
// 1.10.349 DB 백업 (notes docs/direction-ideas-20261110.md 178A·179A): every table as JSON lines, gzipped, then sealed with a public
// key -- the private key only on the owner's PC (tools/backup/). Streamed: a table read in batches through a cursor, never whole.
//
// The file: "IDBK1" | key length (uint16 BE) | the AES-256 key + GCM nonce sealed with RSA-OAEP-SHA256 | AES-256-GCM of the gzip |
// the GCM tag (16 bytes, last). Inside the gzip, one JSON a line: first {backup, at, source, tables}, then {t, r} for each row, last
// {end, rows} -- a file cut short has no `end` line.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Readable, Transform } = require('stream');

const MAGIC = Buffer.from('IDBK1');
const BATCH = 500;

// the sealing transform: the header first, the AES-GCM of everything through it, the tag at the end
function sealer(publicKeyPem) {
  const key = crypto.randomBytes(32); const iv = crypto.randomBytes(12);
  const sealed = crypto.publicEncrypt({ key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.concat([key, iv]));
  const len = Buffer.alloc(2); len.writeUInt16BE(sealed.length);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); let started = false;
  return new Transform({
    transform(chunk, _enc, done) { if (!started) { started = true; this.push(Buffer.concat([MAGIC, len, sealed])); } this.push(cipher.update(chunk)); done(); },
    flush(done) { if (!started) this.push(Buffer.concat([MAGIC, len, sealed])); this.push(cipher.final()); this.push(cipher.getAuthTag()); done(); },
  });
}

// a whole sealed file back to its JSON lines' text (the owner's PC: tools/backup/open.js)
function open(buf, privateKeyPem) {
  if (!buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('백업 파일이 아니에요 (머리말이 달라요).');
  const n = buf.readUInt16BE(MAGIC.length); const at = MAGIC.length + 2;
  const kv = crypto.privateDecrypt({ key: privateKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, buf.subarray(at, at + n));
  const decipher = crypto.createDecipheriv('aes-256-gcm', kv.subarray(0, 32), kv.subarray(32, 44)); decipher.setAuthTag(buf.subarray(buf.length - 16));
  const gz = Buffer.concat([decipher.update(buf.subarray(at + n, buf.length - 16)), decipher.final()]);
  return zlib.gunzipSync(gz).toString('utf8');
}

// the lines back to { meta, tables: { name: [rows] }, rows, complete }
function parse(text) {
  const out = { meta: null, tables: {}, rows: 0, complete: false };
  for (const line of text.split('\n')) {
    if (!line) continue; const j = JSON.parse(line);
    if (j.backup) out.meta = j; else if (j.end) { out.complete = true; out.rows = j.rows; } else (out.tables[j.t] ||= []).push(j.r);
  }
  for (const t of out.meta?.tables || []) out.tables[t] ||= [];
  return out;
}

// the database's tables (schema public), each read through a cursor in one read-only snapshot
async function* pgLines(connectionString, at) {
  const { Client } = require('pg');
  const useSsl = !/localhost|127\.0\.0\.1|\.internal(?::|\/|$)/i.test(connectionString);
  const client = new Client({ connectionString, ssl: useSsl ? { rejectUnauthorized: false } : false, statement_timeout: 120000 });
  await client.connect();
  try { yield* clientLines(client, at); } finally { await client.end().catch(() => {}); }
}
async function* clientLines(client, at) {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name")).rows.map((r) => r.table_name);
    yield { backup: 1, at, source: 'database', tables }; let rows = 0;
    for (const t of tables) {
      const name = `"${t.replace(/"/g, '""')}"`;
      await client.query(`DECLARE backup_rows NO SCROLL CURSOR FOR SELECT * FROM ${name}`);
      for (;;) { const got = (await client.query(`FETCH ${BATCH} FROM backup_rows`)).rows; for (const r of got) { rows += 1; yield { t, r }; } if (got.length < BATCH) break; }
      await client.query('CLOSE backup_rows');
    }
    yield { end: true, rows };
  } finally { await client.query('COMMIT').catch(() => {}); }
}
// without a database (local, tests): the data folder's JSON files, a file a table
async function* fileLines(dataDir, at) {
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).sort(); const tables = files.map((f) => f.slice(0, -5));
  yield { backup: 1, at, source: 'files', tables }; let rows = 0;
  for (const f of files) { let data = null; try { data = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')); } catch { data = null; } rows += 1; yield { t: f.slice(0, -5), r: data }; }
  yield { end: true, rows };
}

// the readable the server pipes out: the lines, gzip, sealed
function stream({ databaseUrl, dataDir, client, publicKey, at = new Date().toISOString() }) {
  const lines = client ? clientLines(client, at) : databaseUrl ? pgLines(databaseUrl, at) : fileLines(dataDir, at);
  const text = Readable.from((async function* () { for await (const l of lines) yield `${JSON.stringify(l)}\n`; })());
  const gz = zlib.createGzip({ level: 6 }); const seal = sealer(publicKey);
  text.on('error', (e) => gz.destroy(e)); gz.on('error', (e) => seal.destroy(e));
  return text.pipe(gz).pipe(seal);
}

// the public key: BACKUP_PUBLIC_KEY (PEM, or base64 of it), else tools/backup/backup-public.pem in the repo; null if neither
function publicKeyFrom(env = process.env, root = path.join(__dirname, '..')) {
  const v = String(env.BACKUP_PUBLIC_KEY || '').trim();
  if (v) return v.includes('BEGIN') ? v.replace(/\\n/g, '\n') : Buffer.from(v, 'base64').toString('utf8');
  const f = path.join(root, 'tools', 'backup', 'backup-public.pem'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
}

module.exports = { MAGIC, BATCH, sealer, open, parse, stream, clientLines, fileLines, publicKeyFrom };
