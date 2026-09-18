'use strict';

const fs = require('fs/promises');
const path = require('path');

const VALID_RESULTS = new Set(['win', 'loss', 'draw']);

function summarize(rows) {
  const byGame = new Map();
  const overall = { played: 0, wins: 0, losses: 0, draws: 0, winRate: 0 };
  for (const row of rows) {
    if (!VALID_RESULTS.has(row.result)) continue;
    if (!byGame.has(row.gameType)) byGame.set(row.gameType, { gameType: row.gameType, played: 0, wins: 0, losses: 0, draws: 0, winRate: 0 });
    const item = byGame.get(row.gameType);
    for (const target of [item, overall]) {
      target.played += Number(row.count || 0);
      if (row.result === 'win') target.wins += Number(row.count || 0);
      else if (row.result === 'loss') target.losses += Number(row.count || 0);
      else target.draws += Number(row.count || 0);
    }
  }
  const rate = item => { item.winRate = item.played ? Math.round(item.wins / item.played * 1000) / 10 : 0; };
  rate(overall);
  const games = [...byGame.values()].sort((a, b) => a.gameType.localeCompare(b.gameType));
  for (const game of games) rate(game);
  return { overall, games };
}

function validate(matchId, gameType, results) {
  if (typeof matchId !== 'string' || !/^[A-Za-z0-9_-]{12,100}$/.test(matchId)) throw new Error('invalid match id');
  if (typeof gameType !== 'string' || !/^[a-z0-9]{2,30}$/.test(gameType)) throw new Error('invalid game type');
  if (!Array.isArray(results) || results.length < 2 || results.length > 8) throw new Error('invalid participants');
  const ids = new Set();
  for (const row of results) {
    if (typeof row.playerId !== 'string' || !/^(admin|[0-9a-f-]{36})$/.test(row.playerId) || !VALID_RESULTS.has(row.result) || ids.has(row.playerId)) throw new Error('invalid player result');
    ids.add(row.playerId);
  }
}

class JsonStatsStore {
  constructor(filePath) { this.filePath = filePath; this.matches = {}; this.saveQueue = Promise.resolve(); }
  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const saved = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      this.matches = saved && typeof saved.matches === 'object' && !Array.isArray(saved.matches) ? saved.matches : {};
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      await this.#save();
    }
  }
  #save() {
    const snapshot = JSON.stringify({ matches: this.matches });
    this.saveQueue = this.saveQueue.then(async () => {
      const tmp = `${this.filePath}.tmp`;
      await fs.writeFile(tmp, snapshot, 'utf8');
      await fs.rename(tmp, this.filePath);
    });
    return this.saveQueue;
  }
  async record(matchId, gameType, results) {
    validate(matchId, gameType, results);
    if (this.matches[matchId]) return false;
    this.matches[matchId] = { gameType, results: results.map(row => ({ ...row })) };
    try { await this.#save(); }
    catch (err) { delete this.matches[matchId]; throw err; }
    return true;
  }
  async stats(playerId) {
    const counts = new Map();
    for (const match of Object.values(this.matches)) {
      for (const row of match.results || []) {
        if (row.playerId !== playerId) continue;
        const key = `${match.gameType}:${row.result}`;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    }
    return summarize([...counts].map(([key, count]) => {
      const pos = key.lastIndexOf(':');
      return { gameType: key.slice(0, pos), result: key.slice(pos + 1), count };
    }));
  }
}

class PostgresStatsStore {
  constructor(databaseUrl) {
    const { Pool } = require('pg');
    const ssl = !/localhost|127\.0\.0\.1|\.internal(?::|\/|$)/i.test(databaseUrl);
    this.pool = new Pool({ connectionString: databaseUrl, ssl: ssl ? { rejectUnauthorized: false } : false, max: 3 });
  }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS game_match_results (
      match_id text NOT NULL,
      player_id text NOT NULL,
      game_type text NOT NULL,
      result text NOT NULL CHECK (result IN ('win','loss','draw')),
      finished_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (match_id, player_id)
    )`);
    await this.pool.query('CREATE INDEX IF NOT EXISTS game_results_by_player ON game_match_results (player_id, game_type)');
  }
  async record(matchId, gameType, results) {
    validate(matchId, gameType, results);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const exists = await client.query('SELECT 1 FROM game_match_results WHERE match_id = $1 LIMIT 1', [matchId]);
      if (exists.rowCount) { await client.query('COMMIT'); return false; }
      for (const row of results) {
        await client.query('INSERT INTO game_match_results (match_id, player_id, game_type, result) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [matchId, row.playerId, gameType, row.result]);
      }
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally { client.release(); }
  }
  async stats(playerId) {
    const { rows } = await this.pool.query('SELECT game_type AS "gameType", result, COUNT(*)::int AS count FROM game_match_results WHERE player_id=$1 GROUP BY game_type, result', [playerId]);
    return summarize(rows);
  }
}

async function createStatsStore({ dataDir, databaseUrl, production = false }) {
  if (databaseUrl) {
    const store = new PostgresStatsStore(databaseUrl);
    await store.init(); // Never silently redirect permanent results to an ephemeral filesystem.
    return store;
  }
  if (production) throw new Error('게임별 누적 전적을 저장할 DATABASE_URL이 설정되어 있지 않습니다.');
  const store = new JsonStatsStore(path.join(dataDir, 'game-match-results.json'));
  await store.init();
  return store;
}

module.exports = { createStatsStore, JsonStatsStore, PostgresStatsStore, summarize };
