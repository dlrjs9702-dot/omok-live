'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ui = fs.readFileSync(path.join(root, 'public', 'gostop-ui.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'lib', 'games', 'gostop', 'engine.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

test('고스톱 공개 상태는 손패·산 순서를 포함하지 않고 손패는 본인 좌석에만 붙는다', () => {
  const view = engine.slice(engine.indexOf('function publicState('), engine.indexOf('function handFor('));
  assert.doesNotMatch(view, /game\.hands\[|game\.deck\]|\.\.\.game\.deck|hands:/);
  assert.match(view, /deckCount: game\.deck\.length/);
  assert.match(server, /myGostopHand: isGostop\(room\) && seat \? getGame\('gostop'\)\.handFor\(room\.game, seat\) : null/);
});

test('화면은 남의 손패를 개수만큼의 뒷면으로만 그리고 카드 값을 DOM 속성에 넣지 않는다', () => {
  assert.match(ui, /for \(let i = 0; i < info2\.handCount; i \+= 1\) hand\.append\(backEl\('tiny'\)\)/);
  assert.doesNotMatch(ui, /dataset\.|data-card|setAttribute\('data-/);
  assert.match(ui, /const mine = state\.me\.myGostopHand;/);
});

test('정산 금액·배수는 서버 엔진이 계산하고 클라이언트 입력은 카드 id·선택만 받는다', () => {
  const actions = server.slice(server.indexOf("if (action.startsWith('gostop-')"), server.indexOf("if (action === 'choose-role') {"));
  assert.doesNotMatch(actions, /body\.(amount|score|multiplier|balance|points(?!PerScore))/);
  assert.match(actions, /body\.cardId/);
  assert.match(server, /settlementId: `gostop:\$\{room\.id\}:\$\{game\.round\}`/);
  assert.match(server, /await settleGostopIfNeeded\(room, result\);/);
  // Points: no transfer endpoint exists.
  assert.doesNotMatch(server, /\/api\/points\/(transfer|send|gift|buy|withdraw)/);
});
