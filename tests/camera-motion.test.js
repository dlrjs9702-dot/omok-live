const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loaded = import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync(path.join(__dirname, '../public/plaza/camera-motion.js'), 'utf8')).toString('base64')}`);

test('카메라: 기본거리의 반미터 감소가 4m 아래로 넘어가지 않고 막힌 끝에서도 멈춘다', async () => {
  const { cameraDistance } = await loaded; const normal = Math.hypot(7.4, 10.8);
  assert.equal(cameraDistance(normal, 4, () => false), normal);
  const checked = [];
  assert.equal(cameraDistance(normal, 4, d => { checked.push(d); return true; }), 4);
  assert.ok(checked.length < 25 && checked.every(d => d >= 4));
  const cleared = cameraDistance(normal, 4, d => d > 8);
  assert.ok(cleared >= 7.5 && cleared <= 8);
});

test('카메라: 거리·위치·시선 보간은 같은 경과시간에 15/30/60/120FPS에서 같다', async () => {
  const { cameraEase } = await loaded;
  for (const weight of [0.25, 0.05, 0.08, 0.1]) {
    const expected = 1 - Math.pow(1 - weight, 60);
    assert.ok(Math.abs(cameraEase(weight, 1 / 60) - weight) < 1e-12);
    assert.equal(cameraEase(weight, 0), 0);
    for (const fps of [15, 30, 60, 120]) {
      let position = 0;
      for (let i = 0; i < fps; i++) position += (1 - position) * cameraEase(weight, 1 / fps);
      assert.ok(Math.abs(position - expected) < 1e-12, `${weight} at ${fps}fps`);
    }
  }
});
