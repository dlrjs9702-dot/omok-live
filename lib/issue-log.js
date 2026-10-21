'use strict';

// 관리자 「문제 기록」 저장 정리 (사용자 2026-10-21 「그 방식으로 하되」, gamecenter-notes docs/admin-issue-log-20261018.md):
// the pictures live apart from the list (world `issueShot:<id>`), a solved record's picture goes 7 days after it was
// solved and the record itself 30 days after; every change leaves one `[issue]` line in the server log (no picture,
// account id, token or address) so the log can be read without signing in.
const crypto = require('node:crypto');
const DAY = 86400e3;
const SHOT_DAYS = 7;
const KEEP_DAYS = 30;

// the day's tidy: { list, dropShots: ids whose picture goes, gone: records removed }
function tidy(list, now) {
  const out = []; const dropShots = []; const gone = [];
  for (const i of list) {
    const age = i.status === 'done' ? now - (i.changedAt ?? i.at) : 0;
    if (age >= KEEP_DAYS * DAY) { gone.push(i); if (i.hasShot) dropShots.push(i.id); continue; }
    if (age >= SHOT_DAYS * DAY && i.hasShot) { dropShots.push(i.id); out.push({ ...i, hasShot: false }); continue; }
    out.push(i);
  }
  return { list: out, dropShots, gone };
}

// one server-log line for a record added / its state changed / removed
function logLine(event, i, shot = null) {
  const c = i.ctx || {}; const s = c.island || {}; const d = c.device || {};
  return `[issue] ${JSON.stringify({
    event, id: i.id, at: new Date(i.at).toISOString(), version: i.version, kind: i.kind, status: i.status, by: i.by?.label || '',
    screen: c.screen || null, space: s.space || null, x: s.x ?? null, z: s.z ?? null, season: s.season || null, time: s.time || null, quality: s.quality ?? null, camera: s.camera || null,
    device: d.w ? `${d.touch ? 'phone' : 'pc'} ${d.w}x${d.h}` : null,
    text: String(i.text || '').replace(/\s*\n\s*/g, ' ').slice(0, 1000),
    error: c.errors?.length ? String(c.errors[0].text || '').split('\n')[0].slice(0, 300) : null,
    hasShot: Boolean(i.hasShot), shot,
  })}`;
}

// 문제 기록 2회차 (사용자 2026-10-21 「사진도 서버 로그에」): the log line carries a link to the record's picture instead of
// the picture -- signed with the server's own key (HMAC-SHA256 of id and expiry), good for LINK_DAYS, the one JPEG and
// nothing else, no sign-in. A wrong or old signature is a 404 like a missing picture.
const LINK_DAYS = 7;
const shotSig = (key, id, exp) => crypto.createHmac('sha256', key).update(`${id}.${exp}`).digest('hex').slice(0, 32);
function shotLink(key, id, now) { const exp = Math.floor(now / 1000) + LINK_DAYS * 86400; return `/api/issues/shot/${id}?exp=${exp}&sig=${shotSig(key, id, exp)}`; }
function shotLinkOk(key, id, exp, sig, now) {
  if (!/^[\w-]{1,64}$/.test(String(id)) || !/^\d{9,12}$/.test(String(exp)) || !/^[0-9a-f]{32}$/.test(String(sig)) || Number(exp) * 1000 < now) return false;
  const want = Buffer.from(shotSig(key, id, exp)); const got = Buffer.from(String(sig)); return want.length === got.length && crypto.timingSafeEqual(want, got);
}

module.exports = { SHOT_DAYS, KEEP_DAYS, LINK_DAYS, tidy, logLine, shotLink, shotLinkOk };
