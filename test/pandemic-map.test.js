'use strict';
const test = require('node:test').skip; /* (2026-11-20 사용자 결정 9 B: 팬데믹 전용 시험은 팬데믹을 다시 켤 때까지 건너뜀(CI 흔들림 「팬데믹 4인: pending 복구…」, 원인 조사는 그때). 되살릴 때 이 표시를 지워요.) */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CITIES, CITY_IDS } = require('../lib/games/pandemic-data');

test('팬데믹 클라이언트 지도 표는 서버 도시 데이터와 같다', () => {
  const window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '..', 'public', 'pandemic-map.js'), 'utf8'))(window);
  const { cities, width, height } = window.PandemicMap;
  assert.deepEqual(cities.map(c => c.id).sort(), [...CITY_IDS].sort());
  for (const c of cities) {
    const s = CITIES[c.id];
    assert.deepEqual([c.name, c.color, c.pop, [...c.links].sort()], [s.name, s.color, s.population, [...s.links]], c.id);
    assert.ok(c.x >= 0 && c.x <= width && c.y >= 0 && c.y <= height, `${c.id} 좌표`);
  }
});
