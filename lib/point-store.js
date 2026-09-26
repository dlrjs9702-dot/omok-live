'use strict';

// Game Center points: an in-game virtual currency only (never bought, sold, cashed out or sent
// between users). Every balance change is a ledger row carrying balance before/after, and every
// grant or settlement carries an idempotency key, so a retried request, a duplicate SSE-triggered
// finish or two tabs claiming attendance at once can never move points twice. Balances never go
// below zero: a loser pays at most what they hold and the winner receives exactly what was paid.

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const INITIAL_GRANT = 100_000;
const DAILY_ATTENDANCE = 50_000;
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000; // Asia/Seoul has no DST

function kstDate(now = Date.now()) {
  return new Date(Number(now) + SEOUL_OFFSET_MS).toISOString().slice(0, 10);
}

function validUserId(userId) {
  return typeof userId === 'string' && /^(guest:[0-9a-f-]{36}|admin)$/i.test(userId);
}

function assertUser(userId) {
  if (!validUserId(userId)) throw new TypeError('Invalid point account');
}

function validateSettlement(raw) {
  if (!raw || typeof raw.settlementId !== 'string' || !raw.settlementId || raw.settlementId.length > 200) throw new TypeError('Invalid settlement id');
  if (typeof raw.gameType !== 'string' || !/^[a-z0-9]+$/.test(raw.gameType)) throw new TypeError('Invalid settlement game');
  if (!Array.isArray(raw.transfers)) throw new TypeError('Invalid settlement transfers');
  const transfers = raw.transfers.map((item) => {
    assertUser(item?.from); assertUser(item?.to);
    const amount = Number(item.amount);
    if (!Number.isSafeInteger(amount) || amount < 0) throw new TypeError('Invalid settlement amount');
    if (item.from === item.to) throw new TypeError('Self transfer');
    return { from: item.from, to: item.to, amount, key: item.key ? String(item.key).slice(0, 80) : null };
  });
  return { settlementId: raw.settlementId, matchId: raw.matchId ? String(raw.matchId).slice(0, 200) : null, gameType: raw.gameType, transfers };
}

// Pure: applies each requested transfer in order against the payer's remaining balance.
function capTransfers(transfers, balances) {
  const remaining = new Map(Object.entries(balances).map(([id, value]) => [id, Number(value) || 0]));
  return transfers.map((item) => {
    const available = remaining.get(item.from) || 0;
    const paid = Math.max(0, Math.min(item.amount, available));
    remaining.set(item.from, available - paid);
    remaining.set(item.to, (remaining.get(item.to) || 0) + paid);
    return { ...item, requested: item.amount, paid, capped: paid < item.amount };
  });
}

function ledgerRow({ userId, before, delta, reason, matchId = null, gameType = null, settlementId = null, key = null, at }) {
  return { id: crypto.randomUUID(), userId, at, balanceBefore: before, delta, balanceAfter: before + delta,
    reason, matchId, gameType, settlementId, idempotencyKey: key };
}

class JsonPointStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { accounts: {}, ledger: [], keys: {}, settlements: {} };
    this.queue = Promise.resolve();
    this.cache = new Map();
  }

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (!data || typeof data.accounts !== 'object' || !Array.isArray(data.ledger)) throw new Error('포인트 저장소 형식이 올바르지 않습니다.');
      this.data = { accounts: data.accounts, ledger: data.ledger, keys: data.keys || {}, settlements: data.settlements || {} };
    } catch (error) {
      if (error.code !== 'ENOENT') throw error; // never silently reset balances
      await fs.writeFile(this.filePath, JSON.stringify(this.data), { flag: 'wx', mode: 0o600 });
    }
    for (const [id, account] of Object.entries(this.data.accounts)) this.cache.set(id, account.balance);
  }

  // One mutation at a time, persisted (temp file + rename) before it is visible in memory.
  #mutate(fn) {
    const run = this.queue.catch(() => {}).then(async () => {
      const draft = structuredClone(this.data);
      const result = fn(draft, new Date().toISOString());
      if (result?.changed === false) return result.value;
      const temp = `${this.filePath}.${process.pid}.tmp`;
      try {
        await fs.writeFile(temp, JSON.stringify(draft), { mode: 0o600 });
        await fs.rename(temp, this.filePath);
      } catch (error) {
        await fs.rm(temp, { force: true }).catch(() => {});
        throw error;
      }
      this.data = draft;
      for (const [id, account] of Object.entries(draft.accounts)) this.cache.set(id, account.balance);
      return result.value;
    });
    this.queue = run;
    return run;
  }

  #ensure(draft, userId, at) {
    if (draft.accounts[userId]) return false;
    draft.accounts[userId] = { balance: INITIAL_GRANT, createdAt: at, updatedAt: at };
    const key = `initial:${userId}`;
    draft.keys[key] = true;
    draft.ledger.push(ledgerRow({ userId, before: 0, delta: INITIAL_GRANT, reason: 'initial_grant', key, at }));
    return true;
  }

  async ensureAccount(userId) {
    assertUser(userId);
    if (this.data.accounts[userId]) return { balance: this.data.accounts[userId].balance, created: false };
    return this.#mutate((draft, at) => {
      const created = this.#ensure(draft, userId, at);
      return { changed: created, value: { balance: draft.accounts[userId].balance, created } };
    });
  }

  async getAccount(userId, now = Date.now()) {
    const { balance } = await this.ensureAccount(userId);
    await this.queue.catch(() => {});
    const date = kstDate(now);
    return { balance: this.data.accounts[userId]?.balance ?? balance, attendance: { date, claimed: Boolean(this.data.keys[`attendance:${userId}:${date}`]) } };
  }

  async claimAttendance(userId, now = Date.now()) {
    assertUser(userId);
    const date = kstDate(now);
    const key = `attendance:${userId}:${date}`;
    return this.#mutate((draft, at) => {
      const created = this.#ensure(draft, userId, at);
      if (draft.keys[key]) return { changed: created, value: { granted: false, balance: draft.accounts[userId].balance, date } };
      const account = draft.accounts[userId];
      draft.ledger.push(ledgerRow({ userId, before: account.balance, delta: DAILY_ATTENDANCE, reason: 'daily_attendance', key, at }));
      account.balance += DAILY_ATTENDANCE;
      account.updatedAt = at;
      draft.keys[key] = true;
      return { value: { granted: true, amount: DAILY_ATTENDANCE, balance: account.balance, date } };
    });
  }

  async settle(raw) {
    const plan = validateSettlement(raw);
    return this.#mutate((draft, at) => {
      if (draft.settlements[plan.settlementId]) return { changed: false, value: { applied: false, ...draft.settlements[plan.settlementId] } };
      for (const item of plan.transfers) { this.#ensure(draft, item.from, at); this.#ensure(draft, item.to, at); }
      const balances = Object.fromEntries(Object.entries(draft.accounts).map(([id, a]) => [id, a.balance]));
      const results = capTransfers(plan.transfers, balances);
      for (const item of results) {
        if (!item.paid) continue;
        for (const [userId, delta, reason] of [[item.from, -item.paid, 'game_loss'], [item.to, item.paid, 'game_win']]) {
          const account = draft.accounts[userId];
          draft.ledger.push(ledgerRow({ userId, before: account.balance, delta, reason, matchId: plan.matchId, gameType: plan.gameType, settlementId: plan.settlementId, at }));
          account.balance += delta;
          account.updatedAt = at;
        }
      }
      const record = { settlementId: plan.settlementId, matchId: plan.matchId, gameType: plan.gameType, at, transfers: results,
        balances: Object.fromEntries([...new Set(results.flatMap(item => [item.from, item.to]))].map(id => [id, draft.accounts[id].balance])) };
      draft.settlements[plan.settlementId] = record;
      return { value: { applied: true, ...record } };
    });
  }

  cachedBalance(userId) { return this.cache.has(userId) ? this.cache.get(userId) : null; }

  async ledger(userId, limit = 50) {
    await this.queue.catch(() => {});
    return this.data.ledger.filter(row => row.userId === userId).slice(-limit).reverse();
  }
}

