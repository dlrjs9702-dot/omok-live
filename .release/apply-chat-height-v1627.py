from pathlib import Path


def replace_one(filename, old, new):
    path = Path(filename)
    text = path.read_text(encoding='utf-8')
    if text.count(old) != 1:
        raise RuntimeError(f'{filename}: expected one edit anchor, found {text.count(old)}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')


css = Path('public/styles.css')
text = css.read_text(encoding='utf-8')
assert '.side .chatMessages{height:auto;min-height:380px;flex:1 1 auto}' in text
assert '/* v1.6.27: keep room chat within the actual board height */' not in text
text += '''\n\n/* v1.6.27: keep room chat within the actual board height */
#roomView .gameLayout > .side {
  height: var(--room-board-height, 650px);
  max-height: var(--room-board-height, 650px);
  min-height: 0;
  overflow: hidden;
}
#roomView .side .roomPeople {
  flex: 0 1 auto;
  min-height: 0;
  max-height: 30%;
  overflow-y: auto;
}
#roomView .side .chatPanel {
  flex: 1 1 0;
  min-height: 0;
}
#roomView .side .chatMessages {
  height: auto;
  min-height: 0;
  flex: 1 1 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
#roomView .side .chatForm { flex: 0 0 auto; }
#roomView .side .sideActions,
#roomView .side .roomRuleDetails { flex-shrink: 0; }
'''
css.write_text(text, encoding='utf-8')

replace_one('public/index.html', '  <script src="/app.js?v=1.6.26"></script>',
            '  <script src="/room-chat-height.js?v=1.6.27"></script>\n  <script src="/app.js?v=1.6.27"></script>')
for filename in ('package.json', 'package-lock.json', 'server.js', 'public/index.html'):
    path = Path(filename)
    text = path.read_text(encoding='utf-8')
    if '1.6.26' not in text:
        if filename == 'public/index.html' and '1.6.27' in text:
            continue
        raise RuntimeError(f'{filename}: expected prior version')
    path.write_text(text.replace('1.6.26', '1.6.27'), encoding='utf-8')

notices = Path('lib/release-announcements.js')
text = notices.read_text(encoding='utf-8')
assert "key: 'v1.6.26'" in text and "key: 'v1.6.27'" not in text
assert text.endswith('];\n')
text = text[:-3] + '''  {
    key: 'v1.6.27',
    title: '[업데이트] v1.6.27 게임방 채팅 높이 및 스크롤 개선',
    body: '모든 게임방에서 채팅 영역이 메시지 수에 따라 게임 보드보다 길어지지 않도록 높이를 제한했습니다. 게임 보드 높이와 화면 크기 변화에 맞춰 채팅창 높이를 조정하고, 초과 메시지는 채팅창 안에서 스크롤해 볼 수 있습니다.',
    publishedAt: '2026-09-18T09:45:00+09:00',
  },
];
'''
notices.write_text(text, encoding='utf-8')

# Update only release-version assertions in existing tests; preserve test behavior.
for path in Path('test').glob('*.js'):
    text = path.read_text(encoding='utf-8')
    newer = text.replace(r'1\.6\.26', r'1\.6\.27').replace('1.6.26', '1.6.27')
    if newer != text:
        path.write_text(newer, encoding='utf-8')

Path('test/chat-height.test.js').write_text('''\
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
  assert.match(override, /#roomView \\.gameLayout > \\.side \\{[^}]*height: var\\(--room-board-height/);
  assert.match(override, /#roomView \\.side \\.chatPanel \\{[^}]*min-height: 0/);
  assert.match(override, /#roomView \\.side \\.chatMessages \\{[^}]*min-height: 0;[^}]*overflow-y: auto/);
  assert.match(html, /room-chat-height\\.js\\?v=1\\.6\\.27/);
});
''', encoding='utf-8')
print('v1.6.27 chat height patch prepared')
