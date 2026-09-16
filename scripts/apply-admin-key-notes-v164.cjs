'use strict';
const fs = require('node:fs');

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, value) { fs.writeFileSync(file, value, 'utf8'); }
function replaceFirst(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error('Missing migration anchor: ' + label);
  return source.replace(needle, replacement);
}

let store = read('lib/access-store.js');
store = replaceFirst(store,
  "      revokedAt: null,\n    };",
  "      revokedAt: null,\n      adminNote: '',\n    };",
  'new JSON keys have blank note');
store = replaceFirst(store,
  "    return this.data.keys.map(({ tokenHash, ...rest }) => ({ ...rest }));",
  "    return this.data.keys.map(({ tokenHash, ...rest }) => ({ ...rest, adminNote: rest.adminNote || '' }));",
  'old JSON keys show blank notes');
store = replaceFirst(store,
  "  async revoke(id) {\n    const row = this.data.keys.find((k) => k.id === id);",
  `  async setNote(id, note) {
    const row = this.data.keys.find((k) => k.id === id);
    if (!row) return null;
    row.adminNote = note;
    await this.#save();
    const { tokenHash, ...publicRow } = row;
    return { ...publicRow };
  }

  async revoke(id) {
    const row = this.data.keys.find((k) => k.id === id);`,
  'JSON note persistence');
store = replaceFirst(store,
  "    `);\n  }\n\n  #map(row) {",
  "    `);\n    await this.pool.query(\"ALTER TABLE guest_access_keys ADD COLUMN IF NOT EXISTS admin_note text NOT NULL DEFAULT ''\");\n  }\n\n  #map(row) {",
  'Postgres non-destructive column migration');
store = replaceFirst(store,
  "      label: row.label,\n      createdAt: row.created_at",
  "      label: row.label,\n      adminNote: row.admin_note || '',\n      createdAt: row.created_at",
  'Postgres mapping');
const oldColumns = 'created_at, last_used_at, use_count, revoked_at';
if (!store.includes(oldColumns)) throw new Error('Missing SQL columns');
store = store.replaceAll(oldColumns, oldColumns + ', admin_note');
store = replaceFirst(store,
  "  async revoke(id) {\n    const result = await this.pool.query(",
  `  async setNote(id, note) {
    const result = await this.pool.query(
      \`UPDATE guest_access_keys SET admin_note = $2 WHERE id = $1
       RETURNING id, label, created_at, last_used_at, use_count, revoked_at, admin_note\`,
      [id, note]
    );
    return this.#map(result.rows[0]);
  }

  async revoke(id) {
    const result = await this.pool.query(`,
  'Postgres note write');
write('lib/access-store.js', store);

let server = read('server.js');
server = replaceFirst(server,
  "  let match = pathname.match(",
  `  const noteMatch = pathname.match(/^\\/api\\/admin\\/keys\\/([0-9a-f-]{36})\\/note$/i);
  if (noteMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req);
    if (typeof body.note !== 'string') return sendError(res, 400, 'BAD_NOTE', '메모는 문자로 입력해 주세요.');
    const note = body.note.trim().replace(/\\s+/g, ' ');
    if (note.length > 200) return sendError(res, 400, 'NOTE_TOO_LONG', '메모는 200자까지 입력할 수 있습니다.');
    const key = await accessStore.setNote(noteMatch[1], note);
    if (!key) return sendError(res, 404, 'KEY_NOT_FOUND', '입장 파일을 찾을 수 없습니다.');
    return sendJson(res, 200, { ok: true, key });
  }

  let match = pathname.match(`,
  'admin-only note route');
if (!server.includes('1.6.3')) throw new Error('Server version anchor missing');
server = server.replaceAll('1.6.3', '1.6.4');
write('server.js', server);

let app = read('public/app.js');
app = replaceFirst(app,
  `      status.textContent = key.presence?.online ? '접속 중' : '오프라인';
      identity.append(strong, status);
      main.appendChild(identity);`,
  `      status.textContent = key.presence?.online ? '접속 중' : '오프라인';
      const memoPreview = document.createElement('span');
      memoPreview.className = 'keyMemoPreview';
      const refreshMemo = () => {
        const note = key.adminNote || '';
        memoPreview.textContent = note ? '· ' + note : '';
        memoPreview.title = note;
        memoPreview.classList.toggle('hidden', !note);
        identity.classList.toggle('withMemo', Boolean(note));
      };
      refreshMemo();
      identity.append(strong, status, memoPreview);
      main.appendChild(identity);`,
  'admin note preview in active row');
