'use strict';
// 1.10.328 주민 성격별 동작 (assets 123 presets.json, gamecenter-notes docs/resident-motion-presets-20261114.md): each kind's
// islanders play its own Idle / SlowWalk / Walk (and Run, or the common Run; 어르신 run on their Walk, 노을 faster), the files
// there as the bundle made them, the speeds the loops were made for times each islander's size; the lean the looks' own
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { REGISTRY } = require('../public/plaza/island-assets.js');

const EXPECT = { // (presets.json: kind -> run clip, run rate, islanders and sizes)
  Elder: ['Walk_Elder', 1, { sea_grandpa: 1, kkotnim_work: 0.62, kkotnim_off: 0.62, neuti_work: 0.8, neuti_off: 0.8 }],
  ElderBrisk: ['Walk_ElderBrisk', 6.2 / 4.2, { noeul_granny: 1 }],
  Kid: ['Run_Kid', 1, { garam: 0.75, kongi_work: 0.45, kongi_off: 0.45 }],
  Formal: ['Run', 1, { useong_off: 1.15, danbi_work: 0.82, hansol_off: 0.95, saerom_work: 1.12, darae_off: 0.86, hangyeol_work: 0.78, ted_work: 1.04 }],
  Sleuth: ['Run', 1, { detective_oh: 1 }],
  Dreamy: ['Run', 1, { haram: 1, isol: 1, goeun_off: 0.88, garak_work: 1.22 }],
  Photo: ['Run_Photo', 1, { bitna_off: 1.18, bitna_work: 1.18 }], /* (361, assets 151: 빛나's own -- the camera arm held) */
  Brisk: ['Run_Brisk', 1, { barami: 1, daon: 1, cheori_off: 0.82, bawi_work: 1.28, handeul_off: 1.3 }],
};

test('주민 성격별 동작: 묶음마다 자기 Idle·느린 걸음·걸음(·달리기), 속도는 주민 크기만큼, 기울기는 그대로', () => {
  for (const [kind, [run, runRate, who]] of Object.entries(EXPECT)) {
    for (const [id, size] of Object.entries(who)) {
      const e = REGISTRY[`character.walker.${id}`]; assert.ok(e?.preset, `${id} preset`); const p = e.preset;
      assert.deepEqual(p.animations, { idle: `Idle_${kind}`, slow: `SlowWalk_${kind}`, walk: `Walk_${kind}`, run }, id);
      for (const [k, v] of Object.entries({ slow: 1, walk: 4.2, run: 6.2 })) assert.ok(Math.abs(p.speeds[k] - v * size) < 1e-9, `${id} ${k}`);
      assert.deepEqual(p.rates, { slow: 1, walk: 1, run: runRate }, id);
      for (const clip of Object.values(p.animations)) assert.ok(p.clips[clip] || REGISTRY['character.base'].clips[clip], `${id} ${clip} loaded`);
    }
  }
  for (const id of ['bomi', 'duri', 'bandi_work', 'maru_off', 'mulgyeol_work']) assert.equal(REGISTRY[`character.walker.${id}`].preset, undefined, `${id}: the common motions`);
  const ted = REGISTRY['character.walker.ted_work']; assert.equal(ted.scale, 1.04);
});

test('주민 성격별 동작 파일: 23개가 게임 폴더에 있고 묶음 SHA256SUMS와 같은 바이트', () => {
  const dir = path.join(__dirname, '../public/assets/island/characters/motions');
  const want = Object.fromEntries(require('../tools/assets/island-models.json').files.filter((f) => f.src.startsWith('motions123:')).map((f) => [path.basename(f.out), f.sha256]));
  assert.equal(Object.keys(want).length, 23);
  for (const [name, sha] of Object.entries(want)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, name))).digest('hex'), sha, name);
  const used = new Set(Object.values(REGISTRY).flatMap((e) => Object.keys(e.preset?.clips || {}))); for (const name of Object.keys(want)) assert.ok(used.has(name.replace(/\.glb$/, '')), `${name} used`);
});
