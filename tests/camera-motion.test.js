const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const loaded = import(`data:text/javascript;base64,${Buffer.from(fs.readFileSync(path.join(__dirname, '../public/plaza/camera-motion.js'), 'utf8')).toString('base64')}`);

test('하늘 시선: 바닥·건물 보정 뒤에도 위를 보는 각도를 유지하고 기본 시선은 그대로 둔다', async () => {
  const { cameraSkyAim } = await loaded;
  const distance = 12, orbit = 1.5, look = orbit + distance;
  for (const raised of [orbit, 4, 8.5]) {
    const angle = Math.atan2(cameraSkyAim(look, orbit, raised, Math.PI / 4) - raised, distance);
    assert.ok(Math.abs(angle - Math.PI / 4) < 1e-12);
  }
  assert.equal(cameraSkyAim(1.3, orbit, 8.5, 0), 1.3);
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
