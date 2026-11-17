'use strict';
// 1.10.349 DB 백업 -- this PC's side (no secret in the repo): where the backups live, the log, the config
const fs = require('fs');
const path = require('path');

// 아일랜드\DB백업 (beside the repo), or BACKUP_DIR
const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, '..', '..', '..', 'DB백업');
const KEYS_DIR = path.join(BACKUP_DIR, 'keys');
const PRIVATE_KEY = path.join(KEYS_DIR, 'backup-private.pem');
const PUBLIC_KEY = path.join(KEYS_DIR, 'backup-public.pem');
const REPO_PUBLIC_KEY = path.join(__dirname, 'backup-public.pem');
const CONFIG = path.join(BACKUP_DIR, 'config.local.json');
const LOG = path.join(BACKUP_DIR, 'backup.log');

const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
function log(line) {
  const text = `${new Date(Date.now() + 9 * 3600000).toISOString().replace('T', ' ').slice(0, 19)} ${line}`;
  console.log(text); try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); fs.appendFileSync(LOG, `${text}\n`); } catch {}
}
function readConfig() {
  if (!fs.existsSync(CONFIG)) throw new Error(`설정 파일이 없어요: ${CONFIG}`);
  const c = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  if (!c.url) throw new Error('config.local.json에 url이 없어요.');
  if (!c.adminPassword) throw new Error('config.local.json에 adminPassword(관리자 비밀번호)를 넣어 주세요.');
  return { url: String(c.url).replace(/\/+$/, ''), adminPassword: String(c.adminPassword), keepDays: Number(c.keepDays) || 30 };
}

module.exports = { BACKUP_DIR, KEYS_DIR, PRIVATE_KEY, PUBLIC_KEY, REPO_PUBLIC_KEY, CONFIG, LOG, kstDay, log, readConfig };
