from pathlib import Path

ROOT = Path.cwd()

def read(path):
    return (ROOT / path).read_text(encoding='utf-8')

def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')

def replace_once(content, old, new, label):
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected 1 match, found {count}')
    return content.replace(old, new, 1)

app = read('public/app.js')
old_active = '''    for (const key of activeKeys) {
      const row = document.createElement('div');
      row.className = 'keyRow';
      const text = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = key.label;
      const small = document.createElement('small');
      const used = key.lastUsedAt ? `최근 사용 ${new Date(key.lastUsedAt).toLocaleString('ko-KR')}` : '아직 사용 안 함';
      const online = key.presence?.online ? (key.presence.inRoom ? '🟢 접속 중 · 방 참여 중' : '🟢 접속 중') : '⚫ 오프라인';
      small.textContent = `${online} · ${used} · ${key.useCount || 0}회`;
      text.append(strong, small);
      row.appendChild(text);
      const btn = document.createElement('button');
      btn.className = 'danger tiny';
      btn.textContent = '권한 취소';
      btn.addEventListener('click', () => revokeKey(key.id, key.label));
      row.appendChild(btn);
      guestKeyList.appendChild(row);
    }
'''
new_active = '''    for (const key of activeKeys) {
      const row = document.createElement('div');
      row.className = 'keyRow compactKeyRow';

      const main = document.createElement('div');
      main.className = 'keyMain';
      const identity = document.createElement('div');
      identity.className = 'keyIdentity';
      const strong = document.createElement('strong');
      strong.textContent = key.label;
      const status = document.createElement('span');
      status.className = `keyStatus${key.presence?.online ? ' online' : ''}`;
      status.textContent = key.presence?.online ? '접속 중' : '오프라인';
      identity.append(strong, status);
      main.appendChild(identity);

      const actions = document.createElement('div');
      actions.className = 'keyActions';
      const detailBtn = document.createElement('button');
      detailBtn.className = 'ghost tiny compactAction';
      detailBtn.textContent = '자세히 보기';
      const revokeBtn = document.createElement('button');
      revokeBtn.className = 'danger tiny compactAction';
      revokeBtn.textContent = '권한 취소';
      revokeBtn.addEventListener('click', () => revokeKey(key.id, key.label));
      actions.append(detailBtn, revokeBtn);

      const detail = document.createElement('div');
      detail.className = 'keyDetail hidden';
      const used = key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('ko-KR') : '사용 기록 없음';
      const presence = key.presence?.online ? (key.presence.inRoom ? '접속 중 · 방 참여 중' : '접속 중') : '오프라인';
      detail.textContent = `상태 ${presence} · 최근 사용 ${used} · 총 ${key.useCount || 0}회`;
      detailBtn.addEventListener('click', () => {
        const opening = detail.classList.contains('hidden');
        detail.classList.toggle('hidden', !opening);
        detailBtn.textContent = opening ? '접기' : '자세히 보기';
      });

      row.append(main, actions, detail);
      guestKeyList.appendChild(row);
    }
'''
app = replace_once(app, old_active, new_active, 'active guest rows')

