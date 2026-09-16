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
  const newRoomBtn = document.getElementById('newRoomBtn');
  const gameChoiceButtons = [...document.querySelectorAll('.gameChoice')];
  const selectedGameText = document.getElementById('selectedGameText');
  const roomGameLogo = document.getElementById('roomGameLogo');
  const leaveRoomBtn = document.getElementById('leaveRoomBtn');
  const joinRoomForm = document.getElementById('joinRoomForm');
  const roomPasswordInput = document.getElementById('roomPasswordInput');
  const adminPanel = document.getElementById('adminPanel');
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
  let lobbyState = { messages: [], connectedCount: 0 };
  let announcements = [];
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
    return type === 'baseball' ? '숫자야구' : (type === 'othello' ? '오셀로' : '오목');
  }

  function selectGame(type) {
    selectedGameType = ['othello', 'baseball'].includes(type) ? type : 'omok';
    for (const button of gameChoiceButtons) button.classList.toggle('selected', button.dataset.game === selectedGameType);
    selectedGameText.textContent = `${gameName(selectedGameType)} 방을 만듭니다.`;
  }

  async function createRoom() {
    try {
      const data = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ gameType: selectedGameType }) });
      enterRoomState(data.state);
      if (data.state?.me?.roomCode) showToast(`방 비밀번호 ${data.state.me.roomCode} 생성 완료`);
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
      const revokeBtn = document.createElement('button');
      revokeBtn.className = 'danger tiny compactAction';
      revokeBtn.textContent = '권한 취소';
      revokeBtn.addEventListener('click', () => revokeKey(key.id, key.label));
      actions.append(detailBtn, memoBtn, revokeBtn);

      const detail = document.createElement('div');
      detail.className = 'keyDetail hidden';
      const used = key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('ko-KR') : '사용 기록 없음';
      const presence = key.presence?.online ? (key.presence.inRoom ? '접속 중 · 방 참여 중' : '접속 중') : '오프라인';
      detail.textContent = `상태 ${presence} · 최근 사용 ${used} · 총 ${key.useCount || 0}회`;
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

  async function issueFile(event) {
    event.preventDefault();
    const label = guestLabelInput.value.trim();
    if (!label) return;
    try {
      const data = await api('/api/admin/keys', {
        method: 'POST',
        body: JSON.stringify({ label }),
      });
      const blob = new Blob([data.html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
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
    startLobbyStream();
  }

  function enterRoomState(next) {
    stopLobbyStream();
    state = next;
    selectedGameType = ['othello', 'baseball'].includes(state?.gameType) ? state.gameType : 'omok';
    seat = state?.me?.seat || null;
    isHost = Boolean(state?.me?.isHost);
    showView('room');
    renderRoom();
    startStream();
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
      lobbyState = parsed || { messages: [], connectedCount: 0 };
      renderLobbyChat();
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
    if (choice === 'black') return state?.gameType === 'baseball' ? '선공' : '흑';
    if (choice === 'white') return state?.gameType === 'baseball' ? '후공' : '백';
    if (choice === 'spectator') return '관전';
    return '미선택';
  }

  function seatKo(value) {
    if (value === 'black') return state?.gameType === 'baseball' ? '선공' : '흑';
    if (value === 'white') return state?.gameType === 'baseball' ? '후공' : '백';
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

  function renderRoleChooser() {
    const g = state.game;
    const choice = state.me?.choice;
    const selecting = g.status === 'selecting';
    const baseball = state.gameType === 'baseball';
    chooseBlackBtn.lastChild.nodeValue = baseball ? '선공 선택' : '흑 선택';
    chooseWhiteBtn.lastChild.nodeValue = baseball ? '후공 선택' : '백 선택';
    roleChooser.querySelector('small').textContent = baseball
      ? '선공·후공이 정해지면 각자 비밀 숫자를 설정합니다. 나머지 참가자는 자동 관전됩니다.'
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

    if (g.status === 'selecting') statusText.textContent = '역할 선택 중';
    else if (g.status === 'setup') statusText.textContent = '비밀 숫자 설정 중';
    else if (g.status === 'playing') {
      statusText.textContent = `${seatKo(g.turn)} 차례${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스` : ''}`;
    } else if (g.status === 'finished') statusText.textContent = `${seatKo(g.winner)} 승리`;
    else statusText.textContent = '무승부';

    setPlayerCard(blackPlayer, 'black', state.players.black);
    setPlayerCard(whitePlayer, 'white', state.players.white);
    renderParticipants();
    renderChat();
    renderRoleChooser();

    const finished = ['finished', 'draw'].includes(g.status);
    const canAct = Boolean(seat);
    const canResign = canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));
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
    baseballPanel.classList.toggle('hidden', !baseball);
    if (baseball) {
      boardOverlay.classList.add('hidden');
      renderBaseball();
    } else if (g.status === 'selecting') {
      const choice = state.me?.choice;
      if (!choice) boardOverlay.textContent = '흑 · 백 · 관전 중 역할을 선택하세요';
      else if (choice === 'spectator') boardOverlay.textContent = '관전자로 대기 중입니다';
      else boardOverlay.textContent = `${choiceKo(choice)} 선택 완료 · 다른 플레이어를 기다리는 중`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'finished') {
      boardOverlay.textContent = seat ? (g.winner === seat ? '승리!' : '패배') : `${seatKo(g.winner)} 승리`;
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
    if (state?.gameType === 'othello') return drawOthelloBoard();
    return drawOmokBoard();
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
    if (hover && canPlace(hover.x, hover.y)) drawGhost(hover.x, hover.y, seat);
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
    if (!state || !seat || state.game.status !== 'playing' || state.game.turn !== seat) return false;
    if (state.gameType === 'othello') {
      return (state.game.legalMoves || []).some((move) => move.x === x && move.y === y);
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
  for (const button of gameChoiceButtons) button.addEventListener('click', () => selectGame(button.dataset.game));
  leaveRoomBtn.addEventListener('click', leaveRoom);
  joinRoomForm.addEventListener('submit', joinRoom);
  roomPasswordInput.addEventListener('input', formatCodeInput);
  issueFileForm.addEventListener('submit', issueFile);
  lobbyChatForm.addEventListener('submit', sendLobbyChat);
  chatForm.addEventListener('submit', sendChat);
  baseballSecretForm.addEventListener('submit', (event) => sendBaseballAction(event, 'set-secret', baseballSecretInput, 'secret'));
  baseballGuessForm.addEventListener('submit', (event) => sendBaseballAction(event, 'guess', baseballGuessInput, 'guess'));
  copyRoomCodeBtn.addEventListener('click', copyRoomCode);
  chooseBlackBtn.addEventListener('click', () => roomAction('choose-role', { choice: 'black' }));
  chooseWhiteBtn.addEventListener('click', () => roomAction('choose-role', { choice: 'white' }));
  chooseSpectatorBtn.addEventListener('click', () => roomAction('choose-role', { choice: 'spectator' }));
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
    roomAction('move', p);
  });

  selectGame('omok');
  drawBoard();
  loadSession();
})();
