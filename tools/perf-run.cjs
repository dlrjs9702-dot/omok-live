'use strict';
// 1.10.440 ④ P2 · P3 (gamecenter-notes docs/engine-borrow-feasibility-20261122.md §3-4): the admin's 「성능 재기」 run from this PC -- the
// same PlazaDebug().perfRun the button calls, so a PC and a phone are read with one yardstick. A server of this checkout on its own port
// with an empty data folder (nothing of the live game's), a guest let in, the island, then perfRun's rows printed and written as JSON.
//   node tools/perf-run.cjs              -- this PC's Chromium (the Playwright one)
//   node tools/perf-run.cjs --phone      -- an Android phone on USB (adb on PATH, USB debugging on): adb reverse for the page,
//                                           Chrome's remote debugging over adb forward; only a new tab of the phone's Chrome is used
// options: --out file.json, --tiers 0,2, --ms 3000 (per place), --port 4316
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os'); const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('@playwright/test');
const ROOT = path.join(__dirname, '..');
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def; };
const PHONE = process.argv.includes('--phone'); const PORT = Number(arg('port', 4316)); const BASE = `http://127.0.0.1:${PORT}`; const CDP = Number(arg('cdp', 9333));
const OUT = arg('out', null); const TIERS = arg('tiers', '0,2').split(',').map(Number).filter((n) => [0, 1, 2].includes(n)); const MS = Math.max(1000, Math.min(20000, Number(arg('ms', 3000)) || 3000));
const adb = (...a) => execFileSync('adb', a, { encoding: 'utf8', timeout: 20000 }).trim();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const PLACE = { plaza: '대청마당', stop: '정류장 앞', bridge: '별마루다리', street: '마을 거리', forest: '숲' };
async function server() {
  const pw = crypto.randomBytes(12).toString('hex'); const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf-run-'));
  const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'test', ISLAND_QUEST_WEEK: '0', HOST: '127.0.0.1', PORT: String(PORT), ADMIN_PASSWORD: pw, DATA_DIR: dataDir, DATABASE_URL: '' } });
  for (let i = 0; ; i += 1) { try { if ((await fetch(`${BASE}/health`)).ok) break; } catch { /* not up yet */ } if (i >= 120) throw new Error('server did not start'); await new Promise((r) => setTimeout(r, 500)); }
  const stop = async () => { try { await fetch(`${BASE}/api/test/shutdown`, { method: 'POST' }); } catch { /* gone */ } await new Promise((r) => setTimeout(r, 800)); try { child.kill(); } catch { /* gone */ } fs.rmSync(dataDir, { recursive: true, force: true }); };
  return { pw, stop };
}
const post = async (route, token, data) => { const r = await fetch(BASE + route, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { 'X-Session-Token': token } : {}) }, body: JSON.stringify(data ?? {}) }); return r.json().catch(() => ({})); };
(async () => {
  const srv = await server(); log('server', BASE); let browser = null; let page = null; let own = null;
  try {
    if (PHONE) {
      adb('reverse', `tcp:${PORT}`, `tcp:${PORT}`); adb('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP');
      adb('shell', 'am', 'start', '-n', 'com.android.chrome/com.google.android.apps.chrome.Main', '-d', 'about:blank'); await new Promise((r) => setTimeout(r, 3000));
      adb('forward', `tcp:${CDP}`, 'localabstract:chrome_devtools_remote');
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP}`); page = await browser.contexts()[0].newPage();
    } else {
      /* (the PC's own graphics card, not SwiftShader -- and not marked automated, so the page draws as for a player: work/gpu-20261117 p.cjs's flags) */
      own = await chromium.launch({ headless: true, channel: 'chromium', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-blink-features=AutomationControlled'] }); browser = own; page = await (await own.newContext({ viewport: { width: 1280, height: 800 } })).newPage(); }
    const admin = (await post('/api/admin/login', null, { password: srv.pw })).sessionToken; if (!admin) throw new Error('admin login failed');
    const issued = await post('/api/admin/keys', admin, { label: `성능재기-${Date.now() % 100000}` }); if (!issued.html) throw new Error('no guest key');
    await Promise.all([page.waitForURL(/\/guest-entry$/, { timeout: 60000 }), page.setContent(issued.html)]);
    await page.evaluate(() => localStorage.removeItem('gc.testClassic')); await page.reload();
    for (let k = 0; k < 360 && !(await page.evaluate(() => window.PlazaDebug?.()?.running).catch(() => false)); k += 1) await page.waitForTimeout(500);
    log('island running'); await page.waitForTimeout(10000);
    for (let k = 0; k < 5; k += 1) { const ok = page.getByRole('button', { name: /알겠어요|닫기|확인|그대로 하기/ }).first(); if (await ok.isVisible().catch(() => false)) { await ok.evaluate((b) => b.click()); await page.waitForTimeout(400); } }
    await page.evaluate(() => { const d = window.PlazaDebug(); d.setWeather?.('clear'); d.setTime?.('day'); });
    const r = await page.evaluate(({ tiers, ms }) => window.PlazaDebug().perfRun({ warp: window.PlazaWarp, tiers, ms }), { tiers: TIERS, ms: MS });
    if (!r) throw new Error('perfRun gave nothing (busy?)');
    log(JSON.stringify({ phone: r.phone, gpu: r.gpu, dpr: r.dpr, px: r.px }));
    console.log(['곳', '화질', 'fps', 'p95 ms', '50 ms+', '50 ms+ %', '스크립트 ms', '그리기'].join('\t'));
    for (const w of r.rows) console.log([`${PLACE[w.place] || w.place}${w.see ? '' : ' (구멍 없이)'}`, ['낮음', '보통', '높음'][w.tier], w.fps, w.p95, w.over50, w.long, w.js ?? '-', w.calls].join('\t'));
    if (OUT) fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), version: require('../package.json').version, ...r }, null, 1));
  } finally {
    try { await page?.close(); } catch { /* gone */ } try { await browser?.close(); } catch { /* gone */ }
    if (PHONE) { try { adb('forward', '--remove', `tcp:${CDP}`); } catch { /* gone */ } try { adb('reverse', '--remove', `tcp:${PORT}`); } catch { /* gone */ } }
    await srv.stop(); log('done');
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
