'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GAMES, CATEGORIES, SVG, todayGame, inCategory } = require('../public/gamehall-catalog');

// v1.10.73 게임관 카드 (DESIGN.md 「게임관·게임방」): white text on both of a card's colours at 4.5:1 or more, a real
// icon for every card, every room game of the old list once, and 오늘의 게임 the same for everyone on a Seoul date
const root = path.resolve(__dirname, '..');
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const onWhite = (hex) => 1.05 / (lum(hex) + 0.05);

test('게임관 카드: 두 색 모두 흰 글자 대비 4.5:1 이상, 그림이 있고 id가 겹치지 않는다', () => {
  const icons = fs.readFileSync(path.join(root, 'public', 'reflex', 'js', 'icons.js'), 'utf8');
  const art = new Set([...icons.slice(icons.indexOf('const A = ')).matchAll(/^ {2}([a-z0-9]+):/gm)].map((m) => m[1]));
  const cats = new Set(CATEGORIES.map(([id]) => id));
  assert.equal(new Set(GAMES.map((g) => g.id)).size, GAMES.length);
  for (const g of GAMES) {
    for (const c of g.colors) assert.ok(onWhite(c) >= 4.5, `${g.id} ${c} ${onWhite(c).toFixed(2)}`);
    assert.ok(g.svg ? SVG[g.svg] : art.has(g.art), `${g.id} 그림`);
    assert.ok(g.cats.length && g.cats.every((c) => cats.has(c)), `${g.id} 분류`);
    assert.equal(g.how.length, 3, `${g.id} 방법 3줄`);
    assert.equal([g.room, g.set, g.launch].filter(Boolean).length, 1, `${g.id} 여는 곳 하나`);
  }
  const design = fs.readFileSync(path.join(root, 'DESIGN.md'), 'utf8'); // DESIGN.md: a game's colours are in its table first
  for (const g of GAMES) assert.ok(design.includes(`| ${g.name} | \`${g.colors[0]}\` · \`${g.colors[1]}\` |`), `DESIGN.md 색 표: ${g.name}`);
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const rooms = new Set([...html.matchAll(/class="gameChoice[^"]*" data-game="([a-z0-9]+)"/g)].map((m) => m[1]));
  assert.deepEqual([...rooms].sort(), GAMES.filter((g) => g.room).map((g) => g.room).sort());
});

test('게임관: 오늘의 게임은 서울 날짜마다 하나, 준비 중은 고르지 않고, 분류 칩은 그 분류의 게임만', () => {
  const day = Date.parse('2026-10-12T00:00:00+09:00');
  assert.equal(todayGame(day).id, todayGame(day + 86399e3).id);
  assert.notEqual(todayGame(day).id, todayGame(day + 86400e3).id);
  for (let k = 0; k < 40; k += 1) assert.ok(!todayGame(day + k * 86400e3).soon);
  assert.ok(GAMES.filter((g) => inCategory(g, 'ai')).every((g) => g.ai));
  assert.equal(GAMES.filter((g) => inCategory(g, 'all')).length, GAMES.length);
});
