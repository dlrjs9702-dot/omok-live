'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { JsonMatchStore, tally, headToHead } = require('../lib/match-records');
const { buildMatchResult } = require('../lib/match-result');

function room(gameType, winner, status = 'finished') {
  const seats = gameType === 'omok2v2' ? ['1','2','3','4'] :
    ['liar','pictionary','oldmaid','bingo'].includes(gameType) ? ['1','2','3'] : ['black','white'];
  const players = Object.fromEntries(seats.map(seat => [seat, 'session-' + seat]));
  const participants = Object.fromEntries(seats.map(seat => ['session-' + seat, { recordId: 'guest-' + seat }]));
  return { id: 'room-' + gameType, gameType, players, participants,
    game: { status, round: 1, winner, seatOrder: seats, players: seats } };
}

test('every game resolves final outcomes from the engine, never spectators or client input', () => {
  for (const type of ['omok','othello','baseball','connect4','yut','dots','cityking']) {
    assert.deepEqual(buildMatchResult(room(type, 'black')).outcomes.map(x => x.result), ['win','loss']);
    assert.deepEqual(buildMatchResult(room(type, null, 'draw')).outcomes.map(x => x.result), ['draw','draw']);
  }
  assert.deepEqual(buildMatchResult(room('omok2v2','black')).outcomes.map(x => x.result), ['win','loss','win','loss']);
  for (const type of ['liar','pictionary','oldmaid']) {
    assert.deepEqual(buildMatchResult(room(type,['1','3'])).outcomes.map(x => x.result), ['win','loss','win']);
  }
  assert.deepEqual(buildMatchResult(room('bingo','2')).outcomes.map(x => x.result), ['loss','win','loss']);
  assert.equal(buildMatchResult(room('baseball',null,'playing')), null);
  assert.throws(() => buildMatchResult(room('omok',null)), /winner/);
  const invalid = room('omok','black'); delete invalid.participants['session-white'].recordId;
  assert.throws(() => buildMatchResult(invalid), /identity/);
});

test('file-backed records survive reopening, reject duplicate rounds and recover after a failed write', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'match-store-'));
  t.after(() => fs.rm(dir, { recursive:true, force:true }));
  const file = path.join(dir,'matches.json');
  const store = new JsonMatchStore(file); await store.init();
  const match = buildMatchResult(room('omok','black'));
  assert.equal(await store.recordMatch(match), true);
  assert.equal(await store.recordMatch(match), false);
  const second = { ...match, id:'room-omok:2', outcomes: match.outcomes.map(item => ({...item,result:'draw'})) };
  assert.equal(await store.recordMatch(second), true);
  const reopened = new JsonMatchStore(file); await reopened.init();
  assert.deepEqual(await reopened.stats('guest-black'), { total:{played:2,wins:1,losses:0,draws:1,winRate:50},
    byGame:{omok:{played:2,wins:1,losses:0,draws:1,winRate:50}} });
  const third = { ...match, id:'room-omok:3' };
  store.filePath = path.join(dir,'missing','unwritable.json');
  await assert.rejects(store.recordMatch(third));
  store.filePath = file;
  assert.equal(await store.recordMatch(third), true);
  assert.equal((await (async () => { const again = new JsonMatchStore(file); await again.init(); return again.stats('guest-black'); })()).total.played,3);
  assert.deepEqual(tally([{ gameType:'liar', outcomes:[{id:'same',result:'loss'}] }], 'same').total,
    {played:1,wins:0,losses:1,draws:0,winRate:0});
});

test('head-to-head only tallies direct two-person matches between exactly those two players', () => {
  const matches = [
    buildMatchResult(room('omok','black')), // black=session-black -> guest-black, white=guest-white
    { ...buildMatchResult(room('othello','white')), id:'room-othello:2' },
    // A 4-seat team match that includes BOTH guest-black and guest-white must still be excluded,
    // since it was never a direct two-person contest between just the two of them.
    { id:'room-omok2v2:x', gameType:'omok2v2', at:new Date().toISOString(), outcomes:[
      {id:'guest-black',result:'win'},{id:'guest-white',result:'loss'},{id:'guest-3',result:'win'},{id:'guest-4',result:'loss'}] },
    { ...buildMatchResult(room('baseball','black')), id:'room-baseball:x',
      outcomes:[{id:'guest-black',result:'win'},{id:'someone-else',result:'loss'}] }, // not a match against guest-white
  ];
  const versus = headToHead(matches, 'guest-black', 'guest-white');
  assert.deepEqual(versus.total, { played:2, wins:1, losses:1, draws:0, winRate:50 });
  assert.deepEqual(Object.keys(versus.byGame).sort(), ['omok','othello']);
  assert.equal(versus.byGame.omok.wins, 1);
  assert.equal(versus.byGame.othello.losses, 1);
  // Reversing the perspective flips wins/losses but keeps the same match count.
  const reversed = headToHead(matches, 'guest-white', 'guest-black');
  assert.deepEqual(reversed.total, { played:2, wins:1, losses:1, draws:0, winRate:50 });
  // A player who never faced this exact opponent directly gets an empty result.
  assert.deepEqual(headToHead(matches, 'guest-black', 'nobody').total, { played:0, wins:0, losses:0, draws:0, winRate:0 });
});

