'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createRpgTransport } = require('../lib/rpg-transport');

function fakeClient(blockAfter = Infinity) {
  const res = new EventEmitter();
  res.writes = [];
  res.ended = false;
  res.write = (body) => { res.writes.push(JSON.parse(body.split('data: ')[1])); return res.writes.length < blockAfter; };
  res.end = () => { res.ended = true; };
  return { res };
}

test('전송: 정상 연결은 매번 보내고, 막힌 연결은 최신 1개만 남겨 drain 뒤 fx를 합쳐 보낸다', () => {
  let t = 1000;
  const transport = createRpgTransport({ maxStallMs: 5000, now: () => t });
  const fast = fakeClient();
  const slow = fakeClient(1); // 첫 write에서 바로 막힌다
  const clients = new Set([fast, slow]);

  transport.send(clients, { q: 1, fx: [{ k: 'a' }] });
  transport.send(clients, { q: 2, fx: [{ k: 'b' }] });
  transport.send(clients, { q: 3, fx: [{ k: 'c' }] });
  transport.send(clients, { q: 4, fx: [{ k: 'd' }] });
  assert.deepEqual(fast.res.writes.map(w => w.q), [1, 2, 3, 4], '느린 연결이 빠른 연결을 늦추지 않는다');
  assert.deepEqual(slow.res.writes.map(w => w.q), [1], '막힌 동안에는 더 쓰지 않는다(메모리 증가 없음)');
  assert.equal(transport.stats.dropped, 2, '대기 스냅샷은 하나만 남는다');

  slow.res.emit('drain');
  assert.deepEqual(slow.res.writes.map(w => w.q), [1, 4], 'drain 뒤 가장 최신 스냅샷을 보낸다');
  assert.deepEqual(slow.res.writes[1].fx.map(f => f.k), ['b', 'c', 'd'], '건너뛴 스냅샷의 효과도 잃지 않는다');
  assert.deepEqual(fast.res.writes[3].fx, [{ k: 'd' }], '공유 스냅샷은 수정되지 않는다');
});

test('전송: 계속 막힌 연결은 끊고 집합에서 뺀다(재연결로 재동기화)', () => {
  let t = 0;
  const transport = createRpgTransport({ maxStallMs: 5000, now: () => t });
  const slow = fakeClient(1);
  const clients = new Set([slow]);
  transport.send(clients, { q: 1, fx: [] });
  t = 4000;
  transport.send(clients, { q: 2, fx: [] });
  assert.equal(slow.res.ended, false);
  t = 6000;
  transport.send(clients, { q: 3, fx: [] });
  assert.equal(slow.res.ended, true);
  assert.equal(clients.size, 0);
  assert.equal(transport.stats.killed, 1);
});

test('전송: 대기 중 효과가 쌓여도 상한을 넘지 않는다', () => {
  const transport = createRpgTransport({ now: () => 0 });
  const slow = fakeClient(1);
  const clients = new Set([slow]);
  transport.send(clients, { q: 0, fx: [] });
  for (let i = 1; i <= 200; i += 1) transport.send(clients, { q: i, fx: [{ k: i }] });
  slow.res.emit('drain');
  assert.ok(slow.res.writes[1].fx.length <= 81);
  assert.equal(slow.res.writes[1].q, 200);
});
