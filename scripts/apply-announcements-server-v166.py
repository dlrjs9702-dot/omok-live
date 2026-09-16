from pathlib import Path

p = Path('server.js')
s = p.read_text()
def once(old, new, label):
    global s
    n = s.count(old)
    if n != 1: raise RuntimeError(f'{label}: expected one anchor, got {n}')
    s = s.replace(old, new, 1)

once("const { createAccessStore } = require('./lib/access-store');", "const { createAccessStore } = require('./lib/access-store');\nconst { createAnnouncementStore } = require('./lib/announcement-store');", 'import')
once('let accessStore;\nlet indexTemplate', 'let accessStore;\nlet announcementStore;\nlet indexTemplate', 'store reference')
once('function uniqueLiveTokens(roomId) {', '''async function broadcastAnnouncements() {
  const items = await announcementStore.list();
  for (const entry of [...lobbyStreams]) {
    if (!sessions.has(entry.sessionToken)) continue;
    try { sseWrite(entry.res, 'announcements', { items }); }
    catch { lobbyStreams.delete(entry); }
  }
}

function uniqueLiveTokens(roomId) {''', 'broadcast announcement')
once('    lobbyStreams.add(entry);\n    broadcastLobby();', "    lobbyStreams.add(entry);\n    broadcastLobby();\n    sseWrite(res, 'announcements', { items: await announcementStore.list() });", 'SSE init')

routes = '''  // Public to authenticated members; only administrators may modify notices.
  if (pathname === '/api/announcements' && req.method === 'GET') {
    if (!requireSession(req, res)) return;
    return sendJson(res, 200, { items: await announcementStore.list() });
  }

  if (pathname === '/api/announcements' && req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!checkRateLimit('announcements:' + admin.token.slice(0, 12), 20, 60 * 1000)) {
      return sendError(res, 429, 'RATE_LIMIT', '공지 변경이 너무 빠릅니다. 잠시 뒤 다시 시도해 주세요.');
    }
    const body = await parseJson(req);
    if (typeof body.title !== 'string' || typeof body.body !== 'string') {
      return sendError(res, 400, 'BAD_ANNOUNCEMENT', '공지 제목과 내용을 입력해 주세요.');
    }
    const title = body.title.trim();
    const content = body.body.trim();
    if (!title || title.length > 100 || !content || content.length > 3000) {
      return sendError(res, 400, 'BAD_ANNOUNCEMENT', '제목은 1~100자, 내용은 1~3000자로 입력해 주세요.');
    }
    const item = await announcementStore.create(title, content);
    await broadcastAnnouncements();
    return sendJson(res, 201, { ok: true, item });
  }

  const announcementMatch = pathname.match(/^\\/api\\/announcements\\/([0-9a-f-]{36})$/i);
  if (announcementMatch && req.method === 'PUT') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req);
    if (typeof body.title !== 'string' || typeof body.body !== 'string') {
      return sendError(res, 400, 'BAD_ANNOUNCEMENT', '공지 제목과 내용을 입력해 주세요.');
    }
    const title = body.title.trim();
    const content = body.body.trim();
    if (!title || title.length > 100 || !content || content.length > 3000) {
      return sendError(res, 400, 'BAD_ANNOUNCEMENT', '제목은 1~100자, 내용은 1~3000자로 입력해 주세요.');
    }
    const item = await announcementStore.update(announcementMatch[1], title, content);
    if (!item) return sendError(res, 404, 'NOTICE_NOT_FOUND', '공지사항을 찾을 수 없습니다.');
    await broadcastAnnouncements();
    return sendJson(res, 200, { ok: true, item });
  }
  if (announcementMatch && req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const removed = await announcementStore.remove(announcementMatch[1]);
    if (!removed) return sendError(res, 404, 'NOTICE_NOT_FOUND', '공지사항을 찾을 수 없습니다.');
    await broadcastAnnouncements();
    return sendJson(res, 200, { ok: true });
  }

'''
once("  if (pathname === '/api/admin/keys' && req.method === 'GET') {", routes + "  if (pathname === '/api/admin/keys' && req.method === 'GET') {", 'notice routes')
once('  accessStore = await createAccessStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });', '  accessStore = await createAccessStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });\n  announcementStore = await createAnnouncementStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });', 'notice startup')
s = s.replace('1.6.5', '1.6.6')
p.write_text(s)
print('Notice server routes and SSE integrated')
