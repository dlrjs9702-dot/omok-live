'use strict';
const test = require('node:test');
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
