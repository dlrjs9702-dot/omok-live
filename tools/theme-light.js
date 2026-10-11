'use strict';
// v1.10.63 밝은 테마: public/theme-light-auto.css from public/styles.css. styles.css writes the dark UI's colours out
// in each rule; this re-states, under :root[data-theme="light"], just the declarations that use that dark palette, each
// colour mapped by its role (a text colour or a surface/line colour). Status colours (green, red), white text on
// coloured buttons and black shadows are left alone; public/theme-light.css (loaded after) fixes what this can't know.
// Run `node tools/theme-light.js` after changing styles.css; test/theme-light.test.js fails while the file is stale.
const fs = require('node:fs');
const path = require('node:path');

const TEXT = { // dark-theme colour -> light-theme colour, where it is a text colour
  f8fafc: '33281d', e2e8f0: '3d3024', e5e7eb: '3d3024', cbd5e1: '5e4d3b', '94a3b8': '7a6650', '64748b': '7a6650',
  111827: 'fffaf1', '0f172a': 'fffaf1', // dark text on the dark theme's light buttons
  '60a5fa': '1f6f60', '93c5fd': '1f6f60', '3b82f6': '1f6f60', '38bdf8': '1f6f60', bfdbfe: '2a5f55', dbeafe: '2a5f55',
  fde68a: '8a5a00', fef3c7: '8a5a00', fbbf24: '8a5a00', facc15: '8a5a00', fde047: '8a5a00',
  fecaca: '9b2c2c', fca5a5: '9b2c2c', bbf7d0: '166534', a7f3d0: '166534', '86efac': '166534', '34d399': '15803d',
};
const SURFACE = { // ... where it is a background, line, outline or shadow colour
  '0b1220': 'f4ede0', '050914': 'eadfcb', '020617': '3d2f20',
  111827: 'fffaf1', '0f172a': 'f7efe1', '0b1324': 'f7efe1', '111c30': 'f7efe1', '111c33': 'f7efe1', '101d32': 'f7efe1',
  '1e293b': 'f3e9d8', '1f2937': 'efe4d0', 172554: 'dff1ec', '1e3a8a': 'cfe9e2',
  273449: 'e2d4bd', 263246: 'e2d4bd', 334155: 'd6c3a5', 475569: 'c9b394', '64748b': 'b39c7c', '94a3b8': 'b39c7c',
  f8fafc: '3d3024', e2e8f0: '4a3b2c',
  '60a5fa': '23806f', '3b82f6': '23806f', '2563eb': '23806f', '1d4ed8': '1f6f60', '93c5fd': '7cbfb1', bfdbfe: 'bfe3da', dbeafe: 'e3f2ee',
  '7f1d1d': 'fde4e1', '450a0a': 'fde4e1', 422006: 'fdf0d2',
};
const RGB = { '15,23,42': 'f7efe1', '2,6,23': '3d2f20', '148,163,184': 'b39c7c', '96,165,250': '23806f', '71,85,105': 'c9b394', '30,64,175': '23806f' };
const SURFACE_PROPS = /^(background|background-color|background-image|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|box-shadow|fill|stroke)$/;

const hex = (h) => `#${h}`;
const expand = (h) => (h.length === 3 ? h.split('').map((c) => c + c).join('') : h).toLowerCase();
function mapValue(value, table) {
  let out = value.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m, h) => { const t = table[expand(h)]; return t ? hex(t) : m; });
  if (table === SURFACE) {
    out = out.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)/g, (m, r, g, b, a) => {
      const t = RGB[`${r},${g},${b}`]; if (!t) return m;
      const [R, G, B] = [0, 2, 4].map((i) => parseInt(t.slice(i, i + 2), 16));
      return a ? `rgba(${R},${G},${B}${a.replace(/\s+/g, '')})` : `rgb(${R},${G},${B})`;
    });
  }
  return out;
}

// split on a separator outside parentheses and quotes
function splitTop(text, sep) {
  const parts = []; let depth = 0; let quote = null; let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) { if (c === quote && text[i - 1] !== '\\') quote = null; continue; }
    if (c === '"' || c === "'") quote = c; else if (c === '(') depth += 1; else if (c === ')') depth -= 1;
    else if (c === sep && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
  }
  parts.push(text.slice(start));
  return parts;
}

function lightSelector(sel) {
  return splitTop(sel, ',').map((s) => s.trim()).filter(Boolean).map((s) => {
    if (s.startsWith(':root')) return `:root[data-theme="light"]${s.slice(5)}`;
    if (/^html\b/.test(s)) return `html[data-theme="light"]${s.slice(4)}`;
    return `:root[data-theme="light"] ${s}`;
  }).join(',');
}

// the rules of a block: [{ at, children }] for @media/@supports, [{ selector, body }] otherwise; @keyframes etc. skipped
function parse(css) {
  const out = []; let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i); if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 1; let j = open + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth += 1; else if (css[j] === '}') depth -= 1; j += 1; }
    const body = css.slice(open + 1, j - 1);
    if (/^@(media|supports)/.test(head)) out.push({ at: head, children: parse(body) });
    else if (!head.startsWith('@')) out.push({ selector: head, body });
    i = j;
  }
  return out;
}

function emit(rules) {
  const lines = [];
  for (const rule of rules) {
    if (rule.at) { const inner = emit(rule.children); if (inner.length) lines.push(`${rule.at}{${inner.join('')}}`); continue; }
    const decls = [];
    for (const decl of splitTop(rule.body, ';')) {
      const k = decl.indexOf(':'); if (k < 0) continue;
      const prop = decl.slice(0, k).trim().toLowerCase(); const value = decl.slice(k + 1).trim();
      const table = prop === 'color' || prop === 'caret-color' || prop === '-webkit-text-fill-color' ? TEXT : SURFACE_PROPS.test(prop) ? SURFACE : null;
      if (!table) continue;
      const mapped = mapValue(value, table);
      if (mapped !== value) decls.push(`${prop}:${mapped}`);
    }
    if (decls.length) lines.push(`${lightSelector(rule.selector)}{${decls.join(';')}}\n`);
  }
  return lines;
}

function build(stylesCss) {
  const css = stylesCss.replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, ''); // a Windows checkout may have CRLF
  return `/* generated by tools/theme-light.js from styles.css -- do not edit; see public/theme-light.css for hand fixes */\n${emit(parse(css)).join('')}`;
}

module.exports = { build, mapValue, lightSelector, TEXT, SURFACE };

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const out = build(fs.readFileSync(path.join(root, 'public', 'styles.css'), 'utf8'));
  fs.writeFileSync(path.join(root, 'public', 'theme-light-auto.css'), out);
  console.log(`theme-light-auto.css: ${out.split('\n').length - 1} rules`);
}
