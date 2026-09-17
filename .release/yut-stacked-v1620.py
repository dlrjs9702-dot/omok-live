from pathlib import Path
import json

ROOT = Path('.')

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')
    print('Updated', path)

def once(text, old, new, label):
    if text.count(old) != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {text.count(old)}')
    return text.replace(old, new, 1)

# --- public/app.js: draw every carried Yut piece separately, horizontally overlapped but numbered ---
app = read('public/app.js')
old_render = """    for (const [key, pieces] of grouped) {\n      const [position, color] = key.split(':');\n      const [x,y] = yutNodePosition(Number(position));\n      const fill = color === 'black' ? '#2563eb' : '#ef4444';\n      ctx.fillStyle = fill;\n      ctx.strokeStyle = '#fff';\n      ctx.lineWidth = 4;\n      ctx.beginPath(); ctx.arc(x,y,24,0,Math.PI*2); ctx.fill(); ctx.stroke();\n      ctx.fillStyle = '#fff';\n      ctx.font = '950 16px system-ui, sans-serif';\n      ctx.fillText(pieces.length > 1 ? String(pieces.length) : pieces[0].id.split('-').at(-1), x, y + 6);\n    }\n"""
new_render = """    for (const [key, pieces] of grouped) {\n      const [position, color] = key.split(':');\n      const [x,y] = yutNodePosition(Number(position));\n      const fill = color === 'black' ? '#2563eb' : '#ef4444';\n      const ordered = [...pieces].sort((a, b) => Number(a.id.split('-').at(-1)) - Number(b.id.split('-').at(-1)));\n      const offsets = yutStackOffsets(ordered.length);\n      for (const [index, piece] of ordered.entries()) {\n        const px = x + offsets[index];\n        ctx.save();\n        ctx.shadowColor = 'rgba(36,20,8,.32)';\n        ctx.shadowBlur = 5;\n        ctx.shadowOffsetY = 2;\n        ctx.fillStyle = fill;\n        ctx.strokeStyle = '#fff';\n        ctx.lineWidth = 3;\n        ctx.beginPath(); ctx.arc(px,y,18,0,Math.PI*2); ctx.fill(); ctx.stroke();\n        ctx.shadowBlur = 0;\n        ctx.fillStyle = '#fff';\n        ctx.font = '950 15px system-ui, sans-serif';\n        ctx.textAlign = 'center';\n        ctx.fillText(piece.id.split('-').at(-1), px, y + 5);\n        ctx.restore();\n      }\n    }\n"""
app = once(app, old_render, new_render, 'Yut grouped renderer')
insert_anchor = """  function drawYutBoard() {\n"""
stack_helper = """  function yutStackOffsets(count) {\n    const total = Math.max(1, Math.min(4, Number(count) || 1));\n    const spacing = 26;\n    const start = -((total - 1) * spacing) / 2;\n    return Array.from({ length: total }, (_, index) => start + index * spacing);\n  }\n\n"""
app = once(app, insert_anchor, stack_helper + insert_anchor, 'Yut stack helper insertion')
old_move = """      const number = Number(String(move.pieceId).split('-').at(-1));\n      const carried = move.carried?.length > 1 ? ` · ${move.carried.length}개 업기` : '';\n      const target = move.destination?.status === 'finished' ? '완주' : `${move.destination?.position}번 칸`;\n      button.textContent = `${number}번 말${carried} → ${target}`;\n"""
new_move = """      const number = Number(String(move.pieceId).split('-').at(-1));\n      const carriedNumbers = (move.carried || [move.pieceId]).map(id => Number(String(id).split('-').at(-1))).sort((a, b) => a - b);\n      const pieceLabel = carriedNumbers.length > 1 ? `${carriedNumbers.map(value => `${value}번`).join(' + ')} 말 · ${carriedNumbers.length}개 업기` : `${number}번 말`;\n      const target = move.destination?.status === 'finished' ? '완주' : `${move.destination?.position}번 칸`;\n      button.textContent = `${pieceLabel} → ${target}`;\n"""
app = once(app, old_move, new_move, 'Yut move choice labels')
write('public/app.js', app)

