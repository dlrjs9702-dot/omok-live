'use strict';

// 잿빛 원정: 1~4인 협동 3D 로그라이크 액션 RPG (v0.1 수직 슬라이스). Engine and data live in ./rpg/.
const engine = require('./rpg/engine');

module.exports = {
  id: 'rpg',
  name: '잿빛 원정',
  size: 0,
  rules: '1~4명이 수호자·사냥꾼·비술사 중 하나를 골라 방향키로 직접 움직이며 방마다 몬스터를 물리치고, 방을 비울 때마다 레벨업 스킬·능력치·아이템으로 이번 원정의 빌드를 완성해 첫 보스를 쓰러뜨리는 협동 로그라이크입니다. 한 판이 끝나면 성장은 초기화됩니다.',
  ...engine,
};
