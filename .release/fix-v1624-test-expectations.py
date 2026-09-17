from pathlib import Path

for path in Path('test').glob('*.js'):
    text = path.read_text(encoding='utf-8')
    text = text.replace(r'1\.6\.23', r'1\.6\.24')
    text = text.replace('1.6.23', '1.6.24')
    path.write_text(text, encoding='utf-8')
