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

// v1.10.264 주민 반응 (6절) and 말할 때 (5절): every feeling of mine has an answer -- a move with a clip, a mark that exists,
// two lines; the night, rain and 호감도 turns; what an islander says gives its face
test('주민 반응 표: 16 감정 → 동작·기호·말 둘, 밤·비·호감도 갈래 / 말할 때 표정', () => {
  const anims = REGISTRY['character.base'].animations;
  for (const e of E.LIST) {
    const r = E.reactOf(e.id); assert.ok(r, e.id); assert.ok(E.of(r.move) && anims[E.of(r.move).clip], `${e.id} -> ${r.move}`);
    for (const m of [r.mark, E.of(r.move).mark].filter(Boolean)) assert.ok(REGISTRY[`emote.mark_${m}`], `${e.id} mark ${m}`);
    assert.equal(r.lines.length, 2, e.id); assert.ok(r.lines.every((l) => typeof l === 'string' && l.length > 0));
  }
  assert.deepEqual(['wave', 'bow', 'laugh', 'jumpjoy', 'clap', 'thumbsup', 'surprise', 'think', 'shrug', 'facepalm', 'cry', 'angry', 'shy'].map((id) => [id, E.reactOf(id).move, E.reactOf(id).mark]),
    [['wave', 'wave', null], ['bow', 'bow', 'flower'], ['laugh', 'laugh', null], ['jumpjoy', 'laugh', null], ['clap', 'laugh', null], ['thumbsup', 'thumbsup', null], ['surprise', 'surprise', null], ['think', 'shrug', null], ['shrug', 'shrug', null], ['facepalm', 'shrug', 'sweat'], ['cry', 'surprise', 'sweat'], ['angry', 'surprise', 'sweat'], ['shy', 'greet', 'flower']]);
  assert.equal(E.reactOf('cry').then, 'wave');
  assert.deepEqual([E.reactOf('dance').move, E.reactOf('dance').ms, E.reactOf('dance', { night: true }).move, E.reactOf('dance', { rain: true }).move], ['dance', 4000, 'clap', 'clap']);
  assert.deepEqual([E.reactOf('yawn', { night: true }).move, E.reactOf('yawn').move, E.reactOf('yawn').mark], ['yawn', 'laugh', 'note']);
  assert.deepEqual([E.reactOf('heart', { level: 3 }).move, E.reactOf('heart', { level: 2 }).move, E.reactOf('heart', { level: 2 }).mark], ['heart', 'shy', 'heart']);
  assert.equal(E.reactOf('nope'), null);
  assert.deepEqual(E.talkFace({ first: true }), { eyes: 'happy', mouth: 'laugh' });
  assert.deepEqual(E.talkFace({ topic: 'gift' }), { eyes: 'happy', mouth: 'laugh' });
  assert.deepEqual(E.talkFace({ topic: 'rumor' }), { eyes: null, mouth: 'o' }); assert.deepEqual(E.talkFace({ question: true }), { eyes: null, mouth: 'o' });
  assert.deepEqual(E.talkFace({ offer: true, first: true }), { eyes: null, mouth: 'grin' });
  for (const mood of ['rain', 'winter']) assert.deepEqual(E.talkFace({ first: true, mood }), { eyes: 'sad', mouth: 'frown' });
  for (const mood of ['rainbow', 'stars']) assert.deepEqual(E.talkFace({ first: true, mood }), { eyes: 'happy', mouth: 'grin' });
  assert.equal(E.talkFace({ topic: 'how' }), null);
});

// v1.10.287 얼굴이 살아 있게 (notes docs/face-life-20261108.md 2~3절): a line's mouth -- its letters x 0.06 s, 0.6~3 s; the head -- the
// nearest within 4 m, the one I talk with first, at most 45° aside and 15° up or down, + to the left of the body's front
test('얼굴: 말 길이(글자 × 0.06초, 0.6~3초), 바라볼 사람(4 m 안 가장 가까운, 대화 상대 먼저), 각도 제한', () => {
  assert.equal(E.talkMs(''), 600); assert.equal(E.talkMs('안녕'), 600); assert.equal(E.talkMs('가'.repeat(20)), 1200); assert.equal(E.talkMs('가'.repeat(100)), 3000);
  assert.equal(E.talkMs('😊'.repeat(20)), 1200); /* (letters, not UTF-16 halves) */
  const me = { x: 0, y: 1.5, z: 0, yaw: 0 }; const a = { x: 0, y: 1.5, z: 3 }; const b = { x: 1, y: 1.5, z: 1.5 }; const far = { x: 0, y: 1.5, z: 4.5 };
  assert.equal(E.lookPick(me, [a, b, far]).who, b); /* (the nearest) */
  assert.equal(E.lookPick(me, [far]), null); /* (none within 4 m) */
  assert.equal(E.lookPick(me, [a, b], far).who, far); /* (the one I talk with, wherever) */
  const ahead = E.lookPick(me, [a]); assert.ok(Math.abs(ahead.yaw) < 1e-9 && Math.abs(ahead.pitch) < 1e-9);
  const left = E.lookPick(me, [{ x: 2, y: 1.5, z: 2 }]); assert.ok(Math.abs(left.yaw - Math.PI / 4) < 1e-9); /* (atan2(dx, dz): +x is the body's left at yaw 0) */
  const behind = E.lookPick(me, [{ x: -0.5, y: 1.5, z: -2 }]); assert.equal(behind.yaw, -Math.PI / 4); /* (aside 45° at most) */
  const tall = E.lookPick(me, [{ x: 0, y: 4, z: 1 }]); assert.equal(tall.pitch, Math.PI / 12); const small = E.lookPick(me, [{ x: 0, y: 0.5, z: 2 }]); assert.ok(small.pitch < 0 && small.pitch >= -Math.PI / 12);
  const turned = E.lookPick({ ...me, yaw: Math.PI / 2 }, [{ x: 2, y: 1.5, z: 0 }]); assert.ok(Math.abs(turned.yaw) < 1e-9); /* (from the body's own front) */
  assert.equal(E.lookPick(me, [{ ...me }]), null); /* (not myself, at my own spot) */
});
