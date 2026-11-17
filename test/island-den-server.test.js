'use strict';
// 1.10.341 지하 도박장 through the real server: the note's word (on its bench), the word to 테드 opens the bookcase (a wrong one does
// not), 테드's chips (points out, once a request), down the stairs, a play at the dice table (a second apart), a raid -- the 관공서
// shut, whoever is below caught: chips taken, the cell, the gambling essay (its first line 「다시는 지하에 내려가지 않겠습니다」)
const rmAtExit = require('../test-support/rm-at-exit');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const EX = require('../public/plaza/island-exchange');
const DR = require('../public/plaza/island-den-room');
const J = require('../public/plaza/island-jail');
const T = require('../public/plaza/island-terrain');

test('도박장 서버: 쪽지 암호 → 테드에게 → 칩 → 지하 → 주사위 → 단속(관공서 닫힘, 칩 몰수, 구치소, 도박 반성문)', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'den-')); rmAtExit(dir);
  const server = await boot(t, dir); const { req } = server;
  const a = await server.enter(await server.issue('지하손님')); const b = await server.enter(await server.issue('쪽지찾는이'));
  await req('/api/test/points-credit', a, { amount: 100000 });
  const stand = (who, p) => req('/api/plaza/state', who, { x: p.x, z: p.z, yaw: 0, moving: false });
  const bal = async () => (await req('/api/points', a)).data.balance;
  const day = (await req('/api/test/den', a, {})).data;
  assert.ok(day.word && day.note, JSON.stringify(day));
  // the note: read on its bench only
  await stand(b, { x: day.note.x + 20, z: day.note.z }); assert.equal((await req('/api/island/den/note', b, {})).data.error, 'TOO_FAR');
  await stand(b, day.note); assert.equal((await req('/api/island/den/note', b, {})).data.word, day.word);
  // into the exchange, the word to 테드
  await stand(a, T.facilityDoor('stocks')); assert.equal((await req('/api/island/exchange/enter', a, {})).status, 200);
  await stand(a, DR.DOOR.stand ? EX.world(DR.DOOR.stand.lx, DR.DOOR.stand.lz) : {}); assert.equal((await req('/api/island/den/enter', a, {})).data.error, 'DEN_SHUT', '암호 전에는 그냥 책장');
  await stand(a, EX.world(EX.TALK.lx, EX.TALK.lz));
  assert.equal((await req('/api/island/den/chips', a, { side: 'buy', amount: 1000, requestId: crypto.randomUUID() })).data.error, 'DEN_PASS', '1.10.345: 암호 전에는 칩을 안 바꿔 줌');
  assert.equal((await req('/api/island/den', a)).data.chips, 0);
  assert.equal((await req('/api/island/den/word', a, { word: '아무 말' })).data.open, false);
  assert.equal((await req('/api/island/den/word', a, { word: day.word.replace(/\s+/g, '') })).data.open, true, '띄어쓰기 없이도');
  const before = await bal(); const rid = crypto.randomUUID();
  const ch = await req('/api/island/den/chips', a, { side: 'buy', amount: 3000, requestId: rid }); assert.equal(ch.status, 200, JSON.stringify(ch.data)); assert.equal(ch.data.chips, 3000);
  assert.equal(await bal(), before - 3000); assert.equal((await req('/api/island/den/chips', a, { side: 'buy', amount: 3000, requestId: rid })).status, 409, '같은 요청은 한 번');
  // down the stairs, a play
  await stand(a, EX.world(DR.DOOR.stand.lx, DR.DOOR.stand.lz)); const down = await req('/api/island/den/enter', a, {}); assert.equal(down.status, 200, JSON.stringify(down.data)); assert.equal(down.data.space, 'den');
  const dice = DR.TABLES.find((x) => x.id === 'dice'); await stand(a, DR.world(dice.spot.lx, dice.spot.lz));
  assert.equal((await req('/api/island/den/play', a, { game: 'roulette', bet: 10, pick: 'red', requestId: crypto.randomUUID() })).data.error, 'TOO_FAR', '룰렛은 룰렛 앞에서');
  const p1 = await req('/api/island/den/play', a, { game: 'dice', bet: 100, pick: 'big', requestId: crypto.randomUUID() }); assert.equal(p1.status, 200, JSON.stringify(p1.data));
  assert.equal(p1.data.outcome.dice.length, 3); assert.equal(p1.data.chips, 3000 - 100 + p1.data.back); assert.ok(p1.data.back === 0 || p1.data.back === 196);
  assert.equal((await req('/api/island/den/play', a, { game: 'dice', bet: 100, pick: 'big', requestId: crypto.randomUUID() })).data.error, 'DEN_FAST', '1초에 한 판');
  assert.equal(await bal(), before - 3000, '판은 칩으로만');
  // a raid: the 관공서 shut; they come down -- chips taken, the cell, the gambling essay
  await req('/api/test/den', a, { raid: true, walkM: 2 });
  await stand(b, T.facilityDoor('townhall')); assert.equal((await req('/api/island/townhall/enter', b, {})).data.error, 'TOWNHALL_AWAY');
  await req('/api/test/den', a, { tick: true });
  assert.equal((await req('/api/island/den', a)).data.chips, 0, '칩 몰수');
  await stand(a, DR.world(dice.spot.lx, dice.spot.lz));
  const jail = (await req('/api/island/jail', a)).data; assert.equal(jail.inmate, true, JSON.stringify(jail)); assert.equal(jail.gamble, true);
  const essay = (await req('/api/island/jail/start', a, {})).data; assert.equal(essay.sentence, J.GAMBLE_FIRST); assert.equal(essay.count, 5);
  await req('/api/test/den', a, { end: true }); assert.equal((await req('/api/island/townhall/enter', b, {})).status, 200, '단속 끝나면 다시 열림');
});
