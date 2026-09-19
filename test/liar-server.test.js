'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

async function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}

test('liar server keeps roles/word private and restores phase on reconnect', { timeout: 30000 }, async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-center-liar-'));
  const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  const proc = spawn(process.execPath, ['server.js'], { cwd:path.resolve(__dirname,'..'), env:{...process.env,PORT:String(port),HOST:'127.0.0.1',DATA_DIR:dataDir,DATABASE_URL:'',ADMIN_PASSWORD:'liar-test-secret',NODE_ENV:'test'}, stdio:['ignore','pipe','pipe'] });
  let output=''; proc.stdout.on('data',c=>output+=c); proc.stderr.on('data',c=>output+=c);
  t.after(async()=>{proc.kill('SIGTERM');await new Promise(r=>{if(proc.exitCode!==null)r();else{proc.once('exit',r);setTimeout(r,2000).unref();}});await fs.rm(dataDir,{recursive:true,force:true});});
  let ready=false; for(let i=0;i<90;i+=1){if(proc.exitCode!==null)break;try{const r=await fetch(`${base}/health`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready, `server failed: ${output}`);
  async function req(route,token,body,method='POST'){const headers={};if(token)headers['X-Session-Token']=token;if(body!==undefined)headers['Content-Type']='application/json';const r=await fetch(base+route,{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{})});let data={};try{data=await r.json();}catch{}return{status:r.status,data};}
  async function login(){const r=await req('/api/admin/login',null,{password:'liar-test-secret'});assert.equal(r.status,200);return r.data.sessionToken;}
  const tokens=[await login(),await login(),await login(),await login()];
  const created=await req('/api/rooms',tokens[0],{gameType:'liar'}); assert.equal(created.status,201); const code=created.data.state.me.roomCode;
  for(let i=1;i<4;i+=1) assert.equal((await req('/api/rooms/join',tokens[i],{code})).status,200);
  for(let i=0;i<3;i+=1) assert.equal((await req('/api/room/choose-role',tokens[i],{choice:String(i+1)})).status,200);
  assert.equal((await req('/api/room/choose-role',tokens[3],{choice:'spectator'})).status,200);
  assert.equal((await req('/api/room/start-liar',tokens[0],{})).status,200);
  const views=[]; for(const token of tokens) views.push((await req('/api/room',token,undefined,'GET')).data.state);
  const playerViews=views.slice(0,3); const liarIndex=playerViews.findIndex(v=>v.game.role==='liar'); assert.ok(liarIndex>=0);
  const citizens=playerViews.filter(v=>v.game.role==='citizen'); assert.equal(citizens.length,2); const word=citizens[0].game.myWord; assert.ok(word);
  assert.equal(playerViews[liarIndex].game.myWord,null); assert.equal(views[3].game.role,null); assert.equal(views[3].game.myWord,null);
  assert.ok(!JSON.stringify(playerViews[liarIndex].game).includes(word)); assert.ok(!JSON.stringify(views[3].game).includes(word));
  const reloaded=(await req('/api/room',tokens[liarIndex],undefined,'GET')).data.state; assert.equal(reloaded.game.phase,playerViews[liarIndex].game.phase); assert.equal(reloaded.game.phaseId,playerViews[liarIndex].game.phaseId);
  assert.equal((await req('/api/room/liar-hint',tokens[3],{hint:'관전자',expectedPhaseId:views[3].game.phaseId})).status,403);
  // v1.6.42: room chat is locked server-side for the whole hint phase (both hint1 and hint2), so
  // players can't trade the word or accuse each other before hints are actually spoken in turn.
  const lockedChat=await req('/api/room/chat',tokens[0],{text:'힌트인데 채팅 시도'});
  assert.equal(lockedChat.status,409); assert.equal(lockedChat.data.error,'LIAR_HINT_CHAT_LOCKED');
  const bySeat={}; for(let i=0;i<3;i+=1) bySeat[playerViews[i].me.seat]=tokens[i];
  let current=(await req('/api/room',tokens[0],undefined,'GET')).data.state;
  for(let i=0;i<6;i+=1){
    const speaker=current.game.currentSpeaker;
    assert.equal((await req('/api/room/chat',tokens[0],{text:`힌트 ${i} 중 채팅 시도`})).status,409);
    const r=await req('/api/room/liar-hint',bySeat[speaker],{hint:`힌트 ${i}`,expectedPhaseId:current.game.phaseId});assert.equal(r.status,200);current=r.data.state;
  }
  assert.equal(current.game.phase,'vote');
  // Voting isn't a hint phase, so chat is unlocked again.
  assert.equal((await req('/api/room/chat',tokens[0],{text:'투표 중 채팅'})).status,200);
  const liarSeat=playerViews[liarIndex].me.seat; const alternative=Object.keys(bySeat).find(s=>s!==liarSeat);
  for(const s of Object.keys(bySeat)){current=(await req('/api/room',bySeat[s],undefined,'GET')).data.state;const target=s===liarSeat?alternative:liarSeat;const r=await req('/api/room/liar-vote',bySeat[s],{target,expectedPhaseId:current.game.phaseId});assert.equal(r.status,200);}
  current=(await req('/api/room',tokens[liarIndex],undefined,'GET')).data.state; assert.equal(current.game.phase,'guess'); assert.equal(current.game.canGuess,true);
  const guessed=await req('/api/room/liar-guess',tokens[liarIndex],{guess:word,expectedPhaseId:current.game.phaseId}); assert.equal(guessed.status,200); assert.equal(guessed.data.state.game.status,'finished'); assert.equal(guessed.data.state.game.lastResult.winningSide,'liar');
  assert.equal((await req('/api/room/resign',tokens[0],{})).status,400); assert.equal((await req('/api/room/move',tokens[0],{x:0,y:0})).status,400);
});