app = replaceFirst(app,
  `      detailBtn.textContent = '자세히 보기';
      const revokeBtn = document.createElement('button');`,
  `      detailBtn.textContent = '자세히 보기';
      const memoBtn = document.createElement('button');
      memoBtn.className = 'ghost tiny compactAction';
      memoBtn.textContent = '메모';
      memoBtn.title = '관리자 전용 메모 입력·수정';
      const revokeBtn = document.createElement('button');`,
  'memo button');
app = replaceFirst(app,
  `      actions.append(detailBtn, revokeBtn);`,
  `      actions.append(detailBtn, memoBtn, revokeBtn);`,
  'memo action');
app = replaceFirst(app,
  `      detail.textContent = \`상태 \${presence} · 최근 사용 \${used} · 총 \${key.useCount || 0}회\`;
      detailBtn.addEventListener('click', () => {`,
  `      detail.textContent = \`상태 \${presence} · 최근 사용 \${used} · 총 \${key.useCount || 0}회\`;
      const memoEditor = document.createElement('form');
      memoEditor.className = 'keyMemoEditor hidden';
      const memoInput = document.createElement('input');
      memoInput.className = 'keyMemoInput';
      memoInput.type = 'text';
      memoInput.maxLength = 200;
      memoInput.autocomplete = 'off';
      memoInput.placeholder = '누구인지 구분할 메모 (최대 200자)';
      memoInput.setAttribute('aria-label', \`\${key.label} 관리자 메모\`);
      const saveMemoBtn = document.createElement('button');
      saveMemoBtn.className = 'secondary tiny compactAction';
      saveMemoBtn.type = 'submit';
      saveMemoBtn.textContent = '저장';
      const cancelMemoBtn = document.createElement('button');
      cancelMemoBtn.className = 'ghost tiny compactAction';
      cancelMemoBtn.type = 'button';
      cancelMemoBtn.textContent = '취소';
      memoEditor.append(memoInput, saveMemoBtn, cancelMemoBtn);
      const closeMemoEditor = () => memoEditor.classList.add('hidden');
      memoBtn.addEventListener('click', () => {
        const opening = memoEditor.classList.contains('hidden');
        memoEditor.classList.toggle('hidden', !opening);
        if (opening) {
          memoInput.value = key.adminNote || '';
          memoInput.focus();
        }
      });
      cancelMemoBtn.addEventListener('click', closeMemoEditor);
      memoEditor.addEventListener('submit', async (event) => {
        event.preventDefault();
        const note = memoInput.value.trim().replace(/\\s+/g, ' ');
        if (note.length > 200) return showToast('메모는 200자까지 입력할 수 있습니다.');
        saveMemoBtn.disabled = true;
        try {
          const data = await api(\`/api/admin/keys/\${key.id}/note\`, {
            method: 'POST',
            body: JSON.stringify({ note }),
          });
          key.adminNote = data.key.adminNote || '';
          memoInput.value = key.adminNote;
          refreshMemo();
          closeMemoEditor();
          showToast('관리자 메모를 저장했습니다.');
        } catch (err) {
          showToast(err.message, 4000);
        } finally {
          saveMemoBtn.disabled = false;
        }
      });
      detailBtn.addEventListener('click', () => {`,
  'memo editor with persisted save');
app = replaceFirst(app,
  `      row.append(main, actions, detail);
      guestKeyList.appendChild(row);`,
  `      row.append(main, actions, detail, memoEditor);
      guestKeyList.appendChild(row);`,
  'inline editor insertion');
app = replaceFirst(app,
  `      status.textContent = '취소됨';
      identity.append(strong, status);
      main.appendChild(identity);`,
  `      status.textContent = '취소됨';
      const note = document.createElement('span');
      note.className = 'keyMemoPreview';
      note.textContent = key.adminNote ? '· ' + key.adminNote : '';
      note.title = key.adminNote || '';
      note.classList.toggle('hidden', !key.adminNote);
      identity.classList.toggle('withMemo', Boolean(key.adminNote));
      identity.append(strong, status, note);
      main.appendChild(identity);`,
  'read-only memo on revoked row');