old_revoked = '''    for (const key of revokedKeys) {
      const row = document.createElement('div');
      row.className = 'keyRow revoked';
      const text = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = key.label;
      const small = document.createElement('small');
      small.textContent = `권한 취소됨 · ${new Date(key.revokedAt).toLocaleString('ko-KR')} · ${key.useCount || 0}회`;
      text.append(strong, small);
      const actions = document.createElement('div');
      actions.className = 'keyActions';
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'secondary tiny';
      restoreBtn.textContent = '권한 복구';
      restoreBtn.addEventListener('click', () => restoreKey(key.id, key.label));
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'danger tiny';
      deleteBtn.textContent = '영구 삭제';
      deleteBtn.addEventListener('click', () => deleteKey(key.id, key.label));
      actions.append(restoreBtn, deleteBtn);
      row.append(text, actions);
      revokedGuestKeyList.appendChild(row);
    }
'''
new_revoked = '''    for (const key of revokedKeys) {
      const row = document.createElement('div');
      row.className = 'keyRow compactKeyRow revoked';

      const main = document.createElement('div');
      main.className = 'keyMain';
      const identity = document.createElement('div');
      identity.className = 'keyIdentity';
      const strong = document.createElement('strong');
      strong.textContent = key.label;
      const status = document.createElement('span');
      status.className = 'keyStatus revokedStatus';
      status.textContent = '취소됨';
      identity.append(strong, status);
      main.appendChild(identity);

      const actions = document.createElement('div');
      actions.className = 'keyActions';
      const detailBtn = document.createElement('button');
      detailBtn.className = 'ghost tiny compactAction';
      detailBtn.textContent = '자세히 보기';
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'secondary tiny compactAction';
      restoreBtn.textContent = '권한 복구';
      restoreBtn.addEventListener('click', () => restoreKey(key.id, key.label));
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'danger tiny compactAction';
      deleteBtn.textContent = '영구 삭제';
      deleteBtn.addEventListener('click', () => deleteKey(key.id, key.label));
      actions.append(detailBtn, restoreBtn, deleteBtn);

      const detail = document.createElement('div');
      detail.className = 'keyDetail hidden';
      detail.textContent = `권한 취소 ${new Date(key.revokedAt).toLocaleString('ko-KR')} · 총 ${key.useCount || 0}회 사용`;
      detailBtn.addEventListener('click', () => {
        const opening = detail.classList.contains('hidden');
        detail.classList.toggle('hidden', !opening);
        detailBtn.textContent = opening ? '접기' : '자세히 보기';
      });

      row.append(main, actions, detail);
      revokedGuestKeyList.appendChild(row);
    }
'''
app = replace_once(app, old_revoked, new_revoked, 'revoked guest rows')
write('public/app.js', app)

css = read('public/styles.css')
css += '''\n/* Compact guest access rows */\n.keyList{gap:6px}\n.compactKeyRow{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 8px;padding:7px 9px;min-height:40px;border-radius:10px}\n.keyMain{min-width:0}\n.keyIdentity{display:flex;align-items:center;gap:7px;min-width:0}\n.keyIdentity strong{font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}\n.keyStatus{flex:0 0 auto;font-size:.67rem;font-weight:850;color:#94a3b8;white-space:nowrap}\n.keyStatus.online{color:#86efac}\n.keyStatus.revokedStatus{color:#fca5a5}\n.keyActions{display:flex;align-items:center;gap:5px;flex-wrap:nowrap}\n.compactKeyRow .compactAction{padding:5px 7px;font-size:.67rem;border-radius:8px;white-space:nowrap}\n.keyDetail{grid-column:1/-1;padding:6px 8px;margin-top:1px;border-radius:8px;background:#0b1324;color:#94a3b8;font-size:.69rem;line-height:1.45}\n@media(max-width:520px){.compactKeyRow{padding:6px 7px;gap:5px}.keyIdentity{gap:5px}.keyIdentity strong{font-size:.78rem}.keyStatus{font-size:.63rem}.compactKeyRow .compactAction{padding:5px 6px;font-size:.62rem}}\n'''
write('public/styles.css', css)

security = read('lib/security.js')
security = replace_once(security,
'''function safeFilename(label) {\n  const base = sanitizeLabel(label).replace(/[\\\\/:*?\"<>|]/g, '_').replace(/\\s+/g, '_') || 'guest';\n  return `오목입장_${base}.html`;\n}\n''',
'''function safeFilename(label) {\n  const base = sanitizeLabel(label).replace(/[\\\\/:*?\"<>|]/g, '_') || 'guest';\n  return `게임센터 - ${base}.html`;\n}\n''',
'guest filename')
security = security.replace('<title>오목 입장 - ${esc(label)}</title>', '<title>게임센터 입장 - ${esc(label)}</title>')
security = security.replace('<h1>오목 입장</h1>', '<h1>게임센터 입장</h1>')
security = security.replace('<button type="submit">오목 입장하기</button>', '<button type="submit">게임센터 입장하기</button>')
write('lib/security.js', security)

index = read('public/index.html').replace('v=1.6.0', 'v=1.6.1')
write('public/index.html', index)

package = read('package.json').replace('"version": "1.6.0"', '"version": "1.6.1"')
write('package.json', package)

server = read('server.js')
server = server.replace("version: '1.6.0'", "version: '1.6.1'")
server = server.replace('게임 서버 v1.6.0 실행', '게임 서버 v1.6.1 실행')
write('server.js', server)

print('Applied compact guest UI and Game Center guest filename v1.6.1')
