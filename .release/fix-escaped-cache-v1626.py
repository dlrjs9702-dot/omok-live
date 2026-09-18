from pathlib import Path

for path in Path('test').glob('*.js'):
    content = path.read_text(encoding='utf-8')
    fixed = content.replace(r'1\.6\.25', r'1\.6\.26')
    if fixed != content:
        path.write_text(fixed, encoding='utf-8')
print('Updated escaped cache version expectations')
