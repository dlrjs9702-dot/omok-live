'use strict';
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');

// v1.10.72 게임방 AI 자리 (사용자 2026-10-12): 오목·사목·오델로 rooms where the server plays the other seat with the
// 한판마당 AI — private, no entry points, no match record (so no missions or ranking), one person per AI room.
const waitFor = async (check, what, tries = 100) => {
  for (let i = 0; i < tries; i += 1) { const v = await check(); if (v) return v; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error(what);
};

test('게임방 AI: 자리를 고르면 AI가 맞은편에, 두면 AI가 받아 두고, 참가 포인트·전적 없음', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'room-ai-'));
  rmAtExit(dir); /* (after the servers stop: test-support/rm-at-exit) */
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('AI상대')); assert.ok(a, server.logs());
  const b = await server.enter(await server.issue('구경꾼'));
  const balance = async () => (await req('/api/points', a)).data.balance;
  assert.equal((await req('/api/rooms', a, { gameType: 'bingo', ai: 'easy' })).status, 400, 'AI와 둘 수 없는 게임');
  assert.equal((await req('/api/rooms', a, { gameType: 'connect4', ai: 'genius' })).status, 400);
  const created = (await req('/api/rooms', a, { gameType: 'connect4', visibility: 'public', ai: 'normal' })).data.state;
  assert.equal(created.visibility, 'private', 'AI 방은 비공개 연습');
  assert.deepEqual([created.points.policy, created.points.entryFee], ['practice', 0]); // shown as free practice (Codex review)
  const before = await balance();
  assert.equal((await req('/api/room/choose-role', a, { choice: 'white' })).status, 200); // the AI takes 흑(빨강) and moves first
  const room = () => req('/api/room', a).then((r) => r.data.state);
  const stones = (s) => s.game.board.flat().filter(Boolean);
  let state = await waitFor(async () => { const s = await room(); return stones(s).length === 1 && s; }, 'AI가 먼저 두지 않았습니다');
  assert.equal(state.game.status, 'playing');
  assert.deepEqual(stones(state), ['black']);
  assert.ok(state.participants.some((p) => p.label === 'AI · 보통' && p.seat === 'black'));
  assert.equal(await balance(), before, '참가 포인트 없음');
  // a second person cannot take the AI's seat
  await req('/api/rooms/join', b, { code: created.me.roomCode });
  assert.equal((await req('/api/room/choose-role', b, { choice: 'black' })).status, 409);
  const col = [0, 1, 2, 3, 4, 5, 6].find((c) => !state.game.board[0][c]);
  assert.equal((await req('/api/room/move', a, { x: col, y: 0 })).status, 200);
  state = await waitFor(async () => { const s = await room(); return stones(s).length === 3 && s; }, 'AI가 받아 두지 않았습니다');
  assert.equal(state.game.turn, 'white');
  assert.equal((await req('/api/room/resign', a, {})).status, 200);
  state = await room();
  assert.equal(state.game.status, 'finished');
  assert.equal((await req('/api/records/me', a)).data.total.played, 0, '전적 없음');
  assert.equal(await balance(), before);
  // the next round: choose again, the AI sits across once more
  assert.equal((await req('/api/room/next-round', a, {})).status, 200);
  assert.equal((await req('/api/room/choose-role', a, { choice: 'black' })).status, 200);
  state = await room();
  assert.equal(state.game.status, 'playing');
  assert.ok(state.participants.some((p) => p.label === 'AI · 보통' && p.seat === 'white'));
  // 윷놀이 (v1.10.307 실제 규칙 A, notes docs/yut-real-rules-20261109.md 2): the AI throws on its turn, uses its kept results,
  // then the turn is mine -- practice too
  await req('/api/room/leave', a, {}); await req('/api/room/leave', b, {});
  const yr = await req('/api/rooms', a, { gameType: 'yut', ai: 'normal' }); assert.equal(yr.status, 201, JSON.stringify(yr.data));
  assert.equal((await req('/api/room/choose-role', a, { choice: 'white' })).status, 200);
  state = await waitFor(async () => { const s = await room(); return s.game.throwCount > 0 && s.game.turn === 'white' && s.game.phase === 'throw' && s; }, 'AI가 윷을 던지고 차례를 넘기지 않았습니다');
  assert.equal(state.game.status, 'playing'); assert.ok(state.participants.some((p) => p.label === 'AI · 보통' && p.seat === 'black'));
  assert.equal((await req('/api/room/throw-yut', a, {})).status, 200);
  // 윷놀이 B 「AI와 하기」: four seats, mine 노랑 -- the three others AIs, each its own turn, then mine
  await req('/api/room/leave', a, {});
  const y4 = await req('/api/rooms', a, { gameType: 'yut', ai: 'normal', players: 4 }); assert.equal(y4.status, 201, JSON.stringify(y4.data));
  assert.equal((await req('/api/rooms', a, { gameType: 'yut', players: 5 })).status, 400);
  assert.equal((await req('/api/room/choose-role', a, { choice: 'yellow' })).status, 200);
  state = await room(); assert.equal(state.game.status, 'playing'); assert.deepEqual(state.game.seatOrder, ['black', 'white', 'green', 'yellow']);
  assert.deepEqual(state.participants.filter((p) => /^AI · 보통 \d$/.test(p.label)).map((p) => p.seat).sort(), ['black', 'green', 'white']);
  state = await waitFor(async () => { const s = await room(); return s.game.turn === 'yellow' && s.game.phase === 'throw' && s; }, 'AI 셋이 차례를 넘기지 않았습니다', 400); /* (three AIs, each maybe throwing again on 윷·모·잡기: up to 40 s) */
  assert.ok(state.game.throwCount >= 3); assert.equal(state.game.pieceCount, 3);
});

