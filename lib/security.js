const crypto = require('crypto');

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode() {
  let raw = '';
  for (let i = 0; i < 8; i++) raw += ROOM_ALPHABET[crypto.randomInt(ROOM_ALPHABET.length)];
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function normalizeRoomCode(value) {
  const raw = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : '';
}

function newSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function safeEqualText(a, b) {
  const ah = crypto.createHash('sha256').update(String(a)).digest();
  const bh = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ah, bh);
}

function sanitizeLabel(value) {
  return String(value || '')
    .trim()
    .replace(/[<>\r\n\t]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40);
}

function safeFilename(label) {
  const base = sanitizeLabel(label).replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_') || 'guest';
  return `오목입장_${base}.html`;
}

function makeGuestFile({ baseUrl, token, label }) {
  const action = `${String(baseUrl).replace(/\/$/, '')}/guest-entry`;
  const esc = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<title>오목 입장 - ${esc(label)}</title>
<style>body{font-family:system-ui,sans-serif;background:#111827;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}.box{max-width:420px;padding:32px;text-align:center;background:#1f2937;border-radius:20px}button{font-size:18px;padding:14px 22px;border:0;border-radius:12px;font-weight:800;cursor:pointer}small{display:block;margin-top:16px;color:#9ca3af}</style>
</head>
<body>
<div class="box">
<h1>오목 입장</h1>
<p>${esc(label)} 전용 입장 파일입니다.</p>
<form id="entry" method="post" action="${esc(action)}">
<input type="hidden" name="token" value="${esc(token)}">
<button type="submit">오목 입장하기</button>
</form>
<small>이 파일 자체가 출입 열쇠입니다. 다른 사람에게 전달하지 마세요.</small>
</div>
<script>document.getElementById('entry').submit();</script>
</body>
</html>`;
}

module.exports = {
  ROOM_ALPHABET,
  generateRoomCode,
  normalizeRoomCode,
  newSecret,
  safeEqualText,
  sanitizeLabel,
  safeFilename,
  makeGuestFile,
};
