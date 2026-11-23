'use strict';
// 1.10.423 다듬기 (assets 164 HANDOFF A · B · C): the five files replaced, the fountain's water, the creek's stones, the quarry rocks' dust and the
// taxi's roof mark wired; the insect held up back-to-camera and a small fish on the fingers
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const crypto = require('node:crypto');
const ROOT = path.join(__dirname, '..'); const G = path.join(ROOT, 'public/assets/island');
const scene = fs.readFileSync(path.join(ROOT, 'public/plaza/plaza-scene.js'), 'utf8');
const taxi = fs.readFileSync(path.join(ROOT, 'public/plaza/island-taxi-scene.js'), 'utf8');
const { REGISTRY } = require('../public/plaza/island-assets.js');
const P = require('../public/plaza/isle2-props.js');
const sha = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(G, rel))).digest('hex');

test('164 A: 바꿔 넣은 다섯 (메달리온 · 마루 모자 띠 · 벽 수조 셋) -- 넘긴 SHA 그대로', () => {
  const want = { 'plaza-v1/plaza_medallion.glb': '96d2bdca5f4b', 'plaza-v1/plaza_medallion_low.glb': '97bacd348a05', 'characters/npc_walker_maru_work.glb': '96957f40075d', 'characters/npc_walker_maru_work_low.glb': '0e58e11004a0', 'furniture-v1/furn_aquarium_wall__oak.glb': 'a6aacf06ca65', 'furniture-v1/furn_aquarium_wall__stone.glb': '0799a0da263d', 'furniture-v1/furn_aquarium_wall__white.glb': 'af65f275141b' };
  for (const [f, s] of Object.entries(want)) assert.ok(sha(f).startsWith(s), f);
});

test('164 B: 새 등록 9개와 그 파일', () => {
  const ids = { 'project.fountain_water': 'projects-v1/fountain_water', 'byeolmaru.creek_stone_a': 'byeolmaru-v1/creek_stone_a', 'byeolmaru.creek_stone_b': 'byeolmaru-v1/creek_stone_b', 'byeolmaru.creek_stone_c': 'byeolmaru-v1/creek_stone_c', 'quarry.skirt_a': 'quarry-v1/quarry_skirt_a', 'quarry.skirt_b': 'quarry-v1/quarry_skirt_b', 'quarry.skirt_c': 'quarry-v1/quarry_skirt_c', 'taxi.roof_sign': 'taxi-v1/taxi_roof_sign' };
  for (const [id, f] of Object.entries(ids)) { assert.ok(REGISTRY[id], id); assert.equal(REGISTRY[id].url, `/assets/island/${f}.glb`, id); assert.equal(REGISTRY[id].low?.url, `/assets/island/${f}_low.glb`, id); assert.ok(fs.existsSync(path.join(G, `${f}.glb`)) && fs.existsSync(path.join(G, `${f}_low.glb`)), f); }
  assert.equal(REGISTRY['project.fountain_water'].keepNodes, true); assert.equal(REGISTRY['taxi.roof_sign'].rotationY, REGISTRY['taxi.car'].rotationY);
});

