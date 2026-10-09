'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../public/app.js'), 'utf8');

test('팝업 입력: 채팅/PIP 입력도 같은 1분 제한으로 서버에 활동 전달·재연결 중복 없음', () => {
  const a = source.indexOf('  let inputSentAt = 0;');
  const b = source.indexOf('  function expireSession(', a);
  const calls = []; let now = 120000;
  const surface = () => ({ handlers: new Map(), addEventListener(type, fn) { this.handlers.set(type, fn); } });
  const main = surface(), chat = surface(), pip = surface();
  const context = { window: main, WeakSet, Date: { now: () => now }, sessionToken: 'account', api: async (...args) => calls.push(args) };
  vm.runInNewContext(source.slice(a, b) + '; bindInputActivity(chat); bindInputActivity(pip); bindInputActivity(chat);', { ...context, chat, pip });
  chat.handlers.get('keydown')(); pip.handlers.get('pointerdown')();
  assert.equal(calls.length, 1);
  now += 60000; pip.handlers.get('wheel')(); assert.equal(calls.length, 2);
  assert.equal(calls[0][0], '/api/session/input');
  assert.equal(chat.handlers.size, 5); assert.equal(pip.handlers.size, 5);
  assert.ok(source.includes('chatPipWindow = pipWindow;\n    bindInputActivity(pipWindow);'));
  assert.ok(source.includes('gameInfoPipWindow = pipWindow;\n      bindInputActivity(pipWindow);'));
});

test('이벤트 수령 행: 첫 승리 제한 문구를 섞지 않고 수령 가능/완료를 표시', () => {
  const a = source.indexOf('  function missionRow('), b = source.indexOf('  function renderMissions(', a);
  const element = () => ({ children: [], style: {}, setAttribute() {}, append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); } });
  const context = { document: { createElement: element } };
  vm.runInNewContext(source.slice(a, b), context);
  const row = context.missionRow({ title: '이벤트', reward: 1000 }, { bonus: true, event: true });
  assert.equal(row.children[1].textContent, '수령 가능');
  assert.equal(context.missionRow({ title: '이벤트', reward: 1000, done: true }, { bonus: true, event: true }).children[1].textContent, '받았습니다');
  assert.match(context.missionRow({ title: '첫 승리', reward: 5000 }, { bonus: true }).children[1].textContent, /첫 승리/);
});
