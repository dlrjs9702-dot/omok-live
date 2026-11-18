'use strict';
// 364 (user 「수조에 대형 물고기 안들어가나지금?」): every one of the fifty fish has a tank size -- by its biggest size (30 cm small,
// 80 medium, more large), 150 cm and more takes six places as the giant tuna -- so each goes into some tank
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../lib/island-fishing');
const H = require('../public/plaza/island-home');

test('수조: 50종 모두 크기가 있고, 가장 큰 크기로 정한 등급·자리, 어느 수조엔 들어감', () => {
  const ids = Object.keys(F.SPECIES); assert.equal(ids.length, 50);
  const first21 = ['anchovy', 'crucian_carp', 'gizzard_shad', 'goby', 'mackerel', 'pale_chub', 'smelt', 'sweetfish', 'pufferfish', 'carp', 'catfish', 'cutlassfish', 'eel', 'flatfish', 'mandarin_fish', 'mullet', 'octopus', 'rockfish', 'sea_bass', 'stingray', 'giant_tuna'];
  for (const id of ids) {
    const key = `fish_${id}`; const max = F.SIZES[id][1]; const size = H.FISH_SIZE[key];
    assert.ok(size, `${id}: 수조 크기 없음`);
    if (!first21.includes(id)) assert.equal(size, max <= 30 ? 'small' : max <= 80 ? 'medium' : 'large', `${id} ${max} cm`);
    assert.equal(H.fishRoom(key), max >= 150 ? 6 : 1, `${id}: 150 cm 넘으면 6자리`);
    assert.ok(Object.keys(H.TANKS).some((shape) => H.fits(shape, key)), `${id}: 들어갈 수조 없음`);
    assert.ok(H.fits('aquarium_wall', key), `${id}: 벽 수조엔 다 들어감`);
  }
  for (const id of ['medaka', 'minnow', 'seahorse', 'bitterling']) assert.ok(H.fits('fish_bowl', `fish_${id}`), `${id} 어항`);
  for (const id of ['sunfish', 'giant_squid', 'dotdom']) { assert.ok(H.fits('aquarium_big', `fish_${id}`)); assert.equal(H.tankRoom('aquarium_big', [{ itemId: 'fish_goby' }, { itemId: 'fish_goby' }, { itemId: 'fish_goby' }], `fish_${id}`), false, '큰 수조 8자리: 셋 있으면 6자리 못 들어감'); }
  assert.equal(H.fits('aquarium_big', 'fish_yellowtail'), false, '90 cm 방어는 벽 수조만');
  for (const id of ['blue_crab', 'crayfish', 'octopus']) assert.ok(H.BOTTOM.has(`fish_${id}`), `${id} 바닥`);
});
