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
  // (1.10.346 154A) the admin sees today's word and the bench; a player never (403)
  const adm = (await req('/api/admin/den/today', server.admin)).data; assert.equal(adm.word, day.word); assert.equal(adm.note.x, day.note.x); assert.match(adm.note.where, /^대청마당 분수에서 .+쪽 \d+ m · 벤치 /);
  assert.notEqual((await req('/api/admin/den/today', a)).status, 200); assert.ok(!JSON.stringify((await req('/api/island/den', a)).data).includes(day.word), '일반 응답에 암호 없음');
  // the note: read on its bench only
  await stand(b, { x: day.note.x + 20, z: day.note.z }); assert.equal((await req('/api/island/den/note', b, {})).data.error, 'TOO_FAR');
  await stand(b, day.note); assert.equal((await req('/api/island/den/note', b, {})).data.word, day.word);
  // into the exchange, the word to 테드
  await stand(a, T.facilityDoor('stocks')); assert.equal((await req('/api/island/exchange/enter', a, {})).status, 200);
  await stand(a, DR.DOOR.stand ? EX.world(DR.DOOR.stand.lx, DR.DOOR.stand.lz) : {}); assert.equal((await req('/api/island/den/enter', a, {})).data.error, 'DEN_SHUT', '암호 전에는 그냥 책장');
  await stand(a, EX.world(EX.TALK.lx, EX.TALK.lz));
  assert.equal((await req('/api/island/den/chips', a, { side: 'buy', amount: 1000, requestId: crypto.randomUUID() })).data.error, 'TOO_FAR', '1.10.350: 테드는 칩을 바꿔 주지 않음 (아래 바에서)');
  assert.equal((await req('/api/island/den', a)).data.chips, 0);
  assert.equal((await req('/api/island/den/word', a, { word: '아무 말' })).data.open, false);
  assert.equal((await req('/api/island/den/word', a, { word: day.word.replace(/\s+/g, '') })).data.open, true, '띄어쓰기 없이도');
  const bar = DR.world(DR.BAR.stand.lx, DR.BAR.stand.lz); const dice = DR.TABLES.find((x) => x.id === 'dice');
  // (1.10.350 체납 불이익) owing: the bookcase shut, no chips
  await req('/api/test/jail', a, { debt: 5000 }); await stand(a, EX.world(DR.DOOR.stand.lx, DR.DOOR.stand.lz)); assert.equal((await req('/api/island/den/enter', a, {})).data.error, 'IN_ARREARS', '체납 중에는 못 내려감'); await req('/api/test/jail', a, { debt: 0 });
  // (1.10.350 사용자 「안쪽 바텐더에게」) the word is enough to go down; no table before the bar
  await stand(a, EX.world(DR.DOOR.stand.lx, DR.DOOR.stand.lz)); const down = await req('/api/island/den/enter', a, {}); assert.equal(down.status, 200, JSON.stringify(down.data)); assert.equal(down.data.space, 'den');
  await stand(a, DR.world(dice.spot.lx, dice.spot.lz)); assert.equal((await req('/api/island/den/play', a, { game: 'dice', bet: 100, pick: 'big', requestId: crypto.randomUUID() })).data.error, 'DEN_NOCHIPS', '바꾸기 전에는 탁자 못 씀');
  assert.equal((await req('/api/island/den/chips', a, { side: 'buy', requestId: crypto.randomUUID() })).data.error, 'TOO_FAR', '탁자 앞에서는 못 바꿈');
  { // (c, its own: the whole 100,000P in at the bar, 10,000 back -- a wallet under 50,000P: nothing changed)
    const c = await server.enter(await server.issue('빈지갑손님')); await stand(c, T.facilityDoor('stocks')); await req('/api/island/exchange/enter', c, {}); await stand(c, EX.world(EX.TALK.lx, EX.TALK.lz)); assert.equal((await req('/api/island/den/word', c, { word: day.word })).data.open, true);
    await stand(c, EX.world(DR.DOOR.stand.lx, DR.DOOR.stand.lz)); assert.equal((await req('/api/island/den/enter', c, {})).status, 200); await stand(c, bar);
    assert.equal((await req('/api/island/den/chips', c, { side: 'buy', requestId: crypto.randomUUID() })).status, 200); assert.equal((await req('/api/island/den/chips', c, { side: 'sell', amount: 10000, requestId: crypto.randomUUID() })).status, 200);
    const bb = (await req('/api/points', c)).data.balance; assert.equal(bb, 10000); const no = await req('/api/island/den/chips', c, { side: 'buy', requestId: crypto.randomUUID() }); assert.equal(no.data.error, 'DEN_MIN', JSON.stringify(no.data)); assert.equal((await req('/api/points', c)).data.balance, bb);
    // up the stairs: the chips left back as points
    const ex = DR.world(DR.ROOM.exit.lx, DR.ROOM.exit.lz); await stand(c, ex); const up = await req('/api/island/den/leave', c, {}); assert.equal(up.status, 200, JSON.stringify(up.data)); assert.equal(up.data.cashed, 90000);
    assert.equal((await req('/api/points', c)).data.balance, 100000, '남은 칩은 포인트로'); assert.equal((await req('/api/island/den', c)).data.chips, 0);
  }
  await stand(a, bar); const before = await bal(); const rid = crypto.randomUUID(); const look = (await req('/api/island/den', a)).data; assert.equal(look.wallet, before); assert.equal(look.entry, false);
  const ch = await req('/api/island/den/chips', a, { side: 'buy', amount: 3000, requestId: rid }); assert.equal(ch.status, 200, JSON.stringify(ch.data)); assert.equal(ch.data.chips, before, '지갑 전부'); assert.equal(ch.data.entry, true);
  assert.equal(await bal(), 0, '지갑이 0'); assert.equal((await req('/api/island/den/chips', a, { side: 'buy', requestId: rid })).status, 409, '같은 요청은 한 번');
  // a play at the dice
  await stand(a, DR.world(dice.spot.lx, dice.spot.lz));
  assert.equal((await req('/api/island/den/play', a, { game: 'roulette', bet: 10, pick: 'red', requestId: crypto.randomUUID() })).data.error, 'TOO_FAR', '룰렛은 룰렛 앞에서');
  const p1 = await req('/api/island/den/play', a, { game: 'dice', bet: 100, pick: 'big', requestId: crypto.randomUUID() }); assert.equal(p1.status, 200, JSON.stringify(p1.data));
  assert.equal(p1.data.outcome.dice.length, 3); assert.equal(p1.data.chips, before - 100 + p1.data.back); assert.ok(p1.data.back === 0 || p1.data.back === 196);
  assert.equal((await req('/api/island/den/play', a, { game: 'dice', bet: 100, pick: 'big', requestId: crypto.randomUUID() })).data.error, 'DEN_FAST', '1초에 한 판');
  assert.equal(await bal(), 0, '판은 칩으로만');
  // (1.10.346) money into the wallet while below stays there; below 5,000 chips after a play -- the rest back 1:1, out to the exchange
  await req('/api/test/points-credit', a, { amount: 10000 }); assert.equal(await bal(), 10000, '지하에 있는 동안 들어온 돈은 지갑에 그대로');
  await req('/api/test/den/chips', a, { chips: 3 }); await new Promise((r) => { setTimeout(r, 1100); });
  const low = await req('/api/island/den/play', a, { game: 'dice', bet: 1, pick: 'big', requestId: crypto.randomUUID() }); assert.equal(low.status, 200, JSON.stringify(low.data));
  assert.equal(low.data.kicked?.space, 'exchange', '칩 5,000 아래 -- 쫓겨남'); assert.equal(await bal(), 10000 + low.data.kicked.refund, '남은 칩은 포인트로'); assert.equal((await req('/api/island/den', a)).data.chips, 0);
  // in again (the word is today's), but the tables only after the whole wallet at the bar again
  await req('/api/test/points-credit', a, { amount: 60000 }); await stand(a, EX.world(DR.DOOR.stand.lx, DR.DOOR.stand.lz)); const again = await req('/api/island/den/enter', a, {}); assert.equal(again.status, 200, JSON.stringify(again.data));
  await stand(a, DR.world(dice.spot.lx, dice.spot.lz)); await new Promise((r) => { setTimeout(r, 1100); }); assert.equal((await req('/api/island/den/play', a, { game: 'dice', bet: 1, pick: 'big', requestId: crypto.randomUUID() })).data.error, 'DEN_NOCHIPS');
  await stand(a, bar); assert.equal((await req('/api/island/den/chips', a, { side: 'buy', requestId: crypto.randomUUID() })).status, 200);
  await stand(a, DR.world(dice.spot.lx, dice.spot.lz)); /* (back at the dice for the raid below) */
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
