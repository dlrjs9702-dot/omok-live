'use strict';
// v1.10.78 메신저 (IDEAS #future-messenger): group chat on the start page (내 계정) for the accounts an administrator
// lets in. Kept here: who is let in (guest key ids), the rooms (name, members), and each room's messages numbered from 1
// (`seq`). Only the latest KEEP messages of a room stay -- a family game's chat is small, so nothing is dropped by age;
// the cap bounds a busy room (about 1,000 x 500 characters at most).
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const KEEP = 1000;

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
    this.queue = this.queue.then(async () => { const tmp = `${this.filePath}.tmp`; await fs.writeFile(tmp, json, 'utf8'); await fs.rename(tmp, this.filePath); });
    return this.queue;
  }
  async allowedIds() { return [...this.data.allowed]; }
  async setAllowed(keyId, on) {
    const has = this.data.allowed.includes(keyId);
    if (on && !has) this.data.allowed.push(keyId);
    if (!on && has) this.data.allowed = this.data.allowed.filter((id) => id !== keyId);
    await this.save();
  }
  async roomsOf(keyId) { return this.data.rooms.filter((r) => r.members.includes(keyId)).map((r) => ({ ...r, members: [...r.members] })); }
  async room(id) { const r = this.data.rooms.find((x) => x.id === id); return r ? { ...r, members: [...r.members] } : null; }
  async createRoom(name, creator, members) {
    const at = new Date().toISOString();
    const room = { id: crypto.randomUUID(), name, createdBy: creator, createdAt: at, lastAt: at, seq: 0, members: [...new Set([creator, ...members])] };
    this.data.rooms.push(room); this.data.messages[room.id] = [];
    await this.save();
    return { ...room, members: [...room.members] };
  }
  async addMembers(id, keyIds) {
    const r = this.data.rooms.find((x) => x.id === id); if (!r) return null;
    r.members = [...new Set([...r.members, ...keyIds])]; await this.save();
    return { ...r, members: [...r.members] };
  }
  async leave(id, keyId) { // the last one out deletes the room and its messages
    const r = this.data.rooms.find((x) => x.id === id); if (!r) return;
    r.members = r.members.filter((m) => m !== keyId);
    if (!r.members.length) { this.data.rooms = this.data.rooms.filter((x) => x !== r); delete this.data.messages[id]; }
    await this.save();
  }
  async messages(id, after = 0, limit = 100) { return (this.data.messages[id] || []).filter((m) => m.seq > after).slice(-limit).map((m) => ({ ...m })); }
  async post(id, keyId, text) {
    const r = this.data.rooms.find((x) => x.id === id); if (!r) return null;
    r.seq += 1; r.lastAt = new Date().toISOString();
    const list = this.data.messages[id] || (this.data.messages[id] = []);
    const msg = { seq: r.seq, from: keyId, text, at: r.lastAt };
    list.push(msg); if (list.length > KEEP) list.splice(0, list.length - KEEP);
    await this.save();
    return { ...msg };
  }
}

const iso = (v) => v?.toISOString?.() || v;
const roomOf = (row, members) => ({ id: row.id, name: row.name, createdBy: row.created_by, createdAt: iso(row.created_at), lastAt: iso(row.last_at), seq: row.seq, members });

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
        key_id text NOT NULL, text text NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (room_id, seq))`);
  }
  async allowedIds() { return (await this.pool.query('SELECT key_id FROM messenger_allowed')).rows.map((r) => r.key_id); }
  async setAllowed(keyId, on) {
    if (on) await this.pool.query('INSERT INTO messenger_allowed(key_id) VALUES ($1) ON CONFLICT DO NOTHING', [keyId]);
    else await this.pool.query('DELETE FROM messenger_allowed WHERE key_id=$1', [keyId]);
  }
  async withMembers(rows) {
    if (!rows.length) return [];
    const ms = await this.pool.query('SELECT room_id, key_id FROM messenger_members WHERE room_id = ANY($1::uuid[])', [rows.map((r) => r.id)]);
    return rows.map((r) => roomOf(r, ms.rows.filter((m) => m.room_id === r.id).map((m) => m.key_id)));
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
  async addMembers(id, keyIds) {
    await this.pool.query('INSERT INTO messenger_members(room_id, key_id) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING', [id, [...new Set(keyIds)]]);
    return this.room(id);
  }
  async leave(id, keyId) {
    await this.pool.query('DELETE FROM messenger_members WHERE room_id=$1 AND key_id=$2', [id, keyId]);
    await this.pool.query('DELETE FROM messenger_rooms WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM messenger_members WHERE room_id=$1)', [id]);
  }
  async messages(id, after = 0, limit = 100) {
    const rows = (await this.pool.query('SELECT seq, key_id, text, at FROM messenger_messages WHERE room_id=$1 AND seq>$2 ORDER BY seq DESC LIMIT $3', [id, after, limit])).rows;
    return rows.reverse().map((m) => ({ seq: m.seq, from: m.key_id, text: m.text, at: iso(m.at) }));
  }
  async post(id, keyId, text) {
    const bumped = await this.pool.query('UPDATE messenger_rooms SET seq=seq+1, last_at=now() WHERE id=$1 RETURNING seq, last_at', [id]);
    if (!bumped.rowCount) return null;
    const { seq, last_at: at } = bumped.rows[0];
    await this.pool.query('INSERT INTO messenger_messages(room_id, seq, key_id, text, at) VALUES ($1,$2,$3,$4,$5)', [id, seq, keyId, text, at]);
    if (seq > KEEP) await this.pool.query('DELETE FROM messenger_messages WHERE room_id=$1 AND seq<=$2', [id, seq - KEEP]);
    return { seq, from: keyId, text, at: iso(at) };
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

module.exports = { createMessengerStore, JsonMessengerStore, PostgresMessengerStore, KEEP };