# --- version/cache bump ---
html = read('public/index.html')
if '?v=1.6.19' not in html:
    raise SystemExit('index cache version 1.6.19 not found')
html = html.replace('?v=1.6.19', '?v=1.6.20')
write('public/index.html', html)

pkg = json.loads(read('package.json'))
if pkg.get('version') != '1.6.19':
    raise SystemExit(f"unexpected package version {pkg.get('version')}")
pkg['version'] = '1.6.20'
write('package.json', json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')

lock = json.loads(read('package-lock.json'))
if lock.get('version') != '1.6.19' or lock.get('packages', {}).get('', {}).get('version') != '1.6.19':
    raise SystemExit('unexpected package-lock root version')
lock['version'] = '1.6.20'
lock['packages']['']['version'] = '1.6.20'
write('package-lock.json', json.dumps(lock, ensure_ascii=False, indent=2) + '\n')

# Update tests that deliberately assert the current asset cache version.
for path in (ROOT / 'test').glob('*.test.js'):
    source = path.read_text(encoding='utf-8')
    changed = source.replace(r'1\.6\.19', r'1\.6\.20')
    if changed != source:
        path.write_text(changed, encoding='utf-8')
        print('Updated cache expectation', path)

# Add focused tests for visual stack geometry and labels.
yut_test = read('test/yut.test.js')
marker = """test('the first player to finish all four pieces wins and reset opens a clean round', () => {\n"""
visual_test = r'''test('stacked Yut pieces are spread sideways so every piece number remains visible', async () => {
  const root = path.join(__dirname, '..');
  const js = await fs.readFile(path.join(root, 'public/app.js'), 'utf8');
  assert.match(js, /function yutStackOffsets\(count\)/);
  assert.match(js, /const offsets = yutStackOffsets\(ordered\.length\)/);
  assert.match(js, /ctx\.arc\(px,y,18,0,Math\.PI\*2\)/);
  assert.match(js, /ctx\.fillText\(piece\.id\.split\('-'\)\.at\(-1\), px, y \+ 5\)/);
  assert.match(js, /carriedNumbers\.map\(value => `\$\{value\}번`\)\.join\(' \+ '\)/);
  const match = js.match(/  function yutStackOffsets\(count\) \{[\s\S]*?\n  \}/);
  assert.ok(match, 'yutStackOffsets helper missing');
  const vm = require('node:vm');
  const offsets = vm.runInNewContext(match[0] + '\nyutStackOffsets');
  assert.deepEqual(Array.from(offsets(1)), [0]);
  assert.deepEqual(Array.from(offsets(2)), [-13, 13]);
  assert.deepEqual(Array.from(offsets(3)), [-26, 0, 26]);
  assert.deepEqual(Array.from(offsets(4)), [-39, -13, 13, 39]);
});

'''
yut_test = once(yut_test, marker, visual_test + marker, 'Yut visual test insertion')
write('test/yut.test.js', yut_test)

# Release announcement: no gameplay-rule change, only stacked-piece legibility.
releases = read('lib/release-announcements.js')
entry = """  {\n    key: 'v1.6.20',\n    title: '[업데이트] v1.6.20 윷놀이 업힌 말 표시 개선',\n    body: '윷놀이에서 같은 편 말이 업혔을 때 하나의 말처럼 보이던 표시를 개선했습니다. 업힌 말을 옆으로 겹쳐 펼쳐 각 말 번호가 게임판에서 바로 식별되며, 말 선택 버튼에도 함께 이동하는 말 번호와 개수가 표시됩니다. 상대방과 관전자 화면에도 동일하게 적용됩니다.',\n    publishedAt: '2026-09-17T00:45:00Z',\n  },\n"""
if "key: 'v1.6.20'" in releases:
    raise SystemExit('v1.6.20 release announcement already exists')
releases = once(releases, '\n];', '\n' + entry + '];', 'release announcement append')
write('lib/release-announcements.js', releases)

print('Yut stacked-piece visibility v1.6.20 patch applied')
