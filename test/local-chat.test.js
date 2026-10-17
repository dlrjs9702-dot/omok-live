'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { boot } = require('../test-support/test-server');
const R = require('../public/plaza/island-train');

// v1.10.82 근거리·같은 열차 채팅 (IDEAS #future-local-chat): an island message reaches who was within 20 m on the ground
// when it was sent, or who rode the same train -- in the lobby stream itself (never sent and hidden); one from outside
// the island still reaches all; a message once got stays after moving off.
test('섬 채팅: 지상 20m 안만, 같은 열차 승객끼리만, 섬 밖 대기방 글은 모두', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'local-chat-')); t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const server = await boot(t, dir); const { req, base } = server;
  const people = {};
  for (const name of ['탑승1', '탑승2', '역옆', '근처', '멀리', '대기방']) people[name] = await server.enter(await server.issue(name));
  // each one's latest lobby state from the stream
  const latest = {}; const controllers = [];
  for (const [name, token] of Object.entries(people)) {
    const ac = new AbortController(); controllers.push(ac);
    const res = await fetch(base + '/api/lobby/events', { headers: { 'X-Session-Token': token }, signal: ac.signal });
    (async () => { const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
      try { for (;;) { const { value, done } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true });
        let i; while ((i = buf.indexOf('\n\n')) >= 0) { const block = buf.slice(0, i); buf = buf.slice(i + 2);
          if (/^event: lobbyState$/m.test(block)) latest[name] = JSON.parse(block.match(/^data: (.*)$/m)[1]); } } } catch {} })();
  }
  t.after(() => { for (const ac of controllers) ac.abort(); });
  const texts = (name) => (latest[name]?.messages || []).map((m) => (m.channel === 'train' ? `🚃${m.text}` : m.text));
  const settle = () => new Promise((r) => setTimeout(r, 300));
  const say = (name, text) => req('/api/lobby/chat', people[name], { text });

  const B = R.stationOf('B');
  for (const name of ['탑승1', '탑승2', '역옆']) await req('/api/plaza/state', people[name], { ...B.spot, yaw: 0, moving: false });
  await req('/api/plaza/state', people['근처'], { x: B.spot.x + 12, z: B.spot.z, yaw: 0, moving: false });
  await req('/api/plaza/state', people['멀리'], { x: B.spot.x + 45, z: B.spot.z, yaw: 0, moving: false });
  for (const name of ['탑승1', '탑승2']) assert.equal((await req('/api/island/train/platform', people[name], { stop: 'B', line: 'tour' })).status, 200);
  const now = Date.now(); await req('/api/test/train-shift', people['탑승1'], { ms: Math.ceil(now / 240000) * 240000 + 236000 - now });
  for (const name of ['탑승1', '탑승2']) assert.equal((await req('/api/island/train/board', people[name], { stop: 'B', line: 'tour' })).status, 200);

  assert.equal((await say('역옆', '지상 안녕')).status, 200); await settle();
  assert.deepEqual(['역옆', '근처', '멀리', '탑승1', '대기방'].map((n) => texts(n).includes('지상 안녕')), [true, true, false, false, false]);
  await say('탑승1', '기차 안녕'); await settle();
  assert.deepEqual(['탑승1', '탑승2', '역옆', '근처'].map((n) => texts(n).includes('🚃기차 안녕')), [true, true, false, false]);
  await say('대기방', '모두 안녕'); await settle(); // no island place: everyone, as before
  for (const n of Object.keys(people)) assert.ok(texts(n).includes('모두 안녕'), n);
  await req('/api/plaza/state', people['근처'], { x: B.spot.x + 60, z: B.spot.z + 20, yaw: 0, moving: false }); await say('대기방', '하나 더'); await settle();
  assert.ok(texts('근처').includes('지상 안녕'), '받은 것은 멀어져도 남는다');
});
