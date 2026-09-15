const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateRoomCode,
  normalizeRoomCode,
  newSecret,
  safeEqualText,
  sanitizeLabel,
  safeFilename,
  makeGuestFile,
} = require('../lib/security');

test('방 비밀번호는 4-4 형식의 강한 코드다', () => {
  for (let i = 0; i < 30; i++) assert.match(generateRoomCode(), /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
});

test('방 비밀번호 입력을 표준 형식으로 정규화한다', () => {
  assert.equal(normalizeRoomCode('abcd efgh'), 'ABCD-EFGH');
  assert.equal(normalizeRoomCode('ABCD-EFG'), '');
});

test('세션/입장 토큰은 충분히 길다', () => {
  assert.ok(newSecret(32).length >= 40);
});

test('관리자 비밀번호 비교는 정상 동작한다', () => {
  assert.equal(safeEqualText('abc', 'abc'), true);
  assert.equal(safeEqualText('abc', 'abd'), false);
});

test('입장 파일은 토큰을 URL 쿼리에 넣지 않고 POST 한다', () => {
  const html = makeGuestFile({ baseUrl: 'https://omok-live.onrender.com', token: 'SECRET_TOKEN', label: '우성_PC' });
  assert.match(html, /method="post"/);
  assert.match(html, /action="https:\/\/omok-live\.onrender\.com\/guest-entry"/);
  assert.match(html, /value="SECRET_TOKEN"/);
  assert.doesNotMatch(html, /guest-entry\?token=/);
});

test('게스트 파일명과 라벨을 안전하게 만든다', () => {
  assert.equal(sanitizeLabel('  우성\n<PC>  '), '우성PC');
  assert.equal(safeFilename('우성/PC'), '오목입장_우성_PC.html');
});
