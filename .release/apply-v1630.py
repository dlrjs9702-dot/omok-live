from pathlib import Path


def swap(name, old, new):
    file = Path(name)
    source = file.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f'{name}: expected one anchor, found {count}: {old[:110]!r}')
    file.write_text(source.replace(old, new, 1), encoding='utf-8')


# 1. Finish once per completed match, before acknowledging the action or opening a rematch.
swap('server.js', "const { createAnnouncementStore } = require('./lib/announcement-store');", "const { createAnnouncementStore } = require('./lib/announcement-store');\nconst { createMatchStore } = require('./lib/match-records');")
swap('server.js', 'let announcementStore;\nlet indexTemplate', 'let announcementStore;\nlet matchStore;\nlet indexTemplate')
swap('server.js', '    guestKeyId: session.guestKeyId, // server-only identity for interrupted game reconnection', "    guestKeyId: session.guestKeyId, // server-only identity for interrupted game reconnection\n    role: session.role,")
swap('server.js', "      label: p.label || '게스트',\n      connected: Boolean(p.connected || live.has(p.sessionToken)),", "      label: p.label || '게스트',\n      playerId: p.guestKeyId || (p.role === 'admin' ? 'admin' : null),\n      connected: Boolean(p.connected || live.has(p.sessionToken)),")
swap('server.js', 'function getCurrentRoom(session) {', '''// The game engine, never the client, supplies the final result. An individual match
// (including a three-round liar match) has one stable id across retries and reconnects.
function resultSeats(room) {
  if (isTeam(room)) return TEAM_SEATS;
  if (isLiar(room)) return [...room.game.players];
  if (isBingo(room) || isPictionary(room) || isOldMaid(room)) return [...room.game.seatOrder];
  return ['black', 'white'];
}

async function recordFinishedMatch(room) {
  const game = room.game;
  if (!['finished', 'draw'].includes(game.status)) return false;
  const matchId = `${room.id}:${game.round}`;
  room.recordedMatches ||= new Set();
  if (room.recordedMatches.has(matchId)) return false;
  const seats = resultSeats(room);
  if (seats.length < 2) throw new Error('Incomplete match seats');
  const drawn = game.status === 'draw';
  const winners = Array.isArray(game.winner) ? game.winner.map(String) : game.winner == null ? [] : [String(game.winner)];
  if (!drawn && !winners.length) throw new Error('Missing game winner');
  const outcomes = seats.map(seat => {
    const token = room.players[seat];
    const person = token && room.participants[token];
    const id = person?.guestKeyId || (person?.role === 'admin' ? 'admin' : null);
    if (!id) throw new Error('Missing persistent player identity');
    const winningSeat = isTeam(room) ? teamColor(seat) : String(seat);
    return { id, result: drawn ? 'draw' : winners.includes(winningSeat) ? 'win' : 'loss' };
  });
  await matchStore.recordMatch({ id: matchId, gameType: room.gameType, at: nowIso(), outcomes });
  room.recordedMatches.add(matchId); // Only after the permanent store confirms the write.
  return true;
}

async function recordOrError(room, res) {
  try { await recordFinishedMatch(room); return true; }
  catch (error) {
    console.error('전적 영구 저장 실패:', error);
    sendError(res, 503, 'MATCH_RECORD_FAILED', '전적 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    return false;
  }
}

function recordIdentity(session) { return session.guestKeyId || (session.role === 'admin' ? 'admin' : null); }

async function recordPlayers() {
  const keys = await accessStore.list();
  return [{ id: 'admin', label: '관리자' }, ...keys.map(key => ({ id: key.id, label: key.label }))];
}

function getCurrentRoom(session) {''')
swap('server.js', 'function tickPictionaryRooms() {', 'async function tickPictionaryRooms() {')
swap('server.js', '    if (changed) { touchRoom(room); broadcast(room); }', '''    if (changed) {
      if (['finished', 'draw'].includes(room.game.status)) {
        try { await recordFinishedMatch(room); }
        catch (error) { console.error('그림 맞히기 전적 저장 실패:', error); continue; }
      }
      touchRoom(room); broadcast(room);
    }''')
