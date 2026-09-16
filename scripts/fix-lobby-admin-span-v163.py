from pathlib import Path

p = Path('public/styles.css')
css = p.read_text(encoding='utf-8')
old = '.lobbyAdminCard{margin-top:18px;padding:24px 28px}'
new = '.lobbyAdminCard{grid-column:1/-1;margin-top:0;padding:24px 28px}'
if old not in css:
    raise RuntimeError('desktop admin layout marker not found')
css = css.replace(old, new, 1)
old_mobile = '.lobbyAdminCard{margin-top:18px;padding:14px}'
new_mobile = '.lobbyAdminCard{margin-top:0;padding:14px}'
if old_mobile not in css:
    raise RuntimeError('mobile admin layout marker not found')
css = css.replace(old_mobile, new_mobile, 1)
p.write_text(css, encoding='utf-8')
print('Fixed admin panel to span full lobby width')
