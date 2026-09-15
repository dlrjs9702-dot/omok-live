(() => {
  const $ = (sel) => document.querySelector(sel);
  const homeView = $('#homeView');
  const roomView = $('#roomView');
  const createRoomBtn = $('#createRoomBtn');
  const newRoomBtn = $('#newRoomBtn');
  const shareBtn = $('#shareBtn');
  const copyBtn = $('#copyBtn');
  const resignBtn = $('#resignBtn');
  const sideResignBtn = $('#sideResignBtn');
  const rematchBtn = $('#rematchBtn');
  const sideRematchBtn = $('#sideRematchBtn');
  const statusText = $('#statusText');
  const seatLabel = $('#seatLabel');
  const connectionBadge = $('#connectionBadge');
  const blackPlayer = $('#blackPlayer');
  const whitePlayer = $('#whitePlayer');
  const roomCode = $('#roomCode');
  const moveCount = $('#moveCount');
  const mySeat = $('#mySeat');
  const roundNumber = $('#roundNumber');
  const connectedCount = $('#connectedCount');
  const spectatorCount = $('#spectatorCount');
  const boardOverlay = $('#boardOverlay');
  const hostTopActions = $('#hostTopActions');
  const hostInviteBox = $('#hostInviteBox');
  const roleChooser = $('#roleChooser');
  const chooseBlackBtn = $('#chooseBlackBtn');
  const chooseWhiteBtn = $('#chooseWhiteBtn');
  const chooseSpectatorBtn = $('#chooseSpectatorBtn');
  const toast = $('#toast');
  const canvas = $('#board');
  const ctx = canvas.getContext('2d');

  const SIZE = 15;
  const PAD = 48;
  const GRID = (canvas.width - PAD * 2) / (SIZE - 1);
  const pathMatch = location.pathname.match(/^\/room\/([A-Za-z0-9_-]{8,32})$/);
  const currentRoomId = pathMatch?.[1] || null;
  const clientId = getClientId();

  let socket = null;
  let state = null;
  let seat = null;
  let choice = null;
  let isHost = false;
  let hover = null;
  let toastTimer = null;

  function makeClientId() {
    return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`)
      .replace(/[^A-Za-z0-9_-]/g, '');
  }

  function validClientId(id) {
    return /^[A-Za-z0-9_-]{8,80}$/.test(String(id || ''));
  }

  function getClientId() {
    let id = localStorage.getItem('omok-client-id');
    if (!validClientId(id)) {
      id = makeClientId();
      localStorage.setItem('omok-client-id', id);
    }
    return id;
  }

  function showToast(message, duration = 2200) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), duration);
  }

  async function createRoom(triggerBtn = createRoomBtn) {
    if (triggerBtn) triggerBtn.disabled = true;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || '방을 만들지 못했습니다.');
      if (validClientId(data.clientId) && data.clientId !== clientId) {
        localStorage.setItem('omok-client-id', data.clientId);
      }
      location.href = data.path;
    } catch (err) {
      showToast(err.message || '방을 만들지 못했습니다. 다시 시도해 주세요.');
      if (triggerBtn) triggerBtn.disabled = false;
    }
  }

  function seatKo(value) {
    if (value === 'black') return '흑';
    if (value === 'white') return '백';
    return '-';
  }

  function choiceKo(value) {
    if (value === 'black') return '흑';
    if (value === 'white') return '백';
    if (value === 'spectator') return '관전';
    return '선택 전';
  }

  function syncMe(payload) {
    if (!payload?.me) return;
    seat = payload.me.seat || null;
    choice = payload.me.choice || null;
    isHost = Boolean(payload.me.isHost);
  }

  function statusMessage() {
    if (!state) return '방에 연결하고 있습니다';
    const g = state.game;
    if (g.status === 'selecting') {
      if (!choice) return '흑 · 백 · 관전 중 역할을 선택하세요';
      if (choice === 'spectator') return '관전 선택 · 흑과 백을 기다리고 있습니다';
      return `${choiceKo(choice)} 선택 · 다른 역할 선택을 기다리고 있습니다`;
    }
    if (g.status === 'draw') return '무승부입니다';
    if (g.status === 'finished') {
      if (!seat) return `${seatKo(g.winner)} 승리 · 관전 종료`;
      return g.winner === seat ? '승리했습니다' : '패배했습니다';
    }
    if (!seat) return `관전 중 · ${seatKo(g.turn)} 차례입니다`;
    return g.turn === seat ? '내 차례입니다' : '상대 차례입니다';
  }

  function setPlayerCard(el, color, player) {
    const small = el.querySelector('small');
    const active = state?.game.status === 'playing' && state.game.turn === color;
    const mine = seat === color;
    el.classList.toggle('active', Boolean(active));
    el.classList.toggle('mine', Boolean(mine));
    if (!player) small.textContent = state?.game.status === 'selecting' ? '선택 가능' : '빈 자리';
    else if (mine) small.textContent = player.connected ? '내 역할 · 접속 중' : '내 역할 · 연결 끊김';
    else small.textContent = player.connected ? '플레이어 · 접속 중' : '플레이어 · 연결 끊김';
  }

  function renderRoleChooser() {
    const canChoose = state?.game.status === 'selecting';
    roleChooser.classList.toggle('hidden', !canChoose);
    if (!canChoose) return;

    const blackTakenByOther = Boolean(state.players.black) && seat !== 'black';
    const whiteTakenByOther = Boolean(state.players.white) && seat !== 'white';

    chooseBlackBtn.disabled = blackTakenByOther;
    chooseWhiteBtn.disabled = whiteTakenByOther;
    chooseSpectatorBtn.disabled = false;

    chooseBlackBtn.classList.toggle('selected', choice === 'black');
    chooseWhiteBtn.classList.toggle('selected', choice === 'white');
    chooseSpectatorBtn.classList.toggle('selected', choice === 'spectator');

    chooseBlackBtn.innerHTML = `<span class="stoneMini"></span>${choice === 'black' ? '흑 선택됨' : (blackTakenByOther ? '흑 마감' : '흑 선택')}`;
    chooseWhiteBtn.innerHTML = `<span class="stoneMini"></span>${choice === 'white' ? '백 선택됨' : (whiteTakenByOther ? '백 마감' : '백 선택')}`;
    chooseSpectatorBtn.innerHTML = `<span class="spectatorIcon">◎</span>${choice === 'spectator' ? '관전 선택됨' : '관전 선택'}`;
  }

  function renderUi() {
    if (!state) return;
    syncMe(state);
    const g = state.game;

    statusText.textContent = statusMessage();
    if (seat) seatLabel.textContent = `${isHost ? '방장 · ' : ''}나는 ${seatKo(seat)}입니다`;
    else if (choice === 'spectator' || g.status !== 'selecting') seatLabel.textContent = `${isHost ? '방장 · ' : ''}현재 관전 중`;
    else seatLabel.textContent = `${isHost ? '방장 · ' : ''}역할 선택 전`;

    roomCode.textContent = state.id;
    moveCount.textContent = String(g.moveCount);
    mySeat.textContent = seat ? seatKo(seat) : choiceKo(choice === 'spectator' ? 'spectator' : null);
    roundNumber.textContent = `${g.round}판`;
    connectedCount.textContent = `${state.connectedCount}명`;
    spectatorCount.textContent = `${state.spectatorCount}명`;

    hostTopActions.classList.toggle('hidden', !isHost);
    hostInviteBox.classList.toggle('hidden', !isHost);

    setPlayerCard(blackPlayer, 'black', state.players.black);
    setPlayerCard(whitePlayer, 'white', state.players.white);
    renderRoleChooser();

    const finished = ['finished', 'draw'].includes(g.status);
    const canAct = Boolean(seat);
    [resignBtn, sideResignBtn].forEach((b) => {
      b.classList.toggle('hidden', !canAct || g.status !== 'playing');
      b.disabled = !canAct || g.status !== 'playing';
    });
    [rematchBtn, sideRematchBtn].forEach((b) => {
      b.classList.toggle('hidden', !finished || !canAct);
      const requested = canAct && g.rematchRequests?.[seat];
      b.disabled = Boolean(requested);
      b.textContent = requested ? '상대 응답 대기 중' : '다음 대국 신청';
    });

    if (g.status === 'selecting') {
      if (!choice) boardOverlay.textContent = '흑 · 백 · 관전 중 역할을 선택하세요';
      else if (choice === 'spectator') boardOverlay.textContent = '관전자로 대기 중입니다';
      else boardOverlay.textContent = `${choiceKo(choice)} 선택 완료 · 다른 플레이어를 기다리는 중`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'finished') {
      boardOverlay.textContent = seat
        ? (g.winner === seat ? '승리!' : '패배')
        : `${seatKo(g.winner)} 승리`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'draw') {
      boardOverlay.textContent = '무승부';
      boardOverlay.classList.remove('hidden');
    } else {
      boardOverlay.classList.add('hidden');
    }

    drawBoard();
  }

  function drawBoard() {
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

    const stars = [[3,3],[11,3],[7,7],[3,11],[11,11]];
    ctx.fillStyle = '#51391d';
    for (const [x,y] of stars) {
      ctx.beginPath();
      ctx.arc(PAD + x * GRID, PAD + y * GRID, 5.4, 0, Math.PI * 2);
      ctx.fill();
    }

    if (!state) return;
    const winning = new Set((state.game.winningLine || []).map(([x,y]) => `${x},${y}`));
    const last = state.game.lastMove;

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const color = state.game.board[y][x];
        if (color) drawStone(x, y, color, winning.has(`${x},${y}`), last?.x === x && last?.y === y);
      }
    }

    if (hover && canPlace(hover.x, hover.y)) drawGhost(hover.x, hover.y, seat);
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
      g.addColorStop(0, '#ffffff');
      g.addColorStop(.55, '#f2f2f2');
      g.addColorStop(1, '#c9c9c9');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    if (winning) {
      ctx.strokeStyle = color === 'black' ? '#ffd85a' : '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r * .72, 0, Math.PI*2);
      ctx.stroke();
    } else if (last) {
      ctx.fillStyle = color === 'black' ? '#f8fafc' : '#ef4444';
      ctx.beginPath();
      ctx.arc(cx, cy, 5.2, 0, Math.PI*2);
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
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, GRID * .42, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function canvasPoint(ev) {
    const rect = canvas.getBoundingClientRect();
    const px = (ev.clientX - rect.left) * (canvas.width / rect.width);
    const py = (ev.clientY - rect.top) * (canvas.height / rect.height);
    const x = Math.round((px - PAD) / GRID);
    const y = Math.round((py - PAD) / GRID);
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return null;
    const cx = PAD + x * GRID;
    const cy = PAD + y * GRID;
    if (Math.hypot(px - cx, py - cy) > GRID * .52) return null;
    return { x, y };
  }

  function canPlace(x, y) {
    return state && seat && state.game.status === 'playing' && state.game.turn === seat && !state.game.board[y][x];
  }

  async function copyInvite() {
    if (!isHost) return;
    try {
      await navigator.clipboard.writeText(location.href);
      showToast('초대 링크를 복사했습니다');
    } catch {
      const ta = document.createElement('textarea');
      ta.value = location.href;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      showToast('초대 링크를 복사했습니다');
    }
  }

  async function shareInvite() {
    if (!isHost) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: '오목 한 판', text: '이 링크로 들어와서 오목 두자.', url: location.href });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    copyInvite();
  }

  function connect() {
    connectionBadge.textContent = '연결 중';
    connectionBadge.className = 'badge';
    const eventsUrl = `/api/rooms/${encodeURIComponent(currentRoomId)}/events?clientId=${encodeURIComponent(clientId)}`;
    const es = new EventSource(eventsUrl);
    socket = es;

    es.addEventListener('open', () => {
      connectionBadge.textContent = '실시간 연결';
      connectionBadge.className = 'badge live';
    });

    es.addEventListener('error', () => {
      connectionBadge.textContent = '재연결 중';
      connectionBadge.className = 'badge offline';
    });

    es.addEventListener('roomState', (ev) => {
      state = JSON.parse(ev.data);
      syncMe(state);
      renderUi();
    });
  }

  async function action(name, body = {}) {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(currentRoomId)}/${name}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId, ...body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.message || '처리하지 못했습니다.');
        err.code = data.error;
        err.forbidden = data.forbidden;
        throw err;
      }
      if (data.state) {
        state = data.state;
        syncMe(state);
        renderUi();
      }
      return data;
    } catch (err) {
      showToast(err.message || '처리하지 못했습니다.', err.code === 'FORBIDDEN_MOVE' ? 3000 : 2200);
      throw err;
    }
  }

  createRoomBtn?.addEventListener('click', () => createRoom(createRoomBtn));
  newRoomBtn?.addEventListener('click', () => {
    if (isHost) createRoom(newRoomBtn);
  });
  shareBtn?.addEventListener('click', shareInvite);
  copyBtn?.addEventListener('click', copyInvite);
  chooseBlackBtn?.addEventListener('click', () => action('choose-role', { choice: 'black' }).catch(() => {}));
  chooseWhiteBtn?.addEventListener('click', () => action('choose-role', { choice: 'white' }).catch(() => {}));
  chooseSpectatorBtn?.addEventListener('click', () => action('choose-role', { choice: 'spectator' }).catch(() => {}));

  [resignBtn, sideResignBtn].forEach((btn) => btn?.addEventListener('click', () => {
    if (!socket || !state || state.game.status !== 'playing' || !seat) return;
    if (confirm('정말 기권할까요?')) action('resign').catch(() => {});
  }));

  [rematchBtn, sideRematchBtn].forEach((btn) => btn?.addEventListener('click', () => action('rematch').catch(() => {})));

  canvas.addEventListener('pointermove', (ev) => {
    hover = canvasPoint(ev);
    drawBoard();
  });
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    drawBoard();
  });
  canvas.addEventListener('pointerdown', (ev) => {
    const p = canvasPoint(ev);
    if (!p || !canPlace(p.x, p.y)) return;
    action('move', p).catch(() => {});
  });

  if (!currentRoomId) {
    homeView.classList.remove('hidden');
    roomView.classList.add('hidden');
  } else {
    homeView.classList.add('hidden');
    roomView.classList.remove('hidden');
    roomCode.textContent = currentRoomId;
    drawBoard();
    connect();
  }
})();