class PostgresPointStore {
  constructor(connectionString) {
    const { Pool } = require('pg');
    const ssl = !/localhost|127\.0\.0\.1|\.internal(?::|\/|$)/i.test(connectionString);
    this.pool = new Pool({ connectionString, ssl: ssl ? { rejectUnauthorized: false } : false, max: 3 });
    this.cache = new Map();
  }

  // Additive, idempotent migration: new tables only; nothing existing is altered or dropped.
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS point_accounts (
      user_id text PRIMARY KEY,
      balance bigint NOT NULL CHECK (balance >= 0),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    await this.pool.query(`CREATE TABLE IF NOT EXISTS point_ledger (
      id uuid PRIMARY KEY,
      user_id text NOT NULL REFERENCES point_accounts(user_id),
      created_at timestamptz NOT NULL DEFAULT now(),
      balance_before bigint NOT NULL CHECK (balance_before >= 0),
      delta bigint NOT NULL,
      balance_after bigint NOT NULL CHECK (balance_after >= 0),
      reason text NOT NULL,
      match_id text,
      game_type text,
      settlement_id text,
      idempotency_key text UNIQUE,
      CHECK (balance_after = balance_before + delta)
    )`);
    await this.pool.query('CREATE INDEX IF NOT EXISTS point_ledger_user_idx ON point_ledger (user_id, created_at)');
    await this.pool.query(`CREATE TABLE IF NOT EXISTS point_settlements (
      settlement_id text PRIMARY KEY,
      match_id text,
      game_type text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      result jsonb NOT NULL
    )`);
  }

