'use strict';

// B 47 함께하는 섬 ① 생일 (IDEAS #future-birthday) and ② 우체통 (#future-mailbox) -- the shared rules. Kept in each account's
// quest docs: 'birthday' { month, day, hidden, cheers: { <year>: [account…] }, paid: { <year>: true } } and 'mail'
// { letters: [{ id, from, fromName, text, itemId, at, read }] }, 'mailSent' { day, n } for the daily limit.
// (미정 그대로 정한 값 -- Claude 제안: 생일 보상 1,000P, 편지 하루 5통·200자·30일 보관, 선물은 가방 물건만 + 선물 포장지)
const BIRTHDAY_GIFT = 1000;
const BIRTHDAY_TITLE = '생일 주인공';
const LETTER_MAX = 200;
const SEND_PER_DAY = 5;
const KEEP_MS = 30 * 86400000;
const BOX_MAX = 60; // letters kept in a box at most (the oldest go first)
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const validDay = (month, day) => Number.isInteger(month) && month >= 1 && month <= 12 && Number.isInteger(day) && day >= 1 && day <= DAYS[month - 1];
// the Seoul date of `ms` as { year, month, day }
function seoul(ms) { const d = new Date(ms + 9 * 3600000); return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }; }
// is a stored birthday today (a 29 February one is kept on 28 February in other years)
function isBirthday(doc, ms) {
  if (!doc || !validDay(doc.month, doc.day)) return false;
  const t = seoul(ms); const leap = new Date(Date.UTC(t.year, 1, 29)).getUTCMonth() === 1;
  return doc.month === t.month && (doc.day === t.day || (!leap && doc.month === 2 && doc.day === 29 && t.day === 28));
}
// a letter's text: trimmed, one to LETTER_MAX characters (by code points), control characters out
function letterText(raw) {
  const text = String(raw ?? '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim();
  return text && [...text].length <= LETTER_MAX ? text : null;
}
// a box with a new letter in front, the old (30 days) and the overflow gone
const withLetter = (letters, letter, now) => [letter, ...(letters || []).filter((l) => now - l.at < KEEP_MS && l.id !== letter.id)].slice(0, BOX_MAX);
const freshLetters = (letters, now) => (letters || []).filter((l) => now - l.at < KEEP_MS);
// today's sending count after one more, or null over the limit
function sentAfter(doc, ms) { const t = seoul(ms); const day = `${t.year}-${t.month}-${t.day}`; const n = doc?.day === day ? doc.n : 0; return n >= SEND_PER_DAY ? null : { day, n: n + 1 }; }

// ③ 처음 온 사람 안내 (#future-onboarding): the guide's steps in order (the page knows how each is done and says it for a PC or
// a phone); an account made from GUIDE_FROM on starts it on its first island, anyone may start it again from 내 정보.
// (미정 그대로 정한 값 -- Claude 제안: 환영 보상 2,000P, 칭호는 이번에 없음)
const GUIDE_STEPS = Object.freeze(['move', 'camera', 'talk', 'weed', 'deliver', 'games', 'menu']);
const GUIDE_GIFT = 2000;
const GUIDE_FROM = Date.parse('2026-10-19T00:00:00+09:00');
// the next state after `kind` is done (only the current step counts), or null
function guideAfter(doc, kind) { const step = doc?.step || 0; if (doc?.done || GUIDE_STEPS[step] !== kind) return null; return step + 1 >= GUIDE_STEPS.length ? { ...doc, step: step + 1, done: true } : { ...doc, step: step + 1 }; }
module.exports = { GUIDE_STEPS, GUIDE_GIFT, GUIDE_FROM, guideAfter, BIRTHDAY_GIFT, BIRTHDAY_TITLE, LETTER_MAX, SEND_PER_DAY, KEEP_MS, validDay, seoul, isBirthday, letterText, withLetter, freshLetters, sentAfter };

if (require.main === module) {
  const assert = require('node:assert/strict');
  const at = (s) => Date.parse(`${s}T12:00:00+09:00`);
  assert.equal(isBirthday({ month: 10, day: 18 }, at('2026-10-18')), true); assert.equal(isBirthday({ month: 10, day: 18 }, at('2026-10-19')), false);
  assert.equal(isBirthday({ month: 2, day: 29 }, at('2027-02-28')), true); assert.equal(isBirthday({ month: 2, day: 29 }, at('2028-02-28')), false);
  assert.equal(isBirthday({ month: 10, day: 18 }, Date.parse('2026-10-17T15:30:00Z')), true); // 00:30 Seoul
  assert.equal(validDay(4, 31), false); assert.equal(validDay(2, 29), true);
  assert.equal(letterText('  안녕 '), '안녕'); assert.equal(letterText(''), null); assert.equal(letterText('가'.repeat(201)), null);
  const old = { id: 'a', at: at('2026-09-01') }; const box = withLetter([old], { id: 'b', at: at('2026-10-18') }, at('2026-10-18'));
  assert.deepEqual(box.map((l) => l.id), ['b']);
  let doc = null; for (let i = 0; i < SEND_PER_DAY; i += 1) doc = sentAfter(doc, at('2026-10-18'));
  assert.equal(sentAfter(doc, at('2026-10-18')), null); assert.equal(sentAfter(doc, at('2026-10-19')).n, 1);
  let g = { step: 0 }; assert.equal(guideAfter(g, 'camera'), null); for (const k of GUIDE_STEPS) g = guideAfter(g, k); assert.deepEqual(g, { step: 7, done: true }); assert.equal(guideAfter(g, 'move'), null);
  console.log('island-together ok');
}
