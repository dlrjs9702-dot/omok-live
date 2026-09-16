const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_CHAT_LENGTH,
  createRoomSocial,
  appendSystemMessage,
  appendChatMessage,
  publicChatMessages,
} = require('../lib/room-social');

test('room chat is memory-only, bounded and safe for public output', () => {
  const room = { social: createRoomSocial() };
  appendSystemMessage(room, '방이 열렸습니다.');
  appendChatMessage(room, { label: '우성' }, '안녕하세요');
  let rows = publicChatMessages(room);
  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[1]), ['id', 'type', 'label', 'text', 'at']);
  assert.equal(rows[1].label, '우성');
  assert.equal(rows[1].text, '안녕하세요');

  appendChatMessage(room, { label: '길이' }, '가'.repeat(MAX_CHAT_LENGTH + 50));
  rows = publicChatMessages(room);
  assert.equal(rows.at(-1).text.length, MAX_CHAT_LENGTH);

  for (let i = 0; i < 120; i += 1) appendChatMessage(room, { label: '테스트' }, String(i));
  rows = publicChatMessages(room);
  assert.equal(rows.length, 100);
});
