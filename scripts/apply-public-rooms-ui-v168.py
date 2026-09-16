from pathlib import Path

def edit(path, callback):
    p = Path(path)
    before = p.read_text()
    after = callback(before)
    assert after != before, f'No changes in {path}'
    p.write_text(after)

def rep(text, old, new):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected one UI anchor, found {count}: {old[:120]!r}')
    return text.replace(old, new, 1)

def update_html(html):
    html = rep(html, '''          <p id="selectedGameText" class="selectedGameText hidden">오목 방을 만듭니다.</p>
          <button id="createRoomBtn" class="primary big">방 만들기</button>''', '''          <p id="selectedGameText" class="selectedGameText hidden">오목 방을 만듭니다.</p>
          <fieldset class="visibilityChoices">
            <legend>방 공개 설정</legend>
            <label><input type="radio" name="roomVisibility" value="public" checked /> 🌐 공개방 <small>목록에서 바로 입장</small></label>
            <label><input type="radio" name="roomVisibility" value="private" /> 🔒 비공개방 <small>비밀번호로만 입장</small></label>
          </fieldset>
          <button id="createRoomBtn" class="primary big">방 만들기</button>''')
    html = rep(html, '''        </article>


      <section class="card lobbyChatCard"''', '''        </article>

        <section id="publicRoomsCard" class="card publicRoomsCard" aria-label="공개 게임방 목록">
          <div class="publicRoomsHeader">
            <div><p class="eyebrow">OPEN ROOMS</p><h2>공개 게임방</h2></div>
            <button id="refreshPublicRoomsBtn" type="button" class="ghost tiny">새로고침</button>
          </div>
          <p class="smallMuted publicRoomsNote">모집 중인 방은 바로 입장하고, 대국 중인 방은 관전할 수 있습니다.</p>
          <div id="publicRoomList" class="publicRoomList" aria-live="polite"><p class="emptyState">게임방을 불러오는 중입니다.</p></div>
          <div id="lobbyInvitations" class="lobbyInvitations hidden" aria-live="polite"></div>
        </section>

      <section class="card lobbyChatCard"''')
    html = rep(html, '''            <small>입장 파일이 있는 사람에게만 이 비밀번호를 알려주세요.</small>
          </div>

          <h3>대국 정보</h3>''', '''            <small id="roomCodeHelp">비공개방은 이 비밀번호로만 입장할 수 있습니다.</small>
          </div>

          <section id="roomInvitePanel" class="roomInvitePanel hidden" aria-label="온라인 사용자 초대">
            <div class="roomInviteHead"><h3>대전 초대</h3><button id="refreshInviteTargetsBtn" type="button" class="ghost tiny">대기자 갱신</button></div>
            <p class="smallMuted">로비에 있는 사용자를 초대합니다. 상대가 수락하면 이 방에 입장합니다.</p>
            <div id="inviteTargetList" class="inviteTargetList"><p class="emptyState">접속자를 불러오는 중입니다.</p></div>
          </section>

          <h3>대국 정보</h3>''')
    if html.count('v=1.6.7') != 3:
        raise RuntimeError('Expected three versioned UI assets')
    return html.replace('v=1.6.7', 'v=1.6.8')

edit('public/index.html', update_html)

