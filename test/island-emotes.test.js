'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../public/plaza/island-emotes.js');
const { REGISTRY } = require('../public/plaza/island-assets.js');

// v1.10.263 감정 표현 (gamecenter-notes docs/emotes-20261107.md 2절, assets 101's pairing table): the 16 feelings, each its
// move (a clip the common rig has), its face parts and mark (registered), its icon (a file); the wheel's order; the acts.
test('감정 표현 짝 표: 16개, 동작·표정 부품·기호·아이콘이 모두 있고 바퀴 순서·act 이름', () => {
  assert.deepEqual(E.LIST.map((e) => e.id), ['wave', 'laugh', 'clap', 'thumbsup', 'heart', 'surprise', 'think', 'dance', 'jumpjoy', 'shy', 'shrug', 'facepalm', 'yawn', 'cry', 'bow', 'angry']);
  assert.deepEqual(E.ACTS, E.LIST.map((e) => `emote:${e.id}`));
  const anims = REGISTRY['character.base'].animations;
  for (const e of [...E.LIST, ...Object.values(E.EXTRA)]) {
    if (e.id !== 'nod') assert.ok(anims[e.clip], `${e.id}: clip ${e.clip}`); /* (nod: the game's own, played by its clip name as before) */
    if (e.eyes) assert.ok(REGISTRY[`wear.eyes_x_${e.eyes}`], `${e.id} eyes`);
    if (e.mouth) assert.ok(REGISTRY[`wear.mouth_x_${e.mouth}`], `${e.id} mouth`);
    for (const m of [e.mark, e.then?.mark].filter(Boolean)) assert.ok(REGISTRY[`emote.mark_${m}`], `${e.id} mark ${m}`);
    assert.ok(e.at <= (e.back ?? e.dur) && (e.back ?? 0) <= e.dur && e.markAt + e.markFor <= e.dur + 0.01, `${e.id}: times inside its move`);
  }
  for (const e of E.LIST) assert.ok(fs.existsSync(path.join(__dirname, '..', 'public', 'assets', 'emotes', `emote-${e.icon || e.id}.svg`)), `${e.id} icon`);
  assert.equal(E.LIST.filter((e) => e.loop).map((e) => e.id).join(), 'dance');
  assert.equal(E.of('cheer').mark, 'sparkle'); assert.equal(E.of('nod').eyes, null); assert.equal(E.of('nope'), null);
});
