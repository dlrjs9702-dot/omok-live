'use strict';
// 1.10.349: the day's backup -- log in as the admin (config.local.json), take /api/admin/backup into DB백업\YYYY-MM-DD.bak (a
// .part first, renamed once whole), log out; with the private key here, open it and check it ends whole; the .bak files older
// than keepDays (30) deleted. Every step into DB백업\backup.log; exit 1 on a failure (the scheduled task shows it).
//   node tools/backup/fetch.js
const fs = require('fs');
const path = require('path');
const C = require('./common');
const B = require('../../lib/db-backup');

async function main() {
  const cfg = C.readConfig(); fs.mkdirSync(C.BACKUP_DIR, { recursive: true });
  const started = Date.now(); const day = C.kstDay(); const file = path.join(C.BACKUP_DIR, `${day}.bak`); const part = `${file}.part`;
  const login = await fetch(`${cfg.url}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: cfg.adminPassword }) });
  if (!login.ok) throw new Error(`관리자 로그인 실패 (${login.status})`);
  const { sessionToken } = await login.json(); const headers = { 'x-session-token': sessionToken };
  try {
    const res = await fetch(`${cfg.url}/api/admin/backup`, { headers });
    if (!res.ok) throw new Error(`백업 받기 실패 (${res.status} ${(await res.text()).slice(0, 200)})`);
    const out = fs.createWriteStream(part); let bytes = 0;
    for await (const chunk of res.body) { bytes += chunk.length; if (!out.write(chunk)) await new Promise((r) => out.once('drain', r)); }
    await new Promise((r, j) => out.end((e) => (e ? j(e) : r())));
    const head = Buffer.alloc(B.MAGIC.length); const fd = fs.openSync(part, 'r'); fs.readSync(fd, head, 0, head.length, 0); fs.closeSync(fd);
    if (!head.equals(B.MAGIC) || bytes < 64) throw new Error(`받은 파일이 백업 모양이 아니에요 (${bytes} bytes)`);
    fs.renameSync(part, file);
    let check = '';
    if (fs.existsSync(C.PRIVATE_KEY)) { const p = B.parse(B.open(fs.readFileSync(file), fs.readFileSync(C.PRIVATE_KEY, 'utf8'))); if (!p.complete) throw new Error('백업이 끝까지 오지 않았어요 (end 줄 없음)'); check = ` · 열어 봄: 표 ${Object.keys(p.tables).length}개, 줄 ${p.rows}개`; }
    C.log(`ok ${path.basename(file)} ${(bytes / 1048576).toFixed(2)} MB · ${((Date.now() - started) / 1000).toFixed(1)} s${check}`);
  } finally { await fetch(`${cfg.url}/api/logout`, { method: 'POST', headers }).catch(() => {}); fs.rmSync(part, { force: true }); }
  const cut = Date.now() - cfg.keepDays * 86400000;
  for (const f of fs.readdirSync(C.BACKUP_DIR)) { const m = /^(\d{4}-\d{2}-\d{2})\.bak$/.exec(f); if (m && Date.parse(`${m[1]}T00:00:00+09:00`) < cut) { fs.rmSync(path.join(C.BACKUP_DIR, f)); C.log(`deleted ${f} (${cfg.keepDays}일 지남)`); } }
}
main().catch((e) => { C.log(`FAILED ${e.message}`); process.exit(1); });
