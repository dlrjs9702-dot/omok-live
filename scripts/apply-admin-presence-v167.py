from pathlib import Path


def replace_once(path, old, new):
    file = Path(path)
    source = file.read_text(encoding='utf-8')
    assert source.count(old) == 1, f'{path}: expected one anchor, found {source.count(old)}: {old[:100]!r}'
    file.write_text(source.replace(old, new, 1), encoding='utf-8')


server = 'server.js'
replace_once(server,
'''function guestPresence(guestKeyId) {
  if (!guestKeyInUse(guestKeyId)) return { online: false, inRoom: false };
  const token = activeGuestSessions.get(guestKeyId);
  const session = token ? sessions.get(token) : null;
  return {
    online: Boolean(session),
    inRoom: Boolean(session && getCurrentRoom(session)),
  };
}
''',
'''function guestPresence(guestKeyId) {
  if (!guestKeyInUse(guestKeyId)) return { online: false, inRoom: false };
  const token = activeGuestSessions.get(guestKeyId);
  const session = token ? sessions.get(token) : null;
  return {
    online: Boolean(session),
    inRoom: Boolean(session && getCurrentRoom(session)),
  };
}

// Admin-only read model. No room passwords, session tokens or baseball secrets leave the server.
function presenceForSession(session) {
  if (!session) return { status: 'offline', game: null, role: null, opponent: null };
  const room = getCurrentRoom(session);
  if (!room) return { status: 'lobby', game: null, role: null, opponent: null };
  const seat = findSeat(room, session.token);
  const role = seat ? (room.gameType === 'baseball' ? (seat === 'black' ? '선공' : '후공') : (seat === 'black' ? '흑' : '백')) : '관전자';
  const game = getGame(room.gameType)?.name || '게임';
  const otherSeat = seat === 'black' ? 'white' : 'black';
  const opponentToken = seat ? room.players[otherSeat] : null;
  const opponent = opponentToken ? (room.participants[opponentToken]?.label || null) : null;
  let status = 'room-waiting';
  if (room.game.status === 'playing') status = seat ? 'playing' : 'spectating';
  else if (room.game.status === 'setup') status = seat ? 'preparing' : 'room-waiting';
  else if (['finished', 'draw'].includes(room.game.status)) status = 'finished';
  return { status, game, role, opponent };
}

async function adminPresenceSnapshot() {
  const keys = await accessStore.list();
  const entries = [];
  for (const key of keys) {
    if (key.revokedAt) continue;
    const online = guestKeyInUse(key.id);
    const token = online ? activeGuestSessions.get(key.id) : null;
    const session = token ? sessions.get(token) : null;
    entries.push({ label: key.label, note: key.adminNote || '', online: Boolean(session),
      ...presenceForSession(session) });
  }
  const now = nowMs();
  for (const session of sessions.values()) {
    if (session.role !== 'admin') continue;
    if (now - session.lastSeen > GUEST_LOCK_TTL_MS || now - session.createdAt > SESSION_MAX_MS) continue;
    entries.push({ label: session.label, note: '', online: true, ...presenceForSession(session) });
  }
  const order = { playing: 0, spectating: 1, preparing: 2, 'room-waiting': 3, finished: 4, lobby: 5, offline: 6 };
  entries.sort((a, b) => (order[a.status] ?? 10) - (order[b.status] ?? 10) || a.label.localeCompare(b.label, 'ko'));
  const online = entries.filter((person) => person.online);
  return {
    updatedAt: nowIso(),
    counts: {
      online: online.length,
      playing: online.filter((person) => person.status === 'playing').length,
      spectating: online.filter((person) => person.status === 'spectating').length,
      waiting: online.filter((person) => !['playing', 'spectating'].includes(person.status)).length,
      offline: entries.length - online.length,
    },
    entries,
  };
}
''')
replace_once(server,
'''  if (pathname === '/api/admin/keys' && req.method === 'GET') {
''',
'''  if (pathname === '/api/admin/presence' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return sendJson(res, 200, await adminPresenceSnapshot());
  }

  if (pathname === '/api/admin/keys' && req.method === 'GET') {
''')
replace_once(server, "version: '1.6.6'", "version: '1.6.7'")
replace_once(server, '게임 서버 v1.6.6 실행', '게임 서버 v1.6.7 실행')

