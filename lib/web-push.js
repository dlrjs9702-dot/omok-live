'use strict';
// 메신저 단독 창 ③ 꺼져 있어도 알림 (gamecenter-notes docs/messenger-standalone-20261025.md): Web Push with node's own
// crypto -- the message encrypted for the device (RFC 8291 aes128gcm) and the server's VAPID signature (RFC 8292, ES256).
// The keys come from the environment: VAPID_PUBLIC_KEY (65 bytes, uncompressed point) and VAPID_PRIVATE_KEY (32 bytes),
// both base64url, and VAPID_SUBJECT (mailto: or https:). Without them there is no push (the page offers none).
// New keys: node lib/web-push.js keys
const crypto = require('node:crypto');

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const fromB64u = (s) => Buffer.from(String(s || ''), 'base64url');

function generateKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' }); const pub = publicKey.export({ format: 'jwk' });
  return { publicKey: b64u(Buffer.concat([Buffer.from([4]), fromB64u(pub.x), fromB64u(pub.y)])), privateKey: jwk.d };
}

function vapidFromEnv(env = process.env) {
  const pub = fromB64u(env.VAPID_PUBLIC_KEY); const d = fromB64u(env.VAPID_PRIVATE_KEY);
  if (pub.length !== 65 || pub[0] !== 4 || d.length !== 32) return null;
  return { publicKey: b64u(pub), privateKey: crypto.createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: b64u(d), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) } }), subject: String(env.VAPID_SUBJECT || 'mailto:admin@example.com') };
}

// the VAPID header for one push service (its origin is the audience), good for 12 hours
function vapidHeader(endpoint, vapid, nowSec = Math.floor(Date.now() / 1000)) {
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: vapid.subject }));
  const sig = crypto.sign('sha256', Buffer.from(`${head}.${body}`), { key: vapid.privateKey, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${vapid.publicKey}`;
}

// one record, encrypted for the device's key (p256dh) and secret (auth)
function encrypt(payload, p256dh, auth, { salt = crypto.randomBytes(16), ecdh = null } = {}) {
  const ua = fromB64u(p256dh); const secret = fromB64u(auth);
  if (!ecdh) { ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); } // (a new key for every message)
  const as = ecdh.getPublicKey();
  const ikm = Buffer.from(crypto.hkdfSync('sha256', ecdh.computeSecret(ua), secret, Buffer.concat([Buffer.from('WebPush: info\0'), ua, as]), 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = as.length;
  return Buffer.concat([head, as, body]);
}

// (Codex 검토 2차 #2) only the browsers' own push services: an endpoint is a URL the device hands us, and the server posts
// to it -- any other https address (an inside one too) would have the server ask it for us
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/];
function allowedEndpoint(endpoint) {
  let u; try { u = new URL(String(endpoint)); } catch { return false; }
  return u.protocol === 'https:' && (u.port === '' || u.port === '443') && !u.username && !u.password && PUSH_HOSTS.some((h) => h.test(u.hostname));
}

// sent; the status back (404/410: the subscription is gone -- the caller forgets it). No redirect followed, 10 s at most,
// the answer's body let go
async function send(sub, payload, vapid, { ttl = 24 * 3600, fetchImpl = fetch, timeoutMs = 10000 } = {}) {
  if (!allowedEndpoint(sub.endpoint)) return 410; // (one kept from before the check: forgotten)
  const res = await fetchImpl(sub.endpoint, { method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs), headers: { TTL: String(ttl), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Urgency: 'high', Authorization: vapidHeader(sub.endpoint, vapid) }, body: encrypt(JSON.stringify(payload), sub.p256dh, sub.auth) });
  await res.body?.cancel?.().catch(() => {});
  return res.status;
}

// who is told of a new line in a room: the members but the sender, not those who muted it, not one whose messenger is
// open now (a stream: they see it at once) -- and what they read on the notice
function pushFor(room, from, fromLabel, text, streaming = new Set()) {
  const to = room.members.filter((id) => id !== from && !room.muted.includes(id) && !streaming.has(id));
  const title = room.kind === 'dm' ? fromLabel : `${room.name}`;
  const body = room.kind === 'dm' ? text.slice(0, 120) : `${fromLabel}: ${text}`.slice(0, 120);
  return { to, payload: { title, body, room: room.id } };
}

module.exports = { generateKeys, vapidFromEnv, vapidHeader, encrypt, send, pushFor, allowedEndpoint };

if (require.main === module && process.argv[2] === 'keys') {
  const k = generateKeys();
  console.log(`VAPID_PUBLIC_KEY=${k.publicKey}\nVAPID_PRIVATE_KEY=${k.privateKey}\nVAPID_SUBJECT=mailto:(관리자 연락 메일)`);
}
