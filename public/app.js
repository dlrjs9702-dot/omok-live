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
  const logoutDialog = document.getElementById('logoutDialog');
  const logoutCancelBtn = document.getElementById('logoutCancelBtn');
  const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');
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
  const roomTitleInput = document.getElementById('roomTitleInput');
  const baseballDigitChoices = document.getElementById('baseballDigitChoices');
  const omokModeChoices = document.getElementById('omokModeChoices');
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
  const myRecordsName = document.getElementById('myRecordsName');
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
  const announcementTab = document.getElementById('announcementTab');
  const announcementPanel = document.getElementById('announcementPanel');
  const announcementCount = document.getElementById('announcementCount');
  const announcementList = document.getElementById('announcementList');
  const announcementAddBtn = document.getElementById('announcementAddBtn');
  const announcementForm = document.getElementById('announcementForm');
  const announcementFormTitle = document.getElementById('announcementFormTitle');
  const announcementTitle = document.getElementById('announcementTitle');
  const announcementBody = document.getElementById('announcementBody');
  const announcementPinned = document.getElementById('announcementPinned');
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
  const yutControls = document.getElementById('yutControls');
  const yutLastThrow = document.getElementById('yutLastThrow');
  const yutThrowBtn = document.getElementById('yutThrowBtn');
  const yutHint = document.getElementById('yutHint');
  const yutMoveChoices = document.getElementById('yutMoveChoices');
  const bingoPanel = document.getElementById('bingoPanel');
  const bingoTargetSelect = document.getElementById('bingoTargetSelect');
  const bingoStartBtn = document.getElementById('bingoStartBtn');
  const bingoStatus = document.getElementById('bingoStatus');
  const bingoSelectedNumbers = document.getElementById('bingoSelectedNumbers');
  const bingoLineSummary = document.getElementById('bingoLineSummary');
  const bingoBoard = document.getElementById('bingoBoard');
  const cityControls = document.getElementById('cityControls');
  const cityLastRoll = document.getElementById('cityLastRoll');
  const cityRollBtn = document.getElementById('cityRollBtn');
  const cityEvent = document.getElementById('cityEvent');
  const cityPropertyOffer = document.getElementById('cityPropertyOffer');
  const cityBuyBtn = document.getElementById('cityBuyBtn');
  const citySkipBtn = document.getElementById('citySkipBtn');
  const cityBuildRow = document.getElementById('cityBuildRow');
  const cityBuildOffer = document.getElementById('cityBuildOffer');
  const cityBuildBtn = document.getElementById('cityBuildBtn');
  const cityBuildSkipBtn = document.getElementById('cityBuildSkipBtn');
  const cityTurnSummary = document.getElementById('cityTurnSummary');
  const cityDieFirst = document.getElementById('cityDieFirst');
  const cityDieSecond = document.getElementById('cityDieSecond');
  const cityAssets = document.getElementById('cityAssets');
  const cityTileSelect = document.getElementById('cityTileSelect');
  const cityTileName = document.getElementById('cityTileName');
  const cityTilePrice = document.getElementById('cityTilePrice');
  const cityTileToll = document.getElementById('cityTileToll');
  const cityTileOwner = document.getElementById('cityTileOwner');
  const pictionaryPanel = document.getElementById('pictionaryPanel');
  const pictionaryStartBtn = document.getElementById('pictionaryStartBtn');
  const pictionaryDrawerLabel = document.getElementById('pictionaryDrawerLabel');
  const pictionaryTimer = document.getElementById('pictionaryTimer');
  const pictionaryWordBox = document.getElementById('pictionaryWordBox');
  const pictionaryWord = document.getElementById('pictionaryWord');
  const pictionaryRoundResult = document.getElementById('pictionaryRoundResult');
  const pictionaryDrawTools = document.getElementById('pictionaryDrawTools');
  const pictionaryColor = document.getElementById('pictionaryColor');
  const pictionaryWidth = document.getElementById('pictionaryWidth');
  const pictionaryEraserBtn = document.getElementById('pictionaryEraserBtn');
  const pictionaryClearBtn = document.getElementById('pictionaryClearBtn');
  const pictionaryCanvas = document.getElementById('pictionaryCanvas');
  const pictionaryCtx = pictionaryCanvas.getContext('2d');
  const pictionaryGuessForm = document.getElementById('pictionaryGuessForm');
  const pictionaryGuessInput = document.getElementById('pictionaryGuessInput');
  const pictionaryScoreboard = document.getElementById('pictionaryScoreboard');
  const oldmaidPanel = document.getElementById('oldmaidPanel');
  const oldmaidStartBtn = document.getElementById('oldmaidStartBtn');
  const oldmaidShuffleBtn = document.getElementById('oldmaidShuffleBtn');
  const oldmaidStatus = document.getElementById('oldmaidStatus');
  const oldmaidResult = document.getElementById('oldmaidResult');
  const oldmaidCounts = document.getElementById('oldmaidCounts');
  const oldmaidOpponents = document.getElementById('oldmaidOpponents');
  const oldmaidMyHand = document.getElementById('oldmaidMyHand');
  const oldmaidHistory = document.getElementById('oldmaidHistory');
  const liarPanel = document.getElementById('liarPanel');
  const liarRoundsSelect = document.getElementById('liarRoundsSelect');
  const liarStartBtn = document.getElementById('liarStartBtn');
  const liarRoleBox = document.getElementById('liarRoleBox');
  const liarPhaseLabel = document.getElementById('liarPhaseLabel');
  const liarSpeakerLabel = document.getElementById('liarSpeakerLabel');
  const liarTimer = document.getElementById('liarTimer');
  const liarHintLog = document.getElementById('liarHintLog');
  const liarHintForm = document.getElementById('liarHintForm');
  const liarHintInput = document.getElementById('liarHintInput');
  const liarVoteBox = document.getElementById('liarVoteBox');
  const liarGuessForm = document.getElementById('liarGuessForm');
  const liarGuessInput = document.getElementById('liarGuessInput');
  const liarResult = document.getElementById('liarResult');
  const liarScoreboard = document.getElementById('liarScoreboard');
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
  const resultEffect = document.getElementById('resultEffect');
  const resultParticles = document.getElementById('resultParticles');
  const resultIcon = document.getElementById('resultIcon');
  const resultTitle = document.getElementById('resultTitle');
  const resultMessage = document.getElementById('resultMessage');
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');

  const SIZE = 15;
  const PAD = 48;
  const GRID = (canvas.width - PAD * 2) / (SIZE - 1);

  let sessionToken = document.body.dataset.session || '';
  let sessionRole = document.body.dataset.role || '';
  let sessionLabel = document.body.dataset.label || '';
  let selectedGameType = 'omok';
  let citySelectedTileIndex = null;
  let cityLastRollKey = null;
  let cityAnimation = null;
  let cityAnimationFrame = null;
  let state = null;
  let seat = null;
  let isHost = false;
  let streamController = null;
  let streamRetryTimer = null;
  let lobbyStreamController = null;
  let lobbyStreamRetryTimer = null;
  let lobbyState = { messages: [], connectedCount: 0, rooms: [], invitations: [] };
  let announcements = [];
  let ownRecords = null;
  let viewedRecords = null;
  let presenceTimer = null;
  let presenceLoading = false;
  let editingAnnouncementId = null;
  let hover = null;
  let toastTimer = null;
  let resultEffectTimer = null;
  let lastResultEffectKey = null;

  if (sessionToken) history.replaceState(null, '', '/');

  function showToast(message, ms = 2800) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), ms);
  }

  const victoryMessages = [
    '완벽한 마무리! 오늘의 주인공은 당신입니다.',
    '멋진 승리입니다. 이 보드는 지금 당신 편이네요.',
    '상대가 재대결 버튼을 바라보고 있습니다.',
    '결정적인 한 수! 축포를 받아주세요.',
  ];
  const defeatMessages = [
    '한 수만 더 봤다면… 아, 상대는 봤네요.',
    '이번 판은 상대의 하이라이트가 되었습니다.',
    '보드는 이미 알고 있었습니다. 다음 판은 다르겠죠?',
    '상대가 방금 승리를 꽤 오래 자랑할 것 같네요.',
    '재대결 버튼이 유난히 잘 보이는 밤입니다.',
    '괜찮아요. 상대도 이렇게 잘 풀릴 줄은 몰랐을 거예요.',
  ];

  function resultCopy(outcome, game) {
    const list = outcome === 'win' ? victoryMessages : defeatMessages;
    const seed = Number(game.round || 1) * 17 + Number(game.moveCount || 0) * 7 + String(state?.gameType || '').length;
    return list[Math.abs(seed) % list.length];
  }

  function clearResultEffect() {
    clearTimeout(resultEffectTimer);
    resultEffect.classList.add('hidden');
    resultEffect.classList.remove('win', 'loss', 'playing');
    document.body.classList.remove('resultWinActive', 'resultLossActive');
  }

  function fillVictoryParticles() {
    const colors = ['#facc15', '#f97316', '#22d3ee', '#a78bfa', '#f472b6', '#ffffff'];
    resultParticles.replaceChildren();
    for (let i = 0; i < 42; i += 1) {
      const particle = document.createElement('i');
      particle.style.setProperty('--x', `${(i * 37) % 100}vw`);
      particle.style.setProperty('--delay', `${(i % 9) * 0.055}s`);
      particle.style.setProperty('--duration', `${1.8 + (i % 7) * 0.12}s`);
      particle.style.setProperty('--drift', `${((i % 11) - 5) * 8}px`);
      particle.style.setProperty('--spin', `${180 + (i % 6) * 90}deg`);
      particle.style.setProperty('--color', colors[i % colors.length]);
      resultParticles.appendChild(particle);
    }
  }

  function showResultEffect(outcome, game) {
    const win = outcome === 'win';
    clearTimeout(resultEffectTimer);
    resultEffect.classList.remove('hidden', 'win', 'loss', 'playing');
    resultEffect.classList.add(outcome);
    resultIcon.textContent = win ? '🏆' : '😏';
    resultTitle.textContent = win ? '화려한 승리!' : '이번 판은 패배…';
    resultMessage.textContent = resultCopy(outcome, game);
    resultParticles.replaceChildren();
    if (win) fillVictoryParticles();
    document.body.classList.toggle('resultWinActive', win);
    document.body.classList.toggle('resultLossActive', !win);
    // Re-run the entrance animation even if the previous round ended moments ago.
    void resultEffect.offsetWidth;
    resultEffect.classList.add('playing');
    resultEffectTimer = setTimeout(() => {
      resultEffect.classList.remove('playing');
      clearResultEffect();
    }, win ? 5000 : 4600);
  }

  function setResultBoardOverlay(outcome, game) {
    const win = outcome === 'win';
    const heading = document.createElement('strong');
    const detail = document.createElement('span');
    heading.textContent = win ? '🏆 승리!' : '패배';
    detail.textContent = resultCopy(outcome, game);
    boardOverlay.replaceChildren(heading, detail);
    boardOverlay.classList.remove('resultWin', 'resultLoss');
    boardOverlay.classList.add(win ? 'resultWin' : 'resultLoss');
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
    lastResultEffectKey = null;
    clearResultEffect();
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

  function requestLogout() {
    if (sessionToken && !logoutDialog.open) logoutDialog.showModal();
  }

  async function logout() {
    try { if (sessionToken) await api('/api/logout', { method: 'POST' }); } catch {}
    expireSession('나갔습니다. 게스트는 다시 입장하려면 전용 파일을 열어야 합니다.');
  }

  function gameName(type) {
    return type === 'omok2v2' ? '오목 2vs2' : type === 'baseball' ? '숫자야구'
      : type === 'connect4' ? '사목 (4목)' : type === 'yut' ? '윷놀이' : type === 'bingo' ? '빙고' : type === 'dots' ? '점과 상자' : type === 'cityking' ? '랜드킹' : type === 'pictionary' ? '그림 맞히기' : type === 'liar' ? '라이어게임' : type === 'oldmaid' ? '도둑잡기'
        : (type === 'othello' ? '오델로' : '오목');
  }

  function omokMode() {
    return document.querySelector('input[name="omokMode"]:checked')?.value === '2v2' ? '2v2' : '1v1';
  }
  function gameDisplayName(type) {
    return type === 'omok' ? '오목 · 1vs1' : type === 'omok2v2' ? '오목 · 2vs2' : gameName(type);
  }
  function isTeamGame() { return state?.gameType === 'omok2v2'; }
  function isBingoGame() { return state?.gameType === 'bingo'; }
  function isPictionaryGame() { return state?.gameType === 'pictionary'; }
  function isLiarGame() { return state?.gameType === 'liar'; }
  function isOldMaidGame() { return state?.gameType === 'oldmaid'; }
  function isNumberedSeatGame() { return isTeamGame() || isBingoGame() || isPictionaryGame() || isLiarGame() || isOldMaidGame(); }
  function numberedSeats() { return isOldMaidGame() ? ['1','2','3','4','5','6'] : (isPictionaryGame() || isLiarGame()) ? ['1','2','3','4','5','6','7','8'] : ['1','2','3','4']; }
  function seatColor(value) { return ['1','3'].includes(value) ? 'black' : ['2','4'].includes(value) ? 'white' : value; }
  // Winner is the same black/white color for most games; 2v2 seat numbers map to team colors.
  // Bingo uses numbered seats; pictionary's winner is an array of seats, so it never matches 'black'/'white'
  // below and falls through to null, which is correct since it has its own win display, not the shared effect.
  function resultOutcome(game, playerSeat, gameType) {
    if (game?.status !== 'finished' || !playerSeat || !game.winner) return null;
    if (gameType === 'bingo') return String(playerSeat) === String(game.winner) ? 'win' : 'loss';
    if (['liar', 'oldmaid'].includes(gameType) && Array.isArray(game.winner)) return game.winner.includes(String(playerSeat)) ? 'win' : 'loss';
    if (!['black', 'white'].includes(game.winner)) return null;
    const color = gameType === 'omok2v2' ? seatColor(playerSeat) : playerSeat;
    if (!['black', 'white'].includes(color)) return null;
    return color === game.winner ? 'win' : 'loss';
  }

  // Shared rules viewer: one disclosure and one selector for all eight games.
  const gameRulesSelect = document.getElementById('gameRulesSelect');
  const gameRulesText = document.getElementById('gameRulesText');
  const gameRules = Object.freeze({
    "omok": "15×15 바둑판에서 흑이 먼저 둡니다. 흑은 정확히 5목을 만들면 승리하며 3-3, 4-4, 6목 이상은 금수입니다. 백은 5목 이상이면 승리하며 금수가 없습니다.",
    "omok2v2": "4인 팀전! 흑팀 1번 → 백팀 2번 → 흑팀 3번 → 백팀 4번 순서로 반복합니다. 네 자리가 모두 정해지면 시작하며 기존 15×15 오목과 금수 규칙은 그대로입니다. 승리하면 같은 팀 두 명이 함께 승리합니다. 누군가 연결이 끊기면 복귀할 때까지 일시정지합니다.",
    "connect4": "7열×6행. 빨강이 먼저 시작하며 번갈아 열을 누르면 맨 아래 빈칸부터 돌이 쌓입니다. 같은 색 돌 4개를 가로·세로·대각선으로 먼저 연결하면 승리합니다. 가득 찬 열에는 둘 수 없고 판이 다 차면 무승부입니다.",
    "yut": "각자 말 4개를 모두 먼저 완주하면 승리합니다. 도·개·걸·윷·모만큼 움직이며, 윷·모가 나오거나 상대 말을 잡으면 한 번 더 던집니다. 같은 편 말끼리는 업어서 함께 이동하고 모서리에 정확히 멈추면 지름길을 이용합니다.",
    "bingo": "2~4명이 1~50 중 서로 다른 25개 숫자로 된 5×5 판을 받습니다. 자기 차례에 자신의 판에서 아직 선택되지 않은 숫자를 누르면 같은 숫자를 가진 모든 참가자의 판도 함께 체크됩니다. 방장이 시작 전에 1~12줄 중 승리 조건을 정하며 가로·세로·두 대각선을 합쳐 먼저 조건을 달성하면 승리합니다.",
    "dots": "5×5 점 사이에 번갈아 선을 하나씩 긋습니다. 네 변을 완성해 상자를 만든 사람이 그 상자를 차지하고 한 번 더 긋습니다. 모든 선을 그은 뒤 차지한 상자가 더 많은 사람이 승리합니다.",
    "cityking": "독자 규칙의 도시 보드게임입니다. 주사위를 굴려 도시를 매입하고 상대가 소유한 도시에는 통행료를 냅니다. 자기 소유 도시에 도착하면 매입가의 50%로 별장·빌딩·호텔을 방문당 한 단계 건설할 수 있습니다. 통행료는 기본·2배·3배·5배이며, 건설비는 순자산에 포함됩니다. 출발 보너스와 이벤트를 활용해 상대를 파산시키거나 50턴 뒤 순자산이 높은 쪽이 승리합니다.",
    "othello": "8×8 판에서 흑이 먼저 둡니다. 상대 돌을 양쪽에서 감싸면 가운데 돌을 내 색으로 뒤집습니다. 둘 곳이 없으면 자동 패스하며, 양쪽 모두 둘 수 없으면 종료되고 돌이 많은 쪽이 이깁니다.",
    "baseball": "방장이 방 생성 때 3자리 또는 4자리 숫자야구를 정합니다. 첫 자리는 0이 아니고 숫자는 서로 달라야 합니다. 숫자와 자리가 같으면 스트라이크, 숫자만 같으면 볼, 모두 다르면 아웃입니다. 선택한 자릿수만큼 스트라이크를 먼저 맞히면 승리합니다. 상대의 비밀 숫자는 보이지 않습니다.",
    "pictionary": "2~8명이 참여합니다. 라운드마다 한 명이 출제자가 되어 서버가 정한 제시어를 90초 동안 그림으로 표현하고 나머지는 정답을 맞힙니다. 정답자는 100점, 출제자는 정답자 1명당 50점을 얻습니다. 전원이 한 번씩 출제자를 맡으면 총점이 가장 높은 사람이 승리하며, 제시어는 출제자에게만 보입니다.",
    "liar": "3~8명이 참여합니다. 시민은 제시어를 알고 라이어 1명은 모릅니다. 전원이 순서대로 힌트를 두 번 말한 뒤 비밀 투표하며, 동률이면 후보만 추가 힌트 후 한 번 재투표합니다. 라이어가 지목되면 30초 안에 제시어를 맞힐 마지막 기회를 얻습니다.",
    "oldmaid": "2~6명이 53장(조커 1장 포함)을 나누고 같은 계급의 카드 두 장씩 자동으로 버립니다. 내 차례에는 다음 활성 참가자의 카드 뒷면 중 한 장을 선택해 뽑습니다. 자기 손패는 카드 섞기로 순서를 바꿀 수 있습니다. 짝이 생기면 자동으로 버리며 마지막 조커 보유자가 패배합니다."
});
  function showGameRule(type) {
    gameRulesText.textContent = gameRules[type] || '';
  }

  function selectGame(type) {
    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'bingo', 'dots', 'cityking', 'pictionary', 'liar', 'oldmaid'].includes(type) ? type : 'omok';
    for (const button of gameChoiceButtons) button.classList.toggle('selected', button.dataset.game === selectedGameType);
    const resolvedType = selectedGameType === 'omok' && omokMode() === '2v2' ? 'omok2v2' : selectedGameType;
    selectedGameText.textContent = `${gameDisplayName(resolvedType)} 방을 만듭니다.`;
    omokModeChoices.classList.toggle('hidden', selectedGameType !== 'omok');
    baseballDigitChoices.classList.toggle('hidden', selectedGameType !== 'baseball');
    gameRulesSelect.value = resolvedType;
    showGameRule(resolvedType);
  }

  async function createRoom() {
    try {
      const visibility = document.querySelector('input[name="roomVisibility"]:checked')?.value || 'private';
      const digitCount = Number(document.querySelector('input[name="baseballDigitCount"]:checked')?.value || 3);
      const data = await api('/api/rooms', { method: 'POST', body: JSON.stringify({
        gameType: selectedGameType === 'omok' && omokMode() === '2v2' ? 'omok2v2' : selectedGameType,
        visibility,
        title: roomTitleInput.value,
        ...(selectedGameType === 'baseball' ? { digitCount } : {}),
      }) });
      roomTitleInput.value = '';
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
      const displayedGame = gameDisplayName(room.gameType);
      name.textContent = room.title || `${room.host || '방장'}의 ${displayedGame}방`;
      const info = document.createElement('small');
      const status = room.status === 'waiting' ? '상대 모집 중' : room.status === 'finished' ? '대국 종료' : room.status === 'paused' ? '일시정지' : '대국 중';
      info.textContent = `${displayedGame} · ${status} · 선수 ${room.playerCount || 0}/${room.maxPlayers || 2} · 접속 ${room.connectedCount || 0}명`;
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
    announcementPinned.checked = false;
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
    announcementPinned.checked = item?.pinned === true;
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
      if (item.pinned) row.classList.add('isPinned');
      const head = document.createElement('div');
      head.className = 'announcementHead';
      const title = document.createElement('strong');
      title.textContent = item.title;
      title.title = item.title;
      if (item.pinned) {
        const pin = document.createElement('span');
        pin.className = 'announcementPin';
        pin.textContent = '고정';
        pin.setAttribute('aria-label', '상단 고정 공지');
        title.prepend(pin);
      }
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
        body: JSON.stringify({ title, body, pinned: announcementPinned.checked }),
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

  function recordLine(data) {
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

  function enterLobby() {
    stopStream();
    state = null;
    lastResultEffectKey = null;
    clearResultEffect();
    document.title = '게임센터';
    showView('lobby');
    renderLobbyChat();
    loadAnnouncements().catch(err => showToast(err.message, 3500));
    loadMyRecords();
    loadPublicRooms().catch(err => showToast(err.message, 3500));
    startLobbyStream();
    startPresenceRefresh();
  }

  function enterRoomState(next) {
    stopPresenceRefresh();
    stopLobbyStream();
    state = next;
    lastResultEffectKey = null;
    clearResultEffect();
    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'bingo', 'dots', 'cityking', 'pictionary', 'liar'].includes(state?.gameType) ? state.gameType : 'omok';
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
    if ((isBingoGame() || isPictionaryGame() || isLiarGame() || isOldMaidGame()) && numberedSeats().includes(choice)) return `${choice}번`;
    if (isTeamGame() && ['1','2','3','4'].includes(choice)) return `${seatColor(choice) === 'black' ? '흑' : '백'}팀 ${choice}번`;
    if (choice === 'black') return state?.gameType === 'baseball' ? '선공' : state?.gameType === 'connect4' ? '빨강' : ['yut','dots','cityking'].includes(state?.gameType) ? '파랑' : (isTeamGame() ? '흑팀' : '흑');
    if (choice === 'white') return state?.gameType === 'baseball' ? '후공' : state?.gameType === 'connect4' ? '노랑' : ['yut','dots','cityking'].includes(state?.gameType) ? '빨강' : (isTeamGame() ? '백팀' : '백');
    if (choice === 'spectator') return '관전';
    return '미선택';
  }

  function seatKo(value) {
    if ((isBingoGame() || isPictionaryGame() || isLiarGame() || isOldMaidGame()) && numberedSeats().includes(value)) return `${value}번`;
    if (isTeamGame() && ['1','2','3','4'].includes(value)) return `${seatColor(value) === 'black' ? '흑' : '백'}팀 ${value}번`;
    if (value === 'black') return state?.gameType === 'baseball' ? '선공' : state?.gameType === 'connect4' ? '빨강' : ['yut','dots','cityking'].includes(state?.gameType) ? '파랑' : (isTeamGame() ? '흑팀' : '흑');
    if (value === 'white') return state?.gameType === 'baseball' ? '후공' : state?.gameType === 'connect4' ? '노랑' : ['yut','dots','cityking'].includes(state?.gameType) ? '빨강' : (isTeamGame() ? '백팀' : '백');
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
    if (isNumberedSeatGame() && numberedSeats().includes(p.seat)) return seatKo(p.seat);
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
      const nameButton = document.createElement('button');
      nameButton.type = 'button'; nameButton.className = 'participantRecordName';
      nameButton.textContent = person.label || '게스트';
      nameButton.title = '닉네임을 눌러 전적 조회';
      nameButton.disabled = !person.playerId;
      if (person.playerId) nameButton.addEventListener('click', () => openPlayerRecords(person.playerId));
      name.appendChild(nameButton);
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
    const bingo = isBingoGame();
    const pictionary = isPictionaryGame();
    const liar = isLiarGame();
    const oldmaid = isOldMaidGame();
    for (const number of numberedSeats()) {
      const player = state.players[number];
      const card = document.createElement('div');
      const color = seatColor(number);
      const currentTurn = pictionary ? state.game.drawerSeat === number : liar ? state.game.currentSpeaker === number : oldmaid ? state.game.turn === number : bingo ? state.game.turn === number : state.game.nextSeat === number;
      card.className = `teamPlayer ${(bingo || pictionary || liar || oldmaid) ? 'bingoSeat' : color}${seat === number ? ' mySeat' : ''}${currentTurn && state.game.status === 'playing' ? ' myTurn' : ''}${player && !player.connected ? ' disconnected' : ''}`;
      const title = document.createElement('strong');
      title.textContent = pictionary
        ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 출제자' : ''}`
        : liar ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 발언 차례' : ''}`
        : oldmaid ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 뽑기 차례' : ''}`
        : bingo ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 현재 턴' : ''}` : `${number}번 · ${color === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;
      const name = document.createElement('small');
      name.textContent = player
        ? `${player.label}${oldmaid ? ` · ${state.game.counts?.[number] ?? 0}장` : (pictionary || liar) ? ` · ${state.game.scores?.[number] || 0}점` : bingo ? ` · ${state.game.lineCounts?.[number] || 0}줄` : ''} · ${player.connected ? '접속 중' : '연결 끊김'}`
        : '자리 선택 가능';
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
    const yut = state.gameType === 'yut';
    const dots = state.gameType === 'dots';
    const city = state.gameType === 'cityking';
    const bingo = isBingoGame();
    const pictionary = isPictionaryGame();
    const liar = isLiarGame();
    const oldmaid = isOldMaidGame();
    const team = isTeamGame();
    const numbered = isNumberedSeatGame();
    const seats = numberedSeats();
    roleChooser.classList.toggle('connectFourRole', connect4);
    roleChooser.classList.toggle('blueRedRole', yut || dots || city);
    standardRoleButtons.classList.toggle('hidden', numbered);
    teamRoleButtons.classList.toggle('hidden', !numbered);
    roleChooser.classList.toggle('hidden', !selecting);
    if (numbered) {
      roleChooser.querySelector('small').textContent = pictionary
        ? '2~8명이 자리를 선택할 수 있습니다. 방장이 그림 맞히기를 시작합니다.'
        : liar ? '3~8명이 자리를 선택할 수 있습니다. 방장이 1판/3판을 정하고 시작합니다.'
        : oldmaid ? '2~6명이 자리를 선택할 수 있습니다. 방장이 시작하면 카드를 나누고 짝을 자동으로 버립니다.'
        : bingo
        ? '2~4명이 1~4번 자리를 선택할 수 있습니다. 방장이 승리 줄 수를 정하고 시작합니다.'
        : '1·3번은 흑팀, 2·4번은 백팀입니다. 네 명이 모두 자리를 정하면 1→2→3→4 순서로 시작합니다.';
      for (const button of teamSeatButtons) {
        const number = button.dataset.teamSeat;
        button.classList.toggle('hidden', !seats.includes(number));
        button.textContent = (bingo || pictionary || liar || oldmaid) ? `${number}번 자리` : `${number}번 · ${seatColor(number) === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;
        button.disabled = Boolean(state.players[number] && seat !== number);
        button.classList.toggle('selected', choice === number);
      }
      teamSpectatorBtn.classList.toggle('selected', choice === 'spectator');
      return;
    }
    chooseBlackBtn.lastChild.nodeValue = baseball ? '선공 선택' : connect4 ? '빨강 선택' : (yut || dots || city) ? '파랑 선택' : '흑 선택';
    chooseWhiteBtn.lastChild.nodeValue = baseball ? '후공 선택' : connect4 ? '노랑 선택' : (yut || dots || city) ? '빨강 선택' : '백 선택';
    roleChooser.querySelector('small').textContent = baseball
      ? '선공·후공이 정해지면 각자 비밀 숫자를 설정합니다. 나머지 참가자는 자동 관전됩니다.'
      : connect4 ? '빨강·노랑 선수를 선택하세요. 두 사람이 정해지면 게임이 시작됩니다. 열을 눌러 돌을 떨어뜨리세요.'
      : yut ? '파랑·빨강 선수를 선택하세요. 두 사람이 정해지면 파랑부터 윷을 던집니다.'
      : dots ? '파랑·빨강 선수를 선택하세요. 두 사람이 정해지면 파랑부터 빈 선을 선택합니다.'
      : city ? '파랑·빨강 선수를 선택하세요. 두 사람이 정해지면 파랑부터 주사위를 굴립니다.'
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
    const gameLabel = ['omok', 'omok2v2'].includes(state.gameType)
      ? gameDisplayName(state.gameType) : (state.gameName || gameName(state.gameType));
    const roomLabel = state.title || gameLabel;
    roomIdentityLabel.textContent = state.title ? `${gameLabel} · ${identityText()}` : identityText();
    roomGameLogo.textContent = roomLabel;
    rulesText.textContent = state.rules || '';
    document.title = `${roomLabel} · 게임센터`;
    newRoomBtn.classList.toggle('hidden', !isHost);
    hostRoomCodeBox.classList.toggle('hidden', !isHost);
    hostRoomCode.textContent = state.me?.roomCode || '----';
    roomCodeHelp.textContent = state.visibility === 'public'
      ? '이 방은 공개방 목록에서도 비밀번호 없이 입장할 수 있습니다.'
      : '비공개방은 비밀번호 또는 직접 받은 초대로만 입장할 수 있습니다.';
    roomInvitePanel.classList.toggle('hidden', !(isHost && g.status === 'selecting'));
    const team = isTeamGame();
    const numbered = isNumberedSeatGame();
    standardPlayers.classList.toggle('hidden', numbered);
    standardPlayers.classList.toggle('connectFourPlayers', state.gameType === 'connect4');
    standardPlayers.classList.toggle('blueRedPlayers', ['yut','dots','cityking'].includes(state.gameType));
    teamPlayers.classList.toggle('hidden', !numbered);

    const pictionary = isPictionaryGame();
    const liar = isLiarGame();
    const oldmaid = isOldMaidGame();
    roundNumber.textContent = pictionary ? `${g.roundNumber || 1}/${g.totalRounds || 0}라운드` : liar ? `${g.roundNumber || 0}/${g.totalRounds || 1}판` : `${g.round || 1}판`;
    moveCountLabel.textContent = pictionary ? '진행 라운드' : liar ? '진행 행동' : oldmaid ? '뽑기 횟수' : state.gameType === 'baseball' ? '추측 횟수' : state.gameType === 'yut' ? '말 이동 수' : state.gameType === 'bingo' ? '선택 수' : state.gameType === 'dots' ? '그은 선 수' : state.gameType === 'cityking' ? '진행 수' : '착수 수';
    moveCount.textContent = String(g.moveCount || 0);
    mySeat.textContent = seat ? seatKo(seat) : choiceKo(state.me?.choice);
    connectedCount.textContent = `${state.connectedCount || 0}명`;
    spectatorCount.textContent = `${state.spectatorCount || 0}명`;
    const scores = !pictionary && !liar && g.scores;
    gameScoreRow.classList.toggle('hidden', !scores);
    gameScoreText.textContent = scores ? (state.gameType === 'yut'
      ? `파랑 완주 ${scores.black} · 빨강 완주 ${scores.white}`
      : state.gameType === 'dots' ? `파랑 상자 ${scores.black} · 빨강 상자 ${scores.white}`
        : state.gameType === 'cityking' ? `파랑 자산 ${scores.black} · 빨강 자산 ${scores.white}`
        : `흑 ${scores.black} · 백 ${scores.white}`) : (state.gameType === 'bingo' ? Object.entries(g.lineCounts || {}).map(([n, count]) => `${n}번 ${count}줄`).join(' · ') || '-' : '-');
    seatLabel.textContent = isHost ? `방장 · ${seat ? `${seatKo(seat)} 플레이어` : choiceKo(state.me?.choice)}` : `참가자 · ${seat ? `${seatKo(seat)} 플레이어` : choiceKo(state.me?.choice)}`;

    if (oldmaid) {
      statusText.textContent = g.status === 'selecting' ? '도둑잡기 자리 선택 · 방장 시작' : g.status === 'finished' ? `${state.players[g.loser]?.label || '조커 보유자'}님 패배` : `${state.players[g.turn]?.label || '플레이어'}님 차례 · ${state.players[g.target]?.label || '상대'}님 카드 뽑기`;
    } else if (liar) {
      const speaker = g.currentSpeaker ? `${state.players[g.currentSpeaker]?.label || g.currentSpeaker + '번'}님` : '';
      const phases = { hint1: '1차 힌트', hint2: '2차 힌트', extraHint: '동률 후보 추가 힌트', vote: '라이어 투표', revote: '재투표', guess: '라이어 최종 추측', reveal: '판 결과 공개' };
      statusText.textContent = g.status === 'selecting' ? '참가자 자리 선택 · 방장 시작' : g.status === 'finished' ? '라이어게임 종료' : `${phases[g.phase] || '진행 중'}${speaker ? ` · ${speaker}` : ''}`;
    } else if (pictionary) {
      const drawerLabel = g.drawerSeat ? `${state.players[g.drawerSeat]?.label || g.drawerSeat + '번'}님` : '출제자';
      statusText.textContent = g.status === 'selecting' ? '참가자 자리 선택 · 방장 시작'
        : g.status === 'finished' ? '그림 맞히기 종료'
        : g.phase === 'reveal' ? `${drawerLabel} 라운드 결과 공개`
        : `${drawerLabel} 그리는 중`;
    } else if (g.status === 'selecting') statusText.textContent = isBingoGame() ? '빙고 참가자 자리 선택 · 방장 시작' : team ? '4명 자리 선택 중' : '역할 선택 중';
    else if (g.status === 'setup') statusText.textContent = `비밀 숫자 ${g.digitCount || 3}자리 설정 중`;
    else if (g.status === 'playing') {
      statusText.textContent = isBingoGame()
        ? `${seatKo(g.turn)} · ${state.players[g.turn]?.label || '플레이어'}님 숫자 선택 차례`
        : team ? (g.paused
          ? `일시정지 · ${g.disconnectedSeats.map(n => n + '번').join(', ')} 복귀 대기`
          : `${seatKo(g.nextSeat)} · ${state.players[g.nextSeat]?.label || '플레이어'}님 차례`)
        : state.gameType === 'yut'
          ? `${seatKo(g.turn)} · ${g.phase === 'move' ? `${g.lastThrow?.name || ''}만큼 움직일 말 선택` : '윷 던질 차례'}`
          : state.gameType === 'cityking'
            ? `${seatKo(g.turn)} · ${g.phase === 'buy' ? '도시 매입 여부 선택' : '주사위 굴릴 차례'}`
          : `${seatKo(g.turn)} 차례${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스` : ''}`;
    } else if (g.status === 'finished') statusText.textContent = `${seatKo(g.winner)} 승리`;
    else statusText.textContent = '무승부';

    if (numbered) renderTeamPlayers();
    else {
      setPlayerCard(blackPlayer, 'black', state.players.black);
      setPlayerCard(whitePlayer, 'white', state.players.white);
    }
    renderParticipants();
    renderChat();
    renderRoleChooser();

    const finished = ['finished', 'draw'].includes(g.status);
    const outcome = resultOutcome(g, seat, state.gameType);
    if (outcome) {
      const effectKey = `${g.round || 1}:${g.status}:${g.winner}:${seat}`;
      if (lastResultEffectKey !== effectKey) {
        lastResultEffectKey = effectKey;
        showResultEffect(outcome, g);
      }
    } else if (!finished) {
      lastResultEffectKey = null;
      clearResultEffect();
    }
    const canAct = Boolean(seat);
    const canResign = !isBingoGame() && !pictionary && !liar && !oldmaid && canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));
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
    const yut = state.gameType === 'yut';
    const bingo = state.gameType === 'bingo';
    const city = state.gameType === 'cityking';
    canvasWrap.classList.toggle('hidden', baseball || bingo || pictionary || liar || oldmaid);
    canvasWrap.classList.toggle('connectFour', state.gameType === 'connect4');
    canvasWrap.classList.toggle('yutBoard', yut);
    baseballPanel.classList.toggle('hidden', !baseball);
    baseballPanel.classList.toggle('resultWinPanel', baseball && outcome === 'win');
    baseballPanel.classList.toggle('resultLossPanel', baseball && outcome === 'loss');
    yutControls.classList.toggle('hidden', !yut);
    if (yut) renderYut();
    bingoPanel.classList.toggle('hidden', !bingo);
    if (bingo) renderBingo();
    cityControls.classList.toggle('hidden', !city);
    canvasWrap.classList.toggle('cityBoard', city);
    if (city) renderCityControls();
    else {
      citySelectedTileIndex = null;
      cityLastRollKey = null;
      cityAnimation = null;
      if (cityAnimationFrame !== null) cancelAnimationFrame(cityAnimationFrame);
      cityAnimationFrame = null;
    }
    pictionaryPanel.classList.toggle('hidden', !pictionary);
    if (pictionary) renderPictionary();
    liarPanel.classList.toggle('hidden', !liar);
    if (liar) renderLiar();
    oldmaidPanel.classList.toggle('hidden', !oldmaid);
    if (oldmaid) renderOldMaid();
    if (pictionary || liar || oldmaid) {
      boardOverlay.classList.add('hidden');
    } else if (baseball) {
      boardOverlay.classList.add('hidden');
      renderBaseball();
    } else if (g.status === 'selecting') {
      boardOverlay.classList.remove('resultWin', 'resultLoss');
      const choice = state.me?.choice;
      if (!choice) boardOverlay.textContent = team ? '1 · 2 · 3 · 4번 또는 관전을 선택하세요' : state.gameType === 'connect4' ? '빨강 · 노랑 · 관전 중 역할을 선택하세요' : ['yut','dots','cityking'].includes(state.gameType) ? '파랑 · 빨강 · 관전 중 역할을 선택하세요' : '흑 · 백 · 관전 중 역할을 선택하세요';
      else if (choice === 'spectator') boardOverlay.textContent = '관전자로 대기 중입니다';
      else boardOverlay.textContent = `${choiceKo(choice)} 선택 완료 · 다른 플레이어를 기다리는 중`;
      boardOverlay.classList.remove('hidden');
    } else if (team && g.status === 'playing' && g.paused) {
      boardOverlay.classList.remove('resultWin', 'resultLoss');
      boardOverlay.textContent = `일시정지 · ${g.disconnectedSeats.map(n => n + '번').join(', ')} 플레이어를 기다리는 중`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'finished') {
      if (outcome) setResultBoardOverlay(outcome, g);
      else {
        boardOverlay.classList.remove('resultWin', 'resultLoss');
        boardOverlay.textContent = `${seatKo(g.winner)} 승리`;
      }
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'draw') {
      boardOverlay.classList.remove('resultWin', 'resultLoss');
      boardOverlay.textContent = '무승부';
      boardOverlay.classList.remove('hidden');
    } else {
      boardOverlay.classList.remove('resultWin', 'resultLoss');
      boardOverlay.classList.add('hidden');
    }

    drawBoard();
  }

  function renderBaseball() {
    const g = state.game;
    const digitCount = Number(g.digitCount) === 4 ? 4 : 3;
    const numberPattern = `[1-9][0-9]{${digitCount - 1}}`;
    for (const input of [baseballSecretInput, baseballGuessInput]) {
      input.pattern = numberPattern;
      input.minLength = digitCount;
      input.maxLength = digitCount;
    }
    baseballSecretInput.placeholder = `서로 다른 숫자 ${digitCount}개`;
    baseballGuessInput.placeholder = digitCount === 3 ? '예: 123' : '예: 1234';
    const ready = g.ready || {};
    baseballReady.textContent = `${digitCount}자리 비밀 숫자 준비: 선공 ${ready.black ? '완료' : '대기'} · 후공 ${ready.white ? '완료' : '대기'}`;
    baseballMySecret.textContent = seat
      ? (state.me?.mySecret ? `내 비밀 숫자: ${state.me.mySecret}` : '내 비밀 숫자: 미설정')
      : '관전 중 · 비밀 숫자는 각 플레이어에게만 보입니다.';
    const myReady = Boolean(seat && ready[seat]);
    baseballSecretForm.classList.toggle('hidden', !(g.status === 'setup' && seat && !myReady));
    baseballGuessForm.classList.toggle('hidden', !(g.status === 'playing' && seat && g.turn === seat));
    if (g.status === 'selecting') baseballHint.textContent = '선공·후공을 선택하면 각자 비밀 숫자를 설정할 수 있습니다.';
    else if (g.status === 'setup') baseballHint.textContent = !seat ? '플레이어들의 비밀 숫자 준비를 기다리는 중입니다.' : (myReady ? '비밀 숫자 설정 완료. 상대방이 준비할 때까지 기다려 주세요.' : `상대에게 보이지 않을 비밀 숫자 ${digitCount}개를 입력해 주세요.`);
    else if (g.status === 'playing') baseballHint.textContent = seat === g.turn ? '내 차례입니다! 상대의 숫자를 추측해 주세요.' : `${seatKo(g.turn)}이(가) 추측할 차례입니다.`;
    else if (g.status === 'finished' && seat) baseballHint.textContent = resultOutcome(g, seat, state.gameType) === 'win'
      ? '🏆 승리! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.'
      : '패배! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.';
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

  function renderYut() {
    const g = state.game;
    const mine = Boolean(seat && g.turn === seat && g.status === 'playing');
    yutThrowBtn.disabled = !(mine && g.phase === 'throw');
    yutThrowBtn.textContent = mine && g.phase === 'throw' ? '윷 던지기' : '던지기 대기';
    yutLastThrow.textContent = g.lastThrow
      ? `최근 결과: ${g.lastThrow.name} · ${g.lastThrow.steps}칸`
      : '아직 던진 윷이 없습니다';
    if (g.status === 'selecting') yutHint.textContent = '파랑과 빨강이 정해지면 파랑부터 시작합니다.';
    else if (g.status === 'finished') yutHint.textContent = `${seatKo(g.winner)}이 말 4개를 모두 완주했습니다.`;
    else if (!seat) yutHint.textContent = `${seatKo(g.turn)}의 진행을 관전하고 있습니다.`;
    else if (g.turn !== seat) yutHint.textContent = `${seatKo(g.turn)} 차례입니다.`;
    else if (g.phase === 'throw') yutHint.textContent = '내 차례입니다. 윷을 던져 주세요.';
    else yutHint.textContent = `${g.lastThrow?.name || ''} · ${g.pendingSteps || 0}칸 이동할 말을 선택하세요.`;

    yutMoveChoices.replaceChildren();
    const moves = mine && g.phase === 'move' ? (g.legalMoves || []) : [];
    for (const move of moves) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'yutPieceChoice';
      const number = Number(String(move.pieceId).split('-').at(-1));
      const carriedNumbers = (move.carried || [move.pieceId]).map(id => Number(String(id).split('-').at(-1))).sort((a, b) => a - b);
      const pieceLabel = carriedNumbers.length > 1 ? `${carriedNumbers.map(value => `${value}번`).join(' + ')} 말 · ${carriedNumbers.length}개 업기` : `${number}번 말`;
      const target = move.destination?.status === 'finished' ? '완주' : `${move.destination?.position}번 칸`;
      button.textContent = `${pieceLabel} → ${target}`;
      button.addEventListener('click', () => roomAction('move-yut', { pieceId: move.pieceId }));
      yutMoveChoices.appendChild(button);
    }
    if (g.phase === 'move' && !moves.length) {
      const waiting = document.createElement('span');
      waiting.className = 'smallMuted';
      waiting.textContent = mine ? '움직일 말을 확인하는 중입니다.' : `${seatKo(g.turn)}이 말을 고르는 중입니다.`;
      yutMoveChoices.appendChild(waiting);
    }
  }


  function renderBingo() {
    const g = state.game;
    const selected = new Set(g.selectedNumbers || []);
    const occupied = ['1','2','3','4'].filter(number => state.players[number]);
    bingoTargetSelect.value = String(g.targetLines || 5);
    bingoTargetSelect.disabled = !(isHost && g.status === 'selecting');
    bingoStartBtn.classList.toggle('hidden', g.status !== 'selecting');
    bingoStartBtn.disabled = !(isHost && occupied.length >= 2 && g.status === 'selecting');
    bingoSelectedNumbers.textContent = (g.selectedNumbers || []).length ? g.selectedNumbers.join(', ') : '없음';
    const summarySeats = g.seatOrder?.length ? g.seatOrder : occupied;
    bingoLineSummary.textContent = summarySeats.length
      ? summarySeats.map(number => `${state.players[number]?.label || number + '번'} ${g.lineCounts?.[number] || 0}줄`).join(' · ')
      : '-';
    if (g.status === 'selecting') bingoStatus.textContent = `승리 조건 ${g.targetLines || 5}줄 · 현재 선수 ${occupied.length}명 · 2명 이상이면 방장이 시작할 수 있습니다.`;
    else if (g.status === 'playing') bingoStatus.textContent = `승리 조건 ${g.targetLines}줄 · 현재 ${seatKo(g.turn)} 차례${g.lastSelected ? ` · 직전 선택 ${g.lastSelected.number}` : ''}`;
    else if (g.status === 'finished') bingoStatus.textContent = `${state.players[g.winner]?.label || seatKo(g.winner)} 승리 · ${g.lineCounts?.[g.winner] || 0}줄 완성`;

    bingoBoard.replaceChildren();
    const board = state.me?.myBingoBoard;
    if (!Array.isArray(board) || board.length !== 25) {
      const note = document.createElement('p');
      note.className = 'smallMuted bingoSpectatorNote';
      note.textContent = g.status === 'selecting' ? '자리를 선택하면 게임 시작 후 내 빙고판이 생성됩니다.' : '관전 중입니다. 참가자별 완성 줄 수와 선택 숫자를 확인할 수 있습니다.';
      bingoBoard.appendChild(note);
      return;
    }
    const myTurn = Boolean(seat && g.status === 'playing' && g.turn === seat);
    for (const number of board) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `bingoCell${selected.has(number) ? ' selected' : ''}`;
      button.textContent = String(number);
      button.disabled = !myTurn || selected.has(number);
      button.setAttribute('aria-label', `${number}번${selected.has(number) ? ' 선택됨' : ''}`);
      button.addEventListener('click', () => {
        button.disabled = true;
        roomAction('select-bingo', { number, expectedMoveCount: g.moveCount || 0 });
      });
      bingoBoard.appendChild(button);
    }
  }

  function renderCityControls() {
    const g = state.game;
    const mine = Boolean(seat && g.turn === seat && g.status === 'playing');
    const turn = Math.max(0, Number(g.turnCount) || 0);
    const limit = Number(g.turnLimit) || 50;
    const name = color => state.players?.[color]?.label || (color === 'black' ? '파랑' : '빨강');
    const extraText = g.extraRoll ? (g.phase === 'roll' ? ' · 더블 추가 굴림' : ' · 더블: 칸 처리 후 추가 굴림') : '';
    cityTurnSummary.textContent = `전체 턴 ${turn}/${limit} 완료 · 남은 ${Math.max(0, limit - turn)}턴 · ${g.turn ? name(g.turn) + ' 차례' + extraText : '대국 종료'}`;
    cityAssets.replaceChildren();
    for (const color of ['black', 'white']) {
      const player = g.players?.[color];
      if (!player) continue;
      const card = document.createElement('div');
      card.className = `cityAssetCard ${color}${g.status === 'playing' && g.turn === color ? ' isTurn' : ''}`;
      const heading = document.createElement('strong');
      heading.textContent = `${name(color)}${seat === color ? ' · 나' : ''}${g.turn === color && g.status === 'playing' ? ' · 현재 차례' : ''}`;
      const metrics = document.createElement('span');
      metrics.textContent = `현금 ${player.cash} · 도시 ${player.properties?.length || 0}개 · 순자산 ${g.scores?.[color] ?? player.cash} · 위치 ${player.position}번`;
      card.append(heading, metrics);
      cityAssets.appendChild(card);
    }
    if (cityTileSelect.options.length !== (g.tiles?.length || 0)) {
      cityTileSelect.replaceChildren();
      for (const tile of g.tiles || []) {
        const option = document.createElement('option');
        option.value = String(tile.index);
        option.textContent = `${tile.index}번 · ${tile.name}`;
        cityTileSelect.appendChild(option);
      }
    }
    const roll = g.lastRoll;
    cityDieFirst.textContent = roll ? String.fromCodePoint(0x267f + roll.first) : '⚀';
    cityDieSecond.textContent = roll ? String.fromCodePoint(0x267f + roll.second) : '⚀';
    const rollKey = roll ? `${g.round}:${roll.at}:${roll.color}:${roll.from}:${roll.to}` : null;
    if (rollKey && cityLastRollKey !== null && cityLastRollKey !== rollKey) {
      if (cityAnimationFrame !== null) cancelAnimationFrame(cityAnimationFrame);
      cityAnimation = { color: roll.color, from: roll.from, position: roll.from, steps: roll.total, started: performance.now() };
      citySelectedTileIndex = roll.to;
      cityControls.classList.remove('isRolling');
      void cityControls.offsetWidth;
      cityControls.classList.add('isRolling');
      const advance = timestamp => {
        if (!cityAnimation || state?.gameType !== 'cityking') return;
        const elapsed = timestamp - cityAnimation.started;
        cityAnimation.position = (cityAnimation.from + Math.min(cityAnimation.steps, Math.floor(elapsed / 110))) % 24;
        drawCityBoard();
        if (elapsed < cityAnimation.steps * 110 + 140) cityAnimationFrame = requestAnimationFrame(advance);
        else { cityAnimation = null; cityAnimationFrame = null; cityControls.classList.remove('isRolling'); drawCityBoard(); }
      };
      cityAnimationFrame = requestAnimationFrame(advance);
    }
    cityLastRollKey = rollKey;
    if (citySelectedTileIndex === null || !g.tiles?.[citySelectedTileIndex])
      citySelectedTileIndex = g.pendingProperty ?? g.players?.[g.turn]?.position ?? roll?.to ?? 0;
    cityTileSelect.value = String(citySelectedTileIndex);
    const tile = g.tiles?.[citySelectedTileIndex];
    const level = tile?.type === 'property' ? Math.max(0, Math.min(3, Number(g.developments?.[tile.index]) || 0)) : 0;
    const building = ['도시', '별장', '빌딩', '호텔'][level];
    cityTileName.textContent = tile ? `${tile.index}번 · ${tile.name}${g.owners?.[tile.index] ? ` · ${building} (${level}단계)` : ''}` : '칸 정보 없음';
    cityTilePrice.textContent = tile?.type === 'property' ? `${tile.price}` : '-';
    cityTileToll.textContent = tile?.type === 'property' ? `${g.tolls?.[tile.index] ?? tile.toll}` : '-';
    const owner = tile ? g.owners?.[tile.index] : null;
    cityTileOwner.textContent = tile?.type !== 'property' ? '해당 없음' : owner ? name(owner) : '미소유';
    cityRollBtn.disabled = !(mine && g.phase === 'roll');
    cityRollBtn.textContent = mine && g.phase === 'roll' ? (g.extraRoll ? '더블 · 추가 굴리기' : '주사위 굴리기') : '굴리기 대기';
    cityLastRoll.textContent = g.lastRoll
      ? `최근 주사위: ${g.lastRoll.first} + ${g.lastRoll.second} = ${g.lastRoll.total}${g.lastRoll.double ? ' · 더블!' : ''}`
      : '아직 주사위를 굴리지 않았습니다';
    cityEvent.textContent = g.lastEvent || (g.status === 'selecting'
      ? '파랑과 빨강이 정해지면 파랑부터 시작합니다.'
      : !seat ? `${seatKo(g.turn)}의 차례를 관전하고 있습니다.`
        : g.turn === seat ? '내 차례입니다.' : `${seatKo(g.turn)} 차례입니다.`);
    const offer = g.pendingProperty === null ? null : g.tiles?.[g.pendingProperty];
    const canBuy = Boolean(offer && mine && g.phase === 'buy');
    cityPropertyOffer.textContent = offer ? `${offer.name} · 매입 ${offer.price} · 통행료 ${offer.toll}` : '';
    cityBuyBtn.classList.toggle('hidden', !offer);
    cityBuyBtn.disabled = !canBuy || (g.players?.[seat]?.cash ?? 0) < (offer?.price ?? 0);
    citySkipBtn.classList.toggle('hidden', !offer);
    citySkipBtn.disabled = !canBuy;
    const buildTile = g.phase === 'build' && g.pendingProperty !== null ? g.tiles?.[g.pendingProperty] : null;
    const buildLevel = buildTile ? Math.max(0, Math.min(3, Number(g.developments?.[buildTile.index]) || 0)) : 0;
    const cost = buildTile ? Math.floor(buildTile.price / 2) : 0;
    cityBuildRow.classList.toggle('hidden', !buildTile);
    cityBuildOffer.textContent = buildTile ? `${buildTile.name} · 다음 ${['별장', '빌딩', '호텔'][buildLevel] || '건설 완료'} · 건설비 ${cost} · 현재 통행료 ${g.tolls?.[buildTile.index] ?? buildTile.toll}` : '';
    cityBuildBtn.disabled = !(buildTile && mine && g.owners?.[buildTile.index] === seat && buildLevel < 3 && g.players?.[seat]?.cash >= cost);
    cityBuildSkipBtn.disabled = !(buildTile && mine);
  }

  let pictionaryTool = 'pen';
  let pictionaryDrawingActive = false;
  let pictionaryCurrentPoints = [];
  let pictionaryHasGuessedRound = null; // `${round}:${seat}` once a correct guess is submitted locally

  function pictionaryFillWhite() {
    pictionaryCtx.save();
    pictionaryCtx.globalCompositeOperation = 'source-over';
    pictionaryCtx.fillStyle = '#ffffff';
    pictionaryCtx.fillRect(0, 0, pictionaryCanvas.width, pictionaryCanvas.height);
    pictionaryCtx.restore();
  }

  function pictionaryDrawStroke(stroke) {
    if (!stroke.points.length) return;
    pictionaryCtx.save();
    pictionaryCtx.lineCap = 'round';
    pictionaryCtx.lineJoin = 'round';
    pictionaryCtx.lineWidth = stroke.width;
    pictionaryCtx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    pictionaryCtx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(0,0,0,1)' : stroke.color;
    pictionaryCtx.beginPath();
    const [x0, y0] = stroke.points[0];
    pictionaryCtx.moveTo(x0 * pictionaryCanvas.width, y0 * pictionaryCanvas.height);
    for (const [x, y] of stroke.points.slice(1)) pictionaryCtx.lineTo(x * pictionaryCanvas.width, y * pictionaryCanvas.height);
    if (stroke.points.length === 1) pictionaryCtx.lineTo(x0 * pictionaryCanvas.width + 0.01, y0 * pictionaryCanvas.height);
    pictionaryCtx.stroke();
    pictionaryCtx.restore();
  }

  function redrawPictionaryCanvas() {
    pictionaryFillWhite();
    for (const stroke of state?.game?.strokes || []) pictionaryDrawStroke(stroke);
  }

  function pictionaryPoint(ev) {
    const rect = pictionaryCanvas.getBoundingClientRect();
    const point = ev.touches?.[0] || ev.changedTouches?.[0] || ev;
    const x = Math.min(1, Math.max(0, (point.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (point.clientY - rect.top) / rect.height));
    return [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000];
  }

  function pictionaryCanDraw() {
    const g = state?.game;
    return Boolean(g && state.gameType === 'pictionary' && seat && seat === g.drawerSeat && g.status === 'playing' && g.phase === 'drawing');
  }

  function pictionaryPointerDown(ev) {
    if (!pictionaryCanDraw()) return;
    ev.preventDefault();
    pictionaryDrawingActive = true;
    pictionaryCurrentPoints = [pictionaryPoint(ev)];
  }

  function pictionaryPointerMove(ev) {
    if (!pictionaryDrawingActive || !pictionaryCanDraw()) return;
    ev.preventDefault();
    const point = pictionaryPoint(ev);
    pictionaryCurrentPoints.push(point);
    pictionaryDrawStroke({ points: pictionaryCurrentPoints.slice(-2), color: pictionaryColor.value, width: Number(pictionaryWidth.value), tool: pictionaryTool });
    if (pictionaryCurrentPoints.length >= 400) pictionaryPointerUp(ev);
  }

  async function pictionaryPointerUp() {
    if (!pictionaryDrawingActive) return;
    pictionaryDrawingActive = false;
    const points = pictionaryCurrentPoints;
    pictionaryCurrentPoints = [];
    if (points.length < 2) return;
    await roomAction('pictionary-stroke', { stroke: { points, color: pictionaryColor.value, width: Number(pictionaryWidth.value), tool: pictionaryTool } });
  }

  function pictionaryCountdownText(endsAt) {
    if (!endsAt) return '';
    const remain = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    return `${remain}초`;
  }

  function renderPictionary() {
    const g = state.game;
    const isDrawer = Boolean(seat && seat === g.drawerSeat);
    pictionaryStartBtn.classList.toggle('hidden', !(isHost && g.status === 'selecting'));
    pictionaryStartBtn.disabled = g.status !== 'selecting';
    pictionaryDrawerLabel.textContent = g.status === 'selecting'
      ? '참가자가 모이면 방장이 시작합니다'
      : g.status === 'finished'
        ? (Array.isArray(g.winner) && g.winner.length
          ? `최종 승리: ${g.winner.map(s => state.players[s]?.label || `${s}번`).join(', ')}`
          : '그림 맞히기 종료')
        : `출제자 · ${state.players[g.drawerSeat]?.label || (g.drawerSeat ? g.drawerSeat + '번' : '-')}${isDrawer ? ' (나)' : ''}`;
    const timerEndsAt = g.phase === 'drawing' ? g.roundEndsAt : g.phase === 'reveal' ? g.revealEndsAt : null;
    pictionaryTimer.classList.toggle('hidden', !timerEndsAt);
    if (timerEndsAt) pictionaryTimer.textContent = g.phase === 'reveal' ? `결과 공개 · ${pictionaryCountdownText(timerEndsAt)}` : pictionaryCountdownText(timerEndsAt);

    pictionaryWordBox.classList.toggle('hidden', !(isDrawer && g.phase === 'drawing' && state.me?.myWord));
    if (state.me?.myWord) pictionaryWord.textContent = state.me.myWord;

    if (g.phase === 'reveal' && g.lastRound) {
      pictionaryRoundResult.classList.remove('hidden');
      const guessers = g.lastRound.correctGuessers.map(s => state.players[s]?.label || `${s}번`);
      pictionaryRoundResult.textContent = `정답은 "${g.lastRound.word}" · ${guessers.length ? guessers.join(', ') + '님 정답' : '아무도 맞히지 못했습니다'}`;
    } else {
      pictionaryRoundResult.classList.add('hidden');
    }

    const canDraw = pictionaryCanDraw();
    pictionaryDrawTools.classList.toggle('hidden', !canDraw);
    pictionaryCanvas.classList.toggle('drawable', canDraw);

    const alreadyGuessed = (g.correctGuessers || []).includes(seat);
    const canGuess = Boolean(seat && !isDrawer && g.status === 'playing' && g.phase === 'drawing' && !alreadyGuessed);
    pictionaryGuessForm.classList.toggle('hidden', !canGuess);
    pictionaryGuessInput.disabled = !canGuess;

    pictionaryScoreboard.replaceChildren();
    const seats = g.seatOrder.length ? g.seatOrder : numberedSeats().filter(n => state.players[n]);
    const ranked = [...seats].sort((a, b) => (g.scores?.[b] || 0) - (g.scores?.[a] || 0));
    for (const s of ranked) {
      const row = document.createElement('div');
      row.className = `pictionaryScoreRow${s === g.drawerSeat && g.status === 'playing' ? ' isDrawer' : ''}${s === seat ? ' isMe' : ''}`;
      const name = document.createElement('span');
      name.textContent = `${state.players[s]?.label || s + '번'}${s === g.drawerSeat && g.status === 'playing' ? ' ✏️' : ''}${(g.correctGuessers || []).includes(s) ? ' ✅' : ''}`;
      const score = document.createElement('strong');
      score.textContent = `${g.scores?.[s] || 0}점`;
      row.append(name, score);
      pictionaryScoreboard.appendChild(row);
    }

    redrawPictionaryCanvas();
  }


  function liarCountdownText(endsAt) {
    if (!endsAt) return '';
    return `${Math.max(0, Math.ceil((Number(endsAt) - Date.now()) / 1000))}초`;
  }

  function renderLiar() {
    const g = state.game;
    const occupied = numberedSeats().filter(number => state.players[number]);
    liarRoundsSelect.value = String(g.totalRounds || 1);
    liarRoundsSelect.disabled = !(isHost && g.status === 'selecting');
    liarStartBtn.classList.toggle('hidden', g.status !== 'selecting');
    liarStartBtn.disabled = !(isHost && occupied.length >= 3 && g.status === 'selecting');

    if (g.status === 'selecting') liarRoleBox.textContent = '게임 시작 후 내 역할이 개인 화면에 공개됩니다.';
    else if (!seat) liarRoleBox.textContent = '관전 중 · 진행 중인 판의 역할과 제시어는 공개되지 않습니다.';
    else if (g.role === 'liar') liarRoleBox.textContent = '🕵️ 당신은 라이어입니다. 시민들의 힌트를 듣고 제시어를 추리하세요.';
    else if (g.role === 'citizen') liarRoleBox.textContent = `👥 시민 · 제시어: ${g.myWord || '-'}`;
    else liarRoleBox.textContent = '판 결과를 확인하세요.';

    const phaseNames = { hint1: '1차 힌트', hint2: '2차 힌트', extraHint: '동률 후보 추가 힌트', vote: '라이어 비밀 투표', revote: '동률 후보 재투표', guess: '라이어 최종 제시어 추측', reveal: '판 결과 공개', finished: '게임 종료' };
    liarPhaseLabel.textContent = g.status === 'selecting' ? `현재 ${occupied.length}명 · 3명 이상 필요` : (phaseNames[g.phase] || '진행 중');
    liarSpeakerLabel.textContent = g.currentSpeaker ? `현재 발언: ${state.players[g.currentSpeaker]?.label || g.currentSpeaker + '번'}` : '';
    liarTimer.classList.toggle('hidden', !g.deadlineAt);
    if (g.deadlineAt) liarTimer.textContent = liarCountdownText(g.deadlineAt);

    liarHintLog.replaceChildren();
    for (const hint of g.hints || []) {
      const row = document.createElement('div');
      row.className = `liarHintRow${hint.timedOut ? ' timedOut' : ''}`;
      const who = document.createElement('strong');
      const stage = hint.stage === 'hint1' ? '1차' : hint.stage === 'hint2' ? '2차' : '추가';
      who.textContent = `${stage} · ${state.players[hint.seat]?.label || hint.seat + '번'}`;
      const text = document.createElement('span');
      text.textContent = hint.text;
      row.append(who, text);
      liarHintLog.appendChild(row);
    }
    if (!(g.hints || []).length) {
      const empty = document.createElement('p'); empty.className = 'smallMuted'; empty.textContent = '아직 공개된 힌트가 없습니다.'; liarHintLog.appendChild(empty);
    }

    const hintPhase = ['hint1','hint2','extraHint'].includes(g.phase);
    const canHint = Boolean(seat && g.status === 'playing' && hintPhase && g.currentSpeaker === seat);
    liarHintForm.classList.toggle('hidden', !canHint);
    liarHintInput.disabled = !canHint;

    liarVoteBox.replaceChildren();
    const voting = ['vote','revote'].includes(g.phase);
    liarVoteBox.classList.toggle('hidden', !voting);
    if (voting) {
      const note = document.createElement('p');
      note.className = 'smallMuted';
      note.textContent = !seat ? '관전자는 투표할 수 없습니다.' : g.myVoted ? '투표 완료 · 다른 참가자의 투표는 개표 전까지 비공개입니다.' : '라이어라고 생각하는 참가자 한 명에게 투표하세요.';
      liarVoteBox.appendChild(note);
      if (seat && !g.myVoted) for (const target of g.voteTargets || []) {
        if (target === seat) continue;
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'ghost liarVoteBtn';
        button.textContent = state.players[target]?.label || `${target}번`;
        button.addEventListener('click', () => roomAction('liar-vote', { target, expectedPhaseId: g.phaseId }));
        liarVoteBox.appendChild(button);
      }
    }

    liarGuessForm.classList.toggle('hidden', !g.canGuess);
    liarGuessInput.disabled = !g.canGuess;

    const result = g.lastResult;
    liarResult.classList.toggle('hidden', !result);
    liarResult.replaceChildren();
    if (result) {
      const title = document.createElement('strong');
      title.textContent = result.winningSide === 'liar' ? '🕵️ 라이어 승리' : '👥 시민 승리';
      const detail = document.createElement('p');
      detail.textContent = `라이어: ${state.players[result.liarSeat]?.label || result.liarSeat + '번'} · 제시어: ${result.word}`;
      liarResult.append(title, detail);
      const ballot = result.voteHistory?.at(-1);
      if (ballot) {
        const vote = document.createElement('p'); vote.className = 'smallMuted';
        vote.textContent = `최종 투표 · ${Object.entries(ballot.counts || {}).map(([s,c]) => `${state.players[s]?.label || s + '번'} ${c}표`).join(' · ')}`;
        liarResult.appendChild(vote);
      }
      if (g.status === 'finished' && Array.isArray(g.winner)) {
        const final = document.createElement('p'); final.className = 'liarFinalWinners';
        final.textContent = `최종 승자: ${g.winner.map(s => state.players[s]?.label || s + '번').join(', ')}`;
        liarResult.appendChild(final);
      }
    }

    liarScoreboard.replaceChildren();
    const seats = g.players?.length ? g.players : occupied;
    for (const s of [...seats].sort((a,b) => (g.scores?.[b] || 0) - (g.scores?.[a] || 0))) {
      const row = document.createElement('div'); row.className = `liarScoreRow${s === seat ? ' isMe' : ''}`;
      const name = document.createElement('span'); name.textContent = state.players[s]?.label || `${s}번`;
      const score = document.createElement('strong'); score.textContent = `${g.scores?.[s] || 0}점`;
      row.append(name, score); liarScoreboard.appendChild(row);
    }
  }

  function renderOldMaid() {
    const g = state.game;
    const active = g.seatOrder?.length || numberedSeats().filter(number => state.players[number]).length;
    oldmaidStartBtn.classList.toggle('hidden', g.status !== 'selecting');
    oldmaidStartBtn.disabled = !(isHost && active >= 2 && g.status === 'selecting');
    oldmaidShuffleBtn.disabled = !(seat && g.status === 'playing' && (g.counts?.[seat] || 0) > 0);
    const label = number => state.players[number]?.label || `${number}번`;
    oldmaidStatus.textContent = g.status === 'selecting'
      ? `참가자 ${active}명 · 2~6명이 자리를 선택하면 방장이 시작합니다.`
      : g.status === 'finished' ? `종료 · ${label(g.loser)}님이 조커를 보유했습니다.`
      : g.turn === seat ? `내 차례! ${label(g.target)}님의 카드 한 장을 뽑으세요.`
      : `${label(g.turn)}님 차례 · ${label(g.target)}님의 카드를 뽑는 중`;
    oldmaidResult.classList.toggle('hidden', g.status !== 'finished');
    oldmaidResult.textContent = g.status === 'finished'
      ? `🃏 ${label(g.loser)}님 패배 · 나머지 참가자 승리` : '';
    oldmaidCounts.replaceChildren();
    for (const number of (g.seatOrder?.length ? g.seatOrder : numberedSeats().filter(n => state.players[n]))) {
      const chip = document.createElement('span');
      chip.className = 'oldmaidCount' + (g.turn === number ? ' active' : '');
      chip.textContent = `${label(number)} · ${g.counts?.[number] ?? 0}장${g.target === number ? ' · 뽑기 대상' : ''}`;
      oldmaidCounts.appendChild(chip);
    }
    oldmaidMyHand.replaceChildren();
    if (seat && Array.isArray(state.me?.myOldMaidHand)) {
      for (const card of state.me.myOldMaidHand) {
        const face = document.createElement('span');
        face.className = 'oldmaidCard oldmaidFace' + (card.rank === 'JOKER' ? ' joker' : '');
        face.textContent = card.rank === 'JOKER' ? '🃏 조커' : `${card.suit} ${card.rank}`;
        face.setAttribute('aria-label', card.rank === 'JOKER' ? '조커' : `${card.suit} ${card.rank}`);
        oldmaidMyHand.appendChild(face);
      }
    } else {
      oldmaidMyHand.textContent = seat ? '게임 시작 후 내 카드가 표시됩니다.' : '관전자는 다른 참가자의 카드 내용을 볼 수 없습니다.';
    }
    if (seat && g.status === 'playing' && !state.me.myOldMaidHand?.length) oldmaidMyHand.textContent = '카드를 모두 버렸습니다!';
    oldmaidOpponents.replaceChildren();
    for (const number of (g.seatOrder?.length ? g.seatOrder : numberedSeats().filter(n => state.players[n]))) {
      if (number === seat) continue;
      const row = document.createElement('section');
      row.className = 'oldmaidOpponent' + (g.target === number ? ' target' : '');
      const name = document.createElement('strong');
      name.textContent = `${label(number)} · ${g.counts?.[number] ?? 0}장${g.target === number ? ' · 뽑기 대상' : ''}`;
      const cards = document.createElement('div');
      cards.className = 'oldmaidCards';
      const canDraw = Boolean(seat && g.status === 'playing' && g.turn === seat && g.target === number);
      for (let index = 0; index < (g.counts?.[number] || 0); index += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'oldmaidCard oldmaidBack' + (canDraw ? ' selectable' : '');
        button.textContent = '🂠';
        button.disabled = !canDraw;
        button.setAttribute('aria-label', `${label(number)}님의 ${index + 1}번째 카드 뽑기`);
        button.addEventListener('click', () => {
          if (button.disabled) return;
          button.classList.add('selected');
          for (const candidate of cards.querySelectorAll('button')) candidate.disabled = true;
          roomAction('draw-oldmaid', { targetSeat: number, index, expectedRevision: g.revision });
        });
        cards.appendChild(button);
      }
      row.append(name, cards);
      oldmaidOpponents.appendChild(row);
    }
    oldmaidHistory.replaceChildren();
    for (const item of (g.history || []).slice(-12).reverse()) {
      const line = document.createElement('p');
      line.textContent = `${label(item.actor)}님이 ${label(item.target)}님의 카드 1장을 뽑았습니다.${item.pairs ? ` · ${item.pairs}쌍 버림` : ''}${item.emptied ? ` · ${label(item.emptied)}님 카드 소진` : ''}`;
      oldmaidHistory.appendChild(line);
    }
    if (!g.history?.length) oldmaidHistory.textContent = '아직 카드를 뽑지 않았습니다.';
  }

  function drawBoard() {
    if (state?.gameType === 'baseball' || state?.gameType === 'bingo' || state?.gameType === 'pictionary' || state?.gameType === 'liar' || state?.gameType === 'oldmaid') return;
    if (state?.gameType === 'yut') return drawYutBoard();
    if (state?.gameType === 'dots') return drawDotsBoard();
    if (state?.gameType === 'cityking') return drawCityBoard();
    if (state?.gameType === 'connect4') return drawConnect4Board();
    if (state?.gameType === 'othello') return drawOthelloBoard();
    return drawOmokBoard();
  }

  function yutNodePosition(node) {
    const map = {
      0:[630,630], 1:[630,518], 2:[630,406], 3:[630,294], 4:[630,182], 5:[630,70],
      6:[518,70], 7:[406,70], 8:[294,70], 9:[182,70], 10:[70,70],
      11:[70,182], 12:[70,294], 13:[70,406], 14:[70,518], 15:[70,630],
      16:[182,630], 17:[294,630], 18:[406,630], 19:[518,630],
      21:[540,160], 22:[450,250], 23:[350,350], 28:[445,445], 29:[540,540],
      26:[160,160], 27:[250,250], 24:[250,450], 25:[160,540],
    };
    return map[node] || map[0];
  }

  function yutStackOffsets(count) {
    const total = Math.max(1, Math.min(4, Number(count) || 1));
    const spacing = 26;
    const start = -((total - 1) * spacing) / 2;
    return Array.from({ length: total }, (_, index) => start + index * spacing);
  }

  function drawYutBoard() {
    const g = state.game;
    const bg = ctx.createLinearGradient(0, 0, 720, 720);
    bg.addColorStop(0, '#f3d79c');
    bg.addColorStop(1, '#c99549');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 720, 720);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(80,48,18,.62)';
    ctx.lineWidth = 9;
    const paths = [
      [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,0],
      [5,21,22,23,24,25,15], [10,26,27,23,28,29,0],
    ];
    for (const path of paths) {
      ctx.beginPath();
      path.forEach((node, i) => { const [x,y] = yutNodePosition(node); if (i) ctx.lineTo(x,y); else ctx.moveTo(x,y); });
      ctx.stroke();
    }
    const nodes = [...new Set(paths.flat())];
    for (const node of nodes) {
      const [x,y] = yutNodePosition(node);
      const corner = [0,5,10,15,23].includes(node);
      ctx.fillStyle = corner ? '#7c3f17' : '#9a5b27';
      ctx.beginPath(); ctx.arc(x,y,corner ? 25 : 18,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f8e7bf';
      ctx.beginPath(); ctx.arc(x,y,corner ? 15 : 10,0,Math.PI*2); ctx.fill();
    }
    ctx.fillStyle = '#5f3518';
    ctx.font = '900 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('출발 · 완주', 603, 685);
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.fillText('지름길', 350, 388);

    const grouped = new Map();
    for (const color of ['black','white']) for (const piece of g.pieces?.[color] || []) {
      if (piece.status !== 'board') continue;
      const key = `${piece.position}:${color}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(piece);
    }
    for (const [key, pieces] of grouped) {
      const [position, color] = key.split(':');
      const [x,y] = yutNodePosition(Number(position));
      const fill = color === 'black' ? '#2563eb' : '#ef4444';
      const ordered = [...pieces].sort((a, b) => Number(a.id.split('-').at(-1)) - Number(b.id.split('-').at(-1)));
      const offsets = yutStackOffsets(ordered.length);
      for (const [index, piece] of ordered.entries()) {
        const px = x + offsets[index];
        ctx.save();
        ctx.shadowColor = 'rgba(36,20,8,.32)';
        ctx.shadowBlur = 5;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = fill;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px,y,18,0,Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.font = '950 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(piece.id.split('-').at(-1), px, y + 5);
        ctx.restore();
      }
    }
    const home = color => (g.pieces?.[color] || []).filter(piece => piece.status === 'home').length;
    const done = color => (g.pieces?.[color] || []).filter(piece => piece.status === 'finished').length;
    ctx.textAlign = 'left';
    ctx.font = '850 18px system-ui, sans-serif';
    ctx.fillStyle = '#1d4ed8'; ctx.fillText(`파랑 집 ${home('black')} · 완주 ${done('black')}`, 120, 690);
    ctx.fillStyle = '#b91c1c'; ctx.fillText(`빨강 집 ${home('white')} · 완주 ${done('white')}`, 390, 690);
  }

  function dotsLayout() {
    return { pad: 82, gap: (canvas.width - 164) / 4 };
  }

  function dotsEdgeEndpoints(edgeId) {
    const { pad, gap } = dotsLayout();
    if (edgeId < 20) {
      const row = Math.floor(edgeId / 4);
      const col = edgeId % 4;
      return [pad + col * gap, pad + row * gap, pad + (col + 1) * gap, pad + row * gap];
    }
    const index = edgeId - 20;
    const row = Math.floor(index / 5);
    const col = index % 5;
    return [pad + col * gap, pad + row * gap, pad + col * gap, pad + (row + 1) * gap];
  }

  function drawDotsBoard() {
    const g = state.game;
    const { pad, gap } = dotsLayout();
    const background = ctx.createLinearGradient(0, 0, 720, 720);
    background.addColorStop(0, '#e7efff');
    background.addColorStop(1, '#a9c4ec');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, 720, 720);

    for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) {
      const owner = g.boxes?.[row]?.[col];
      if (!owner) continue;
      ctx.fillStyle = owner === 'black' ? 'rgba(37,99,235,.32)' : 'rgba(239,68,68,.32)';
      ctx.fillRect(pad + col * gap + 12, pad + row * gap + 12, gap - 24, gap - 24);
      ctx.fillStyle = owner === 'black' ? '#1d4ed8' : '#b91c1c';
      ctx.font = '950 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(owner === 'black' ? 'P' : 'R', pad + (col + .5) * gap, pad + (row + .5) * gap + 11);
    }

    const lastEdge = g.lastMove?.edgeId;
    for (let edgeId = 0; edgeId < 40; edgeId += 1) {
      const owner = edgeId < 20
        ? g.edges?.h?.[Math.floor(edgeId / 4)]?.[edgeId % 4]
        : g.edges?.v?.[Math.floor((edgeId - 20) / 5)]?.[(edgeId - 20) % 5];
      const [x1,y1,x2,y2] = dotsEdgeEndpoints(edgeId);
      ctx.strokeStyle = owner ? (owner === 'black' ? '#2563eb' : '#ef4444') : 'rgba(71,85,105,.24)';
      ctx.lineWidth = owner ? (edgeId === lastEdge ? 15 : 11) : 5;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      if (edgeId === lastEdge) {
        ctx.strokeStyle = 'rgba(255,255,255,.8)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      }
    }

    if (hover && canPlace(hover.x, hover.y)) {
      const [x1,y1,x2,y2] = dotsEdgeEndpoints(hover.x);
      ctx.strokeStyle = seat === 'black' ? 'rgba(37,99,235,.72)' : 'rgba(239,68,68,.72)';
      ctx.lineWidth = 13;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    }
    for (let row = 0; row < 5; row += 1) for (let col = 0; col < 5; col += 1) {
      const x = pad + col * gap;
      const y = pad + row * gap;
      ctx.fillStyle = '#172554';
      ctx.beginPath(); ctx.arc(x,y,12,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x-3,y-3,3,0,Math.PI*2); ctx.fill();
    }
  }

  function cityCellPosition(index) {
    const pad = 86;
    const step = 91;
    if (index <= 6) return [pad + index * step, pad];
    if (index <= 12) return [pad + 6 * step, pad + (index - 6) * step];
    if (index <= 18) return [pad + (18 - index) * step, pad + 6 * step];
    return [pad, pad + (24 - index) * step];
  }

  function selectCityTileFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) * canvas.width / rect.width;
    const y = (event.clientY - rect.top) * canvas.height / rect.height;
    let selected = null;
    let best = 52 * 52;
    for (const tile of state?.game?.tiles || []) {
      const [cx, cy] = cityCellPosition(tile.index);
      const distance = (cx - x) ** 2 + (cy - y) ** 2;
      if (distance <= best) { best = distance; selected = tile.index; }
    }
    if (selected === null) return;
    citySelectedTileIndex = selected;
    renderCityControls();
    drawCityBoard();
  }

  function drawCityBoard() {
    const g = state.game;
    const bg = ctx.createLinearGradient(0, 0, 720, 720);
    bg.addColorStop(0, '#172554');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 720, 720);
    ctx.fillStyle = 'rgba(30,64,175,.22)';
    ctx.fillRect(140, 140, 440, 440);
    ctx.fillStyle = '#dbeafe';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '950 35px system-ui, sans-serif';
    ctx.fillText('랜드킹', 360, 285);
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`턴 ${g.turnCount || 0} / ${g.turnLimit || 50}`, 360, 326);
    ctx.fillStyle = '#cbd5e1';
    if (g.status === 'playing') ctx.fillText(`${seatKo(g.turn)} 차례`, 360, 365);
    else if (g.status === 'finished') ctx.fillText(`${seatKo(g.winner)} 승리`, 360, 365);
    else if (g.status === 'draw') ctx.fillText('무승부', 360, 365);

    for (const tile of g.tiles || []) {
      const [x, y] = cityCellPosition(tile.index);
      const owner = g.owners?.[tile.index];
      ctx.fillStyle = tile.type === 'property' ? '#f8fafc' : tile.type === 'event' ? '#fef3c7' : tile.type === 'tax' ? '#fee2e2' : tile.type === 'start' ? '#bfdbfe' : '#e2e8f0';
      ctx.fillRect(x - 39, y - 39, 78, 78);
      ctx.strokeStyle = owner === 'black' ? '#2563eb' : owner === 'white' ? '#ef4444' : '#475569';
      ctx.lineWidth = owner ? 5 : 2;
      ctx.strokeRect(x - 39, y - 39, 78, 78);
      if (tile.index === citySelectedTileIndex) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 33, y - 33, 66, 66);
      }
      if (g.turn && g.status === 'playing' && g.players?.[g.turn]?.position === tile.index) {
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.strokeRect(x - 43, y - 43, 86, 86);
      }
      ctx.fillStyle = '#172033';
      ctx.font = '900 12px system-ui, sans-serif';
      const words = String(tile.name).length > 4 ? [String(tile.name).slice(0, 4), String(tile.name).slice(4)] : [String(tile.name)];
      words.forEach((word, i) => ctx.fillText(word, x, y - 8 + i * 15));
      if (tile.type === 'property') {
        ctx.font = '750 10px system-ui, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(`${tile.price} / ${g.tolls?.[tile.index] ?? tile.toll}`, x, y + 27);
        if (owner) {
          const level = Math.max(0, Math.min(3, Number(g.developments?.[tile.index]) || 0));
          ctx.fillStyle = '#1d4ed8';
          ctx.font = '900 10px system-ui, sans-serif';
          ctx.fillText(`${['도시', '별장', '빌딩', '호텔'][level]} · ${level}단계`, x, y - 29);
        }
      }
    }
    for (const color of ['black', 'white']) {
      const player = g.players?.[color];
      if (!player) continue;
      const animatedPosition = cityAnimation?.color === color ? cityAnimation.position : player.position;
      const [x, y] = cityCellPosition(animatedPosition);
      const offset = color === 'black' ? -16 : 16;
      ctx.fillStyle = color === 'black' ? '#2563eb' : '#ef4444';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x + offset, y - 18, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '950 12px system-ui, sans-serif';
      ctx.fillText(color === 'black' ? 'P' : 'R', x + offset, y - 17);
    }
    ctx.textAlign = 'left';
    ctx.font = '850 17px system-ui, sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.fillText(`파랑 ${g.players?.black?.cash ?? 0}`, 150, 665);
    ctx.fillStyle = '#fca5a5';
    ctx.fillText(`빨강 ${g.players?.white?.cash ?? 0}`, 450, 665);
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
    if (state?.gameType === 'yut' || state?.gameType === 'cityking') return null;
    if (state?.gameType === 'dots') {
      let best = null;
      for (let edgeId = 0; edgeId < 40; edgeId += 1) {
        const [x1,y1,x2,y2] = dotsEdgeEndpoints(edgeId);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length2 = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length2));
        const distance = Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
        if (!best || distance < best.distance) best = { edgeId, distance };
      }
      return best && best.distance <= 30 ? { x: best.edgeId, y: 0 } : null;
    }
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
    if (state?.gameType === 'baseball' || state?.gameType === 'yut' || state?.gameType === 'cityking' || state?.gameType === 'bingo' || state?.gameType === 'liar' || state?.gameType === 'oldmaid') return false;
    if (!state || !seat || state.game.status !== 'playing') return false;
    if (isTeamGame() ? (state.game.paused || state.game.nextSeat !== seat) : state.game.turn !== seat) return false;
    if (state.gameType === 'othello') {
      return (state.game.legalMoves || []).some((move) => move.x === x && move.y === y);
    }
    if (state.gameType === 'connect4') {
      return Number.isInteger(x) && x >= 0 && x < 7 && !state.game.board?.[0]?.[x]
        && (state.game.legalColumns || []).includes(x);
    }
    if (state.gameType === 'dots') return (state.game.legalEdges || []).includes(x);
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

  function validBaseballInput(value, digitCount) {
    const digits = Number(digitCount) === 4 ? 4 : 3;
    return new RegExp(`^[1-9][0-9]{${digits - 1}}$`).test(value) && new Set(value).size === digits;
  }

  async function sendBaseballAction(event, action, input, name) {
    event.preventDefault();
    const value = input.value.trim();
    const digitCount = state?.game?.digitCount || 3;
    if (!validBaseballInput(value, digitCount)) return showToast(`첫 자리가 0이 아닌 서로 다른 숫자 ${digitCount}개를 입력해 주세요.`, 4000);
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

  otherRecordsBtn.addEventListener('click', () => openPlayerRecords());
  recordsCloseBtn.addEventListener('click', () => recordsDialog.close());
  recordsSearchForm.addEventListener('submit', searchRecordPlayers);
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
  logoutBtn.addEventListener('click', requestLogout);
  roomLogoutBtn.addEventListener('click', requestLogout);
  logoutCancelBtn.addEventListener('click', () => logoutDialog.close());
  logoutConfirmBtn.addEventListener('click', () => { logoutDialog.close(); logout(); });
  createRoomBtn.addEventListener('click', createRoom);
  newRoomBtn.addEventListener('click', createRoom);
  refreshPublicRoomsBtn.addEventListener('click', () => loadPublicRooms().catch(err => showToast(err.message, 3500)));
  refreshInviteTargetsBtn.addEventListener('click', () => loadInviteTargets().catch(err => showToast(err.message, 3500)));
  gameRulesSelect.addEventListener('change', () => showGameRule(gameRulesSelect.value));
  omokModeChoices.addEventListener('change', () => {
    if (selectedGameType === 'omok') selectGame('omok');
  });
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
  yutThrowBtn.addEventListener('click', () => roomAction('throw-yut'));
  bingoTargetSelect.addEventListener('change', () => roomAction('set-bingo-target', { targetLines: Number(bingoTargetSelect.value) }));
  bingoStartBtn.addEventListener('click', () => roomAction('start-bingo'));
  cityRollBtn.addEventListener('click', async () => {
    const expectedMoveCount = state?.game?.moveCount ?? 0;
    cityRollBtn.disabled = true;
    await roomAction('roll-city', { expectedMoveCount });
    if (state?.gameType === 'cityking') renderCityControls();
  });
  cityBuyBtn.addEventListener('click', () => roomAction('buy-city'));
  citySkipBtn.addEventListener('click', () => roomAction('skip-city'));
  cityBuildBtn.addEventListener('click', () => roomAction('build-city'));
  cityBuildSkipBtn.addEventListener('click', () => roomAction('skip-build-city'));
  cityTileSelect.addEventListener('change', () => {
    if (state?.gameType !== 'cityking') return;
    const index = Number(cityTileSelect.value);
    if (!Number.isInteger(index) || !state.game.tiles?.[index]) return;
    citySelectedTileIndex = index;
    renderCityControls();
    drawCityBoard();
  });

  oldmaidStartBtn.addEventListener('click', () => roomAction('start-oldmaid'));
  oldmaidShuffleBtn.addEventListener('click', async () => {
    if (oldmaidShuffleBtn.disabled || !state) return;
    oldmaidShuffleBtn.disabled = true;
    await roomAction('shuffle-oldmaid', { expectedRevision: state.game.revision });
  });

  liarRoundsSelect.addEventListener('change', () => roomAction('set-liar-rounds', { totalRounds: Number(liarRoundsSelect.value) }));
  liarStartBtn.addEventListener('click', () => roomAction('start-liar'));
  liarHintForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const hint = liarHintInput.value.trim();
    if (!hint) return;
    const phaseId = state?.game?.phaseId;
    liarHintInput.disabled = true;
    try { await roomAction('liar-hint', { hint, expectedPhaseId: phaseId }); liarHintInput.value = ''; }
    finally { liarHintInput.disabled = false; }
  });
  liarGuessForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const guess = liarGuessInput.value.trim();
    if (!guess) return;
    const phaseId = state?.game?.phaseId;
    liarGuessInput.disabled = true;
    try { await roomAction('liar-guess', { guess, expectedPhaseId: phaseId }); liarGuessInput.value = ''; }
    finally { liarGuessInput.disabled = false; }
  });

  pictionaryStartBtn.addEventListener('click', () => roomAction('start-pictionary'));
  pictionaryClearBtn.addEventListener('click', () => { redrawPictionaryCanvas(); roomAction('pictionary-clear'); });
  pictionaryEraserBtn.addEventListener('click', () => {
    pictionaryTool = pictionaryTool === 'eraser' ? 'pen' : 'eraser';
    pictionaryEraserBtn.classList.toggle('selected', pictionaryTool === 'eraser');
  });
  pictionaryCanvas.addEventListener('pointerdown', pictionaryPointerDown);
  pictionaryCanvas.addEventListener('pointermove', pictionaryPointerMove);
  pictionaryCanvas.addEventListener('pointerup', pictionaryPointerUp);
  pictionaryCanvas.addEventListener('pointerleave', pictionaryPointerUp);
  pictionaryCanvas.addEventListener('pointercancel', pictionaryPointerUp);
  pictionaryGuessForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const guess = pictionaryGuessInput.value.trim();
    if (!guess) return;
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const data = await api('/api/room/pictionary-guess', { method: 'POST', body: JSON.stringify({ guess }) });
      if (data.state) { state = data.state; renderRoom(); }
      pictionaryGuessInput.value = '';
      showToast(state.game.correctGuessers.includes(seat) ? '정답입니다!' : '오답입니다. 다시 시도해 보세요.', 2200);
    } catch (err) { showToast(err.message, 2800); }
    finally { button.disabled = false; }
  });
  setInterval(() => {
    if (state?.gameType !== 'pictionary' || pictionaryPanel.classList.contains('hidden')) return;
    const g = state.game;
    const endsAt = g.phase === 'drawing' ? g.roundEndsAt : g.phase === 'reveal' ? g.revealEndsAt : null;
    if (!endsAt) return;
    pictionaryTimer.textContent = g.phase === 'reveal' ? `결과 공개 · ${pictionaryCountdownText(endsAt)}` : pictionaryCountdownText(endsAt);
  }, 1000);

  setInterval(() => {
    if (state?.gameType !== 'liar' || liarPanel.classList.contains('hidden')) return;
    if (!state.game.deadlineAt) return;
    liarTimer.textContent = liarCountdownText(state.game.deadlineAt);
  }, 1000);
  copyRoomCodeBtn.addEventListener('click', copyRoomCode);
  for (const details of document.querySelectorAll('.collapsibleInfo')) {
    const arrow = details.querySelector('.collapsibleArrow');
    if (!arrow) continue;
    details.addEventListener('toggle', () => { arrow.textContent = details.open ? '▼' : '▶'; });
  }
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
    if (state?.gameType === 'cityking') { selectCityTileFromPointer(ev); return; }
    const p = canvasPoint(ev);
    if (!p || !canPlace(p.x, p.y)) return;
    roomAction('move', state?.gameType === 'connect4' ? { x: p.x } : p);
  });

  selectGame('omok');
  drawBoard();
  loadSession();
})();
