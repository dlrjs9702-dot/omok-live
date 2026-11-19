'use strict';
// 364 화면 자동 점검 (user 「A」: before a release; 총괄's work/claude-tools/screencheck.mjs reads the shots): a local test server on its
// own port, a player taken to ~25 fixed spots of the island, each shot on a PC (1920×1080) and a Pixel 5, at High and Low quality, and
// three of them again at night -> work/screens-<version>/*.png + spots.json { file: "place/what" }. Never in CI (not a spec).
// One heavy job at a time on this PC: it waits while 구현's tests run and takes assets/.heavy-lock as the asset session's heavy.sh does.
//   node tools/screen-check/capture.cjs [--only plaza,camp] [--devices pc,phone] [--quality high,low] [--no-night] [--no-gpu]
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os'); const { spawn, execFileSync } = require('node:child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const { chromium, devices, request: pwRequest } = require('@playwright/test');
const { waitReady } = require(path.join(ROOT, 'test-support', 'wait-ready'));
const freePort = require(path.join(ROOT, 'test-support', 'free-port'));
const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i < 0 ? def : process.argv[i + 1]; };
const has = (name) => process.argv.includes(`--${name}`);
const VERSION = require(path.join(ROOT, 'package.json')).version; const OUT = path.join(ROOT, 'work', `screens-${VERSION}`);
const LOCK = process.env.HEAVY_LOCK || path.join(ROOT, '..', 'assets', '.heavy-lock'); const ADMIN = process.env.PLAYWRIGHT_ADMIN_PASSWORD || 'screen-check-password';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// where: `area` (IslandTerrain.AREAS), `place` (dalmaru PLACES), `door` (a facility's door), `xz`, `near` (the nearest standable to an
// area -- the shore by the bay), `bridge` (a bridge's middle), `taxi` (the taxi road's middle), `lot` (a house lot); `inside`: walked in
const SPOTS = [
  { id: 'plaza', label: '대청마당/광장 전체', area: 'plaza' }, { id: 'village', label: '이웃골/마을 집들', area: 'village' },
  { id: 'notice', label: '알림마루/게시판 언덕', area: 'notice' }, { id: 'quarry', label: '채석장/바위와 레일', area: 'quarry' },
  { id: 'bay', label: '윤슬만/물가', near: 'bay' }, { id: 'lake', label: '거울호수/호숫가', near: 'lake' },
  { id: 'west', label: '푸른숲골/숲', area: 'west' }, { id: 'east', label: '잔치마루/잔치터', area: 'east' }, { id: 'ridge', label: '달마루 능선/능선 위', area: 'ridge' },
  { id: 'isle', label: '툇마루섬/섬과 정원', area: 'isle' }, { id: 'lighthouse', label: '초승등대/등대', place: 'lighthouse' }, { id: 'pier', label: '달끝나루/나루', place: 'pier' },
  { id: 'station', label: '초승역/역과 승강장', place: 'stationmaster' }, { id: 'museum', label: '박물관/바깥', place: 'museum' },
  { id: 'townhall', label: '관공서/정문', door: 'townhall' }, { id: 'townhall-gate', label: '관공서/마당 정문과 시장(밖에서)', gate: true },
  { id: 'crosswalk', label: '택시 길/건널목 정면', crossing: 0 }, { id: 'townhall-inside', label: '관공서/안 민원실', inside: 'townhall' },
  { id: 'mall-inside', label: '백화점/1층 안 노점', inside: 'mall' }, { id: 'house', label: '이웃골/집터와 마당', lot: 0 },
  { id: 'taxi-road', label: '택시 길/차선과 인도', taxi: true }, { id: 'isle2-bridge', label: '별마루다리/다리 위', bridge: 'isle2' },
  { id: 'isle2-forest', label: '별마루섬/숲길', near: 'newIsle' }, { id: 'camp', label: '별마루섬/캠핑장', camp: true }, { id: 'lookout', label: '별마루섬/전망대 봉우리', peak: true }, { id: 'ancient', label: '별마루섬/별지기 느티', area: 'ancient' } /* (1.10.367 N1b) */,
];
const NIGHT = ['plaza', 'bay', 'camp'];

