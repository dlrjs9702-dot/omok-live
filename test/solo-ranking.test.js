'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const R = require('../public/solo-ranking');
const { boot } = require('../test-support/test-server');

// v1.10.250 기록의 탑 (gamecenter-notes docs/gamehall-ranking-board-20261103.md §2): 14 games, the better record first (a time
// smaller, a score bigger), a tie to who set it first; the records read as the games show them
test('기록의 탑 순위 규칙: 14종, 시간은 짧을수록·점수는 높을수록, 같으면 먼저 세운 사람', () => {
  assert.equal(R.GAMES.length, 14);
  for (const g of R.GAMES) assert.ok(g.levels.includes(g.board), `${g.id} 게시판 난이도`);
  const rows = [{ userId: 'b', best: 900, at: 2 }, { userId: 'a', best: 900, at: 1 }, { userId: 'c', best: 500, at: 3 }];
  assert.deepEqual(R.rank('minesweeper', rows).map((r) => [r.userId, r.rank]), [['c', 1], ['a', 2], ['b', 3]]);
  assert.deepEqual(R.rank('whack', rows).map((r) => r.userId), ['a', 'b', 'c']);
  assert.equal(R.format('minesweeper', 61_400), '1:01'); assert.equal(R.format('reaction', 212.4), '212ms');
  assert.equal(R.format('sudoku', 192_300), '192.3초'); assert.equal(R.format('whack', 1520), '1,520점'); assert.equal(R.format('colorfind', 12), '12라운드');
});

// (총괄 #400) the islanders' walk grid keeps off the tower's ground (8.55 m along world z, 1.9 m deep): its cells blocked, the
// door before it and the plaza behind it open
test('기록의 탑 자리: 주민 길 격자에서 탑 칸은 막히고 앞뒤는 열림', () => {
  const N = require('../public/plaza/island-npcs'); const T = require('../public/plaza/island-terrain');
  const t = T.RECORD_TOWER; assert.ok(t);
  // (v1.10.253: by its own axes -- along the board a, to the podium's side b; on the long garden, turned)
  const a = [Math.cos(t.yaw), -Math.sin(t.yaw)]; const b = [Math.sin(t.yaw), Math.cos(t.yaw)]; const at = (u, v) => [t.x + a[0] * u + b[0] * v, t.z + a[1] * u + b[1] * v];
  for (const u of [-4.4, -2, 0, 2, 3.1]) assert.equal(N.free(...at(u, 0.4)), false, `탑 칸 ${u}`);
  assert.equal(N.free(...at(0, -5)), true, '앞(게임관) 쪽'); assert.equal(N.free(...at(0, 6)), true, '시상대(광장) 쪽');
  assert.ok(Math.hypot(t.x - 35, t.z + 65) > 10, '옛 자리(게임관 문 앞)는 비움');
});

