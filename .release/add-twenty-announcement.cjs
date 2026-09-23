'use strict';
const fs = require('node:fs');
const file = 'lib/release-announcements.js';
const content = fs.readFileSync(file, 'utf8');
if (content.includes("key: 'v1.6.69'")) {
  console.log('Twenty Questions announcement already present');
  process.exit(0);
}
if (!content.includes("key: 'v1.6.68'") || !content.endsWith('];\n')) {
  throw Error('Unexpected release announcement layout; refusing to change other notices');
}
const item = `  {\n    key: 'v1.6.69',\n    title: '[업데이트] v1.6.69 스무고개 신규 게임 추가',\n    body: '스무고개가 새롭게 추가됐습니다. 2~8명이 개인전이나 협동전으로 즐길 수 있으며, 방장이 1~10라운드를 자유롭게 정하거나 참가 인원에 맞춘 출제 횟수 추천값을 고를 수 있습니다. 각 라운드마다 카테고리가 무작위로 제시되고 출제자가 비밀 정답을 정합니다. 도전자들은 차례대로 최대 20개 질문을 하거나 자신의 차례에 정답을 제출할 수 있으며, 출제자는 예·아니오·비슷함·애매함으로 답하고 정답 여부를 직접 판정합니다. 오답 시 다음 도전자 차례로 넘어가며 20개 질문을 모두 쓰면 도전자 전원이 차례로 1회씩 최종 정답 기회를 받습니다. 개인전·협동전 승패 및 점수를 누적하고 최종 최고점자 또는 공동 최고점자를 승리로 기록합니다. 기존 로비·관전·재접속·채팅·재대결·전적 시스템을 활용합니다.',\n    publishedAt: '${new Date().toISOString()}',\n  },\n`;
fs.writeFileSync(file, content.slice(0, -3) + item + '];\n', 'utf8');
console.log('Staged v1.6.69 announcement');