html = 'public/index.html'
replace_once(html,
'''        <article id="adminPanel" class="card lobbyCard lobbyAdminCard hidden">
''',
'''        <section id="adminPresencePanel" class="card adminPresencePanel hidden" aria-label="관리자 접속 현황">
          <div class="presenceHeader">
            <div><p class="eyebrow">ADMIN · LIVE</p><h2>접속 현황</h2></div>
            <div class="presenceHeaderActions"><small id="presenceUpdatedAt" class="smallMuted" aria-live="polite">조회 전</small><button id="presenceRefreshBtn" type="button" class="ghost tiny">새로고침</button></div>
          </div>
          <div class="presenceStats" aria-label="접속 현황 집계">
            <div><strong id="presenceOnlineCount">-</strong><small>온라인</small></div>
            <div><strong id="presencePlayingCount">-</strong><small>대국 중</small></div>
            <div><strong id="presenceWatchingCount">-</strong><small>관전 중</small></div>
            <div><strong id="presenceWaitingCount">-</strong><small>대기 중</small></div>
          </div>
          <div id="presenceOnlineList" class="presenceList" aria-live="polite"><p class="emptyState">접속 현황을 불러오는 중입니다.</p></div>
          <details id="presenceOfflineDetails" class="presenceOfflineDetails">
            <summary id="presenceOfflineSummary">오프라인 0명 · 자세히 보기</summary>
            <div id="presenceOfflineList" class="presenceList"></div>
          </details>
          <p class="presenceFootnote">약 12초마다 갱신합니다. 비정상 종료 시 접속 상태가 최대 약 90초 늦게 반영될 수 있습니다.</p>
        </section>

        <article id="adminPanel" class="card lobbyCard lobbyAdminCard hidden">
''')
source = Path(html).read_text(encoding='utf-8')
assert source.count('v=1.6.6') == 3, source.count('v=1.6.6')
Path(html).write_text(source.replace('v=1.6.6', 'v=1.6.7'), encoding='utf-8')

app = 'public/app.js'
replace_once(app,
'''  const adminPanel = document.getElementById('adminPanel');
''',
'''  const adminPanel = document.getElementById('adminPanel');
  const adminPresencePanel = document.getElementById('adminPresencePanel');
  const presenceRefreshBtn = document.getElementById('presenceRefreshBtn');
  const presenceUpdatedAt = document.getElementById('presenceUpdatedAt');
  const presenceOnlineCount = document.getElementById('presenceOnlineCount');
  const presencePlayingCount = document.getElementById('presencePlayingCount');
  const presenceWatchingCount = document.getElementById('presenceWatchingCount');
  const presenceWaitingCount = document.getElementById('presenceWaitingCount');
  const presenceOnlineList = document.getElementById('presenceOnlineList');
  const presenceOfflineDetails = document.getElementById('presenceOfflineDetails');
  const presenceOfflineSummary = document.getElementById('presenceOfflineSummary');
  const presenceOfflineList = document.getElementById('presenceOfflineList');
''')
replace_once(app,
'''  let announcements = [];
''',
'''  let announcements = [];
  let presenceTimer = null;
  let presenceLoading = false;
''')
replace_once(app,
'''    stopStream();
    stopLobbyStream();
    sessionToken = '';
''',
'''    stopStream();
    stopLobbyStream();
    stopPresenceRefresh();
    sessionToken = '';
''')
replace_once(app,
'''      adminPanel.classList.toggle('hidden', sessionRole !== 'admin');
''',
'''      adminPanel.classList.toggle('hidden', sessionRole !== 'admin');
      adminPresencePanel.classList.toggle('hidden', sessionRole !== 'admin');
''')
replace_once(app,
'''  async function loadGuestKeys() {
''',
'''  function stopPresenceRefresh() {
    clearInterval(presenceTimer);
    presenceTimer = null;
  }

  function presenceLabel(status) {
    return ({ lobby: '로비 대기', 'room-waiting': '방 대기', preparing: '숫자 준비 중',
      playing: '대국 중', spectating: '관전 중', finished: '대국 종료', offline: '오프라인' })[status] || '대기 중';
  }

  function createPresenceRow(person) {
    const row = document.createElement('div');
    row.className = 'presenceRow';
    const identity = document.createElement('div');
    identity.className = 'presenceIdentity';
    const name = document.createElement('strong');
    name.textContent = person.label || '게스트';
    identity.appendChild(name);
    if (person.note) {
      const note = document.createElement('small');
      note.textContent = person.note;
      note.title = person.note;
      identity.appendChild(note);
    }
    const detail = document.createElement('div');
    detail.className = 'presenceDetail';
    if (person.game) {
      const match = [person.game, person.role, person.opponent ? `상대 ${person.opponent}` : ''].filter(Boolean);
      detail.textContent = match.join(' · ');
    }
    const badge = document.createElement('span');
    badge.className = `presenceBadge${person.status === 'playing' ? ' isPlaying' : person.status === 'spectating' ? ' isWatching' : person.online ? ' isWaiting' : ''}`;
    badge.textContent = presenceLabel(person.status);
    row.append(identity, detail, badge);
    return row;
  }

  function renderPresence(data) {
    const counts = data.counts || {};
    presenceOnlineCount.textContent = counts.online ?? 0;
    presencePlayingCount.textContent = counts.playing ?? 0;
    presenceWatchingCount.textContent = counts.spectating ?? 0;
    presenceWaitingCount.textContent = counts.waiting ?? 0;
    const date = new Date(data.updatedAt);
    presenceUpdatedAt.textContent = Number.isNaN(date.getTime()) ? '방금 갱신' : `${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 기준`;
    const all = Array.isArray(data.entries) ? data.entries : [];
    const online = all.filter(person => person.online);
    const offline = all.filter(person => !person.online);
    presenceOnlineList.replaceChildren();
    presenceOfflineList.replaceChildren();
    if (!online.length) {
      const empty = document.createElement('p');
      empty.className = 'emptyState';
      empty.textContent = '현재 온라인 접속자가 없습니다.';
      presenceOnlineList.appendChild(empty);
    }
    for (const person of online) presenceOnlineList.appendChild(createPresenceRow(person));
    for (const person of offline) presenceOfflineList.appendChild(createPresenceRow(person));
    presenceOfflineSummary.textContent = `오프라인 ${offline.length}명 · 자세히 보기`;
    presenceOfflineDetails.classList.toggle('hidden', !offline.length);
  }

  async function loadPresence() {
    if (sessionRole !== 'admin' || !sessionToken || state || presenceLoading) return;
    presenceLoading = true;
    presenceRefreshBtn.disabled = true;
    const token = sessionToken;
    try {
      const data = await api('/api/admin/presence');
      if (sessionToken === token && sessionRole === 'admin' && !state) renderPresence(data);
    } catch (err) {
      if (err.status !== 401 && sessionToken === token) presenceUpdatedAt.textContent = `갱신 실패 · ${err.message}`;
    } finally {
      presenceLoading = false;
      presenceRefreshBtn.disabled = false;
    }
  }

  function startPresenceRefresh() {
    stopPresenceRefresh();
    if (sessionRole !== 'admin') return;
    loadPresence();
    presenceTimer = setInterval(() => {
      if (!document.hidden) loadPresence();
    }, 12000);
  }

  async function loadGuestKeys() {
''')
replace_once(app,
'''    startLobbyStream();
  }

  function enterRoomState(next) {
''',
'''    startLobbyStream();
    startPresenceRefresh();
  }

  function enterRoomState(next) {
    stopPresenceRefresh();
''')
replace_once(app,
'''  issueFileForm.addEventListener('submit', issueFile);
''',
'''  issueFileForm.addEventListener('submit', issueFile);
  presenceRefreshBtn.addEventListener('click', loadPresence);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadPresence();
  });
''')