test('164 ② 분수 물: 새 단장 분수에 붙고 물방울 8개는 숨김, 물결 · 물줄기 움직임', () => {
  assert.match(scene, /assets\.attach\('project\.fountain_water', w, new THREE\.Group\(\), \(entry\) => \{[^\n]*m\.depthWrite = false;[^\n]*for \(const d of drops\) d\.visible = false;/);
  assert.match(scene, /const s = 1 \+ 0\.12 \* k\(ph\); o\.scale\.set\(s, 1, s\);/); assert.match(scene, /\[\[P\.ripple, 0\], \[P\.ripple_top, 0\.5\]\]/); assert.match(scene, /P\.jet\.position\.y = P\.jet\.userData\.y0 \+ Math\.sin\(t \* 4\.8\) \* 0\.03;/);
  assert.match(scene, /stepFountainWater\(ambientClock\);/);
});

test('164 ④ 개울 돌 24곳: 둑 돌만 막는 원, 물 높이에, 대역 상자가 원을 덮음', () => {
  assert.equal(P.CREEK_STONES.length, 24); assert.deepEqual(P.CREEK_KINDS, ['creek_stone_a', 'creek_stone_b', 'creek_stone_c']);
  const banks = P.CREEK_STONES.filter((s) => s[5] > 0); assert.equal(banks.length, 20);
  const all = P.solids(); for (const [x, z, , , , r] of banks) assert.ok(all.some((c) => c.x === x && c.z === z && c.r === r), `${x},${z}`);
  assert.match(scene, /g\.position\.set\(x, T\.creekWaterY \? T\.creekWaterY\(x, z\) : heightAt\(x, z\), z\); g\.rotation\.y = yaw; g\.scale\.setScalar\(s\);/);
  assert.match(scene, /const w = r > 0 \? \(r \* 2\) \/ s : 0\.8;/);
});

test('164 ⑤ 채석장 돌가루 · ⑦ 택시 지붕 표식', () => {
  assert.match(scene, /assets\.attach\(`quarry\.skirt_\$\{q\.r\.kind\}`, q\.s, new THREE\.Group\(\)\);/); assert.match(scene, /if \(q\.s\) assets\.detach\(q\.s\);/);
  assert.match(taxi, /const sign = new THREE\.Group\(\); h\.add\(sign\); assets\.attach\('taxi\.roof_sign', sign, new THREE\.Group\(\)\);/);
});

test('164 D: 폰 대회 띠 한 줄 · 마루 자리 길 쪽 · 캘 수 있는 돌 하나 금테 · 벽 수조 물고기 조금 밝게', () => {
  const css = fs.readFileSync(path.join(ROOT, 'public/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(css.includes('@media (max-width:640px){body.touchIsland .islandTopRow .contestBar{margin:2px auto 0 0;max-width:calc(100% - 140px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}'));
  assert.match(fs.readFileSync(path.join(ROOT, 'public/plaza/island-townhall.js'), 'utf8'), /const aside = at\(-gx - 0\.95, Y\.z1 \+ 2\.1\);/);
  assert.match(scene, /const q = m && m\[1\] !== 'wall' \? quarryRocks\.get\(m\[1\]\) : null; const on = Boolean\(q\?\.h && q\.stage === 'full'\);/); assert.match(scene, /function stepTargetRing\(\) \{\s*stepQuarryRing\(\);/);
  assert.match(scene, /const litFish = shape === 'aquarium_wall' \?/); assert.match(scene, /c\.color\.multiplyScalar\(1\.3\)/);
});

test('164 둘째: 건널목 막대는 가장 가까운 건널목의 곧은 줄로 · 방에 들어가면 3인칭도 안쪽을 봄', () => {
  const X = require('../public/plaza/island-taxi.js'); const Pth = require('../public/plaza/island-paths.js'); const F = Pth.crossFrames(X);
  assert.equal(F.length, X.CROSSINGS.length); for (const [, , nx, nz] of F) assert.ok(Math.abs(Math.hypot(nx, nz) - 1) < 1e-9);
  const isl = fs.readFileSync(path.join(ROOT, 'public/plaza/island.js'), 'utf8');
  assert.match(isl, /uniform vec4 uCross\[' \+ CROSS_N \+ '\];/, 'inside the quoted declarations: joined, not a ${} left in the GLSL'); assert.doesNotMatch(isl, /'[^'\n]*uCross\[\$\{CROSS_N\}\][^'\n]*'/);
  assert.match(isl, /for \(int i = 0; i < \$\{CROSS_N\}; i\+\+\) \{ vec2 cd = vGroundXZ - uCross\[i\]\.xy;/); assert.match(isl, /abs\(fract\(across \/ 0\.9\) - 0\.5\)/); assert.match(isl, /uCross: \{ value: CROSS_V \}/);
  assert.match(scene, /else if \(mySpace !== 'island'\) camYaw = yawGoal = me\.targetYaw - Math\.PI;/);
});

test('164 둘째 밤 빛: 가로등마다 밤에만 부드러운 빛 웅덩이(땅 높이), 분수 물결 테는 밤에 조금 밝게', () => {
  assert.match(scene, /PROPS\.lamps\.forEach\(\(l, i\) => lampPools\.setMatrixAt\(i, new THREE\.Matrix4\(\)\.makeTranslation\(l\.x, heightAt\(l\.x, l\.z\) \+ 0\.06, l\.z\)\)\)/);
  assert.match(scene, /lampPools\.visible = Boolean\(night\) && mySpace === 'island';/); assert.match(scene, /map: poolTex, transparent: true, opacity: 0\.32, depthWrite: false, blending: THREE\.AdditiveBlending/);
  assert.match(scene, /\* \(night \? 1\.4 : 1\)\)/);
  const at = scene.indexOf('const lampPools'); assert.ok(at > 0 && !scene.slice(scene.indexOf('const poolTex'), at).includes('textures.push'), 'no use of the later-declared textures list there');
});

test('164 ⑧ 손에 든 채집물: 곤충 등은 화면 쪽 · 날개 넓은 10종 0.26, 작은 물고기는 손가락 위', () => {
  assert.match(scene, /const insectHold = \(sp\) => \(\{ key: 'catch', at: \[-0\.0343, 0\.0939, -0\.03\], rot: \[1\.5707, 0\.35, -3\.1415\], size: INSECT_WIDE\.has\(sp\) \? 0\.26 : SHOW_MIN\.insect \}\);/);
  assert.equal((scene.match(/insectHold\((s\.species|p\.fish)\)/g) || []).length, 2); assert.doesNotMatch(scene, /at: \[0, 0, -0\.065\], size: SHOW_MIN\.insect/);
  const wide = scene.match(/const INSECT_WIDE = new Set\((\[[^\]]+\])\)/); assert.equal(JSON.parse(wide[1].replace(/'/g, '"')).length, 10);
  assert.match(scene, /\.addScaledVector\(U, \(a\.tallH \* acrossS\.getComponent\(a\.tall\)\) \/ 2 \+ 0\.03\)/);
});
