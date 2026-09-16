from pathlib import Path


def replace_one(filename, before, after):
    path = Path(filename)
    text = path.read_text(encoding='utf-8')
    count = text.count(before)
    if count != 1:
        raise AssertionError(f'{filename}: expected one exact anchor; found {count}: {before[:110]!r}')
    path.write_text(text.replace(before, after, 1), encoding='utf-8')


store = 'lib/access-store.js'
json_anchor = '''  async setNote(id, note) {
    const row = this.data.keys.find((k) => k.id === id);'''
json_insert = '''  // Change the display name and access credential as one persisted operation.
  async renameAndRotateToken(id, label, token) {
    const row = this.data.keys.find((key) => key.id === id && !key.revokedAt);
    if (!row) return null;
    const previousLabel = row.label;
    const previousHash = row.tokenHash;
    row.label = label;
    row.tokenHash = hashToken(token);
    try {
      await this.#save();
    } catch (err) {
      row.label = previousLabel;
      row.tokenHash = previousHash;
      throw err;
    }
    const { tokenHash, ...publicRow } = row;
    return { ...publicRow, adminNote: publicRow.adminNote || '' };
  }

'''
replace_one(store, json_anchor, json_insert + json_anchor)
pg_anchor = '''  async setNote(id, note) {
    const result = await this.pool.query('''
pg_insert = '''  // One SQL UPDATE prevents a changed nickname from being persisted with the old entry secret.
  async renameAndRotateToken(id, label, token) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys SET label = $2, token_hash = $3
       WHERE id = $1 AND revoked_at IS NULL
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note`,
      [id, label, hashToken(token)]
    );
    return this.#map(result.rows[0]);
  }

'''
replace_one(store, pg_anchor, pg_insert + pg_anchor)

server = 'server.js'
server_anchor = "  // Reissue rotates the credential on its existing row. The old HTML file and\n"
server_insert = '''  // Rename and reissue must be atomic: the old file must not authenticate with an outdated name.
  const renameMatch = pathname.match(/^\\/api\\/admin\\/keys\\/([0-9a-f-]{36})\\/rename$/i);
  if (renameMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    if (!checkRateLimit('rename:' + renameMatch[1], 5, 60 * 1000)) {
      return sendError(res, 429, 'RENAME_RATE_LIMIT', '닉네임 변경이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
    }
    const body = await parseJson(req);
    if (typeof body.label !== 'string' || body.label.trim().length > 40) {
      return sendError(res, 400, 'BAD_LABEL', '새 닉네임은 1~40자 이내로 입력해 주세요.');
    }
    const label = sanitizeLabel(body.label);
    if (!label) return sendError(res, 400, 'BAD_LABEL', '새 닉네임은 1~40자 이내로 입력해 주세요.');
    const token = newSecret(32);
    const row = await accessStore.renameAndRotateToken(renameMatch[1], label, token);
    if (!row) return sendError(res, 404, 'ACTIVE_KEY_NOT_FOUND', '사용 가능한 입장파일을 찾을 수 없습니다. 취소된 파일은 먼저 권한을 복구해 주세요.');
    invalidateGuestSessions(row.id, '닉네임 변경으로 기존 접속이 종료됐습니다. 새 입장파일로 접속해 주세요.');
    const fileName = safeFilename(row.label);
    const html = makeGuestFile({ baseUrl: publicBaseUrl(req), token, label: row.label });
    return sendJson(res, 200, { ok: true, key: row, fileName, html });
  }

'''
replace_one(server, server_anchor, server_insert + server_anchor)
replace_one(server, "version: '1.6.10'", "version: '1.6.11'")

app = 'public/app.js'
app_anchor = '''      detail.textContent = `상태 ${presence} · 최근 사용 ${used} · 총 ${key.useCount || 0}회`;
      const memoEditor = document.createElement('form');'''
app_insert = '''      detail.textContent = `상태 ${presence} · 최근 사용 ${used} · 총 ${key.useCount || 0}회`;
      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'ghost tiny compactAction renameAction';
      renameBtn.textContent = '닉네임 변경';
      renameBtn.title = '닉네임 변경 후 새 입장파일 자동 발급 · 기존 파일 무효화';
      renameBtn.addEventListener('click', async () => {
        renameBtn.disabled = true;
        try { await renameKey(key.id, key.label); }
        finally { renameBtn.disabled = false; }
      });
      detail.appendChild(renameBtn);
      const memoEditor = document.createElement('form');'''
replace_one(app, app_anchor, app_insert)
app_anchor2 = '''  async function issueFile(event) {
    event.preventDefault();'''
app_insert2 = '''  async function renameKey(id, oldLabel) {
    const input = prompt(`${oldLabel}님의 새 닉네임을 입력해 주세요.\\n변경 시 새 입장파일이 발급됩니다.`, oldLabel);
    if (input === null) return;
    const label = input.trim().replace(/\\s+/g, ' ');
    if (!label || label.length > 40 || /[<>\\r\\n\\t]/.test(label)) {
      return showToast('닉네임은 특수 기호 <, > 및 줄바꿈을 제외하고 1~40자로 입력해 주세요.', 4500);
    }
    if (label === oldLabel) return showToast('기존 닉네임과 같습니다. 파일만 바꾸려면 재발급을 이용해 주세요.');
    if (!confirm(`${oldLabel} → ${label}\\n닉네임을 변경하고 새 입장파일을 발급할까요?\\n기존 파일과 접속은 즉시 무효화됩니다. 새 파일을 반드시 저장해 전달해 주세요.`)) return;
    try {
      const data = await api(`/api/admin/keys/${id}/rename`, {
        method: 'POST',
        body: JSON.stringify({ label }),
      });
      downloadEntryFile(data);
      showToast(`${data.key.label} 닉네임 변경 완료 · 새 입장파일을 전달해 주세요.`, 5000);
      await loadGuestKeys();
      loadPresence().catch(() => {});
    } catch (err) { showToast(err.message, 4500); }
  }

'''
replace_one(app, app_anchor2, app_insert2 + app_anchor2)

html = 'public/index.html'
text = Path(html).read_text(encoding='utf-8')
assert text.count('v=1.6.10') >= 2
Path(html).write_text(text.replace('v=1.6.10', 'v=1.6.11'), encoding='utf-8')
for path in ('package.json', 'package-lock.json'):
    text = Path(path).read_text(encoding='utf-8')
    assert '"version": "1.6.10"' in text
    Path(path).write_text(text.replace('"version": "1.6.10"', '"version": "1.6.11"'), encoding='utf-8')

# Keep previous integration assertions aligned with the new cache-bust revision.
replace_one('test/reissue-guest-file.test.js', "assert.match(html, /app\\.js\\?v=1\\.6\\.10/);", "assert.match(html, /app\\.js\\?v=1\\.6\\.11/);")

Path('public/styles.css').write_text(Path('public/styles.css').read_text(encoding='utf-8') + '\n/* Compact nickname change control remains inside expandable key details. */\n.keyDetail .renameAction{display:inline-flex;margin:5px 0 0 8px;vertical-align:middle}\n', encoding='utf-8')
print('Administrator nickname edit, atomic key rotation, compact UI and version 1.6.11 applied.')
