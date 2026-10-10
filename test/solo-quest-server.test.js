'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { boot } = require('../test-support/test-server');
const Q = require('../lib/island-quests');

// v1.10.37 혼자 하는 게임 · 연계 퀘스트 (서버): a minesweeper board lives on the server (no mines in what is sent), a clear
// pays its level once (nothing for a clear faster than a person could), records keep the best time; the islanders' story
// moves on what the server noted, pays each step once, takes the asked things from the bag, and sends the map and tracker.
test('지뢰찾기 서버: 지뢰는 보내지 않음, 클리어 보상 한 번, 너무 빠르면 0P, 최고 기록', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'solo-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('혼자')); assert.ok(sa, server.logs());
  const balance = async () => (await req('/api/points', sa)).data.balance;
  const info = (await req('/api/solo/minesweeper', sa)).data;
  assert.deepEqual(info.levels.map((l) => [l.id, l.points]), [['beginner', 2000], ['intermediate', 4000], ['expert', 8000]]);
  assert.equal(info.game, null);
  assert.equal((await req('/api/solo/minesweeper/new', sa, { level: 'huge' })).status, 400);
  const play = async (ageMs) => {
    const g = (await req('/api/solo/minesweeper/new', sa, { level: 'beginner' })).data;
    assert.equal(g.view.status, 'ready');
    const first = (await req('/api/solo/minesweeper/act', sa, { id: g.id, action: 'open', x: 4, y: 4 })).data;
    assert.equal(first.view.status, 'playing'); assert.equal(first.view.mineAt, undefined);
    assert.ok(!JSON.stringify(first).includes('mineAt'), '지뢰 위치는 보내지 않는다');
    const mines = new Set((await req('/api/test/solo/peek', sa, { ageMs })).data.mines);
    let last;
    for (let i = 0; i < 81; i += 1) if (!mines.has(i)) { last = (await req('/api/solo/minesweeper/act', sa, { id: g.id, action: 'open', x: i % 9, y: Math.floor(i / 9) })).data; if (last.view.status === 'won') break; }
    return { g, last };
  };
  const start = await balance();
  const quick = await play(0);
  assert.equal(quick.last.view.status, 'won');
  assert.equal(quick.last.result.points, 0, '사람이 못 할 만큼 빠르면 포인트 없음');
  assert.equal(await balance(), start);
  const real = await play(60_000);
  assert.equal(real.last.result.points, 2000);
  assert.equal(await balance(), start + 2000);
  assert.equal((await req('/api/solo/minesweeper/act', sa, { id: real.g.id, action: 'open', x: 0, y: 0 })).data.result, null, '한 번만');
  assert.equal(await balance(), start + 2000);
  const records = (await req('/api/solo/minesweeper', sa)).data.records;
  assert.equal(records.beginner.clears, 2); assert.ok(records.beginner.best < 60_000);
  assert.equal((await req('/api/solo/minesweeper/act', sa, { id: 'other-game-id', action: 'open', x: 0, y: 0 })).status, 409);
  const history = JSON.stringify((await req('/api/points/history', sa)).data);
  assert.ok(history.includes('solo_game'));
});