swap('server.js', 'function tickLiarRooms() {', 'async function tickLiarRooms() {')
swap('server.js', '    if (!engine.tick(room.game, now)) continue;\n    touchRoom(room);', '''    if (!engine.tick(room.game, now)) continue;
    if (['finished', 'draw'].includes(room.game.status)) {
      try { await recordFinishedMatch(room); }
      catch (error) { console.error('라이어게임 전적 저장 실패:', error); continue; }
    }
    touchRoom(room);''')
swap('server.js', "  const participant = room.participants[session.token] || registerParticipant(room, session);\n\n  if (action === 'choose-role')", "  const participant = room.participants[session.token] || registerParticipant(room, session);\n  if ((action === 'next-round' || action === 'rematch') && !(await recordOrError(room, res))) return;\n\n  if (action === 'choose-role')")
swap('server.js', '  touchRoom(room);\n  broadcast(room);\n  return sendJson(res, 200, { ok: true, state: roomView(room, session) });\n}', '''  if (!(await recordOrError(room, res))) return;
  touchRoom(room);
  broadcast(room);
  return sendJson(res, 200, { ok: true, state: roomView(room, session) });
}''')
swap('server.js', "  if (pathname === '/api/rooms/public' && req.method === 'GET') {", '''  // Authenticated read models expose only player labels and aggregated outcomes.
  if (pathname === '/api/records/me' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const id = recordIdentity(session);
      const stats = await matchStore.stats(id);
      return sendJson(res, 200, { player: { id, label: session.label }, ...stats });
    } catch (error) {
      console.error('내 전적 조회 실패:', error);
      return sendError(res, 503, 'RECORDS_UNAVAILABLE', '전적을 불러오지 못했습니다.');
    }
  }
  if (pathname === '/api/records/players' && req.method === 'GET') {
    if (!requireSession(req, res)) return;
    const query = String(url.searchParams.get('q') || '').trim().slice(0, 40).toLocaleLowerCase('ko');
    if (!query) return sendJson(res, 200, { players: [] });
    try {
      const people = (await recordPlayers()).filter(person => person.label.toLocaleLowerCase('ko').includes(query))
        .sort((a, b) => a.label.localeCompare(b.label, 'ko') || a.id.localeCompare(b.id)).slice(0, 20);
      return sendJson(res, 200, { players: people });
    } catch (error) {
      console.error('플레이어 전적 검색 실패:', error);
      return sendError(res, 503, 'RECORDS_UNAVAILABLE', '플레이어를 조회하지 못했습니다.');
    }
  }
  const recordLookup = pathname.match(/^\\/api\\/records\\/(admin|[0-9a-f-]{36})$/i);
  if (recordLookup && req.method === 'GET') {
    if (!requireSession(req, res)) return;
    try {
      const player = (await recordPlayers()).find(person => person.id === recordLookup[1]);
      if (!player) return sendError(res, 404, 'PLAYER_NOT_FOUND', '해당 플레이어를 찾을 수 없습니다.');
      const stats = await matchStore.stats(player.id);
      return sendJson(res, 200, { player, ...stats });
    } catch (error) {
      console.error('플레이어 전적 조회 실패:', error);
      return sendError(res, 503, 'RECORDS_UNAVAILABLE', '전적을 불러오지 못했습니다.');
    }
  }

  if (pathname === '/api/rooms/public' && req.method === 'GET') {''')
swap('server.js', "    registerParticipant(room, session);\n    return sendJson(res, 200, { state: roomView(room, session) });", "    registerParticipant(room, session);\n    if (!(await recordOrError(room, res))) return;\n    return sendJson(res, 200, { state: roomView(room, session) });")
swap('server.js', "  announcementStore = await createAnnouncementStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });", "  announcementStore = await createAnnouncementStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });\n  matchStore = await createMatchStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });")
swap('server.js', '  setInterval(tickPictionaryRooms, 1000).unref();\n  setInterval(tickLiarRooms, 1000).unref();', "  setInterval(() => tickPictionaryRooms().catch(error => console.error('그림 맞히기 전적 처리 오류:', error)), 1000).unref();\n  setInterval(() => tickLiarRooms().catch(error => console.error('라이어 전적 처리 오류:', error)), 1000).unref();")
print('1/4 durable records and all game finish paths connected')