def update_app(app):
    app = rep(app, "  const createRoomBtn = document.getElementById('createRoomBtn');", """  const createRoomBtn = document.getElementById('createRoomBtn');
  const publicRoomList = document.getElementById('publicRoomList');
  const refreshPublicRoomsBtn = document.getElementById('refreshPublicRoomsBtn');
  const lobbyInvitations = document.getElementById('lobbyInvitations');
  const roomInvitePanel = document.getElementById('roomInvitePanel');
  const inviteTargetList = document.getElementById('inviteTargetList');
  const refreshInviteTargetsBtn = document.getElementById('refreshInviteTargetsBtn');
  const roomCodeHelp = document.getElementById('roomCodeHelp');""")
    app = rep(app, "  let lobbyState = { messages: [], connectedCount: 0 };", "  let lobbyState = { messages: [], connectedCount: 0, rooms: [], invitations: [] };")
    app = rep(app, """      const data = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ gameType: selectedGameType }) });
      enterRoomState(data.state);
      if (data.state?.me?.roomCode) showToast(`방 비밀번호 ${data.state.me.roomCode} 생성 완료`);""", """      const visibility = document.querySelector('input[name="roomVisibility"]:checked')?.value || 'private';
      const data = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ gameType: selectedGameType, visibility }) });
      enterRoomState(data.state);
      showToast(visibility === 'public' ? '공개방을 만들었습니다. 로비 목록에서 바로 참여할 수 있어요.' : `비공개방 생성 완료 · 비밀번호 ${data.state.me.roomCode}`);""")
    app = rep(app, '  async function loadAnnouncements() {', '''  // No room codes, session tokens, or baseball secrets are ever placed in lobby cards.
  function renderPublicRooms() {
    publicRoomList.replaceChildren();
    const rooms = Array.isArray(lobbyState.rooms) ? lobbyState.rooms : [];
    if (!rooms.length) {
      const empty = document.createElement('p');
      empty.className = 'emptyState';
      empty.textContent = '현재 공개방이 없습니다. 왼쪽에서 공개방을 만들고 상대를 기다려 보세요.';
      publicRoomList.appendChild(empty);
      return;
    }
    for (const room of rooms) {
      const row = document.createElement('div');
      row.className = 'publicRoomRow';
      const main = document.createElement('div');
      main.className = 'publicRoomMain';
      const name = document.createElement('strong');
      name.textContent = `${room.host || '방장'}의 ${room.gameName || gameName(room.gameType)}방`;
      const info = document.createElement('small');
      const status = room.status === 'waiting' ? '상대 모집 중' : room.status === 'finished' ? '대국 종료' : '대국 중';
      info.textContent = `${status} · 선수 ${room.playerCount || 0}/2 · 접속 ${room.connectedCount || 0}명`;
      main.append(name, info);
      const enter = document.createElement('button');
      enter.type = 'button';
      enter.className = room.status === 'waiting' ? 'secondary tiny' : 'ghost tiny';
      enter.textContent = room.status === 'waiting' ? '바로 입장' : '관전하기';
      enter.addEventListener('click', async () => {
        enter.disabled = true;
        try { await joinPublicRoom(room.id); }
        catch (err) { showToast(err.message, 4200); await loadPublicRooms().catch(() => {}); }
        finally { enter.disabled = false; }
      });
      row.append(main, enter);
      publicRoomList.appendChild(row);
    }
  }

  async function loadPublicRooms() {
    if (!sessionToken || state) return;
    const data = await api('/api/rooms/public');
    lobbyState.rooms = Array.isArray(data.rooms) ? data.rooms : [];
    renderPublicRooms();
  }

  async function joinPublicRoom(roomId) {
    const data = await api('/api/rooms/public/join', { method: 'POST', body: JSON.stringify({ roomId }) });
    enterRoomState(data.state);
  }

  function renderLobbyInvitations() {
    lobbyInvitations.replaceChildren();
    const items = (Array.isArray(lobbyState.invitations) ? lobbyState.invitations : [])
      .filter(invite => Date.parse(invite.expiresAt) > Date.now());
    lobbyInvitations.classList.toggle('hidden', !items.length);
    if (!items.length) return;
    const head = document.createElement('strong');
    head.textContent = `✉️ 대전 초대 ${items.length}건`;
    lobbyInvitations.appendChild(head);
    for (const invite of items) {
      const row = document.createElement('div');
      row.className = 'lobbyInvitationRow';
      const label = document.createElement('span');
      label.textContent = `${invite.from}님이 ${invite.game} 대전을 신청했습니다.`;
      const actions = document.createElement('div');
      actions.className = 'inviteActions';
      const accept = document.createElement('button');
      accept.className = 'secondary tiny';
      accept.type = 'button';
      accept.textContent = '수락';
      const decline = document.createElement('button');
      decline.className = 'ghost tiny';
      decline.type = 'button';
      decline.textContent = '거절';
      accept.addEventListener('click', () => respondInvitation(invite.id, true, [accept, decline]));
      decline.addEventListener('click', () => respondInvitation(invite.id, false, [accept, decline]));
      actions.append(accept, decline);
      row.append(label, actions);
      lobbyInvitations.appendChild(row);
    }
  }

  async function respondInvitation(inviteId, accept, buttons) {
    for (const button of buttons) button.disabled = true;
    try {
      const data = await api(`/api/invitations/${encodeURIComponent(inviteId)}/respond`, {
        method: 'POST', body: JSON.stringify({ accept }),
      });
      if (data.accepted) enterRoomState(data.state);
      else {
        lobbyState.invitations = (lobbyState.invitations || []).filter(item => item.id !== inviteId);
        renderLobbyInvitations();
        showToast('초대를 거절했습니다.');
      }
    } catch (err) {
      showToast(err.message, 4200);
      try {
        const data = await api('/api/invitations');
        lobbyState.invitations = data.items || [];
        renderLobbyInvitations();
      } catch {}
    } finally {
      for (const button of buttons) button.disabled = false;
    }
  }

  async function loadInviteTargets() {
    if (!sessionToken || !state || !isHost || state.game.status !== 'selecting') return;
    refreshInviteTargetsBtn.disabled = true;
    try {
      const data = await api('/api/lobby/players');
      if (!state || !isHost || state.game.status !== 'selecting') return;
      inviteTargetList.replaceChildren();
      const people = Array.isArray(data.players) ? data.players : [];
      if (!people.length) {
        const empty = document.createElement('p');
        empty.className = 'emptyState';
        empty.textContent = '현재 로비에서 대기 중인 사람이 없습니다.';
        inviteTargetList.appendChild(empty);
      }
      for (const person of people) {
        const row = document.createElement('div');
        row.className = 'inviteTargetRow';
        const name = document.createElement('span');
        name.textContent = person.label;
        const send = document.createElement('button');
        send.type = 'button';
        send.className = 'ghost tiny';
        send.textContent = '초대하기';
        send.addEventListener('click', async () => {
          send.disabled = true;
          try {
            await api('/api/rooms/invite', { method: 'POST', body: JSON.stringify({ targetId: person.id }) });
            send.textContent = '초대 보냄';
            showToast(`${person.label}님에게 대전 초대를 보냈습니다.`);
          } catch (err) { showToast(err.message, 4200); send.disabled = false; }
        });
        row.append(name, send);
        inviteTargetList.appendChild(row);
      }
    } catch (err) { showToast(err.message, 3500); }
    finally { refreshInviteTargetsBtn.disabled = false; }
  }

  async function loadAnnouncements() {''')
    app = rep(app, '''    renderLobbyChat();
    loadAnnouncements().catch(err => showToast(err.message, 3500));
    startLobbyStream();''', '''    renderLobbyChat();
    loadAnnouncements().catch(err => showToast(err.message, 3500));
    loadPublicRooms().catch(err => showToast(err.message, 3500));
    startLobbyStream();''')
    app = rep(app, '''    showView('room');
    renderRoom();
    startStream();''', '''    showView('room');
    inviteTargetList.replaceChildren();
    renderRoom();
    startStream();
    if (isHost && state.game.status === 'selecting') loadInviteTargets().catch(() => {});''')
    app = rep(app, '''      lobbyState = parsed || { messages: [], connectedCount: 0 };
      renderLobbyChat();''', '''      lobbyState = parsed || { messages: [], connectedCount: 0, rooms: [], invitations: [] };
      renderLobbyChat();
      renderPublicRooms();
      renderLobbyInvitations();''')
    app = rep(app, '''    hostRoomCode.textContent = state.me?.roomCode || '----';

    roundNumber.textContent''', '''    hostRoomCode.textContent = state.me?.roomCode || '----';
    roomCodeHelp.textContent = state.visibility === 'public'
      ? '이 방은 공개방 목록에서도 비밀번호 없이 입장할 수 있습니다.'
      : '비공개방은 비밀번호 또는 직접 받은 초대로만 입장할 수 있습니다.';
    roomInvitePanel.classList.toggle('hidden', !(isHost && g.status === 'selecting'));

    roundNumber.textContent''')
    app = rep(app, '''  createRoomBtn.addEventListener('click', createRoom);
  newRoomBtn.addEventListener('click', createRoom);''', '''  createRoomBtn.addEventListener('click', createRoom);
  newRoomBtn.addEventListener('click', createRoom);
  refreshPublicRoomsBtn.addEventListener('click', () => loadPublicRooms().catch(err => showToast(err.message, 3500)));
  refreshInviteTargetsBtn.addEventListener('click', () => loadInviteTargets().catch(err => showToast(err.message, 3500)));''')
    return app

