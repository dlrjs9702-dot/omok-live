'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

// v1.10.11 서버 공용 랜덤 이벤트: everyone shares the same events; a player is told only of those near; one solve
// each (the second gets 「이미 사라졌습니다」); v1.10.50 resources have separate slots and cooldowns.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'island-events-test';

async function boot(t, dir) {
  const port = await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dir, DATABASE_URL: '', ADMIN_PASSWORD: PASSWORD, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', d => { logs += d; });
  child.stderr.on('data', d => { logs += d; });
  const stop = async () => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 4000).unref(); });
  };
  t.after(stop);
  for (let i = 0; i < 120 && child.exitCode === null; i += 1) {
    try { if ((await fetch(base + '/health')).ok) break; } catch {}
    await sleep(100);
  }
  let ip = 0;
  async function req(route, token, body) {
    const headers = { 'X-Forwarded-For': `10.55.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST', headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const admin = (await req('/api/admin/login', null, { password: PASSWORD })).data.sessionToken;
  assert.ok(admin, logs);
  const issue = async (label) => {
    const issued = await req('/api/admin/keys', admin, { label });
    return { id: issued.data.key.id, key: issued.data.html.match(/name="token" value="([^"]+)"/)[1] };
  };
  const enter = async ({ key }) => {
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: key }).toString() });
    return (await res.text()).match(/data-session="([^"]+)"/)?.[1];
  };
  const release = (session) => req('/api/session/release', session, {});
  return { req, issue, enter, release, stop, logs: () => logs };
}

test('생활 서버: 완료시점·고정위치·선점·동일요청·취소·새세대·직접 수확·원장 유지', async t => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'life-server-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  let server=await boot(t,dir);let req=server.req;
  const ka=await server.issue('생활가'),kb=await server.issue('생활나');let a=await server.enter(ka),b=await server.enter(kb);
  const all=async()=> (await req('/api/test/island/events',a)).data.events;
  const stand=(s,p)=>req('/api/plaza/state',s,{x:p.x,z:p.z,yaw:0,moving:true});
  const list=await all();assert.ok(list.length>15);
  const one=list.find(e=>e.type==='mushroom');
  assert.equal((await req('/api/island/resource/start',a,{id:one.id})).data.error,'TOO_FAR');
  await stand(a,one);await stand(b,{x:one.x+1.2,z:one.z});
  assert.equal((await req('/api/island/event',a,{id:one.id})).data.error,'COLLECT_NOT_STARTED');
  const start=await req('/api/island/resource/start',a,{id:one.id});assert.equal(start.status,200);
  const rid=crypto.randomUUID();assert.equal((await req('/api/island/resource/finish',a,{id:one.id,requestId:rid})).data.error,'COLLECT_TOO_SOON');
  const moved=await stand(a,{x:0,z:8});assert.equal(moved.data.corrected,true);assert.equal(moved.data.x,one.x);
  assert.equal((await req('/api/island/resource/start',b,{id:one.id})).status,200);
  await sleep(1050);const both=await Promise.all([req('/api/island/resource/finish',a,{id:one.id,requestId:rid}),req('/api/island/resource/finish',b,{id:one.id,requestId:crypto.randomUUID()})]);
  assert.deepEqual(both.map(r=>r.status).sort(),[200,409]);
  const winner=both[0].status===200?a:b;
  if(winner===a){await stand(a,one);assert.equal((await req('/api/island/resource/finish',a,{id:one.id,requestId:rid})).status,200);}
  const bag=async s=>(await req('/api/island/bag',s)).data.items;
  assert.equal((await bag(winner)).find(e=>e.itemId==='mushroom').qty,1);
  assert.equal((await req('/api/island/resource/start',winner,{id:one.id})).data.error,'EVENT_GONE');
  await req('/api/island/resource/cancel',a,{});await req('/api/island/resource/cancel',b,{});
  await stand(b,{x:0,z:8});await req('/api/test/island/events',a,{grow:one.id});
  const grown=(await all()).find(e=>e.id===one.id);await stand(winner,grown);
  await req('/api/island/resource/start',winner,{id:one.id});await req('/api/island/resource/cancel',winner,{});
  assert.equal((await req('/api/island/resource/finish',winner,{id:one.id,requestId:crypto.randomUUID()})).data.error,'COLLECT_NOT_STARTED');
  const tree=(await all()).find(e=>e.type==='berry');await stand(a,tree);await stand(b,{x:0,z:8});
  const fruit=await req('/api/island/resource/start',a,{id:tree.id});assert.equal(fruit.data.anim,'pickFruit');assert.equal(fruit.data.ms,1800);
  await sleep(1850);const picked=await req('/api/island/resource/finish',a,{id:tree.id,requestId:crypto.randomUUID()});assert.equal(picked.status,200,JSON.stringify(picked.data));
  assert.equal(picked.data.item.qty,1);assert.equal(picked.data.events.find(e=>e.id===tree.id).available,false);
  await req('/api/test/island/events',a,{grow:tree.id});const regrown=(await all()).find(e=>e.id===tree.id);assert.deepEqual([regrown.x,regrown.z],[tree.x,tree.z]);
  await req('/api/island/resource/cancel',a,{});
  const coin=(await all()).find(e=>e.type==='coin');await stand(a,coin);const before=(await req('/api/donation',a)).data.balance;
  await req('/api/island/resource/start',a,{id:coin.id});await sleep(1050);const paid=await req('/api/island/resource/finish',a,{id:coin.id,requestId:crypto.randomUUID()});assert.equal(paid.data.points,2000);assert.equal((await req('/api/donation',a)).data.balance,before+2000);
  const previousIds=(await all()).map(e=>e.id);await server.stop();server=await boot(t,dir);req=server.req;a=await server.enter(ka);
  assert.equal((await bag(a)).find(e=>e.itemId==='berry').qty,1);
  assert.ok((await all()).every(e=>!previousIds.includes(e.id)));
});