async function freePort() {
  return new Promise((resolve,reject) => {
    const socket=net.createServer(); socket.once('error',reject);
    socket.listen(0,'127.0.0.1', () => socket.close(() => resolve(socket.address()?.port)));
  });
}

test('authenticated records: completion, duplicate guard, rematch, rename, reissue, team and no secrets', { timeout:35000 }, async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'match-records-api-'));
  const port=await new Promise((resolve,reject) => {
    const s=net.createServer(); s.once('error',reject);
    s.listen(0,'127.0.0.1', () => { const p=s.address().port;s.close(() => resolve(p)); });
  });
  const base=`http://127.0.0.1:${port}`;
  const proc=spawn(process.execPath,['server.js'],{ cwd:path.join(__dirname,'..'),
    env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dir,DATABASE_URL:'',ADMIN_PASSWORD:'records-test-password',NODE_ENV:'test'},
    stdio:['ignore','pipe','pipe'] });
  let log=''; proc.stdout.on('data',chunk => log+=chunk);proc.stderr.on('data',chunk => log+=chunk);
  t.after(async () => {proc.kill('SIGTERM');await new Promise(resolve => {if(proc.exitCode!==null)resolve();else{proc.once('exit',resolve);setTimeout(resolve,1500).unref();}});await fs.rm(dir,{recursive:true,force:true});});
  let ready=false;
  for(let n=0;n<100;n++){if(proc.exitCode!==null)break;try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,75));}
  assert.ok(ready,log);
  async function req(route,token,body,method='POST') {
    const headers={};if(token)headers['X-Session-Token']=token;if(body!==undefined)headers['Content-Type']='application/json';
    const r=await fetch(base+route,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:r.status,data:await r.json()};
  }
  const admin=(await req('/api/admin/login',null,{password:'records-test-password'})).data.sessionToken;
  assert.equal((await req('/api/records/me',null,undefined,'GET')).status,401);
  assert.equal((await req('/api/records/players?q=동명',null,undefined,'GET')).status,401);
  async function issue(label){const r=await req('/api/admin/keys',admin,{label});assert.equal(r.status,201);return r.data;}
  async function guest(html){const token=html.match(/name="token" value="([^"]+)"/)[1];
    const r=await fetch(base+'/guest-entry',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token})});
    assert.equal(r.status,200);const page=await r.text();const match=page.match(/data-session="([^"]+)"/);
    assert.ok(match,page.slice(0,150));return match[1];}
  const keyA=await issue('동명');const keyB=await issue('상대');const keyC=await issue('동명');const keyD=await issue('팀원');
  let a=await guest(keyA.html);const b=await guest(keyB.html);const c=await guest(keyC.html);const d=await guest(keyD.html);
  assert.equal((await req('/api/records/me',a,undefined,'GET')).data.total.played,0);
  const found=await req('/api/records/players?q=동명',b,undefined,'GET');
  assert.equal(found.data.players.length,2);assert.notEqual(found.data.players[0].id,found.data.players[1].id);
  assert.ok(!JSON.stringify(found.data).includes('tokenHash'));
  assert.ok(!JSON.stringify(found.data).includes('adminNote'));
  const created=await req('/api/rooms',a,{gameType:'baseball'});assert.equal(created.status,201);
  const code=created.data.state.me.roomCode;
  assert.equal((await req('/api/rooms/join',b,{code})).status,200);
  await req('/api/room/choose-role',a,{choice:'black'});
  await req('/api/room/choose-role',b,{choice:'white'});
  await req('/api/room/set-secret',a,{secret:'123'});
  await req('/api/room/set-secret',b,{secret:'456'});
  const won=await req('/api/room/guess',a,{guess:'456'});
  assert.equal(won.status,200);assert.equal(won.data.state.game.status,'finished');
  assert.equal((await req('/api/records/me',a,undefined,'GET')).data.total.wins,1);
  assert.equal((await req('/api/records/me',b,undefined,'GET')).data.total.losses,1);
  assert.equal((await req('/api/room/guess',a,{guess:'456'})).status,409);
  assert.equal((await req('/api/records/me',a,undefined,'GET')).data.total.played,1);
  assert.equal((await req('/api/room/next-round',a,{})).status,200);
  await req('/api/room/choose-role',a,{choice:'black'});
  await req('/api/room/choose-role',b,{choice:'white'});
  await req('/api/room/set-secret',a,{secret:'123'});
  await req('/api/room/set-secret',b,{secret:'456'});
  await req('/api/room/guess',a,{guess:'124'});
  const second=await req('/api/room/guess',b,{guess:'123'});assert.equal(second.status,200);
  assert.equal((await req('/api/records/me',a,undefined,'GET')).data.total.winRate,50);
  const rename=await req(`/api/admin/keys/${keyA.key.id}/rename`,admin,{label:'새닉네임'});assert.equal(rename.status,200);
  a=await guest(rename.data.html);
  let mine=await req('/api/records/me',a,undefined,'GET');
  assert.equal(mine.data.player.id,keyA.key.id);assert.equal(mine.data.player.label,'새닉네임');assert.equal(mine.data.total.played,2);
  const rotated=await req(`/api/admin/keys/${keyA.key.id}/reissue`,admin,{});assert.equal(rotated.status,200);
  a=await guest(rotated.data.html);
  mine=await req('/api/records/me',a,undefined,'GET');assert.equal(mine.data.total.played,2);
  assert.equal((await req(`/api/records/${keyA.key.id}`,b,undefined,'GET')).data.total.wins,1);
  assert.ok(!JSON.stringify((await req(`/api/records/${keyA.key.id}`,b,undefined,'GET')).data).includes('adminNote'));
  await req('/api/room/leave',b,{});
  const team=await req('/api/rooms',a,{gameType:'omok2v2'});assert.equal(team.status,201);
  const teamCode=team.data.state.me.roomCode;
  for(const token of [b,c,d])assert.equal((await req('/api/rooms/join',token,{code:teamCode})).status,200);
  for(const [token,seat] of [[a,'1'],[b,'2'],[c,'3'],[d,'4']])assert.equal((await req('/api/room/choose-role',token,{choice:seat})).status,200);
  const resigned=await req('/api/room/resign',a,{});assert.equal(resigned.status,200);
  assert.equal((await req('/api/records/me',a,undefined,'GET')).data.byGame.omok2v2.losses,1);
  assert.equal((await req('/api/records/me',b,undefined,'GET')).data.byGame.omok2v2.wins,1);
  assert.equal((await req('/api/records/me',c,undefined,'GET')).data.byGame.omok2v2.losses,1);
  assert.equal((await req('/api/records/me',d,undefined,'GET')).data.byGame.omok2v2.wins,1);
  assert.equal((await req('/api/records/me',c,undefined,'GET')).data.total.played,1);
  assert.equal((await req('/api/records/me',a,undefined,'GET')).data.byGame.baseball.played,2);

  // Head-to-head: only the two direct baseball games between a and b count, the 2v2 team
  // match (4 outcomes) is excluded even though both a and b also played in it together.
  const bVersusA=await req(`/api/records/${keyA.key.id}/versus-me`,b,undefined,'GET');
  assert.equal(bVersusA.status,200);
  assert.equal(bVersusA.data.player.id,keyA.key.id);
  assert.equal(bVersusA.data.total.played,2);assert.equal(bVersusA.data.total.wins,1);assert.equal(bVersusA.data.total.losses,1);
  assert.equal(bVersusA.data.byGame.baseball.played,2);
  assert.equal(bVersusA.data.byGame.omok2v2,undefined);
  const aVersusB=await req(`/api/records/${keyB.key.id}/versus-me`,a,undefined,'GET');
  assert.equal(aVersusB.data.total.played,2);assert.equal(aVersusB.data.total.wins,1);assert.equal(aVersusB.data.total.losses,1);
  const selfVersusSelf=await req(`/api/records/${keyA.key.id}/versus-me`,a,undefined,'GET');
  assert.equal(selfVersusSelf.status,400);assert.equal(selfVersusSelf.data.error,'SAME_PLAYER');
  assert.equal((await req(`/api/records/${keyA.key.id}/versus-me`,null,undefined,'GET')).status,401);
});

