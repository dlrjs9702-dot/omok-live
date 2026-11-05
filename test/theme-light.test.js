'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build, mapValue, lightSelector, TEXT, SURFACE, GAME_ART, KEEP_DARK } = require('../tools/theme-light');

// v1.10.63 밝은 테마: theme-light-auto.css is styles.css's dark palette restated for the light theme -- it must be
// regenerated (`node tools/theme-light.js`) whenever styles.css changes, and it maps colours by their role
const root = path.resolve(__dirname, '..');

test('밝은 테마: theme-light-auto.css가 지금의 styles.css에서 다시 만든 것과 같다', () => {
  const fresh = build(fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(root, 'public', 'theme-light-auto.css'), 'utf8').replace(/\r\n/g, '\n'), fresh, 'run: node tools/theme-light.js');
});

test('밝은 테마: 글자색과 바탕·선 색을 따로 바꾸고, 반투명도와 다른 색은 그대로 둔다', () => {
  assert.equal(mapValue('#F8FAFC', TEXT), '#33281d'); // light text on dark -> dark text on light
  assert.equal(mapValue('#f8fafc', SURFACE), '#3d3024'); // a light button on dark -> a dark one on light
  assert.equal(mapValue('1px solid #334155', SURFACE), '1px solid #d6c3a5');
  assert.equal(mapValue('rgba(15, 23, 42, .72)', SURFACE), 'rgba(247,239,225,.72)');
  assert.equal(mapValue('0 0 0 3px rgba(0,0,0,.4)', SURFACE), '0 0 0 3px rgba(0,0,0,.4)');
  assert.equal(mapValue('#fff', TEXT), '#fff'); // white on a coloured button stays
  assert.equal(lightSelector(':root, body .a, .b::backdrop'), ':root[data-theme="light"],:root[data-theme="light"] body .a,:root[data-theme="light"] .b::backdrop');
});

test('밝은 테마: 뒤 규칙의 덮어쓰기 유지, 게임 그림은 그대로, 어두운 바탕을 유지하는 규칙의 글자는 밝게 (Codex 검토)', () => {
  const out = build('.cell{color:#f8fafc}.cell{color:#1f2937}.davinciTile{color:#f8fafc;background:#0f172a}.panel{background:#151a20;color:#f8fafc}');
  const lines = out.split('\n').slice(1).filter(Boolean);
  assert.deepEqual(lines, [
    ':root[data-theme="light"] .cell{color:#33281d}',
    ':root[data-theme="light"] .cell{color:#1f2937}', // the later rule still wins
    ':root[data-theme="light"] .davinciTile{color:#f8fafc;background:#0f172a}', // game art as it is
    ':root[data-theme="light"] .panel{background:#151a20;color:#f8fafc}', // light text on a background that stays dark
  ]);
});

// v1.10.73: a dark background the colour table did not know stayed dark in the light theme under dark text (the notice
// board, the pinned notice, my chat bubble). Any dark background left as it was must be a game's own art or on purpose.
test('밝은 테마: 게임 그림·의도한 곳 밖에 변환 안 된 어두운 바탕이 없다', () => {
  const lum = (h) => { h = h.length === 3 ? h.replace(/./g, '$&$&') : h; const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const mappedTo = new Set(Object.values(SURFACE));
  const left = [];
  for (const line of build(fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8')).split('\n')) {
    const m = line.match(/^(.*?)\{(.*)\}$/); if (!m || GAME_ART.test(m[1]) || KEEP_DARK.test(m[1])) continue;
    for (const decl of m[2].split(';')) if (/^background/.test(decl)) for (const [, h] of decl.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
      if (lum(h.toLowerCase()) < 90 && !mappedTo.has(h.toLowerCase())) left.push(`${m[1].replace(/:root\[data-theme="light"\] ?/g, '')} #${h}`);
    }
  }
  assert.deepEqual(left, []);
  // the notice board reads: its text on the light rows at 4.5:1 or more
  const contrast = (a, b) => { const L = (h) => { const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }; const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const bg of [SURFACE['0e1729'], SURFACE['172033']]) for (const text of ['33281d', TEXT['94a3b8'], TEXT['93c5fd'], TEXT.e2e8f0]) assert.ok(contrast(bg, text) >= 4.5, `#${text} on #${bg}`);
});

// v1.10.243 게임관 UI 통일 U1: the game hall on the 한판마당 tokens -- the light set by the theme (not kept dark), the hall's own
// rules on the tokens only, and its text readable on its light surface
test('밝은 테마: 게임관은 --hp-* 밝은 한 벌을 쓰고 KEEP_DARK가 아니다', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8');
  const set = (sel) => { const line = css.split('\n').find((l) => l.startsWith(`${sel}{`) && l.includes('--hp-bg:')) || ''; return Object.fromEntries([...line.matchAll(/--(hp-[\w-]+):([^;}]+)/g)].map((m) => [m[1], m[2].trim()])); };
  const dark = set(':root'); const light = set(':root[data-theme="light"]');
  for (const k of ['hp-bg', 'hp-bg2', 'hp-t1', 'hp-t2', 'hp-face', 'hp-gold', 'hp-win', 'hp-loss', 'hp-blue']) { assert.ok(dark[k] && light[k], k); assert.notEqual(dark[k], light[k], k); }
  for (const sel of ['.gamehallView', '.gameSheet', '.gamehallChip', '.hpBtn', '.hpPill']) assert.ok(!KEEP_DARK.test(sel) && !GAME_ART.test(sel), sel);
  for (const sel of ['.gamehallView{', '.gameSheet{', '.gamehallSummary div{', '.gamehallChip{']) { const rule = css.slice(css.indexOf(`\n${sel}`)).split('}')[0]; assert.match(rule, /var\(--hp-/, sel); assert.doesNotMatch(rule.replace(/box-shadow:[^;]*/, ''), /#[0-9a-fA-F]{3,6}\b/, sel); }
  const L = (h) => { const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  assert.ok(contrast(light['hp-t1'].slice(1), light['hp-bg2'].slice(1)) >= 7); assert.ok(contrast(dark['hp-t1'].slice(1), dark['hp-bg2'].slice(1)) >= 7);
  for (const set of [light, dark]) for (const k of ['hp-gold', 'hp-blue', 'hp-win', 'hp-loss']) assert.ok(contrast(set[k].slice(1), set['hp-bg2'].slice(1)) >= 4.5, `${k} on the ${set === light ? 'light' : 'dark'} sheet`); // (총괄 #390: 「아직 기록 없음」 gold, 「게임 안내」 blue -- small words)
  assert.match(css, /\.gameSheet \.gameSheetGuide summary\{color:var\(--hp-blue\)\}/);
  // (총괄 #391: the light HUD buttons round on a darker face, the emoji icons darkened -- 3:1 or more)
  assert.match(css, /:root\[data-theme="light"\]\{[^}]*--hp-btn:rgba\(61,47,32,\.14\)/); assert.match(css, /\.roomHudRight>button\{[^}]*background:var\(--hp-btn\)/); // (#396: one token, no override lines)
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', 'public', 'theme-light-auto.css'), 'utf8'), /\[data-theme="light"\]\[data-theme="light"\]/);
  assert.match(css, /:root\[data-theme="light"\] \.roomHudRight>:is\(#chatFloatBtn,#gameInfoFloatBtn\)::before\{font-size:1\.05rem;filter:grayscale\(1\) brightness\(\.35\)\}/);
});