# 2. Lobby cards, offline lookup and same-sized participant names.
swap('public/index.html', '      <section id="announcementsCard" class="card noticeCard" aria-label="공지사항">', '      <div id="lobbyHighlights" class="lobbyHighlights">\n      <section id="announcementsCard" class="card noticeCard" aria-label="공지사항">')
swap('public/index.html', '''        </div>
      </section>

      <section class="lobbyTopGrid">''', '''        </div>
      </section>
      <section id="myRecordsCard" class="card myRecordsCard" aria-label="내 전적">
        <div class="recordsHead"><h2>내 전적</h2><button id="otherRecordsBtn" class="ghost tiny" type="button">다른 플레이어 조회</button></div>
        <strong id="myRecordsName">전적을 불러오는 중</strong>
        <p id="myRecordsSummary" class="recordsSummary">0전 · 0승 0패 0무 · 승률 0%</p>
        <label for="myRecordsGame">게임별 전적</label>
        <select id="myRecordsGame"><option value="all">전체 게임</option></select>
        <p id="myRecordsDetail" class="recordsDetail">아직 기록된 대국이 없습니다.</p>
      </section>
      </div>

      <section class="lobbyTopGrid">''')
swap('public/index.html', '  <dialog id="logoutDialog"', '''  <dialog id="recordsDialog" class="recordsDialog" aria-labelledby="recordsDialogTitle">
    <div class="recordsDialogHead"><h2 id="recordsDialogTitle">플레이어 전적</h2><button id="recordsCloseBtn" type="button" class="ghost tiny">닫기</button></div>
    <form id="recordsSearchForm" class="recordsSearchForm"><label for="recordsSearchInput">닉네임 검색</label><div><input id="recordsSearchInput" type="search" maxlength="40" autocomplete="off" placeholder="닉네임 입력" /><button class="secondary" type="submit">검색</button></div></form>
    <div id="recordsSearchResults" class="recordsSearchResults" aria-live="polite"></div>
    <section id="recordsProfile" aria-live="polite"><strong id="recordsProfileName">플레이어를 선택하세요.</strong><p id="recordsProfileSummary" class="recordsSummary"></p><label for="recordsProfileGame">게임별 전적</label><select id="recordsProfileGame"><option value="all">전체 게임</option></select><p id="recordsProfileDetail" class="recordsDetail"></p></section>
  </dialog>
  <dialog id="logoutDialog"''')
print('2/4 lobby and player record UI containers prepared')

# 3. JS actions only interact with read-only record APIs; opening dialogs never touches room session.
swap('public/app.js', "  const announcementTab = document.getElementById('announcementTab');", '''  const myRecordsName = document.getElementById('myRecordsName');
  const myRecordsSummary = document.getElementById('myRecordsSummary');
  const myRecordsGame = document.getElementById('myRecordsGame');
  const myRecordsDetail = document.getElementById('myRecordsDetail');
  const otherRecordsBtn = document.getElementById('otherRecordsBtn');
  const recordsDialog = document.getElementById('recordsDialog');
  const recordsCloseBtn = document.getElementById('recordsCloseBtn');
  const recordsSearchForm = document.getElementById('recordsSearchForm');
  const recordsSearchInput = document.getElementById('recordsSearchInput');
  const recordsSearchResults = document.getElementById('recordsSearchResults');
  const recordsProfileName = document.getElementById('recordsProfileName');
  const recordsProfileSummary = document.getElementById('recordsProfileSummary');
  const recordsProfileGame = document.getElementById('recordsProfileGame');
  const recordsProfileDetail = document.getElementById('recordsProfileDetail');
  const announcementTab = document.getElementById('announcementTab');''')