css = 'public/styles.css'
with open(css, 'a', encoding='utf-8') as f:
    f.write('''\n/* Admin-only online and game activity board v1.6.7 */
.adminPresencePanel{grid-column:1/-1;min-width:0;padding:20px 24px}
.presenceHeader{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.presenceHeader h2{margin:0}
.presenceHeaderActions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.presenceStats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:14px 0}
.presenceStats>div{display:grid;gap:2px;background:#0f172a;border:1px solid #273449;border-radius:12px;padding:10px 12px}
.presenceStats strong{font-size:1.35rem;font-variant-numeric:tabular-nums}
.presenceStats small{font-size:.73rem;color:#94a3b8}
.presenceList{display:grid;gap:6px;max-height:310px;overflow:auto;scrollbar-width:thin}
.presenceRow{display:grid;grid-template-columns:minmax(95px,1fr) minmax(0,1.6fr) auto;gap:9px;align-items:center;background:#0f172a;border:1px solid #273449;border-radius:11px;padding:8px 10px;min-height:42px}
.presenceIdentity{display:flex;align-items:baseline;gap:8px;min-width:0}
.presenceIdentity strong{white-space:nowrap;font-size:.84rem;max-width:48%;overflow:hidden;text-overflow:ellipsis}
.presenceIdentity small{font-size:.72rem;color:#a5b4fc;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
.presenceDetail{font-size:.76rem;color:#cbd5e1;min-width:0;overflow-wrap:anywhere}
.presenceBadge{font-size:.69rem;font-weight:850;color:#94a3b8;white-space:nowrap}
.presenceBadge.isPlaying{color:#86efac}.presenceBadge.isWatching{color:#c4b5fd}.presenceBadge.isWaiting{color:#93c5fd}
.presenceOfflineDetails{margin-top:11px;border-top:1px solid #263246;padding-top:11px}
.presenceOfflineDetails summary{color:#94a3b8;font-size:.77rem;font-weight:800;cursor:pointer}
.presenceOfflineDetails .presenceList{margin-top:10px;max-height:220px}
.presenceFootnote{margin:12px 0 0;color:#64748b;font-size:.7rem;line-height:1.5}
@media(max-width:880px){.adminPresencePanel{padding:15px}.presenceRow{grid-template-columns:minmax(0,1fr) auto;gap:5px 10px}.presenceDetail{grid-column:1/-1;grid-row:2}}
@media(max-width:520px){.presenceStats{gap:5px}.presenceStats>div{padding:9px 6px;text-align:center}.presenceStats strong{font-size:1.12rem}.presenceStats small{font-size:.65rem}.presenceIdentity strong{max-width:50%}.presenceDetail{font-size:.72rem}}
''')

package = Path('package.json')
text = package.read_text(encoding='utf-8')
assert text.count('"version": "1.6.6"') == 1
package.write_text(text.replace('"version": "1.6.6"', '"version": "1.6.7"'), encoding='utf-8')
print('v1.6.7 admin-only presence dashboard applied')
