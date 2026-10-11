const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

function nowIso() { return new Date().toISOString(); }
function hashToken(token) { return crypto.createHash('sha256').update(String(token)).digest('hex'); }

// v1.10.63 아이디·비밀번호 로그인 (IDEAS 2026-10-11): the login id is kept lower-case (ids differing only in case are one
// id); the password only as a salted scrypt hash. A sign-up waiting for the administrator is a row of the same table
// with pendingAt set, so one unique login id covers accounts and applications alike; a pending row is no account (its
// token hash is a random value no file holds, and list/validate leave it out).
const normalizeLoginId = (id) => String(id || '').trim().toLowerCase();
const loginIdOk = (id) => /^[a-z0-9_]{4,20}$/.test(id);
const scrypt = (password, salt) => new Promise((resolve, reject) => crypto.scrypt(String(password), salt, 64, (err, key) => (err ? reject(err) : resolve(key))));
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${(await scrypt(password, salt)).toString('hex')}`;
}
async function verifyPassword(password, stored) {
  const [kind, salt, hash] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !hash) return false;
  const want = Buffer.from(hash, 'hex'); const got = await scrypt(password, Buffer.from(salt, 'hex'));
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}
const publicOf = ({ tokenHash, passwordHash, ...rest }) => ({ ...rest, adminNote: rest.adminNote || '', loginId: rest.loginId || null, realName: rest.realName || '' });

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
      adminNote: '',
    };
    this.data.keys.unshift(row);
    await this.#save();
    return { ...row };
  }

  async list() {
    return this.data.keys.filter((k) => !k.pendingAt).map(publicOf);
  }

  // --- 아이디·비밀번호 (v1.10.63) ---
  async listPending() { return this.data.keys.filter((k) => k.pendingAt).map(publicOf); }
  async get(id) { const row = this.data.keys.find((k) => k.id === id); return row ? publicOf(row) : null; }
  async findLogin(loginId) { // with the password hash: for checking a login only
    const row = this.data.keys.find((k) => k.loginId && k.loginId === normalizeLoginId(loginId));
    return row ? { ...publicOf(row), passwordHash: row.passwordHash } : null;
  }
  async loginTaken(loginId) { return this.data.keys.some((k) => k.loginId === normalizeLoginId(loginId)); }
  async requestSignup({ realName, loginId, passwordHash, label }) {
    if (await this.loginTaken(loginId)) return null; // (no await between this check and the push below in effect: one process)
    const row = { id: crypto.randomUUID(), label, tokenHash: hashToken(crypto.randomUUID()), createdAt: nowIso(), lastUsedAt: null, useCount: 0, revokedAt: null, adminNote: '',
      loginId: normalizeLoginId(loginId), passwordHash, realName, pendingAt: nowIso() };
    if (this.data.keys.some((k) => k.loginId === row.loginId)) return null;
    this.data.keys.unshift(row);
    await this.#save();
    return publicOf(row);
  }
  async approve(id) {
    const row = this.data.keys.find((k) => k.id === id && k.pendingAt);
    if (!row) return null;
    row.pendingAt = null; row.createdAt = nowIso();
    await this.#save();
    return publicOf(row);
  }
  async rejectPending(id) {
    const index = this.data.keys.findIndex((k) => k.id === id && k.pendingAt);
    if (index < 0) return null;
    const [row] = this.data.keys.splice(index, 1);
    await this.#save();
    return publicOf(row);
  }
  // a file user's first login id: only while the account has none (false: the id is taken)
  async setLogin(id, loginId, passwordHash) {
    const row = this.data.keys.find((k) => k.id === id && !k.pendingAt && !k.revokedAt);
    if (!row || row.loginId) return null;
    const wanted = normalizeLoginId(loginId);
    if (this.data.keys.some((k) => k.loginId === wanted)) return false;
    row.loginId = wanted; row.passwordHash = passwordHash;
    await this.#save();
    return publicOf(row);
  }
  async setPassword(id, passwordHash) {
    const row = this.data.keys.find((k) => k.id === id && k.loginId && !k.pendingAt);
    if (!row) return null;
    row.passwordHash = passwordHash;
    await this.#save();
    return publicOf(row);
  }
  async recordUse(id) {
    const row = this.data.keys.find((k) => k.id === id && !k.revokedAt && !k.pendingAt);
    if (!row) return null;
    row.useCount = Number(row.useCount || 0) + 1; row.lastUsedAt = nowIso();
    await this.#save();
    return publicOf(row);
  }

  async validateAndRecord(token) {
    const tokenHash = hashToken(token);
    const row = this.data.keys.find((k) => k.tokenHash === tokenHash && !k.revokedAt && !k.pendingAt);
    if (!row) return null;
    row.useCount = Number(row.useCount || 0) + 1;
    row.lastUsedAt = nowIso();
    await this.#save();
    return publicOf(row);
  }

  async rotateToken(id, token) {
    const row = this.data.keys.find((key) => key.id === id && !key.revokedAt && !key.pendingAt);
    if (!row) return null;
    const previousHash = row.tokenHash;
    row.tokenHash = hashToken(token);
    try {
      await this.#save();
    } catch (err) {
      row.tokenHash = previousHash;
      throw err;
    }
    return publicOf(row);
  }

  // Change the display name and access credential as one persisted operation.
  async renameAndRotateToken(id, label, token) {
    const row = this.data.keys.find((key) => key.id === id && !key.revokedAt && !key.pendingAt);
    if (!row) return null;
    const previousLabel = row.label;
    const previousHash = row.tokenHash;
    row.label = label;
    row.tokenHash = hashToken(token);
    try {
      await this.#save();
    } catch (err) {
      row.label = previousLabel;
      row.tokenHash = previousHash;
      throw err;
    }
    return publicOf(row);
  }

  // v1.10.9 작명소: a new display name chosen by the player (the entry file and its credential stay the same).
  async rename(id, label) {
    const row = this.data.keys.find((key) => key.id === id && !key.revokedAt && !key.pendingAt);
    if (!row) return null;
    const previousLabel = row.label;
    row.label = label;
    try {
      await this.#save();
    } catch (err) {
      row.label = previousLabel;
      throw err;
    }
    return publicOf(row);
  }

  async setNote(id, note) {
    const row = this.data.keys.find((k) => k.id === id);
    if (!row) return null;
    row.adminNote = note;
    await this.#save();
    return publicOf(row);
  }

  async revoke(id) {
    const row = this.data.keys.find((k) => k.id === id);
    if (!row) return null;
    if (!row.revokedAt) row.revokedAt = nowIso();
    await this.#save();
    return publicOf(row);
  }

  async restore(id) {
    const row = this.data.keys.find((k) => k.id === id);
    if (!row) return null;
    row.revokedAt = null;
    await this.#save();
    return publicOf(row);
  }

  async remove(id) {
    const index = this.data.keys.findIndex((k) => k.id === id);
    if (index < 0) return null;
    const [row] = this.data.keys.splice(index, 1);
    await this.#save();
    return publicOf(row);
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
    await this.pool.query("ALTER TABLE guest_access_keys ADD COLUMN IF NOT EXISTS admin_note text NOT NULL DEFAULT ''");
    // v1.10.63 아이디·비밀번호: login_id is stored lower-case; unique over accounts and pending sign-ups together
    await this.pool.query(`ALTER TABLE guest_access_keys ADD COLUMN IF NOT EXISTS login_id text,
      ADD COLUMN IF NOT EXISTS password_hash text, ADD COLUMN IF NOT EXISTS real_name text NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS pending_at timestamptz`);
    await this.pool.query('CREATE UNIQUE INDEX IF NOT EXISTS guest_access_keys_login_id ON guest_access_keys (login_id) WHERE login_id IS NOT NULL');
  }

  #map(row) {
    if (!row) return null;
    return {
      id: row.id,
      label: row.label,
      adminNote: row.admin_note || '',
      createdAt: row.created_at?.toISOString?.() || row.created_at,
      lastUsedAt: row.last_used_at?.toISOString?.() || row.last_used_at || null,
      useCount: Number(row.use_count || 0),
      revokedAt: row.revoked_at?.toISOString?.() || row.revoked_at || null,
      loginId: row.login_id || null,
      realName: row.real_name || '',
      pendingAt: row.pending_at?.toISOString?.() || row.pending_at || null,
    };
  }

  // --- 아이디·비밀번호 (v1.10.63) ---
  async listPending() {
    const result = await this.pool.query(`SELECT id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at FROM guest_access_keys WHERE pending_at IS NOT NULL ORDER BY pending_at`);
    return result.rows.map((r) => this.#map(r));
  }
  async get(id) {
    const result = await this.pool.query(`SELECT id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at FROM guest_access_keys WHERE id = $1`, [id]);
    return this.#map(result.rows[0]);
  }
  async findLogin(loginId) {
    const result = await this.pool.query(`SELECT id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at, password_hash FROM guest_access_keys WHERE login_id = $1`, [normalizeLoginId(loginId)]);
    const row = result.rows[0];
    return row ? { ...this.#map(row), passwordHash: row.password_hash } : null;
  }
  async loginTaken(loginId) {
    const result = await this.pool.query('SELECT 1 FROM guest_access_keys WHERE login_id = $1', [normalizeLoginId(loginId)]);
    return result.rowCount > 0;
  }
  async requestSignup({ realName, loginId, passwordHash, label }) {
    try {
      const result = await this.pool.query(
        `INSERT INTO guest_access_keys (id, label, token_hash, login_id, password_hash, real_name, pending_at)
         VALUES ($1, $2, $3, $4, $5, $6, now()) RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
        [crypto.randomUUID(), label, hashToken(crypto.randomUUID()), normalizeLoginId(loginId), passwordHash, realName]
      );
      return this.#map(result.rows[0]);
    } catch (err) { if (err.code === '23505') return null; throw err; } // the id was taken in the meantime
  }
  async approve(id) {
    const result = await this.pool.query(`UPDATE guest_access_keys SET pending_at = NULL, created_at = now() WHERE id = $1 AND pending_at IS NOT NULL RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`, [id]);
    return this.#map(result.rows[0]);
  }
  async rejectPending(id) {
    const result = await this.pool.query(`DELETE FROM guest_access_keys WHERE id = $1 AND pending_at IS NOT NULL RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`, [id]);
    return this.#map(result.rows[0]);
  }
  async setLogin(id, loginId, passwordHash) {
    try {
      const result = await this.pool.query(
        `UPDATE guest_access_keys SET login_id = $2, password_hash = $3
         WHERE id = $1 AND login_id IS NULL AND pending_at IS NULL AND revoked_at IS NULL RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
        [id, normalizeLoginId(loginId), passwordHash]
      );
      return this.#map(result.rows[0]);
    } catch (err) { if (err.code === '23505') return false; throw err; }
  }
  async setPassword(id, passwordHash) {
    const result = await this.pool.query(`UPDATE guest_access_keys SET password_hash = $2 WHERE id = $1 AND login_id IS NOT NULL AND pending_at IS NULL RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`, [id, passwordHash]);
    return this.#map(result.rows[0]);
  }
  async recordUse(id) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys SET use_count = use_count + 1, last_used_at = now()
       WHERE id = $1 AND revoked_at IS NULL AND pending_at IS NULL RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`, [id]);
    return this.#map(result.rows[0]);
  }

  async create(label, token) {
    const id = crypto.randomUUID();
    const result = await this.pool.query(
      `INSERT INTO guest_access_keys (id, label, token_hash)
       VALUES ($1, $2, $3)
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
      [id, label, hashToken(token)]
    );
    return this.#map(result.rows[0]);
  }

  async list() {
    const result = await this.pool.query(
      `SELECT id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at
       FROM guest_access_keys WHERE pending_at IS NULL
       ORDER BY created_at DESC`
    );
    return result.rows.map((r) => this.#map(r));
  }

  async validateAndRecord(token) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys
       SET use_count = use_count + 1, last_used_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL AND pending_at IS NULL
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
      [hashToken(token)]
    );
    return this.#map(result.rows[0]);
  }

  async rotateToken(id, token) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys SET token_hash = $2
       WHERE id = $1 AND revoked_at IS NULL AND pending_at IS NULL
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
      [id, hashToken(token)]
    );
    return this.#map(result.rows[0]);
  }

  async rename(id, label) { // v1.10.9 작명소
    const result = await this.pool.query(
      `UPDATE guest_access_keys SET label = $2 WHERE id = $1 AND revoked_at IS NULL AND pending_at IS NULL
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
      [id, label]
    );
    return this.#map(result.rows[0]);
  }

  // One SQL UPDATE prevents a changed nickname from being persisted with the old entry secret.
  async renameAndRotateToken(id, label, token) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys SET label = $2, token_hash = $3
       WHERE id = $1 AND revoked_at IS NULL AND pending_at IS NULL
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
      [id, label, hashToken(token)]
    );
    return this.#map(result.rows[0]);
  }

  async setNote(id, note) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys SET admin_note = $2 WHERE id = $1
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
      [id, note]
    );
    return this.#map(result.rows[0]);
  }

  async revoke(id) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys
       SET revoked_at = COALESCE(revoked_at, now())
       WHERE id = $1
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
      [id]
    );
    return this.#map(result.rows[0]);
  }

  async restore(id) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys SET revoked_at = NULL WHERE id = $1
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
      [id]
    );
    return this.#map(result.rows[0]);
  }

  async remove(id) {
    const result = await this.pool.query(
      `DELETE FROM guest_access_keys WHERE id = $1
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note, login_id, real_name, pending_at`,
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

module.exports = { createAccessStore, hashToken, hashPassword, verifyPassword, normalizeLoginId, loginIdOk, JsonAccessStore, PostgresAccessStore };