swap('public/app.js', '  let announcements = [];', '  let announcements = [];\n  let ownRecords = null;\n  let viewedRecords = null;')
swap('public/app.js', '  function enterLobby() {', '''  function recordLine(data) {
    if (!data) return '0전 · 0승 0패 0무 · 승률 0%';
    return `${data.played}전 · ${data.wins}승 ${data.losses}패 ${data.draws}무 · 승률 ${data.winRate}%`;
  }

  function renderRecords(data, select, name, summary, detail) {
    name.textContent = data?.player?.label || '기록 없음';
    select.replaceChildren();
    const all = document.createElement('option');
    all.value = 'all'; all.textContent = '전체 게임'; select.appendChild(all);
    for (const gameType of Object.keys(data?.byGame || {}).sort((a, b) => gameName(a).localeCompare(gameName(b), 'ko'))) {
      const option = document.createElement('option');
      option.value = gameType; option.textContent = gameDisplayName(gameType);
      select.appendChild(option);
    }
    select.value = 'all';
    const update = () => {
      const row = select.value === 'all' ? data?.total : data?.byGame?.[select.value];
      summary.textContent = recordLine(row);
      detail.textContent = row?.played ? `${select.value === 'all' ? '전체 게임' : gameDisplayName(select.value)} 기준 · 총 ${row.played}대국` : '아직 기록된 대국이 없습니다.';
    };
    select.onchange = update;
    update();
  }

  async function loadMyRecords() {
    if (!sessionToken) return;
    const token = sessionToken;
    try {
      const data = await api('/api/records/me');
      if (token !== sessionToken) return;
      ownRecords = data;
      renderRecords(data, myRecordsGame, myRecordsName, myRecordsSummary, myRecordsDetail);
    } catch (error) {
      if (token === sessionToken) myRecordsDetail.textContent = `전적 조회 실패 · ${error.message}`;
    }
  }

  async function openPlayerRecords(playerId = null) {
    if (!sessionToken) return;
    recordsDialog.showModal();
    recordsSearchResults.replaceChildren();
    recordsSearchForm.classList.toggle('hidden', Boolean(playerId));
    if (!playerId) {
      recordsProfileName.textContent = '닉네임을 검색해 플레이어를 선택하세요.';
      recordsProfileSummary.textContent = '';
      recordsProfileDetail.textContent = '';
      recordsProfileGame.replaceChildren();
      recordsSearchInput.focus();
      return;
    }
    await showPlayerRecords(playerId);
  }

  async function showPlayerRecords(playerId) {
    recordsProfileName.textContent = '전적 조회 중...';
    try {
      const data = await api(`/api/records/${encodeURIComponent(playerId)}`);
      if (!recordsDialog.open) return;
      viewedRecords = data;
      renderRecords(data, recordsProfileGame, recordsProfileName, recordsProfileSummary, recordsProfileDetail);
    } catch (error) {
      if (recordsDialog.open) recordsProfileName.textContent = `전적 조회 실패 · ${error.message}`;
    }
  }

  async function searchRecordPlayers(event) {
    event.preventDefault();
    recordsSearchResults.replaceChildren();
    const query = recordsSearchInput.value.trim();
    if (!query) return;
    try {
      const data = await api(`/api/records/players?q=${encodeURIComponent(query)}`);
      if (!recordsDialog.open) return;
      if (!data.players.length) recordsSearchResults.textContent = '검색 결과가 없습니다.';
      for (const person of data.players) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'ghost recordSearchItem';
        button.textContent = `${person.label} · 식별 ${person.id.slice(-6)}`;
        button.addEventListener('click', () => showPlayerRecords(person.id));
        recordsSearchResults.appendChild(button);
      }
    } catch (error) {
      if (recordsDialog.open) recordsSearchResults.textContent = `검색 실패 · ${error.message}`;
    }
  }

  function enterLobby() {''')
swap('public/app.js', '    loadAnnouncements().catch(err => showToast(err.message, 3500));', '    loadAnnouncements().catch(err => showToast(err.message, 3500));\n    loadMyRecords();')
swap('public/app.js', "      const name = document.createElement('strong');\n      name.textContent = person.label || '게스트';", '''      const name = document.createElement('strong');
      const nameButton = document.createElement('button');
      nameButton.type = 'button'; nameButton.className = 'participantRecordName';
      nameButton.textContent = person.label || '게스트';
      nameButton.title = '닉네임을 눌러 전적 조회';
      nameButton.disabled = !person.playerId;
      if (person.playerId) nameButton.addEventListener('click', () => openPlayerRecords(person.playerId));
      name.appendChild(nameButton);''')
swap('public/app.js', "  announcementTab.addEventListener('click', () => {", '''  otherRecordsBtn.addEventListener('click', () => openPlayerRecords());
  recordsCloseBtn.addEventListener('click', () => recordsDialog.close());
  recordsSearchForm.addEventListener('submit', searchRecordPlayers);
  announcementTab.addEventListener('click', () => {''')
print('3/4 client record lookup, modal and lobby refresh connected')

