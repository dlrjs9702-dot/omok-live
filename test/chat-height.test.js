'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

test('room sidebar tracks the visible board height and its subsequent changes', () => {
  const script = fs.readFileSync(path.join(root, 'public/room-chat-height.js'), 'utf8');
  let height = 315;
  let resizeObserver;
  let onWindowResize;
  let observed;
  const styles = {};
  const board = { getBoundingClientRect: () => ({ height }) };
  const sidebar = { style: { setProperty: (key, value) => { styles[key] = value; } } };
  const context = {
    document: { querySelector: selector => selector === '#roomView .boardCard' ? board
      : selector === '#roomView .gameLayout > .side' ? sidebar : null },
    ResizeObserver: class { constructor(callback) { resizeObserver = callback; }
      observe(target) { observed = target; } },
    window: { addEventListener(name, callback) { if (name === 'resize') onWindowResize = callback; } },
  };
  vm.runInNewContext(script, context);
  assert.equal(observed, board);
  assert.equal(styles['--room-board-height'], '315px');
  height = 505;
  resizeObserver();
  assert.equal(styles['--room-board-height'], '505px');
  height = 0;
  resizeObserver();
  assert.equal(styles['--room-board-height'], '505px');
  height = 280;
  onWindowResize();
  assert.equal(styles['--room-board-height'], '280px');
});

test('shared room CSS bounds sidebar and makes excess chat scroll internally', () => {
  const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const override = css.slice(css.indexOf('/* v1.6.27: keep room chat'));
  assert.match(override, /#roomView \.gameLayout > \.side \{[^}]*height: var\(--room-board-height/);
  assert.match(override, /#roomView \.side \.chatPanel \{[^}]*min-height: 0/);
  assert.match(override, /#roomView \.side \.chatMessages \{[^}]*min-height: 0;[^}]*overflow-y: auto/);
  assert.match(html, /room-chat-height\.js\?v=1\.6\.29/);
});