// 윷놀이 C (notes yut-real-rules 「나누기」): in a people's 4-seat room the host fills the empty seats with AIs (no entry
// points), a leaver's seat is played on by an AI and kept as their loss, the next round keeps the 4 seats without the AIs
test('윷놀이 C: 빈자리 AI, 나간 자리 AI가 이어 두기, 사람만 기록, 다음 판 4자리', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'yut-c-'));
  rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('윷방장')); const b = await server.enter(await server.issue('윷손님'));
  const room = (tok) => req('/api/room', tok).then((r) => r.data.state);
  const made = await req('/api/rooms', a, { gameType: 'yut', players: 4, visibility: 'public', stakes: true }); assert.equal(made.status, 201, JSON.stringify(made.data));
  assert.equal(made.data.state.points.policy, 'entry');
  const balance = async (tok) => (await req('/api/points', tok)).data.balance; const before = [await balance(a), await balance(b)];
  assert.equal((await req('/api/rooms/join', b, { code: made.data.state.me.roomCode })).status, 200);
  assert.equal((await req('/api/room/fill-ai', b, {})).status, 403, '방장만');
  assert.equal((await req('/api/room/choose-role', a, { choice: 'black' })).status, 200);
  assert.equal((await req('/api/room/choose-role', b, { choice: 'green' })).status, 200);
  const filled = await req('/api/room/fill-ai', a, {}); assert.equal(filled.status, 200, JSON.stringify(filled.data));
  let s = filled.data.state; assert.equal(s.game.status, 'playing'); assert.deepEqual(s.game.seatOrder, ['black', 'white', 'green', 'yellow']);
  assert.deepEqual(s.participants.filter((p) => /^AI · 보통 \d$/.test(p.label)).map((p) => p.seat).sort(), ['white', 'yellow']);
  assert.equal(s.points.policy, 'friendly', 'AI가 있는 판은 포인트 없음');
  assert.deepEqual([await balance(a), await balance(b)], before, '참가 포인트를 걷지 않음');
  // 손님이 나가면 초록 자리를 AI가 이어 둔다
  assert.equal((await req('/api/room/leave', b, {})).status, 200);
  s = await room(a); const green = s.participants.find((p) => p.seat === 'green');
  assert.ok(green && green.label === 'AI · 이어 둠 (윷손님)', JSON.stringify(s.participants));
  assert.equal(s.game.status, 'playing'); assert.equal(s.game.paused, false);
  // 방장이 기권하면 남은 사람이 없어 판이 끝나고, 두 사람 모두 패로 기록된다(4명 판: yut4)
  assert.equal((await req('/api/room/resign', a, {})).status, 200);
  s = await room(a); assert.equal(s.game.status, 'finished'); assert.equal(s.game.winner, 'white');
  for (const tok of [a, b]) { const r = (await req('/api/records/me', tok)).data; assert.equal(r.total.played, 1, JSON.stringify(r)); assert.equal(r.total.losses, 1); assert.equal(r.byGame.yut4?.played, 1); }
  // 다음 판: 네 자리 그대로, AI는 나감
  assert.equal((await req('/api/room/next-round', a, {})).status, 200);
  s = await room(a); assert.equal(s.game.status, 'selecting'); assert.equal(s.game.seatOrder.length, 4);
  assert.equal(s.participants.filter((p) => /^AI/.test(p.label)).length, 0);
  assert.equal((await req('/api/room/choose-role', a, { choice: 'yellow' })).status, 200, '노랑 자리가 남아 있음');
});