# 4. Keep announcement internal scrolling intact and do not resize game-room sidebar.
swap('public/styles.css', '/* Pictionary (그림 맞히기) v1.6.23 */', '''/* v1.6.30: compact lobby statistics and read-only participant record dialog. */
.lobbyHighlights{display:grid;grid-template-columns:minmax(0,65fr) minmax(250px,35fr);gap:12px;align-items:start;margin-bottom:12px}
.lobbyHighlights .noticeCard{margin:0;min-width:0}
.myRecordsCard{min-width:0;padding:12px 14px;display:grid;gap:8px}
.recordsHead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.recordsHead h2,.recordsDialogHead h2{margin:0;font-size:1rem}
.myRecordsCard>strong,.recordsDialog strong{font-size:.95rem;overflow-wrap:anywhere}
.myRecordsCard label,.recordsDialog label{font-size:.76rem;color:#94a3b8}
.myRecordsCard select,.recordsDialog select,.recordsDialog input{width:100%;min-width:0;border:1px solid #475569;border-radius:8px;padding:7px;background:#0f172a;color:#fff}
.recordsSummary,.recordsDetail{margin:0;font-size:.8rem;line-height:1.45;color:#cbd5e1}
.recordsDetail{color:#94a3b8}
.participantRecordName{border:0;background:transparent;color:inherit;font:inherit;text-align:left;padding:1px 2px;border-radius:4px;cursor:pointer;max-width:100%;overflow-wrap:anywhere}
.participantRecordName:hover,.participantRecordName:focus-visible{color:#93c5fd;text-decoration:underline;outline:1px solid #60a5fa;outline-offset:2px}
.participantRecordName:disabled{cursor:default;opacity:1}
.recordsDialog{width:min(92vw,480px);max-height:85vh;overflow:auto;border:1px solid #475569;border-radius:16px;padding:20px;background:#111827;color:#fff;box-shadow:0 18px 70px #0009}
.recordsDialog::backdrop{background:#020617bb}
.recordsDialogHead{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}
.recordsSearchForm{display:grid;gap:6px}
.recordsSearchForm>div{display:flex;gap:7px}
.recordsSearchForm input{flex:1}
.recordsSearchResults{display:grid;gap:4px;max-height:160px;overflow:auto;margin:9px 0}
.recordSearchItem{text-align:left;width:100%}
#recordsProfile{display:grid;gap:8px;border-top:1px solid #334155;padding-top:12px;margin-top:8px}
@media(max-width:760px){.lobbyHighlights{grid-template-columns:minmax(0,1fr);gap:8px}.myRecordsCard{padding:10px 12px;gap:5px}.myRecordsCard label,.myRecordsCard select{font-size:.75rem}.recordsDialog{padding:14px}}

/* Pictionary (그림 맞히기) v1.6.23 */''')
for filename in ['package.json', 'package-lock.json', 'public/index.html', 'server.js']:
    file = Path(filename)
    data = file.read_text(encoding='utf-8')
    if '1.6.29' not in data: raise RuntimeError(f'{filename}: missing version anchor')
    file.write_text(data.replace('1.6.29', '1.6.30'), encoding='utf-8')
for file in Path('test').glob('*.test.js'):
    source = file.read_text(encoding='utf-8')
    updated = source.replace('1\\.6\\.29', '1\\.6\\.30').replace('1.6.29', '1.6.30')
    if source != updated: file.write_text(updated, encoding='utf-8')
swap('lib/release-announcements.js', '\n];', '''
  {
    key: 'v1.6.30',
    title: '[업데이트] v1.6.30 전체 게임 누적 전적 및 플레이어 조회',
    body: '대국이 정상 종료되면 입장 파일 고유 ID를 기준으로 승·패·무를 영구 기록합니다. 재대결은 판마다 따로 기록하며 중복 저장을 방지하고, 닉네임 변경·입장 파일 재발급 후에도 전적이 유지됩니다. 전체·게임별 대국 수와 승률을 로비의 내 전적에서 확인할 수 있고, 닉네임 검색으로 오프라인 사용자를 포함한 다른 플레이어를 조회할 수 있습니다. 게임방에서는 현재 접속자 닉네임을 눌러 전적을 확인할 수 있습니다. 기존 대국은 소급하지 않습니다.',
    publishedAt: '2026-09-18T12:20:00+09:00',
  },
];''')
print('4/4 release notice, version and static cache updated')
