'use strict';
// 잿빛 원정 원정 저장소. 다른 저장소와 달리 DATABASE_URL이 있으면 PostgreSQL만 쓰고 JSON으로 대체하지 않는다.
// (운영에서 저장이 조용히 로컬 파일로 새면 재배포 때 원정이 사라지므로, 실패는 호출자가 일시정지로 다룬다.)
//
// 행 하나 = (runId, slot). slot 'auto'와 'manual'은 서로 덮어쓰지 않는다.
// save는 seq가 저장된 값보다 클 때만 반영하므로 같은 요청을 다시 보내도 안전하다(멱등).
// lease는 원정 하나를 한 번에 한 방만 이어받게 하는 잠금이다(holder = 방 id, 만료 시간 있음).
const fs = require('node:fs/promises');
const path = require('node:path');

const SLOTS = ['auto', 'manual'];

class JsonRpgStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.saves = {}; // `${runId}:${slot}` -> row
    this.leases = {}; // runId -> { holder, expiresAt }
    this.queue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const loaded = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.saves = loaded.saves || {};
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }
  persist() {
    const json = JSON.stringify({ saves: this.saves });
    this.queue = this.queue.then(async () => {
      const tmp = `${this.filePath}.tmp`;
      await fs.writeFile(tmp, json, 'utf8');
      await fs.rename(tmp, this.filePath);
    });
    return this.queue;
  }
  async save({ runId, slot, seq, schemaVersion, state, party }) {
    if (!SLOTS.includes(slot)) throw new Error('bad slot');
    const key = `${runId}:${slot}`;
    if (this.saves[key] && this.saves[key].seq >= seq) return { saved: false };
    this.saves[key] = { runId, slot, seq, schemaVersion, state, party, updatedAt: new Date().toISOString() };
    await this.persist();
    return { saved: true };
  }
  async load(runId) {
    return Object.fromEntries(SLOTS.map(slot => [slot, this.saves[`${runId}:${slot}`] || null]));
  }
  // 이 신원이 파티에 속한 원정들, 최근 저장이 먼저.
  async listForIdentity(identity) {
    const byRun = new Map();
    for (const row of Object.values(this.saves)) {
      if (!Object.values(row.party || {}).includes(identity)) continue;
      const meta = { runId: row.runId, slot: row.slot, seq: row.seq, updatedAt: row.updatedAt, party: row.party, schemaVersion: row.schemaVersion };
      const prev = byRun.get(row.runId);
      if (!prev) byRun.set(row.runId, { runId: row.runId, updatedAt: row.updatedAt, slots: { [row.slot]: meta } });
      else { prev.slots[row.slot] = meta; if (row.updatedAt > prev.updatedAt) prev.updatedAt = row.updatedAt; }
    }
    return [...byRun.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async remove(runId) {
    for (const slot of SLOTS) delete this.saves[`${runId}:${slot}`];
    delete this.leases[runId];
    await this.persist();
  }
  async purge(olderThanMs) {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const dead = new Set(Object.values(this.saves).filter(row => row.updatedAt < cutoff).map(row => row.runId));
    for (const runId of dead) await this.remove(runId);
    return dead.size;
  }
  async acquireLease(runId, holder, ttlMs) {
    const cur = this.leases[runId];
    if (cur && cur.holder !== holder && cur.expiresAt > Date.now()) return false;
    this.leases[runId] = { holder, expiresAt: Date.now() + ttlMs };
    return true;
  }
  async releaseLease(runId, holder) {
    if (this.leases[runId]?.holder === holder) delete this.leases[runId];
  }
}

class PostgresRpgStore {
  constructor(connectionString) {
    const { Pool } = require('pg');
    const useSsl = !/localhost|127\.0\.0\.1|\.internal(?::|\/|$)/i.test(connectionString);
    this.pool = new Pool({ connectionString, ssl: useSsl ? { rejectUnauthorized: false } : false, max: 2 });
    this.ready = null;
  }
  // 연결 실패 뒤에도 다음 호출에서 다시 시도한다.
  ensure() {
    if (!this.ready) this.ready = this.init().catch((err) => { this.ready = null; throw err; });
    return this.ready;
  }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS rpg_saves (
      run_id text NOT NULL, slot text NOT NULL, seq integer NOT NULL, schema_version integer NOT NULL,
      state jsonb NOT NULL, party jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (run_id, slot))`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS rpg_leases (
      run_id text PRIMARY KEY, holder text NOT NULL, expires_at timestamptz NOT NULL)`);
  }
  async save({ runId, slot, seq, schemaVersion, state, party }) {
    if (!SLOTS.includes(slot)) throw new Error('bad slot');
    await this.ensure();
    const res = await this.pool.query(`INSERT INTO rpg_saves(run_id, slot, seq, schema_version, state, party, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,now())
      ON CONFLICT (run_id, slot) DO UPDATE SET seq=EXCLUDED.seq, schema_version=EXCLUDED.schema_version,
        state=EXCLUDED.state, party=EXCLUDED.party, updated_at=now()
      WHERE rpg_saves.seq < EXCLUDED.seq`, [runId, slot, seq, schemaVersion, JSON.stringify(state), JSON.stringify(party)]);
    return { saved: res.rowCount > 0 };
  }
  async load(runId) {
    await this.ensure();
    const res = await this.pool.query('SELECT * FROM rpg_saves WHERE run_id=$1', [runId]);
    const out = { auto: null, manual: null };
    for (const r of res.rows) out[r.slot] = { runId: r.run_id, slot: r.slot, seq: r.seq, schemaVersion: r.schema_version, state: r.state, party: r.party, updatedAt: r.updated_at.toISOString() };
    return out;
  }
  async listForIdentity(identity) {
    await this.ensure();
    const res = await this.pool.query(`SELECT run_id, slot, seq, schema_version, party, updated_at FROM rpg_saves
      WHERE EXISTS (SELECT 1 FROM jsonb_each_text(party) e WHERE e.value=$1)
      ORDER BY updated_at DESC`, [identity]);
    const byRun = new Map();
    for (const r of res.rows) {
      const meta = { runId: r.run_id, slot: r.slot, seq: r.seq, updatedAt: r.updated_at.toISOString(), party: r.party, schemaVersion: r.schema_version };
      const prev = byRun.get(r.run_id);
      if (!prev) byRun.set(r.run_id, { runId: r.run_id, updatedAt: meta.updatedAt, slots: { [r.slot]: meta } });
      else { prev.slots[r.slot] = meta; if (meta.updatedAt > prev.updatedAt) prev.updatedAt = meta.updatedAt; }
    }
    return [...byRun.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async remove(runId) {
    await this.ensure();
    await this.pool.query('DELETE FROM rpg_saves WHERE run_id=$1', [runId]);
    await this.pool.query('DELETE FROM rpg_leases WHERE run_id=$1', [runId]);
  }
  async purge(olderThanMs) {
    await this.ensure();
    const res = await this.pool.query(`DELETE FROM rpg_saves WHERE run_id IN
      (SELECT run_id FROM rpg_saves GROUP BY run_id HAVING max(updated_at) < now() - ($1 || ' milliseconds')::interval) RETURNING run_id`, [String(olderThanMs)]);
    return new Set(res.rows.map(r => r.run_id)).size;
  }
  async acquireLease(runId, holder, ttlMs) {
    await this.ensure();
    const res = await this.pool.query(`INSERT INTO rpg_leases(run_id, holder, expires_at)
      VALUES ($1,$2, now() + ($3 || ' milliseconds')::interval)
      ON CONFLICT (run_id) DO UPDATE SET holder=EXCLUDED.holder, expires_at=EXCLUDED.expires_at
      WHERE rpg_leases.holder=EXCLUDED.holder OR rpg_leases.expires_at < now()`, [runId, holder, String(ttlMs)]);
    return res.rowCount > 0;
  }
  async releaseLease(runId, holder) {
    await this.ensure();
    await this.pool.query('DELETE FROM rpg_leases WHERE run_id=$1 AND holder=$2', [runId, holder]);
  }
}

async function createRpgStore({ dataDir, databaseUrl }) {
  if (databaseUrl) {
    const store = new PostgresRpgStore(databaseUrl);
    try { await store.ensure(); console.log('잿빛 원정 저장소: PostgreSQL'); }
    catch (err) { console.error('잿빛 원정 PostgreSQL 연결 실패(JSON으로 대체하지 않고 원정 저장을 일시정지로 처리):', err.message); }
    return store;
  }
  const store = new JsonRpgStore(path.join(dataDir, 'rpg-saves.json'));
  await store.init();
  console.log('잿빛 원정 저장소: 로컬 JSON');
  return store;
}

module.exports = { createRpgStore, JsonRpgStore, PostgresRpgStore };