// Codex 301~310 #1 (P1): a 내기 game where an AI took over a leaver's seat and then won -- recorded (the people, the leaver's
// loss) and its entry settled: those who stayed share the pool (it never stays held)
test('Codex #1: 나간 자리를 이어 받은 AI가 이긴 내기 판도 기록·정산', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai-last-move-'));
  rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const [a, b, c] = [await server.enter(await server.issue('내기방장')), await server.enter(await server.issue('내기둘')), await server.enter(await server.issue('내기셋'))];
  for (const tok of [a, b, c]) assert.equal((await req('/api/test/points-credit', tok, { amount: 50000 })).status, 200);
  const made = await req('/api/rooms', a, { gameType: 'yut', players: 3, visibility: 'public', stakes: true }); assert.equal(made.status, 201, JSON.stringify(made.data));
  for (const tok of [b, c]) assert.equal((await req('/api/rooms/join', tok, { code: made.data.state.me.roomCode })).status, 200);
  const balance = async (tok) => (await req('/api/points', tok)).data.balance; const before = await balance(a);
  for (const [tok, seat] of [[a, 'black'], [b, 'white'], [c, 'green']]) assert.equal((await req('/api/room/choose-role', tok, { choice: seat })).status, 200);
  let s = (await req('/api/room', a)).data.state; assert.equal(s.game.status, 'playing'); assert.equal(s.points.entry?.status, 'charged', JSON.stringify(s.points));
  assert.ok(await balance(a) < before, '참가비');
  assert.equal((await req('/api/room/leave', b, {})).status, 200); /* (빨강's seat to an AI) */
  assert.equal((await req('/api/test/yut-near-end', a, { seat: 'white' })).status, 200);
  const waitFor = async (check, what) => { for (let i = 0; i < 100; i += 1) { const v = await check(); if (v) return v; await new Promise((r) => setTimeout(r, 100)); } throw new Error(what); };
  s = await waitFor(async () => { const st = (await req('/api/room', a)).data.state; return st.game.status === 'finished' && st.points.entry?.status === 'settled' && st; }, 'AI의 마지막 수로 끝난 판이 정산되지 않았습니다');
  assert.equal(s.game.winner, 'white');
  assert.equal(s.points.entry.winners, 2, '남은 두 사람이 나눔');
  assert.ok(await balance(a) > before - 1000 * 0.5, '판돈이 사라지지 않음');
  for (const tok of [a, b, c]) { const r = (await req('/api/records/me', tok)).data; assert.equal(r.byGame.yut3?.losses, 1, JSON.stringify(r)); }
});
