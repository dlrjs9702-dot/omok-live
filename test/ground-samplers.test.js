'use strict';
// 1.10.359 (사용자 폰 갤럭시 폴드: 이웃골 물가에 땅이 안 보임 -- 1.10.357의 찻길 지도로 땅 셰이더의 텍스처가 17칸이 되어, 16칸까지인
// 폰 GPU에서 프로그램 연결이 실패): the ground's material reads at most 16 textures on a phone -- its own samplers, plus three.js's
// two for a lit standard material (dfgLUT, the sun's shadow map). Counted from the shader's text: every sampler it declares for the
// ground (tEdge is the old path strips' only -- never read by the ground's program). Kept at 15, one spare.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('땅 셰이더 텍스처 칸: 땅 재질이 쓰는 sampler + three.js 2개(dfgLUT·그림자) ≤ 15 (폰 한도 16)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../public/plaza/island.js'), 'utf8');
  const a = src.indexOf('const grained = ('); const b = src.indexOf('customProgramCacheKey', a); assert.ok(a > 0 && b > a, 'grained()');
  const part = src.slice(a, b);
  const names = new Set([...part.matchAll(/uniform sampler2D (\w+);/g)].map((m) => m[1])); names.delete('tEdge');
  assert.ok(names.has('tGrains') && names.has('tRoad'), [...names].join(','));
  assert.ok(names.size + 2 <= 15, `${names.size} + 2: ${[...names].join(', ')}`);
});
