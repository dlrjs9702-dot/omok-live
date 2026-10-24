'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

// (Codex 검토 묶음, 2026-10-25) every script parses: server.js, lib/*.js and public/**/*.js -- a `//` put in the middle of a
// packed line once swallowed the rest of it and a broken plaza-scene.js was committed. A plain script is compiled here
// (vm.Script, not run); an ES module (import/export) is checked by `node --check` as a .mjs copy.
const ROOT = path.resolve(__dirname, '..');
const listed = execFileSync('git', ['ls-files', 'server.js', 'lib/*.js', 'public/*.js'], { cwd: ROOT }).toString().split('\n').filter(Boolean);
const MODULE = /^\s*(import\s|export\s)|\bimport\s*\(/m;

test('문법: server.js·lib·public의 모든 .js가 읽힌다', () => {
  assert.ok(listed.length > 100, `files ${listed.length}`);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'syntax-'));
  const bad = [];
  try {
    for (const file of listed) {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^#!.*/, '');
      try { new vm.Script(src, { filename: file }); continue; } catch (error) { if (!(error instanceof SyntaxError) || !MODULE.test(src)) { bad.push(`${file}: ${error.message}`); continue; } }
      const copy = path.join(dir, `${file.replace(/[\\/]/g, '__')}.mjs`); fs.writeFileSync(copy, src);
      try { execFileSync(process.execPath, ['--check', copy], { stdio: 'pipe' }); } catch (error) { bad.push(`${file}: ${String(error.stderr).split('\n').find((l) => /Error/.test(l)) || 'syntax'}`); }
    }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  assert.deepEqual(bad, []);
});