edit('public/app.js', update_app)

css = Path('public/styles.css')
css.write_text(css.read_text() + '''

/* Public rooms and direct member invitations v1.6.8 */
.visibilityChoices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;border:0;padding:0;margin:13px 0 16px}
.visibilityChoices legend{font-size:.79rem;font-weight:850;color:#cbd5e1;padding:0 0 7px}
.visibilityChoices label{display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:5px;row-gap:3px;padding:9px 7px;border:1px solid #334155;background:#0f172a;border-radius:10px;font-size:.76rem;font-weight:800;cursor:pointer}
.visibilityChoices label:has(input:checked){border-color:#60a5fa;background:#172554}
.visibilityChoices input{accent-color:#60a5fa}
.visibilityChoices small{grid-column:2;color:#94a3b8;font-size:.65rem;font-weight:500;line-height:1.4}
.lobbyTopGrid>.publicRoomsCard{grid-column:2;grid-row:1;min-width:0;padding:22px}
.lobbyTopGrid>.lobbyChatCard{grid-column:1/-1;grid-row:auto}
.lobbyTopGrid>.publicRoomsCard h2{margin:0}
.publicRoomsHeader{display:flex;justify-content:space-between;align-items:center;gap:10px}
.publicRoomsNote{font-size:.76rem;line-height:1.45;margin:9px 0 12px}
.publicRoomList{display:grid;align-content:start;gap:8px;max-height:350px;overflow-y:auto;scrollbar-width:thin}
.publicRoomRow,.lobbyInvitationRow,.inviteTargetRow{display:flex;align-items:center;justify-content:space-between;gap:10px;min-width:0;padding:10px;background:#0f172a;border:1px solid #273449;border-radius:11px}
.publicRoomMain{display:grid;gap:4px;min-width:0}
.publicRoomMain strong{font-size:.86rem;overflow-wrap:anywhere}
.publicRoomMain small{color:#94a3b8;font-size:.72rem;line-height:1.4}
.publicRoomRow button,.inviteTargetRow button{flex:0 0 auto;white-space:nowrap}
.lobbyInvitations{margin-top:14px;padding-top:12px;border-top:1px solid #334155;display:grid;gap:8px}
.lobbyInvitations>strong{font-size:.85rem;color:#bfdbfe}
.lobbyInvitationRow{flex-wrap:wrap}
.lobbyInvitationRow span{font-size:.8rem;line-height:1.5}
.inviteActions{display:flex;gap:6px;margin-left:auto}
.roomInvitePanel{border-top:1px solid #263246;border-bottom:1px solid #263246;padding:13px 0;margin:4px 0 18px}
.roomInviteHead{display:flex;align-items:center;justify-content:space-between;gap:10px}
.roomInviteHead h3{font-size:.97rem;margin:0}
.roomInvitePanel>.smallMuted{font-size:.74rem;line-height:1.5;margin:8px 0}
.inviteTargetList{display:grid;gap:6px;max-height:195px;overflow:auto}
.inviteTargetRow{padding:7px 9px}
.inviteTargetRow span{font-size:.8rem;min-width:0;overflow:hidden;text-overflow:ellipsis}
@media(max-width:880px){.lobbyTopGrid>.publicRoomsCard{grid-column:1;grid-row:auto;padding:14px}.lobbyTopGrid>.lobbyChatCard{grid-column:1}.visibilityChoices{gap:6px}}
@media(max-width:520px){.visibilityChoices label{font-size:.69rem;padding:8px 5px}.visibilityChoices small{font-size:.61rem}.publicRoomMain strong{font-size:.8rem}.publicRoomMain small{font-size:.65rem}.publicRoomRow{padding:9px 7px}}
''')

