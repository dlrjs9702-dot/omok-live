'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { queueRoomRecord } = require('../lib/room-record-retry');

test('방 GET: 정산을 붙잡아도 화면 즉시 반환·조회 중 작업 하나·완료 방송', async () => {
  const source = fs.readFileSync(require.resolve('../server.js'), 'utf8');
  const a = source.indexOf("  if (pathname === '/api/room' && req.method === 'GET') {");
  const b = source.indexOf("  if (pathname === '/api/room/leave'", a);
  let release; let calls = 0; let sent = 0; let broadcasts = 0;
  const room = { id: 'held-room', game: { round: 1 } };
  const context = { pathname: '/api/room', req: { method: 'GET' }, res: {}, require,
    requireSession: () => ({}), getCurrentRoom: () => room, registerParticipant() {},
    recordFinishedMatch: () => { calls += 1; return new Promise(resolve => { release = resolve; }); },
    rooms: new Map([[room.id, room]]), broadcast: () => broadcasts++, roomView: () => ({ pending: true }),
    sendJson: (res, status, data) => { sent++; return data; }, console,
  };
  context.require = name => name === './lib/room-record-retry' ? { queueRoomRecord } : require(name);
  const handle = vm.runInNewContext(`(async () => { ${source.slice(a, b)} })`, context);
  await handle(); await handle();
  assert.equal(sent, 2); assert.equal(calls, 1);
  release(true); await room.readRecording;
  assert.equal(broadcasts, 1); assert.equal(room.readRecording, null);
});

test('방 정산: 실패 뒤 백그라운드 재시도·새 판/퇴장 후 재시도 안 함', async () => {
  const source = fs.readFileSync(require.resolve('../lib/room-record-retry'), 'utf8');
  const timers = []; const exports = { exports: {} };
  vm.runInNewContext(source, { module: exports, setTimeout: fn => { const timer = { fn, unref() {} }; timers.push(timer); return timer; } });
  const queue = exports.exports.queueRoomRecord;
  let live = true; let calls = 0; let saved = 0;
  const room = {};
  const callbacks = { record: async () => { if (++calls === 1) throw Error('held settlement'); return true; },
    isCurrent: () => live, onSaved: () => saved++, onError() {} };
  queue(room, callbacks); await room.readRecording;
  assert.equal(timers.length, 1); queue(room, callbacks); assert.equal(calls, 1);
  timers[0].fn(); await room.readRecording; assert.equal(calls, 2); assert.equal(saved, 1);
  callbacks.record = async () => { calls++; throw Error('again'); };
  queue(room, callbacks); await room.readRecording;
  live = false; timers[1].fn(); assert.equal(calls, 3);
});