test('기록의 탑 서버: 이번 주·역대 순위(1~20 + 내 순위), 결과의 이번 주 ○위, 게시판 14종', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tower-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const [a, b] = [await server.enter(await server.issue('탑가')), await server.enter(await server.issue('탑나'))]; assert.ok(a && b, server.logs());
  const clear = async (who, level, ageMs) => {
    const L = { beginner: [9, 9], intermediate: [16, 16] }[level];
    const g = (await req('/api/solo/minesweeper/new', who, { level })).data;
    await req('/api/solo/minesweeper/act', who, { id: g.id, action: 'open', x: 4, y: 4 });
    const mines = new Set((await req('/api/test/solo/peek', who, { ageMs })).data.mines);
    let last; for (let i = 0; i < L[0] * L[1]; i += 1) if (!mines.has(i)) { last = (await req('/api/solo/minesweeper/act', who, { id: g.id, action: 'open', x: i % L[0], y: Math.floor(i / L[0]) })).data; if (last.view.status === 'won') break; }
    assert.equal(last.view.status, 'won'); return last.result;
  };
  assert.equal((await clear(a, 'beginner', 60_000)).weekRank, 1);
  assert.equal((await clear(b, 'beginner', 30_000)).weekRank, 1, '더 빠른 기록이 1위');
  const week = (await req('/api/solo/ranking?game=minesweeper&level=beginner', a)).data;
  assert.equal(week.period, 'week'); assert.equal(week.total, 2);
  assert.deepEqual(week.rows.map((r) => [r.rank, r.name, r.me]), [[1, '탑나', false], [2, '탑가', true]]);
  assert.deepEqual([week.me.rank, week.me.name], [2, '탑가']);
  const all = (await req('/api/solo/ranking?game=minesweeper&level=beginner&period=all', b)).data;
  assert.equal(all.rows[0].name, '탑나'); assert.equal(all.me.rank, 1);
  assert.equal((await req('/api/solo/ranking?game=nope', a)).status, 400);
  assert.equal((await req('/api/solo/ranking?game=minesweeper&level=huge', a)).status, 400);
  // the board: 14 games at their board level (지뢰찾기 중급) -- one clear there shows; the others empty
  await clear(a, 'intermediate', 90_000);
  const board = (await req('/api/solo/board', b)).data;
  assert.equal(board.games.length, 14); assert.ok(board.endsAt > Date.now());
  const ms = board.games.find((g) => g.game === 'minesweeper');
  assert.equal(ms.level, 'intermediate'); assert.deepEqual(ms.top.map((r) => [r.rank, r.name]), [[1, '탑가']]); assert.equal(ms.allTime.name, '탑가'); assert.equal(ms.title, '지뢰 탐정');
  assert.deepEqual(board.games.find((g) => g.game === 'sudoku').top, []);
  // (v1.10.251 정산) the week settled as from next week: 지뢰찾기 중급's 1st (탑가) its gold trophy in the storage with its plate,
  // once however often it runs; its title held the week after; 내 업적 counts it, and someone else sees the count
  const next = Date.now() + 7 * 86400000;
  const settled = (await req('/api/test/solo/settle', a, { now: next, asCurrent: true })).data.record;
  assert.equal(settled.games.minesweeper[0].name, '탑가'); assert.equal(settled.games.sudoku.length, 0);
  await req('/api/test/solo/settle', a, { now: next, asCurrent: true });
  const mine = (await req('/api/island/furniture/mine', a)).data.pieces.filter((p) => p.id.startsWith('yard_trophy_'));
  assert.deepEqual(mine.map((p) => p.id), ['yard_trophy_mines__gold'], '한 번만');
  assert.match(mine[0].plate, /^지뢰 탐정 · 탑가 · \d{4}년 \d+월 \d주$/); assert.equal(mine[0].name, '지뢰 탐정 금 트로피');
  assert.match(mine[0].line, /^지뢰 탐정 · 탑가 · \d+월 \d주 · 기록 \S+/); /* (§3-1: the line it shows when pressed) */
  assert.ok((await req('/api/island/mail', a)).data.letters.some((l) => l.from === 'gamehall' && /^지뢰찾기 \d{4}년 \d+월 \d주 1위! 지뢰 탐정 금 트로피가 창고에 들어왔어요/.test(l.text)));
  assert.ok((await req('/api/skins', a)).data.dexTitles.some((t) => t.id === 'title_solo_minesweeper'), '칭호');
  assert.ok(!(await req('/api/skins', b)).data.dexTitles.some((t) => t.id === 'title_solo_minesweeper'));
  const awards = (await req('/api/solo/awards', a)).data;
  assert.equal(awards.trophies, 1); const ms2 = awards.games.find((g) => g.game === 'minesweeper');
  assert.deepEqual(ms2.trophies, { gold: 1, silver: 0, bronze: 0 }); assert.deepEqual(ms2.levels.map((l) => [l.level, l.place]), [['beginner', 2], ['intermediate', 1]]);
  const accountA = (await req('/api/solo/ranking?game=minesweeper&level=intermediate', a)).data.rows[0];
  assert.equal(accountA.name, '탑가');
  const hall = (await req('/api/island/titles', b)).data.titles.find((t) => t.id === 'solo_minesweeper');
  assert.equal(hall.name, '지뢰 탐정'); assert.deepEqual(hall.entries.map((e) => e.names), [['탑가']]);
});
