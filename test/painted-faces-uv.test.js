'use strict';
// 1.10.345 (문제 1117 「주식판도 안보이고 대회 순위판도 안보여」): the faces the game paints a canvas on keep their UVs -- 340's asset 150
// repack dropped TEXCOORD_0 from 36 files and the boards showed only the canvas's corner (navy). Every island GLB: a primitive wearing
// one of these materials has TEXCOORD_0.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAINTED = new Set(['board_face', 'board_honor', 'board_ticker', 'board_screen', 'sign_plate', 'trophy_plate', 'record_face']);
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.glb') ? [path.join(dir, e.name)] : []));

test('그림 끼우는 면(시세판·기록의 탑·대회 간판·트로피 명판)은 UV가 있음', () => {
  const root = path.join(__dirname, '..', 'public', 'assets', 'island'); const missing = []; let seen = 0;
  for (const file of walk(root)) {
    const b = fs.readFileSync(file); const j = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString()); const mats = (j.materials || []).map((m) => m.name);
    for (const m of j.meshes || []) for (const p of m.primitives) if (PAINTED.has(mats[p.material])) { seen += 1; if (p.attributes.TEXCOORD_0 === undefined) missing.push(`${path.relative(root, file)}: ${mats[p.material]}`); }
  }
  assert.ok(seen >= 40, `그림 면 ${seen}개`); assert.deepEqual(missing, []);
});