test('연계 퀘스트 서버: 말 걸기·진행·보고 보상 한 번·가방에서 가져감·지도 표시·멀면 거절', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'quest-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req } = server;
  const sa = await server.enter(await server.issue('부탁')); assert.ok(sa, server.logs());
  const balance = async () => (await req('/api/points', sa)).data.balance;
  const stand = (x, z) => req('/api/plaza/state', sa, { x, z, yaw: 0 });
  const g = Q.STORIES.granny.at;
  await stand(0, 20); await new Promise((r) => setTimeout(r, 300));
  const seen = (await stand(0, 20)).data;
  const npc = seen.events.find((e) => e.kind === 'quest_npc' && e.story === 'granny');
  assert.deepEqual([npc.x, npc.z, npc.mark, npc.verb], [g.x, g.z, 'new', '말 걸기'], '멀리서도 지도에 보인다');
  assert.equal((await req('/api/island/event', sa, { id: 'questgranny' })).status, 409, '멀면 거절');
  await stand(g.x + 1, g.z);
  const first = (await req('/api/island/event', sa, { id: 'questgranny' })).data;
  assert.equal(first.action, 'quest'); assert.match(first.say, /잡초 20포기/); assert.equal(first.reward, 0);
  assert.deepEqual(first.track.map((x) => [x.story, x.count, x.need]), [['granny', 0, 20]]);
  const start = await balance();
  assert.equal((await req('/api/island/event', sa, { id: 'questgranny' })).data.waiting, true, '다 하기 전에는 다시 부탁만');
  await req('/api/test/quest/note', sa, { what: 'weed', qty: 20 });
  const paid = (await req('/api/island/event', sa, { id: 'questgranny' })).data;
  assert.equal(paid.reward, 2000); assert.match(paid.say, /열매 5개/);
  assert.equal(await balance(), start + 2000);
  await req('/api/test/island/give', sa, { itemId: 'berry', qty: 5 });
  await new Promise((r) => setTimeout(r, 2100)); await stand(g.x + 1, g.z); await new Promise((r) => setTimeout(r, 300)); // the bag is read again every 2 s
  assert.equal((await stand(g.x + 1, g.z)).data.events.find((e) => e.story === 'granny').mark, 'ready');
  assert.equal((await req('/api/island/event', sa, { id: 'questgranny' })).data.reward, 3000);
  assert.equal((await req('/api/island/bag', sa)).data.items.some((e) => e.itemId === 'berry'), false, '가져다준 만큼 가방에서');
  // the riverside: on the map until I have stood there
  const spot = Q.STORIES.granny.steps[2].spot;
  const before = (await stand(g.x + 1, g.z)).data;
  assert.ok(before.events.some((e) => e.kind === 'quest_spot' && e.x === spot.x && e.z === spot.z));
  await stand(spot.x, spot.z); await new Promise((r) => setTimeout(r, 300)); await stand(spot.x, spot.z);
  await stand(g.x + 1, g.z);
  const last = (await req('/api/island/event', sa, { id: 'questgranny' })).data;
  assert.deepEqual([last.reward, last.done], [2000 + 15000, true]);
  assert.equal(await balance(), start + 22000);
  assert.equal((await req('/api/island/event', sa, { id: 'questgranny' })).data.reward, 0, '이번 주는 끝');
  const history = JSON.stringify((await req('/api/points/history', sa)).data);
  assert.ok(history.includes('"quest"'));
});


test('고정 사진가 서버: 근접·서버 활동/방문·최초 보상·기념사진 탭·재시작 유지',async(t)=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'fixed-story-server-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const server=await boot(t,dir),key=await server.issue('사진이야기'),token=await server.enter(key),{req}=server;
  const balance=async()=> (await req('/api/points',token)).data.balance;
  const stand=(x,z)=>req('/api/plaza/state',token,{x,z,yaw:0});
  const talk=()=>req('/api/island/event',token,{id:'questphotomemory'}),at=Q.STORIES.photomemory.at;
  await stand(0,20);await new Promise(r=>setTimeout(r,300));
  const initial=(await stand(0,20)).data;
  assert.equal(initial.events.filter(e=>['photographer','photomemory'].includes(e.story)).length,1);
  assert.equal((await talk()).status,409,'멀리서는 대화할 수 없다');
  await stand(at.x+.8,at.z);const first=(await talk()).data;assert.equal(first.reward,0);
  const start=await balance();
  await req('/api/test/quest/note',token,{what:'photo',qty:3,scope:'fixed'});
  assert.equal((await talk()).data.reward,2000);
  for(const [i,step] of Q.STORIES.photomemory.steps.entries()) if(i>0) {
    await stand(step.spot.x,step.spot.z);await new Promise(r=>setTimeout(r,300));await stand(step.spot.x,step.spot.z);
    await stand(at.x+.8,at.z);assert.equal((await talk()).data.reward,i===1?3000:17000);
  }
  assert.equal(await balance(),start+22000);assert.equal((await talk()).data.reward,0);
  const dex=(await req('/api/island/dex',token)).data,photo=dex.entries.find(e=>e.id==='memory_island');
  assert.equal(photo.kind,'photo');assert.equal(photo.count,1);assert.ok(photo.first);
  assert.equal(dex.found,0);assert.equal((await req('/api/island/bag',token)).data.items.length,0);
  await server.stop();const restart=await boot(t,dir),again=await restart.enter(key);
  assert.equal((await restart.req('/api/island/dex',again)).data.entries.find(e=>e.id==='memory_island').count,1);
  await restart.req('/api/plaza/state',again,{x:at.x+.8,z:at.z,yaw:0});
  assert.equal((await restart.req('/api/island/event',again,{id:'questphotomemory'})).data.reward,0);
});
