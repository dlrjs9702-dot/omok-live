'use strict';
// 1.10.417 U3 토큰화 (notes docs/ui-review-20261121.md §3-3, 결정 43 A): the island's colours by name, the shared parts reading them, and no dark
// palette colour coming back into an island rule
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../public/styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''); /* (comments out: a rule's selector its own) */
const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));

test('U3 토큰: 섬 색은 이름(:root), 종이 값은 그 정의에만 — 규칙 안에서는 var(--isle-…)', () => {
  for (const [name, hex] of [['--isle-paper', '#fff6e3'], ['--isle-card', '#fffaf0'], ['--isle-field', '#fffdf6'], ['--isle-ink', '#5a4632'], ['--isle-line', '#d9c3a0'], ['--isle-soft', '#7d6852'], ['--isle-select', '#f0dcb6'], ['--isle-btn', '#9c5f14'], ['--isle-value', '#8a4b00'], ['--isle-danger', '#9b2c1f']]) assert.match(css, new RegExp(`${name}:${hex}`, 'i'), name);
  const literal = rules.filter((r) => /plazaMode|isle-|island/i.test(r.sel) /* (island rules: a game's own card keeps its colour) */ && /#(fff6e3|fffaf0|fffdf6|f0dcb6|d9c3a0)\b/i.test(r.body.replace(/--[\w-]+\s*:\s*#[0-9a-f]+/gi, ''))).map((r) => r.sel.slice(0, 80));
  assert.deepEqual(literal, [], 'a paper value written where its token goes');
});

test('U3 부품: .ghost · .secondary · .primary가 변수로 색을 받고, 섬 종이 창(관리자 빼고)에서 한 번에 종이 값', () => {
  const base = (s) => rules.find((r) => r.sel === s)?.body || '';
  assert.match(base('.ghost'), /background:var\(--btn-ghost-bg,#1e293b\)/); assert.match(base('.ghost'), /color:var\(--btn-ghost-ink,/); assert.match(base('.ghost'), /border:1px solid var\(--btn-ghost-line,/);
  assert.match(base('.secondary'), /background:var\(--btn-secondary-bg,#2563eb\)/); assert.match(base('.primary'), /background:var\(--btn-primary-bg,#f8fafc\)/);
  const island = rules.find((r) => r.sel === 'body.plazaMode .isle-sheet:not(.adminMode)'); assert.ok(island, 'the island sheets set them');
  for (const v of ['--btn-ghost-bg:var(--isle-card)', '--btn-ghost-ink:var(--isle-ink)', '--btn-secondary-bg:var(--isle-card)', '--btn-primary-bg:var(--isle-btn)', '--btn-primary-ink:#fff']) assert.ok(island.body.includes(v), v);
});

test('U3 지킴: 섬 규칙(plazaMode · isle- 선택자)에 어두운 팔레트 색이 새로 들어오지 않음(관리자 창은 U6까지 빼고)', () => {
  const DARK = /#(0f172a|111827|1e293b|334155|94a3b8|64748b)\b/i;
  const bad = rules.filter((r) => /plazaMode|isle-/.test(r.sel) && !/adminMode/.test(r.sel) && DARK.test(r.body)).map((r) => `${r.sel.slice(0, 90)} => ${r.body.match(DARK)[0]}`);
  assert.deepEqual(bad, []);
});
