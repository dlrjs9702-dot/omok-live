'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const RESULTS = new Set(['win', 'loss', 'draw']);

function validateMatch(match) {
  if (!match || typeof match.id !== 'string' || !match.id || match.id.length > 180 ||
    typeof match.gameType !== 'string' || !/^[a-z0-9]+$/.test(match.gameType) ||
    !Array.isArray(match.outcomes) || match.outcomes.length < 2) throw new TypeError('Invalid match record');
  const ids = new Set();
  for (const item of match.outcomes) {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 128 ||
      !RESULTS.has(item.result) || ids.has(item.id)) throw new TypeError('Invalid player outcome');
    ids.add(item.id);
  }
  return { id: match.id, gameType: match.gameType, at: match.at || new Date().toISOString(),
    outcomes: match.outcomes.map(({ id, result }) => ({ id, result })) };
}

function tally(matches, playerId) {
  const total = { played: 0, wins: 0, losses: 0, draws: 0, winRate: 0 };
  const byGame = {};
  for (const match of matches) {
    const item = match.outcomes.find(entry => entry.id === playerId);
    if (!item) continue;
    for (const bucket of [total, byGame[match.gameType] ||= { played: 0, wins: 0, losses: 0, draws: 0, winRate: 0 }]) {
      bucket.played += 1;
      if (item.result === 'win') bucket.wins += 1;
      if (item.result === 'loss') bucket.losses += 1;
      if (item.result === 'draw') bucket.draws += 1;
    }
  }
  for (const item of [total, ...Object.values(byGame)]) item.winRate = item.played ? Math.round(item.wins / item.played * 10000) / 100 : 0;
  return { total, byGame };
}

class JsonMatchStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.matches = {};
    this.queue = Promise.resolve();
  }
  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (!data || typeof data !== 'object' || !data.matches || typeof data.matches !== 'object' || Array.isArray(data.matches)) {
        throw new Error('전적 저장소 형식이 올바르지 않습니다.');
      }
      this.matches = data.matches;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error; // Never silently overwrite damaged history.
      await fs.writeFile(this.filePath, JSON.stringify({ matches: {} }), { flag: 'wx', mode: 0o600 });
    }
  }
  async recordMatch(raw) {
    const match = validateMatch(raw);
    const pending = this.queue.catch(() => {}).then(async () => {
      if (Object.hasOwn(this.matches, match.id)) return false;
      const next = { ...this.matches, [match.id]: match };
      const temp = `${this.filePath}.${process.pid}.tmp`;
      try {
        await fs.writeFile(temp, JSON.stringify({ matches: next }), { mode: 0o600 });
        await fs.rename(temp, this.filePath);
      } catch (error) {
        await fs.rm(temp, { force: true }).catch(() => {});
        throw error;
      }
      this.matches = next;
      return true;
    });
    this.queue = pending;
    return pending;
  }
  async stats(playerId) {
    await this.queue;
    return tally(Object.values(this.matches), playerId);
  }
}

class PostgresMatchStore {
  constructor(connectionString) {
    const { Pool } = require('pg');
    const ssl = !/localhost|127\.0\.0\.1|\.internal(?::|\/|$)/i.test(connectionString);
    this.pool = new Pool({ connectionString, ssl: ssl ? { rejectUnauthorized: false } : false, max: 2 });
  }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS game_match_history (
      match_id text PRIMARY KEY,
      game_type text NOT NULL,
      played_at timestamptz NOT NULL,
      outcomes jsonb NOT NULL
    )`);
    await this.pool.query('CREATE INDEX IF NOT EXISTS game_match_history_outcomes_idx ON game_match_history USING gin (outcomes)');
  }
  async recordMatch(raw) {
    const match = validateMatch(raw);
    const result = await this.pool.query(`INSERT INTO game_match_history (match_id, game_type, played_at, outcomes)
      VALUES ($1, $2, $3, $4::jsonb) ON CONFLICT (match_id) DO NOTHING RETURNING match_id`,
    [match.id, match.gameType, match.at, JSON.stringify(match.outcomes)]);
    return result.rowCount === 1;
  }
  async stats(playerId) {
    const rows = await this.pool.query('SELECT game_type, outcomes FROM game_match_history WHERE outcomes @> $1::jsonb',
      [JSON.stringify([{ id: playerId }])]);
    return tally(rows.rows.map(row => ({ gameType: row.game_type, outcomes: row.outcomes })), playerId);
  }
}

async function createMatchStore({ dataDir, databaseUrl }) {
  // Use the existing DATABASE_URL; never fall back to a local file after DB failure.
  const store = databaseUrl
    ? new PostgresMatchStore(databaseUrl)
    : new JsonMatchStore(path.join(dataDir, 'match-records.json'));
  await store.init();
  return store;
}

module.exports = { createMatchStore, JsonMatchStore, PostgresMatchStore, validateMatch, tally };