write('public/app.js', app);

let css = read('public/styles.css');
if (css.includes('/* Administrator-only notes v1.6.4 */')) throw new Error('Notes CSS already present');
css += `\n/* Administrator-only notes v1.6.4 */
.keyIdentity.withMemo strong{max-width:42%}
.keyMemoPreview{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a5b4fc;font-size:.7rem}
.keyMemoEditor{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:7px;padding:8px;border:1px solid #334155;border-radius:9px;background:#0b1324}
.keyMemoInput{font:inherit;font-size:.78rem;min-width:0;width:100%;border:1px solid #475569;border-radius:8px;padding:8px 10px;background:#111827;color:#f8fafc;outline:none}
.keyMemoInput:focus{border-color:#60a5fa}
@media(max-width:520px){.keyIdentity.withMemo strong{max-width:36%}.keyMemoPreview{font-size:.64rem}.keyMemoEditor{gap:5px;padding:6px}.keyMemoInput{font-size:.7rem;padding:7px 8px}}
`;
write('public/styles.css', css);

let html = read('public/index.html');
if (!html.includes('?v=1.6.3')) throw new Error('Asset version anchor missing');
html = html.replaceAll('?v=1.6.3', '?v=1.6.4');
write('public/index.html', html);

const pkg = JSON.parse(read('package.json'));
if (pkg.version !== '1.6.3') throw new Error('Unexpected package version: ' + pkg.version);
pkg.version = '1.6.4';
write('package.json', JSON.stringify(pkg, null, 2) + '\n');

let tests = read('test/access-store.test.js');
tests = tests.replace("const { JsonAccessStore } = require('../lib/access-store');", "const { JsonAccessStore, PostgresAccessStore } = require('../lib/access-store');");
tests += `

test('관리자 메모는 저장과 재시작 후에도 유지되고 복구 후에도 남는다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'omok-note-test-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'access-keys.json');
  const store = new JsonAccessStore(file);
  await store.init();
  const token = 'b'.repeat(48);
  const created = await store.create('테스트', token);
  assert.equal(created.adminNote, '');
  assert.equal((await store.setNote(created.id, '우성 회사 PC')).adminNote, '우성 회사 PC');
  const restarted = new JsonAccessStore(file);
  await restarted.init();
  assert.equal((await restarted.list())[0].adminNote, '우성 회사 PC');
  await restarted.revoke(created.id);
  await restarted.restore(created.id);
  assert.equal((await restarted.list())[0].adminNote, '우성 회사 PC');
  assert.equal((await restarted.setNote(created.id, '')).adminNote, '');
  assert.equal(await restarted.setNote('not-a-key', '메모'), null);
});

test('기존 JSON 입장키는 메모가 없어도 조회하고 입력할 수 있다', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'omok-legacy-note-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'access-keys.json');
  await fs.writeFile(file, JSON.stringify({ keys: [{id: 'legacy', label: '기존 사용자', tokenHash: 'hash', revokedAt: null}] }));
  const store = new JsonAccessStore(file);
  await store.init();
  assert.equal((await store.list())[0].adminNote, '');
  await store.setNote('legacy', '기존 메모 입력');
  assert.equal((await store.list())[0].adminNote, '기존 메모 입력');
});

test('PostgreSQL은 기존 테이블에 메모 컬럼을 추가하고 매개변수로 저장한다', async () => {
  const queries = [];
  const store = Object.create(PostgresAccessStore.prototype);
  store.pool = { query: async (sql, params) => {
    queries.push({ sql, params });
    return { rows: params ? [{ id: params[0], label: '테스트', admin_note: params[1] }] : [] };
  }};
  await store.init();
  assert.match(queries[1].sql, /ADD COLUMN IF NOT EXISTS admin_note/);
  const result = await store.setNote('test-uuid', '관리자 메모');
  assert.equal(result.adminNote, '관리자 메모');
  assert.deepEqual(queries[2].params, ['test-uuid', '관리자 메모']);
  assert.match(queries[2].sql, /RETURNING .*admin_note/);
});
`;
write('test/access-store.test.js', tests);
console.log('Admin-only persistent notes migration v1.6.4 applied.');