package = Path('package.json')
p = package.read_text()
package.write_text(rep(p, '"version": "1.6.7"', '"version": "1.6.8"'))
lock = Path('package-lock.json')
if lock.exists():
    text = lock.read_text()
    assert text.count('"version": "1.6.7"') >= 1
    lock.write_text(text.replace('"version": "1.6.7"', '"version": "1.6.8"'))

# Fix a test's initial lobby connection to exercise real targeted private invitation.
test_path = Path('test/public-rooms-invites.test.js')
test_text = test_path.read_text()
test_text = rep(test_text, "  const { req, guest } = await withServer(t);", "  const { base, req, guest } = await withServer(t);")
test_text = rep(test_text, '''  const lobbyHeaders = { 'X-Session-Token': target.session };
  const targetStream = new AbortController();
  const strangerStream = new AbortController();
  const targetConnection = await fetch(`http://127.0.0.1:${(new URL('http://test')).port || ''}`, { signal: targetStream.signal }).catch(() => null);
  void targetConnection;
  const available = await req('/api/lobby/players', host.session, undefined, 'GET');
  assert.equal(available.status, 200);
  assert.ok(Array.isArray(available.data.players));
  assert.doesNotMatch(JSON.stringify(available.data), /sessionToken|guestKeyId|roomCode|tokenHash/);
  targetStream.abort();
  strangerStream.abort();
  void lobbyHeaders;
  // Lobby SSE connections are tested separately below; no account may be invited by guessing a token.
  assert.equal((await req('/api/rooms/invite', host.session, { targetId: target.session })).status, 404);
  const passwordJoin = await req('/api/rooms/join', target.session, { code });
  assert.equal(passwordJoin.status, 200);
  assert.equal(passwordJoin.data.state.visibility, 'private');
  assert.equal(passwordJoin.data.state.me.roomCode, null);
  assert.equal((await req('/api/invitations', stranger.session, undefined, 'GET')).data.items.length, 0);''', '''  const targetStream = new AbortController();
  const strangerStream = new AbortController();
  assert.equal((await fetch(base + '/api/lobby/events', { headers: { 'X-Session-Token': target.session }, signal: targetStream.signal })).status, 200);
  assert.equal((await fetch(base + '/api/lobby/events', { headers: { 'X-Session-Token': stranger.session }, signal: strangerStream.signal })).status, 200);
  t.after(() => { targetStream.abort(); strangerStream.abort(); });
  const available = await req('/api/lobby/players', host.session, undefined, 'GET');
  assert.equal(available.status, 200);
  const targetId = available.data.players.find(person => person.label === '초대받는 사람')?.id;
  assert.ok(targetId);
  assert.doesNotMatch(JSON.stringify(available.data), /sessionToken|guestKeyId|roomCode|tokenHash/);
  assert.equal((await req('/api/rooms/invite', host.session, { targetId: target.session })).status, 404);
  const invite = await req('/api/rooms/invite', host.session, { targetId });
  assert.equal(invite.status, 201);
  const received = await req('/api/invitations', target.session, undefined, 'GET');
  assert.equal(received.data.items.length, 1);
  assert.equal(received.data.items[0].game, '숫자야구');
  assert.doesNotMatch(JSON.stringify(received.data), new RegExp(code));
  assert.equal((await req('/api/invitations', stranger.session, undefined, 'GET')).data.items.length, 0);
  assert.equal((await req('/api/invitations/' + invite.data.id + '/respond', stranger.session, { accept: true })).status, 403);
  const accepted = await req('/api/invitations/' + invite.data.id + '/respond', target.session, { accept: true });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.state.visibility, 'private');
  assert.equal(accepted.data.state.me.roomCode, null);
  assert.equal((await req('/api/invitations/' + invite.data.id + '/respond', target.session, { accept: true })).status, 404);
  const passwordJoin = await req('/api/rooms/join', stranger.session, { code });
  assert.equal(passwordJoin.status, 200);
  assert.equal(passwordJoin.data.state.visibility, 'private');
  assert.equal(passwordJoin.data.state.me.roomCode, null);''')
test_path.write_text(test_text)
print('Applied compact lobby public listing, visibility choices, direct invite UX, version and private invitation tests')
