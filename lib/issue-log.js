'use strict';

// 관리자 「문제 기록」 저장 정리 (사용자 2026-10-21 「그 방식으로 하되」, gamecenter-notes docs/admin-issue-log-20261018.md):
// the pictures live apart from the list (world `issueShot:<id>`), a solved record's picture goes 7 days after it was
// solved and the record itself 30 days after; every change leaves one `[issue]` line in the server log (no picture,
// account id, token or address) so the log can be read without signing in.
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
function logLine(event, i) {
  const c = i.ctx || {}; const s = c.island || {}; const d = c.device || {};
  return `[issue] ${JSON.stringify({
    event, id: i.id, at: new Date(i.at).toISOString(), version: i.version, kind: i.kind, status: i.status, by: i.by?.label || '',
    screen: c.screen || null, space: s.space || null, x: s.x ?? null, z: s.z ?? null, season: s.season || null, time: s.time || null, quality: s.quality ?? null,
    device: d.w ? `${d.touch ? 'phone' : 'pc'} ${d.w}x${d.h}` : null,
    text: String(i.text || '').replace(/\s*\n\s*/g, ' ').slice(0, 1000),
    error: c.errors?.length ? String(c.errors[0].text || '').split('\n')[0].slice(0, 300) : null,
    hasShot: Boolean(i.hasShot),
  })}`;
}

// 문제 기록 2회차 (사용자 2026-10-21 「사진도 서버 로그에」): a record's picture as `[issue-shot]` lines, its JPEG base64 in
// 8 KB parts ({ id, part, of, data } -- part counted from 1), so the log alone shows it again joined in order
const SHOT_PART = 8000;
function shotLines(id, shot) {
  const data = String(shot || '').replace(/^data:image\/jpeg;base64,/, ''); if (!data) return [];
  const of = Math.ceil(data.length / SHOT_PART);
  return Array.from({ length: of }, (_, k) => `[issue-shot] ${JSON.stringify({ id, part: k + 1, of, data: data.slice(k * SHOT_PART, (k + 1) * SHOT_PART) })}`);
}

module.exports = { SHOT_DAYS, KEEP_DAYS, tidy, logLine, shotLines };
