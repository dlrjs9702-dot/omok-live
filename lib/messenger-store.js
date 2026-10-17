'use strict';
// v1.10.78 메신저 (IDEAS #future-messenger): group chat on the start page (내 계정) for the accounts an administrator
// lets in. Kept here: who is let in (guest key ids), the rooms (name, members), and each room's messages numbered from 1
// (`seq`). v1.10.87 (IDEAS: 「부담이 크면 7일, 아니면 계속 보관」): every message is kept -- a family's group chat is small
// (500 characters a message), so nothing is dropped; a room's messages go only with the room (the last one out).
// v1.10.88 카카오톡처럼 (IDEAS #future-messenger-kakao): each member's last read number (`reads`, on the server: the same
// on every device), 1:1 rooms (one per pair, `kind: 'dm'`), system lines (`system: true`: invited / left / renamed),
// a room's last message for the list, rename, per-member mute.
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const pairOf = (a, b) => [a, b].sort().join('|');

class JsonMessengerStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { allowed: [], rooms: [], messages: {} };
    this.queue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try { this.data = { allowed: [], rooms: [], messages: {}, ...JSON.parse(await fs.readFile(this.filePath, 'utf8')) }; }
    catch (err) { if (err.code !== 'ENOENT') throw err; await this.save(); }
  }
  save() {
    const json = JSON.stringify(this.data);
    // (Codex review: a failed write -- a full disk -- must not stop every later one: each write follows the last, ok or not)
    const write = this.queue.catch(() => {}).then(async () => { const tmp = `${this.filePath}.tmp`; await fs.writeFile(tmp, json, 'utf8'); await fs.rename(tmp, this.filePath); });
    this.queue = write;
    return write;
  }
  out(r) { // a copy, with the v1.10.88 fields an older file lacks
    const last = (this.data.messages[r.id] || []).at(-1);
    return { id: r.id, name: r.name, createdBy: r.createdBy, createdAt: r.createdAt, lastAt: r.lastAt, seq: r.seq, members: [...r.members],
      kind: r.kind || 'group', pair: r.pair ? r.pair.split('|') : null, reads: { ...(r.reads || {}) }, muted: [...(r.muted || [])], pinned: [...(r.pinned || [])], last: last ? { ...last } : null };
  }
  find(id) { return this.data.rooms.find((x) => x.id === id); }
  async allowedIds() { return [...this.data.allowed]; }
  async setAllowed(keyId, on) {
    const has = this.data.allowed.includes(keyId);
    if (on && !has) this.data.allowed.push(keyId);
    if (!on && has) this.data.allowed = this.data.allowed.filter((id) => id !== keyId);
    await this.save();
  }
  async roomsOf(keyId) { return this.data.rooms.filter((r) => r.members.includes(keyId)).map((r) => this.out(r)); }
  async room(id) { const r = this.find(id); return r ? this.out(r) : null; }
  async createRoom(name, creator, members, extra = {}) {
    const at = new Date().toISOString();
    const room = { id: crypto.randomUUID(), name, createdBy: creator, createdAt: at, lastAt: at, seq: 0, members: [...new Set([creator, ...members])], reads: {}, muted: [], ...extra };
    this.data.rooms.push(room); this.data.messages[room.id] = [];
    await this.save();
    return this.out(room);
  }
  // the one 1:1 room of two people: made the first time; opened again, whoever had left is back in (`joined`)
  async dmRoom(a, b) {
    const pair = pairOf(a, b); const r = this.data.rooms.find((x) => x.pair === pair);
    if (!r) return { room: await this.createRoom('', a, [b], { kind: 'dm', pair }), joined: [] };
    const joined = [a, b].filter((id) => !r.members.includes(id)); r.members.push(...joined); await this.save();
    return { room: this.out(r), joined };
  }
  async addMembers(id, keyIds, max = Infinity) { // false: it would pass `max` (checked here, so two invites at once never do)
    const r = this.find(id); if (!r) return null;
    const members = [...new Set([...r.members, ...keyIds])]; if (members.length > max) return false;
    r.members = members; await this.save();
    return this.out(r);
  }
  async leave(id, keyId) { // the last one out deletes the room and its messages
    const r = this.find(id); if (!r) return;
    r.members = r.members.filter((m) => m !== keyId);
    if (r.reads) delete r.reads[keyId]; if (r.muted) r.muted = r.muted.filter((m) => m !== keyId); if (r.pinned) r.pinned = r.pinned.filter((m) => m !== keyId);
    if (!r.members.length) { this.data.rooms = this.data.rooms.filter((x) => x !== r); delete this.data.messages[id]; }
    await this.save();
  }
  async rename(id, name) { const r = this.find(id); if (r) { r.name = name; await this.save(); } }
  async setMuted(id, keyId, on) {
    const r = this.find(id); if (!r) return;
    r.muted = (r.muted || []).filter((m) => m !== keyId); if (on) r.muted.push(keyId);
    await this.save();
  }
  // v1.10.91 대화방 고정 (mine only) and 메시지 삭제 (the text is gone for everyone; the line stays as 「삭제된 메시지입니다」)
  async setPinned(id, keyId, on) {
    const r = this.find(id); if (!r) return;
    r.pinned = (r.pinned || []).filter((m) => m !== keyId); if (on) r.pinned.push(keyId);
    await this.save();
  }
  async messageAt(id, seq) { const m = (this.data.messages[id] || []).find((x) => x.seq === seq); return m ? { ...m } : null; }
  async unsend(id, seq) { const m = (this.data.messages[id] || []).find((x) => x.seq === seq); if (m && !m.system) { m.text = ''; await this.save(); } }
  async setRead(id, keyId, seq) { // only forward
    const r = this.find(id); if (!r || !r.members.includes(keyId)) return;
    r.reads = r.reads || {}; if ((r.reads[keyId] || 0) >= seq) return;
    r.reads[keyId] = seq; await this.save();
  }
  // the newest `limit` on a first look (after 0); after a number, the next `limit` from it -- never a gap (Codex review)
  // v1.10.87 이전 대화: the `limit` just before message `before` (oldest first)
  async older(id, before, limit = 100) { return (this.data.messages[id] || []).filter((m) => m.seq < before).slice(-limit).map((m) => ({ ...m })); }
  async messages(id, after = 0, limit = 100) { const list = (this.data.messages[id] || []).filter((m) => m.seq > after); return (after > 0 ? list.slice(0, limit) : list.slice(-limit)).map((m) => ({ ...m })); }
  async post(id, keyId, text, system = false) {
    const r = this.find(id); if (!r) return null;
    r.seq += 1; r.lastAt = new Date().toISOString();
    const list = this.data.messages[id] || (this.data.messages[id] = []);
    const msg = { seq: r.seq, from: keyId, text, at: r.lastAt, ...(system ? { system: true } : {}) };
    list.push(msg);
    await this.save();
    return { ...msg };
  }
}