test('lobby layout, announcements, small participant links and modal preserve room state', async () => {
  const html=await fs.readFile(path.join(__dirname,'../public/index.html'),'utf8');
  const css=await fs.readFile(path.join(__dirname,'../public/styles.css'),'utf8');
  const app=await fs.readFile(path.join(__dirname,'../public/app.js'),'utf8');
  const server=await fs.readFile(path.join(__dirname,'../server.js'),'utf8');
  assert.match(html,/id="lobbyHighlights"/);assert.match(html,/id="announcementsCard"/);
  assert.match(html,/id="myRecordsCard"/);assert.match(css,/65fr\) minmax\(250px,35fr/);
  assert.match(css,/@media\(max-width:760px\)/);assert.match(html,/id="recordsDialog"/);
  assert.match(app,/nameButton\.addEventListener\('click', \(\) => openPlayerRecords\(person\.playerId\)\)/);
  assert.doesNotMatch(html,/id="participantRecordsBtn"/);
  assert.match(app,/loadMyRecords\(\);/);assert.match(app,/recordsDialog\.showModal\(\)/);
  assert.match(app,/recordsDialog\.close\(\)/);assert.match(app,/loadAnnouncements\(\)/);
  assert.match(server,/requireSession\(req, res\)/);assert.match(server,/MATCH_RECORD_FAILED/);
  assert.match(html,/app\.js\?v=1\.6\.51/);
});
