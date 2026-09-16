from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    data = file.read_text(encoding='utf-8')
    assert data.count(old) == 1, f'{path}: expected one match; found {data.count(old)} for {old[:75]!r}'
    file.write_text(data.replace(old, new, 1), encoding='utf-8')

# The only copy of an entry secret is in the issued file. Reissue rotates its hash
# on the same key row; nickname, private administrator note and usage data survive.
store = 'lib/access-store.js'
replace_once(store, "  async setNote(id, note) {\n    const row = this.data.keys.find((k) => k.id === id);", """  async rotateToken(id, token) {
    const row = this.data.keys.find((key) => key.id === id && !key.revokedAt);
    if (!row) return null;
    const previousHash = row.tokenHash;
    row.tokenHash = hashToken(token);
    try {
      await this.#save();
    } catch (err) {
      row.tokenHash = previousHash;
      throw err;
    }
    const { tokenHash, ...publicRow } = row;
    return { ...publicRow, adminNote: publicRow.adminNote || '' };
  }

  async setNote(id, note) {
    const row = this.data.keys.find((k) => k.id === id);""")
replace_once(store, "  async setNote(id, note) {\n    const result = await this.pool.query(", """  async rotateToken(id, token) {
    const result = await this.pool.query(
      `UPDATE guest_access_keys SET token_hash = $2
       WHERE id = $1 AND revoked_at IS NULL
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note`,
      [id, hashToken(token)]
    );
    return this.#map(result.rows[0]);
  }

  async setNote(id, note) {
    const result = await this.pool.query(""")

server = 'server.js'
replace_once(server,
"function invalidateGuestSessions(guestKeyId) {\n  for (const [token, session] of [...sessions]) {\n    if (session.guestKeyId !== guestKeyId) continue;\n    releaseSessionToken(token, { message: '이 입장 파일의 권한이 취소되었습니다.' });",
"function invalidateGuestSessions(guestKeyId, message = '이 입장 파일의 권한이 취소되었습니다.') {\n  for (const [token, session] of [...sessions]) {\n    if (session.guestKeyId !== guestKeyId) continue;\n    releaseSessionToken(token, { message });")
replace_once(server,
"  let match = pathname.match(/^\\/api\\/admin\\/keys\\/([0-9a-f-]{36})\\/revoke$/i);",
"""  // Reissue rotates the credential on its existing row. The old HTML file and
  // any session authenticated by it cease working immediately after persistence.
  const reissueMatch = pathname.match(/^\\/api\\/admin\\/keys\\/([0-9a-f-]{36})\\/reissue$/i);
  if (reissueMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    if (!checkRateLimit('reissue:' + reissueMatch[1], 5, 60 * 1000)) {
      return sendError(res, 429, 'REISSUE_RATE_LIMIT', '재발급이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
    }
    const token = newSecret(32);
    const row = await accessStore.rotateToken(reissueMatch[1], token);
    if (!row) return sendError(res, 404, 'ACTIVE_KEY_NOT_FOUND', '사용 가능한 입장파일을 찾을 수 없습니다. 취소된 파일은 먼저 권한을 복구해 주세요.');
    invalidateGuestSessions(row.id, '입장파일이 재발급되어 기존 접속이 종료됐습니다. 새 입장파일로 접속해 주세요.');
    const fileName = safeFilename(row.label);
    const html = makeGuestFile({ baseUrl: publicBaseUrl(req), token, label: row.label });
    return sendJson(res, 200, { ok: true, key: row, fileName, html });
  }

  let match = pathname.match(/^\\/api\\/admin\\/keys\\/([0-9a-f-]{36})\\/revoke$/i);""")
replace_once(server, "version: '1.6.9'", "version: '1.6.10'")
replace_once(server, '게임 서버 v1.6.9 실행:', '게임 서버 v1.6.10 실행:')

app = 'public/app.js'
replace_once(app, "      const revokeBtn = document.createElement('button');\n      revokeBtn.className = 'danger tiny compactAction';",
"""      const reissueBtn = document.createElement('button');
      reissueBtn.className = 'secondary tiny compactAction';
      reissueBtn.type = 'button';
      reissueBtn.textContent = '재발급';
      reissueBtn.title = '새 파일 발급 · 이전 파일 즉시 무효화';
      reissueBtn.addEventListener('click', async () => {
        reissueBtn.disabled = true;
        try { await reissueKey(key.id, key.label); }
        finally { reissueBtn.disabled = false; }
      });
      const revokeBtn = document.createElement('button');
      revokeBtn.className = 'danger tiny compactAction';""")
replace_once(app, '      actions.append(detailBtn, memoBtn, revokeBtn);', '      actions.append(detailBtn, memoBtn, reissueBtn, revokeBtn);')
replace_once(app,
"  async function issueFile(event) {\n    event.preventDefault();",
"""  function downloadEntryFile(data) {
    const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = data.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function reissueKey(id, label) {
    if (!confirm(`${label} 입장파일을 재발급할까요?\\n기존 HTML 파일은 즉시 무효화되고, 현재 접속 중이라면 로그아웃됩니다.\\n새 파일을 저장하고 사용자에게 전달해 주세요.`)) return;
    try {
      const data = await api(`/api/admin/keys/${id}/reissue`, { method: 'POST' });
      downloadEntryFile(data);
      showToast(`${data.fileName} 재발급 완료 · 기존 파일은 사용할 수 없습니다.`, 5000);
      await loadGuestKeys();
      loadPresence().catch(() => {});
    } catch (err) { showToast(err.message, 4500); }
  }

  async function issueFile(event) {
    event.preventDefault();""")
replace_once(app,
"""      const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      guestLabelInput.value = '';""",
"""      downloadEntryFile(data);
      guestLabelInput.value = '';""")

html = 'public/index.html'
replace_once(html, 'styles.css?v=1.6.9', 'styles.css?v=1.6.10')
replace_once(html, 'app.js?v=1.6.9', 'app.js?v=1.6.10')
replace_once(html,
'<h3 class="keySectionTitle">활성 입장 파일</h3>',
'<h3 class="keySectionTitle">활성 입장 파일</h3>\n          <p class="smallMuted">재발급 시 기존 파일과 접속은 즉시 무효화됩니다. 새로 받은 HTML 파일을 사용자에게 전달하세요.</p>')
package = 'package.json'
replace_once(package, '"version": "1.6.9"', '"version": "1.6.10"')
print('Guest file reissue implementation applied, retaining existing credential identities and metadata.')
