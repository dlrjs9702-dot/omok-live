'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

function map(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    pinned: Boolean(row.pinned),
    releaseKey: row.release_key || row.releaseKey || null,
    createdAt: row.created_at?.toISOString?.() || row.created_at || row.createdAt,
    updatedAt: row.updated_at?.toISOString?.() || row.updated_at || row.updatedAt,
  };
}

class JsonAnnouncementStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.rows = [];
    this.queue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const loaded = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.rows = Array.isArray(loaded) ? loaded.map(row => ({ pinned: false, releaseKey: null, ...row })) : [];
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      await this.save();
    }
  }
  async save() {
    const json = JSON.stringify(this.rows, null, 2);
    this.queue = this.queue.then(async () => {
      const tmp = `${this.filePath}.tmp`;
      await fs.writeFile(tmp, json, 'utf8');
      await fs.rename(tmp, this.filePath);
    });
    return this.queue;
  }
  async list() {
    return this.rows.slice().sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))
      || String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 50).map(row => ({ ...row }));
  }
  async create(title, body, pinned = false) {
    const at = new Date().toISOString();
    const row = { id: crypto.randomUUID(), title, body, pinned: Boolean(pinned), releaseKey: null, createdAt: at, updatedAt: at };
    this.rows.unshift(row);
    await this.save();
    return { ...row };
  }
  async update(id, title, body, pinned = false) {
    const row = this.rows.find(item => item.id === id);
    if (!row) return null;
    Object.assign(row, { title, body, pinned: Boolean(pinned), updatedAt: new Date().toISOString() });
    await this.save();
    return { ...row };
  }
  async remove(id) {
    const index = this.rows.findIndex(item => item.id === id);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    await this.save();
    return true;
  }
  async seedReleases(releases) {
    let changed = false;
    for (const release of releases) {
      const existing = this.rows.find(row => row.releaseKey === release.key
        || String(row.title).toLowerCase().includes(release.key.toLowerCase() + ' '));
      if (existing) {
        if (!existing.releaseKey) { existing.releaseKey = release.key; changed = true; }
        else if (existing.title !== release.title || existing.body !== release.body || existing.createdAt !== release.publishedAt) {
          Object.assign(existing, { title: release.title, body: release.body, createdAt: release.publishedAt });
          changed = true;
        }
        continue;
      }
      this.rows.push({ id: crypto.randomUUID(), title: release.title, body: release.body, pinned: false,
        releaseKey: release.key, createdAt: release.publishedAt, updatedAt: release.publishedAt });
      changed = true;
    }
    const nickname = this.rows.filter(row => /닉네임.*변경.*안내/.test(row.title))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
    if (nickname && !nickname.pinned) { nickname.pinned = true; nickname.updatedAt = new Date().toISOString(); changed = true; }
    if (changed) await this.save();
    return changed;
  }
}

class PostgresAnnouncementStore {
  constructor(connectionString) {
    const { Pool } = require('pg');
    const useSsl = !/localhost|127\.0\.0\.1|\.internal(?::|\/|$)/i.test(connectionString);
    this.pool = new Pool({ connectionString, ssl: useSsl ? { rejectUnauthorized: false } : false, max: 2 });
  }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS announcements (
      id uuid PRIMARY KEY,
      title text NOT NULL,
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await this.pool.query('ALTER TABLE announcements ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false');
    await this.pool.query('ALTER TABLE announcements ADD COLUMN IF NOT EXISTS release_key text');
    await this.pool.query('CREATE UNIQUE INDEX IF NOT EXISTS announcements_release_key_idx ON announcements(release_key) WHERE release_key IS NOT NULL');
  }
  async list() {
    const result = await this.pool.query('SELECT id, title, body, pinned, release_key, created_at, updated_at FROM announcements ORDER BY pinned DESC, created_at DESC LIMIT 50');
    return result.rows.map(map);
  }
  async create(title, body, pinned = false) {
    const result = await this.pool.query('INSERT INTO announcements(id,title,body,pinned) VALUES ($1,$2,$3,$4) RETURNING *', [crypto.randomUUID(), title, body, Boolean(pinned)]);
    return map(result.rows[0]);
  }
  async update(id, title, body, pinned = false) {
    const result = await this.pool.query('UPDATE announcements SET title=$2,body=$3,pinned=$4,updated_at=now() WHERE id=$1 RETURNING *', [id, title, body, Boolean(pinned)]);
    return map(result.rows[0]);
  }
  async remove(id) {
    const result = await this.pool.query('DELETE FROM announcements WHERE id=$1 RETURNING id', [id]);
    return result.rowCount > 0;
  }
  async seedReleases(releases) {
    for (const release of releases) {
      const existing = await this.pool.query(`SELECT id, release_key FROM announcements
        WHERE release_key=$1 OR lower(title) LIKE $2 ORDER BY created_at DESC LIMIT 1`,
      [release.key, `%${release.key.toLowerCase()} %`]);
      if (existing.rowCount) {
        if (!existing.rows[0].release_key) await this.pool.query('UPDATE announcements SET release_key=$2 WHERE id=$1', [existing.rows[0].id, release.key]);
        else await this.pool.query('UPDATE announcements SET title=$2,body=$3,created_at=$4 WHERE id=$1',
          [existing.rows[0].id, release.title, release.body, release.publishedAt]);
        continue;
      }
      await this.pool.query(`INSERT INTO announcements(id,title,body,pinned,release_key,created_at,updated_at)
        VALUES ($1,$2,$3,false,$4,$5,$5) ON CONFLICT DO NOTHING`,
      [crypto.randomUUID(), release.title, release.body, release.key, release.publishedAt]);
    }
    await this.pool.query(`UPDATE announcements SET pinned=true, updated_at=now()
      WHERE id=(SELECT id FROM announcements WHERE title LIKE '%닉네임%변경%안내%'
        ORDER BY created_at DESC LIMIT 1)`);
    return true;
  }
}

async function createAnnouncementStore({ dataDir, databaseUrl }) {
  if (databaseUrl) {
    const store = new PostgresAnnouncementStore(databaseUrl);
    try {
      await store.init();
      console.log('공지사항 저장소: PostgreSQL');
      return store;
    } catch (err) {
      await store.pool.end().catch(() => {});
      console.error('공지사항 PostgreSQL 연결 실패, 로컬 JSON으로 전환:', err.message);
    }
  }
  const store = new JsonAnnouncementStore(path.join(dataDir, 'announcements.json'));
  await store.init();
  console.log('공지사항 저장소: 로컬 JSON');
  return store;
}

module.exports = { createAnnouncementStore, JsonAnnouncementStore, PostgresAnnouncementStore };
