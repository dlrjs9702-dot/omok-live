(() => {
  'use strict';

  const gateView = document.getElementById('gateView');
  const lobbyView = document.getElementById('lobbyView');
  const roomView = document.getElementById('roomView');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminPassword = document.getElementById('adminPassword');
  const identityLabel = document.getElementById('identityLabel');
  const roomIdentityLabel = document.getElementById('roomIdentityLabel');
  const lobbyChatMessages = document.getElementById('lobbyChatMessages');
  const lobbyChatForm = document.getElementById('lobbyChatForm');
  const lobbyChatInput = document.getElementById('lobbyChatInput');
  const lobbyConnectionBadge = document.getElementById('lobbyConnectionBadge');
  const lobbyConnectedCount = document.getElementById('lobbyConnectedCount');
  const logoutBtn = document.getElementById('logoutBtn');
  const roomLogoutBtn = document.getElementById('roomLogoutBtn');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const publicRoomList = document.getElementById('publicRoomList');
  const refreshPublicRoomsBtn = document.getElementById('refreshPublicRoomsBtn');
  const lobbyInvitations = document.getElementById('lobbyInvitations');
  const roomInvitePanel = document.getElementById('roomInvitePanel');
  const inviteTargetList = document.getElementById('inviteTargetList');
  const refreshInviteTargetsBtn = document.getElementById('refreshInviteTargetsBtn');
  const roomCodeHelp = document.getElementById('roomCodeHelp');
  const newRoomBtn = document.getElementById('newRoomBtn');
  const gameChoiceButtons = [...document.querySelectorAll('.gameChoice')];
  const selectedGameText = document.getElementById('selectedGameText');
  const roomGameLogo = document.getElementById('roomGameLogo');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const joinRoomForm = document.getElementById('joinRoomForm');
  const roomPasswordInput = document.getElementById('roomPasswordInput');
  const adminPanel = document.getElementById('adminPanel');
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
  const announcementTab = document.getElementById('announcementTab');
  const announcementPanel = document.getElementById('announcementPanel');
  const announcementCount = document.getElementById('announcementCount');
  const announcementList = document.getElementById('announcementList');
  const announcementAddBtn = document.getElementById('announcementAddBtn');
  const announcementForm = document.getElementById('announcementForm');
  const announcementFormTitle = document.getElementById('announcementFormTitle');
  const announcementTitle = document.getElementById('announcementTitle');
  const announcementBody = document.getElementById('announcementBody');
  const announcementSaveBtn = document.getElementById('announcementSaveBtn');
  const announcementCancelBtn = document.getElementById('announcementCancelBtn');
  const issueFileForm = document.getElementById('issueFileForm');
  const guestLabelInput = document.getElementById('guestLabelInput');
  const guestKeyList = document.getElementById('guestKeyList');
  const revokedGuestKeyList = document.getElementById('revokedGuestKeyList');
  const persistenceBadge = document.getElementById('persistenceBadge');
  const hostRoomCodeBox = document.getElementById('hostRoomCodeBox');
  const hostRoomCode = document.getElementById('hostRoomCode');
  const copyRoomCodeBtn = document.getElementById('copyRoomCodeBtn');
  const connectionBadge = document.getElementById('connectionBadge');
  const statusText = document.getElementById('statusText');
  const seatLabel = document.getElementById('seatLabel');
  const standardPlayers = document.getElementById('standardPlayers');
  const teamPlayers = document.getElementById('teamPlayers');
  const standardRoleButtons = document.getElementById('standardRoleButtons');
  const teamRoleButtons = document.getElementById('teamRoleButtons');
  const teamSeatButtons = [...document.querySelectorAll('[data-team-seat]')];
  const teamSpectatorBtn = document.getElementById('teamSpectatorBtn');
  const blackPlayer = document.getElementById('blackPlayer');
  const whitePlayer = document.getElementById('whitePlayer');
  const roleChooser = document.getElementById('roleChooser');
  const chooseBlackBtn = document.getElementById('chooseBlackBtn');
  const chooseWhiteBtn = document.getElementById('chooseWhiteBtn');
  const chooseSpectatorBtn = document.getElementById('chooseSpectatorBtn');
  const boardOverlay = document.getElementById('boardOverlay');
  const canvasWrap = document.getElementById('canvasWrap');
  const baseballPanel = document.getElementById('baseballPanel');
  const baseballReady = document.getElementById('baseballReady');
  const baseballMySecret = document.getElementById('baseballMySecret');
  const baseballHint = document.getElementById('baseballHint');
  const baseballSecretForm = document.getElementById('baseballSecretForm');
  const baseballSecretInput = document.getElementById('baseballSecretInput');
  const baseballGuessForm = document.getElementById('baseballGuessForm');
  const baseballGuessInput = document.getElementById('baseballGuessInput');
  const baseballHistory = document.getElementById('baseballHistory');
  const moveCountLabel = document.getElementById('moveCountLabel');
  const resignBtn = document.getElementById('resignBtn');
  const sideResignBtn = document.getElementById('sideResignBtn');
  const endGameBtn = document.getElementById('endGameBtn');
  const sideEndGameBtn = document.getElementById('sideEndGameBtn');
  const nextRoundBtn = document.getElementById('nextRoundBtn');
  const sideNextRoundBtn = document.getElementById('sideNextRoundBtn');
  const roundNumber = document.getElementById('roundNumber');
  const moveCount = document.getElementById('moveCount');
  const mySeat = document.getElementById('mySeat');
  const connectedCount = document.getElementById('connectedCount');
  const spectatorCount = document.getElementById('spectatorCount');
  const gameScoreRow = document.getElementById('gameScoreRow');
  const gameScoreText = document.getElementById('gameScoreText');
  const rulesText = document.getElementById('rulesText');
  const participantList = document.getElementById('participantList');
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const toast = document.getElementById('toast');
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  const SIZE = 15;
  const PAD = 48;
  const GRID = (canvas.width - PAD * 2) / (SIZE - 1);

  let sessionToken = document.body.dataset.session || '';
  let sessionRole = document.body.dataset.role || '';
  let sessionLabel = document.body.dataset.label || '';
  let selectedGameType = 'omok';
  let state = null;
  let seat = null;
  let isHost = false;
  let streamController = null;
  let streamRetryTimer = null;
  let lobbyStreamController = null;
  let lobbyStreamRetryTimer = null;
  let lobbyState = { messages: [], connectedCount: 0, rooms: [], invitations: [] };
  let announcements = [];
  let presenceTimer = null;
  let presenceLoading = false;
  let editingAnnouncementId = null;
  let hover = null;
  let toastTimer = null;

  if (sessionToken) history.replaceState(null, '', '/');

  function showToast(message, ms = 2800) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), ms);
  }

  function showView(name) {
    gateView.classList.toggle('hidden', name !== 'gate');
    lobbyView.classList.toggle('hidden', name !== 'lobby');
    roomView.classList.toggle('hidden', name !== 'room');
  }

  function identityText() {
    return sessionRole === 'admin' ? '관리자 세션' : `${sessionLabel || '게스트'} · 입장 파일 세션`;
  }

  async function api(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (sessionToken) headers['X-Session-Token'] = sessionToken;
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, { ...options, headers, cache: 'no-store' });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      if (res.status === 401) expireSession(data.message);
      const err = new Error(data.message || '요청을 처리하지 못했습니다.');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function expireSession(message = '입장 세션이 만료되었습니다. 다시 입장해 주세요.') {
    stopStream();
    stopLobbyStream();
    stopPresenceRefresh();
    sessionToken = '';
    sessionRole = '';
    sessionLabel = '';
    state = null;
    showView('gate');
    if (message) showToast(message, 5000);
  }

  async function loadSession() {
    if (!sessionToken) return showView('gate');
    try {
      const info = await api('/api/session');
      if (!info.authenticated) return expireSession('입장 세션이 만료되었습니다.');
      sessionRole = info.role;
      sessionLabel = info.label;
      identityLabel.textContent = identityText();
      roomIdentityLabel.textContent = identityText();
      adminPanel.classList.toggle('hidden', sessionRole !== 'admin');
      adminPresencePanel.classList.toggle('hidden', sessionRole !== 'admin');
      announcementAddBtn.classList.toggle('hidden', sessionRole !== 'admin');
      if (sessionRole === 'admin') await loadGuestKeys();
      const room = await api('/api/room');
      if (room.state) enterRoomState(room.state);
      else enterLobby();
    } catch (err) {
      if (err.status !== 401) showToast(err.message);
    }
  }

  async function adminLogin(event) {
    event.preventDefault();
    try {
      const data = await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password: adminPassword.value }),
      });
      sessionToken = data.sessionToken;
      sessionRole = data.role;
      sessionLabel = data.label;
      adminPassword.value = '';
      await loadSession();
    } catch (err) {
      showToast(err.message, 4500);
    }
  }

  async function logout() {
    try { if (sessionToken) await api('/api/logout', { method: 'POST' }); } catch {}
    expireSession('나갔습니다. 게스트는 다시 입장하려면 전용 파일을 열어야 합니다.');
  }

  function gameName(type) {
    return type === 'omok2v2' ? '오목 2vs2' : type === 'baseball' ? '숫자야구' : type === 'connect4' ? '사목 (4목)' : (type === 'othello' ? '오셀로' : '오목');
  }

  function isTeamGame() { return state?.gameType === 'omok2v2'; }
  function seatColor(value) { return ['1','3'].includes(value) ? 'black' : ['2','4'].includes(value) ? 'white' : value; }

  function selectGame(type) {
    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4'].includes(type) ? type : 'omok';
    for (const button of gameChoiceButtons) button.classList.toggle('selected', button.dataset.game === selectedGameType);
    selectedGameText.textContent = `${gameName(selectedGameType)} 방을 만듭니다.`;
  }

  async function createRoom() {
    try {
      const visibility = document.querySelector('input[name="roomVisibility"]:checked')?.value || 'private';
      const data = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ gameType: selectedGameType, visibility }) });
      enterRoomState(data.state);
      showToast(visibility === 'public' ? '공개방을 만들었습니다. 로비 목록에서 바로 참여할 수 있어요.' : `비공개방 생성 완료 · 비밀번호 ${data.state.me.roomCode}`);
    } catch (err) { showToast(err.message); }
  }

  async function joinRoom(event) {
    event.preventDefault();
    try {
      const data = await api('/api/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ code: roomPasswordInput.value }),
      });
      roomPasswordInput.value = '';
      enterRoomState(data.state);
    } catch (err) { showToast(err.message, 4000); }
  }

  async function leaveRoom() {
    stopStream();
    try { await api('/api/room/leave', { method: 'POST', body: '{}' }); } catch {}
    state = null;
    enterLobby();
    if (sessionRole === 'admin') loadGuestKeys().catch(() => {});
  }

  function formatCodeInput() {
    const raw = roomPasswordInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    roomPasswordInput.value = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw;
  }

  // No room codes, session tokens, or baseball secrets are ever placed in lobby cards.
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
      const status = room.status === 'waiting' ? '상대 모집 중' : room.status === 'finished' ? '대국 종료' : room.status === 'paused' ? '일시정지' : '대국 중';
      info.textContent = `${status} · 선수 ${room.playerCount || 0}/${room.maxPlayers || 2} · 접속 ${room.connectedCount || 0}명`;
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

  async function loadAnnouncements() {
    if (!sessionToken) return;
    const data = await api('/api/announcements');
    announcements = Array.isArray(data.items) ? data.items : [];
    renderAnnouncements();
  }

  function closeAnnouncementEditor() {
    editingAnnouncementId = null;
    announcementTitle.value = '';
    announcementBody.value = '';
    announcementForm.classList.add('hidden');
    announcementFormTitle.textContent = '공지 등록';
  }

  function openAnnouncementEditor(item = null) {
    if (sessionRole !== 'admin') return;
    announcementPanel.classList.remove('hidden');
    announcementTab.setAttribute('aria-expanded', 'true');
    editingAnnouncementId = item?.id || null;
    announcementFormTitle.textContent = item ? '공지 수정' : '공지 등록';
    announcementTitle.value = item?.title || '';
    announcementBody.value = item?.body || '';
    announcementForm.classList.remove('hidden');
    announcementTitle.focus();
  }

  function renderAnnouncements() {
    if (!announcementList) return;
    announcementCount.textContent = String(announcements.length);
    announcementList.replaceChildren();
    if (!announcements.length) {
      const empty = document.createElement('p');
      empty.className = 'noticeEmpty';
      empty.textContent = '등록된 공지사항이 없습니다.';
      announcementList.appendChild(empty);
      return;
    }
    for (const item of announcements) {
      const row = document.createElement('article');
      row.className = 'announcementRow';
      const head = document.createElement('div');
      head.className = 'announcementHead';
      const title = document.createElement('strong');
      title.textContent = item.title;
      const time = document.createElement('time');
      const date = new Date(item.createdAt);
      time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      head.append(title, time);
      const details = document.createElement('details');
      details.className = 'announcementDetails';
      const summary = document.createElement('summary');
      summary.textContent = '자세히 보기';
      const body = document.createElement('p');
      body.textContent = item.body;
      details.append(summary, body);
      row.append(head, details);
      if (sessionRole === 'admin') {
        const actions = document.createElement('div');
        actions.className = 'announcementActions';
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'ghost tiny';
        edit.textContent = '수정';
        edit.addEventListener('click', () => openAnnouncementEditor(item));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'danger tiny';
        remove.textContent = '삭제';
        remove.addEventListener('click', async () => {
          if (!confirm('이 공지사항을 삭제할까요?')) return;
          remove.disabled = true;
          try {
            await api(`/api/announcements/${item.id}`, { method: 'DELETE' });
            if (editingAnnouncementId === item.id) closeAnnouncementEditor();
            await loadAnnouncements();
            showToast('공지사항을 삭제했습니다.');
          } catch (err) { showToast(err.message, 4000); }
          finally { remove.disabled = false; }
        });
        actions.append(edit, remove);
        row.appendChild(actions);
      }
      announcementList.appendChild(row);
    }
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    if (sessionRole !== 'admin') return;
    const title = announcementTitle.value.trim();
    const body = announcementBody.value.trim();
    if (!title || !body || title.length > 100 || body.length > 3000) {
      return showToast('제목 1~100자, 내용 1~3000자를 입력해 주세요.', 4000);
    }
    const id = editingAnnouncementId;
    announcementSaveBtn.disabled = true;
    try {
      await api(id ? `/api/announcements/${id}` : '/api/announcements', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({ title, body }),
      });
      closeAnnouncementEditor();
      await loadAnnouncements();
      showToast(id ? '공지사항을 수정했습니다.' : '공지사항을 등록했습니다.');
    } catch (err) { showToast(err.message, 4000); }
    finally { announcementSaveBtn.disabled = false; }
  }

  function stopPresenceRefresh() {
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
    if (sessionRole !== 'admin' || !sessionToken) return;
    const data = await api('/api/admin/keys');
    persistenceBadge.textContent = data.persistence === 'database' ? '영구 DB 저장' : '임시 서버 저장';
    persistenceBadge.classList.toggle('warn', data.persistence !== 'database');
    renderGuestKeys(data.keys || []);
  }

  function renderGuestKeys(keys) {
    guestKeyList.innerHTML = '';
    revokedGuestKeyList.innerHTML = '';
    const activeKeys = keys.filter((key) => !key.revokedAt);
    const revokedKeys = keys.filter((key) => key.revokedAt);
    if (!activeKeys.length) {
      const empty = document.createElement('p');
      empty.className = 'emptyState';
      empty.textContent = '사용 가능한 입장 파일이 없습니다.';
      guestKeyList.appendChild(empty);
    }
    if (!revokedKeys.length) {
      const empty = document.createElement('p');
      empty.className = 'emptyState';
      empty.textContent = '취소된 입장 파일이 없습니다.';
      revokedGuestKeyList.appendChild(empty);
    }
    for (const key of activeKeys) {
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
      main.appendChild(identity);

      const actions = document.createElement('div');
      actions.className = 'keyActions';
      const detailBtn = document.createElement('button');
      detailBtn.className = 'ghost tiny compactAction';
      detailBtn.textContent = '자세히 보기';
      const memoBtn = document.createElement('button');
      memoBtn.className = 'ghost tiny compactAction';
      memoBtn.textContent = '메모';
      memoBtn.title = '관리자 전용 메모 입력·수정';
      const reissueBtn = document.createElement('button');
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
      revokeBtn.className = 'danger tiny compactAction';
      revokeBtn.textContent = '권한 취소';
      revokeBtn.addEventListener('click', () => revokeKey(key.id, key.label));
      actions.append(detailBtn, memoBtn, reissueBtn, revokeBtn);

      const detail = document.createElement('div');
      detail.className = 'keyDetail hidden';
      const used = key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('ko-KR') : '사용 기록 없음';
      const presence = key.presence?.online ? (key.presence.inRoom ? '접속 중 · 방 참여 중' : '접속 중') : '오프라인';
      detail.textContent = `상태 ${presence} · 최근 사용 ${used} · 총 ${key.useCount || 0}회`;
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
      const memoEditor = document.createElement('form');
      memoEditor.className = 'keyMemoEditor hidden';
      const memoInput = document.createElement('input');
      memoInput.className = 'keyMemoInput';
      memoInput.type = 'text';
      memoInput.maxLength = 200;
      memoInput.autocomplete = 'off';
      memoInput.placeholder = '누구인지 구분할 메모 (최대 200자)';
      memoInput.setAttribute('aria-label', `${key.label} 관리자 메모`);
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
        const note = memoInput.value.trim().replace(/\s+/g, ' ');
        if (note.length > 200) return showToast('메모는 200자까지 입력할 수 있습니다.');
        saveMemoBtn.disabled = true;
        try {
          const data = await api(`/api/admin/keys/${key.id}/note`, {
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
      detailBtn.addEventListener('click', () => {
        const opening = detail.classList.contains('hidden');
        detail.classList.toggle('hidden', !opening);
        detailBtn.textContent = opening ? '접기' : '자세히 보기';
      });

      row.append(main, actions, detail, memoEditor);
      guestKeyList.appendChild(row);
    }
    for (const key of revokedKeys) {
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
      const note = document.createElement('span');
      note.className = 'keyMemoPreview';
      note.textContent = key.adminNote ? '· ' + key.adminNote : '';
      note.title = key.adminNote || '';
      note.classList.toggle('hidden', !key.adminNote);
      identity.classList.toggle('withMemo', Boolean(key.adminNote));
      identity.append(strong, status, note);
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
  }

  function downloadEntryFile(data) {
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
    if (!confirm(`${label} 입장파일을 재발급할까요?\n기존 HTML 파일은 즉시 무효화되고, 현재 접속 중이라면 로그아웃됩니다.\n새 파일을 저장하고 사용자에게 전달해 주세요.`)) return;
    try {
      const data = await api(`/api/admin/keys/${id}/reissue`, { method: 'POST' });
      downloadEntryFile(data);
      showToast(`${data.fileName} 재발급 완료 · 기존 파일은 사용할 수 없습니다.`, 5000);
      await loadGuestKeys();
      loadPresence().catch(() => {});
    } catch (err) { showToast(err.message, 4500); }
  }

  async function renameKey(id, oldLabel) {
    const input = prompt(`${oldLabel}님의 새 닉네임을 입력해 주세요.\n변경 시 새 입장파일이 발급됩니다.`, oldLabel);
    if (input === null) return;
    const label = input.trim().replace(/\s+/g, ' ');
    if (!label || label.length > 40 || /[<>\r\n\t]/.test(label)) {
      return showToast('닉네임은 특수 기호 <, > 및 줄바꿈을 제외하고 1~40자로 입력해 주세요.', 4500);
    }
    if (label === oldLabel) return showToast('기존 닉네임과 같습니다. 파일만 바꾸려면 재발급을 이용해 주세요.');
    if (!confirm(`${oldLabel} → ${label}\n닉네임을 변경하고 새 입장파일을 발급할까요?\n기존 파일과 접속은 즉시 무효화됩니다. 새 파일을 반드시 저장해 전달해 주세요.`)) return;
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

  async function issueFile(event) {
    event.preventDefault();
    const label = guestLabelInput.value.trim();
    if (!label) return;
    try {
      const data = await api('/api/admin/keys', {
        method: 'POST',
        body: JSON.stringify({ label }),
      });
      downloadEntryFile(data);
      guestLabelInput.value = '';
      showToast(`${data.fileName} 발급 완료`);
      await loadGuestKeys();
    } catch (err) { showToast(err.message, 4500); }
  }

  async function revokeKey(id, label) {
    if (!confirm(`${label} 입장 파일의 권한을 취소할까요?\n취소 즉시 현재 접속도 끊기며 해당 파일은 더 이상 사용할 수 없습니다.`)) return;
    try {
      await api(`/api/admin/keys/${id}/revoke`, { method: 'POST', body: '{}' });
      showToast(`${label} 권한을 취소했습니다.`);
      await loadGuestKeys();
    } catch (err) { showToast(err.message); }
  }

  async function restoreKey(id, label) {
    if (!confirm(`${label} 입장 파일의 권한을 복구할까요?\n기존 HTML 입장 파일로 다시 접속할 수 있습니다.`)) return;
    try {
      await api(`/api/admin/keys/${id}/restore`, { method: 'POST', body: '{}' });
      showToast(`${label} 권한을 복구했습니다.`);
      await loadGuestKeys();
    } catch (err) { showToast(err.message); }
  }

  async function deleteKey(id, label) {
    if (!confirm(`${label} 입장 파일 기록을 영구 삭제할까요?\n이 작업은 되돌릴 수 없으며 기존 HTML 입장 파일도 더 이상 사용할 수 없습니다.`)) return;
    try {
      await api(`/api/admin/keys/${id}`, { method: 'DELETE' });
      showToast(`${label} 기록을 영구 삭제했습니다.`);
      await loadGuestKeys();
    } catch (err) { showToast(err.message); }
  }

  function enterLobby() {
    stopStream();
    state = null;
    document.title = '게임센터';
    showView('lobby');
    renderLobbyChat();
    loadAnnouncements().catch(err => showToast(err.message, 3500));
    loadPublicRooms().catch(err => showToast(err.message, 3500));
    startLobbyStream();
    startPresenceRefresh();
  }

  function enterRoomState(next) {
    stopPresenceRefresh();
    stopLobbyStream();
    state = next;
    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4'].includes(state?.gameType) ? state.gameType : 'omok';
    seat = state?.me?.seat || null;
    isHost = Boolean(state?.me?.isHost);
    showView('room');
    inviteTargetList.replaceChildren();
    renderRoom();
    startStream();
    if (isHost && state.game.status === 'selecting') loadInviteTargets().catch(() => {});
  }

  function stopStream() {
    if (streamController) streamController.abort();
    streamController = null;
    clearTimeout(streamRetryTimer);
    streamRetryTimer = null;
  }

  function stopLobbyStream() {
    if (lobbyStreamController) lobbyStreamController.abort();
    lobbyStreamController = null;
    clearTimeout(lobbyStreamRetryTimer);
    lobbyStreamRetryTimer = null;
  }

  async function startLobbyStream() {
    stopLobbyStream();
    if (!sessionToken || state) return;
    const controller = new AbortController();
    lobbyStreamController = controller;
    lobbyConnectionBadge.textContent = '연결 중';
    lobbyConnectionBadge.classList.remove('online');
    try {
      const res = await fetch('/api/lobby/events', {
        headers: { 'X-Session-Token': sessionToken, Accept: 'text/event-stream' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (res.status === 401) return expireSession();
      if (!res.ok || !res.body) throw new Error('대기방 실시간 연결 실패');
      lobbyConnectionBadge.textContent = '온라인';
      lobbyConnectionBadge.classList.add('online');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let split;
        while ((split = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, split).replace(/\r/g, '');
          buffer = buffer.slice(split + 2);
          handleLobbySseBlock(block);
        }
      }
      if (!controller.signal.aborted) throw new Error('대기방 실시간 연결 종료');
    } catch (err) {
      if (controller.signal.aborted || state) return;
      lobbyConnectionBadge.textContent = '재연결 중';
      lobbyConnectionBadge.classList.remove('online');
      lobbyStreamRetryTimer = setTimeout(() => startLobbyStream(), 1800);
    }
  }

  function handleLobbySseBlock(block) {
    if (!block || block.startsWith(':')) return;
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    let parsed;
    try { parsed = JSON.parse(data); } catch { return; }
    if (event === 'lobbyState') {
      lobbyState = parsed || { messages: [], connectedCount: 0, rooms: [], invitations: [] };
      renderLobbyChat();
      renderPublicRooms();
      renderLobbyInvitations();
    } else if (event === 'announcements') {
      announcements = Array.isArray(parsed.items) ? parsed.items : [];
      renderAnnouncements();
    } else if (event === 'sessionExpired') {
      expireSession(parsed.message);
    }
  }

  async function startStream() {
    stopStream();
    if (!sessionToken || !state) return;
    const controller = new AbortController();
    streamController = controller;
    connectionBadge.textContent = '연결 중';
    connectionBadge.classList.remove('online');
    try {
      const res = await fetch('/api/room/events', {
        headers: { 'X-Session-Token': sessionToken, Accept: 'text/event-stream' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (res.status === 401) return expireSession();
      if (!res.ok || !res.body) throw new Error('실시간 연결 실패');
      connectionBadge.textContent = '온라인';
      connectionBadge.classList.add('online');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let split;
        while ((split = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, split).replace(/\r/g, '');
          buffer = buffer.slice(split + 2);
          handleSseBlock(block);
        }
      }
      if (!controller.signal.aborted) throw new Error('실시간 연결 종료');
    } catch (err) {
      if (controller.signal.aborted) return;
      connectionBadge.textContent = '재연결 중';
      connectionBadge.classList.remove('online');
      streamRetryTimer = setTimeout(() => startStream(), 1800);
    }
  }

  function handleSseBlock(block) {
    if (!block || block.startsWith(':')) return;
    let event = 'message';
    let data = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data += line.slice(5).trim();
    }
    if (!data) return;
    let parsed;
    try { parsed = JSON.parse(data); } catch { return; }
    if (event === 'roomState') {
      state = parsed;
      seat = state.me?.seat || null;
      isHost = Boolean(state.me?.isHost);
      renderRoom();
    } else if (event === 'sessionExpired') {
      expireSession(parsed.message);
    }
  }

  function choiceKo(choice) {
    if (isTeamGame() && ['1','2','3','4'].includes(choice)) return `${seatColor(choice) === 'black' ? '흑' : '백'}팀 ${choice}번`;
    if (choice === 'black') return state?.gameType === 'baseball' ? '선공' : state?.gameType === 'connect4' ? '빨강' : (isTeamGame() ? '흑팀' : '흑');
    if (choice === 'white') return state?.gameType === 'baseball' ? '후공' : state?.gameType === 'connect4' ? '노랑' : (isTeamGame() ? '백팀' : '백');
    if (choice === 'spectator') return '관전';
    return '미선택';
  }

  function seatKo(value) {
    if (isTeamGame() && ['1','2','3','4'].includes(value)) return `${seatColor(value) === 'black' ? '흑' : '백'}팀 ${value}번`;
    if (value === 'black') return state?.gameType === 'baseball' ? '선공' : state?.gameType === 'connect4' ? '빨강' : (isTeamGame() ? '흑팀' : '흑');
    if (value === 'white') return state?.gameType === 'baseball' ? '후공' : state?.gameType === 'connect4' ? '노랑' : (isTeamGame() ? '백팀' : '백');
    return '관전';
  }

  function setPlayerCard(el, color, player) {
    el.querySelector('strong').textContent = seatKo(color);
    const small = el.querySelector('small');
    el.classList.toggle('occupied', Boolean(player));
    el.classList.toggle('disconnected', Boolean(player && !player.connected));
    if (!player) small.textContent = '선택 가능';
    else small.textContent = `${player.label || '게스트'} · ${player.connected ? '접속 중' : '연결 끊김'}`;
    el.classList.toggle('mySeat', seat === color);
  }

  function participantRoleText(p) {
    if (isTeamGame() && ['1','2','3','4'].includes(p.seat)) return seatKo(p.seat);
    if (p.seat === 'black') return seatKo('black');
    if (p.seat === 'white') return seatKo('white');
    if (p.choice === 'spectator') return '관전';
    return '역할 선택 중';
  }

  function renderParticipants() {
    participantList.innerHTML = '';
    const people = state?.participants || [];
    if (!people.length) {
      const empty = document.createElement('span');
      empty.className = 'participantEmpty';
      empty.textContent = '접속자가 없습니다.';
      participantList.appendChild(empty);
      return;
    }
    for (const person of people) {
      const chip = document.createElement('div');
      chip.className = 'participantChip';
      const dot = document.createElement('span');
      dot.className = `presenceDot${person.connected ? ' online' : ''}`;
      const name = document.createElement('strong');
      name.textContent = person.label || '게스트';
      const role = document.createElement('small');
      role.textContent = `${person.isHost ? '방장 · ' : ''}${participantRoleText(person)}`;
      chip.append(dot, name, role);
      participantList.appendChild(chip);
    }
  }

  function renderLobbyChat() {
    if (!lobbyChatMessages) return;
    const rows = lobbyState?.messages || [];
    lobbyConnectedCount.textContent = `대기 ${lobbyState?.connectedCount || 0}명`;
    lobbyChatMessages.innerHTML = '';
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'chatEmpty';
      empty.textContent = '아직 대기방 메시지가 없습니다.';
      lobbyChatMessages.appendChild(empty);
      return;
    }
    for (const row of rows) {
      const item = document.createElement('div');
      item.className = 'chatMessage';
      const head = document.createElement('div');
      head.className = 'chatMessageHead';
      const who = document.createElement('strong');
      who.textContent = row.label || '게스트';
      const time = document.createElement('time');
      const d = new Date(row.at);
      time.textContent = Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      head.append(who, time);
      const text = document.createElement('div');
      text.className = 'chatMessageText';
      text.textContent = row.text;
      item.append(head, text);
      lobbyChatMessages.appendChild(item);
    }
    lobbyChatMessages.scrollTop = lobbyChatMessages.scrollHeight;
  }

  function renderChat() {
    const rows = state?.chat?.messages || [];
    chatMessages.innerHTML = '';
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'chatEmpty';
      empty.textContent = '아직 메시지가 없습니다.';
      chatMessages.appendChild(empty);
      return;
    }
    for (const row of rows) {
      const item = document.createElement('div');
      item.className = `chatMessage ${row.type === 'system' ? 'system' : ''}`;
      if (row.type === 'system') {
        item.textContent = row.text;
      } else {
        const head = document.createElement('div');
        head.className = 'chatMessageHead';
        const who = document.createElement('strong');
        who.textContent = row.label || '게스트';
        const time = document.createElement('time');
        const d = new Date(row.at);
        time.textContent = Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        head.append(who, time);
        const text = document.createElement('div');
        text.className = 'chatMessageText';
        text.textContent = row.text;
        item.append(head, text);
      }
      chatMessages.appendChild(item);
    }
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function renderTeamPlayers() {
    teamPlayers.replaceChildren();
    for (const number of ['1','2','3','4']) {
      const player = state.players[number];
      const card = document.createElement('div');
      const color = seatColor(number);
      card.className = `teamPlayer ${color}${seat === number ? ' mySeat' : ''}${state.game.nextSeat === number && state.game.status === 'playing' ? ' myTurn' : ''}${player && !player.connected ? ' disconnected' : ''}`;
      const title = document.createElement('strong');
      title.textContent = `${number}번 · ${color === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;
      const name = document.createElement('small');
      name.textContent = player ? `${player.label} · ${player.connected ? '접속 중' : '연결 끊김'}` : '자리 선택 가능';
      card.append(title, name);
      teamPlayers.appendChild(card);
    }
  }

  function renderRoleChooser() {
    const g = state.game;
    const choice = state.me?.choice;
    const selecting = g.status === 'selecting';
    const baseball = state.gameType === 'baseball';
    const connect4 = state.gameType === 'connect4';
    const team = isTeamGame();
    roleChooser.classList.toggle('connectFourRole', connect4);
    standardRoleButtons.classList.toggle('hidden', team);
    teamRoleButtons.classList.toggle('hidden', !team);
    roleChooser.classList.toggle('hidden', !selecting);
    if (team) {
      roleChooser.querySelector('small').textContent = '1·3번은 흑팀, 2·4번은 백팀입니다. 네 명이 모두 자리를 정하면 1→2→3→4 순서로 시작합니다.';
      for (const button of teamSeatButtons) {
        const number = button.dataset.teamSeat;
        button.disabled = Boolean(state.players[number] && seat !== number);
        button.classList.toggle('selected', choice === number);
      }
      teamSpectatorBtn.classList.toggle('selected', choice === 'spectator');
      return;
    }
    chooseBlackBtn.lastChild.nodeValue = baseball ? '선공 선택' : connect4 ? '빨강 선택' : '흑 선택';
    chooseWhiteBtn.lastChild.nodeValue = baseball ? '후공 선택' : connect4 ? '노랑 선택' : '백 선택';
    roleChooser.querySelector('small').textContent = baseball
      ? '선공·후공이 정해지면 각자 비밀 숫자를 설정합니다. 나머지 참가자는 자동 관전됩니다.'
      : connect4 ? '빨강·노랑 선수를 선택하세요. 두 사람이 정해지면 게임이 시작됩니다. 열을 눌러 돌을 떨어뜨리세요.'
      : '매 판 새로 선택합니다. 흑·백이 모두 정해지면 나머지 참가자는 자동 관전됩니다.';
    roleChooser.classList.toggle('hidden', !selecting);
    chooseBlackBtn.disabled = Boolean(state.players.black && seat !== 'black');
    chooseWhiteBtn.disabled = Boolean(state.players.white && seat !== 'white');
    chooseBlackBtn.classList.toggle('selected', choice === 'black');
    chooseWhiteBtn.classList.toggle('selected', choice === 'white');
    chooseSpectatorBtn.classList.toggle('selected', choice === 'spectator');
  }

  function renderRoom() {
    if (!state) return;
    const g = state.game;
    seat = state.me?.seat || null;
    isHost = Boolean(state.me?.isHost);
    roomIdentityLabel.textContent = identityText();
    roomGameLogo.textContent = state.gameName || gameName(state.gameType);
    rulesText.textContent = state.rules || '';
    document.title = `${state.gameName || gameName(state.gameType)} · 게임센터`;
    newRoomBtn.classList.toggle('hidden', !isHost);
    hostRoomCodeBox.classList.toggle('hidden', !isHost);
    hostRoomCode.textContent = state.me?.roomCode || '----';
    roomCodeHelp.textContent = state.visibility === 'public'
      ? '이 방은 공개방 목록에서도 비밀번호 없이 입장할 수 있습니다.'
      : '비공개방은 비밀번호 또는 직접 받은 초대로만 입장할 수 있습니다.';
    roomInvitePanel.classList.toggle('hidden', !(isHost && g.status === 'selecting'));
    const team = isTeamGame();
    standardPlayers.classList.toggle('hidden', team);
    standardPlayers.classList.toggle('connectFourPlayers', state.gameType === 'connect4');
    teamPlayers.classList.toggle('hidden', !team);

    roundNumber.textContent = `${g.round || 1}판`;
    moveCountLabel.textContent = state.gameType === 'baseball' ? '추측 횟수' : '착수 수';
    moveCount.textContent = String(g.moveCount || 0);
    mySeat.textContent = seat ? seatKo(seat) : choiceKo(state.me?.choice);
    connectedCount.textContent = `${state.connectedCount || 0}명`;
    spectatorCount.textContent = `${state.spectatorCount || 0}명`;
    const scores = g.scores;
    gameScoreRow.classList.toggle('hidden', !scores);
    gameScoreText.textContent = scores ? `흑 ${scores.black} · 백 ${scores.white}` : '-';
    seatLabel.textContent = isHost ? `방장 · ${seat ? `${seatKo(seat)} 플레이어` : choiceKo(state.me?.choice)}` : `참가자 · ${seat ? `${seatKo(seat)} 플레이어` : choiceKo(state.me?.choice)}`;

    if (g.status === 'selecting') statusText.textContent = team ? '4명 자리 선택 중' : '역할 선택 중';
    else if (g.status === 'setup') statusText.textContent = '비밀 숫자 설정 중';
    else if (g.status === 'playing') {
      statusText.textContent = team ? (g.paused
        ? `일시정지 · ${g.disconnectedSeats.map(n => n + '번').join(', ')} 복귀 대기`
        : `${seatKo(g.nextSeat)} · ${state.players[g.nextSeat]?.label || '플레이어'}님 차례`)
        : `${seatKo(g.turn)} 차례${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스` : ''}`;
    } else if (g.status === 'finished') statusText.textContent = `${seatKo(g.winner)} 승리`;
    else statusText.textContent = '무승부';

    if (team) renderTeamPlayers();
    else {
      setPlayerCard(blackPlayer, 'black', state.players.black);
      setPlayerCard(whitePlayer, 'white', state.players.white);
    }
    renderParticipants();
    renderChat();
    renderRoleChooser();

    const finished = ['finished', 'draw'].includes(g.status);
    const canAct = Boolean(seat);
    const canResign = canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));
    const canEndPaused = team && isHost && g.status === 'playing' && g.paused;
    for (const b of [endGameBtn, sideEndGameBtn]) {
      b.classList.toggle('hidden', !canEndPaused);
      b.disabled = !canEndPaused;
    }
    for (const b of [resignBtn, sideResignBtn]) {
      b.classList.toggle('hidden', !canResign);
      b.disabled = !canResign;
    }
    for (const b of [nextRoundBtn, sideNextRoundBtn]) {
      b.classList.toggle('hidden', !finished);
      b.disabled = !finished;
      b.textContent = '다음 판 준비';
    }

    const baseball = state.gameType === 'baseball';
    canvasWrap.classList.toggle('hidden', baseball);
    canvasWrap.classList.toggle('connectFour', state.gameType === 'connect4');
    baseballPanel.classList.toggle('hidden', !baseball);
    if (baseball) {
      boardOverlay.classList.add('hidden');
      renderBaseball();
    } else if (g.status === 'selecting') {
      const choice = state.me?.choice;
      if (!choice) boardOverlay.textContent = team ? '1 · 2 · 3 · 4번 또는 관전을 선택하세요' : state.gameType === 'connect4' ? '빨강 · 노랑 · 관전 중 역할을 선택하세요' : '흑 · 백 · 관전 중 역할을 선택하세요';
      else if (choice === 'spectator') boardOverlay.textContent = '관전자로 대기 중입니다';
      else boardOverlay.textContent = `${choiceKo(choice)} 선택 완료 · 다른 플레이어를 기다리는 중`;
      boardOverlay.classList.remove('hidden');
    } else if (team && g.status === 'playing' && g.paused) {
      boardOverlay.textContent = `일시정지 · ${g.disconnectedSeats.map(n => n + '번').join(', ')} 플레이어를 기다리는 중`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'finished') {
      boardOverlay.textContent = seat ? ((team ? seatColor(seat) : seat) === g.winner ? '우리 팀 승리!' : (team ? '우리 팀 패배' : '패배')) : `${seatKo(g.winner)} 승리`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'draw') {
      boardOverlay.textContent = '무승부';
      boardOverlay.classList.remove('hidden');
    } else boardOverlay.classList.add('hidden');

    drawBoard();
  }

  function renderBaseball() {
    const g = state.game;
    const ready = g.ready || {};
    baseballReady.textContent = `비밀 숫자 준비: 선공 ${ready.black ? '완료' : '대기'} · 후공 ${ready.white ? '완료' : '대기'}`;
    baseballMySecret.textContent = seat
      ? (state.me?.mySecret ? `내 비밀 숫자: ${state.me.mySecret}` : '내 비밀 숫자: 미설정')
      : '관전 중 · 비밀 숫자는 각 플레이어에게만 보입니다.';
    const myReady = Boolean(seat && ready[seat]);
    baseballSecretForm.classList.toggle('hidden', !(g.status === 'setup' && seat && !myReady));
    baseballGuessForm.classList.toggle('hidden', !(g.status === 'playing' && seat && g.turn === seat));
    if (g.status === 'selecting') baseballHint.textContent = '선공·후공을 선택하면 각자 비밀 숫자를 설정할 수 있습니다.';
    else if (g.status === 'setup') baseballHint.textContent = !seat ? '플레이어들의 비밀 숫자 준비를 기다리는 중입니다.' : (myReady ? '비밀 숫자 설정 완료. 상대방이 준비할 때까지 기다려 주세요.' : '상대에게 보이지 않을 비밀 숫자 3개를 입력해 주세요.');
    else if (g.status === 'playing') baseballHint.textContent = seat === g.turn ? '내 차례입니다! 상대의 숫자를 추측해 주세요.' : `${seatKo(g.turn)}이(가) 추측할 차례입니다.`;
    else baseballHint.textContent = g.winner ? `${seatKo(g.winner)} 승리! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.` : '이번 판이 끝났습니다.';
    baseballHistory.replaceChildren();
    const guesses = g.guesses || [];
    if (!guesses.length) {
      const empty = document.createElement('p');
      empty.className = 'chatEmpty';
      empty.textContent = '아직 추측 기록이 없습니다.';
      baseballHistory.appendChild(empty);
    }
    for (const [i, entry] of [...guesses].reverse().entries()) {
      const item = document.createElement('div');
      item.className = 'baseballHistoryRow' + (entry.color === seat ? ' mine' : '');
      const left = document.createElement('span');
      left.textContent = `#${guesses.length - i} ${seatKo(entry.color)} · `;
      const digits = document.createElement('strong');
      digits.textContent = entry.guess;
      left.appendChild(digits);
      const result = document.createElement('span');
      result.className = 'result';
      result.textContent = entry.strikes === 0 && entry.balls === 0 ? '아웃' : `${entry.strikes}S ${entry.balls}B`;
      item.append(left, result);
      baseballHistory.appendChild(item);
    }
  }

  function drawBoard() {
    if (state?.gameType === 'baseball') return;
    if (state?.gameType === 'connect4') return drawConnect4Board();
    if (state?.gameType === 'othello') return drawOthelloBoard();
    return drawOmokBoard();
  }

  // Connect Four uses a 7x6 gravity board, independent of the Omok and Othello geometry.
  function connect4Layout() {
    const cell = (canvas.width - 40) / 7;
    return { cell, left: (canvas.width - cell * 7) / 2, top: 103 };
  }

  function drawConnect4Board() {
    const w = canvas.width;
    const h = canvas.height;
    const { cell, left, top } = connect4Layout();
    const g = state.game;
    const surface = ctx.createLinearGradient(0, 0, w, h);
    surface.addColorStop(0, '#101d34');
    surface.addColorStop(1, '#071224');
    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, w, h);

    const boardGradient = ctx.createLinearGradient(left, top, left + 7 * cell, top + 6 * cell);
    boardGradient.addColorStop(0, '#3577ee');
    boardGradient.addColorStop(1, '#1742a0');
    ctx.fillStyle = boardGradient;
    ctx.fillRect(left, top, cell * 7, cell * 6);
    ctx.strokeStyle = '#80aaff';
    ctx.lineWidth = 3;
    ctx.strokeRect(left + 1.5, top + 1.5, cell * 7 - 3, cell * 6 - 3);

    const winners = new Set((g.winningLine || []).map(([x, y]) => `${x},${y}`));
    const last = g.lastMove;
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 7; x++) {
        const cx = left + (x + .5) * cell;
        const cy = top + (y + .5) * cell;
        const radius = cell * .40;
        const color = g.board[y][x];
        ctx.save();
        ctx.fillStyle = '#0b1c38';
        ctx.beginPath(); ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2); ctx.fill();
        if (color) {
          ctx.shadowColor = 'rgba(0,0,0,.36)';
          ctx.shadowBlur = 7;
          ctx.shadowOffsetY = 3;
          const disc = ctx.createRadialGradient(cx - radius * .35, cy - radius * .36, 2, cx, cy, radius);
          if (color === 'black') {
            disc.addColorStop(0, '#ffa1ab');
            disc.addColorStop(.45, '#f43f5e');
            disc.addColorStop(1, '#9f1239');
          } else {
            disc.addColorStop(0, '#fff5b0');
            disc.addColorStop(.48, '#facc15');
            disc.addColorStop(1, '#ca8a04');
          }
          ctx.fillStyle = disc;
          ctx.beginPath(); ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          if (winners.has(`${x},${y}`)) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(cx, cy, radius * .77, 0, Math.PI * 2); ctx.stroke();
          } else if (last?.x === x && last?.y === y) {
            ctx.fillStyle = color === 'black' ? '#ffffff' : '#6b3e03';
            ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('열을 눌러 돌을 떨어뜨리세요', w / 2, 25);
    for (let x = 0; x < 7; x++) {
      const cx = left + (x + .5) * cell;
      ctx.fillStyle = '#9eb8e8';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(String(x + 1), cx, top - 16);
    }
    if (hover && canPlace(hover.x, hover.y)) {
      const x = hover.x;
      const cx = left + (x + .5) * cell;
      let landing = 5;
      while (landing >= 0 && g.board[landing][x]) landing--;
      ctx.save();
      ctx.fillStyle = seat === 'black' ? 'rgba(244,63,94,.75)' : 'rgba(250,204,21,.78)';
      ctx.beginPath(); ctx.arc(cx, top - 55, cell * .25, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(left + x * cell + 3, top + 3, cell - 6, 6 * cell - 6);
      if (landing >= 0) {
        ctx.globalAlpha = .34;
        ctx.beginPath(); ctx.arc(cx, top + (landing + .5) * cell, cell * .37, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawOmokBoard() {
    const w = canvas.width;
    const h = canvas.height;
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, '#e6c17d');
    gradient.addColorStop(.5, '#d6ab5d');
    gradient.addColorStop(1, '#c79749');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.globalAlpha = .08;
    ctx.strokeStyle = '#6b4b21';
    for (let y = 16; y < h; y += 29) {
      ctx.beginPath();
      ctx.moveTo(0, y + Math.sin(y) * 4);
      ctx.bezierCurveTo(w * .3, y - 6, w * .65, y + 8, w, y - 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = '#5e4527';
    ctx.lineWidth = 1.55;
    for (let i = 0; i < SIZE; i++) {
      const p = PAD + i * GRID;
      ctx.beginPath();
      ctx.moveTo(PAD, p);
      ctx.lineTo(w - PAD, p);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p, PAD);
      ctx.lineTo(p, h - PAD);
      ctx.stroke();
    }

    ctx.fillStyle = '#51391d';
    for (const [x, y] of [[3,3],[11,3],[7,7],[3,11],[11,11]]) {
      ctx.beginPath();
      ctx.arc(PAD + x * GRID, PAD + y * GRID, 5.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!state) return;
    const winning = new Set((state.game.winningLine || []).map(([x, y]) => `${x},${y}`));
    const last = state.game.lastMove;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const color = state.game.board[y][x];
        if (color) drawStone(x, y, color, winning.has(`${x},${y}`), last?.x === x && last?.y === y);
      }
    }
    if (hover && canPlace(hover.x, hover.y)) drawGhost(hover.x, hover.y, seatColor(seat));
  }

  function drawOthelloDisc(x, y, color, last) {
    const cell = canvas.width / 8;
    const cx = (x + .5) * cell;
    const cy = (y + .5) * cell;
    const r = cell * .38;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.28)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    const gradient = ctx.createRadialGradient(cx-r*.3, cy-r*.35, r*.08, cx, cy, r);
    if (color === 'black') {
      gradient.addColorStop(0, '#505050');
      gradient.addColorStop(.45, '#181818');
      gradient.addColorStop(1, '#020202');
    } else {
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(.6, '#eeeeee');
      gradient.addColorStop(1, '#bfc5c9');
    }
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (last) {
      ctx.fillStyle = color === 'black' ? '#f8fafc' : '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawOthelloBoard() {
    const w = canvas.width;
    const cell = w / 8;
    ctx.fillStyle = '#18794e';
    ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = 'rgba(4,38,24,.85)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 8; i += 1) {
      const p = i * cell;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, w); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
    }

    const legal = new Set((state?.game?.legalMoves || []).map(({ x, y }) => `${x},${y}`));
    if (seat && state?.game?.status === 'playing' && state.game.turn === seat) {
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      for (const key of legal) {
        const [x, y] = key.split(',').map(Number);
        ctx.beginPath();
        ctx.arc((x + .5) * cell, (y + .5) * cell, cell * .1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const last = state?.game?.lastMove;
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const color = state?.game?.board?.[y]?.[x];
        if (color) drawOthelloDisc(x, y, color, last?.x === x && last?.y === y);
      }
    }

    if (hover && canPlace(hover.x, hover.y)) {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 4;
      ctx.strokeRect(hover.x * cell + 5, hover.y * cell + 5, cell - 10, cell - 10);
    }
  }

  function drawStone(x, y, color, winning, last) {
    const cx = PAD + x * GRID;
    const cy = PAD + y * GRID;
    const r = GRID * .42;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.28)';
    ctx.shadowBlur = 9;
    ctx.shadowOffsetY = 4;
    const g = ctx.createRadialGradient(cx-r*.35, cy-r*.38, r*.1, cx, cy, r);
    if (color === 'black') {
      g.addColorStop(0, '#5b5b5b');
      g.addColorStop(.38, '#252525');
      g.addColorStop(1, '#050505');
    } else {
      g.addColorStop(0, '#fff');
      g.addColorStop(.55, '#f2f2f2');
      g.addColorStop(1, '#c9c9c9');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (winning) {
      ctx.strokeStyle = color === 'black' ? '#ffd85a' : '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r * .72, 0, Math.PI * 2);
      ctx.stroke();
    } else if (last) {
      ctx.fillStyle = color === 'black' ? '#f8fafc' : '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, 5.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGhost(x, y, color) {
    const cx = PAD + x * GRID;
    const cy = PAD + y * GRID;
    ctx.save();
    ctx.globalAlpha = .32;
    ctx.fillStyle = color === 'black' ? '#111' : '#fff';
    ctx.strokeStyle = color === 'black' ? '#111' : '#aaa';
    ctx.beginPath();
    ctx.arc(cx, cy, GRID * .42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function canvasPoint(ev) {
    const rect = canvas.getBoundingClientRect();
    const px = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const py = (ev.clientY - rect.top) * (canvas.height / rect.height);
    if (state?.gameType === 'connect4') {
      const { cell, left, top } = connect4Layout();
      const x = Math.floor((px - left) / cell);
      if (x < 0 || x >= 7 || py < top - 74 || py >= top + 6 * cell) return null;
      return { x, y: 0 }; // Column-only input: the server computes the gravity landing row.
    }
    if (state?.gameType === 'othello') {
      const cell = canvas.width / 8;
      const x = Math.floor(px / cell);
      const y = Math.floor(py / cell);
      if (x < 0 || x >= 8 || y < 0 || y >= 8) return null;
      return { x, y };
    }
    const x = Math.round((px - PAD) / GRID);
    const y = Math.round((py - PAD) / GRID);
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return null;
    const cx = PAD + x * GRID;
    const cy = PAD + y * GRID;
    if (Math.hypot(px - cx, py - cy) > GRID * .52) return null;
    return { x, y };
  }

  function canPlace(x, y) {
    if (state?.gameType === 'baseball') return false;
    if (!state || !seat || state.game.status !== 'playing') return false;
    if (isTeamGame() ? (state.game.paused || state.game.nextSeat !== seat) : state.game.turn !== seat) return false;
    if (state.gameType === 'othello') {
      return (state.game.legalMoves || []).some((move) => move.x === x && move.y === y);
    }
    if (state.gameType === 'connect4') {
      return Number.isInteger(x) && x >= 0 && x < 7 && !state.game.board?.[0]?.[x]
        && (state.game.legalColumns || []).includes(x);
    }
    return Boolean(state.game.board?.[y] && !state.game.board[y][x]);
  }

  async function roomAction(action, payload = {}) {
    try {
      const data = await api(`/api/room/${action}`, { method: 'POST', body: JSON.stringify(payload) });
      if (data.state) {
        state = data.state;
        renderRoom();
      }
    } catch (err) { showToast(err.message, err.data?.forbidden ? 4300 : 2800); }
  }

  function validBaseballInput(value) {
    return /^[1-9][0-9]{2}$/.test(value) && new Set(value).size === 3;
  }

  async function sendBaseballAction(event, action, input, name) {
    event.preventDefault();
    const value = input.value.trim();
    if (!validBaseballInput(value)) return showToast('첫 자리가 0이 아닌 서로 다른 숫자 3개를 입력해 주세요.', 4000);
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const data = await api(`/api/room/${action}`, { method: 'POST', body: JSON.stringify({ [name]: value }) });
      if (data.state) { state = data.state; renderRoom(); }
      input.value = '';
    } catch (err) { showToast(err.message, 4000); }
    finally { button.disabled = false; }
  }

  async function sendLobbyChat(event) {
    event.preventDefault();
    const text = lobbyChatInput.value.trim();
    if (!text) return;
    lobbyChatInput.disabled = true;
    try {
      await api('/api/lobby/chat', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      lobbyChatInput.value = '';
    } catch (err) {
      showToast(err.message, 3500);
    } finally {
      lobbyChatInput.disabled = false;
      lobbyChatInput.focus();
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.disabled = true;
    try {
      await api('/api/room/chat', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      chatInput.value = '';
    } catch (err) {
      showToast(err.message, 3500);
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  }

  async function copyRoomCode() {
    const code = state?.me?.roomCode;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showToast('방 비밀번호를 복사했습니다.');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('방 비밀번호를 복사했습니다.');
    }
  }

  announcementTab.addEventListener('click', () => {
    const opening = announcementPanel.classList.contains('hidden');
    announcementPanel.classList.toggle('hidden', !opening);
    announcementTab.setAttribute('aria-expanded', String(opening));
  });
  announcementAddBtn.addEventListener('click', () => {
    if (announcementForm.classList.contains('hidden')) openAnnouncementEditor();
    else closeAnnouncementEditor();
  });
  announcementForm.addEventListener('submit', saveAnnouncement);
  announcementCancelBtn.addEventListener('click', closeAnnouncementEditor);
  document.addEventListener('toggle', (event) => {
    const details = event.target;
    if (!(details instanceof HTMLDetailsElement)) return;
    const summary = details.querySelector('summary');
    if (!summary) return;
    if (details.matches('.helpDisclosure,.gameRuleDetails,.announcementDetails')) {
      summary.textContent = details.open ? '접기' : '자세히 보기';
    } else if (details.matches('.roomRuleDetails')) {
      summary.textContent = details.open ? '게임 규칙 접기' : '게임 규칙 자세히 보기';
    }
  }, true);

  adminLoginForm.addEventListener('submit', adminLogin);
  logoutBtn.addEventListener('click', logout);
  roomLogoutBtn.addEventListener('click', logout);
  createRoomBtn.addEventListener('click', createRoom);
  newRoomBtn.addEventListener('click', createRoom);
  refreshPublicRoomsBtn.addEventListener('click', () => loadPublicRooms().catch(err => showToast(err.message, 3500)));
  refreshInviteTargetsBtn.addEventListener('click', () => loadInviteTargets().catch(err => showToast(err.message, 3500)));
  for (const button of gameChoiceButtons) button.addEventListener('click', () => selectGame(button.dataset.game));
  leaveRoomBtn.addEventListener('click', leaveRoom);
  joinRoomForm.addEventListener('submit', joinRoom);
  roomPasswordInput.addEventListener('input', formatCodeInput);
  issueFileForm.addEventListener('submit', issueFile);
  presenceRefreshBtn.addEventListener('click', loadPresence);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadPresence();
  });
  lobbyChatForm.addEventListener('submit', sendLobbyChat);
  chatForm.addEventListener('submit', sendChat);
  baseballSecretForm.addEventListener('submit', (event) => sendBaseballAction(event, 'set-secret', baseballSecretInput, 'secret'));
  baseballGuessForm.addEventListener('submit', (event) => sendBaseballAction(event, 'guess', baseballGuessInput, 'guess'));
  copyRoomCodeBtn.addEventListener('click', copyRoomCode);
  chooseBlackBtn.addEventListener('click', () => roomAction('choose-role', { choice: 'black' }));
  chooseWhiteBtn.addEventListener('click', () => roomAction('choose-role', { choice: 'white' }));
  chooseSpectatorBtn.addEventListener('click', () => roomAction('choose-role', { choice: 'spectator' }));
  for (const button of teamSeatButtons) button.addEventListener('click', () => roomAction('choose-role', { choice: button.dataset.teamSeat }));
  teamSpectatorBtn.addEventListener('click', () => roomAction('choose-role', { choice: 'spectator' }));
  endGameBtn.addEventListener('click', () => confirm('중단된 대국을 승패 없이 종료할까요?') && roomAction('end-game'));
  sideEndGameBtn.addEventListener('click', () => confirm('중단된 대국을 승패 없이 종료할까요?') && roomAction('end-game'));
  resignBtn.addEventListener('click', () => confirm('기권할까요?') && roomAction('resign'));
  sideResignBtn.addEventListener('click', () => confirm('기권할까요?') && roomAction('resign'));
  nextRoundBtn.addEventListener('click', () => roomAction('next-round'));
  sideNextRoundBtn.addEventListener('click', () => roomAction('next-round'));

  canvas.addEventListener('pointermove', (ev) => {
    hover = canvasPoint(ev);
    drawBoard();
  });
  canvas.addEventListener('pointerleave', () => { hover = null; drawBoard(); });
  canvas.addEventListener('pointerup', (ev) => {
    const p = canvasPoint(ev);
    if (!p || !canPlace(p.x, p.y)) return;
    roomAction('move', state?.gameType === 'connect4' ? { x: p.x } : p);
  });

  selectGame('omok');
  drawBoard();
  loadSession();
})();
