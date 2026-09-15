const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

function nowIso() { return new Date().toISOString(); }
function hashToken(token) { return crypto.createHash('sha256').update(String(token)).digest('hex'); }

class JsonAccessStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { keys: [] };
    this.saveQueue = Promise.resolve();
  }

  async init() {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.data = JSON.parse(await fsp.readFile(this.filePath, 'utf8'));
      if (!Array.isArray(this.data.keys)) this.data = { keys: [] };
    } catch (err) {
      if (err.code !== 'ENOENT') console.error('입장키 데이터 로드 실패:', err);
      this.data = { keys: [] };
      await this.#save();
    }
  }

  async #save() {
    const snapshot = JSON.stringify(this.data, null, 2);
    this.saveQueue = this.saveQueue.then(async () => {
      const temp = `${this.filePath}.tmp`;
      await fsp.writeFile(temp, snapshot, 'utf8');
      await fsp.rename(temp, this.filePath);
    });
    return this.saveQueue;
  }

  async create(label, token) {
    const row = {
      id: crypto.randomUUID(),
      label,
      tokenHash: hashToken(token),
      createdAt: nowIso(),
      lastUsedAt: null,
      useCount: 0,
      revokedAt: null,
    };
    this.data.keys.unshift(row);
    await this.#save();
    return { ...row };
  }

  async list() {
    return this.data.keys.map(({ tokenHash, ...rest }) => ({ ...rest }));
  }

  async validateAndRecord(token) {
    const tokenHash = hashToken(token);
    const row = this.data.keys.find((k) => k.tokenHash === tokenHash && !k.revokedAt);
    if (!row) return null;
    row.useCount = Number(row.useCount || 0) + 1;
    row.lastUsedAt = nowIso();
    await this.#save();
    const { tokenHash: _, ...publicRow } = row;
    return { ...publicRow };
  }

  async revoke(id) {
    const row = this.data.keys.find((k) => k.id === id);
    if (!row) return null;
    if (!row.revokedAt) row.revokedAt = nowIso();
    await this.#save();
    const { tokenHash, ...publicRow } = row;
    return { ...publicRow };
  }
}

class PostgresAccessStore {
  constructor(connectionString) {
    const { Pool } = require('pg');
    const useSsl = !/localhost|127\.0\.0\.1|\.internal(?::|\/|$)/i.test(connectionString);
    this.pool = new Pool({
      connectionString,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 3,
    });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS guest_access_keys (
        id uuid PRIMARY KEY,
        label text NOT NULL,
        token_hash text UNIQUE NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_used_at timestamptz,
        use_count integer NOT NULL DEFAULT 0,
        revoked_at timestamptz
      )
    `);
  }

  #map(row) {
    if (!row) return null;
    return {
      id: row.id,
      label: row.label,
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      lastUsedAt: row.last_used_at?.toISOString?.() || row.last_used_at || null,
      useCount: Number(row.use_count || 0),
      revokedAt: row.revoked_at?.toISOString?.() || row.revoked_at || null,
    };
  }

  async create(label, token) {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO guest_access_keys (id, label, token_hash)
       VALUES ($1, $2, $3)
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at`,
      [id, label, hashToken(token)]
    );
    return this.#map(result.rows[0]);
  }

  async list() {
    const result = await this.pool.query(
      `SELECT id, label, created_at, last_used_at, use_count, revoked_at
       FROM guest_access_keys
       ORDER BY created_at DESC`
    );
    return result.rows.map((r) => this.#map(r));
  }

  async validateAndRecord(token) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys
       SET use_count = use_count + 1, last_used_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at`,
      [hashToken(token)]
    );
    return this.#map(result.rows[0]);
  }

  async revoke(id) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE id = $1
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at`,
      [id]
    );
    return this.#map(result.rows[0]);
  }
}

async function createAccessStore({ dataDir, databaseUrl }) {
  let store;
  if (databaseUrl) {
    store = new PostgresAccessStore(databaseUrl);
    try {
      await store.init();
      console.log('입장키 저장소: PostgreSQL');
      return store;
    } catch (err) {
      console.error('PostgreSQL 연결 실패. 로컬 JSON 저장소로 전환:', err.message);
    }
  }
  store = new JsonAccessStore(path.join(dataDir, 'access-keys.json'));
  await store.init();
  console.log('입장키 저장소: 로컬 JSON');
  return store;
}

module.exports = { createAccessStore, hashToken };
