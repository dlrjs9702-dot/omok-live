'use strict';
// 문제 기록 1103 8: the board under a station's name says the next train in whole minutes -- the server's count for 철이's
// 2단계 (up, ±1 taken); under a minute 「곧 도착」; the platform's note in minutes and seconds
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../public/plaza/island-train');

test('역 도착 안내판: 분 올림이 서버 판정과 같음, 1분 안은 곧 도착, 승강장은 분·초', () => {
  const st = Object.keys(R.STATIONS)[0]; let checked = 0;
  for (let ms = Date.parse('2026-11-04T09:00:00Z'); ms < Date.parse('2026-11-04T09:00:00Z') + 600000; ms += 7000) {
    const soon = Object.values(R.nextAt(st, ms)).filter((v) => v != null); if (!soon.length) continue;
    const sec = Math.min(...soon); const server = Math.ceil(sec / 60); const text = R.arrivalText(st, ms);
    if (sec < 60) assert.match(text, /곧 도착$/); else { const shown = Number(text.match(/(\d+)분 뒤$/)[1]); assert.ok(Math.abs(shown - server) <= 1, `${text} vs ${server}`); assert.equal(shown, server); }
    checked += 1;
  }
  assert.ok(checked > 50);
  assert.deepEqual([R.waitText(135), R.waitText(59), R.waitText(60)], ['2분 15초', '59초', '1분 0초']);
});
