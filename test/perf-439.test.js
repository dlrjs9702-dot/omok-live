'use strict';
// 1.10.439 ④ 엔진 대신 셋 -- 폰 실측 P1 (notes docs/engine-borrow-feasibility-20261122.md §3-4, docs/phone-perf-20261128.md): the scene not composing
// itself each frame; a hidden top-level thing not walked; 「성능 재기」 (관리자만) -- plaza perfRun, the admin's button, one `[perf]` line on the server
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { boot, sleep } = require('../test-support/test-server');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('439 장면: 장면은 스스로 다시 계산하지 않음 · 숨은 맨 위 물체는 훑지 않고 보일 때 한 번에', () => {
  const s = read('public/plaza/plaza-scene.js');
  assert.match(s, /const scene = new THREE\.Scene\(\);[\s\S]{0,600}scene\.matrixAutoUpdate = false;/);
  assert.match(s, /for \(const o of scene\.children\) \{ const v = o\.visible; if \(o\.matrixWorldAutoUpdate !== v\) \{ o\.matrixWorldAutoUpdate = v; if \(v\) o\.updateMatrixWorld\(true\); \} \}/);
  assert.match(s, /b\.matrixWorldNeedsUpdate = true;/); assert.match(s, /k\.matrixWorldNeedsUpdate = true;/);
});

test('439 성능 재기: 다섯 곳 · 낮음 · 높음 · 정류장 앞은 건물 구멍 있고 없이, 화질과 구멍은 원래대로', () => {
  const s = read('public/plaza/plaza-scene.js');
  assert.match(s, /const PERF_PLACES = \[\['plaza', 0, -80, 1\.5708\], \['stop', 9\.3, -51\.6, 1\.5708, true\], \['bridge', 196, 226, -1\.5708\], \['street', -2\.2, 234\.6, -1\.5708\], \['forest', -100, -20, 0\]\];/);
  assert.match(s, /async function perfRun\(\{ warp, tiers = \[0, 2\], ms = 3000, onStep = null \} = \{\}\)/);
  assert.match(s, /finally \{ seeHold = null; setQualityMode\(held \? String\(was\) : 'auto'\); perfBusy = false; \}/);
  assert.match(s, /if \(seeHold != null\) \{ seeWant = seeHold; cliffWant = seeHold; \}/);
  assert.match(s, /return \{ perfRun \/\*/); assert.match(s, /furnShot \/\* \(437\) \*\/, perfRun \/\*/);
  const a = read('public/app.js'); assert.match(a, /byId\('perfRunBtn'\)\?\.addEventListener\('click'/); assert.match(a, /api\('\/api\/admin\/perf', \{ method: 'POST'/);
  assert.match(read('public/index.html'), /<details id="perfBox" class="economyBox"><summary>성능 재기<\/summary>/);
});

test('439 [perf] 줄: 관리자만, 숫자와 다섯 곳 이름만(계정 · 이름 없음), 1분에 한 번', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'perf439-')); rmAtExit(dir);
  const s = await boot(t, dir); const { req, issue, enter } = s;
  const guest = await enter(await issue('성능손님'));
  const body = { phone: true, gpu: 'ANGLE (ARM, Mali-G78, OpenGL ES 3.2)<script>', dpr: 2.81, px: '540x1065', name: '누군가', rows: [{ place: 'plaza', tier: 2, see: true, fps: 55.8, p50: 16.7, p95: 33.4, over50: 0, js: 17.5, calls: 256, tris: 545267, who: 'x' }, { place: 'home of someone', tier: 2, fps: 1 }] };
  assert.equal((await req('/api/admin/perf', guest, body)).status, 403, 'not for a player');
  const ok = await req('/api/admin/perf', s.admin, body); assert.equal(ok.status, 200); assert.equal(ok.data.rows, 1, 'only the five places');
  assert.equal((await req('/api/admin/perf', s.admin, body)).status, 429, 'once a minute');
  let line = ''; for (let k = 0; k < 20 && !line; k += 1) { line = s.logs().split('\n').find((l) => l.startsWith('[perf] ')) || ''; if (!line) await sleep(100); }
  const j = JSON.parse(line.slice(7)); assert.equal(j.phone, true); assert.equal(j.gpu, 'ANGLE (ARM, Mali-G78, OpenGL ES 3.2)script'); assert.equal(j.px, '540x1065');
  assert.deepEqual(Object.keys(j.rows[0]).sort(), ['calls', 'fps', 'js', 'over50', 'p50', 'p95', 'place', 'see', 'tier', 'tris']);
  assert.ok(!/누군가|성능손님|"who"|"name"/.test(line), 'no name, no account');
});