const iso = (v) => v?.toISOString?.() || v;
// a system line's sender is kept as '!' + the account that caused it (the messages table is not changed -- new tables only)
const msgOf = (m) => ({ seq: m.seq, from: m.key_id.replace(/^!/, ''), text: m.text, at: iso(m.at), ...(m.key_id.startsWith('!') ? { system: true } : {}) });

class PostgresMessengerStore {
  constructor(connectionString) {
    const { Pool } = require('pg');
    const useSsl = !/localhost|127\.0\.0\.1|\.internal(?::|\/|$)/i.test(connectionString);
    this.pool = new Pool({ connectionString, ssl: useSsl ? { rejectUnauthorized: false } : false, max: 2 });
  }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS messenger_allowed (key_id text PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS messenger_rooms (id uuid PRIMARY KEY, name text NOT NULL, created_by text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), last_at timestamptz NOT NULL DEFAULT now(), seq integer NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS messenger_members (room_id uuid NOT NULL REFERENCES messenger_rooms(id) ON DELETE CASCADE, key_id text NOT NULL,
        PRIMARY KEY (room_id, key_id));
      CREATE INDEX IF NOT EXISTS messenger_members_key_idx ON messenger_members(key_id);
      CREATE TABLE IF NOT EXISTS messenger_messages (room_id uuid NOT NULL REFERENCES messenger_rooms(id) ON DELETE CASCADE, seq integer NOT NULL,
        key_id text NOT NULL, text text NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (room_id, seq));
      CREATE TABLE IF NOT EXISTS messenger_reads (room_id uuid NOT NULL REFERENCES messenger_rooms(id) ON DELETE CASCADE, key_id text NOT NULL,
        seq integer NOT NULL, PRIMARY KEY (room_id, key_id));
      CREATE TABLE IF NOT EXISTS messenger_mutes (room_id uuid NOT NULL REFERENCES messenger_rooms(id) ON DELETE CASCADE, key_id text NOT NULL,
        PRIMARY KEY (room_id, key_id));
      CREATE TABLE IF NOT EXISTS messenger_pins (room_id uuid NOT NULL REFERENCES messenger_rooms(id) ON DELETE CASCADE, key_id text NOT NULL,
        PRIMARY KEY (room_id, key_id));
      CREATE TABLE IF NOT EXISTS messenger_dm (pair text PRIMARY KEY, room_id uuid NOT NULL UNIQUE REFERENCES messenger_rooms(id) ON DELETE CASCADE)`);
  }
  async allowedIds() { return (await this.pool.query('SELECT key_id FROM messenger_allowed')).rows.map((r) => r.key_id); }
  async setAllowed(keyId, on) {
    if (on) await this.pool.query('INSERT INTO messenger_allowed(key_id) VALUES ($1) ON CONFLICT DO NOTHING', [keyId]);
    else await this.pool.query('DELETE FROM messenger_allowed WHERE key_id=$1', [keyId]);
  }
  async withMembers(rows) {
    if (!rows.length) return [];
    const ids = [rows.map((r) => r.id)];
    const [ms, rs, mu, pins, dm, last] = await Promise.all([
      this.pool.query('SELECT room_id, key_id FROM messenger_members WHERE room_id = ANY($1::uuid[])', ids),
      this.pool.query('SELECT room_id, key_id, seq FROM messenger_reads WHERE room_id = ANY($1::uuid[])', ids),
      this.pool.query('SELECT room_id, key_id FROM messenger_mutes WHERE room_id = ANY($1::uuid[])', ids),
      this.pool.query('SELECT room_id, key_id FROM messenger_pins WHERE room_id = ANY($1::uuid[])', ids),
      this.pool.query('SELECT room_id, pair FROM messenger_dm WHERE room_id = ANY($1::uuid[])', ids),
      this.pool.query('SELECT DISTINCT ON (room_id) room_id, seq, key_id, text, at FROM messenger_messages WHERE room_id = ANY($1::uuid[]) ORDER BY room_id, seq DESC', ids),
    ]);
    const of = (q, id) => q.rows.filter((x) => x.room_id === id);
    return rows.map((r) => {
      const pair = of(dm, r.id)[0]?.pair; const end = of(last, r.id)[0];
      return { id: r.id, name: r.name, createdBy: r.created_by, createdAt: iso(r.created_at), lastAt: iso(r.last_at), seq: r.seq, members: of(ms, r.id).map((m) => m.key_id),
        kind: pair ? 'dm' : 'group', pair: pair ? pair.split('|') : null, reads: Object.fromEntries(of(rs, r.id).map((x) => [x.key_id, x.seq])),
        muted: of(mu, r.id).map((x) => x.key_id), pinned: of(pins, r.id).map((x) => x.key_id), last: end ? msgOf(end) : null };
    });
  }
  async roomsOf(keyId) {
    return this.withMembers((await this.pool.query('SELECT r.* FROM messenger_rooms r JOIN messenger_members m ON m.room_id=r.id WHERE m.key_id=$1', [keyId])).rows);
  }
  async room(id) { return (await this.withMembers((await this.pool.query('SELECT * FROM messenger_rooms WHERE id=$1', [id])).rows))[0] || null; }
  async createRoom(name, creator, members) {
    const id = crypto.randomUUID();
    await this.pool.query('INSERT INTO messenger_rooms(id, name, created_by) VALUES ($1,$2,$3)', [id, name, creator]);
    await this.addMembers(id, [creator, ...members]);
    return this.room(id);
  }
  async dmRoom(a, b) { // one room per pair: the pair locked while it is looked up or made (two opening at once get the same)
    const pair = pairOf(a, b);
    const out = await this.tx(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['messenger-dm:' + pair]);
      let found = (await client.query('SELECT room_id FROM messenger_dm WHERE pair=$1', [pair])).rows[0];
      // the room row locked too: a last one leaving at the same moment either finishes first (the room is gone: a new one)
      // or waits for this one (then the room has members and stays) -- Codex review
      if (found && !(await client.query('SELECT 1 FROM messenger_rooms WHERE id=$1 FOR UPDATE', [found.room_id])).rowCount) found = null;
      if (!found) {
        const id = crypto.randomUUID();
        await client.query('INSERT INTO messenger_rooms(id, name, created_by) VALUES ($1,$2,$3)', [id, '', a]);
        await client.query('INSERT INTO messenger_dm(pair, room_id) VALUES ($1,$2)', [pair, id]);
        await client.query('INSERT INTO messenger_members(room_id, key_id) SELECT $1, unnest($2::text[])', [id, [...new Set([a, b])]]);
        return { id, joined: [] };
      }
      const joined = (await client.query('INSERT INTO messenger_members(room_id, key_id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING RETURNING key_id', [found.room_id, [...new Set([a, b])]])).rows.map((r) => r.key_id);
      return { id: found.room_id, joined };
    });
    return { room: await this.room(out.id), joined: out.joined };
  }
  async tx(fn) { const client = await this.pool.connect(); try { await client.query('BEGIN'); const out = await fn(client); await client.query('COMMIT'); return out; } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); } }
  async addMembers(id, keyIds, max = Infinity) { // the room row locked while counting: two invites at once wait for each other
    const added = await this.tx(async (client) => {
      if (!(await client.query('SELECT 1 FROM messenger_rooms WHERE id=$1 FOR UPDATE', [id])).rowCount) return null;
      const now = (await client.query('SELECT key_id FROM messenger_members WHERE room_id=$1', [id])).rows.map((r) => r.key_id);
      if (new Set([...now, ...keyIds]).size > max) return false;
      await client.query('INSERT INTO messenger_members(room_id, key_id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [id, [...new Set(keyIds)]]);
      return true;
    });
    return added ? this.room(id) : added;
  }
  async leave(id, keyId) { // one transaction on the locked room row (a 1:1 reopened at the same moment waits for it)
    await this.tx(async (client) => {
      if (!(await client.query('SELECT 1 FROM messenger_rooms WHERE id=$1 FOR UPDATE', [id])).rowCount) return;
      for (const table of ['messenger_members', 'messenger_reads', 'messenger_mutes', 'messenger_pins']) await client.query(`DELETE FROM ${table} WHERE room_id=$1 AND key_id=$2`, [id, keyId]);
      await client.query('DELETE FROM messenger_rooms WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM messenger_members WHERE room_id=$1)', [id]);
    });
  }
  async rename(id, name) { await this.pool.query('UPDATE messenger_rooms SET name=$2 WHERE id=$1', [id, name]); }
  async setMuted(id, keyId, on) {
    if (on) await this.pool.query('INSERT INTO messenger_mutes(room_id, key_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, keyId]);
    else await this.pool.query('DELETE FROM messenger_mutes WHERE room_id=$1 AND key_id=$2', [id, keyId]);
  }
  async setPinned(id, keyId, on) {
    if (on) await this.pool.query('INSERT INTO messenger_pins(room_id, key_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [id, keyId]);
    else await this.pool.query('DELETE FROM messenger_pins WHERE room_id=$1 AND key_id=$2', [id, keyId]);
  }
  async messageAt(id, seq) { const row = (await this.pool.query('SELECT seq, key_id, text, at FROM messenger_messages WHERE room_id=$1 AND seq=$2', [id, seq])).rows[0]; return row ? msgOf(row) : null; }
  async unsend(id, seq) { await this.pool.query("UPDATE messenger_messages SET text='' WHERE room_id=$1 AND seq=$2 AND key_id NOT LIKE '!%'", [id, seq]); }
  async setRead(id, keyId, seq) {
    await this.pool.query(`INSERT INTO messenger_reads(room_id, key_id, seq) SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM messenger_members WHERE room_id=$1 AND key_id=$2)
      ON CONFLICT (room_id, key_id) DO UPDATE SET seq=GREATEST(messenger_reads.seq, EXCLUDED.seq)`, [id, keyId, seq]);
  }
  async older(id, before, limit = 100) {
    const rows = (await this.pool.query('SELECT seq, key_id, text, at FROM messenger_messages WHERE room_id=$1 AND seq<$2 ORDER BY seq DESC LIMIT $3', [id, before, limit])).rows;
    return rows.reverse().map(msgOf);
  }
  async messages(id, after = 0, limit = 100) {
    const rows = (await this.pool.query(`SELECT seq, key_id, text, at FROM messenger_messages WHERE room_id=$1 AND seq>$2 ORDER BY seq ${after > 0 ? 'ASC' : 'DESC'} LIMIT $3`, [id, after, limit])).rows;
    return (after > 0 ? rows : rows.reverse()).map(msgOf);
  }
  async post(id, keyId, text, system = false) {
    // one transaction: the room row stays locked until the message is in, so a later number is never readable first (Codex review)
    return this.tx(async (client) => {
      const bumped = await client.query('UPDATE messenger_rooms SET seq=seq+1, last_at=now() WHERE id=$1 RETURNING seq, last_at', [id]);
      if (!bumped.rowCount) return null;
      const { seq, last_at: at } = bumped.rows[0];
      await client.query('INSERT INTO messenger_messages(room_id, seq, key_id, text, at) VALUES ($1,$2,$3,$4,$5)', [id, seq, (system ? '!' : '') + keyId, text, at]);
      return msgOf({ seq, key_id: (system ? '!' : '') + keyId, text, at });
    });
  }
}

async function createMessengerStore({ dataDir, databaseUrl }) {
  if (databaseUrl) {
    const store = new PostgresMessengerStore(databaseUrl);
    try { await store.init(); console.log('메신저 저장소: PostgreSQL'); return store; }
    catch (err) { await store.pool.end().catch(() => {}); console.error('메신저 PostgreSQL 연결 실패, 로컬 JSON으로 전환:', err.message); }
  }
  const store = new JsonMessengerStore(path.join(dataDir, 'messenger.json'));
  await store.init();
  console.log('메신저 저장소: 로컬 JSON');
  return store;
}

module.exports = { createMessengerStore, JsonMessengerStore, PostgresMessengerStore };
