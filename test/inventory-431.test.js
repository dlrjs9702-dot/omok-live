'use strict';
// 1.10.431: the bag's tabs wrap on every screen; 자동 정리 (사용자 결정 91); the admin window's groups fold and its insides on the island's
// paper (총괄 · 사용자 관리자 창 사진 셋, notes docs/admin-paper-20261124.md)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const app = read('public/app.js'); const css = read('public/styles.css').replace(/\/\*[\s\S]*?\*\//g, ''); const html = read('public/index.html'); const server = read('server.js');

test('431 자동 정리: 켬이 기본(사람마다 서버에), 탭 안에서 하위 분류 → 등급 → 이름 → 큰 묶음; 화면의 보여 주기만(서버 순서 안 바꿈), 켜져 있으면 손으로 안 옮김', () => {
  assert.match(server, /if \(pathname === '\/api\/island\/bag\/auto' && req\.method === 'POST'\)/); assert.match(server, /setWorldValue\(`bagAuto:\$\{account\}`, \{ on: body\.on \}\)/);
  assert.match(server, /autoSort: \(await pointStore\.worldValue\(`bagAuto:\$\{account\}`\)\.catch\(\(\) => null\)\)\?\.on !== false/);
  assert.match(app, /if \(bagAuto\) shown\.sort\(\(x, y\) => autoOrder\(bag\.items\[x\], bag\.items\[y\]\)\);/);
  assert.match(app, /return subOf\(a\.itemId\) - subOf\(b\.itemId\) \|\| \(GRADE_RANK\[a\.grade\] \?\? 4\) - \(GRADE_RANK\[b\.grade\] \?\? 4\) \|\| String\(a\.name \|\| a\.itemId\)\.localeCompare/);
  assert.match(app, /if \(bagAuto\) \{ showToast\('자동 정리를 끄면 손으로 옮길 수 있어요\.', 2500\); return; \}/); assert.match(app, /slot\.draggable = !bagAuto;/);
  assert.doesNotMatch(app, /body: JSON\.stringify\(\{ sort: true \}\)/, '자동 정리는 서버 순서를 다시 쓰지 않음');
  assert.match(html, /<button id="islandBagSort" type="button" class="ghost tiny" aria-pressed="true">자동 정리 켬<\/button>/);
});

test('431 관리자 창: 섬 운영의 섬 환경 · 매일 섬 대회 · 운영 스위치도 접히는 묶음, 접힘은 기기에 기억', () => {
  for (const [id, title] of [['islandEnvBox', '섬 환경'], ['contestBox', '매일 섬 대회'], ['opsSwitchBox', '운영 스위치']]) assert.match(html, new RegExp(`<details id="${id}" class="economyBox[^"]*"><summary>${title}</summary>`), id);
  assert.match(app, /for \(const d of document\.querySelectorAll\('#adminPanel details\[id\], #adminPresencePanel details\[id\]'\)\) \{/); assert.match(app, /aaKeep\('gc\.adminOpen', JSON\.stringify\(open\)\)/);
});

test('431 관리자 창 안쪽 섬 종이: 접속 현황 · 계정 줄 · 열쇠 줄 · 계정 자세히(머리 ✕) · 위험 단추 · 포인트 지급 확인, 토큰으로', () => {
  assert.ok(css.includes('body.plazaMode :is(#adminPanel,#adminPresencePanel) :is(.adminStorage,.presenceStats>div,.presenceRow,.keyRow,.signupBand,.accountRow){background:var(--isle-card);border-color:var(--isle-line);color:var(--isle-ink)}'));
  assert.ok(css.includes('body.plazaMode #adminPanel .accountDetail{background:var(--isle-paper);border:1px solid var(--isle-line);color:var(--isle-ink)}'));
  assert.ok(css.includes('body.plazaMode #adminPanel .accountDetailHead>button:last-child::after{content:"✕";font-size:1rem;font-weight:800}'));
  assert.ok(css.includes('body.plazaMode .pointGrantDialog .pointGrantConfirm{background:var(--isle-card);border:1px solid var(--isle-line);color:var(--isle-ink)}'));
  assert.ok(css.includes('.islandBagTabs{display:flex;flex-wrap:wrap;gap:6px;overflow-x:visible;'));
});
