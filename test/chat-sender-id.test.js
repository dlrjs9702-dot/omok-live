'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');

// v1.7.20 daily missions through the real server: finished matches (resigned Othello) drive progress,
// missions and the first-win bonus pay once into the ledger, repeated requests never count a match twice,
// and the in-room stream tells each player their progress in short lines.

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const PASSWORD = 'chat-id-test';

async function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const port = s.address().port; s.close(() => resolve(port)); });
  });
}

async function boot(t, dataDir) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: dataDir, DATABASE_URL: '', ADMIN_PASSWORD: PASSWORD, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', data => { logs += data.toString(); });
  child.stderr.on('data', data => { logs += data.toString(); });
  t.after(async () => {
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 2000).unref(); });
  });
  for (let i = 0; i < 120 && child.exitCode === null; i += 1) {
    try { if ((await fetch(base + '/health')).ok) break; } catch {}
    await sleep(100);
  }
  let ip = 0;
  async function req(route, token, body, method = body === undefined ? 'GET' : 'POST') {
    const headers = { 'X-Forwarded-For': `10.97.${Math.floor(++ip / 200) % 200}.${ip % 200 + 1}` };
    if (token) headers['X-Session-Token'] = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }
  const admin = (await req('/api/admin/login', null, { password: PASSWORD })).data.sessionToken;
  assert.ok(admin, logs);
  async function guest(label) {
    const issued = await req('/api/admin/keys', admin, { label });
    assert.equal(issued.status, 201);
    const key = issued.data.html.match(/name="token" value="([^"]+)"/)[1];
    const res = await fetch(base + '/guest-entry', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: key }).toString() });
    return { label, key, id: issued.data.key.id, session: (await res.text()).match(/data-session="([^"]+)"/)?.[1] };
  }
  // Collect the room's server-sent events (named events only) until the test ends.
  async function listen(person) {
    const controller = new AbortController();
    t.after(() => controller.abort());
    const events = [];
    const res = await fetch(base + '/api/room/events', { headers: { 'X-Session-Token': person.session, Accept: 'text/event-stream' }, signal: controller.signal });
    (async () => {
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        for await (const chunk of res.body) {
          buffer += decoder.decode(chunk, { stream: true });
          let cut;
          while ((cut = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, cut);
            buffer = buffer.slice(cut + 2);
            const name = block.match(/^event: (.+)$/m)?.[1];
            const data = block.match(/^data: (.+)$/m)?.[1];
            if (name && data) events.push({ name, data: JSON.parse(data) });
          }
        }
      } catch {}
    })();
    return events;
  }
  const missions = async person => (await req('/api/missions', person.session)).data;
  const deal = (person, ids) => req('/api/test/missions', person.session, { ids });
  const history = async person => (await req('/api/points/history?limit=50', person.session)).data.items;
  return { req, guest, missions, deal, history, listen, logs: () => logs };
}

const { appendChatMessage, appendSystemMessage, publicChatMessages, createRoomSocial } = require('../lib/room-social');

test('메시지 구조: 채팅에만 senderId(32자 이하)가 붙고, 시스템 메시지와 발신자 없는 메시지에는 없다', () => {
  const room = { social: createRoomSocial() };
  appendChatMessage(room, { label: '가' }, '안녕', 'a1b2c3d4e5f60718');
  appendChatMessage(room, { label: '나' }, '옛 형식');
  appendSystemMessage(room, '입장했습니다');
  appendChatMessage(room, { label: '다' }, '긴 ID', 'x'.repeat(80));
  const rows = publicChatMessages(room);
  assert.equal(rows[0].senderId, 'a1b2c3d4e5f60718');
  assert.equal('senderId' in rows[1], false);
  assert.equal('senderId' in rows[2], false);
  assert.equal(rows[3].senderId.length, 32);
});

async function joinRoom(fx, host, guest) {
  const created = await fx.req('/api/rooms', host.session, { gameType: 'omok' });
  assert.equal(created.status, 201);
  assert.equal((await fx.req('/api/rooms/join', guest.session, { code: created.data.state.me.roomCode })).status, 200);
}

test('같은 닉네임 두 사람: 메시지마다 다른 senderId, 각자의 me.chatId와 자기 메시지만 일치, 계정 정보 미노출', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-id-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b] = [await fx.guest('똑같은이름'), await fx.guest('똑같은이름')];
  await joinRoom(fx, a, b);
  assert.equal((await fx.req('/api/room/chat', a.session, { text: '가 메시지' })).status, 200);
  assert.equal((await fx.req('/api/room/chat', b.session, { text: '나 메시지' })).status, 200);
  assert.equal((await fx.req('/api/room/chat', a.session, { text: '가 두번째' })).status, 200);

  const viewA = (await fx.req('/api/room', a.session)).data.state;
  const viewB = (await fx.req('/api/room', b.session)).data.state;
  const rows = viewA.chat.messages.filter(row => row.type === 'chat');
  assert.deepEqual(rows.map(row => row.text), ['가 메시지', '나 메시지', '가 두번째']);
  assert.ok(rows.every(row => row.label === '똑같은이름' && /^[0-9a-f]{16}$/.test(row.senderId)));
  assert.equal(rows[0].senderId, rows[2].senderId, '같은 사람은 같은 ID');
  assert.notEqual(rows[0].senderId, rows[1].senderId, '닉네임이 같아도 다른 사람은 다른 ID');
  assert.equal(viewA.me.chatId, rows[0].senderId);
  assert.equal(viewB.me.chatId, rows[1].senderId);
  assert.notEqual(viewA.me.chatId, viewB.me.chatId);
  assert.deepEqual(viewB.chat.messages.filter(row => row.type === 'chat').map(row => row.senderId), rows.map(row => row.senderId), '모두에게 같은 ID로 보인다');
  assert.equal(JSON.stringify(viewA.chat).includes('guest:'), false, '계정·입장 파일 식별자 미노출');
  assert.equal(JSON.stringify([viewA.chat, viewA.me]).includes(a.id), false);
  assert.equal(JSON.stringify(viewB.chat).includes(a.id), false);
});

test('같은 계정은 다른 방에서도 같은 ID이고 상대와는 다르다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-id-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const fx = await boot(t, dir);
  const [a, b] = [await fx.guest('원래이름'), await fx.guest('상대')];
  await joinRoom(fx, a, b);
  await fx.req('/api/room/chat', a.session, { text: '첫 메시지' });
  const first = (await fx.req('/api/room', a.session)).data.state;
  const id = first.me.chatId;
  assert.match(id, /^[0-9a-f]{16}$/);
  assert.equal(first.chat.messages.find(row => row.type === 'chat').senderId, id);

  assert.equal((await fx.req('/api/room/leave', a.session, {})).status, 200);
  const other = await fx.req('/api/rooms', a.session, { gameType: 'othello' });
  assert.equal(other.status, 201);
  assert.equal(other.data.state.me.chatId, id, '다른 방에서도 같은 ID');
  assert.notEqual(other.data.state.me.chatId, (await fx.req('/api/room', b.session)).data.state?.me?.chatId, '상대와는 다르다');
});
