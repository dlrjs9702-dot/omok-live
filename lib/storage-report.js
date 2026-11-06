'use strict';

// v1.10.256 관리자 「저장 공간 보기」 (gamecenter-notes docs/messenger-speed-photo-20261103.md 14절): the database's disk is 1 GB
// with no growing by itself and nobody outside can look -- so the server says it: the database's size, its eight biggest
// tables (their size and rows, guessed by the planner) by an easy name, and how full against DB_DISK_GB (1); 80 % orange,
// 90 % red, and a [storage] line in the log once a day (a warning past 80 %). A file store (local, tests): its data files.
const fs = require('node:fs/promises');
const path = require('node:path');

const NAMES = Object.freeze({
  messenger_photos: '메신저 사진', messenger_messages: '메신저 대화', island_world: '섬 세계 값(문제 기록 사진 등)', point_ledger: '포인트 기록',
  point_settlements: '정산 기록', game_match_history: '게임 전적', island_plants: '섬 식물', island_bags: '섬 가방', solo_daily: '혼자 게임 하루 기록',
  solo_weekly: '혼자 게임 주간 기록', solo_records: '혼자 게임 최고 기록', guest_access_keys: '입장 키·계정', announcements: '공지', climb_days: '하늘 계단 하루',
  island_days: '섬 하루 기록', plaza_spots: '광장 자리', skin_owned: '가진 스킨', island_dex: '도감', 'points.json': '포인트·섬 (파일)', 'access-keys.json': '입장 키 (파일)', 'messenger.json': '메신저 (파일)', 'match-records.json': '게임 전적 (파일)', 'announcements.json': '공지 (파일)',
});
const GB = 1024 ** 3;
const limitGb = (env = process.env) => { const n = Number(env.DB_DISK_GB); return Number.isFinite(n) && n > 0 ? n : 1; };

/** the report's shape: used of limit, its percent (one decimal) and level, the tables biggest first */
function shape(kind, used, tables, gb) {
  const limit = gb * GB; const percent = Math.round((used / limit) * 1000) / 10;
  return { kind, used, limit, limitGb: gb, percent, level: percent >= 90 ? 'red' : percent >= 80 ? 'orange' : 'ok',
    tables: tables.slice(0, 8).map((t) => ({ name: t.name, label: NAMES[t.name] || null, bytes: Number(t.bytes) || 0, rows: t.rows == null ? null : Math.max(0, Number(t.rows) || 0) })) };
}

async function pgReport(pool, gb = limitGb()) {
  const db = (await pool.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes;
  const tables = (await pool.query(`SELECT c.relname AS name, pg_total_relation_size(c.oid) AS bytes, GREATEST(c.reltuples, 0)::bigint AS rows
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND n.nspname = 'public' ORDER BY 2 DESC LIMIT 8`)).rows;
  return shape('postgres', Number(db), tables, gb);
}

async function fileReport(dir, gb = limitGb()) {
  const files = [];
  for (const name of await fs.readdir(dir).catch(() => [])) { const st = await fs.stat(path.join(dir, name)).catch(() => null); if (st?.isFile()) files.push({ name, bytes: st.size, rows: null }); }
  files.sort((a, b) => b.bytes - a.bytes);
  return shape('file', files.reduce((n, f) => n + f.bytes, 0), files, gb);
}

const mb = (b) => `${Math.round(b / 1048576)} MB`;
/** the day's log line, always (총괄 #406: the trend read from the log -- nobody outside sees the database), its biggest
 *  table with it: [storage] 12% (123 MB / 1 GB) · 1위 메신저 사진 80 MB; `warn` past 80 % */
function logLine(r) {
  const top = r.tables[0]; const line = `[storage] ${Math.round(r.percent)}% (${mb(r.used)} / ${r.limitGb} GB)${top ? ` · 1위 ${top.label || top.name} ${mb(top.bytes)}` : ''}`;
  return { line, warn: r.percent >= 80 };
}

module.exports = { NAMES, limitGb, shape, pgReport, fileReport, logLine };