function testsRunning() { // (as heavy.sh: a node test run of 구현's -- playwright, node --test, npm test)
  try { return Number(execFileSync('powershell', ['-NoProfile', '-Command', "@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'playwright test|cli.js.? test|node --test|npm-cli.js. test' -and $_.Name -eq 'node.exe' }).Count"], { encoding: 'utf8' }).trim()) || 0; } catch { return 0; }
}
async function lockBegin() {
  for (;;) {
    if (testsRunning()) { console.log('(waiting: 구현\'s tests are running)'); await sleep(30000); continue; }
    try { fs.mkdirSync(LOCK); fs.writeFileSync(path.join(LOCK, 'owner'), `screen-check ${process.pid} ${new Date().toTimeString().slice(0, 8)}\n`); return; } catch { /* held */ }
    try { const st = fs.statSync(LOCK); if (Date.now() - st.mtimeMs > 40 * 60000) { const pid = Number(fs.readFileSync(path.join(LOCK, 'owner'), 'utf8').trim().split(/\s+/).at(-2)); let alive = false; try { process.kill(pid, 0); alive = true; } catch {} if (!alive) { fs.rmSync(LOCK, { recursive: true, force: true }); continue; } } } catch {}
    console.log('(waiting: another heavy job holds the lock)'); await sleep(15000);
  }
}
const lockTouch = () => { try { const t = new Date(); fs.utimesSync(LOCK, t, t); fs.utimesSync(path.join(LOCK, 'owner'), t, t); } catch {} };
const lockEnd = () => { try { fs.rmSync(LOCK, { recursive: true, force: true }); } catch {} };

