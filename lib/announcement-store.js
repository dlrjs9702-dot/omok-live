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
      this.rows = Array.isArray(loaded) ? loaded : [];
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
  async list() { return this.rows.slice(0, 50).map(row => ({ ...row })); }
  async create(title, body) {
    const at = new Date().toISOString();
    const row = { id: crypto.randomUUID(), title, body, createdAt: at, updatedAt: at };
    this.rows.unshift(row);
    await this.save();
    return { ...row };
  }
  async update(id, title, body) {
    const row = this.rows.find(item => item.id === id);
    if (!row) return null;
    Object.assign(row, { title, body, updatedAt: new Date().toISOString() });
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
  }
  async list() {
    const result = await this.pool.query('SELECT id, title, body, created_at, updated_at FROM announcements ORDER BY created_at DESC LIMIT 50');
    return result.rows.map(map);
  }
  async create(title, body) {
    const result = await this.pool.query('INSERT INTO announcements(id,title,body) VALUES ($1,$2,$3) RETURNING *', [crypto.randomUUID(), title, body]);
    return map(result.rows[0]);
  }
  async update(id, title, body) {
    const result = await this.pool.query('UPDATE announcements SET title=$2,body=$3,updated_at=now() WHERE id=$1 RETURNING *', [id, title, body]);
    return map(result.rows[0]);
  }
  async remove(id) {
    const result = await this.pool.query('DELETE FROM announcements WHERE id=$1 RETURNING id', [id]);
    return result.rowCount > 0;
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
