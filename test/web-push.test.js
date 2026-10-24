'use strict';
// 메신저 ③ Web Push (lib/web-push.js): what a browser receives decrypts with its own key and secret (RFC 8291, as a push
// service hands it on), the VAPID signature checks with the public key, and who is told of a new line
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const P = require('../lib/web-push');

// the browser's side: its key pair and secret, and RFC 8291 decryption
function browser() {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const auth = crypto.randomBytes(16);
  return { ecdh, sub: { endpoint: 'https://push.example.net/send/abc', p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') }, auth };
}
function decrypt(body, { ecdh, auth }) {
  const salt = body.subarray(0, 16); const idlen = body[20]; const as = body.subarray(21, 21 + idlen); const data = body.subarray(21 + idlen);
  const ua = ecdh.getPublicKey();
  const ikm = Buffer.from(crypto.hkdfSync('sha256', ecdh.computeSecret(as), auth, Buffer.concat([Buffer.from('WebPush: info\0'), ua, as]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const d = crypto.createDecipheriv('aes-128-gcm', cek, nonce); d.setAuthTag(data.subarray(-16));
  const plain = Buffer.concat([d.update(data.subarray(0, -16)), d.final()]);
  assert.equal(plain.at(-1), 2); // (the last record's delimiter)
  return plain.subarray(0, -1).toString();
}

test('웹 푸시: 받는 기기 키로 풀리고, VAPID 서명은 공개 키로 맞고, 키가 없으면 꺼짐', async () => {
  const b = browser();
  const body = P.encrypt(JSON.stringify({ title: '가족방', body: '엄마: 저녁 먹자' }), b.sub.p256dh, b.sub.auth);
  assert.equal(body.readUInt32BE(16), 4096);
  assert.deepEqual(JSON.parse(decrypt(body, b)), { title: '가족방', body: '엄마: 저녁 먹자' });
  const keys = P.generateKeys(); const vapid = P.vapidFromEnv({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'mailto:a@b.c' });
  const header = P.vapidHeader(b.sub.endpoint, vapid, 1000);
  const [, jwt, k] = header.match(/^vapid t=([^,]+), k=(.+)$/); assert.equal(k, keys.publicKey);
  const [h, c, s] = jwt.split('.'); assert.deepEqual(JSON.parse(Buffer.from(c, 'base64url')), { aud: 'https://push.example.net', exp: 1000 + 12 * 3600, sub: 'mailto:a@b.c' });
  const pub = Buffer.from(keys.publicKey, 'base64url');
  const key = crypto.createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') } });
  assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));
  assert.equal(P.vapidFromEnv({}), null);
  // sent: the headers a push service wants
  let seen = null; const status = await P.send(b.sub, { title: 't', body: 'b' }, vapid, { fetchImpl: async (url, init) => { seen = { url, init }; return { status: 201 }; } });
  assert.equal(status, 201); assert.equal(seen.url, b.sub.endpoint); assert.equal(seen.init.headers['Content-Encoding'], 'aes128gcm'); assert.match(seen.init.headers.Authorization, /^vapid t=/);
  assert.deepEqual(JSON.parse(decrypt(seen.init.body, b)), { title: 't', body: 'b' });
});

test('웹 푸시 암호화: RFC 8291 부록 A의 예와 바이트까지 같음', () => {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.setPrivateKey(Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', 'base64url'));
  const body = P.encrypt('When I grow up, I want to be a watermelon', 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'BTBZMqHH6r4Tts7J_aSIgg',
    { salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url'), ecdh });
  assert.equal(body.toString('base64url'), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('웹 푸시 받는 사람: 보낸 사람·알림 끈 사람·지금 메신저를 보고 있는 사람은 빼고, 1:1은 보낸 사람 이름이 제목', () => {
  const group = { id: 'r1', kind: 'group', name: '가족방', members: ['a', 'b', 'c', 'd'], muted: ['c'] };
  assert.deepEqual(P.pushFor(group, 'a', '엄마', '저녁 먹자', new Set(['d'])), { to: ['b'], payload: { title: '가족방', body: '엄마: 저녁 먹자', room: 'r1' } });
  const dm = { id: 'r2', kind: 'dm', name: '', members: ['a', 'b'], muted: [] };
  assert.deepEqual(P.pushFor(dm, 'b', '아빠', 'x'.repeat(200)).payload, { title: '아빠', body: 'x'.repeat(120), room: 'r2' });
});