// (365, 총괄's first run: the phone pass got no entry file from /api/admin/keys -- every call came from one address and logged in
// again: one admin login kept, each call its own address, the key asked again with a new label when none came back)
let ipN = 0; const ip = () => `100.73.${process.pid % 250}.${(++ipN % 250) + 1}`;
let adminTok = null;
async function adminPost(api, route, data) {
  for (let k = 0; k < 4; k += 1) {
    if (!adminTok) adminTok = (await (await api.post('/api/admin/login', { headers: { 'X-Forwarded-For': ip() }, data: { password: ADMIN } })).json()).sessionToken;
    const res = await api.post(route, { headers: { 'X-Session-Token': adminTok, 'X-Forwarded-For': ip() }, data: typeof data === 'function' ? data(k) : data });
    const body = await res.json().catch(() => ({})); if (res.ok()) return body;
    if (res.status() === 401 || res.status() === 403) adminTok = null; await sleep(2000 * (k + 1));
  }
  throw new Error(`${route}: no answer after 4 tries`);
}
async function enter(browser, api, base, device, quality) {
  const issued = await adminPost(api, '/api/admin/keys', (k) => ({ label: `점검${device}${quality}${k ? k : ''}` }));
  if (!issued.html) throw new Error('no entry file');
  const ctx = await browser.newContext(device === 'phone' ? { ...devices['Pixel 5'] } : { viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript((q) => { try { localStorage.setItem('gc.quality', q); localStorage.removeItem('gc.testClassic'); localStorage.setItem('gc.qualityNote', new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)); } catch {} }, quality === 'high' ? '2' : '0');
  const page = await ctx.newPage(); /* (from a blank page, as the e2e's shopper: the entry file's form posts itself) */
  await Promise.all([page.waitForURL(/\/guest-entry$/), page.setContent(issued.html)]);
  const token = JSON.parse(await page.evaluate(() => sessionStorage.getItem('gameCenterGuestSession'))).token;
  await api.post('/api/avatar/gender', { headers: { 'X-Session-Token': token, 'X-Forwarded-For': ip() }, data: { gender: 'female' } });
  await page.waitForFunction(() => window.PlazaDebug?.()?.running, null, { timeout: 120000 });
  return { ctx, page, token };
}
// the spot's standing point and the way to look, worked out in the page from the island's own tables
// (365, 총괄's first run: 「nearest walkable」 stood the player inside the fountain, a tree, the notice board and put the camera on
// the museum's roof -- now a point 6~24 m from what the shot is of, standable AND a free cell of the islanders' walk grid (off
// trees, rocks, props, buildings), with the camera's side behind it open too, looking at the thing)
const resolve = (page, spot) => page.evaluate((s) => {
  const T = window.IslandTerrain; const D = T.dalmaru; const N = window.IslandNpcs;
  const ok = (x, z) => T.walkable(x, z) && !(D?.isWater?.(x, z));
  /* (367: 별마루섬 lies past the islanders' grid (±200 m) -- every point there read as blocked: off its solids instead) */
  const isle2 = (x, z) => Boolean(D?.newIsleCoast && D.newIsleCoast(x, z) > -2); const solids = T.natureSolids();
  const free = (x, z) => ok(x, z) && (isle2(x, z) ? solids.every((o) => Math.abs(o.x - x) > 4 || Math.abs(o.z - z) > 4 || Math.hypot(o.x - x, o.z - z) > o.r + 1.2) : (!N?.free || N.free(x, z)));
  const viewOf = (tx, tz, rMin = 6, rMax = 24) => {
    for (let r = rMin; r <= rMax; r += 2) for (let k = 0; k < 24; k += 1) {
      const a = (k / 24) * Math.PI * 2; const ux = Math.cos(a); const uz = Math.sin(a); const x = tx + ux * r; const z = tz + uz * r;
      if (free(x, z) && free(x + ux * 3, z + uz * 3) && ok(x + ux * 6, z + uz * 6)) return { x, z, look: { x: tx, z: tz } };
    }
    for (let r = 1; r <= 60; r += 1) for (let k = 0; k < 32; k += 1) { const a = (k / 32) * Math.PI * 2; const x = tx + Math.cos(a) * r; const z = tz + Math.sin(a) * r; if (free(x, z)) return { x, z, look: { x: tx, z: tz } }; }
    return null;
  };
  if (s.area) return viewOf(T.AREAS[s.area].x, T.AREAS[s.area].z);
  if (s.place) { const q = D.PLACES[s.place]; return q && viewOf(q.x, q.z, 10, 30); }
  if (s.door) { const d = T.facilityDoor(s.door); return viewOf(d.x, d.z, 7, 20); }
  if (s.near) { const a = T.AREAS[s.near] || { x: D.NEW_ISLE.x, z: D.NEW_ISLE.z }; return viewOf(a.x, a.z, 6, 90); }
  if (s.bridge) { const b = D.BRIDGES.find((x) => x.isle2); return { x: b.x, z: b.z, look: { x: b.ends[1][0], z: b.ends[1][1] } }; }
  if (s.taxi) { const R = window.IslandTaxi?.ROUTE || []; const m = R[Math.floor(R.length / 2)]; return m && viewOf(m[0], m[1], 6, 16); }
  if (s.lot != null) { const l = T.HOME_LOTS[s.lot]; return viewOf(l.x, l.z, 8, 22); }
  if (s.camp) { const c = D.NEW_ISLE.camp; return viewOf(c.x, c.z, 8, 24); }
  if (s.peak) { const c = D.NEW_ISLE.peak; return viewOf(c.x, c.z, 4, 20); }
  if (s.gate) { const Y = T.TOWNHALL.yard; const g = T.townhallWorld(0, Y.z1); const o = T.townhallWorld(0, Y.z1 + 9); return { x: o.x, z: o.z, look: g }; } /* (365 #4: the gate and the mayor from outside the wall) */
  if (s.crossing != null) { const c = window.IslandTaxi?.CROSSINGS?.[s.crossing]; return c && viewOf(c.x, c.z, 7, 14); } /* (365 #5: a 건널목 face on -- do its bars stop at the kerb?) */
  return null;
}, spot);

async function goInside(page, spot) {
  if (spot.inside === 'mall') { await require(path.join(ROOT, 'tests', 'e2e', 'skin-support')).intoMall?.(page, 'mall:stall'); return; }
  await page.evaluate(() => window.PlazaDebug().place('townhall')); await sleep(1500); await page.keyboard.press('Space');
  await page.waitForFunction(() => window.PlazaDebug().space === 'townhall', null, { timeout: 30000 });
}
async function goOut(page) {
  const space = await page.evaluate(() => window.PlazaDebug().space); if (space === 'island') return;
  if (space === 'store') { await require(path.join(ROOT, 'tests', 'e2e', 'skin-support')).outOfMall(page).catch(() => {}); return; } /* (the 백화점's own way out) */
  await page.evaluate(() => window.PlazaDebug().place('room:exit')); await sleep(1200); await page.keyboard.press('Space');
  await page.waitForFunction(() => window.PlazaDebug().space === 'island', null, { timeout: 30000 }).catch(() => {});
}

(async () => {
  const only = arg('only', '').split(',').filter(Boolean); const devs = arg('devices', 'pc,phone').split(','); const quals = arg('quality', 'high,low').split(',');
  const spots = SPOTS.filter((s) => !only.length || only.includes(s.id));
  await lockBegin(); const touch = setInterval(lockTouch, 5 * 60000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'screen-check-')); const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: ADMIN, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const map = {}; let browser = null;
  try {
    await waitReady(base, server, 60000); fs.mkdirSync(OUT, { recursive: true });
    browser = await chromium.launch({ args: has('no-gpu') ? [] : ['--use-angle=d3d11'] }); const api = await pwRequest.newContext({ baseURL: base });
    for (const device of devs) for (const quality of quals) {
      const { ctx, page } = await enter(browser, api, base, device, quality);
      for (const night of has('no-night') ? [false] : [false, true]) {
        await adminPost(api, '/api/admin/island/time', { mode: night ? 'night' : 'day' }); await sleep(2500); /* (the island's own time: day shots by day whatever the clock) */
        for (const spot of spots.filter((s) => !night || NIGHT.includes(s.id))) {
          const file = `${device}-${quality}-${spot.id}${night ? '-night' : ''}.png`;
          try {
            if (spot.inside) await goInside(page, spot); else { await goOut(page); const p = await resolve(page, spot); if (!p) throw new Error('no standing point'); await page.evaluate((q) => { const d = window.PlazaDebug(); d.teleport(q.x, q.z); if (q.look) d.setCamYaw?.(Math.atan2(q.look.x - q.x, q.look.z - q.z) + Math.PI); d.setCamPitch?.(0.3); }, p); }
            await sleep(3500); await page.screenshot({ path: path.join(OUT, file) }); map[file] = `${spot.label}${night ? ' (밤)' : ''}`; console.log('shot', file);
            fs.writeFileSync(path.join(OUT, 'spots.json'), JSON.stringify(map, null, 1)); /* (365: as it goes -- a run cut short keeps what it took) */
          } catch (error) { console.log('skip', file, error.message.split('\n')[0]); }
          if (spot.inside) await goOut(page);
        }
      }
      await ctx.close();
    }
    fs.writeFileSync(path.join(OUT, 'spots.json'), JSON.stringify(map, null, 1)); console.log(`${Object.keys(map).length} shots -> ${OUT}`);
  } finally {
    clearInterval(touch); await browser?.close().catch(() => {}); server.kill(); lockEnd(); fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); lockEnd(); process.exit(1); });