  async #tx(fn) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const value = await fn(client);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async #ensure(client, userId) {
    const inserted = await client.query(`INSERT INTO point_accounts (user_id, balance) VALUES ($1, $2)
      ON CONFLICT (user_id) DO NOTHING RETURNING balance`, [userId, INITIAL_GRANT]);
    if (inserted.rowCount === 1) {
      await client.query(`INSERT INTO point_ledger (id, user_id, balance_before, delta, balance_after, reason, idempotency_key)
        VALUES ($1, $2, 0, $3, $3, 'initial_grant', $4)`, [crypto.randomUUID(), userId, INITIAL_GRANT, `initial:${userId}`]);
      return true;
    }
    return false;
  }

  async #lockBalances(client, ids) {
    const rows = await client.query('SELECT user_id, balance FROM point_accounts WHERE user_id = ANY($1::text[]) ORDER BY user_id FOR UPDATE', [ids]);
    return Object.fromEntries(rows.rows.map(row => [row.user_id, Number(row.balance)]));
  }

  async ensureAccount(userId) {
    assertUser(userId);
    return this.#tx(async (client) => {
      const created = await this.#ensure(client, userId);
      const balance = (await this.#lockBalances(client, [userId]))[userId];
      this.cache.set(userId, balance);
      return { balance, created };
    });
  }

  async getAccount(userId, now = Date.now()) {
    const { balance } = await this.ensureAccount(userId);
    const date = kstDate(now);
    const claimed = await this.pool.query('SELECT 1 FROM point_ledger WHERE idempotency_key = $1', [`attendance:${userId}:${date}`]);
    return { balance, attendance: { date, claimed: claimed.rowCount === 1 } };
  }

  async claimAttendance(userId, now = Date.now()) {
    assertUser(userId);
    const date = kstDate(now);
    const key = `attendance:${userId}:${date}`;
    return this.#tx(async (client) => {
      await this.#ensure(client, userId);
      const balance = (await this.#lockBalances(client, [userId]))[userId];
      const exists = await client.query('SELECT 1 FROM point_ledger WHERE idempotency_key = $1', [key]);
      if (exists.rowCount) { this.cache.set(userId, balance); return { granted: false, balance, date }; }
      await client.query(`INSERT INTO point_ledger (id, user_id, balance_before, delta, balance_after, reason, idempotency_key)
        VALUES ($1, $2, $3, $4, $5, 'daily_attendance', $6)`, [crypto.randomUUID(), userId, balance, DAILY_ATTENDANCE, balance + DAILY_ATTENDANCE, key]);
      await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [userId, balance + DAILY_ATTENDANCE]);
      this.cache.set(userId, balance + DAILY_ATTENDANCE);
      return { granted: true, amount: DAILY_ATTENDANCE, balance: balance + DAILY_ATTENDANCE, date };
    });
  }

  async settle(raw) {
    const plan = validateSettlement(raw);
    return this.#tx(async (client) => {
      // Claim the settlement id first: a concurrent duplicate blocks here, then sees the row.
      const claim = await client.query(`INSERT INTO point_settlements (settlement_id, match_id, game_type, result)
        VALUES ($1, $2, $3, '{}'::jsonb) ON CONFLICT (settlement_id) DO NOTHING RETURNING settlement_id`, [plan.settlementId, plan.matchId, plan.gameType]);
      if (claim.rowCount === 0) {
        const existing = await client.query('SELECT result FROM point_settlements WHERE settlement_id = $1', [plan.settlementId]);
        return { applied: false, ...(existing.rows[0]?.result || {}) };
      }
      const ids = [...new Set(plan.transfers.flatMap(item => [item.from, item.to]))];
      for (const id of ids) await this.#ensure(client, id);
      const balances = await this.#lockBalances(client, ids);
      const results = capTransfers(plan.transfers, balances);
      const current = { ...balances };
      for (const item of results) {
        if (!item.paid) continue;
        for (const [userId, delta, reason] of [[item.from, -item.paid, 'game_loss'], [item.to, item.paid, 'game_win']]) {
          const before = current[userId];
          await client.query(`INSERT INTO point_ledger (id, user_id, balance_before, delta, balance_after, reason, match_id, game_type, settlement_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [crypto.randomUUID(), userId, before, delta, before + delta, reason, plan.matchId, plan.gameType, plan.settlementId]);
          current[userId] = before + delta;
        }
      }
      for (const id of ids) await client.query('UPDATE point_accounts SET balance = $2, updated_at = now() WHERE user_id = $1', [id, current[id]]);
      const record = { settlementId: plan.settlementId, matchId: plan.matchId, gameType: plan.gameType, at: new Date().toISOString(), transfers: results, balances: current };
      await client.query('UPDATE point_settlements SET result = $2::jsonb WHERE settlement_id = $1', [plan.settlementId, JSON.stringify(record)]);
      for (const id of ids) this.cache.set(id, current[id]);
      return { applied: true, ...record };
    });
  }

  cachedBalance(userId) { return this.cache.has(userId) ? this.cache.get(userId) : null; }

  async ledger(userId, limit = 50) {
    const rows = await this.pool.query(`SELECT id, user_id, created_at, balance_before, delta, balance_after, reason, match_id, game_type, settlement_id, idempotency_key
      FROM point_ledger WHERE user_id = $1 ORDER BY created_at DESC, id LIMIT $2`, [userId, limit]);
    return rows.rows.map(row => ({ id: row.id, userId: row.user_id, at: row.created_at?.toISOString?.() || row.created_at,
      balanceBefore: Number(row.balance_before), delta: Number(row.delta), balanceAfter: Number(row.balance_after), reason: row.reason,
      matchId: row.match_id, gameType: row.game_type, settlementId: row.settlement_id, idempotencyKey: row.idempotency_key }));
  }
}

async function createPointStore({ dataDir, databaseUrl }) {
  // Like match history: with a database configured, never fall back to a local file.
  const store = databaseUrl ? new PostgresPointStore(databaseUrl) : new JsonPointStore(path.join(dataDir, 'points.json'));
  await store.init();
  return store;
}

module.exports = { createPointStore, JsonPointStore, PostgresPointStore, capTransfers, kstDate, validUserId, INITIAL_GRANT, DAILY_ATTENDANCE };
