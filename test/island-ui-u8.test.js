'use strict';
// U8 남은 화면 정리 (notes docs/ui-review-20261121.md A9 · C6 · C8 · C9 · C10 · D5 · P4, docs/stamp-overflow-20261123.md §3 #2 #3 #4, 결정 83 A)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../public/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\r\n/g, '\n');
const app = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

test('U8 가방: 칸 메뉴는 첫 열 · 끝 열에서 창 안, PC는 종류 탭 · 기록의 탑 칩 줄바꿈, 폰은 가방 한 줄 세로(빠른 칸이 물결 안)', () => {
  assert.match(app, /menu\.className = `bagMenu\$\{at < bagCols\(\) \? ' below' : ''\}\$\{col === 0 \? ' atStart' : col === bagCols\(\) - 1 \? ' atEnd' : ''\}`/); /* (430: its place in the tab shown) */
  assert.ok(css.includes('#islandBagDialog.bagPouch .bagMenu.atStart{left:0;transform:none}') && css.includes('#islandBagDialog.bagPouch .bagMenu.atEnd{left:auto;right:0;transform:none}'));
  /* (1.10.431: the bag tabs wrap on every screen -- a touch-capable PC said coarse and its tabs were cut; the tower chips wherever a mouse is or the window is wide) */
  assert.ok(css.includes('.islandBagTabs{display:flex;flex-wrap:wrap;gap:6px;overflow-x:visible;'));
  assert.ok(css.includes('@media (pointer:fine),(any-pointer:fine),(min-width:900px){.recordTowerGames{flex-wrap:wrap;overflow-x:visible}}'));
  assert.ok(!/@media \(pointer:fine\)\{\.islandBagTabs/.test(css), 'no pointer-only rule for the bag tabs');
  assert.ok(css.includes('@media (pointer:coarse){#islandBagDialog.bagPouch[open]{display:flex;flex-direction:column;max-height:calc(100dvh - 40px)}'));
});

test('U8 옷가게(D5 · A9): 섬에서 아래 닫기 · 포인트 숨김, 거르기 한 줄 + 더 보기', () => {
  assert.ok(css.includes('body.plazaMode .dressBar .dressClose,body.plazaMode .skinShopDialog .dressBar .dressPoints{display:none}'));
  assert.ok(css.includes('body.plazaMode .skinFilterBar.chipsFolded .skinChipsMore{display:none}'));
  assert.match(app, /more\.textContent = open \? '접기' : '더 보기'/); assert.match(app, /f\.more = bar\.classList\.contains\('chipsFolded'\);/);
});

test('U8 포인트 알약(C9) · 빈 목록 글(C10) · 모서리(C8)', () => {
  assert.match(css, /body\.plazaMode :is\(#skinShopBalance,#donationBalance,#pointBalanceText\):not\(:empty\)\{display:inline-block;padding:4px 12px 4px 30px;border-radius:999px;background:url\("\/assets\/items\/point\.svg"\)/);
  assert.match(css, /:is\(\.emptyState,\.noticeEmpty,\.rankingEmpty,\.chatEmpty,\.climbRankEmpty,\.recordTowerEmpty\)\{color:var\(--isle-soft\);text-align:center/);
  for (const sel of ['.dressing .skinCard{', '.dressDetail{', '.dressBar{', '.isle-choice{', '.islandDexCell{']) { const at = css.indexOf(sel); assert.ok(at >= 0, sel); const body = css.slice(at, css.indexOf('}', at)); const m = body.match(/border-radius:\s*([^;}]+)/); if (m) assert.equal(m[1].trim().split(/\s+/)[0], '12px', sel); }
});
