(() => {
  'use strict';

  // v1.10.63 테마 (IDEAS 2026-10-11): dark by default, light, or the device's own setting -- kept per browser.
  // <html data-theme> is what the light layer (theme-light.css) keys on; the menu's 환경설정 changes it.
  const THEMES = ['dark', 'light', 'system'];
  const themeMedia = window.matchMedia('(prefers-color-scheme: light)');
  let themeChoice = 'dark';
  try { const saved = localStorage.getItem('gc.theme'); if (THEMES.includes(saved)) themeChoice = saved; } catch {}
  function applyTheme() { document.documentElement.dataset.theme = themeChoice === 'system' ? (themeMedia.matches ? 'light' : 'dark') : themeChoice; }
  applyTheme();
  themeMedia.addEventListener('change', applyTheme);
  for (const radio of document.querySelectorAll('input[name="gcTheme"]')) {
    radio.checked = radio.value === themeChoice;
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      themeChoice = radio.value; applyTheme();
      try { localStorage.setItem('gc.theme', themeChoice); } catch {}
    });
  }

  const gateView = document.getElementById('gateView');
  const lobbyView = document.getElementById('lobbyView');
  const roomView = document.getElementById('roomView');
  const chatPipBtn = document.getElementById('chatPipBtn');
  const gameInfoPipBtn = document.getElementById('gameInfoPipBtn');
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
  const adminWindowBtn = document.getElementById('adminWindowBtn');
  // 관리자 「문제 기록」: the last few browser errors and the frame rate, kept quietly to go with a record
  const recentErrors = []; const keepError = (text) => { recentErrors.push({ at: Date.now(), text: String(text).slice(0, 300) }); if (recentErrors.length > 8) recentErrors.shift(); };
  // (문제 기록 진단: where it broke too -- the file:line:column and the stack's first frame)
  const firstFrame = (err) => String(err?.stack || '').split('\n').map((l) => l.trim()).find((l) => l.startsWith('at ')) || '';
  window.addEventListener('error', (event) => keepError(`${event.message || event.error} @ ${String(event.filename || '').split('/').pop()}:${event.lineno}:${event.colno} ${firstFrame(event.error)}`));
  window.addEventListener('unhandledrejection', (event) => keepError(`${event.reason?.message || event.reason} ${firstFrame(event.reason)}`));
  { const realError = console.error.bind(console); console.error = (...args) => { keepError(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); realError(...args); }; }
  let fpsNow = null; { let n = 0; let t0 = performance.now(); const tick = (t) => { n += 1; if (t - t0 >= 2000) { fpsNow = Math.round((n * 1000) / (t - t0)); n = 0; t0 = t; } requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
  const myInfoBtn = document.getElementById('myInfoBtn');
  const myInfoDialog = document.getElementById('myInfoDialog');
  const myInfoCloseBtn = document.getElementById('myInfoCloseBtn');
  const myInfoSkinBody = document.getElementById('myInfoSkinBody');
  const myInfoSkinStatus = document.getElementById('myInfoSkinStatus');

  const logoutDialog = document.getElementById('logoutDialog');
  const logoutCancelBtn = document.getElementById('logoutCancelBtn');
  const logoutConfirmBtn = document.getElementById('logoutConfirmBtn');
  const pauseDialog = document.getElementById('pauseDialog');
  const pauseDialogMessage = document.getElementById('pauseDialogMessage');
  const pauseWaitBtn = document.getElementById('pauseWaitBtn');
  const pauseEndBtn = document.getElementById('pauseEndBtn');
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
  const recordsHeadToHead = document.getElementById('recordsHeadToHead');
  const h2hSummary = document.getElementById('h2hSummary');
  const h2hGame = document.getElementById('h2hGame');
  const h2hDetail = document.getElementById('h2hDetail');
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
  const myActionTimer = document.getElementById('myActionTimer');
  const myActionTimerLabel = document.getElementById('myActionTimerLabel');
  const myActionTimerClock = document.getElementById('myActionTimerClock');
  const myActionTimerResult = document.getElementById('myActionTimerResult');
  const statusText = document.getElementById('statusText');
  const seatLabel = document.getElementById('seatLabel');
  const recentActionLine = document.getElementById('recentActionLine');
  const standardPlayers = document.getElementById('standardPlayers');
  const teamPlayers = document.getElementById('teamPlayers');
  const standardRoleButtons = document.getElementById('standardRoleButtons');
  const teamRoleButtons = document.getElementById('teamRoleButtons');
  const teamSeatButtons = [...document.querySelectorAll('[data-team-seat]')];
  const teamSpectatorBtn = document.getElementById('teamSpectatorBtn');
  const blackPlayer = document.getElementById('blackPlayer');
  const whitePlayer = document.getElementById('whitePlayer');
  const roleChooser = document.getElementById('roleChooser');
  const turnNotifyBtn = document.getElementById('turnNotifyBtn');
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
  const yutSticks = [1, 2, 3, 4].map(n => document.getElementById(`yutStick${n}`));
  // v1.6.55: common dice/yut animation stage, embedded inside #gameInfoPanel (see below).
  const diceYutSection = document.getElementById('diceYutSection');
  const diceYutStage = document.getElementById('diceYutStage');
  const diceYutResult = document.getElementById('diceYutResult');
  const bingoPanel = document.getElementById('bingoPanel');
  const bingoSetupRow = document.getElementById('bingoSetupRow');
  const bingoGridSelect = document.getElementById('bingoGridSelect');
  const bingoPoolSelect = document.getElementById('bingoPoolSelect');
  const bingoTargetSelect = document.getElementById('bingoTargetSelect');
  const bingoStartBtn = document.getElementById('bingoStartBtn');
  const bingoStatus = document.getElementById('bingoStatus');
  const bingoSelectedNumbers = document.getElementById('bingoSelectedNumbers');
  const bingoLineSummary = document.getElementById('bingoLineSummary');
  const bingoBoard = document.getElementById('bingoBoard');
  const cityControls = document.getElementById('cityControls');
  const cityActionPanel = document.getElementById('cityActionPanel');
  const cityLastRoll = document.getElementById('cityLastRoll');
  const cityStartBtn = document.getElementById('cityStartBtn');
  const cityRollBtn = document.getElementById('cityRollBtn');
  const cityLiquidateBanner = document.getElementById('cityLiquidateBanner');
  const cityResultSummary = document.getElementById('cityResultSummary');
  const cityTileDetailsToggle = document.getElementById('cityTileDetailsToggle');
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
  const cityTileBuildCost = document.getElementById('cityTileBuildCost');
  const cityTileSellValue = document.getElementById('cityTileSellValue');
  const cityTileSellRow = document.getElementById('cityTileSellRow');
  const citySellBuildingBtn = document.getElementById('citySellBuildingBtn');
  const citySellPropertyBtn = document.getElementById('citySellPropertyBtn');
  const cityTileSellPreview = document.getElementById('cityTileSellPreview');
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
  const pictionaryConfig = document.getElementById('pictionaryConfig');
  const pictionaryShowCategory = document.getElementById('pictionaryShowCategory');
  const pictionaryHints = document.getElementById('pictionaryHints');
  const pictionaryPenBtn = document.getElementById('pictionaryPenBtn');
  const pictionaryUndoBtn = document.getElementById('pictionaryUndoBtn');
  const pictionaryGuessLog = document.getElementById('pictionaryGuessLog');
  const pictionaryRuleNote = document.querySelector('.pictionaryRuleNote');
  const halliPanel = document.getElementById('halliPanel');
  const halliStatus = document.getElementById('halliStatus');
  const halliCards = document.getElementById('halliCards');
  const halliBellBtn = document.getElementById('halliBellBtn');
  const halliFlipBtn = document.getElementById('halliFlipBtn');
  const halliStartBtn = document.getElementById('halliStartBtn');
  const halliSetupRow = document.getElementById('halliSetupRow');
  const halliTimeSelect = document.getElementById('halliTimeSelect');
  const halliLastBell = document.getElementById('halliLastBell');
  const halliTransferResult = document.getElementById('halliTransferResult');
  const halliTransferDetails = document.getElementById('halliTransferDetails');
  const halliBellLog = document.getElementById('halliBellLog');
  let halliClockOffset = 0;
  const davinciPanel = document.getElementById('davinciPanel');
  const gostopPanel = document.getElementById('gostopPanel');
  const pandemicPanel = document.getElementById('pandemicPanel');
  const PANDEMIC_ROLE_KO = { contingency: '비상 대책 설계자', dispatcher: '운항관리자', medic: '위생병', operations: '건축 전문가', quarantine: '검역 전문가', researcher: '연구자', scientist: '과학자' };
  const rpgPanel = document.getElementById('rpgPanel');
  const rpgStage = document.getElementById('rpgStage');
  // 잿빛 원정: the 3D client is an ES module loaded only when an RPG room is shown, and fully
  // unmounted (frame loop, WebGL resources, key listeners) as soon as it is not.
  const rpgBridge = { controller: null, loading: null, latest: null, generation: 0 };
  // v1.7.22: 잿빛 원정 is played with the keyboard (arrows, Space, Q/W/E/R, Shift); there are no touch controls yet,
  // so a device whose only pointer is coarse (a phone or tablet without a mouse/trackpad) cannot start or play it.
  const rpgTouchOnly = () => window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
  const RPG_PC_ONLY = '잿빛 원정은 키보드가 필요해 PC에서만 할 수 있습니다.';
  function rpgRender(roomState) {
    rpgBridge.latest = roomState;
    if (rpgBridge.controller) { rpgBridge.controller.update(roomState); return; }
    if (rpgTouchOnly()) { // joined an RPG room from a touch device (invite/code/list): say so instead of loading the 3D client
      if (!rpgStage.querySelector('.rpgTouchNotice')) { const note = document.createElement('p'); note.className = 'rpgTouchNotice'; note.textContent = `${RPG_PC_ONLY} 방에서 나가 다른 게임을 골라 주세요.`; rpgStage.replaceChildren(note); }
      return;
    }
    if (rpgBridge.loading) return;
    const generation = ++rpgBridge.generation;
    rpgBridge.loading = import('/rpg/rpg-client.js').then((mod) => {
      rpgBridge.loading = null;
      if (generation !== rpgBridge.generation || !isRpgGame()) return;
      rpgBridge.controller = mod.mount(rpgStage, {
        post: (action, payload) => roomAction(action, payload),
        fast: (action, payload) => api(`/api/room/${action}`, { method: 'POST', body: JSON.stringify(payload) }).catch(() => null),
      });
      rpgBridge.controller.update(rpgBridge.latest);
    }).catch((error) => { rpgBridge.loading = null; console.error(error); showToast('3D 화면을 불러오지 못했습니다. 새로고침해 주세요.', 4000); });
  }
  function rpgUnmount() {
    rpgBridge.generation += 1;
    rpgBridge.loading = null;
    if (rpgBridge.controller) { rpgBridge.controller.unmount(); rpgBridge.controller = null; }
    if (rpgStage.querySelector('.rpgTouchNotice')) rpgStage.replaceChildren();
  }
  window.RpgDebug = () => rpgBridge.controller?.debug() || null;
  const gostopStakeChoices = document.getElementById('gostopStakeChoices');
  const pointWallet = document.getElementById('pointWallet');
  const pointBalanceText = document.getElementById('pointBalanceText');
  const roomPointRule = document.getElementById('roomPointRule');
  const attendanceBtn = document.getElementById('attendanceBtn');
  const pointHistoryBtn = document.getElementById('pointHistoryBtn');
  const pointHistoryPanel = document.getElementById('pointHistoryPanel');
  const pointHistoryList = document.getElementById('pointHistoryList');
  const pointHistoryStatus = document.getElementById('pointHistoryStatus');
  const pointHistoryMore = document.getElementById('pointHistoryMore');
  const pointHistoryClose = document.getElementById('pointHistoryClose');
  const roomPointBadge = document.getElementById('roomPointBadge');
  const davinciStartBtn = document.getElementById('davinciStartBtn');
  const davinciStatus = document.getElementById('davinciStatus');
  const davinciHands = document.getElementById('davinciHands');
  const davinciPrivate = document.getElementById('davinciPrivate');
  const davinciNumber = document.getElementById('davinciNumber');
  const davinciGuessBtn = document.getElementById('davinciGuessBtn');
  const davinciStopBtn = document.getElementById('davinciStopBtn');
  for (let n = 0; n <= 11; n++) davinciNumber.add(new Option(String(n), String(n)));
  let davinciSelectionPending = false;
  let davinciGuessPending = false;
  let davinciGuessPendingNumber = null;
  let davinciGuessFeedbackKey = null;
  let davinciGuessFeedbackUntil = 0;
  let davinciGuessFeedbackTimer = null;
  const davinciRevealStates = new Map();
  let davinciRevealRound = null;
  let davinciPickerClosedFor = null; // selection key whose number pad I closed with Esc/취소
  let davinciLastDrawKey = null;
  let davinciFxPlayed = null;
  let davinciSpecialPlayed = null;
  let davinciBaselinePending = true; // the first snapshot of an entered room only seeds the keys below (nothing replays)
  let halliPrevStatus = null;
  let davinciPrevStatus = null;
  const oldmaidPanel = document.getElementById('oldmaidPanel');
  const oldmaidStartBtn = document.getElementById('oldmaidStartBtn');
  const oldmaidShuffleBtn = document.getElementById('oldmaidShuffleBtn');
  const oldmaidEffectsToggle = document.getElementById('oldmaidEffectsToggle');
  const oldmaidModeChooser = document.getElementById('oldmaidModeChooser');
  const oldmaidModeRadios = document.querySelectorAll('[data-oldmaid-mode]');
  const oldmaidAbilityBar = document.getElementById('oldmaidAbilityBar');
  const oldmaidAbilityLabel = document.getElementById('oldmaidAbilityLabel');
  const oldmaidAbilityUseBtn = document.getElementById('oldmaidAbilityUseBtn');
  const oldmaidAbilityDesc = document.getElementById('oldmaidAbilityDesc');
  const oldmaidAbilityHint = document.getElementById('oldmaidAbilityHint');
  const oldmaidAbilityReveal = document.getElementById('oldmaidAbilityReveal');
  const oldmaidStatus = document.getElementById('oldmaidStatus');
  const oldmaidResult = document.getElementById('oldmaidResult');
  const oldmaidSeatsEl = document.getElementById('oldmaidSeats');
  const oldmaidFlyerLayer = document.getElementById('oldmaidFlyer');
  const oldmaidMyHand = document.getElementById('oldmaidMyHand');
  const oldmaidHistory = document.getElementById('oldmaidHistory');
  const liarPanel = document.getElementById('liarPanel');
  const liarSetupRow = document.getElementById('liarSetupRow');
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
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatLockNotice = document.getElementById('chatLockNotice');
  const systemMessages = document.getElementById('systemMessages');
  const chatJumpBtn = document.getElementById('chatJumpBtn');
  const chatUnreadBadge = document.getElementById('chatUnreadBadge');
  const chatFloatBtn = document.getElementById('chatFloatBtn');
  const chatFloatBadge = document.getElementById('chatFloatBadge');
  const gameInfoFloatBtn = document.getElementById('gameInfoFloatBtn');
  const chatPanel = document.getElementById('chatPanel');
  const chatCollapseBtn = document.getElementById('chatCollapseBtn');
  const chatResetBtn = document.getElementById('chatResetBtn');
  const gameInfoPanel = document.getElementById('gameInfoPanel');
  const gameInfoCollapseBtn = document.getElementById('gameInfoCollapseBtn');
  const gameInfoResetBtn = document.getElementById('gameInfoResetBtn');
  const sideOverlayBackdrop = document.getElementById('sideOverlayBackdrop');
  const gameLayoutEl = document.querySelector('#roomView .gameLayout');
  const boardCardEl = document.querySelector('#roomView .boardCard');
  const sideColumnEl = document.querySelector('#roomView .sideColumn');
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
  let cityRollTrackingStarted = false;
  let cityAnimation = null;
  let cityAnimationFrame = null;
  let cityDiceAnimating = false;
  let yutLastThrowKey = null;
  let yutThrowTrackingStarted = false;
  let yutThrowAnimating = false;
  let yutLastThrowFlags = null;
  // v1.6.57: step-by-step piece movement. yutPieceAnimation is read by drawYutBoard() to draw the
  // moving piece(s) at an interpolated in-transit position instead of their (already server-final)
  // resting spot -- purely cosmetic, state.game.pieces is never touched by it. yutMoveAnimationGen
  // guards against a second move's animation starting while an earlier one is still mid-flight (a
  // bonus throw can chain quickly): each animateYutPieceMove() call claims the next generation, and
  // every in-flight frame/timeout checks it's still current before continuing, so an overtaken
  // animation just quietly stops instead of fighting the newer one for the same canvas.
  let yutLastMoveKey = null;
  let yutMoveTrackingStarted = false;
  let yutPieceAnimation = null; // { pieceIds: Set<string>, x, y } while a move is animating, else null
  let yutTrail = []; // recent in-transit positions of the moving piece, for skins that leave a trail (v1.7.37)
  let yutMoveAnimationGen = 0;
  // v1.6.83: direct on-board piece selection. yutMovePending blocks every further move request
  // (board click, double click, fallback button) from the moment one is sent until the server
  // answers; yutHoverTargetKey only brightens the pointed-at/focused target and never gates input.
  let yutMovePending = false;
  let yutHoverTargetKey = null;
  let state = null;
  let seat = null;
  let isHost = false;
  let pauseDialogShownKey = null;
  let pauseDialogDismissedKey = null;
  let pauseDialogPendingKey = null;
  let pauseDialogShowTimer = null;
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
  let resultDelayTimer = null; // v1.8.7: a legend win plays on the board first, then the result banner
  let lastResultEffectKey = null;
  let actionTimerClockOffset = 0;

  // v1.6.80: one shared visual language for "what just changed?" across every game.
  // The first render after entering/reconnecting keeps the persistent marker but deliberately skips
  // the pulse, so stale server state never masquerades as a brand-new action.
  const RECENT_ACTION_FLASH_MS = 720;
  let recentActionContextKey = null;
  let recentActionKey = null;
  let recentActionStartedAt = 0;
  let recentActionFrame = null;

  function resetRecentActionTracking() {
    recentActionContextKey = null;
    recentActionKey = null;
    recentActionStartedAt = 0;
    if (recentActionFrame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(recentActionFrame);
    recentActionFrame = null;
  }

  function observeRecentAction(key) {
    const game = state?.game;
    const context = `${state?.gameType || ''}:${game?.round ?? game?.roundNumber ?? 0}`;
    const normalized = key === null || key === undefined || key === '' ? null : `${context}:${String(key)}`;
    const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
    if (context !== recentActionContextKey) {
      recentActionContextKey = context;
      recentActionKey = normalized;
      recentActionStartedAt = 0;
    } else if (normalized && normalized !== recentActionKey) {
      recentActionKey = normalized;
      recentActionStartedAt = now;
    }
    const elapsed = recentActionStartedAt ? now - recentActionStartedAt : Infinity;
    const strength = Math.max(0, Math.min(1, 1 - elapsed / RECENT_ACTION_FLASH_MS));
    return { fresh: strength > 0, strength };
  }

  function recentActionClasses(recent, role = 'target') {
    if (!recent) return '';
    const base = role === 'actor' ? ' recentActionActor' : role === 'source' ? ' recentActionSource' : ' recentActionTarget';
    return `${base}${recent.fresh ? ' recentActionFresh' : ''}`;
  }

  function scheduleRecentActionCanvas(recent, redraw = drawBoard) {
    if (!recent?.fresh || recentActionFrame || typeof requestAnimationFrame !== 'function') return;
    recentActionFrame = requestAnimationFrame(() => {
      recentActionFrame = null;
      if (state) redraw();
    });
  }

  function drawRecentActionRing(x, y, radius, recent, { secondary = false, square = false } = {}) {
    if (!recent) return;
    const pulse = recent.strength || 0;
    ctx.save();
    ctx.strokeStyle = secondary
      ? `rgba(255,255,255,${0.36 + pulse * 0.34})`
      : `rgba(250,204,21,${0.7 + pulse * 0.25})`;
    ctx.lineWidth = secondary ? 2 + pulse * 2 : 3 + pulse * 3;
    ctx.setLineDash(secondary ? [5, 4] : []);
    if (square) ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
    else {
      ctx.beginPath();
      ctx.arc(x, y, radius + pulse * 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    scheduleRecentActionCanvas(recent);
  }

  window.GameRecentAction = { observe: observeRecentAction, classes: recentActionClasses };

  // v1.6.82: one shared visual language for "what can I act on right now?". It is deliberately
  // unlike the recent-action marker above (amber outline + one-shot pulse): a steady mint glow drawn
  // with box-shadow (so both markers can sit on the same element) and, on canvases, mint rings/dots.
  // Every caller derives it from the exact condition that already enables that control (server
  // legal-move lists, turn/phase checks, disabled state) -- never a new client-side rule -- and only
  // for my own seat, so spectators and other players' options never light up, and no private value
  // is ever encoded into a class name or data attribute.
  const ACTIONABLE_RGB = '52,211,153';
  const ACTIONABLE_ROLES = { target: 'actionableTarget', primary: 'actionablePrimary', area: 'actionableArea' };

  function actionWindowOpen(g = state?.game) {
    return Boolean(state && seat && g && g.status === 'playing' && !g.paused);
  }

  function actionableClasses(on, role = 'target') {
    return on ? ` ${ACTIONABLE_ROLES[role] || ACTIONABLE_ROLES.target}` : '';
  }

  function setActionable(el, on, role = 'target') {
    if (!el) return;
    const wanted = on ? (ACTIONABLE_ROLES[role] || ACTIONABLE_ROLES.target) : null;
    for (const name of Object.values(ACTIONABLE_ROLES)) el.classList.toggle(name, name === wanted);
  }

  function drawActionableMark(x, y, radius, { dashed = false, square = false, rgb = ACTIONABLE_RGB, alpha = .88, width = 3, fill = false } = {}) {
    ctx.save();
    ctx.strokeStyle = `rgba(${rgb},${alpha})`;
    ctx.fillStyle = `rgba(${rgb},${alpha * .6})`;
    ctx.lineWidth = width;
    ctx.setLineDash(dashed ? [6, 5] : []);
    // Filled dots (omok/othello can draw hundreds per hover repaint) skip the costlier blur.
    if (!fill) {
      ctx.shadowColor = `rgba(${rgb},.5)`;
      ctx.shadowBlur = 6;
    }
    if (square) ctx.strokeRect(x - radius, y - radius, radius * 2, radius * 2);
    else {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      if (fill) ctx.fill(); else ctx.stroke();
    }
    ctx.restore();
  }

  // Grid boards whose whole surface is the input: frame the board itself while it is my move.
  function boardTurnActionable() {
    const g = state?.game;
    if (!actionWindowOpen(g)) return false;
    if (!['omok', 'omok2v2', 'othello', 'connect4', 'dots'].includes(state.gameType)) return false;
    if ((isTeamGame() ? g.nextSeat : g.turn) !== seat) return false;
    if (state.gameType === 'othello') return (g.legalMoves || []).length > 0;
    if (state.gameType === 'connect4') return (g.legalColumns || []).length > 0;
    if (state.gameType === 'dots') return (g.legalEdges || []).length > 0;
    return true;
  }

  window.GameActionable = { classes: actionableClasses, set: setActionable, windowOpen: actionWindowOpen };

  // Room sidebar (chat/system/room-info) state. v1.6.72 measures the board only to keep a
  // short game from being paired with a much taller sidebar; the measured value is always capped
  // by the viewport space remaining below the room header, so tall games can never push the chat
  // input or game controls below the visible window.
  // v1.6.58: two fully independent sidebar cards -- #chatPanel (chat messages/input only) and
  // #gameInfoPanel (system/room-info tabs, the dice/yut animation stage, every game's own
  // #gameActionsPanel controls, and 기권/재대결/종료) -- replacing the single combined #roomSidebar
  // (which used to hold all of it) and the separately-poppable #diceYutPanel (v1.6.57).
  // v1.6.59: both panels having their own native Document Picture-in-Picture button still meant
  // opening one silently closed the other -- a browser only ever allows ONE such window open at a
  // time, system-wide, not per-tab. Reported live as things randomly vanishing when the player
  // actually wanted both floating at once. #gameInfoPanel keeps the real native PIP (open*GameInfoPip
  // below); #chatPanel now opens as a regular window.open() secondary window instead (see
  // openChatPip below) -- a different browser mechanism with no "one at a time" limit, so it can
  // stay open at the exact same time #gameInfoPanel is floating in its own PIP window.
  const SIDE_SIZE_KEY = 'roomSideSize';
  const CHAT_COLLAPSE_KEY = 'chatPanelCollapsed';
  const GAME_INFO_COLLAPSE_KEY = 'gameInfoPanelCollapsed';
  let chatOverlayOpen = false;
  let chatCollapsedPref = null; // null = no explicit user choice yet; default to open
  try { chatCollapsedPref = localStorage.getItem(CHAT_COLLAPSE_KEY); if (chatCollapsedPref !== null) chatCollapsedPref = chatCollapsedPref === '1'; } catch {}
  let gameInfoActiveTab = 'system';
  let gameInfoOverlayOpen = false;
  let gameInfoCollapsedPref = null;
  try { gameInfoCollapsedPref = localStorage.getItem(GAME_INFO_COLLAPSE_KEY); if (gameInfoCollapsedPref !== null) gameInfoCollapsedPref = gameInfoCollapsedPref === '1'; } catch {}
  let chatUnreadCount = 0;
  let chatAtBottom = true;
  let chatRendering = false;
  const messageListState = new WeakMap(); // container -> { ownId, keys } of what is currently drawn
  let chatLastSeenId = 0;
  let lastRenderedChatIds = [];

  function isMobileLayout() { try { return window.matchMedia('(max-width:880px)').matches; } catch { return false; } }

  function desktopActionTimerOwns(source) {
    return !isMobileLayout() && Boolean(state?.me?.actionTimer && (!source || state.me.actionTimer.source === source));
  }

  function actionTimerText(ms) {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function renderMyActionTimer(syncClock = false) {
    const timer = state?.me?.actionTimer;
    const visible = Boolean(timer && !isMobileLayout());
    myActionTimer.classList.toggle('hidden', !visible);
    if (!visible) return;
    if (syncClock && Number.isFinite(Number(timer.serverNow))) actionTimerClockOffset = Date.now() - Number(timer.serverNow);
    const serverNow = Date.now() - actionTimerClockOffset;
    const remainMs = Math.max(0, Number(timer.deadlineAt) - serverNow);
    myActionTimerLabel.textContent = timer.label || '내 차례';
    myActionTimerClock.textContent = actionTimerText(remainMs);
    myActionTimerResult.textContent = remainMs > 0 ? timer.timeoutText : `서버 처리 대기 · ${timer.timeoutText}`;
    myActionTimer.classList.toggle('expiredPending', remainMs <= 0);
    myActionTimer.setAttribute('aria-label', `${myActionTimerLabel.textContent} ${myActionTimerClock.textContent}. ${myActionTimerResult.textContent}`);
  }

  let roomSideHeightFrame = 0;
  let roomSideResizeObserver = null;

  function syncRoomSideHeight() {
    if (!sideColumnEl || !gameLayoutEl || !boardCardEl) return;
    if (isMobileLayout()) {
      sideColumnEl.style.removeProperty('--room-side-height');
      return;
    }
    const viewportHeight = window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0;
    const layoutTop = gameLayoutEl.getBoundingClientRect().top;
    const boardHeight = boardCardEl.getBoundingClientRect().height;
    const stickyGap = 16;
    const viewportBudget = Math.max(1, viewportHeight - Math.max(layoutTop, stickyGap) - stickyGap);
    const targetHeight = Math.max(1, Math.min(boardHeight || viewportBudget, viewportBudget));
    sideColumnEl.style.setProperty('--room-side-height', `${Math.floor(targetHeight)}px`);
  }

  function scheduleRoomSideHeightSync() {
    if (roomSideHeightFrame) cancelAnimationFrame(roomSideHeightFrame);
    roomSideHeightFrame = requestAnimationFrame(() => {
      roomSideHeightFrame = 0;
      syncRoomSideHeight();
    });
  }

  if (typeof ResizeObserver === 'function' && boardCardEl) {
    roomSideResizeObserver = new ResizeObserver(scheduleRoomSideHeightSync);
    roomSideResizeObserver.observe(boardCardEl);
  }

  // v1.6.56: cityking/oldmaid no longer auto-collapse the sidebar by default. That default existed
  // to give their wide boards more room, back when the sidebar was optional for actually playing
  // them -- now that #gameActionsPanel (start/roll/buy/build buttons etc.) lives inside
  // #gameInfoPanel, collapsing it by default would hide controls a host needs just to start the
  // game. The user can still collapse it manually as before.
  // G-틀① 몰입 화면 (gamecenter-notes docs/gamehall-audit-20261025.md): while a hand is played both side panels fold away
  // -- the board takes the screen; 💬·🎮 in the top bar open them over it
  function chatShouldCollapse() { return chatCollapsedPref === true || document.body.classList.contains('roomPlaying'); }
  function gameInfoShouldCollapse() { return gameInfoCollapsedPref === true || document.body.classList.contains('roomPlaying'); }

  // v1.6.59: a browser only ever allows ONE native Document Picture-in-Picture window open at a
  // time (system-wide, not per-tab) -- so v1.6.58's two independent PIP buttons still fought each
  // other the moment a player actually wanted both floating at once (reported live: opening one
  // silently closed the other). The user picked which panel keeps the real "always on top of
  // everything" PIP behavior: #gameInfoPanel (openGameInfoPip below) stays on `documentPictureInPicture`.
  // #chatPanel instead opens as a REGULAR secondary browser window via `window.open()` -- a
  // completely different browser mechanism with no "one at a time" limit, so it can be open at the
  // very same moment #gameInfoPanel is floating in its own PIP window. The trade-off: this window
  // is an ordinary window (the user can alt-tab it behind other apps, it won't auto-float above
  // them) rather than a true PIP -- reflected in its own "별도 창" wording, never called "PIP", so
  // the button never claims a floating behavior it doesn't have.
  const CHAT_PIP_KEY = 'chatPipPref';
  const chatPipSupported = typeof window.open === 'function';
  let chatPipPref = false;
  try { chatPipPref = localStorage.getItem(CHAT_PIP_KEY) === '1'; } catch {}
  let chatPipWindow = null;
  let chatPanelHome = null; // { parent, next } -- where to put #chatPanel back on close

  function chatPipActive() { return Boolean(chatPipWindow); }

  function updateChatPipBtn() {
    if (!chatPipBtn) return;
    chatPipBtn.classList.toggle('hidden', !chatPipSupported);
    chatPipBtn.textContent = chatPipActive() ? '별도 창 닫기' : '별도 창으로 보기';
    chatPipBtn.setAttribute('aria-pressed', chatPipActive() ? 'true' : 'false');
  }

  function closeChatPip() {
    // Closing itself finishes the job via the pagehide handler registered in openChatPip (which
    // restores #chatPanel and clears chatPipWindow) -- this just asks the window to go away.
    if (chatPipWindow) { try { chatPipWindow.close(); } catch {} }
  }

  function openChatPip() {
    if (!chatPipSupported || chatPipWindow || !chatPanel) return;
    // window.open (unlike documentPictureInPicture.requestWindow) returns synchronously and a
    // blocked/failed popup just returns null -- no promise, no catch needed.
    const pipWindow = window.open('about:blank', 'gameCenterChat', 'width=380,height=640,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
    if (!pipWindow) {
      // Most likely: no recent click to authorize it (e.g. a silent session restore on page load)
      // or the browser's popup blocker. The button stays visible in its "not open yet" state so
      // one click finishes the job.
      chatPipWindow = null;
      return;
    }
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
      const clone = pipWindow.document.createElement('link');
      clone.rel = 'stylesheet';
      clone.href = link.href;
      pipWindow.document.head.appendChild(clone);
    }
    // The layout override lives in styles.css as the .sidePipLayout class, not an injected
    // <style> tag here -- this page's CSP (style-src 'self') silently drops inline styles, so a
    // tag full of rules would parse into the DOM but never actually apply. Reused as-is from the
    // native-PIP popup: every rule it applies is generic (.side, .sideActions, ...), and this
    // window needs the exact same "fill the window, no mobile-breakpoint hiding" treatment.
    pipWindow.document.documentElement.classList.add('sidePipLayout');
    pipWindow.document.title = `채팅 · ${state?.gameName || '아일랜드'}`;
    chatPanelHome = { parent: chatPanel.parentElement, next: chatPanel.nextElementSibling };
    pipWindow.document.body.appendChild(chatPanel);
    chatPipWindow = pipWindow;
    bindInputActivity(pipWindow);
    applyChatLayout();
    pipWindow.addEventListener('pagehide', () => {
      chatPipWindow = null;
      if (chatPanelHome) {
        const { parent, next } = chatPanelHome;
        if (next && next.parentElement === parent) parent.insertBefore(chatPanel, next);
        else parent.appendChild(chatPanel);
        chatPanelHome = null;
      }
      applyChatLayout();
      updateChatPipBtn();
    }, { once: true });
    updateChatPipBtn();
  }

  const GAME_INFO_PIP_KEY = 'gameInfoPipPref';
  const gameInfoPipSupported = 'documentPictureInPicture' in window;
  let gameInfoPipPref = false;
  try { gameInfoPipPref = localStorage.getItem(GAME_INFO_PIP_KEY) === '1'; } catch {}
  let gameInfoPipWindow = null;
  let gameInfoPanelHome = null;
  let gameInfoPipResizeObserver = null;

  function gameInfoPipActive() { return Boolean(gameInfoPipWindow); }

  function updateGameInfoPipBtn() {
    if (!gameInfoPipBtn) return;
    gameInfoPipBtn.classList.toggle('hidden', !gameInfoPipSupported);
    gameInfoPipBtn.textContent = gameInfoPipActive() ? 'PIP 닫기' : 'PIP로 보기';
    gameInfoPipBtn.setAttribute('aria-pressed', gameInfoPipActive() ? 'true' : 'false');
  }

  function closeGameInfoPip() {
    if (gameInfoPipWindow) { try { gameInfoPipWindow.close(); } catch {} }
  }

  // As the popped-out window is resized, scale the dice-cube/yut-stick stage proportionally -- a
  // smaller PIP window should show a smaller-but-legible 3D stage, not one clipped at the edges.
  // Pure CSS custom property + transform:scale (see .diceYutStage in styles.css); it never touches
  // the animation math (translate/rotate) already running against these same elements.
  function applyDiceYutPipScale(pipWindow) {
    if (!diceYutStage) return;
    const naturalWidth = 260;
    const available = Math.max(160, pipWindow.innerWidth - 32);
    const scale = Math.min(1, available / naturalWidth);
    diceYutStage.style.setProperty('--diceYutScale', String(scale));
  }

  function watchDiceYutPipScale(pipWindow) {
    if (gameInfoPipResizeObserver) { try { gameInfoPipResizeObserver.disconnect(); } catch {} }
    gameInfoPipResizeObserver = null;
    applyDiceYutPipScale(pipWindow);
    if (typeof pipWindow.ResizeObserver === 'undefined') return;
    gameInfoPipResizeObserver = new pipWindow.ResizeObserver(() => applyDiceYutPipScale(pipWindow));
    gameInfoPipResizeObserver.observe(pipWindow.document.documentElement);
  }

  async function openGameInfoPip() {
    if (!gameInfoPipSupported || gameInfoPipWindow || !gameInfoPanel) return;
    try {
      const pipWindow = await documentPictureInPicture.requestWindow({ width: 420, height: 720 });
      for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        const clone = pipWindow.document.createElement('link');
        clone.rel = 'stylesheet';
        clone.href = link.href;
        pipWindow.document.head.appendChild(clone);
      }
      pipWindow.document.documentElement.classList.add('sidePipLayout');
      pipWindow.document.title = `게임 진행 · ${state?.gameName || '아일랜드'}`;
      gameInfoPanelHome = { parent: gameInfoPanel.parentElement, next: gameInfoPanel.nextElementSibling };
      pipWindow.document.body.appendChild(gameInfoPanel);
      gameInfoPipWindow = pipWindow;
      bindInputActivity(pipWindow);
      if (diceYutStage) watchDiceYutPipScale(pipWindow);
      applyGameInfoLayout();
      pipWindow.addEventListener('pagehide', () => {
        gameInfoPipWindow = null;
        if (gameInfoPipResizeObserver) { try { gameInfoPipResizeObserver.disconnect(); } catch {} gameInfoPipResizeObserver = null; }
        if (diceYutStage) diceYutStage.style.removeProperty('--diceYutScale');
        if (gameInfoPanelHome) {
          const { parent, next } = gameInfoPanelHome;
          if (next && next.parentElement === parent) parent.insertBefore(gameInfoPanel, next);
          else parent.appendChild(gameInfoPanel);
          gameInfoPanelHome = null;
        }
        applyGameInfoLayout();
        updateGameInfoPipBtn();
      }, { once: true });
      updateGameInfoPipBtn();
    } catch {
      gameInfoPipWindow = null;
    }
  }

  function updateSideOverlayBackdrop() {
    sideOverlayBackdrop.classList.toggle('hidden', !((chatOverlayOpen || gameInfoOverlayOpen) && isMobileLayout()));
  }

  // Widens the board (collapses this whole grid column) only once BOTH panels are actually gone
  // from the page -- either popped out to their own PIP window, or manually collapsed/docked and
  // not currently shown as a mobile overlay. Either panel alone staying docked keeps the column at
  // its normal width, since #gameInfoPanel in particular holds controls a player still needs.
  function updateGameLayoutCollapsed() {
    if (!gameLayoutEl) return;
    const mobile = isMobileLayout();
    const chatGone = chatPipActive() || (!mobile && chatShouldCollapse() && !chatOverlayOpen);
    const gameInfoGone = gameInfoPipActive() || (!mobile && gameInfoShouldCollapse() && !gameInfoOverlayOpen);
    gameLayoutEl.classList.toggle('sideCollapsed', chatGone && gameInfoGone);
  }

  function chatVisible() {
    // True when the chat pane is actually on-screen and readable right now.
    if (chatPipActive()) return true; // showing in its own always-visible separate window
    if (isMobileLayout()) return chatOverlayOpen;
    return !chatShouldCollapse();
  }

  function applyChatLayout() {
    const mobile = isMobileLayout();
    const collapsed = chatShouldCollapse();
    const pipActive = chatPipActive();
    chatPanel.classList.toggle('overlayOpen', chatOverlayOpen);
    chatPanel.classList.toggle('collapsedDocked', !chatOverlayOpen && !mobile && collapsed);
    // While popped out to PIP the panel isn't in this document's layout at all (moved into the
    // popup), so the floating "open chat" bubble stays hidden -- there's nothing left here for it
    // to open, the panel is already a real separate window.
    chatFloatBtn.classList.toggle('hidden', pipActive || chatOverlayOpen || !(mobile || collapsed));
    chatFloatBtn.setAttribute('aria-label', '채팅 열기');
    chatFloatBtn.classList.remove('isOpen');
    chatCollapseBtn.textContent = chatOverlayOpen ? '닫기 ✕' : collapsed ? '펼치기 ◂' : '접기 ▸';
    chatCollapseBtn.setAttribute('aria-label', chatOverlayOpen ? '채팅 패널 닫기' : collapsed ? '채팅 패널 펼치기' : '채팅 패널 접기');
    // "기본으로" only matters (and only shows) once the panel has actually left its plain docked,
    // expanded state -- popped out to its own window, floating in the mobile/collapsed overlay, or
    // manually collapsed. On mobile the docked layout isn't shown at all (see the mobile media
    // query on .side), so there's no meaningful "default" to return to there either.
    chatResetBtn?.classList.toggle('hidden', mobile || (!pipActive && !chatOverlayOpen && !collapsed));
    updateSideOverlayBackdrop();
    updateGameLayoutCollapsed();
    // Only auto-clear unread when the reader is actually at the bottom of the chat pane --
    // otherwise a message arriving while they're scrolled up in history (chat pane still
    // "visible") would silently reset the unread badge before they ever saw it.
    if (chatVisible() && chatAtBottom) markChatSeen();
  }

  // Returns the panel to its plain docked, expanded state regardless of where it currently is --
  // popped out to its own separate window, floating in the mobile/collapsed overlay, or manually
  // collapsed. closeChatPip() is fire-and-forget (its own pagehide handler finishes reparenting
  // the panel back and re-applies the layout once the window actually closes); the overlay/collapse
  // state is cleared immediately so the docked view is correct even before that happens. Also
  // clears the separate-window preference, so it doesn't silently reopen on the next room entry --
  // "기본으로" is a full reset, not a one-time close.
  function resetChatToDocked() {
    closeChatPip();
    chatPipPref = false;
    try { localStorage.setItem(CHAT_PIP_KEY, '0'); } catch {}
    chatOverlayOpen = false;
    if (chatCollapsedPref !== false) {
      chatCollapsedPref = false;
      try { localStorage.setItem(CHAT_COLLAPSE_KEY, '0'); } catch {}
    }
    applyChatLayout();
  }

  function toggleChatOverlay(forceOpen) {
    chatOverlayOpen = typeof forceOpen === 'boolean' ? forceOpen : !chatOverlayOpen;
    if (chatOverlayOpen) gameInfoOverlayOpen = false; // only one mobile overlay open at a time
    applyChatLayout();
    applyGameInfoLayout();
  }

  function applyGameInfoLayout() {
    const mobile = isMobileLayout();
    const collapsed = gameInfoShouldCollapse();
    const pipActive = gameInfoPipActive();
    gameInfoPanel.classList.toggle('overlayOpen', gameInfoOverlayOpen);
    gameInfoPanel.classList.toggle('collapsedDocked', !gameInfoOverlayOpen && !mobile && collapsed);
    gameInfoFloatBtn.classList.toggle('hidden', pipActive || gameInfoOverlayOpen || !(mobile || collapsed));
    gameInfoFloatBtn.classList.remove('isOpen');
    gameInfoCollapseBtn.textContent = gameInfoOverlayOpen ? '닫기 ✕' : collapsed ? '펼치기 ◂' : '접기 ▸';
    gameInfoCollapseBtn.setAttribute('aria-label', gameInfoOverlayOpen ? '게임 진행 패널 닫기' : collapsed ? '게임 진행 패널 펼치기' : '게임 진행 패널 접기');
    for (const btn of gameInfoPanel.querySelectorAll('.sideTab')) {
      const active = btn.dataset.sideTab === gameInfoActiveTab;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    for (const pane of gameInfoPanel.querySelectorAll('.sidePane')) {
      pane.classList.toggle('hidden', pane.dataset.sidePane !== gameInfoActiveTab);
    }
    // See chatResetBtn's own comment in applyChatLayout -- same reasoning, mirrored per panel.
    gameInfoResetBtn?.classList.toggle('hidden', mobile || (!pipActive && !gameInfoOverlayOpen && !collapsed));
    updateSideOverlayBackdrop();
    updateGameLayoutCollapsed();
  }

  function setGameInfoTab(tab) {
    gameInfoActiveTab = tab;
    applyGameInfoLayout();
  }

  // See resetChatToDocked's own comment above -- same reasoning, mirrored per panel.
  function resetGameInfoToDocked() {
    closeGameInfoPip();
    gameInfoPipPref = false;
    try { localStorage.setItem(GAME_INFO_PIP_KEY, '0'); } catch {}
    gameInfoOverlayOpen = false;
    if (gameInfoCollapsedPref !== false) {
      gameInfoCollapsedPref = false;
      try { localStorage.setItem(GAME_INFO_COLLAPSE_KEY, '0'); } catch {}
    }
    applyGameInfoLayout();
  }

  function toggleGameInfoOverlay(forceOpen) {
    gameInfoOverlayOpen = typeof forceOpen === 'boolean' ? forceOpen : !gameInfoOverlayOpen;
    if (gameInfoOverlayOpen) chatOverlayOpen = false;
    applyGameInfoLayout();
    applyChatLayout();
  }

  function markChatSeen() {
    chatUnreadCount = 0;
    updateChatBadges();
    if (chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 8) chatAtBottom = true;
  }

  function updateChatBadges() {
    const show = chatUnreadCount > 0;
    chatUnreadBadge.textContent = String(Math.min(chatUnreadCount, 99));
    chatUnreadBadge.classList.toggle('hidden', !show);
    chatFloatBadge.textContent = String(Math.min(chatUnreadCount, 99));
    chatFloatBadge.classList.toggle('hidden', !show);
  }

  chatMessages.addEventListener('scroll', () => {
    if (chatRendering) return;
    chatAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 40;
    if (chatAtBottom) { chatJumpBtn.classList.add('hidden'); if (chatVisible()) markChatSeen(); }
  });
  chatInput.addEventListener('focus', () => {
    // Desktop focus must not move the game page or the reader's chat history.
    if (isMobileLayout()) setTimeout(() => chatInput.scrollIntoView({ block: 'end', behavior: 'smooth' }), 150);
  });
  chatJumpBtn.addEventListener('click', () => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatAtBottom = true;
    chatJumpBtn.classList.add('hidden');
    markChatSeen();
  });
  chatCollapseBtn.addEventListener('click', () => {
    if (chatOverlayOpen) {
      // Just close the overlay -- opening it never implied a permanent docked preference change,
      // so closing it shouldn't silently flip one either.
      chatOverlayOpen = false;
      applyChatLayout();
      return;
    }
    chatCollapsedPref = !chatShouldCollapse();
    try { localStorage.setItem(CHAT_COLLAPSE_KEY, chatCollapsedPref ? '1' : '0'); } catch {}
    applyChatLayout();
  });
  chatFloatBtn.addEventListener('click', () => toggleChatOverlay());
  chatResetBtn?.addEventListener('click', () => resetChatToDocked());
  chatPipBtn?.addEventListener('click', () => {
    chatPipPref = !chatPipActive();
    try { localStorage.setItem(CHAT_PIP_KEY, chatPipPref ? '1' : '0'); } catch {}
    if (chatPipActive()) closeChatPip(); else openChatPip();
  });
  updateChatPipBtn();

  for (const btn of gameInfoPanel.querySelectorAll('.sideTab')) {
    btn.addEventListener('click', () => setGameInfoTab(btn.dataset.sideTab));
  }
  gameInfoCollapseBtn.addEventListener('click', () => {
    if (gameInfoOverlayOpen) {
      gameInfoOverlayOpen = false;
      applyGameInfoLayout();
      return;
    }
    gameInfoCollapsedPref = !gameInfoShouldCollapse();
    try { localStorage.setItem(GAME_INFO_COLLAPSE_KEY, gameInfoCollapsedPref ? '1' : '0'); } catch {}
    applyGameInfoLayout();
  });
  gameInfoFloatBtn.addEventListener('click', () => toggleGameInfoOverlay());
  gameInfoResetBtn?.addEventListener('click', () => resetGameInfoToDocked());
  gameInfoPipBtn?.addEventListener('click', () => {
    gameInfoPipPref = !gameInfoPipActive();
    try { localStorage.setItem(GAME_INFO_PIP_KEY, gameInfoPipPref ? '1' : '0'); } catch {}
    if (gameInfoPipActive()) closeGameInfoPip(); else openGameInfoPip();
  });
  updateGameInfoPipBtn();

  sideOverlayBackdrop.addEventListener('click', () => { toggleChatOverlay(false); toggleGameInfoOverlay(false); });

  for (const btn of document.querySelectorAll('.sideSizeBtn')) {
    btn.addEventListener('click', () => {
      const size = btn.dataset.sideSize;
      if (gameLayoutEl) gameLayoutEl.classList.remove('sideNarrow', 'sideWide');
      if (size === 'narrow') gameLayoutEl?.classList.add('sideNarrow');
      else if (size === 'wide') gameLayoutEl?.classList.add('sideWide');
      try { localStorage.setItem(SIDE_SIZE_KEY, size); } catch {}
      for (const b of document.querySelectorAll('.sideSizeBtn')) b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
  }
  try {
    const savedSize = localStorage.getItem(SIDE_SIZE_KEY);
    if (savedSize === 'narrow' || savedSize === 'wide') {
      gameLayoutEl?.classList.add(savedSize === 'narrow' ? 'sideNarrow' : 'sideWide');
      document.querySelector(`.sideSizeBtn[data-side-size="${savedSize}"]`)?.setAttribute('aria-pressed', 'true');
    }
  } catch {}
  window.addEventListener('resize', () => { applyChatLayout(); applyGameInfoLayout(); scheduleRoomSideHeightSync(); });
  window.addEventListener('orientationchange', () => { applyChatLayout(); applyGameInfoLayout(); scheduleRoomSideHeightSync(); });
  window.visualViewport?.addEventListener('resize', scheduleRoomSideHeightSync);

  // Old Maid table effects state. Purely cosmetic bookkeeping: never the source of truth for
  // game state (that always comes from `state.game`, applied immediately by roomAction/SSE).
  let oldmaidEffectsOn = true;
  try { oldmaidEffectsOn = localStorage.getItem('oldmaidEffects') !== 'off'; } catch {}
  let oldmaidDrawBusy = false;
  let oldmaidPeekArmed = false;
  let oldmaidLastMoves = 0; // (C4 P3-7: the draws seen -- moveCount, the history is only the last 30)
  let oldmaidSeenEscaped = new Set();
  let oldmaidSeenFinishedKey = null;
  let oldmaidKnownRound = null;

  // v1.6.51: the in-page "연출 효과" checkbox is the sole source of truth -- it used to be
  // silently AND-ed with the browser/OS's prefers-reduced-motion setting, so a player with that
  // accessibility setting on could never see effects even with the checkbox checked, with no
  // indication why. Confirmed with the user: an explicit in-app opt-in should override the
  // system default rather than be silently vetoed by it.
  function oldmaidEffectsActive() { return oldmaidEffectsOn; }

  function reducedMotionActive() {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  }

  // v1.6.57: several decaying bounces instead of one single hop -- each bounce is shorter and
  // lower than the last, the way a real object loses height and speed to restitution/friction on
  // every ground contact instead of hopping once and gliding down. Returns a 0..1 fraction of peak
  // bounce height for a given point (0..1) through the whole throw; callers scale it to real pixels
  // and negate it (translateY is toward the ground, a bounce lifts up = negative).
  function bounceHeight(progress) {
    const bounces = [
      { start: 0, span: 0.42, height: 1 },
      { start: 0.42, span: 0.27, height: 0.4 },
      { start: 0.69, span: 0.18, height: 0.15 },
      { start: 0.87, span: 0.13, height: 0.05 },
    ];
    for (const b of bounces) {
      if (progress >= b.start && progress < b.start + b.span) {
        return Math.sin(((progress - b.start) / b.span) * Math.PI) * b.height;
      }
    }
    return 0;
  }

  // v1.6.55: common 3D "tumble and settle" core shared by every dice/yut-style widget (today: the
  // Land King dice and the yut sticks; any future dice game reuses this directly, no copy-paste).
  // It only ever plays a COSMETIC spin on top of a result the caller already decided -- buildFrame
  // computes each element's in-flight transform every animation frame, finalTransforms is where
  // each element must land (always server-confirmed by the caller), and decorate lets a caller
  // attach a result-only CSS class (e.g. "double dice" glow) at the exact moment it settles. The
  // hop/wobble math, the reduced-motion bypass, the .settling transition class and the onDone
  // callback are identical for every widget; only the per-frame transform string and the final
  // resting transforms differ, which is exactly what dice cubes vs yut sticks need to differ on.
  //
  // v1.6.57: `t` (fed into buildFrame's per-axis spin, e.g. `s.x * t`) now eases out instead of
  // growing linearly with elapsed time -- real spin loses speed to friction as it approaches rest,
  // rather than spinning at a constant rate right up to an abrupt snap. `bounce` (also new) is a
  // per-element, per-frame 0..1 multi-bounce height (see bounceHeight above) with a small random
  // phase/scale jitter per element (spins[i].bouncePhase/bounceScale, set by the caller) so several
  // elements tumbling together don't bounce in exact lockstep.
  // v1.9.9: a tumble belongs to the room it started in. Entering a room bumps tumbleGen (resetRoomAnimationState), so an
  // unfinished throw/roll stops: no more frames on the old elements, no onDone into the new room's state.
  let tumbleGen = 0;
  let diceThrowTimer = null;
  function animateTumble(els, spins, buildFrame, finalTransforms, { duration = 700, settleMs = 420, decorate, onDone } = {}) {
    const gen = tumbleGen;
    els.forEach(el => el.classList.remove('settling'));
    // (G-틀①: while a hand is played the throw shows over the board -- for the throw and a moment after, then out of the way)
    diceYutSection.classList.add('throwing'); clearTimeout(diceThrowTimer); diceThrowTimer = setTimeout(() => diceYutSection.classList.remove('throwing'), duration + settleMs + 1400);
    const settle = (withTransition) => {
      els.forEach((el, i) => {
        if (decorate) decorate(el, i);
        if (withTransition) el.classList.add('settling');
        el.style.transform = finalTransforms[i];
      });
      if (withTransition) setTimeout(() => els.forEach(el => el.classList.remove('settling')), settleMs);
      if (onDone) onDone();
    };
    if (reducedMotionActive() || !els.length) { settle(false); return; }
    const start = performance.now();
    const frame = timestamp => {
      if (gen !== tumbleGen) return;
      const elapsed = timestamp - start;
      if (elapsed >= duration) { settle(true); return; }
      const progress = elapsed / duration;
      const eased = 1 - (1 - progress) ** 3;
      const t = (duration / 1000) * eased;
      const wobbleDecay = 1 - progress * 0.6;
      els.forEach((el, i) => {
        const spin = spins[i] || {};
        const localProgress = Math.min(1, Math.max(0, progress + (spin.bouncePhase || 0)));
        const bounce = bounceHeight(localProgress) * (spin.bounceScale ?? 1);
        el.style.transform = buildFrame(spin, t, wobbleDecay, progress, bounce);
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // Common dice-roll animation: reusable by any game that rolls one or more dice.
  // Each die is a static 3D CSS cube (6 fixed faces, see index.html's .diceCube markup) -- rolling
  // never swaps face content, it only spins the cube's own transform, and settling snaps to the
  // exact rotation that brings the server-confirmed face to the front. The face-content is fixed
  // per element, so the number shown can never drift from what the cube's own markup says.
  // Container rotation that brings face N to the front, derived as the inverse of that face's own
  // placement transform in the .diceCube CSS (cf1..cf6) -- see the CSS comment next to them.
  const DICE_CUBE_ROTATIONS = {
    1: 'rotateX(0deg) rotateY(0deg)',
    2: 'rotateX(0deg) rotateY(90deg)',
    3: 'rotateX(-90deg) rotateY(0deg)',
    4: 'rotateX(90deg) rotateY(0deg)',
    5: 'rotateX(0deg) rotateY(-90deg)',
    6: 'rotateX(0deg) rotateY(180deg)',
  };
  function animateDiceRoll(dieEls, finalValues, { duration = 650, onDone } = {}) {
    dieEls.forEach(el => el.classList.remove('diceDouble'));
    const isDouble = finalValues.length > 1 && finalValues.every(v => v === finalValues[0]);
    // Same decaying multi-bounce + eased-spin shape as the yut-stick toss (animateYutThrow) via the
    // shared animateTumble core -- several bounces settling down on top of the spin that actually
    // determines the landing face, purely for flair; settle() resets translateY/rotateZ to
    // nothing, so none of this affects which face lands. bouncePhase/bounceScale jitter keeps
    // multiple dice from bouncing in perfect lockstep.
    const spin = dieEls.map(() => ({
      x: 340 + Math.random() * 220,
      y: 280 + Math.random() * 260,
      z: (Math.random() - 0.5) * 60,
      bouncePhase: (Math.random() - 0.5) * 0.06,
      bounceScale: 0.85 + Math.random() * 0.3,
    }));
    animateTumble(
      dieEls, spin,
      (s, t, wobbleDecay, progress, bounce) => {
        const hop = -bounce * 38;
        return `translateY(${hop}px) rotateX(${s.x * t}deg) rotateY(${s.y * t}deg) rotateZ(${s.z * t * wobbleDecay}deg)`;
      },
      dieEls.map((_, i) => DICE_CUBE_ROTATIONS[finalValues[i]] || DICE_CUBE_ROTATIONS[1]),
      { duration, settleMs: 420, decorate: isDouble ? (el) => el.classList.add('diceDouble') : null, onDone },
    );
  }

  // Common yut-stick throw animation: 4 sticks (fixed front/flat + back/round faces, see
  // index.html's .yutStick markup) toss and tumble in the board center, then settle with each
  // stick's rotateY snapped to 0 (front up) or 180deg (back up) to match the server's confirmed
  // "backs" pattern -- face content never changes, so it can't drift from the real result.
  function animateYutThrow(stickEls, backFlags, { duration = 780, onDone } = {}) {
    window.RoomSound?.play('yut'); // (G-틀③: the sticks falling)
    // Each stick gets its own spin rate/axis-mix AND its own bounce timing/height jitter
    // (bouncePhase/bounceScale) so all 4 sticks visibly move differently instead of tumbling as one
    // identical, repetitive unit.
    const spin = stickEls.map(() => ({
      y: 420 + Math.random() * 360,
      x: (Math.random() - 0.5) * 90,
      z: (Math.random() - 0.5) * 70,
      bouncePhase: (Math.random() - 0.5) * 0.08,
      bounceScale: 0.82 + Math.random() * 0.36,
    }));
    animateTumble(
      stickEls, spin,
      (s, t, wobbleDecay, progress, bounce) => {
        const hop = -bounce * 50;
        return `translateY(${hop}px) rotateX(${s.x * t * wobbleDecay}deg) rotateZ(${s.z * t * wobbleDecay}deg) rotateY(${s.y * t}deg)`;
      },
      stickEls.map((_, i) => `translateY(0) rotateX(0deg) rotateZ(0deg) rotateY(${backFlags[i] ? 180 : 0}deg)`),
      { duration, settleMs: 480, onDone },
    );
  }

  // v1.6.57: animates a piggybacked group of pieces walking node-by-node along their real server-
  // computed path (see lib/games/yut.js's forwardDestination/backwardDestination `path` field) --
  // never a client-guessed straight line. Each step eases between two board pixel positions with a
  // small hop, then pauses briefly before the next step, so the piece visibly hops cell-to-cell
  // instead of sliding or teleporting. Purely a draw-position override (see drawYutBoard's use of
  // yutPieceAnimation below) -- state.game.pieces already holds the real, final positions the whole
  // time; this never writes to game state, only to what gets painted on screen.
  function animateYutPieceMove(pieceIds, path, { stepDuration = 400, pauseDuration = 100, onDone } = {}) {
    const gen = ++yutMoveAnimationGen;
    const idSet = new Set(pieceIds);
    if (reducedMotionActive() || path.length < 2) {
      yutPieceAnimation = null;
      drawYutBoard();
      if (onDone) onDone();
      return;
    }
    let segmentIndex = 0;
    yutTrail = [];
    // v1.6.83: claim the in-transit guard immediately (at the move's true starting node) instead of
    // on the first animation frame, so there is no gap in which the board is selectable again.
    const [startX, startY] = yutNodePosition(path[0]);
    yutPieceAnimation = { pieceIds: idSet, x: startX, y: startY };
    const runSegment = () => {
      // A newer move animation superseded this one (e.g. a fast bonus-throw chain) -- stop quietly
      // rather than fight it for the same canvas; the newer animation already reflects reality.
      if (gen !== yutMoveAnimationGen) return;
      if (segmentIndex >= path.length - 1) {
        yutPieceAnimation = null;
        drawYutBoard();
        if (onDone) onDone();
        return;
      }
      const [fx, fy] = yutNodePosition(path[segmentIndex]);
      const [tx, ty] = yutNodePosition(path[segmentIndex + 1]);
      const start = performance.now();
      const hopHeight = 16;
      const frame = (timestamp) => {
        if (gen !== yutMoveAnimationGen) return;
        const progress = Math.min(1, (timestamp - start) / stepDuration);
        // Ease-in-out: a gentle lift-off and landing per cell, reading as a light hop rather than a
        // mechanical slide.
        const eased = progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2;
        yutPieceAnimation = {
          pieceIds: idSet,
          x: fx + (tx - fx) * eased,
          y: fy + (ty - fy) * eased - Math.sin(progress * Math.PI) * hopHeight,
        };
        yutTrail.push({ x: yutPieceAnimation.x, y: yutPieceAnimation.y });
        if (yutTrail.length > 14) yutTrail.shift();
        drawYutBoard();
        if (progress < 1) requestAnimationFrame(frame);
        else { segmentIndex += 1; setTimeout(runSegment, pauseDuration); }
      };
      requestAnimationFrame(frame);
    };
    runSegment();
  }

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
    clearTimeout(resultDelayTimer);
    resultEffect.classList.add('hidden');
    resultEffect.classList.remove('win', 'loss', 'playing', 'reward', 'banner');
    document.body.classList.remove('resultWinActive', 'resultLossActive');
  }

  const CELEBRATION_COLORS = ['#facc15', '#f97316', '#22d3ee', '#a78bfa', '#f472b6', '#ffffff'];

  function fillVictoryParticles() {
    const colors = CELEBRATION_COLORS;
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

  // v1.7.15: several short firework bursts across the screen (the win confetti is filled in as well).
  // Fixed positions and angles, so the show is the same every time and needs no randomness.
  function fillFireworks() {
    const bursts = [[16, 26], [84, 22], [50, 12], [24, 76], [78, 74], [50, 88]]; // around the centered card
    bursts.forEach(([x, y], index) => {
      const burst = document.createElement('b');
      burst.style.setProperty('--bx', `${x}%`);
      burst.style.setProperty('--by', `${y}%`);
      burst.style.setProperty('--delay', `${index * 0.32}s`);
      for (let i = 0; i < 18; i += 1) {
        const spark = document.createElement('span');
        const angle = (Math.PI * 2 * i) / 18 + index * 0.2;
        const distance = 90 + (i % 3) * 40;
        spark.style.setProperty('--dx', `${Math.round(Math.cos(angle) * distance)}px`);
        spark.style.setProperty('--dy', `${Math.round(Math.sin(angle) * distance)}px`);
        spark.style.setProperty('--color', CELEBRATION_COLORS[(i + index) % CELEBRATION_COLORS.length]);
        burst.appendChild(spark);
      }
      resultParticles.appendChild(burst);
    });
  }

  function playResultEffect({ win, icon, title, message, duration, reward = false, banner = false }) {
    clearTimeout(resultEffectTimer);
    resultEffect.classList.remove('hidden', 'win', 'loss', 'playing', 'reward', 'banner');
    resultEffect.classList.add(win ? 'win' : 'loss');
    resultEffect.classList.toggle('reward', reward);
    resultEffect.classList.toggle('banner', banner);
    resultIcon.textContent = icon;
    resultTitle.textContent = title;
    resultMessage.textContent = message;
    resultParticles.replaceChildren();
    if (win && !banner) fillVictoryParticles();
    if (reward) fillFireworks();
    document.body.classList.toggle('resultWinActive', win && !reward);
    document.body.classList.toggle('resultLossActive', !win);
    // Re-run the entrance animation even if the previous round ended moments ago.
    void resultEffect.offsetWidth;
    resultEffect.classList.add('playing');
    resultEffectTimer = setTimeout(() => {
      resultEffect.classList.remove('playing');
      clearResultEffect();
    }, duration);
  }

  // v1.8.7: when the winning line is a legend skin's, its win sequence plays on the board first (about 1.6 s) and the
  // result follows as a small banner at the top, so the result never covers the legend effect. Same title, message
  // and duration as the full card; the rematch and score controls stay where they are.
  function legendWinOnBoard(game) {
    const type = state?.gameType;
    let skin = null;
    if (['omok', 'omok2v2', 'connect4'].includes(type)) { // the skin of the winning line's stones (v1.9.0: also 사목)
      const first = game?.winningLine?.[0];
      const color = first ? game.board?.[first[1]]?.[first[0]] : null;
      if (color) skin = type === 'connect4' ? state.players?.[color]?.skin : stoneSkin(first[0], first[1], color);
    } else if (['othello', 'yut', 'dots'].includes(type) && game?.status === 'finished' && game.winner) skin = state.players?.[game.winner]?.skin; // v1.9.0
    else if (['bingo', 'baseball', 'pictionary', 'twentyquestions', 'liar', 'davinci', 'oldmaid', 'halligalli'].includes(type) && game?.status === 'finished') { // v1.9.1: a winner's legend plays over the panel
      const winners = [].concat(game.winners?.length ? game.winners : game.winner || []);
      skin = winners.map((s) => state.players?.[s]?.skin).find((id) => { const d = window.SkinLooks?.def(id); return d?.legend && d.win; }) || null;
    }
    const def = skin ? window.SkinLooks?.def(skin) : null;
    return Boolean(def?.legend && def.win);
  }
  function showResultEffect(outcome, game) {
    const win = outcome === 'win';
    const effect = { win, icon: win ? '🏆' : '😏', title: win ? '화려한 승리!' : '이번 판은 패배…', message: resultCopy(outcome, game), duration: win ? 5000 : 4600 };
    clearTimeout(resultDelayTimer);
    if (legendWinOnBoard(game)) { resultDelayTimer = setTimeout(() => playResultEffect({ ...effect, banner: true }), reducedMotionActive() ? 0 : 1600); return; }
    playResultEffect(effect);
  }

  // Only ever called after the server confirmed a payout.
  function showRewardEffect(amount, message) {
    playResultEffect({ win: true, reward: true, icon: '🎉', title: `+${Number(amount).toLocaleString('ko-KR')}P`, message, duration: 3200 });
  }

  // A3 G1-7 결과 창 공통: the points this hand moved for me (the server's entry settlement) and [한 판 더]·[게임관으로]
  let nextAskedFor = null; // (the room and hand I asked to play again)
  let resultCountedFor = null; // (C4 P3-3: the result whose score has counted up -- a card drawn again shows the end at once)
  function resultOverlayExtras(outcome) {
    const e = state.points?.entry;
    // (G-틀④: only a stakes hand has a points line -- one big +/− figure; how it came (the entry, the share) on its title)
    if (e && e.status === 'settled' && Number(e.fee)) { const line = document.createElement('span'); line.className = 'resultPoints';
      line.textContent = outcome === 'win' && e.each ? `+${Number(e.each).toLocaleString('ko-KR')}P` : outcome === 'win' ? '' : `−${Number(e.fee).toLocaleString('ko-KR')}P`;
      line.classList.toggle('minus', outcome !== 'win');
      line.title = outcome === 'win' && e.each ? `참가 ${Number(e.fee).toLocaleString('ko-KR')}P → 받은 ${Number(e.each).toLocaleString('ko-KR')}P` : `참가 ${Number(e.fee).toLocaleString('ko-KR')}P`;
      if (line.textContent) boardOverlay.append(line); }
    const row = document.createElement('span'); row.className = 'resultActions';
    // (G-틀④ 검토: the card's 「한 판 더」 is the one -- 다음 판 준비 is hidden under it; once pressed it says it is waiting)
    const asked = nextAskedFor === `${state.me?.roomCode}:${state.game?.round}`;
    const again = document.createElement('button'); again.type = 'button'; again.className = 'primary'; again.textContent = asked ? '준비 완료 · 기다리는 중' : '한 판 더'; again.disabled = asked;
    again.addEventListener('click', async () => { const key = `${state.me?.roomCode}:${state.game?.round}`; nextAskedFor = key; again.textContent = '준비 완료 · 기다리는 중'; again.disabled = true;
      if (await roomAction('next-round')) return;
      if (nextAskedFor === key) nextAskedFor = null; /* (C4 P2-1: the ask failed -- the card's button again, the one under it is hidden) */
      for (const b of new Set([again, ...boardOverlay.querySelectorAll('.resultActions .primary')])) { b.textContent = '한 판 더'; b.disabled = false; } });
    const out = document.createElement('button'); out.type = 'button'; out.className = 'ghost'; out.textContent = '게임관으로'; out.addEventListener('click', () => document.getElementById('leaveRoomBtn').click());
    row.append(again, out); boardOverlay.append(row);
  }
  function setResultBoardOverlay(outcome, game) {
    const win = outcome === 'win';
    const heading = document.createElement('strong');
    const detail = document.createElement('span');
    heading.textContent = win ? '🏆 승리!' : '패배';
    detail.textContent = resultCopy(outcome, game);
    boardOverlay.replaceChildren(heading, detail);
    // (G-틀④ 점수가 하나씩: a game that keeps a score per side -- 오델로 돌, 윷 완주, 점과 상자 -- counts it up on the result)
    const sc = game?.scores; const unit = { othello: '돌', yut: '완주', dots: '상자' }[state?.gameType];
    if (unit && sc && Number.isFinite(Number(sc.black)) && Number.isFinite(Number(sc.white))) {
      const row = document.createElement('span'); row.className = 'resultScore'; boardOverlay.append(row);
      const to = { black: Number(sc.black), white: Number(sc.white) }; const draw = (k) => { row.textContent = `${seatKo('black')} ${unit} ${Math.round(to.black * k)} · ${seatKo('white')} ${unit} ${Math.round(to.white * k)}`; };
      const key = `${state.me?.roomCode}:${game?.round}:${to.black}:${to.white}`; const counted = resultCountedFor === key; resultCountedFor = key;
      if (counted || reducedMotionActive()) draw(1); else { const t0 = performance.now(); const step = (t) => { const k = Math.min(1, (t - t0) / 900); draw(k); if (k < 1 && row.isConnected) requestAnimationFrame(step); }; requestAnimationFrame(step); }
    }
    boardOverlay.classList.remove('resultWin', 'resultLoss');
    boardOverlay.classList.add(win ? 'resultWin' : 'resultLoss');
  }

  let reflexGames = null; // v1.10.68 순발력 게임 (below, at its button)
  function showView(name) {
    if (name === 'gate') queueMicrotask(() => openAccountGate()); // v1.10.63: login / 내 계정 / id setup
    document.body.classList.toggle('roomMode', name === 'room'); // v1.10.64: the room's 💬·🎮 buttons only in a room
    gateView.classList.toggle('hidden', name !== 'gate');
    lobbyView.classList.toggle('hidden', name !== 'lobby');
    roomView.classList.toggle('hidden', name !== 'room');
    document.getElementById('climbView').classList.toggle('hidden', name !== 'climb');
    if (name !== 'climb') window.ClimbClient?.stop();
    document.getElementById('reflexView').classList.toggle('hidden', name !== 'reflex');
    document.getElementById('gamehallView').classList.toggle('hidden', name !== 'gamehall'); // v1.10.73 게임관
    if (name !== 'gamehall' && document.getElementById('gameSheet').open) document.getElementById('gameSheet').close();
    if (name !== 'reflex') reflexGames?.stop();
    if (name !== 'room') { document.body.classList.remove('tableGameRoom', 'tableGamePlaying', 'roomResult'); if (document.body.classList.contains('roomPlaying')) setRoomPlaying(false); } // (set only once the page is up)
    syncPlaza(name);
  }

  // v1.9.7 게임 아일랜드: 일반 사용자는 기존 로비로 전환하지 않는다. PC에서는 항상 3D 허브를 사용하고,
  // 작은 화면·WebGL 실패 때만 내부 호환용 기존 레이아웃이 fallback으로 남는다. 기능은 시설/오버레이에서 연다.
  const plazaStage = document.getElementById('plazaStage');
  const plazaHint = document.getElementById('plazaHint');
  const trainControls = document.getElementById('trainControls');
  const trainMainBtn = document.getElementById('trainMainBtn');
  const trainMenuBtn = document.getElementById('trainMenuBtn');
  trainMenuBtn.onclick = () => trainAction('platform');
  const plazaDialog = document.getElementById('plazaDialog');
  const plazaDialogTitle = document.getElementById('plazaDialogTitle');
  const plazaDialogBody = document.getElementById('plazaDialogBody');
  const publicRoomsCardEl = document.getElementById('publicRoomsCard');
  // v1.10.23 Mac Chrome 구형 로비 노출 수정 (IDEAS 2026-10-05): `failed` is { code, detail } once the island could not
  // start. A regular user then sees the island's own short error with a retry -- never the classic lobby (that stays
  // only for administrators, as an internal fallback, and for automated tests that ask for it). The code says why:
  // webgl-unavailable / webgl-context / module (the island's code did not load) / init (it failed while being built).
  const plaza = { controller: null, loading: null, failed: null };
  const plazaError = document.getElementById('plazaError');
  document.getElementById('plazaRetry').addEventListener('click', () => {
    // Failed imports remain in this document's module map. A new page gets the current index/import map and restores
    // the existing login and today's server spot; WebGL/init failures can still retry the renderer in place.
    if (plaza.failed?.code === 'module') { location.reload(); return; }
    plaza.failed = null;
    syncPlaza(lobbyView.classList.contains('hidden') ? '' : 'lobby');
  });
  function plazaFailure(error) {
    const failure = { code: error?.code || 'init', detail: String(error?.message || error).slice(0, 300), gpu: error?.gpu || '' };
    window.PlazaDiagnostics = { ...failure, at: new Date().toISOString(), platform: navigator.userAgentData?.platform || navigator.platform || '' };
    console.error('[게임 아일랜드] 시작 실패:', failure.code, failure.detail, error);
    api('/api/plaza/diag', { method: 'POST', body: JSON.stringify({ code: failure.code, detail: failure.detail, gpu: failure.gpu, platform: window.PlazaDiagnostics.platform }) }).catch(() => {});
    return failure;
  }
  let plazaTestClassic = false;
  try { plazaTestClassic = Boolean(navigator.webdriver && localStorage.getItem('gc.testClassic') === '1'); } catch {}
  const byId = (id) => document.getElementById(id);
  const PLAZA_FACILITIES = [
    { id: 'games', name: '게임관', open: () => openGamehall() }, // v1.10.73: its own screen
    { id: 'shop', name: '게임 스킨 상점', open: () => openSkinShop('game') }, // v1.10.1: two shops on the shop street
    // v1.10.30 상점가 꾸미기 점포 세분화 (사용자 확정 2026-10-05): clothes, hair and accessories each their own shop,
    // the face at the 성형외과, colours at the 염색사 (the former character-skin shop is the clothes shop)
    { id: 'avatar', name: '옷가게', open: () => openSkinShop('avatar:outfit') },
    { id: 'hair', name: '미용실', open: () => openSkinShop('avatar:hair') },
    { id: 'accessories', name: '소품 가게', open: () => openSkinShop('avatar:hat') }, // (v1.10.91: the 잡화점 is the new store of goods)
    { id: 'transform', name: '변신 의상실', open: () => openTransformShop() }, // v1.10.91 변신 따로 판매
    { id: 'store', name: '백화점', open: () => storeDoor(true) }, // v1.10.92 백화점: in through its door (the shops are its sectors inside)
    { id: 'faces', name: '성형외과', open: () => openLookShop('surgery') },
    { id: 'dye', name: '염색사', open: () => openLookShop('dye') },
    { id: 'records', name: '전적관', open: () => openPlazaWindow('전적관', [byId('myRecordsCard')]) },
    { id: 'board', name: '게시판', open: () => { openPlazaWindow('게시판', [byId('announcementsCard'), titleHall()]); plazaDialog.classList.add('boardMode'); } }, // (창 2단계: a cork board) // v1.10.89 + 칭호 명예의 전당
    { id: 'missions', name: '미션판', open: () => byId('missionBtn').click() },
    { id: 'attendance', name: '출석', open: () => openAttendanceCard() }, // (창 2단계: a stamp card)
    { id: 'climb', name: '등반 도전', open: () => byId('climbBtn').click() },
    { id: 'donate', name: '기부', open: () => openDonation() }, // v1.10.5 기부 동상
    { id: 'naming', name: '개명소', open: () => openNaming() }, // v1.10.9 작명소
    { id: 'townhall', name: '관공서', open: () => townhallDoor(true) }, // v1.10.10 이벤트 인벤토리; v1.10.84 in through the door (the 민원 창구 inside)
    { id: 'jail', name: '구치소', open: () => jailDoor(true) }, // R4 구치소 반성문
    { id: 'trader', name: '상인', open: () => openIslandPlace('merchant') },
    { id: 'map', name: '안내 지도', open: () => openIslandMap() }, // v1.10.0
    { id: 'admin', name: '관리실', admin: true, open: () => openPlazaWindow('관리실', [byId('adminPresencePanel'), byId('adminPanel')]) },
  ];
  const plazaHomes = new Map(); // section -> the marker where it lives in the classic lobby
  // v1.10.89 칭호 명예의 전당 (IDEAS #future-title-history): on the plaza board under the notices, folded until opened --
  // a title picked, its holders from the first recorded week as 1대, 2대 ... (the current one marked), 20 at a time.
  // It lives in a hidden holder off the board, so the window puts it back there on closing like any other card.
  // 창 2단계 출석 (gamecenter-notes docs/dialogue-box-redesign-20261025.md): a stamp card -- this month's days in round
  // spaces, a stamp on each day attended; today's space waits for its stamp (the button), then takes it with a little press
  const attendanceCard = document.createElement('section'); attendanceCard.className = 'isle-paper stampCard'; attendanceCard.id = 'stampCard';
  { const home = document.createElement('div'); home.hidden = true; document.body.append(home); home.append(attendanceCard); } // (a home to go back to, as the other cards)
  async function openAttendanceCard(stampedNow = false) {
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    attendanceCard.replaceChildren(el('p', 'emptyState', '불러오는 중입니다.'));
    if (!plazaDialog.open || !plazaDialog.classList.contains('stampMode')) { openPlazaWindow('출석 도장', [attendanceCard]); plazaDialog.classList.add('stampMode'); }
    try {
      const d = await api('/api/points/attendance/month'); const [, mm] = d.month.split('-'); const done = new Set(d.days); const big = new Set(d.big || []); // (경제 점검 ⑥-C: a 7th day in a row -- the big stamp)
      const head = el('div', 'stampHead'); head.append(el('strong', '', `${Number(mm)}월 출석 도장`), el('span', 'stampCount', `${d.days.length}일 / ${d.length}일`));
      const grid = el('div', 'stampGrid'); for (const w of ['일', '월', '화', '수', '목', '금', '토']) grid.append(el('span', 'stampWeekday', w));
      for (let k = 0; k < d.firstWeekday; k += 1) grid.append(el('span', 'stampBlank'));
      for (let day = 1; day <= d.length; day += 1) {
        const cell = el('span', `stampDay${done.has(day) ? ' stamped' : ''}${big.has(day) ? ' big' : ''}${day === d.today ? ' today' : ''}${day > d.today ? ' later' : ''}${stampedNow && day === d.today ? ' justNow' : ''}`);
        cell.append(el('span', 'stampNum', String(day))); if (done.has(day)) cell.append(el('span', 'stampInk', big.has(day) ? '일주일 개근!' : '참 잘했어요'));
        cell.setAttribute('aria-label', `${day}일${done.has(day) ? ' 출석' : ''}`); grid.append(cell);
      }
      const claimed = done.has(d.today); const btn = el('button', 'primary stampBtn', claimed ? '오늘 출석 완료' : `오늘 출석하기 +${Number(d.pay).toLocaleString('ko-KR')}P`); btn.type = 'button'; btn.disabled = claimed;
      head.append(el('span', 'stampStreak', `연속 ${d.streak}일 · 7일마다 큰 도장`));
      btn.addEventListener('click', async () => { btn.disabled = true; await claimAttendance(); if (plazaDialog.open && plazaDialog.classList.contains('stampMode')) openAttendanceCard(true); }); // (Codex 검토 2차: closed or another window opened meanwhile -- not opened again)
      attendanceCard.replaceChildren(head, grid, btn);
    } catch (error) { attendanceCard.replaceChildren(el('p', 'emptyState', error.message)); }
  }
  // v1.10.90 잡초 게시판 (IDEAS #future-weed-board): today's pull and hand-in rankings (top 10 and mine), yesterday's
  // island pulls and today's weeds, yesterday's two best hand-ins, this week's hand-ins and last week's 제초왕
  let weedBoardCard = null;
  function weedBoard() {
    if (!weedBoardCard) { const home = document.createElement('div'); home.hidden = true; document.body.append(home); weedBoardCard = document.createElement('section'); weedBoardCard.className = 'card weedBoardCard'; weedBoardCard.id = 'weedBoardCard'; home.append(weedBoardCard); }
    const card = weedBoardCard; const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    card.replaceChildren(el('p', 'emptyState', '불러오는 중입니다.'));
    const list = (title, b, unit) => {
      const box = el('div', 'weedBoardList'); box.append(el('h3', '', `${title} · 섬 전체 ${b.total.toLocaleString('ko-KR')}${unit}`));
      if (!b.top.length) { box.append(el('p', 'smallMuted', '아직 없어요.')); return box; }
      const ol = el('ol'); for (const r of b.top) { const li = el('li', r.mine ? 'mine' : ''); li.append(el('strong', '', `${r.rank}위`), el('span', '', r.name), el('span', 'smallMuted', `${r.total}${unit}`)); ol.append(li); }
      box.append(ol); if (b.me && !b.top.some((r) => r.mine)) box.append(el('p', 'smallMuted', `내 순위: ${b.me.rank}위 · ${b.me.total}${unit}`));
      return box;
    };
    api('/api/island/weeds/board').then((d) => {
      const head = el('div', 'weedBoardHead');
      head.append(el('p', '', d.island.yesterdayPulled == null ? `오늘 잡초 ${d.island.weeds.toLocaleString('ko-KR')}포기` : `어제 섬 전체 ${d.island.yesterdayPulled.toLocaleString('ko-KR')}포기 뽑음 · 오늘 잡초 ${d.island.weeds.toLocaleString('ko-KR')}포기`));
      head.append(el('p', 'weedBoardMerit', d.merit.length ? `어제의 납품 수훈 · ${d.merit.map((m) => `${m.rank}위 ${m.name} ${m.total}포기`).join(' · ')}` : '어제의 납품 수훈 · 어제 납품 없음'));
      head.append(el('p', 'smallMuted', `지난주 제초왕: ${d.lastWeekKing || '없음'} · 이번 주 납품 1위가 다음 주 「제초왕」`));
      card.replaceChildren(head, list('오늘 뽑은 순위', d.today.pulls, '포기'), list('오늘 납품 순위', d.today.submits, '포기'), list('이번 주 납품 순위', d.week, '포기'));
    }).catch((error) => card.replaceChildren(el('p', 'emptyState', error.message)));
    return card;
  }
  let titleHallCard = null;
  function titleHall() {
    if (titleHallCard) return titleHallCard;
    const home = document.createElement('div'); home.hidden = true; document.body.append(home);
    const card = titleHallCard = document.createElement('section'); card.className = 'card noticeCard titleHallCard'; card.setAttribute('aria-label', '칭호 명예의 전당');
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'noticeTab'; toggle.id = 'titleHallTab'; toggle.textContent = '🏆 칭호 명예의 전당'; toggle.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('div'); panel.className = 'titleHallPanel hidden'; panel.id = 'titleHallPanel'; toggle.setAttribute('aria-controls', panel.id);
    card.append(toggle, panel); home.append(card);
    let titles = []; let pick = 'champion'; let shown = 20;
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const draw = () => {
      panel.replaceChildren();
      const tabs = el('div', 'skinTabs'); tabs.setAttribute('role', 'tablist');
      for (const t of titles) { const b = el('button', 'skinTab', t.name); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(t.id === pick)); b.addEventListener('click', () => { pick = t.id; shown = 20; draw(); }); tabs.append(b); }
      panel.append(tabs);
      const t = titles.find((x) => x.id === pick); if (!t) return;
      const now = t.entries.find((e) => e.current);
      panel.append(el('p', 'titleHallHead', `${t.name} · ${t.kind} · ${t.about}`), el('p', 'smallMuted', now ? `현재: ${now.names.join(', ')}` : '현재 보유자 없음'));
      if (!t.entries.length) { panel.append(el('p', 'emptyState', '아직 수여 기록이 없습니다.')); return; }
      panel.append(el('p', 'smallMuted', `기록 시작: ${t.since}`));
      const list = el('ol', 'titleHallList');
      for (const e of t.entries.slice(0, shown)) {
        const li = el('li', `titleHallRow${e.current ? ' current' : ''}${e.mine ? ' mine' : ''}`);
        li.append(el('strong', '', `${e.n}대`), el('span', '', e.names.join(', ')), el('span', 'smallMuted', `${e.start.slice(5).replace('-', '/')} ~ ${e.end.slice(5).replace('-', '/')}`));
        if (e.current) li.append(el('span', 'titleHallNow', '현재'));
        list.append(li);
      }
      panel.append(list);
      if (t.entries.length > shown) { const more = el('button', 'ghost tiny', `더 보기 (${t.entries.length - shown})`); more.type = 'button'; more.addEventListener('click', () => { shown += 20; draw(); }); panel.append(more); }
    };
    toggle.addEventListener('click', async () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); panel.classList.toggle('hidden', !open);
      if (!open) return;
      panel.replaceChildren(el('p', 'emptyState', '불러오는 중입니다.'));
      try { titles = (await api('/api/island/titles')).titles; shown = 20; draw(); } catch (error) { panel.replaceChildren(el('p', 'emptyState', error.message)); }
    });
    return card;
  }
  // (문제 기록 3회차 14 「안내 지도가 너무 지저분해. 크게 확대해서 볼 수 있게」) the map window as wide as the screen, drawn at
  // its own size; the wheel or a pinch brings it closer round the point under it (to 6x), a drag moves it
  const islandMapView = { zoom: 1, x: 0, z: 0 }; let islandMapAt = null;
  function drawIslandMap() {
    const canvas = byId('islandMapCanvas'); const r = canvas.getBoundingClientRect(); const k = Math.min(2, window.devicePixelRatio || 1);
    if (r.width && (canvas.width !== Math.round(r.width * k) || canvas.height !== Math.round(r.height * k))) { canvas.width = Math.round(r.width * k); canvas.height = Math.round(r.height * k); }
    islandMapAt = plaza.controller?.drawMap?.(canvas, islandMapView) || null;
  }
  function openIslandMap() {
    Object.assign(islandMapView, { zoom: 1, x: 0, z: 0 });
    openPlazaWindow('안내 지도', [byId('islandMapCard')]); plazaDialog.classList.add('mapMode');
    requestAnimationFrame(drawIslandMap);
  }
  {
    const canvas = byId('islandMapCanvas'); const pointers = new Map(); let pinch = null;
    // the point under (px, py) -- CSS pixels on the canvas -- stays under it at the new zoom
    const zoomAt = (px, py, zoom) => {
      if (!islandMapAt) return; const r = canvas.getBoundingClientRect(); const k = canvas.width / r.width;
      const dx = (px * k - canvas.width / 2); const dy = (py * k - canvas.height / 2);
      const wx = islandMapView.x + dx / islandMapAt.s; const wz = islandMapView.z + dy / islandMapAt.s;
      const z = Math.max(1, Math.min(6, zoom)); const s = (islandMapAt.s / islandMapView.zoom) * z;
      Object.assign(islandMapView, { zoom: z, x: wx - dx / s, z: wz - dy / s }); clampMap(); drawIslandMap();
    };
    const clampMap = () => { const lim = 200 * (1 - 1 / islandMapView.zoom); islandMapView.x = Math.max(-lim, Math.min(lim, islandMapView.x)); islandMapView.z = Math.max(-lim, Math.min(lim, islandMapView.z)); };
    const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = local(e); zoomAt(x, y, islandMapView.zoom * Math.exp(-e.deltaY / 400)); }, { passive: false });
    canvas.addEventListener('pointerdown', (e) => { pointers.set(e.pointerId, local(e)); pinch = null; try { canvas.setPointerCapture(e.pointerId); } catch { /* not a live pointer */ } });
    canvas.addEventListener('pointermove', (e) => {
      const was = pointers.get(e.pointerId); if (!was || !islandMapAt) return; const now = local(e); pointers.set(e.pointerId, now);
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch) zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, islandMapView.zoom * (d / pinch)); pinch = d; return;
      }
      const k = canvas.width / canvas.getBoundingClientRect().width;
      islandMapView.x -= ((now[0] - was[0]) * k) / islandMapAt.s; islandMapView.z -= ((now[1] - was[1]) * k) / islandMapAt.s; clampMap(); drawIslandMap();
    });
    const lift = (e) => { pointers.delete(e.pointerId); pinch = null; };
    canvas.addEventListener('pointerup', lift); canvas.addEventListener('pointercancel', lift);
  }
  function openPlazaWindow(title, nodes) {
    plazaDialog.classList.remove('talkMode', 'editMode', 'folded', 'mapMode', 'stampMode', 'boardMode', 'mailMode', 'shopMode'); plaza.controller?.talkCamera?.(false); // openTalk puts both back for a resident's words
    plazaDialogTitle.textContent = title;
    // (3-1, 사용자 2026-10-19 성형외과 창에 변신 목록: a window opened over another one -- the window still open -- left
    // the earlier one's content in it; whatever is not part of this window goes back home first)
    for (const node of [...plazaHomes.keys()]) if (!nodes.includes(node)) sendPlazaHome(node);
    for (const node of nodes) {
      if (!node || plazaHomes.has(node)) continue;
      const mark = document.createComment('plaza'); node.before(mark); plazaHomes.set(node, mark); plazaDialogBody.append(node);
    }
    if (!plazaDialog.open) plazaDialog.showModal();
  }
  // (bugs 10, 사용자 2026-10-19 「상점 창이 한번 열면 다른 거 할 때도 계속 떠」) a window's content back where it came
  // from -- or, made for the window alone (no home on the page), away: never left in the next window or on the page
  function sendPlazaHome(node) { const mark = plazaHomes.get(node); if (mark?.isConnected) mark.replaceWith(node); else node.remove(); plazaHomes.delete(node); }
  // the island's windows close when I go in or out of a building (the place they belong to is gone)
  const closeIslandWindows = () => { for (const id of ['plazaDialog', 'skinShopDialog', 'islandPlaceDialog']) { const d = byId(id); if (d?.open) d.close(); } };
  let questDepartureDialog = null;
  plazaDialog.addEventListener('close', () => {
    if (plazaDialog.open) return; // a queued close from the previous window must not empty a newly opened one
    const departed = questDepartureDialog; questDepartureDialog = null;
    if (departed === plaza.controller) departed?.holdQuestDeparture?.(false);
    for (const node of [...plazaHomes.keys()]) sendPlazaHome(node); // (3-1: the 변신 의상실's card has no home: it leaves, not lingers into the next window)
    plazaDialog.classList.remove('talkMode');
    plaza.controller?.talkCamera?.(false); // back to the player's own view
    if (document.body.classList.contains('plazaMode')) plazaStage.focus({ preventScroll: true });
  });
  document.getElementById('plazaCloseBtn').addEventListener('click', () => plazaDialog.close());
  // v1.10.62 모바일 아일랜드 (IDEAS 2026-10-11): on a touch-only screen a stick walks (one finger; a drag on the island
  // itself still turns the camera, so both thumbs work at once) and tapping the hint does what Space does.
  // any touch screen (not "only touch"): a phone with a stylus or a paired mouse also reports a fine pointer, and with
  // no keyboard it would have no way to walk (Codex review on #206). A touch laptop just gets the stick as well.
  const touchIsland = window.matchMedia('(any-pointer: coarse)').matches;
  document.body.classList.toggle('touchIsland', touchIsland);
  if (touchIsland) byId('islandChatInput').placeholder = '메시지 입력'; // no Enter/Esc keys to name on a phone
  const islandStick = byId('islandStick'); const stickKnob = islandStick.firstElementChild; let stickPointer = null;
  function moveStick(event) {
    const box = islandStick.getBoundingClientRect(); const r = box.width / 2;
    let dx = event.clientX - box.left - r; let dy = event.clientY - box.top - r;
    const d = Math.hypot(dx, dy); if (d > r) { dx *= r / d; dy *= r / d; }
    stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    const live = d > r * 0.2; // a small dead zone: a thumb resting on the middle does not walk
    plaza.controller?.setStick?.(live ? dx / r : 0, live ? dy / r : 0);
  }
  function endStick(event) {
    if (event.pointerId !== stickPointer) return;
    stickPointer = null; stickKnob.style.transform = ''; plaza.controller?.setStick?.(0, 0);
  }
  // v1.10.67 조이스틱 위치·크기 (사용자 2026-10-12); v1.10.84 조작 배치 (사용자 2026-10-17): every phone control -- the stick
  // (left hand), 상호작용 · 걷기 · 뛰기 (right hand) -- has its place (its centre as a share of the island screen, so a turned
  // phone keeps it in the same corner) and its size, kept on this device. 메뉴 → 「조작 배치」: any control is dragged to its
  // place, the one last touched is sized by the slider, nothing walks or acts meanwhile; 「기본값」 puts them all back.
  const CONTROLS = {
    stick: { el: islandStick, key: 'gc.stick', name: '조이스틱', min: 80, max: 180, knob: true },
    act: { el: byId('islandActBtn'), key: 'gc.ctl.act', name: '상호작용', min: 48, max: 130 },
    walk: { el: byId('islandWalkBtn'), key: 'gc.ctl.walk', name: '걷기', min: 40, max: 110 },
    run: { el: byId('islandRunBtn'), key: 'gc.ctl.run', name: '뛰기', min: 40, max: 110 },
  };
  for (const c of Object.values(CONTROLS)) {
    c.place = null; // { x, y, size } or null (the CSS default)
    try { const saved = JSON.parse(localStorage.getItem(c.key) || 'null'); if (saved && [saved.x, saved.y, saved.size].every(Number.isFinite)) c.place = saved; } catch {}
  }
  const clampCtl = (c, p) => ({ x: Math.min(0.95, Math.max(0.05, p.x)), y: Math.min(0.95, Math.max(0.05, p.y)), size: Math.min(c.max, Math.max(c.min, Math.round(p.size))) });
  function applyCtl(c) {
    const st = c.el.style;
    if (!c.place) { for (const k of ['left', 'top', 'right', 'bottom', 'width', 'height', '--stick-knob']) st.removeProperty(k); return; }
    const { x, y, size } = c.place;
    // the whole control stays on the island screen, whatever its size or the phone's turn (Codex review): the saved
    // place is a share, and here it is held inside by its radius in pixels
    const W = plazaStage.clientWidth; const H = plazaStage.clientHeight; const half = size / 2 + 4;
    const fit = (v, len) => (len > 2 * half ? Math.min(len - half, Math.max(half, v * len)) : len / 2);
    if (W && H) { st.left = `${Math.round(fit(x, W) - size / 2)}px`; st.top = `${Math.round(fit(y, H) - size / 2)}px`; }
    else { st.left = `calc(${(x * 100).toFixed(2)}% - ${size / 2}px)`; st.top = `calc(${(y * 100).toFixed(2)}% - ${size / 2}px)`; }
    st.right = st.bottom = 'auto'; st.width = st.height = `${size}px`;
    if (c.knob) st.setProperty('--stick-knob', `${Math.round(size * 0.43)}px`);
  }
  const applyAll = () => { for (const c of Object.values(CONTROLS)) applyCtl(c); };
  window.addEventListener('resize', applyAll); // a turned phone: back inside
  function saveCtl(c) { try { if (c.place) localStorage.setItem(c.key, JSON.stringify(c.place)); else localStorage.removeItem(c.key); } catch {} }
  applyAll();
  const stickEditBar = byId('stickEditBar'); const stickSizeInput = byId('stickSizeInput');
  const stickEditing = () => document.body.classList.contains('stickEdit');
  function currentCtl(c) { // a control's place now, whether saved or the CSS default
    const stage = plazaStage.getBoundingClientRect(); const box = c.el.getBoundingClientRect();
    return { x: (box.left + box.width / 2 - stage.left) / stage.width, y: (box.top + box.height / 2 - stage.top) / stage.height, size: box.width };
  }
  let ctlSel = 'stick';
  function selectCtl(id) { // the slider sizes this one
    ctlSel = id; const c = CONTROLS[id];
    for (const [k, other] of Object.entries(CONTROLS)) other.el.classList.toggle('ctlSelected', k === id && stickEditing());
    stickSizeInput.min = String(c.min); stickSizeInput.max = String(c.max); stickSizeInput.value = String(Math.round(currentCtl(c).size));
    byId('stickEditHint').textContent = `조작 버튼을 끌어서 옮기고, 누른 버튼의 크기를 바꾸세요 · ${c.name}`;
  }
  function setStickEditing(on) {
    document.body.classList.toggle('stickEdit', on); stickEditBar.classList.toggle('hidden', !on);
    if (on) { plaza.controller?.setStick?.(0, 0); plaza.controller?.setRun?.(false); selectCtl('stick'); }
    else { if (ctlDrag) saveCtl(CONTROLS[ctlDrag.id]); ctlDrag = null; for (const c of Object.values(CONTROLS)) c.el.classList.remove('ctlSelected'); } // (a finger still on a control stops carrying it)
  }
  // only on the island itself (a room's menu has no stick to adjust -- Codex review); leaving the island ends it
  const stickEditable = () => touchIsland && document.body.classList.contains('plazaMode') && roomView.classList.contains('hidden');

  new MutationObserver(() => { if (stickEditing() && !stickEditable()) setStickEditing(false); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  byId('stickEditBtn').addEventListener('click', () => { byId('gameMenuDialog').close(); setStickEditing(true); });
  // 문제 기록 5회차 1: 「섬 화질」 -- 자동 (steps down when slow, up again when fast) or fixed, kept on this device
  const qualityMode = () => { try { const v = localStorage.getItem('gc.quality'); return ['0', '1', '2'].includes(v) ? v : 'auto'; } catch { return 'auto'; } };
  byId('qualitySelect').value = qualityMode();
  byId('qualitySelect').addEventListener('change', (event) => { try { localStorage.setItem('gc.quality', event.target.value); } catch {} plaza.controller?.setQualityMode?.(event.target.value); });
  // 사용자 「파도가 전혀 안 움직여」: 「움직임 줄이기」 -- the device's setting (default), or on/off whatever it says, kept on this device
  const motionMode = () => { try { const v = localStorage.getItem('gc.lessMotion'); return v === 'on' || v === 'off' ? v : 'auto'; } catch { return 'auto'; } };
  byId('motionSelect').value = motionMode();
  byId('motionSelect').addEventListener('change', (event) => { try { localStorage.setItem('gc.lessMotion', event.target.value); } catch {} plaza.controller?.setMotionMode?.(event.target.value); });
  byId('stickDoneBtn').addEventListener('click', () => setStickEditing(false));
  byId('stickResetBtn').addEventListener('click', () => { for (const c of Object.values(CONTROLS)) { c.place = null; applyCtl(c); saveCtl(c); } selectCtl(ctlSel); });
  stickSizeInput.addEventListener('input', () => { const c = CONTROLS[ctlSel]; c.place = clampCtl(c, { ...currentCtl(c), size: Number(stickSizeInput.value) }); applyCtl(c); saveCtl(c); });
  // adjusting: the finger carries the control it touched (and picks it for the slider)
  let ctlDrag = null;
  function dragStart(id, event) {
    if (!stickEditing()) return false;
    event.preventDefault(); if (ctlDrag) return true;
    const c = CONTROLS[id]; selectCtl(id);
    const now = currentCtl(c); const stage = plazaStage.getBoundingClientRect();
    ctlDrag = { id, pointer: event.pointerId, dx: now.x - (event.clientX - stage.left) / stage.width, dy: now.y - (event.clientY - stage.top) / stage.height, size: now.size };
    c.el.setPointerCapture(event.pointerId); return true;
  }
  function dragMove(event) {
    if (ctlDrag?.pointer !== event.pointerId || !stickEditing()) return false;
    const c = CONTROLS[ctlDrag.id]; const stage = plazaStage.getBoundingClientRect();
    c.place = clampCtl(c, { x: (event.clientX - stage.left) / stage.width + ctlDrag.dx, y: (event.clientY - stage.top) / stage.height + ctlDrag.dy, size: c.place?.size ?? ctlDrag.size }); // (the slider may have sized it meanwhile)
    applyCtl(c); return true;
  }
  const dragEnd = (event) => { if (ctlDrag?.pointer === event.pointerId) { saveCtl(CONTROLS[ctlDrag.id]); ctlDrag = null; } };
  for (const [id, c] of Object.entries(CONTROLS)) {
    c.el.addEventListener('pointerdown', (event) => dragStart(id, event), true); // (capture: before the control's own use)
    c.el.addEventListener('pointermove', dragMove);
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) c.el.addEventListener(type, dragEnd);
  }
  // the right hand: 상호작용 is SPACE; 걷기 switches 느리게/보통 (a tap); 뛰기 runs while held, back to that walk on letting go
  const walkBtn = CONTROLS.walk.el; const runBtn = CONTROLS.run.el;
  const PACE_LABEL = { slow: '느리게', walk: '걷기', run: '걷기' };
  const showPace = () => { walkBtn.textContent = PACE_LABEL[plaza.controller?.walkPace?.()] || '걷기'; };
  // (2회차 11: held before a piece of my house it grabs it -- the scene tells a hold from a tap)
  CONTROLS.act.el.addEventListener('pointerdown', (event) => { if (stickEditing()) return; event.preventDefault(); CONTROLS.act.el.setPointerCapture?.(event.pointerId); plaza.controller?.actDown?.(); });
  for (const type of ['pointerup', 'pointercancel']) CONTROLS.act.el.addEventListener(type, () => plaza.controller?.actUp?.());
  walkBtn.addEventListener('pointerdown', (event) => { if (stickEditing()) return; event.preventDefault(); plaza.controller?.paceTap?.(); showPace(); });
  runBtn.addEventListener('pointerdown', (event) => { if (stickEditing()) return; event.preventDefault(); runBtn.setPointerCapture(event.pointerId); plaza.controller?.setRun?.(true); runBtn.classList.add('on'); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) runBtn.addEventListener(type, () => { plaza.controller?.setRun?.(false); runBtn.classList.remove('on'); });
  islandStick.addEventListener('pointerdown', (event) => {
    if (stickEditing()) return; // (the drag above)
    event.preventDefault();
    if (stickPointer !== null) return; // the first finger keeps the stick until it lets go (Codex review)
    stickPointer = event.pointerId; islandStick.setPointerCapture(event.pointerId); moveStick(event);
  });
  islandStick.addEventListener('pointermove', (event) => {
    if (stickEditing()) return;
    if (event.pointerId === stickPointer) moveStick(event);
  });
  islandStick.addEventListener('pointerup', endStick);
  islandStick.addEventListener('pointercancel', endStick);
  islandStick.addEventListener('lostpointercapture', endStick); // never left held if the browser drops the touch
  plazaHint.addEventListener('click', () => { if (touchIsland) plaza.controller?.act?.(); });
  // v1.10.62 전체화면 (PC·휴대폰): the whole page, so windows and dialogs still open over the island; the button
  // follows the state (Esc or the phone's back also leave it). Not where the browser has none (iPhone Safari).
  const fullscreenBtn = byId('fullscreenBtn');
  if (document.fullscreenEnabled) {
    fullscreenBtn.classList.remove('hidden');
    fullscreenBtn.addEventListener('click', () => {
      const request = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      request?.catch?.(() => showToast('전체화면으로 바꾸지 못했습니다.'));
      if (document.body.classList.contains('plazaMode')) plazaStage.focus({ preventScroll: true }); // Space stays the island's (Codex review)
    });
    document.addEventListener('fullscreenchange', () => {
      const on = Boolean(document.fullscreenElement);
      fullscreenBtn.textContent = on ? '창 모드' : '전체화면'; fullscreenBtn.setAttribute('aria-pressed', String(on));
    });
  }
  // v1.10.66 홈 화면 앱: where a page cannot go fullscreen (an iPhone), the menu tells how to get the same -- the island
  // icon on the home screen opens without the address bar. Not shown once opened that way.
  const homeApp = window.matchMedia?.('(display-mode: standalone)').matches || window.matchMedia?.('(display-mode: fullscreen)').matches || navigator.standalone === true;
  byId('homeAppHint').classList.toggle('hidden', Boolean(document.fullscreenEnabled || homeApp));
  // v1.10.63 메뉴 (IDEAS 2026-10-11): no account bar; as in other games, Esc opens one window -- 내 정보, 환경설정
  // (theme, fullscreen), 관리자 창 for an admin, 접속 종료. The ☰ button opens it where there is no Esc (a phone).
  // Esc does this only with nothing else to close or cancel: an open window, typing, the photo mode, a gathering.
  const gameMenuDialog = byId('gameMenuDialog');
  const openGameMenu = () => {
    if (gameMenuDialog.open) return;
    byId('menuLeaveRoomBtn').classList.toggle('hidden', roomView.classList.contains('hidden')); // 게임방 only
    // v1.10.67 조이스틱 위치·크기: a touch screen on the island itself only (not a room's menu -- Codex review)
    byId('stickEditBtn').classList.toggle('hidden', !(document.body.classList.contains('touchIsland') && document.body.classList.contains('plazaMode') && roomView.classList.contains('hidden')));
    byId('issueLogBtn').classList.toggle('hidden', !canIssue()); refreshIssueWriter(); gameMenuDialog.showModal(); guideDone('menu');
  };
  byId('gameMenuBtn').addEventListener('click', openGameMenu);
  byId('gameMenuCloseBtn').addEventListener('click', () => gameMenuDialog.close());
  for (const btn of [myInfoBtn, adminWindowBtn, logoutBtn, byId('issueLogBtn')]) btn.addEventListener('click', () => gameMenuDialog.close(), true); // the next window replaces the menu
  gameMenuDialog.addEventListener('close', () => { if (document.body.classList.contains('plazaMode') && !document.querySelector('dialog[open]')) plazaStage.focus({ preventScroll: true }); });
  // v1.10.63 게임방: the same menu, with 게임 선택으로 돌아가기 on top (the room's own buttons stay in its top bar)
  const menuLeaveRoomBtn = byId('menuLeaveRoomBtn');
  menuLeaveRoomBtn.addEventListener('click', () => { gameMenuDialog.close(); leaveRoomBtn.click(); });
  const menuResignBtn = byId('menuResignBtn'); // (G-틀①: while a hand is played 기권 is in ☰ -- the panel it sits in is folded)
  menuResignBtn.addEventListener('click', () => { gameMenuDialog.close(); resignBtn.click(); });
  // G-틀③ 게임 효과음: on by default, one setting with 한판마당 (gc.settings.sound) -- read again whenever the menu opens
  const roomSoundToggle = byId('roomSoundToggle');
  const syncSoundToggle = () => { roomSoundToggle.checked = window.RoomSound?.isOn() ?? true; };
  syncSoundToggle(); gameMenuDialog.addEventListener('toggle', syncSoundToggle);
  // G-고스톱ⓐ 화투 패 이름 보기: off by default (the pictures alone); on, the month and kind as small corner tags -- this device's
  const hwatuNamesToggle = byId('hwatuNamesToggle');
  const setHwatuNames = (on) => { document.body.classList.toggle('hwatuNames', on); hwatuNamesToggle.checked = on; };
  try { setHwatuNames(localStorage.getItem('gc.hwatuNames') === '1'); } catch { setHwatuNames(false); }
  hwatuNamesToggle.addEventListener('change', () => { setHwatuNames(hwatuNamesToggle.checked); try { localStorage.setItem('gc.hwatuNames', hwatuNamesToggle.checked ? '1' : '0'); } catch {} });
  roomSoundToggle.addEventListener('change', () => { window.RoomSound?.setOn(roomSoundToggle.checked); if (roomSoundToggle.checked) window.RoomSound?.play('turn'); });
  window.addEventListener('keydown', (event) => {
    if (event.isComposing || event.repeat || event.defaultPrevented) return;
    const t = event.target;
    const typing = t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName || '');
    const inRoom = !roomView.classList.contains('hidden');
    // the result card: Esc or Enter puts it away at once (clicks pass through it to the board, as before)
    if ((event.key === 'Escape' || event.key === 'Enter') && !resultEffect.classList.contains('hidden') && !typing && !document.querySelector('dialog[open]')) { event.preventDefault(); clearResultEffect(); return; }
    if (inRoom && event.key === 'Escape' && t === chatInput) { chatInput.blur(); return; } // out of the chat; the next Esc is the menu
    // in a room, Enter with nothing focused goes to the room chat
    if (inRoom && event.key === 'Enter' && !typing && (t === document.body || !t?.closest?.('button, a, summary, [tabindex], label')) && chatInput.offsetParent && !document.querySelector('dialog[open]')) { event.preventDefault(); chatInput.focus(); return; }
    if (event.key !== 'Escape' || (lobbyView.classList.contains('hidden') && !inRoom)) return;
    if (document.querySelector('dialog[open]') || document.body.classList.contains('photoMode') || typing) return;
    if (inRoom && !sideOverlayBackdrop.classList.contains('hidden')) { event.preventDefault(); toggleChatOverlay(false); toggleGameInfoOverlay(false); return; } // a phone's side panel first
    if (!inRoom && plaza.controller?.debug?.()?.gather) return; // Esc there cancels the gathering (plaza-scene)
    event.preventDefault(); openGameMenu();
  });
  function showPlazaHint(facility) {
    const isTrain = facility?.id?.startsWith('train:');
    plazaHint.textContent = facility ? (facility.plain || facility.id === 'train:platform' || touchIsland ? facility.name : `SPACE · ${facility.name}`) : ''; // v1.10.47: a plain line (when the next train comes) is not a key to press; v1.10.62: on a touch screen the hint itself is tapped
    plazaHint.classList.toggle('hidden', !facility || Boolean(isTrain && !facility.plain));
    trainControls.classList.toggle('hidden', !isTrain);
    if (isTrain) {
      const waiting = facility.id === 'train:platform';
      trainMainBtn.textContent = facility.plain ? '' : waiting ? facility.name : facility.id.startsWith('train:enter:') ? '승강장 올라가기' : facility.id === 'train:board' ? '타기 · ' + facility.name.replace(' 타기', '') : facility.name;
      trainMainBtn.disabled = Boolean(facility.plain || waiting);
      trainMainBtn.classList.toggle('hidden', Boolean(facility.plain)); // next-stop countdown has one visible home: plazaHint
      trainMainBtn.onclick = () => trainAction(facility.id.slice(6));
      trainMenuBtn.classList.toggle('hidden', !plaza.controller?.platform?.() || Boolean(facility.plain));
    }
  }
  function syncPlaza(view) {
    const classicFallback = Boolean(plaza.failed) && sessionRole === 'admin'; // administrators only (internal)
    // v1.10.62 모바일 아일랜드 (IDEAS 2026-10-11): phones and narrow windows are on the island too (touch controls in plaza-scene)
    const on = view === 'lobby' && !plazaTestClassic && !classicFallback; const back = on && !document.body.classList.contains('plazaMode');
    document.body.classList.toggle('plazaMode', on);
    const facilityActions = document.getElementById('islandFacilityActions');
    facilityActions.classList.toggle('hidden', on || view !== 'lobby');
    facilityActions.setAttribute('aria-hidden', String(on || view !== 'lobby'));
    plazaStage.classList.toggle('hidden', !on);
    (on ? plazaStage : publicRoomsCardEl).append(lobbyInvitations); // room invitations stay visible over the square
    setPlazaPresence(on);
    if (!on) {
      showPlazaHint(null);
      if (plazaDialog.open) plazaDialog.close();
      plaza.controller?.stop();
      if (view === 'gate' && plaza.controller) { plaza.controller.dispose(); plaza.controller = null; } // the next login may be a different role
      return;
    }
    plazaStage.focus({ preventScroll: true });
    plazaStage.classList.toggle('plazaFailed', Boolean(plaza.failed));
    plazaError.classList.toggle('hidden', !plaza.failed);
    if (plaza.failed) return; // the error and its retry, over the island's place
    if (plaza.controller) { plaza.controller.start(); if (back) { refreshStars(); refreshContest(); } return; } // (their polls stop off the island -- Codex review)
    if (plaza.loading) return;
    // v1.10.7 당일 위치: a new island screen (a login, a reload) starts at today's last spot; coming back from a room
    // keeps the screen and so the spot it had.
    const spotToday = api('/api/plaza/spot').then((data) => data.spot || null).catch(() => null);
    const skinsToday = api('/api/skins').catch(() => null); // (my look, asked for alongside the scene: worn as the island appears, not after it -- the big island takes a while)
    try { localStorage.removeItem('gc.islandMap'); } catch {} // (묶음 3: the old preview's mark, gone with it)
    const sceneModule = import('/plaza/plaza-scene.js').catch((error) => { throw Object.assign(error, { code: 'module' }); });
    // (my look waited for with the scene: the island starts in it -- on a slow line it came seconds after the island did)
    plaza.loading = Promise.all([sceneModule, spotToday, skinsToday]).then(([mod, savedSpot, skins]) => {
      const startAt = savedSpot;
      plaza.loading = null;
      plaza.controller = mod.createPlaza(plazaStage, { // throws (with a code) when the island cannot start
        startAt,
        facilities: PLAZA_FACILITIES.filter((f) => !f.admin || sessionRole === 'admin').map(({ id, name }) => ({ id, name })),
        onInteract: (id) => (id === 'museum' ? openMuseum() : id === 'guide' ? talkGuide() : id === 'mailbox' ? openMailbox() : id === 'room:desk' ? openIslandPlace('office') : id === 'room:tax' ? openTax() : id === 'room:bank' ? openBank() : id === 'room:exit' ? townhallDoor(false) : id.startsWith('train:') ? trainAction(id.slice(6)) : id === 'seat:stand' ? (api('/api/island/stand', { method: 'POST', body: '{}' }).catch(() => {}), counterSeat && counterDialogs[counterSeat.door]?.open && counterDialogs[counterSeat.door].close()) : id.startsWith('seat:') ? sitDown(id.slice(5)) : id.startsWith('player:') ? openPlayerMenu(id.slice(7)) : id === 'fish:spot' ? fishAction() : id === 'farm:harvest' ? harvestFarm() : id === 'farm:board' ? openFarmBoard() : id === 'fest:host' ? (festivalView?.festival ? openFestival('tasks') : openWeekContest()) : id === 'fest:contest' ? openWeekContest() : id === 'fest:stall' ? openFestival('shop') : id === 'fest:harvest' ? festivalTask('harvest') : id === 'fest:feast' ? festivalTask('feast') : id === 'weedboard' ? (openPlazaWindow('잡초 게시판', [weedBoard()]), plazaDialog.classList.add('boardMode')) : id === 'mayor' ? openMayor() : id.startsWith('ev:') ? solveIslandEvent(id) : id.startsWith('resident:') ? talkResident(Number(id.slice(9))) : id === 'home:exit' ? homeDoor(null) : id === 'home:stairs_up' || id === 'home:stairs_down' ? homeStairs() :id.startsWith('home:') ? homeDoor(id.slice(5)) : id === 'tool:swing' ? swingNet() : id.startsWith('tank:') ? openTank(id.slice(5)) : id.startsWith('frame:') ? openFrame(id.slice(6)) : id.startsWith('lift:') ? openLift(Number(id.slice(5))) : id.startsWith('adopt:') ? openAdopt(id.slice(6)) : id === 'petshop:counter' ? openPetCatalog() : id.startsWith('furn:') ? openFurniture(id.slice(5)) : id === 'store:exit' ? storeDoor(false) : id === 'jail:exit' ? jailDoor(false) : id === 'jail:warden' ? openWarden() : id === 'jail:board' ? openJailBoard() : id === 'mall:store' ? storeKeeperTalk() : id === 'mall:stall' ? openIslandPlace('merchant') : id.startsWith('good:') ? openGood(id.slice(5)) : id.startsWith('weed:') ? pullWeed(id) : PLAZA_FACILITIES.find((f) => f.id === id)?.open()), // v1.10.11: an event, (v1.10.31) a weed, or a facility
        onNear: showPlazaHint,
        blocked: () => Boolean(document.querySelector('dialog[open]')) || document.activeElement === islandChatInput, // a window over the square, or typing a chat message, stops the character
      });
      document.body.classList.remove('townhallRoom'); // a new island starts outside (v1.10.84)
      plaza.controller.onBike?.((on, why) => { bikeBtn.setAttribute('aria-pressed', String(on)); if (why) showToast(why, 3000); }); refreshBikes(); refreshHomes(); refreshInsects(); plaza.controller.onInsectScare?.((id) => api('/api/island/insect/scare', { method: 'POST', body: JSON.stringify({ id }) }).catch(() => {})); // (자전거; 묶음 4 집들; 묶음 5 곤충)
      wireHomeMoves(); refreshPlazaAvatar(skins); plaza.controller.setStatues?.(plazaStatues, plazaStatuesWeek); loadWeeds(); refreshIslandTime(); refreshIslandWeather(); refreshStars(); refreshContest(); refreshPlants(); refreshFestival(); refreshBirthday(); refreshMail(true); refreshGuide();
      syncPlaza(lobbyView.classList.contains('hidden') ? '' : 'lobby'); refreshFarm(); refreshErrands(); // v1.10.80, v1.10.91
      plaza.controller.setHeldTool?.(heldTool); // (3회차 22: the tool I held, in hand again)
      plaza.controller.setQualityMode?.(qualityMode()); plaza.controller.setMotionMode?.(motionMode()); // (5회차 1: the menu's 「섬 화질」, this device's)
      refreshAffinity(); // (R2: who greets me first)
    }).catch((error) => { plaza.loading = null; plaza.controller = null; plaza.failed = plazaFailure(error); syncPlaza(lobbyView.classList.contains('hidden') ? '' : 'lobby'); });
  }
  adminWindowBtn.addEventListener('click', () => {
    if (sessionRole !== 'admin') return;
    openPlazaWindow('관리자 창', [adminPresencePanel, adminPanel]);
  });
  // v1.10.90 에셋 점검실 (IDEAS #future-admin-console ③): a folded card in the 관리자 창; the viewer module loads on opening
  let inspectorCard = null; let inspector = null;
  function assetInspectorCard() {
    if (inspectorCard) return inspectorCard;
    const home = adminPanel; // (inside the admin panel: the lobby and the 관리자 창 alike)
    inspectorCard = document.createElement('section'); inspectorCard.className = 'noticeCard'; inspectorCard.id = 'assetInspectorCard';
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'noticeTab'; toggle.id = 'assetInspectorTab'; toggle.textContent = '🔎 에셋 점검'; toggle.setAttribute('aria-expanded', 'false');
    const host = document.createElement('div'); host.className = 'hidden'; host.id = 'assetInspectorHost';
    inspectorCard.append(toggle, host); home.append(inspectorCard);
    toggle.addEventListener('click', async () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); host.classList.toggle('hidden', !open);
      if (!open) { host.replaceChildren(); inspector = null; return; }
      try { const mod = await import('/admin/asset-inspector.js'); inspector = mod.mountInspector(host, { api, toast: (m) => showToast(m, 3000) }); window.AssetInspector = inspector; } catch (error) { host.textContent = `에셋 점검을 열지 못했습니다 · ${error.message}`; }
    });
    return inspectorCard;
  }
  assetInspectorCard();
  // 관리자 「문제 기록」 (사용자 2026-10-18): where I am and what the page knows, gathered the moment the window opens
  const issueDialog = byId('issueDialog'); let issueShot = null;
  // (2026-10-20 「메신저 권한 주는 것처럼」) an account the administrator allows writes too, and sees only its own records
  let issueWriter = false; const canIssue = () => sessionRole === 'admin' || issueWriter;
  async function refreshIssueWriter() {
    if (!sessionToken) return; const was = issueWriter;
    try { issueWriter = sessionRole !== 'admin' && (await api('/api/issues/me')).allowed === true; } catch { issueWriter = false; }
    if (was !== issueWriter) byId('issueLogBtn').classList.toggle('hidden', !canIssue());
  }
  async function loadMyIssues() {
    const box = byId('issueMineList'); box.replaceChildren();
    try {
      const mine = (await api('/api/issues')).issues; if (!mine.length) { box.textContent = '아직 없어요.'; return; }
      for (const i of mine) { const row = document.createElement('p'); row.setAttribute('role', 'listitem'); row.textContent = `[${ISSUE_STATE[i.status]}] ${i.text.split('\n')[0].slice(0, 60)} · ${new Date(i.at).toLocaleString('ko-KR')}`; box.append(row); }
    } catch (error) { box.textContent = error.message; }
  }
  function issueContext() {
    const openDialogs = [...document.querySelectorAll('dialog[open]')].filter((d) => d !== issueDialog).map((d) => d.querySelector('h2')?.textContent || d.id);
    const ctx = { screen: !roomView.classList.contains('hidden') ? 'room' : document.body.classList.contains('plazaMode') ? 'island' : !document.getElementById('gamehallView')?.classList.contains('hidden') ? 'gamehall' : 'lobby', windows: openDialogs,
      device: { touch: document.body.classList.contains('touchIsland'), w: innerWidth, h: innerHeight, dpr: devicePixelRatio, ua: navigator.userAgent.slice(0, 200) }, fps: fpsNow, errors: recentErrors.slice() };
    if (ctx.screen === 'room' && state) ctx.room = { game: state.gameType || null, id: state.id || null, status: state.game?.status || null };
    const d = plaza.controller?.debug?.();
    if (ctx.screen === 'island' && d) { const T = globalThis.IslandTerrain; ctx.island = { x: +d.x.toFixed(1), z: +d.z.toFixed(1), space: d.space || 'island', season: T?.seasonAt?.(d.x, d.z, Date.now()) || null, time: d.time?.()?.phase || null, weather: d.weather?.()?.kind || null, quality: d.quality, camera: { yaw: +Number(d.camYaw).toFixed(2), pitch: +Number(d.camPitch).toFixed(2), zoom: +Number(d.zoom).toFixed(1) } }; } // (2회차: how it was looked at)
    // (문제 기록 정리 2026-10-21: what the writer wears -- each slot's item, the transformation and how it is shown, and
    // the parts the island actually put on -- so an outfit report is made again from the record)
    if (plazaAvatar?.look) ctx.wear = { look: plazaAvatar.look, parts: Array.isArray(d?.wardrobe) ? d.wardrobe.slice(0, 20) : null, transformation: typeof d?.transformation === 'string' ? d.transformation : null };
    return ctx;
  }
  async function openIssue() {
    if (!canIssue() || issueDialog.open) return;
    byId('issueMine').classList.toggle('hidden', sessionRole === 'admin'); if (sessionRole !== 'admin') loadMyIssues(); // (the administrator has the 관리자 창's list)
    issueShot = await plaza.controller?.snapshot?.() || null; // (the island's picture as it is now; other screens have none)
    byId('issueShot').src = issueShot || ''; byId('issueShot').classList.toggle('hidden', !issueShot); byId('issueShotOn').disabled = !issueShot; byId('issueShotOn').checked = Boolean(issueShot);
    byId('issueStatus').textContent = ''; issueDialog.dataset.ctx = ''; issueDialog.ctx = issueContext(); issueDialog.showModal(); byId('issueText').focus();
  }
  byId('issueLogBtn').addEventListener('click', openIssue);
  byId('myPetsBtn').addEventListener('click', openMyPets); // 묶음 2-2
  byId('furnitureStorageBtn').addEventListener('click', () => { byId('gameMenuDialog').close(); openFurnitureStorage(); }); // 묶음 2 가구 창고
  byId('myHomeBtn').addEventListener('click', () => { byId('gameMenuDialog').close(); openMyHome(); }); // 묶음 4 내 집
  byId('issueCloseBtn').addEventListener('click', () => issueDialog.close());
  byId('issueShotOn').addEventListener('change', (event) => byId('issueShot').classList.toggle('hidden', !event.target.checked || !issueShot));
  byId('issueText').addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); byId('issueForm').requestSubmit(); } });
  byId('issueForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await api(sessionRole === 'admin' ? '/api/admin/issues' : '/api/issues', { method: 'POST', body: JSON.stringify({ action: 'add', text: byId('issueText').value, kind: byId('issueKind').value, shot: byId('issueShotOn').checked ? issueShot : null, ctx: issueDialog.ctx }) });
      byId('issueText').value = ''; issueDialog.close(); showToast('문제를 기록했어요.'); if (issueCard.open) loadIssues();
    } catch (error) { byId('issueStatus').textContent = error.message; }
  });
  // the 관리자 창's card: newest first, by state; a state changed, a record removed, the open ones copied as Markdown
  const ISSUE_KIND = { bug: '버그', odd: '어색함', idea: '개선' }; const ISSUE_STATE = { open: '열림', doing: '고치는 중', done: '해결' };
  const issueCard = document.createElement('details'); issueCard.id = 'issueCard'; issueCard.className = 'economyBox issueCard';
  issueCard.innerHTML = '<summary>문제 기록</summary><div class="issueTools"><select id="issueWho" aria-label="쓴 사람"></select><select id="issueFilter" aria-label="상태"><option value="open">열림</option><option value="doing">고치는 중</option><option value="done">해결</option><option value="">전체</option></select><button id="issueNewBtn" type="button" class="ghost tiny">새로 적기</button><button id="issueCopyBtn" type="button" class="ghost tiny">열린 것 복사</button></div><div id="issueList" class="issueList" role="list"></div>';
  adminPanel.append(issueCard);
  let issues = [];
  const issueBy = (i) => i.by?.label || '관리자';
  const issueWhere = (i) => [i.ctx?.screen === 'room' ? `게임방 ${i.ctx.room?.game || ''}` : i.ctx?.screen === 'island' ? `섬 (${i.ctx.island?.x}, ${i.ctx.island?.z})${i.ctx.island?.space && i.ctx.island.space !== 'island' ? ` · ${i.ctx.island.space}` : ''}` : i.ctx?.screen || '', ...(i.ctx?.windows || [])].filter(Boolean).join(' · ');
  async function loadIssues() {
    try { issues = (await api('/api/admin/issues')).issues; } catch (error) { byId('issueList').textContent = error.message; return; }
    const want = byId('issueFilter').value; const list = byId('issueList'); list.replaceChildren();
    const who = byId('issueWho'); const pick = who.value; const names = [...new Set(issues.map(issueBy))]; who.replaceChildren(new Option('쓴 사람 전체', ''), ...names.map((n) => new Option(n, n))); who.value = names.includes(pick) ? pick : '';
    const shown = issues.filter((i) => (!want || i.status === want) && (!who.value || issueBy(i) === who.value)); if (!shown.length) list.textContent = '기록이 없어요.';
    for (const i of shown) {
      const row = document.createElement('details'); row.className = 'issueItem'; row.setAttribute('role', 'listitem');
      const head = document.createElement('summary'); head.textContent = `[${ISSUE_KIND[i.kind]}] ${i.text.split('\n')[0].slice(0, 80)} · ${issueBy(i)} · ${issueWhere(i)} · ${new Date(i.at).toLocaleString('ko-KR')} · v${i.version}`;
      const body = document.createElement('div'); body.className = 'issueBody';
      const text = document.createElement('p'); text.className = 'mailText'; text.textContent = i.text;
      const info = document.createElement('pre'); info.className = 'issueInfo'; info.textContent = JSON.stringify(i.ctx, null, 1);
      const status = document.createElement('select'); status.setAttribute('aria-label', '상태'); for (const [v, label] of Object.entries(ISSUE_STATE)) status.append(new Option(label, v)); status.value = i.status;
      status.addEventListener('change', async () => { try { await api('/api/admin/issues', { method: 'POST', body: JSON.stringify({ action: 'status', id: i.id, status: status.value }) }); loadIssues(); } catch (error) { showToast(error.message); } });
      const del = document.createElement('button'); del.type = 'button'; del.className = 'ghost tiny'; del.textContent = '지우기';
      del.addEventListener('click', async () => { if (!window.confirm('이 기록을 지울까요?')) return; try { await api('/api/admin/issues', { method: 'POST', body: JSON.stringify({ action: 'delete', id: i.id }) }); loadIssues(); } catch (error) { showToast(error.message); } });
      body.append(text, status, del, info);
      row.addEventListener('toggle', async () => { if (!row.open || !i.hasShot || body.querySelector('img')) return; const one = await api(`/api/admin/issues/${i.id}/shot`).catch(() => null); if (one?.shot) { const img = document.createElement('img'); img.className = 'issueShot'; img.alt = '기록한 화면'; img.src = one.shot; body.prepend(img); } });
      row.append(head, body); list.append(row);
    }
  }
  issueCard.addEventListener('toggle', () => { if (issueCard.open) loadIssues(); });
  byId('issueFilter').addEventListener('change', loadIssues); byId('issueWho').addEventListener('change', loadIssues);
  byId('issueNewBtn').addEventListener('click', () => { plazaDialog.open && plazaDialog.close(); openIssue(); });
  byId('issueCopyBtn').addEventListener('click', async () => {
    const open = issues.filter((i) => i.status === 'open');
    const md = open.map((i) => `- [${ISSUE_KIND[i.kind]}] ${i.text.replace(/\n/g, ' ')} — ${issueWhere(i)}, ${new Date(i.at).toLocaleString('ko-KR')}, v${i.version}${i.ctx?.fps != null ? `, ${i.ctx.fps}fps` : ''}${i.hasShot ? ', 사진 있음(행을 펼치면 보여요)' : ''}${i.ctx?.errors?.length ? `, 오류: ${i.ctx.errors.map((e) => e.text).join(' / ')}` : ''}`).join('\n');
    try { await navigator.clipboard.writeText(md || '(열린 기록 없음)'); showToast(`열린 기록 ${open.length}개를 복사했어요.`); } catch { showToast('복사하지 못했어요.'); }
  });
  // v1.9.2: my plaza look (avatar items + title) comes from the server's skin state; the name tag shows my nickname.
  let plazaAvatar = null; let plazaChampion = false; let plazaHoguking = false; let plazaStatues = []; let plazaStatuesWeek = null;
  // v1.10.30 성형외과·염색사: change one face part (30,000P each time, v1.10.35) or the colour of one owned item (5,000P each
  // time, its own colour back costs the same). A choice is pressed twice (the first press says the price); one request
  // id per choice until the server answers, so a lost answer is never paid twice.
  const lookCard = document.createElement('section'); lookCard.className = 'lobbyCard lookShop hidden';
  const lookDress = document.createElement('div'); lookDress.className = 'skinTryOn dressSide hidden'; lookDress.setAttribute('aria-live', 'polite');
  const lookRoom = document.createElement('div'); lookRoom.className = 'dressRoom'; lookRoom.append(lookCard, lookDress); document.body.append(lookRoom); // (3-1 꾸미기 창)
  let lookState = null; let lookArmed = null; let lookRequest = null; let lookArmTimer = null;
  async function openLookShop(kind) {
    lookArmed = null; lookRequest = null;
    try {
      const [shop, skins] = await Promise.all([api('/api/avatar/look-shop'), api('/api/skins')]);
      lookState = { kind, shop, skins, item: null, status: '' };
    } catch (error) { showToast(error.message); return; }
    renderLookShop(); lookCard.classList.remove('hidden');
    openPlazaWindow(kind === 'surgery' ? '성형외과' : '염색사', [lookRoom]);
    dressView(lookDress, lookState.skins.avatar?.look || {}, '지금 내 모습');
  }
  plazaDialog.addEventListener('close', () => { lookCard.classList.add('hidden'); clearTimeout(lookArmTimer); closeDress(lookDress); closeDress(tfDress); });
  // 3-1: a choice tried on -- a face part, or a colour on the item it is for (hair, eyes and skin have their own colours)
  function lookTried(b) {
    const base = lookState?.skins.avatar?.look || {}; const d = b.dataset;
    if (d.part) return { ...base, face: { ...(base.face || {}), [d.part]: d.design } };
    if (d.color != null && lookState.item) {
      const hex = d.hex || null; const item = lookState.item;
      if (item === 'base_hair') return { ...base, hairColor: hex || undefined };
      if (item === 'eyes') return { ...base, eyeColor: hex || undefined };
      if (item === 'skin') return { ...base, skinColor: hex || undefined };
      const dye = { ...(base.dye || {}) }; if (hex) dye[item] = hex; else delete dye[item]; return { ...base, dye };
    }
    return base;
  }
  for (const type of ['pointerover', 'focusin', 'click']) lookCard.addEventListener(type, (event) => { const b = event.target.closest('button[data-key]'); if (b && lookState) dressView(lookDress, lookTried(b), b.textContent.replace(/^한 번 더 누르면.*/, '').trim() || '미리 보기'); });
  function renderLookShop() {
    const { kind, shop, skins } = lookState; lookCard.textContent = '';
    const price = kind === 'surgery' ? shop.surgeryFee : shop.dyeFee;
    const head = document.createElement('p'); head.className = 'lookMeta';
    head.textContent = `보유 ${Number(skins.balance).toLocaleString('ko-KR')}P · ${kind === 'surgery' ? '시술' : '염색'} 1회 ${price.toLocaleString('ko-KR')}P`;
    lookCard.append(head);
    const choice = (label, key, current, extra = {}) => {
      const cost = extra.free ? 0 : price; // v1.10.35: a dye back to the own colour is free
      const b = document.createElement('button'); b.type = 'button'; b.dataset.key = key;
      b.className = lookArmed === key ? 'primary' : current ? 'secondary' : 'ghost';
      b.textContent = lookArmed === key ? (cost ? `한 번 더 누르면 ${cost.toLocaleString('ko-KR')}P` : '한 번 더 누르면 무료') : current ? `${label} · 지금` : label;
      b.disabled = current || skins.balance < cost;
      if (extra.swatch) { const dot = document.createElement('span'); dot.className = 'lookSwatch'; dot.style.background = extra.swatch; b.prepend(dot); }
      if (extra.image) { const image = document.createElement('img'); image.src = window.GameBoot.assetUrl(extra.image); image.alt = ''; image.width = 48; image.height = 48; image.loading = 'lazy'; image.decoding = 'async'; image.className = 'lookFaceThumb'; b.prepend(image); }
      Object.assign(b.dataset, extra.data || {});
      return b;
    };
    if (kind === 'surgery') {
      const face = skins.avatar?.look?.face || {};
      for (const [part, { label, designs }] of Object.entries(shop.faceParts)) {
        const h = document.createElement('h3'); h.textContent = label;
        const row = document.createElement('div'); row.className = 'lookChoices';
        for (const d of designs) row.append(choice(d.name, `${part}:${d.id}`, face[part] === d.id, { image: d.image, data: { part, design: d.id } }));
        lookCard.append(h, row);
      }
    } else {
      // v1.10.35: the base hair, the eyes and the skin come first (nothing to own), then the owned dyeable items
      const names = new Map([...Object.entries(shop.bodyDyes || {}), ...skins.catalog.flatMap((f) => f.skins.map((s) => [s.id, s.name]))]);
      const mine = [...Object.keys(shop.bodyDyes || {}), ...shop.dyeable.filter((id) => skins.owned.includes(id))];
      if (!mine.includes(lookState.item)) lookState.item = mine[0] || null;
      const items = document.createElement('div'); items.className = 'lookChoices';
      for (const id of mine) { const b = document.createElement('button'); b.type = 'button'; b.className = id === lookState.item ? 'secondary' : 'ghost'; b.textContent = names.get(id) || id; b.dataset.item = id; items.append(b); }
      if (mine.length) lookCard.append(items);
      if (lookState.item) {
        const current = skins.equipped?.avatar?.[`dye_${lookState.item}`] || null;
        const row = document.createElement('div'); row.className = 'lookChoices';
        row.append(choice('기본색', `${lookState.item}:`, current === null, { free: true, data: { color: '' } }));
        for (const c of lookState.item === 'skin' ? shop.skinTones : shop.palette) row.append(choice(c.name, `${lookState.item}:${c.id}`, current === c.id, { swatch: c.hex, data: { color: c.id, hex: c.hex } }));
        lookCard.append(row);
      }
    }
    const status = document.createElement('p'); status.className = 'lookMeta'; status.setAttribute('role', 'status'); status.textContent = lookState.status;
    lookCard.append(status);
  }
  lookCard.addEventListener('click', async (event) => {
    const button = event.target.closest('button'); if (!button || button.disabled || !lookState) return;
    if (button.dataset.item) { lookState.item = button.dataset.item; lookArmed = null; renderLookShop(); return; }
    const key = button.dataset.key; if (!key) return;
    if (lookArmed !== key) { // first press: what it costs
      lookArmed = key; if (lookRequest?.key !== key) lookRequest = { key, id: crypto.randomUUID() };
      lookState.status = ''; renderLookShop();
      clearTimeout(lookArmTimer); lookArmTimer = setTimeout(() => { lookArmed = null; if (lookState) renderLookShop(); }, 10000);
      return;
    }
    lookArmed = null; clearTimeout(lookArmTimer);
    const surgery = lookState.kind === 'surgery';
    const body = surgery ? { part: button.dataset.part, design: button.dataset.design, requestId: lookRequest.id } : { itemId: lookState.item, color: button.dataset.color || null, requestId: lookRequest.id };
    try {
      const data = await api(surgery ? '/api/avatar/surgery' : '/api/avatar/dye', { method: 'POST', body: JSON.stringify(body) });
      lookRequest = null;
      plazaAvatar = data.avatar || plazaAvatar; applyPlazaAvatar(); plazaLastSent = null; loadPoints();
      lookState.skins = { ...lookState.skins, balance: data.balance, equipped: data.equipped, avatar: data.avatar };
      lookState.status = surgery ? '시술을 마쳤습니다' : '염색을 마쳤습니다';
    } catch (error) { lookState.status = error.message; }
    renderLookShop();
  });

  async function refreshPlazaAvatar(asked = null) {
    try { const data = (await asked) || await api('/api/skins'); plazaAvatar = data.avatar || null; plazaChampion = Boolean(data.champion); plazaHoguking = Boolean(data.hoguking); } catch { return; }
    applyPlazaAvatar();
    plazaLastSent = null; // others see the new look with the next pose
    if (sessionRole !== 'admin' && !plazaAvatar?.look?.gender && document.body.classList.contains('plazaMode')) openGenderChoice();
  }
  // v1.10.10 이벤트 인벤토리: the island bag (the 「가방」 tab or I), and handing things in -- trash and found wallets
  // at the town hall, herbs, berries and mushrooms to the trader. One request id per visit until the server answers.
  // v1.10.37 혼자 하는 게임 — 지뢰찾기: the board is the server's (it alone knows the mines); left click opens, right click
  // flags, a click on an opened number opens around it once its flags match. A clear pays by level (shown with the time).
  const minesDialog = document.getElementById('minesDialog');
  const minesBoard = document.getElementById('minesBoard');
  const minesStatus = document.getElementById('minesStatus');
  let mines = null; let minesTimer = null; let minesBusy = false;
  const clockText = (ms) => { const t = Math.floor(ms / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  async function openMines() {
    if (plazaDialog.open) plazaDialog.close();
    try {
      const info = await api('/api/solo/minesweeper');
      mines = { levels: info.levels, records: info.records, level: info.game?.view.level || mines?.level || 'beginner', id: info.game?.id || null, view: info.game?.view || null, shownAt: Date.now() };
    } catch (error) { showToast(error.message); return; }
    minesStatus.textContent = '';
    renderMines(); if (!minesDialog.open) minesDialog.showModal();
    if (!mines.view) newMines(mines.level);
  }
  async function newMines(level) {
    try { const g = await api('/api/solo/minesweeper/new', { method: 'POST', body: JSON.stringify({ level }) }); Object.assign(mines, { level, id: g.id, view: g.view, shownAt: Date.now() }); minesStatus.textContent = ''; renderMines(); }
    catch (error) { showToast(error.message); }
  }
  function renderMines() {
    const levels = document.getElementById('minesLevels'); levels.replaceChildren();
    for (const l of mines.levels) { const b = document.createElement('button'); b.type = 'button'; b.dataset.level = l.id; b.className = l.id === mines.level ? 'secondary' : 'ghost'; b.textContent = l.label; levels.append(b); }
    const v = mines.view; const best = mines.records?.[mines.level]?.best;
    document.getElementById('minesBest').textContent = best ? `최고 ${clockText(best)}` : '';
    if (!v) { minesBoard.replaceChildren(); return; }
    document.getElementById('minesLeft').textContent = `💣 ${v.mines - v.flags}`;
    // R6 G4 (게임관 작업서): on a wide mouse screen the board as big as the window's height allows (a 26 px cell elsewhere)
    const wide = matchMedia('(min-width: 900px) and (pointer: fine)').matches;
    const cell = wide ? Math.max(26, Math.min(52, Math.floor(Math.min((innerHeight * 0.62) / v.h, (innerWidth * 0.86) / v.w)))) : 26;
    minesBoard.style.setProperty('--cell', `${cell}px`); minesBoard.style.gridTemplateColumns = `repeat(${v.w}, var(--cell))`;
    const over = v.status === 'won' || v.status === 'lost'; const mineAt = new Set(v.mineAt || []);
    const cells = v.cells.map((c, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'minesCell'; b.dataset.i = i;
      if (c >= 0) { b.classList.add('open', `n${c}`); b.textContent = c ? String(c) : ''; } else if (c === -2) b.classList.add('flag');
      if (over && mineAt.has(i) && c !== -2) b.classList.add('mine');
      if (v.boom === i) b.classList.add('boom');
      b.setAttribute('aria-label', c >= 0 ? String(c) : c === -2 ? '깃발' : '닫힘'); return b;
    });
    minesBoard.replaceChildren(...cells);
    clearInterval(minesTimer);
    const shown = () => { document.getElementById('minesTime').textContent = `⏱ ${clockText(v.status === 'playing' ? v.ms + (Date.now() - mines.shownAt) : v.ms)}`; };
    shown(); if (v.status === 'playing') minesTimer = setInterval(shown, 500);
  }
  async function actMines(action, i) {
    if (!mines?.id || minesBusy) return;
    const v = mines.view; if (v.status === 'won' || v.status === 'lost') return;
    minesBusy = true;
    try {
      const data = await api('/api/solo/minesweeper/act', { method: 'POST', body: JSON.stringify({ id: mines.id, action, x: i % v.w, y: Math.floor(i / v.w) }) });
      mines.view = data.view; mines.shownAt = Date.now();
      if (data.view.status === 'won') {
        const r = data.result;
        if (r) mines.records[mines.level] = { best: r.best, clears: r.clears };
        minesStatus.textContent = `클리어 ${clockText(data.view.ms)}${r?.newBest ? ' · 최고 기록' : ''}`;
      } else if (data.view.status === 'lost') minesStatus.textContent = '펑! 난이도를 눌러 다시 시작';
      renderMines();
    } catch (error) { showToast(error.message); if (error.status === 409) { mines.id = null; mines.view = null; renderMines(); } }
    finally { minesBusy = false; }
  }
  document.getElementById('soloMinesBtn').addEventListener('click', openMines);
  renderGameGuide(document.getElementById('minesGuide'), 'minesweeper');
  // v1.10.61 두 세계 영웅전: its own page in this tab; it ranks by this session (guest or admin), handed over in the tab's
  // sessionStorage. The browser's back returns here (a guest resumes; an admin, whose login lives only in this page, logs in again).
  // (사용자 2026-10-19) now in a window over the island -- the same tab, so its sessionStorage hands the session over; the
  // island sleeps meanwhile and its sounds stop; 「나가기」 closes the window (the whole game, its memory too) and the
  // island is where it was -- nothing loads again, an administrator stays logged in
  let herosurvFrame = null;
  function openHerosurv() {
    if (herosurvFrame) return;
    try { sessionStorage.setItem('herosurvSession', sessionToken); sessionStorage.setItem('herosurvName', String(sessionLabel || (sessionRole === 'admin' ? '관리자' : '게스트'))); } catch {} // (the name for its 명예의 전당 join, written in advance)
    plaza.controller?.stop(); document.body.classList.add('herosurvOpen');
    const frame = document.createElement('iframe'); frame.className = 'herosurvFrame'; frame.title = '두 세계 영웅전'; frame.src = '/herosurv/'; frame.allow = 'fullscreen; gamepad; autoplay';
    document.body.append(frame); herosurvFrame = frame; frame.addEventListener('load', () => frame.contentWindow?.document.getElementById('canvas')?.focus());
  }
  function closeHerosurv() {
    if (!herosurvFrame) return;
    herosurvFrame.src = 'about:blank'; herosurvFrame.remove(); herosurvFrame = null; document.body.classList.remove('herosurvOpen');
    if (document.body.classList.contains('plazaMode') && gamehallView.classList.contains('hidden')) plaza.controller?.start();
    (byId('soloHerosurvBtn').offsetParent ? byId('soloHerosurvBtn') : document.querySelector('#gamehallView:not(.hidden) .gameCard'))?.focus({ preventScroll: true });
  }
  window.addEventListener('message', (event) => { if (event.origin === location.origin && event.data?.type === 'herosurv-exit') closeHerosurv(); });
  document.getElementById('soloHerosurvBtn').addEventListener('click', openHerosurv);
  // v1.10.68 순발력 게임 (한판마당 자료): its own screen over the island; the module (public/reflex/reflex.js and the
  // engine under it) loads the first time it is opened (reflexGames is declared by showView)
  // v1.10.69 퍼즐 (스도쿠·네모로직·다리 잇기·회로 연결): the same screen with the puzzle list
  // v1.10.70 카드 게임 · 「‹ 뒤로」 (사용자 2026-10-12): back to choosing a game -- on the island the 게임관 window opens again
  // (on its 싱글게임 tab, the one last shown), as when leaving a room
  let hanpanBack = () => showView('lobby'); // where the screen opened last goes back to
  async function loadHanpan(onBack) {
    try { reflexGames ||= (await import('/reflex/reflex.js')).mount({ api, onBack: () => hanpanBack(), pieceSkin: async (gameId) => { // A3 G3-2: my equipped 오목 돌 in the AI practice too
      if (gameId !== 'gomoku') return null; try { return (await api('/api/skins')).equipped?.omok?.piece || null; } catch { return null; } } }); }
    catch { showToast('게임을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'); return false; }
    hanpanBack = () => { loadPoints(); onBack(); };
    showView('reflex');
    return true;
  }
  async function openHanpan(which) { // the classic lobby's lists
    if (await loadHanpan(() => { showView('lobby'); if (document.body.classList.contains('plazaMode')) PLAZA_FACILITIES.find((f) => f.id === 'games')?.open(); })) reflexGames.open(which);
  }
  // v1.10.73 게임 실행 규약 (IDEAS #future-gamehall-renewal): the game hall and, later, the island's quests open a solo
  // game the same way -- GameLaunch.play(game, { level, goal, place: 'gamehall' | 'quest' }) answers { game, level, score,
  // done, run } when the round ends ({ done: false } if left). From the game hall 「‹ 게임관」 comes back there; from a
  // quest, back to the island. Reward rules stay as they are (AI practice pays nothing; quests are not connected yet).
  async function playGame(game, opts = {}) {
    const place = opts.place === 'quest' ? 'quest' : 'gamehall';
    if (!(await loadHanpan(() => (place === 'gamehall' ? openGamehall() : showView('lobby'))))) return { game, done: false };
    return reflexGames.play(game, { ...opts, place });
  }
  window.GameLaunch = { play: playGame };
  document.getElementById('soloReflexBtn').addEventListener('click', () => openHanpan('reflex'));
  document.getElementById('soloPuzzleBtn').addEventListener('click', () => openHanpan('puzzle'));
  document.getElementById('soloCardsBtn').addEventListener('click', () => openHanpan('cards'));
  document.getElementById('soloAiBtn').addEventListener('click', () => openHanpan('ai')); // v1.10.71 AI 대전 (연습)

  // v1.10.73 게임관 전면 개편 (IDEAS #future-gamehall-renewal, 사용자 확정 2026-10-12): from the island the game hall is its
  // own screen -- ‹ 섬으로 · 게임관 · 효과음 · ☰, 오늘의 게임, my summary (points, games this week, win rate), category
  // chips and one card per game (public/gamehall-catalog.js). A card opens its sheet: what it is, how in three lines,
  // [빠른 시작]/[방 만들기]/[AI 연습] or [시작], that game's open rooms and its guide. 방 만들기 shows the room form with
  // that game's own options (selectGame). The classic lobby (an administrator's fallback, tests) keeps its old layout.
  const HALL = window.GamehallCatalog;
  const gamehallView = byId('gamehallView'); const gameSheet = byId('gameSheet');
  const hallChips = byId('gamehallChips'); const hallGrid = byId('gamehallGrid'); const hallRooms = byId('gamehallRooms');
  let hallCat = 'all'; let sheetGame = null; let hallIcons = null; // icons.js and store.js of the 한판마당 screens
  try { const saved = localStorage.getItem('gc.hallCat'); if (saved === 'rooms' || HALL.CATEGORIES.some(([id]) => id === saved)) hallCat = saved; } catch {}
  const hallBorrowed = new Map(); // a lobby section shown in the game hall -> the marker where it lives
  function hallBorrow(node, into) {
    if (!hallBorrowed.has(node)) { const mark = document.createComment('gamehall'); node.before(mark); hallBorrowed.set(node, mark); }
    into.append(node);
  }
  function hallReturn() { for (const [node, mark] of hallBorrowed) mark.replaceWith(node); hallBorrowed.clear(); }
  const hallEl = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  // v1.10.90 assets 38: every game's own card picture (128×128 SVG, cream/sky/gold over its gradient); the drawn icon only if it is missing
  const HALL_CARDS = new Set(HALL.GAMES.map((g) => g.id));
  const gameArtHtml = (g) => (HALL_CARDS.has(g.id) ? `<img src="/assets/gamehall/cards/${g.id}.svg" alt="" width="64" height="64" decoding="async">`
    : g.svg ? `<svg viewBox="0 0 64 64" aria-hidden="true">${HALL.SVG[g.svg]}</svg>` : hallIcons?.art(g.art) || '');
  const catName = (id) => HALL.CATEGORIES.find(([c]) => c === id)?.[1] || id;
  const paintColors = (node, g) => { node.style.setProperty('--g1', g.colors[0]); node.style.setProperty('--g2', g.colors[1]); };
  const roomsOf = (g) => (lobbyState.rooms || []).filter((r) => r.gameType === g.room || (g.room === 'omok' && r.gameType === 'omok2v2'));

  async function openGamehall() {
    if (plazaDialog.open) plazaDialog.close(); guideDone('games');
    showView('gamehall');
    try { hallIcons ||= { ...(await import('/reflex/js/icons.js')), ...(await import('/reflex/js/store.js')) }; } catch {}
    paintSoundBtn(); renderGamehall();
    loadPublicRooms().catch(() => {});
    Promise.all([api('/api/points').catch(() => null), api('/api/records/me').catch(() => null)]).then(([points, records]) => {
      const sum = (k) => gamehallView.querySelector(`[data-sum="${k}"]`);
      if (points) sum('points').textContent = `${Number(points.balance || 0).toLocaleString('ko-KR')}P`;
      if (records?.total) { sum('week').textContent = `${records.total.week || 0}판`; sum('rate').textContent = records.total.played ? `${Math.round(records.total.winRate)}%` : '-'; }
    });
    (hallGrid.querySelector('.gameCard') || byId('gamehallToday')).focus({ preventScroll: true });
  }
  function closeGamehall() { // back to the island, in front of the game hall where I came in
    if (gameSheet.open) gameSheet.close();
    hallReturn();
    showView('lobby');
  }
  function renderGamehall() {
    const today = HALL.todayGame(Date.now());
    const banner = byId('gamehallToday'); paintColors(banner, today);
    const art = hallEl('span', 'gameArt'); art.innerHTML = gameArtHtml(today);
    const words = hallEl('span', 'gamehallTodayWords'); words.append(hallEl('small', null, '오늘의 게임'), hallEl('strong', null, today.name), hallEl('span', null, today.intro));
    banner.replaceChildren(art, words); banner.onclick = () => openGameSheet(today);
    hallChips.replaceChildren();
    const chip = (id, name, count) => {
      const b = hallEl('button', 'gamehallChip'); b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.cat = id;
      b.setAttribute('aria-selected', String(hallCat === id)); b.append(name, hallEl('span', null, String(count)));
      b.addEventListener('click', () => { hallCat = id; try { localStorage.setItem('gc.hallCat', id); } catch {} renderGamehall(); hallChips.querySelector(`[data-cat="${id}"]`)?.focus(); });
      hallChips.append(b);
    };
    for (const [id, name] of HALL.CATEGORIES) chip(id, name, HALL.GAMES.filter((g) => HALL.inCategory(g, id) && (id === 'all' || !g.soon)).length);
    chip('rooms', '공개방', (lobbyState.rooms || []).length);
    hallGrid.classList.toggle('hidden', hallCat === 'rooms'); hallRooms.classList.toggle('hidden', hallCat !== 'rooms');
    if (hallCat === 'rooms') { hallBorrow(publicRoomsCardEl, hallRooms); hallBorrow(joinRoomForm, hallRooms); return; }
    hallGrid.replaceChildren();
    const list = HALL.GAMES.filter((g) => HALL.inCategory(g, hallCat) && (hallCat === 'all' || !g.soon));
    for (const g of [...list.filter((x) => !x.soon), ...list.filter((x) => x.soon)]) { // 준비 중 at the end
      const card = hallEl('button', 'gameCard'); card.type = 'button'; card.dataset.game = g.id; paintColors(card, g);
      card.classList.toggle('soon', Boolean(g.soon));
      const art = hallEl('span', 'gameArt'); art.innerHTML = gameArtHtml(g);
      card.append(art, hallEl('strong', null, g.name), hallEl('small', null, `${g.cats.map(catName).join(' · ')} · ${g.players}`));
      if (g.soon) card.append(hallEl('em', 'gameCardFlag', '준비 중'));
      card.addEventListener('click', () => openGameSheet(g));
      hallGrid.append(card);
    }
  }
  function renderGamehallRooms() {
    if (gamehallView.classList.contains('hidden')) return;
    const count = hallChips.querySelector('[data-cat="rooms"] span'); if (count) count.textContent = String((lobbyState.rooms || []).length);
    if (!gameSheet.open || !sheetGame?.room) return;
    const rooms = roomsOf(sheetGame);
    byId('gameSheetRooms').replaceChildren(...rooms.map(publicRoomRow));
    byId('gameSheetRoomsBox').classList.toggle('hidden', !rooms.length);
  }
  function openGameSheet(g) {
    sheetGame = g; paintColors(gameSheet, g); hallReturn();
    byId('gameSheetArt').innerHTML = gameArtHtml(g);
    byId('gameSheetName').textContent = g.name;
    byId('gameSheetMeta').textContent = `${g.cats.map(catName).join(' · ')} · ${g.players}${g.soon ? ' · 준비 중' : ''}`;
    byId('gameSheetIntro').textContent = g.credit ? `${g.intro} (${g.credit})` : g.intro; // (두 세계 영웅전: its maker, public/herosurv/NOTICE.md)
    byId('gameSheetHow').replaceChildren(...g.how.map((line) => hallEl('li', null, line)));
    const actions = byId('gameSheetActions'); actions.replaceChildren();
    const act = (label, cls, fn) => { const b = hallEl('button', cls, label); b.type = 'button'; b.addEventListener('click', fn); actions.append(b); return b; };
    const create = byId('gameSheetCreate'); create.classList.add('hidden');
    if (g.room) {
      if (!g.soon) act('빠른 시작', 'primary', () => quickStart(g));
      act('방 만들기', g.soon ? 'primary' : 'secondary', () => {
        selectGame(g.room); hallBorrow(document.querySelector('.roomCreatePane'), create); create.classList.remove('hidden');
        create.querySelector('input:checked, input, button')?.focus();
      });
    }
    if (g.ai) act('AI 연습', 'ghost', () => { gameSheet.close(); playGame(g.ai); });
    if (g.set) act('시작', 'primary', () => { gameSheet.close(); playGame(g.id); });
    if (g.launch) act('시작', 'primary', () => { gameSheet.close(); if (g.launch === 'mines') openMines(); else byId('soloHerosurvBtn').click(); });
    byId('gameSheetRule').textContent = g.room ? gameRules[g.room] || '' : '';
    renderGameGuide(byId('gameSheetGuide'), g.room || (g.launch === 'mines' ? 'minesweeper' : g.id));
    const guide = byId('gameSheetGuideBox'); guide.open = false;
    guide.classList.toggle('hidden', !byId('gameSheetRule').textContent && !byId('gameSheetGuide').childElementCount);
    if (!gameSheet.open) gameSheet.showModal();
    renderGamehallRooms();
    actions.querySelector('button')?.focus();
  }
  // 빠른 시작: the first room of this game still taking players, otherwise a new public room with the usual settings
  async function quickStart(g) {
    const open = roomsOf(g).find((r) => r.status === 'waiting' && (r.playerCount || 0) < (r.maxPlayers || 2));
    if (open) { try { await joinPublicRoom(open.id); return; } catch (error) { showToast(error.message); } }
    for (const [name, value] of [['roomVisibility', 'public'], ['roomAi', ''], ['omokMode', '1v1']]) { const r = document.querySelector(`input[name="${name}"][value="${value}"]`); if (r) r.checked = true; }
    selectGame(g.room);
    await createRoom();
  }
  gameSheet.addEventListener('close', () => { hallReturn(); sheetGame = null; if (hallCat === 'rooms' && !gamehallView.classList.contains('hidden')) renderGamehall(); });
  byId('gameSheetClose').addEventListener('click', () => gameSheet.close());
  byId('gamehallBackBtn').addEventListener('click', closeGamehall);
  byId('gamehallMenuBtn').addEventListener('click', () => openGameMenu());
  function paintSoundBtn() { // the 한판마당 screens' own sound setting (public/reflex/js/store.js)
    const on = hallIcons?.Settings?.get('sound') !== false;
    const b = byId('gamehallSoundBtn'); b.textContent = on ? '🔊 효과음' : '🔇 효과음'; b.setAttribute('aria-pressed', String(on));
  }
  byId('gamehallSoundBtn').addEventListener('click', () => { hallIcons?.Settings?.toggle('sound'); paintSoundBtn(); });
  // Esc on the game hall: the sheet closes itself (a dialog); with nothing open, back to the island
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || gamehallView.classList.contains('hidden') || document.querySelector('dialog[open]') || event.target.matches?.('input, textarea')) return;
    event.preventDefault(); closeGamehall();
  });
  document.getElementById('minesCloseBtn').addEventListener('click', () => minesDialog.close());
  minesDialog.addEventListener('close', () => clearInterval(minesTimer));
  document.getElementById('minesLevels').addEventListener('click', (event) => { const b = event.target.closest('button[data-level]'); if (b) newMines(b.dataset.level); });
  minesBoard.addEventListener('click', (event) => { const b = event.target.closest('.minesCell'); if (!b) return; actMines(b.classList.contains('open') ? 'chord' : 'open', Number(b.dataset.i)); });
  minesBoard.addEventListener('contextmenu', (event) => { event.preventDefault(); const b = event.target.closest('.minesCell'); if (b && !b.classList.contains('open')) actMines('flag', Number(b.dataset.i)); });

  const islandBagDialog = document.getElementById('islandBagDialog');
  const islandPlaceDialog = document.getElementById('islandPlaceDialog');
  const islandPlaceSubmit = document.getElementById('islandPlaceSubmit');
  const islandPlaceStatus = document.getElementById('islandPlaceStatus');
  let islandPlace = null; let islandPlaceRequest = null;
  const ISLAND_PLACES = { office: { title: '관공서', verb: '정산' }, merchant: { title: '상인', verb: '판매' }, fisher: { title: '어부', verb: '판매' } }; // v1.10.42 어부: fish
  // v1.10.90 assets 38: an island item's picture (SVG for the 20 drawn ones, the 도감 picture for the newer fish, else the
  // old emoji) -- the bag and the sale lists; toasts keep the emoji
  const ITEM_SVG = new Set(["berry","candy","crop_cabbage","crop_carrot","fish_anchovy","fish_cutlassfish","fish_giant_tuna","fish_goby","fish_mackerel","fish_octopus","fish_pufferfish","fish_stingray","herb","lost","mushroom","point","reward","trash","wallet","weed"]); const ITEM_ALIAS = { harvest: 'crop_carrot' };
  const GOOD_ICONS = new Set(['bait', 'bait_premium', 'firework', 'balloon', 'bubbles', 'gift_wrap', 'bread', 'milk', 'bouquet', 'letter_paper', 'bulb', 'paint', 'guitar_string', 'nail_box', 'frame', 'badge']);
  const SHOW_GOODS = new Set(['firework', 'balloon', 'bubbles']); // v1.10.92: 「쓰기」 in the bag, seen by everyone near
  function itemIcon(item) {
    const id = ITEM_ALIAS[item.itemId] || item.itemId;
    const src = ITEM_SVG.has(id) ? `/assets/items/${id}.svg` : id.startsWith('fish_') ? `/assets/dex/${id}.png` : id.startsWith('insect_') ? `/assets/dex/${id}.svg` : GOOD_ICONS.has(id) ? `/assets/items/goods/${id}.png` : null; // (v1.10.92 잡화점: assets 41 icons)
    if (!src) return document.createTextNode(item.icon);
    const img = document.createElement('img'); img.className = 'itemIcon'; img.src = src; img.alt = ''; img.width = 32; img.height = 32; return img;
  }
  function drawIslandBag(bag) {
    const grid = document.getElementById('islandBagGrid'); grid.replaceChildren();
    for (let i = 0; i < (bag.slots || 16); i += 1) {
      const item = bag.items[i]; const slot = document.createElement('div');
      slot.className = 'islandBagSlot'; slot.setAttribute('role', 'listitem');
      if (item) {
        slot.title = item.name; slot.setAttribute('aria-label', `${item.name} ${item.qty}개`); slot.dataset.item = item.itemId;
        const name = document.createElement('span'); name.textContent = item.name;
        const qty = document.createElement('small'); qty.textContent = item.qty > 1 ? `×${item.qty}` : '';
        slot.append(itemIcon(item), name, qty);
        if (PLANT_GOODS[item.itemId]) { const use = document.createElement('button'); use.type = 'button'; use.className = 'ghost tiny'; use.textContent = PLANT_GOODS[item.itemId]; use.addEventListener('click', () => plantGood(item.itemId)); slot.append(use); } // B 45
        if (item.itemId.startsWith('pet_')) { const kind = item.itemId.slice(4); const walking = myPet?.kind === kind; const use = document.createElement('button'); use.type = 'button'; use.className = 'ghost tiny'; use.textContent = walking ? '집에 두기' : '데리고 다니기'; use.addEventListener('click', () => choosePet(walking ? null : kind)); slot.append(use); } // B 47
        if (TOOL_TIPS[item.itemId]) { const use = document.createElement('button'); use.type = 'button'; use.className = 'ghost tiny'; use.textContent = heldTool === item.itemId ? '넣기' : '들기'; use.addEventListener('click', () => holdTool(item.itemId)); slot.append(use); } // (3회차 22: in hand)
        if (SHOW_GOODS.has(item.itemId)) { const use = document.createElement('button'); use.type = 'button'; use.className = 'ghost tiny'; use.textContent = '쓰기'; use.addEventListener('click', () => useGood(item.itemId)); slot.append(use); }
      } else slot.setAttribute('aria-label', '빈 칸');
      grid.append(slot);
    }
    document.getElementById('islandBagCount').textContent = `${bag.items.length}/${bag.slots}`;
  }
  // B 47 반려동물: one of mine walks with me (a name asked the first time), everyone sees it
  let myPet = null; let myPetGoneAt = 0;
  async function choosePet(kind) {
    let name = myPet?.kind === kind ? myPet.name : '';
    if (kind && !name) name = (window.prompt('이름을 지어 주세요 (10자까지, 비워 두어도 돼요)', '') || '').trim().slice(0, 10);
    try { const r = await api('/api/island/pet', { method: 'POST', body: JSON.stringify({ kind, name }) }); myPet = r.pet; plaza.controller?.setMyPet?.(myPet); islandBagDialog.close(); showToast(myPet ? `${myPet.name || '반려동물'}와(과) 함께 다녀요.` : '반려동물을 집에 두었어요.'); } catch (error) { showToast(error.message); }
  }
  // 묶음 5 보이는 곤충: the island's insects from the server (again when the next 10 minutes' layout comes; one caught or
  // sent off anywhere: SSE 'insects'); walked up to with the 잠자리채, SPACE catches it; run or ridden at, it is sent off
  let insectTimer = 0;
  async function refreshInsects() {
    clearTimeout(insectTimer);
    try { const d = await api('/api/island/insects'); plaza.controller?.setInsects?.(d.list); insectTimer = setTimeout(refreshInsects, Math.max(5000, d.next + 800)); } catch { insectTimer = setTimeout(refreshInsects, 60000); }
  }
  // (문제 기록 3회차 22) a tool from the bag in hand (one at a time, again to put it away): with the 잠자리채 SPACE (휴대폰
  // 상호작용) swings it -- a bug in front is caught, an islander struck gets cross; with the 낚싯대 I fish at the water
  const TOOL_TIPS = { bugnet: '잠자리채를 들었어요. 곤충 앞에서 SPACE(휴대폰은 상호작용)로 휘둘러 잡아요. 뛰거나 자전거로 가면 달아나요.', fishing_rod: '낚싯대를 들었어요. 물가에서 SPACE(휴대폰은 상호작용)로 던져요.' };
  let heldTool = null;
  function holdTool(kind) {
    heldTool = heldTool === kind ? null : kind; plaza.controller?.setHeldTool?.(heldTool); islandBagDialog.close();
    showToast(heldTool ? TOOL_TIPS[heldTool] : '가방에 넣었어요.', heldTool ? 5000 : 2000);
  }
  async function swingNet() {
    const hit = await plaza.controller?.netSwing?.(); if (!hit) return;
    if (hit.insect) await catchInsect(hit.insect); else if (hit.resident != null) plaza.controller?.residentHit?.(hit.resident);
  }
  async function catchInsect(id) {
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      const r = await api('/api/island/insect/catch', { method: 'POST', body: JSON.stringify({ id }) });
      plaza.controller?.insectSwing?.(id); showToast(`${r.grade === 'rare' ? '🎉 ' : ''}${r.name} +1${r.firstTime ? ' · 도감 등록' : ''}`); if (r.bag) drawIslandBag(r.bag);
    } catch (error) { showToast(error.message); if (error.status === 409) plaza.controller?.insectsGone?.([id]); }
  }
  // B 45 꽃·나무 심기: a seed or the sapling into the ground where I stand; fertilizer onto the plant nearest me
  const PLANT_GOODS = { seed_flower_red: '심기', seed_flower_yellow: '심기', seed_flower_white: '심기', seed_flower_pink: '심기', seed_flower_purple: '심기', sapling: '심기', fertilizer: '비료 주기' };
  async function plantGood(itemId) {
    try {
      let r;
      if (itemId === 'fertilizer') { const p = plaza.controller?.nearestPlant?.(2); if (!p) { showToast('꽃·나무 가까이에서 줄 수 있어요.'); return; } r = await api('/api/island/fertilize', { method: 'POST', body: JSON.stringify({ plantId: p.id, requestId: crypto.randomUUID() }) }); showToast('비료를 줬어요. 남은 시간이 절반으로 줄어요.'); }
      else { r = await api('/api/island/plant', { method: 'POST', body: JSON.stringify({ itemId, requestId: crypto.randomUUID() }) }); showToast(itemId === 'sapling' ? '묘목을 심었어요. 며칠 뒤면 큰 나무가 돼요.' : '꽃씨를 심었어요. 하루쯤 지나면 꽃이 펴요.'); }
      if (islandBagDialog.open) islandBagDialog.close(); if (r.bag) drawIslandBag(r.bag); refreshPlants();
    } catch (error) { showToast(error.message); }
  }
  let plantsPoll = null;
  function refreshPlants() { clearTimeout(plantsPoll); if (!document.body.classList.contains('plazaMode')) return; api('/api/island/plants').then((d) => plaza.controller?.setPlants?.(d.plants)).catch(() => {}).finally(() => { plantsPoll = setTimeout(refreshPlants, 120000); }); }
  async function useGood(kind) {
    try { const r = await api('/api/island/goods/use', { method: 'POST', body: JSON.stringify({ itemId: kind, requestId: crypto.randomUUID() }) }); if (islandBagDialog.open) islandBagDialog.close(); plaza.controller?.useShow?.(kind); if (r.bag) drawIslandBag(r.bag); }
    catch (error) { showToast(error.message); }
  }
  // 자전거 (docs/bicycle-20261020.md): the colours in my bag go to the island (B or 🚲 rides one); the button only with a bike
  // 2회차 11 가구 직접 옮기기: each step the scene takes is kept by the server; refused, the piece goes back to where it was
  const turnBtn = byId('islandTurnBtn');
  turnBtn.addEventListener('click', () => { const why = plaza.controller?.grabTurn?.(); if (why) showToast(why); plazaStage.focus({ preventScroll: true }); });
  const seatBtns = [[byId('seatLeftBtn'), 1], [byId('seatRightBtn'), -1]];
  for (const [btn, dir] of seatBtns) btn.addEventListener('click', () => { plaza.controller?.seatTurn?.(dir); plazaStage.focus({ preventScroll: true }); });
  function wireHomeMoves() {
    plaza.controller?.onSeatTurn?.((on) => { for (const [btn] of seatBtns) btn.classList.toggle('hidden', !on); }); // v1.10.189
    plaza.controller?.onGrab?.((on) => { turnBtn.classList.toggle('hidden', !on); if (on) showToast(touchIsland ? '앞뒤로 밀고 당겨요 · 돌리기 단추로 돌려요 · 상호작용으로 놓아요' : '↑↓ 밀고 당기기 · R 돌리기 · SPACE 놓기'); });
    // (Codex 검토 #9) one save at a time, in order -- answers (and the server's writes) never cross; while one is on its
    // way only each piece's latest step waits to go
    const waiting = new Map(); let sending = false;
    plaza.controller?.onHomeMove?.(async (p) => {
      waiting.set(p.uid, p); if (sending) return; sending = true;
      try {
        while (waiting.size) {
          const [uid, q] = waiting.entries().next().value; waiting.delete(uid);
          try { const r = await api('/api/home/place', { method: 'POST', body: JSON.stringify({ uid: q.uid, x: q.x, z: q.z, rot: q.rot, ...(q.photo ? { photo: q.photo } : {}) }) }); homeInside = { ...homeInside, home: r.home }; }
          catch (error) { waiting.clear(); showToast(error.message); plaza.controller?.grabEnd?.(); if (homeInside) showHome(homeInside); }
        }
      } finally { sending = false; }
    });
  }
  const bikeBtn = byId('islandBikeBtn');
  const showBikes = (bag) => { const colors = (bag?.items || []).filter((e) => e.itemId.startsWith('bike_')).map((e) => e.itemId.slice(5)); plaza.controller?.setBikes?.(colors); bikeBtn.classList.toggle('hidden', !colors.length); plaza.controller?.setInsects?.(null, (bag?.items || []).some((e) => e.itemId === 'bugnet')); }; // (묶음 5: the net in the bag)
  async function refreshBikes() { try { showBikes(await api('/api/island/bag')); } catch {} }
  bikeBtn.addEventListener('click', () => { plaza.controller?.toggleBike?.(); plazaStage.focus({ preventScroll: true }); });
  async function openIslandBag() {
    showDex(false);
    if (!islandBagDialog.open) islandBagDialog.showModal();
    try { const bag = await api('/api/island/bag'); drawIslandBag(bag); showBikes(bag); } catch (error) { showToast(error.message); }
  }
  function drawIslandPlace(bag) {
    const list = document.getElementById('islandPlaceList'); list.replaceChildren();
    const mine = bag.items.filter((item) => item.at === islandPlace);
    let total = 0;
    for (const item of mine) {
      const row = document.createElement('div'); row.className = 'islandPlaceRow'; row.setAttribute('role', 'listitem');
      const what = document.createElement('span'); what.append(itemIcon(item), ` ${item.name} ×${item.qty}`);
      const worth = document.createElement('strong'); worth.textContent = `${(item.qty * item.price).toLocaleString('ko-KR')}P`;
      row.append(what, worth); list.append(row); total += item.qty * item.price;
    }
    if (!mine.length) { const empty = document.createElement('p'); empty.className = 'emptyState'; empty.textContent = '맡길 물건이 없습니다.'; list.append(empty); }
    islandPlaceSubmit.textContent = `${ISLAND_PLACES[islandPlace].verb} +${total.toLocaleString('ko-KR')}P`;
    islandPlaceSubmit.disabled = !mine.length;
  }
  // v1.10.86 주민세: the 세금 창구 (its own clerk) -- what I owe (체납) and paying it; tonight's tax as a guide
  const taxRow = document.getElementById('islandTaxRow'); const taxDialog = document.getElementById('taxDialog'); const taxStatus = document.getElementById('taxStatus');
  async function openTax() {
    taxStatus.textContent = '';
    const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
    await drawTax(); if (!taxDialog.open) taxDialog.showModal();
  }
  document.getElementById('taxCloseBtn').addEventListener('click', () => taxDialog.close());
  // (주민세 고지서: the unpaid bills -- the 체납 on top -- each paid here, or all at once; whole or not at all)
  const taxMd = (day) => `${Number(day.slice(5, 7))}월 ${Number(day.slice(8, 10))}일`;
  async function drawTax() {
    try {
      const t = await api('/api/island/tax'); const P = (n) => `${Number(n).toLocaleString('ko-KR')}P`;
      const total = t.debt + t.bills.reduce((n, b) => n + b.amount, 0);
      document.getElementById('islandTaxText').textContent = total ? `낼 세금 ${P(total)}${t.debt > 0 ? ' · 체납이 있으면 체납자예요' : ''}` : `낼 고지서가 없어요 · 고지서는 매일 자정 우체통으로 (재산의 ${Math.round(t.rate * 100)}%, 최소 ${P(t.minimum)}, ${t.dueDays}일 안에 여기서)`;
      const row = (label, amount, note, body) => {
        const r = document.createElement('div'); r.className = `taxBill${body.debt ? ' overdue' : ''}`; r.setAttribute('role', 'listitem');
        const text = document.createElement('span'); text.textContent = `${label} · ${P(amount)}`; const small = document.createElement('small'); small.textContent = note; text.append(small);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary tiny'; b.textContent = '내기'; b.addEventListener('click', () => payTax(body));
        r.append(text, b); return r;
      };
      document.getElementById('taxBillList').replaceChildren(...(t.debt > 0 ? [row('체납', t.debt, '기한 지남', { debt: true })] : []),
        ...t.bills.map((b) => row(`${taxMd(b.day)}분`, b.amount, b.due === t.today ? '오늘까지' : `${taxMd(b.due)}까지`, { days: [b.day] })));
      const all = document.getElementById('islandTaxPay'); all.classList.toggle('hidden', !total); all.textContent = `모두 내기 · ${P(total)}`;
    } catch (error) { taxStatus.textContent = error.message; }
  }
  async function payTax(body) {
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      const r = await api('/api/island/tax', { method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID(), ...body }) });
      taxStatus.textContent = `세금 ${Number(r.paid).toLocaleString('ko-KR')}P 냈어요${r.debt || r.bills?.length ? '' : ' · 낼 것 없음'}`;
      loadPoints(); refreshPlazaAvatar(); drawTax();
    } catch (error) { taxStatus.textContent = error.message; }
  }
  document.getElementById('islandTaxPay').addEventListener('click', () => payTax({ all: true }));
  async function openIslandPlace(place) {
    islandPlace = place; islandPlaceStatus.textContent = ''; byId('homeApplyBtn').classList.toggle('hidden', place !== 'office'); // (묶음 4: the 민원 창구 takes the house too)
    if (place === 'office') refreshHomes().then(() => { const m = homesState?.mine; const b = byId('homeApplyBtn'); b.textContent = !m ? '내 집 신청' : m.upgradeDay ? '집 넓히는 중 · 내일 완성' : (m.stage || 2) < 2 ? '집 넓히기' : '내 집'; b.disabled = Boolean(m && (m.upgradeDay || (m.stage || 2) >= 2)); }); // (묶음 4-2)
    document.getElementById('islandPlaceTitle').textContent = ISLAND_PLACES[place].title;
    if (!islandPlaceDialog.open) islandPlaceDialog.showModal();
    try { drawIslandPlace(await api('/api/island/bag')); } catch (error) { islandPlaceStatus.textContent = error.message; }
  }
  islandPlaceSubmit.addEventListener('click', async () => {
    const place = islandPlace; islandPlaceSubmit.disabled = true;
    if (islandPlaceRequest?.place !== place) islandPlaceRequest = { place, id: crypto.randomUUID() };
    try {
      const p = plaza.controller?.pose?.(); // my position first, so the server knows I am at the counter
      if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      const data = await api('/api/island/sell', { method: 'POST', body: JSON.stringify({ place, requestId: islandPlaceRequest.id }) });
      islandPlaceRequest = null; if (place === 'office') guideDone('deliver');
      islandPlaceStatus.textContent = `+${Number(data.paid || 0).toLocaleString('ko-KR')}P${data.capped ? ' · 오늘은 여기까지 받습니다' : ''}`;
      drawIslandPlace(data.bag); loadPoints();
    } catch (error) {
      islandPlaceStatus.textContent = error.message;
      if (error.status === 409 || error.status === 400) { islandPlaceRequest = null; islandPlaceSubmit.disabled = false; }
      else islandPlaceSubmit.disabled = false; // a lost answer: the same request is sent again
    }
  });
  document.getElementById('islandBagTab').addEventListener('click', () => openIslandBag());
  document.getElementById('islandBagCloseBtn').addEventListener('click', () => islandBagDialog.close());
  for (const [id, page] of [['islandDexBtn', 'dex'], ['islandPhotoBtn', 'photo']]) document.getElementById(id).addEventListener('click', () => (document.getElementById(id).classList.contains('selected') ? openIslandBag() : showDex(page))); // v1.10.42/43
  document.getElementById('islandPlaceCloseBtn').addEventListener('click', () => islandPlaceDialog.close());
  byId('homeApplyBtn').addEventListener('click', () => openHomeApply()); // 묶음 4 내 집 신청
  for (const d of [islandBagDialog, islandPlaceDialog]) d.addEventListener('close', () => { if (document.body.classList.contains('plazaMode')) plazaStage.focus({ preventScroll: true }); });
  window.addEventListener('keydown', (event) => { // I opens the bag on the island
    if (event.code !== 'KeyI' || event.isComposing || event.repeat || !document.body.classList.contains('plazaMode') || document.querySelector('dialog[open]')) return;
    if (event.target !== document.body && event.target !== plazaStage) return;
    event.preventDefault(); openIslandBag();
  });

  // v1.10.11 공용 이벤트: what lies near me (from each pose answer), less what was just solved by anyone (the lobby
  // stream says so at once; a pose answer already on its way must not bring it back).
  let islandEventsNear = []; const islandEventsGone = new Map(); // id -> when it was removed
  let islandReturning = null; // v1.10.32: a lost thing being given back stays drawn until the owner has taken it
  function showIslandEvents(list) {
    const now = Date.now();
    for (const [id, at] of islandEventsGone) if (now - at.at > 60000) islandEventsGone.delete(id);
    for(const ev of list) { const gone=islandEventsGone.get(ev.id); if(gone && ev.generation>gone.generation) islandEventsGone.delete(ev.id); }
    islandEventsNear = list.filter((ev) => ev.tree || !islandEventsGone.has(ev.id) || ev.id === islandReturning).map(ev => ev.tree && islandEventsGone.has(ev.id) ? {...ev,available:false,verb:null} : ev);
    plaza.controller?.setEvents?.(islandEventsNear);
  }
  function forgetIslandEvents(ids) {
    for (const id of ids || []) islandEventsGone.set(id, {at:Date.now(),generation:islandEventsNear.find(e=>e.id===id)?.generation || 0});
    showIslandEvents(islandEventsNear);
  }
  // v1.10.31 잡초 채집: the island's weeds, and pulling one -- the server first hears which (start, standing by it), the
  // character pulls for about a second (moving or a window calls it off), then the server pulls it (finish, one request
  // id, sent once more if the answer was lost) and everyone's island drops it.
  let weedBusy = false;
  async function loadWeeds() { try { const data = await api('/api/island/weeds'); plaza.controller?.setWeeds?.(data.weeds); } catch {} }
  // v1.10.89 밭 수확: the grown field gives each one 밭 채소 a week (sold at the 상인)
  let harvestBusy = false;
  async function harvestFarm() {
    if (harvestBusy) return; harvestBusy = true;
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      await api('/api/island/farm/harvest', { method: 'POST', body: '{}' });
      plaza.controller?.playMine?.('pickup'); showToast('🥕 밭 채소 +1 · 상인에게 팔 수 있어요');
      plaza.controller?.setFarm?.({ ...(await api('/api/island/farm')), harvested: true });
    } catch (error) {
      showToast(error.message);
      if (error.data?.error === 'HARVESTED') api('/api/island/farm').then((v) => plaza.controller?.setFarm?.({ ...v, harvested: true })).catch(() => {});
    } finally { harvestBusy = false; }
  }
  // 6회차 7 「게시판을 읽을 수 있게 해」: the farm's sign read up close -- this week's field (it grows with each helper of the
  // farmer, three to harvest), who helped, and what to do
  async function openFarmBoard() {
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const card = el('section', 'card farmBoardCard'); card.id = 'farmBoardCard'; card.append(el('p', 'emptyState', '불러오는 중입니다.'));
    openPlazaWindow('농부의 밭', [card]); plazaDialog.classList.add('boardMode');
    try {
      const v = await api('/api/island/farm'); const stage = Math.max(0, Math.min(3, Number(v.stage) || 0));
      const STAGES = ['아직 빈 밭이에요', '싹이 났어요', '쑥쑥 자라는 중이에요', '다 자랐어요 — 수확할 수 있어요'];
      card.replaceChildren(
        el('h3', '', `이번 주 밭 · ${STAGES[stage]}`),
        el('p', '', v.names?.length ? `도와준 사람 · ${v.names.join(' · ')}` : '이번 주에는 아직 도와준 사람이 없어요.'),
        el('p', 'smallMuted', stage < 3 ? `농부를 도와줄 때마다 밭이 자라요(${stage}/3). 세 사람이 도우면 수확할 수 있어요.` : v.harvested ? '이번 주 수확을 했어요. 다음 주 월요일에 새 밭이 시작돼요.' : '밭 가운데에서 SPACE로 수확해요(한 주에 한 번). 채소는 상인에게 팔 수 있어요.'),
      );
    } catch (error) { card.replaceChildren(el('p', 'emptyState', error.message)); }
  }
  // E1 계절 행사 (docs/season-events-design-20261025.md): the festival as the server has it (refreshed on the island), its
  // window from the host (the tasks, the cooking, my stamps) or the stall (its limited goods for stamps), and the tasks done
  // where they are (the farm's harvest, the feast round the table)
  let festivalView = null; let festivalBusy = false;
  let weekView = null;
  async function refreshFestival() {
    if (!document.body.classList.contains('plazaMode')) return;
    try { [festivalView, weekView] = await Promise.all([api('/api/island/festival'), api('/api/island/weekly')]); plaza.controller?.setFestival?.({ ...festivalView, contest: weekView.contest }); weekTick(); festivalNote(); } catch {}
  }
  // a festival or a contest day: told once a day on coming to the island (this device), the last day with its stamps' warning
  function festivalNote() {
    const f = festivalView?.festival; const c = weekView?.contest; if (!f && !c?.open) return;
    const key = `${new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)}:${f?.id || ''}:${c?.kind || ''}`;
    try { if (localStorage.getItem('gc.festivalNote') === key) return; localStorage.setItem('gc.festivalNote', key); } catch {}
    const parts = [];
    if (f) parts.push(`🌾 ${f.name} 중이에요! 대청마당 남쪽 행사 주민을 찾아가요${f.lastDay ? ' · 오늘이 마지막 날, 남은 도장은 오늘 써요' : ''}`);
    if (c?.open) parts.push(`${c.kind === 'fish' ? '🎣' : '🦋'} 오늘은 ${c.name}(${c.from}~${c.to}시)`);
    showToast(parts.join(' · '), 6000);
  }
  // E1 매주 대회: a round's three minutes counted down at the screen's top; its end told with the day's standing
  let weekTimer = null; let weekEnd = 0;
  function weekTick() {
    const r = weekView?.round;
    if (r && r.left > 0) { weekEnd = Date.now() + r.left; if (!weekTimer) weekTimer = setInterval(weekCountdown, 500); weekCountdown(); }
  }
  async function weekCountdown() {
    let box = document.getElementById('contestTimer'); if (!box) { box = document.createElement('div'); box.id = 'contestTimer'; box.className = 'contestTimer'; box.setAttribute('role', 'status'); document.body.append(box); }
    const left = Math.max(0, weekEnd - Date.now()); const r = weekView?.round;
    box.textContent = `${r?.kind === 'bug' ? '🦋 곤충' : '🎣 낚시'} 대회 · ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')} · ${r?.score || 0}점`; box.hidden = false;
    if (left > 0) { if (Date.now() % 5000 < 500) api('/api/island/weekly').then((v) => { weekView = v; }).catch(() => {}); return; }
    clearInterval(weekTimer); weekTimer = null; box.hidden = true;
    try { weekView = await api('/api/island/weekly'); const m = weekView.mine; showToast(`대회 끝! ${weekView.ended?.score ?? r?.score ?? 0}점${m ? ` · 오늘 최고 ${m.best}점 (${m.rank}위)` : ''}`, 5000); } catch {}
  }
  async function openWeekContest() {
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const card = el('section', 'card festivalCard'); card.id = 'contestCard'; openPlazaWindow('매주 대회', [card]); plazaDialog.classList.add('boardMode');
    try { weekView = await api('/api/island/weekly'); } catch (error) { card.append(el('p', 'emptyState', error.message)); return; }
    const c = weekView.contest; const last = weekView.last;
    card.append(el('h3', '', c ? `오늘은 ${c.name} · ${c.from}~${c.to}시` : '대회는 토요일 낚시·일요일 곤충, 10~22시예요'));
    if (c) card.append(el('p', 'smallMuted', `3분 동안 ${c.kind === 'fish' ? '낚은 물고기' : '잡은 곤충'}의 값으로 점수를 매겨요. 여러 번 해도 그날 최고 점수가 기록되고, 밤 10시에 1~3등이 트로피·칭호·포인트를 받아요.`));
    if (c?.open) {
      const go = el('button', 'primary', weekView.round ? '대회 중이에요' : '3분 대회 시작'); go.type = 'button'; go.disabled = Boolean(weekView.round);
      go.addEventListener('click', async () => {
        try { const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {}); const r = await api('/api/island/weekly/start', { method: 'POST', body: '{}' }); plazaDialog.close?.(); showToast(`${r.name} 시작! 3분${r.gift ? ` · 참가 선물 ${r.gift}` : ''}${r.stamp ? ` · 도장 +${r.stamp}` : ''}`, 4000); weekView = { ...(weekView || {}), round: { kind: r.kind, left: r.endsIn, score: 0 } }; weekTick(); /* (counted from the start's answer at once; the next ask brings the score) */ } catch (error) { showToast(error.message); }
      });
      card.append(go);
    }
    if (weekView.top.length) { const ol = el('ol', 'festivalTasks'); for (const t of weekView.top) ol.append(el('li', '', `${t.rank}위 ${t.name} · ${t.score}점`)); card.append(el('strong', '', '오늘 순위'), ol); }
    if (weekView.mine) card.append(el('p', '', `내 기록 · ${weekView.mine.best}점 (${weekView.mine.rank}위)`));
    if (last?.top?.length) card.append(el('p', 'smallMuted', `지난 ${last.name}(${last.day.slice(5).replace('-', '/')}) · ${last.top.map((t) => `${t.rank}위 ${t.name} ${t.score}점`).join(' · ')}`));
  }
  setInterval(refreshFestival, 60000);
  async function festivalPost(action, body = {}) {
    if (festivalBusy) return null; festivalBusy = true;
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      const r = await api(`/api/island/festival/${action}`, { method: 'POST', body: JSON.stringify(body) });
      if (r.festival) { festivalView = { ...(festivalView || {}), festival: r.festival }; plaza.controller?.setFestival?.(festivalView); }
      return r;
    } catch (error) { showToast(error.message); return null; } finally { festivalBusy = false; }
  }
  async function festivalTask(action) {
    const r = await festivalPost(action); if (!r) return;
    plaza.controller?.playMine?.(action === 'harvest' ? 'pickup' : 'cheer');
    showToast(`${action === 'harvest' ? '🌾 밭 채소 +1 · ' : '🎉 '}도장 +${r.added} (모은 도장 ${r.festival.stamps})`);
  }
  async function openFestival(tab = 'tasks') {
    const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const card = el('section', 'card festivalCard'); card.id = 'festivalCard';
    openPlazaWindow('행사', [card]); plazaDialog.classList.add('boardMode');
    let drawn = 0; // (C3 ⑨: tabs switched fast -- only the last one asked for draws)
    const draw = async (which) => {
      const mine = ++drawn;
      try { festivalView = await api('/api/island/festival'); plaza.controller?.setFestival?.(festivalView); } catch (error) { if (mine === drawn) card.replaceChildren(el('p', 'emptyState', error.message)); return; }
      if (mine !== drawn) return;
      const f = festivalView.festival;
      if (!f) { card.replaceChildren(el('p', 'emptyState', festivalView.next ? `다음 행사 「${festivalView.next.name}」는 ${festivalView.next.start.slice(5).replace('-', '월 ')}일에 시작해요.` : '지금은 행사가 없어요.')); return; }
      const head = el('div', 'festivalHead'); head.append(el('h3', '', `${f.name} · ${f.start.slice(5).replace('-', '/')}~${f.end.slice(5).replace('-', '/')}`), el('strong', 'festivalStamps', `도장 ${f.stamps}개`));
      const tabs = el('div', 'festivalTabs'); if (weekView?.contest) { const b = el('button', 'secondary tiny', weekView.contest.name); b.type = 'button'; b.addEventListener('click', () => openWeekContest()); tabs.append(b); } // (a contest day in the festival)
      for (const [id, name] of [['tasks', '할 일'], ['cook', '요리 대회'], ['shop', '가판대']]) { const b = el('button', which === id ? 'primary tiny' : 'secondary tiny', name); b.type = 'button'; b.dataset.tab = id; b.addEventListener('click', () => draw(id)); tabs.append(b); }
      const body = el('div', 'festivalBody');
      if (which === 'tasks') {
        body.append(el('p', 'smallMuted', `「${f.say}」 도장은 이 행사 가판대에서만 쓰고, 행사가 끝나면 사라져요${f.daysLeft <= 1 ? ' — 곧 끝나요!' : ''}.`));
        const list = el('ul', 'festivalTasks');
        for (const t of f.tasks) list.append(el('li', t.today >= t.perDay ? 'done' : '', `${t.name} · 도장 ${t.stamps}개 · 오늘 ${t.today}/${t.perDay}${t.id === 'feast' ? ' (마지막 날 저녁 6~10시, 잔칫상 둘레)' : t.id === 'harvest' ? ' (밭에서 SPACE)' : t.id === 'contest' ? ' (토·일 대회 날, 여기서 대회 시작)' : ' (요리 대회 칸에서)'}`));
        body.append(list);
      } else if (which === 'cook') {
        const bag = (await api('/api/island/bag').catch(() => ({ items: [] }))).items || []; if (mine !== drawn) return;
        const ok = bag.filter((e) => ['harvest', 'berry', 'mushroom', 'herb'].includes(e.itemId) || /^fish_/.test(e.itemId));
        body.append(el('p', 'smallMuted', '가방의 먹을 것 세 가지로 요리를 내면 심사해요(하루 한 번, 도장 2개). 재료는 써요.'));
        const picks = [0, 1, 2].map(() => { const s = el('select', 'festivalPick'); s.append(new Option('재료 고르기', '')); for (const e of ok) s.append(new Option(`${e.name} (${e.qty})`, e.itemId)); return s; });
        const go = el('button', 'primary', '요리 내기'); go.type = 'button';
        go.addEventListener('click', async () => { const items = picks.map((s) => s.value); if (items.some((v) => !v)) { showToast('재료 세 가지를 골라 주세요.'); return; } const r = await festivalPost('cook', { items }); if (r) { showToast(`🍲 ${r.score}점 · 도장 +${r.added}`); body.append(el('p', 'festivalSay', `「${r.say}」`)); go.disabled = true; } });
        if (!ok.length) body.append(el('p', 'emptyState', '가방에 요리할 재료가 없어요. 밭 채소·열매·버섯·약재·물고기를 모아 와요.'));
        else body.append(...picks, go);
      } else {
        const list = el('ul', 'festivalShop');
        for (const g of f.shop) { const li = el('li', g.owned ? 'owned' : ''); li.append(el('span', '', `${g.name} · 도장 ${g.stamps}개`)); const b = el('button', g.owned ? 'ghost tiny' : 'primary tiny', g.owned ? '받음' : '바꾸기'); b.type = 'button'; b.disabled = g.owned || f.stamps < g.stamps; b.addEventListener('click', async () => { const r = await festivalPost('buy', { id: g.id }); if (r) { showToast(`🎁 ${r.good.name}${r.good.kind === 'furniture' ? ' · 가구 창고에 넣었어요' : ' · 내 정보에서 칭호를 쓸 수 있어요'}`); draw('shop'); } }); li.append(b); list.append(li); }
        body.append(list);
      }
      card.replaceChildren(head, tabs, body);
    };
    card.append(el('p', 'emptyState', '불러오는 중입니다.')); draw(tab);
  }
  async function pullWeed(key) {
    const id = key.slice('weed:'.length);
    if (!id || weedBusy || islandEventBusy) return;
    weedBusy = true; let started=false; let completed=false;
    try {
      const p = plaza.controller?.pose?.(); // where I stand first, so the server sees me at it
      if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      await api('/api/island/weed/start', { method: 'POST', body: JSON.stringify({ weedId: id }) }); started=true;
      const pulled = await new Promise((resolve) => { if (!plaza.controller?.gatherWeed?.(id, resolve)) resolve(false); });
      if (!pulled) return; // called off
      const body = JSON.stringify({ weedId: id, requestId: crypto.randomUUID() });
      let data;
      try { data = await api('/api/island/weed/finish', { method: 'POST', body }); } catch (error) { if (error.status) throw error; data = await api('/api/island/weed/finish', { method: 'POST', body }); }
      completed=true; plaza.controller?.finishGather?.(true); plaza.controller?.removeWeeds?.([id]); plaza.controller?.holdWeed?.(); guideDone('weed');
      showToast(`🌱 잡초 +1${data.bonus ? ` · 주간 생활활동 +${Number(data.bonus).toLocaleString('ko-KR')}P` : ''}`);
      if (data.bonus) loadPoints();
    } catch (error) {
      showToast(error.message);
      if (error.data?.error === 'WEED_GONE') plaza.controller?.removeWeeds?.([id]);
    } finally { plaza.controller?.finishGather?.(); if(started && !completed) await api('/api/island/weed/cancel', {method:'POST',body:JSON.stringify({weedId:id})}).catch(()=>{}); weedBusy = false; }
  }
  // v1.10.34 분실물 부탁: the owner says what they lost and asks me to find it; it is on my map from now on
  const lostCard = document.createElement('div'); lostCard.className = 'lostRequest hidden'; document.body.append(lostCard);
  plazaDialog.addEventListener('close', () => { if (!plazaDialog.open) lostCard.classList.add('hidden'); });
  // v1.10.63 주민 대화 (IDEAS 2026-10-11): a resident's words come as a speech bubble at the bottom of the island, not a
  // window over it -- one line at a time. Space/Enter: the next line, then the focused answer; ↑↓ choose an answer;
  // 1-9 pick one; Esc closes (the dialog's own cancel). Same #plazaDialog underneath, so its closing and sections hold.
  // shot: a quest taken or done, a reward, a big choice -- the camera's two-shot (else over my shoulder, plaza-scene)
  // 대화창 새 단장 (gamecenter-notes docs/dialogue-box-redesign-20261025.md): a cream bubble with the speaker's name tag in
  // their colour (tag), the words typed out (about 40 letters a second; a tap/Space/Enter shows the line at once), the
  // choices in their own small bubble once the words are out
  const lessMotionPref = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let typing = null; // { line, full, timer }
  function finishTyping() { const t = typing; if (!t) return false; typing = null; clearInterval(t.timer); t.line.textContent = t.full; t.line.classList.remove('typing'); return true; }
  function typeLine(line) {
    finishTyping(); if (!line || lessMotionPref?.matches) return;
    const full = line.textContent; const t0 = performance.now(); line.textContent = ''; line.classList.add('typing');
    // (by the time gone, not the ticks: a busy island's long frames hold the timer back, the words keep their pace)
    typing = { line, full, timer: setInterval(() => { const i = Math.floor((performance.now() - t0) / 25); line.textContent = full.slice(0, i); if (i >= full.length) finishTyping(); }, 25) };
  }
  function talkNext() { if (finishTyping()) return true; const pending = lostCard.querySelector('.talkPending'); if (!pending) return false; pending.classList.remove('talkPending'); typeLine(pending); return true; }
  plazaDialog.addEventListener('close', () => { if (!plazaDialog.open) finishTyping(); });
  function openTalk(name, shot = false, tag = '') {
    lostCard.classList.remove('hidden');
    openPlazaWindow(name, [lostCard]);
    plazaDialog.classList.add('talkMode'); plazaDialog.style.setProperty('--talk-tag', tag || 'var(--isle-tag)');
    plaza.controller?.talkCamera?.(shot ? 'shot' : 'talk');
    lostCard.querySelectorAll('.lostRequestLine').forEach((line, i) => line.classList.toggle('talkPending', i > 0));
    typeLine(lostCard.querySelector('.lostRequestLine'));
    lostCard.tabIndex = -1; lostCard.focus({ preventScroll: true }); // the bubble, not an answer: the Space that opened it
    // is still going up, and on a focused answer that would press it
  }
  plazaDialog.addEventListener('click', (event) => { // a tap on the bubble (not an answer): the line at once, then the next
    if (plazaDialog.classList.contains('talkMode') && !event.target.closest('button')) talkNext();
  });
  const talkButtons = () => [...lostCard.querySelectorAll('button:not(:disabled)')];
  // on the document: a click on the island behind the bubble moves the focus out of it, the keys still talk
  document.addEventListener('keydown', (event) => {
    if (!plazaDialog.open || !plazaDialog.classList.contains('talkMode') || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') return; // the dialog's own cancel (or, focus outside it, the next listener's menu stays shut: a dialog is open)
    if (event.repeat && event.key !== 'Escape') { event.preventDefault(); return; } // a held Space never runs through the lines
    const buttons = talkButtons();
    if (event.key === ' ' || event.key === 'Enter') {
      if (talkNext()) { event.preventDefault(); return; }
      if (!buttons.includes(event.target) && event.target !== byId('plazaCloseBtn')) { event.preventDefault(); if (lostCard.querySelector('.talkChoices')) buttons[0]?.focus(); else (lostCard.querySelector('button.primary:not(:disabled)') || buttons[0])?.click(); } // (A-6: in the choices, Space first points at one)
      return; // a focused answer (or 닫기) is pressed by the browser
    }
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (step) { // the answers, then 닫기 (v1.10.64: 닫기 by the arrows too, not only by Tab)
      const ring = [...buttons, byId('plazaCloseBtn')];
      event.preventDefault(); const at = ring.indexOf(event.target); ring[at < 0 ? (step > 0 ? 0 : ring.length - 1) : (at + step + ring.length) % ring.length].focus(); return;
    }
    if (/^[1-9]$/.test(event.key) && buttons[Number(event.key) - 1]) { event.preventDefault(); buttons[Number(event.key) - 1].click(); }
  });
  function openLostRequest(id, points) {
    const name = plaza.controller?.lostName?.(id) || '물건';
    const ask = document.createElement('p'); ask.className = 'lostRequestLine'; ask.textContent = `「${name}${/[가-힣]/.test(name.slice(-1)) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 ? '을' : '를'} 잃어버렸어요…`;
    const more = document.createElement('p'); more.className = 'lostRequestLine'; more.textContent = '이 근처 풀밭 어딘가에 떨어뜨린 것 같아요. 찾아서 가져다주시면 사례할게요!」';
    const meta = document.createElement('p'); meta.className = 'lookMeta'; meta.textContent = `미니맵 ! 표시 · 사례 ${Number(points || 0).toLocaleString('ko-KR')}P`;
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'primary'; ok.textContent = '찾아볼게요'; ok.addEventListener('click', () => plazaDialog.close());
    lostCard.replaceChildren(ask, more, meta, ok);
    openTalk('분실물 찾아주기', true);
  }
  // v1.10.37 연계 퀘스트: what the islander says (the step paid, the next asked), and the step under way in one line each
  // v1.10.92 잡화점 (IDEAS #future-general-store): in and out like the 민원실; inside, standing at a good on its shelf, SPACE
  // opens it (what it is for, 1·5·10 to buy -- paid and in the bag at once); the keeper behind the counter greets
  let storeBusy = false; let storeGoods = [];
  const GOOD_USE = { bike: '가방에 있으면 섬에서 B(휴대폰은 🚲 단추)로 타고 내려요. 걷기보다 빨라요(실내·계단·다리·사람 많은 곳에서는 내려요).', bait: '가방에 있으면 낚시할 때 자동으로 써요. 입질이 빨라져요.', show: '가방에서 「쓰기」를 누르면 그 자리에서 모두가 볼 수 있어요.', gift: '다른 사람에게 가방 물건을 선물할 때 하나 써요.', errand: '주민이 사다 달라고 부탁하는 물건이에요.', keep: '기념으로 간직하는 물건이에요.' };
  async function storeDoor(entering) {
    if (storeBusy) return; storeBusy = true;
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      if (entering) { storeGoods = (await api('/api/island/store')).goods; plaza.controller?.setGoodsPrices?.(Object.fromEntries(storeGoods.map((g) => [g.id, { name: g.name, price: g.price }]))); }
      const r = await api(entering ? '/api/island/store/enter' : '/api/island/store/leave', { method: 'POST', body: '{}' });
      closeIslandWindows(); plaza.controller?.setSpace?.(r.space, r.x, r.z); document.body.classList.toggle('townhallRoom', r.space !== 'island');
    } catch (error) { showToast(error.message); } finally { storeBusy = false; }
  }
  // R4 구치소 반성문: in and out at its doors; one owing the tax is put in its cell by the server (the first pose of a visit:
  // jailedBy). The warden's talk: [시작] (his sentence over his head, 20 s a ring; typed into the island chat, his answer
  // comes back with the chat -- jailAnswer), [지금 세금 내기]; to an onlooker, how many passed today. The board: the day's.
  let jailBusy = false; let jailState = null; let essayTimer = null; let essayGen = 0;
  async function jailDoor(entering) {
    if (jailBusy) return; jailBusy = true;
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      const r = await api(entering ? '/api/island/jail/enter' : '/api/island/jail/leave', { method: 'POST', body: '{}' });
      closeIslandWindows(); plaza.controller?.setSpace?.(r.space, r.x, r.z); document.body.classList.toggle('townhallRoom', r.space !== 'island');
      if (r.space === 'jail') await refreshJail(); else { stopEssay(); jailState = null; }
    } catch (error) { showToast(error.message); } finally { jailBusy = false; }
  }
  async function refreshJail() {
    try { jailState = await api('/api/island/jail'); plaza.controller?.setJail?.(jailState); } catch {}
    return jailState;
  }
  async function jailedBy(where) { // the server put me in the cell (a plaza/state answer)
    if (plaza.controller?.space?.() === 'jail') return;
    closeIslandWindows(); plaza.controller?.setSpace?.('jail', where.x, where.z); document.body.classList.add('townhallRoom');
    plaza.controller?.setJail?.(where.jail); await refreshJail(); if (jailState?.inmate === true) openWarden();
  }
  // (대화창 새 단장: the warden speaks in the talk bubble too -- his words, then his buttons)
  const wardenCard = document.createElement('div'); wardenCard.className = 'talkActions'; wardenCard.id = 'wardenCard';
  async function openWarden() {
    const s = await refreshJail(); if (!s) return;
    const say = document.createElement('p'); say.className = 'lostRequestLine'; const row = wardenCard; row.replaceChildren();
    const button = (label, fn, kind = 'primary') => { const b = document.createElement('button'); b.type = 'button'; b.className = kind; b.textContent = label; b.addEventListener('click', fn); row.append(b); return b; };
    if (s.inmate === true) {
      say.textContent = s.essay ? `계속합시다. ${s.essay.count}문장 중 ${s.essay.i + 1}번째예요.` : `세금이 밀렸군요. 제가 말하는 문장을 채팅으로 똑같이 쓰세요. 한 문장에 ${globalThis.IslandJail.SECONDS}초, ${s.level >= 2 ? '친한 사이니 2문장만' : '3문장'}입니다.`;
      button('시작', () => startEssay()); button(`지금 세금 내기 · ${Number(s.debt).toLocaleString('ko-KR')}P`, () => payFromJail(), 'secondary');
    } else say.textContent = s.inmate === 'free' ? '오늘은 통과입니다. 나가셔도 좋아요.' : `구경만 하세요. 오늘 반성문을 통과한 사람은 ${s.passed}명입니다.`;
    lostCard.replaceChildren(say, row); openTalk('김우성 구치소장'); // (사용자 2026-10-26: his name)
  }
  async function startEssay() {
    const gen = essayGen;
    try { const e = await api('/api/island/jail/start', { method: 'POST', body: '{}' }); if (gen !== essayGen) return; closeIslandWindows(); showEssay(e); } catch (error) { showToast(error.message); }
  }
  function showEssay(e, lead = '') { // the sentence over the warden's head; the time run out: 「다시.」 and the same one again
    clearTimeout(essayTimer); const gen = ++essayGen;
    plaza.controller?.wardenSay?.(`${lead ? `${lead} ` : ''}${e.sentence}`, e.left);
    // (Codex 검토 P3: an answer coming after passing, paying or leaving -- a newer essayGen -- shows nothing)
    essayTimer = setTimeout(async () => { try { const again = await api('/api/island/jail/start', { method: 'POST', body: '{}' }); if (gen === essayGen) showEssay(again, '다시.'); } catch {} }, e.left + 300);
  }
  function stopEssay() { clearTimeout(essayTimer); essayGen += 1; }
  function jailAnswer(j) { // the warden's answer to a line I typed (POST /api/lobby/chat)
    if (!j) return;
    if (!j.passed) { showEssay(j, j.say); return; }
    stopEssay(); plaza.controller?.wardenSay?.(j.say, 0); refreshJail(); showToast('반성문 통과! 철창이 열렸어요.');
  }
  async function payFromJail() {
    try {
      const out = await api('/api/island/tax', { method: 'POST', body: JSON.stringify({ requestId: crypto.randomUUID() }) });
      closeIslandWindows(); loadPoints(); refreshPlazaAvatar();
      showToast(!out.paid ? '낼 포인트가 없습니다.' : out.debt > 0 ? `${Number(out.paid).toLocaleString('ko-KR')}P 냈어요. 남은 체납 ${Number(out.debt).toLocaleString('ko-KR')}P — 반성문은 그대로예요.` : '세금을 다 냈어요. 철창이 열렸어요.');
      if (!(out.debt > 0)) { stopEssay(); plaza.controller?.wardenSay?.('다 내셨군요. 나가셔도 좋습니다.', 0); } await refreshJail();
    } catch (error) { showToast(error.message); }
  }
  const jailBoardCard = document.createElement('div'); jailBoardCard.className = 'goodCard'; jailBoardCard.id = 'jailBoardCard';
  async function openJailBoard() {
    const s = await refreshJail(); if (!s) return;
    const list = document.createElement('ol'); list.className = 'jailLog';
    for (const e of [...s.log].reverse()) { const li = document.createElement('li'); li.textContent = `${new Date(e.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} ${e.name}: ${e.text}`; list.append(li); }
    const note = document.createElement('p'); note.className = 'lookMeta'; note.textContent = s.log.length ? `오늘 통과 ${s.passed}명 · 자정에 지워져요` : '오늘은 아직 반성문이 없어요.';
    jailBoardCard.replaceChildren(note, list); openPlazaWindow('오늘의 반성문', [jailBoardCard]);
  }
  // 묶음 2 가구점 (백화점 2층): up and down by the lift; the day's display from the server (and again when a piece is sold
  // anywhere: SSE 'furniture'); SPACE by a piece opens its window -- bought, it goes to the 가구 창고
  let furnitureBusy = false; let furnitureState = null;
  async function refreshFurniture() {
    try { furnitureState = await api('/api/island/furniture'); plaza.controller?.setFurniture?.(furnitureState); } catch {}
  }
  // 묶음 2·2-2: the 백화점's lift -- which floor (the one I am on not among them)
  const FLOORS = { 1: '1층 · 백화점', 2: '2층 · 가구점', 3: '3층 · 펫샵' };
  const liftCard = document.createElement('div'); liftCard.className = 'goodCard liftCard'; liftCard.id = 'liftCard';
  function openLift(here) {
    const row = document.createElement('div'); row.className = 'goodBuy';
    for (const [to, label] of Object.entries(FLOORS)) { if (Number(to) === here) continue; const b = document.createElement('button'); b.type = 'button'; b.className = 'primary'; b.textContent = label; b.dataset.floor = to; b.addEventListener('click', () => liftTo(Number(to))); row.append(b); }
    const note = document.createElement('p'); note.className = 'lookMeta'; note.textContent = `지금 ${FLOORS[here]}`;
    liftCard.replaceChildren(note, row); openPlazaWindow('승강기', [liftCard]);
  }
  async function liftTo(to) {
    if (furnitureBusy) return; furnitureBusy = true;
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      if (to === 2) await refreshFurniture(); if (to === 3) await refreshPetshop();
      const r = await api('/api/island/lift', { method: 'POST', body: JSON.stringify({ to }) });
      closeIslandWindows(); plaza.controller?.setSpace?.(r.space, r.x, r.z);
    } catch (error) { showToast(error.message); } finally { furnitureBusy = false; }
  }
  // 묶음 2-2 펫샵: the day's eight from the server (again when one is taken anywhere: SSE 'petshop'); SPACE by one opens
  // its window -- a name, 「데려가기」, and it walks with me at once
  let petshopState = null;
  async function refreshPetshop() { try { petshopState = await api('/api/island/petshop'); plaza.controller?.setPetshop?.(petshopState); } catch {} }
  const adoptCard = document.createElement('div'); adoptCard.className = 'goodCard adoptCard'; adoptCard.id = 'adoptCard';
  function openAdopt(slot) {
    const p = petshopState?.pets.find((x) => x.slot === slot); if (!p || p.sold) { showToast('방금 다른 분이 데려갔어요.'); return; }
    const name = document.createElement('strong'); name.textContent = `${p.name} · ${Number(p.price).toLocaleString('ko-KR')}P`;
    const what = document.createElement('p'); what.className = 'lookMeta'; what.textContent = `한 마리뿐이에요 — 데려가면 다른 사람에게서도 사라지고 내일 새 친구들이 와요. 하루 한 마리(오늘 ${petshopState.mine}/${petshopState.perDay}).`;
    const input = document.createElement('input'); input.type = 'text'; input.maxLength = 10; input.placeholder = '이름 (10자까지, 비워 두어도 돼요)'; input.className = 'adoptName'; input.setAttribute('aria-label', '이름');
    const row = document.createElement('div'); row.className = 'goodBuy';
    const go = document.createElement('button'); go.type = 'button'; go.className = 'primary'; go.textContent = '데려가기';
    go.addEventListener('click', async () => {
      if (furnitureBusy) return; furnitureBusy = true; go.disabled = true;
      try {
        const pose = plaza.controller?.pose?.(); if (pose) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(pose) }).catch(() => {});
        const r = await api('/api/island/petshop/adopt', { method: 'POST', body: JSON.stringify({ slot, name: input.value.trim() }) });
        myPet = r.pet; plaza.controller?.setMyPet?.(myPet); plazaDialog.close(); showToast(`${myPet.name || p.name}와(과) 함께 다녀요!`, 4000); await refreshPetshop();
      } catch (error) { showToast(error.message, 4000); await refreshPetshop(); } finally { furnitureBusy = false; go.disabled = false; }
    });
    const no = document.createElement('button'); no.type = 'button'; no.className = 'secondary'; no.textContent = '그만두기'; no.addEventListener('click', () => plazaDialog.close());
    row.append(go, no); adoptCard.replaceChildren(name, what, input, row);
    openPlazaWindow('펫샵', [adoptCard]); plazaDialog.classList.add('shopMode'); // (창 3단계: a price tag on the shelf)
  }
  // (문제 기록 3회차 21) the counter's catalog: each transformation small and 메타몽, one of each -- a name, 「데려가기」, and
  // it walks with me at once; an IP one can never be given away
  const catalogBox = document.createElement('div'); catalogBox.className = 'myPets petCatalog'; catalogBox.id = 'petCatalog'; catalogBox.setAttribute('role', 'list');
  async function openPetCatalog() {
    await refreshPetshop(); const list = petshopState?.catalog || [];
    const note = document.createElement('p'); note.className = 'lookMeta'; note.textContent = '변신 모습 그대로 작게 · 한 종류에 한 마리씩 · 캐릭터 펫은 선물할 수 없어요';
    catalogBox.replaceChildren(note, ...list.map((p) => {
      const row = document.createElement('div'); row.className = 'myPetRow'; row.setAttribute('role', 'listitem'); row.dataset.kind = p.kind;
      // (창 3단계 검토: the name on one line -- 「캐릭터」 a small tag -- and the price under it)
      const label = document.createElement('span'); label.className = 'petTagText'; const nm = document.createElement('strong'); nm.textContent = p.name;
      if (p.ip) { const t = document.createElement('small'); t.className = 'isle-tag'; t.textContent = '캐릭터'; nm.append(' ', t); }
      const price = document.createElement('small'); price.className = 'petPrice'; price.textContent = `${Number(p.price).toLocaleString('ko-KR')}P`; label.append(nm, price);
      const b = document.createElement('button'); b.type = 'button'; b.className = p.owned ? 'ghost tiny' : 'primary tiny'; b.textContent = p.owned ? '데리고 있어요' : '데려가기'; b.disabled = p.owned;
      b.addEventListener('click', async () => {
        if (furnitureBusy) return; const name = (window.prompt('이름을 지어 주세요 (10자까지, 비워 두어도 돼요)', '') ?? null); if (name === null) return;
        furnitureBusy = true; b.disabled = true;
        try {
          const pose = plaza.controller?.pose?.(); if (pose) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(pose) }).catch(() => {});
          const r = await api('/api/island/petshop/buy', { method: 'POST', body: JSON.stringify({ kind: p.kind, name: name.trim().slice(0, 10) }) });
          myPet = r.pet; plaza.controller?.setMyPet?.(myPet); plazaDialog.close(); showToast(`${myPet.name || p.name}와(과) 함께 다녀요!`, 4000);
        } catch (error) { showToast(error.message, 4000); b.disabled = false; } finally { furnitureBusy = false; }
      });
      row.append(label, b); return row;
    }));
    openPlazaWindow('펫샵 · 변신 펫', [catalogBox]); plazaDialog.classList.add('shopMode');
  }
  // my pets (the 펫샵's, each its coat and name, and those bought before at the 잡화점): which walks with me
  const petsBox = document.createElement('div'); petsBox.className = 'myPets'; petsBox.id = 'myPets';
  async function openMyPets() {
    let list = []; try { list = (await api('/api/island/pets')).pets; } catch (error) { showToast(error.message); return; }
    const names = window.IslandPetShop;
    const rows = list.map((p) => {
      const row = document.createElement('div'); row.className = `myPetRow${p.walking ? ' walking' : ''}`; row.setAttribute('role', 'listitem');
      const label = document.createElement('span'); label.textContent = `${p.name ? `${p.name} · ` : ''}${names?.nameOf(p.kind, p.coat) || p.kind}`;
      const b = document.createElement('button'); b.type = 'button'; b.className = p.walking ? 'ghost tiny' : 'primary tiny'; b.textContent = p.walking ? '집에 두기' : '데리고 다니기';
      b.addEventListener('click', async () => {
        try {
          const name = p.from === 'bag' && !p.walking ? (window.prompt('이름을 지어 주세요 (10자까지, 비워 두어도 돼요)', '') || '').trim().slice(0, 10) : '';
          const r = await api('/api/island/pet', { method: 'POST', body: JSON.stringify(p.walking ? { kind: null } : { uid: p.uid, name }) });
          myPet = r.pet; plaza.controller?.setMyPet?.(myPet); showToast(myPet ? `${myPet.name || '반려동물'}와(과) 함께 다녀요.` : '반려동물을 집에 두었어요.'); openMyPets();
        } catch (error) { showToast(error.message); }
      });
      // (문제 기록 2회차 10: a name given or changed here too -- the 잡화점's one while it walks with me)
      const rename = document.createElement('button'); rename.type = 'button'; rename.className = 'ghost tiny'; rename.textContent = '이름 바꾸기';
      rename.hidden = p.from === 'bag' && !p.walking;
      rename.addEventListener('click', async () => {
        const name = (window.prompt('새 이름 (한글·숫자·공백, 10자까지)', p.name || '') || '').trim(); if (!name) return;
        try { const r = await api('/api/island/pet/name', { method: 'POST', body: JSON.stringify({ uid: p.uid, name }) }); if (r.pet) { myPet = r.pet; plaza.controller?.setMyPet?.(myPet); } showToast(`이름을 「${r.name}」(으)로 바꿨어요.`); openMyPets(); } catch (error) { showToast(error.message); }
      });
      row.append(label, rename, b); return row;
    });
    const empty = document.createElement('p'); empty.className = 'lookMeta'; empty.textContent = '아직 반려동물이 없어요. 백화점 3층 펫샵에 가 보세요.';
    petsBox.replaceChildren(...(rows.length ? rows : [empty]));
    islandBagDialog.close(); openPlazaWindow('내 반려동물', [petsBox]);
  }
  const furnitureCard = document.createElement('div'); furnitureCard.className = 'goodCard furnitureCard'; furnitureCard.id = 'furnitureCard';
  const FURNITURE_RARITY = { common: '흔함', uncommon: '보통', rare: '드묾', base: '늘 파는 가구' };
  function openFurniture(slot) {
    const d = furnitureState && [...furnitureState.display, ...furnitureState.base].find((x) => x.slot === slot);
    if (!d || d.sold) { showToast('팔렸어요. 내일 새 가구가 들어와요.'); return; }
    const name = document.createElement('strong'); name.textContent = `${d.name} · ${Number(d.price).toLocaleString('ko-KR')}P`;
    const what = document.createElement('p'); what.className = 'lookMeta';
    what.textContent = d.rarity === 'base' ? '늘 파는 가구예요. 산 가구는 가구 창고에 들어가요.' : `${FURNITURE_RARITY[d.rarity]} · 하나뿐이에요 — 사면 다른 사람에게서도 사라지고 내일 새 가구가 들어와요. 오늘 ${furnitureState.mine}/${furnitureState.perDay}점 샀어요.`;
    const row = document.createElement('div'); row.className = 'goodBuy';
    const buy = document.createElement('button'); buy.type = 'button'; buy.className = 'primary'; buy.textContent = '사기';
    buy.addEventListener('click', async () => {
      if (furnitureBusy) return; furnitureBusy = true; buy.disabled = true;
      try {
        const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
        const r = await api('/api/island/furniture/buy', { method: 'POST', body: JSON.stringify({ slot, requestId: crypto.randomUUID() }) });
        plazaDialog.close(); showToast(`${r.name} — 가구 창고에 넣었어요`, 4000); await refreshFurniture(); /* (the points: the server tells, notifyPointsChanged) */
      } catch (error) { showToast(error.message, 4000); await refreshFurniture(); } finally { furnitureBusy = false; buy.disabled = false; }
    });
    const no = document.createElement('button'); no.type = 'button'; no.className = 'secondary'; no.textContent = '그만두기'; no.addEventListener('click', () => plazaDialog.close());
    row.append(buy, no); furnitureCard.replaceChildren(name, what, row);
    openPlazaWindow('가구점', [furnitureCard]); plazaDialog.classList.add('shopMode');
  }
  // 가구 창고: what I bought, each turned round in 3D (the 꾸미기 창's preview) -- placed once 내 집 comes
  const storageBox = document.createElement('div'); storageBox.className = 'furnitureStorage'; storageBox.id = 'furnitureStorage';
  async function openFurnitureStorage() {
    let pieces = []; try { pieces = (await api('/api/island/furniture/mine')).pieces; } catch (error) { showToast(error.message); return; }
    const canvas = document.createElement('canvas'); canvas.className = 'dressCanvas furnitureCanvas';
    const cap = document.createElement('p'); cap.className = 'lookMeta';
    const list = document.createElement('div'); list.className = 'furnitureList'; list.setAttribute('role', 'list');
    const show = (p, btn) => { for (const b of list.children) b.classList.toggle('selected', b === btn); cap.textContent = `${p.name} · ${FURNITURE_RARITY[p.rarity] || ''}`; plaza.controller?.tryOn?.(canvas, { model: p.model }); };
    if (!pieces.length) cap.textContent = '아직 산 가구가 없어요. 백화점 2층 가구점에 가 보세요.';
    for (const p of pieces) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost furniturePiece'; b.setAttribute('role', 'listitem'); b.textContent = p.name; b.addEventListener('click', () => show(p, b)); list.append(b); }
    const note = document.createElement('p'); note.className = 'lookMeta'; note.textContent = `${pieces.length}점 · 내 집 안에서 「꾸미기」로 놓아요`;
    storageBox.replaceChildren(canvas, cap, note, list);
    openPlazaWindow('가구 창고', [storageBox]);
    if (pieces.length) show(pieces[0], list.firstElementChild);
  }
  // ---- 묶음 4 내 집 (docs/my-home-20261020.md) ----
  // the lots (whose house, its roof) on the island; in by a house's door (the owner always, others as the owner lets
  // them), out by the room's doorway; inside, my own: 꾸미기 (a piece from the 가구 창고 moved on 0.25 m steps, turned,
  // placed or put back -- shown where it would go, green or red, before it is sent), SPACE by a tank, the insect case or
  // a frame; 내 집 in the menu: who may come in, the floor, wallpaper and roof
  const HOME_ROOFS = { red: '빨간 지붕', blue: '파란 지붕', green: '초록 지붕', brown: '갈색 지붕' };
  const HOME_FLOORS = { boards__oak: '참나무 마루', boards__walnut: '호두나무 마루', boards__birch: '자작나무 마루', tiles__mint: '민트 타일', tiles__pink: '분홍 타일' };
  const HOME_WALLS = { cream: '크림 벽지', mint: '민트 벽지', pink: '분홍 벽지', sky: '하늘 벽지' };
  const HOME_VISITS = { anyone: '아무나', friends: '친구만', none: '안 받음' };
  let homesState = null; let homeInside = null; let homeBusy = false;
  const lotName = (id) => `집터 ${String(id || '').replace('lot', '')}`;
  const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; if (fn) b.addEventListener('click', fn); return b; };
  const line = (text, cls = 'lookMeta') => { const p = document.createElement('p'); p.className = cls; p.textContent = text; return p; };
  // (the newest ask wins: two in a row -- a house applied for, then made bigger -- and the older answer arriving last drew
  // the houses as they had been until the next change)
  let homesAsk = null;
  async function refreshHomes() {
    const ask = api('/api/home').catch(() => null); homesAsk = ask; const r = await ask;
    if (homesAsk !== ask) { await homesAsk; return; }
    if (r) { homesState = r; plaza.controller?.setHomes?.(r.lots); }
  }
  function showHome(inside, pets = false) { homeInside = inside; plaza.controller?.setHome?.(inside ? (pets ? inside : { ...inside, pets: null }) : null); homeEditBtn.classList.toggle('hidden', !inside?.mine); }
  async function homeDoor(lot) {
    if (homeBusy) return; homeBusy = true;
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      const r = await api(lot ? '/api/home/enter' : '/api/home/leave', { method: 'POST', body: JSON.stringify({ lot }) });
      closeIslandWindows();
      showHome(r.space === 'home' ? await api('/api/home/inside') : null, true);
      plaza.controller?.setSpace?.(r.space, r.x, r.z); document.body.classList.toggle('townhallRoom', r.space !== 'island');
    } catch (error) { showToast(error.message); } finally { homeBusy = false; }
  }
  // R8 2층 큰 집: up the stairs (SPACE by their foot) or down (by the hole up there) -- the room laid out for that floor
  async function homeStairs() {
    if (homeBusy) return; homeBusy = true;
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      const r = await api('/api/home/stairs', { method: 'POST', body: '{}' });
      showHome(await api('/api/home/inside'), true);
      plaza.controller?.setSpace?.('home', r.x, r.z);
    } catch (error) { showToast(error.message); } finally { homeBusy = false; }
  }
  // the 민원 창구's 「내 집 신청」: a free lot on 툇마루섬 (on its little map and in the list), the roof, paid at once
  const homeCard = document.createElement('div'); homeCard.className = 'goodCard homeCard'; homeCard.id = 'homeCard';
  async function openHomeApply() {
    islandPlaceDialog.close(); await refreshHomes(); if (!homesState) return;
    if (homesState.mine) { // 묶음 4-2 「집 넓히기」: the 오두막 made a 작은 집, done the next day
      const H = window.IslandHome; const m = homesState.mine; const now = H.stageOf(m.stage); if (m.upgradeDay || now.n >= H.TOP_STAGE) { showToast(m.upgradeDay ? '집을 넓히는 중이에요. 내일 완성돼요.' : `벌써 내 집이 있어요 (${lotName(m.lot)}). 지금은 더 넓힐 수 없어요.`); return; }
      const to = H.stageOf(now.n + 1);
      const go = btn(`넓히기 · ${Number(homesState.grow).toLocaleString('ko-KR')}P`, 'primary', async () => {
        if (homeBusy) return; homeBusy = true; go.disabled = true;
        try { await api('/api/home/upgrade', { method: 'POST', body: '{}' }); plazaDialog.close(); showToast(`공사를 시작했어요! 내일 ${to.name}이 돼요.`, 5000); await refreshHomes(); loadPoints(); }
        catch (error) { showToast(error.message, 4000); } finally { homeBusy = false; go.disabled = false; }
      });
      homeCard.replaceChildren(line(`${now.name}을 ${to.name}으로 넓혀요. 방이 ${to.w}×${to.d}m로 커지고 가구 ${to.pieces}점·물고기 ${to.fish}마리까지 둘 수 있어요. 오늘 공사하고 내일(00:00) 완성돼요. 가구는 그 자리 그대로예요.`), go);
      openPlazaWindow('집 넓히기', [homeCard]); return;
    }
    let lot = homesState.lots.find((l) => l.owner === null)?.id || null; let roof = 'red';
    const map = document.createElement('canvas'); map.width = 300; map.height = 220; map.className = 'homeLotMap'; map.setAttribute('aria-hidden', 'true');
    const lots = document.createElement('div'); lots.className = 'homeLots'; lots.setAttribute('role', 'list');
    const roofs = document.createElement('div'); roofs.className = 'goodBuy';
    const go = btn('신청하기', 'primary'); const note = line('');
    const draw = () => {
      const c = map.getContext('2d'); c.fillStyle = '#cfe6c4'; c.fillRect(0, 0, 300, 220); c.font = '700 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      const at = (l) => [150 + (l.x - 0) * 4.4, 110 + (l.z - 140.5) * 3.8];
      c.fillStyle = '#e8dcc0'; c.fillRect(0, 106, 300, 8); // (the walk across the isle)
      for (const l of window.IslandHome.LOTS) { const s = homesState.lots.find((x) => x.id === l.id); const [x, y] = at(l); c.fillStyle = l.id === lot ? '#2563eb' : s?.owner !== null ? '#9ca3af' : '#f8fafc'; c.beginPath(); c.arc(x, y, 12, 0, Math.PI * 2); c.fill(); c.fillStyle = l.id === lot ? '#fff' : '#1f2937'; c.fillText(String(l.n), x, y); }
      for (const b of lots.children) { b.classList.toggle('selected', b.dataset.lot === lot); }
      for (const b of roofs.children) b.classList.toggle('selected', b.dataset.roof === roof);
      go.disabled = !lot; note.textContent = lot ? `${lotName(lot)} · ${HOME_ROOFS[roof]} · 오두막 ${Number(homesState.price).toLocaleString('ko-KR')}P (한 번에)` : '빈 집터가 없어요.';
    };
    for (const l of homesState.lots) { const b = btn(`${lotName(l.id)}${l.owner !== null ? ` · ${l.owner || '이웃'}` : ''}`, 'ghost tiny', () => { lot = l.id; draw(); }); b.dataset.lot = l.id; b.disabled = l.owner !== null; b.setAttribute('role', 'listitem'); lots.append(b); }
    for (const [id, name] of Object.entries(HOME_ROOFS)) { const b = btn(name, 'ghost tiny', () => { roof = id; draw(); }); b.dataset.roof = id; roofs.append(b); }
    go.addEventListener('click', async () => {
      if (homeBusy || !lot) return; homeBusy = true; go.disabled = true;
      try {
        const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
        await api('/api/home/apply', { method: 'POST', body: JSON.stringify({ lot, roof }) });
        plazaDialog.close(); showToast(`내 집이 생겼어요! 툇마루섬 ${lotName(lot)}`, 5000); await refreshHomes(); loadPoints();
      } catch (error) { showToast(error.message, 4000); await refreshHomes(); draw(); } finally { homeBusy = false; go.disabled = !lot; }
    });
    homeCard.replaceChildren(line('툇마루섬의 빈 집터를 골라 주세요. 한 사람에 한 채, 오두막부터 시작해 관공서에서 넓혀요.'), map, lots, line('지붕 색'), roofs, note, go);
    openPlazaWindow('내 집 신청', [homeCard]); draw();
  }
  // 내 집 (the menu): my lot, who may come in, the floor, wallpaper and roof (each change a small price), 꾸미기 when inside
  // (the window drawn only by the newest call -- an older one finishing later drew the house as it had been; a choice
  // made while another of the house's requests is out waits for it rather than being dropped)
  let myHomeDraw = 0;
  async function openMyHome() {
    const draw = ++myHomeDraw; await refreshHomes(); if (draw !== myHomeDraw) return; const h = homesState?.mine;
    if (!h) { homeCard.replaceChildren(line(`아직 집이 없어요. 관공서 민원 창구에서 「내 집 신청」을 해 주세요 (${Number(homesState?.price || 0).toLocaleString('ko-KR')}P).`)); openPlazaWindow('내 집', [homeCard]); return; }
    const style = async (body) => {
      for (let i = 0; homeBusy && i < 100; i += 1) await new Promise((done) => setTimeout(done, 50)); if (homeBusy) return; homeBusy = true;
      try { const r = await api('/api/home/style', { method: 'POST', body: JSON.stringify({ ...body, requestId: crypto.randomUUID() }) }); if (homeInside?.mine) showHome({ ...homeInside, home: r.home }); await refreshHomes(); loadPoints(); showToast('바꿨어요'); } catch (error) { showToast(error.message, 4000); } finally { homeBusy = false; }
      openMyHome();
    };
    const row = (label, list, now, key, paid) => { const r = document.createElement('div'); r.className = 'homeChoice'; r.append(line(label)); const g = document.createElement('div'); g.className = 'goodBuy';
      for (const [id, name] of Object.entries(list)) { const b = btn(name, id === now ? 'primary tiny' : 'ghost tiny', () => { if (id !== now) style({ [key]: id }); }); b.dataset[key] = id; b.setAttribute('aria-pressed', String(id === now)); g.append(b); }
      if (paid) g.append(line(`바꿀 때 ${Number(homesState.style).toLocaleString('ko-KR')}P`)); r.append(g); return r; };
    const st = window.IslandHome.stageOf(h.stage);
    const nodes = [line(`툇마루섬 ${lotName(h.lot)} · ${st.name}${h.upgradeDay ? ' (넓히는 중 · 내일 완성)' : ''} · 가구 ${h.pieces.length}/${st.pieces}점`, 'lostRequestLine'), row('방문 허용', HOME_VISITS, h.visit, 'visit', false), row('바닥', HOME_FLOORS, h.floor, 'floor', true), row('벽지', HOME_WALLS, h.wall, 'wall', true), row('지붕', HOME_ROOFS, h.roof, 'roof', true)];
    if (homeInside?.mine) nodes.push(btn('꾸미기', 'secondary', () => openHomeEdit()));
    else nodes.push(line('집 안에서 「꾸미기」로 가구를 놓을 수 있어요.'));
    homeCard.replaceChildren(...nodes); openPlazaWindow('내 집', [homeCard]);
  }
  // 꾸미기: a piece chosen from the 가구 창고, moved and turned with the buttons (the same on a PC and a phone), placed
  const homeEditBtn = byId('homeEditBtn'); homeEditBtn.addEventListener('click', () => openHomeEdit());
  const editBox = document.createElement('div'); editBox.className = 'homeEdit'; editBox.id = 'homeEdit';
  let homeEditing = null;
  async function openHomeEdit() {
    if (!homeInside?.mine) return;
    let pieces = []; try { pieces = (await api('/api/island/furniture/mine')).pieces; } catch (error) { showToast(error.message); return; }
    const H = window.IslandHome; const placed = new Map(homeInside.home.pieces.map((p) => [p.uid, p]));
    const list = document.createElement('div'); list.className = 'furnitureList'; list.setAttribute('role', 'list');
    const status = line(pieces.length ? '놓을 가구를 고르세요.' : '가구 창고가 비어 있어요. 백화점 2층 가구점에 가 보세요.'); status.setAttribute('role', 'status');
    const pad = document.createElement('div'); pad.className = 'homeEditPad';
    const show = () => { const why = homeEditing ? plaza.controller?.homeGhost?.(homeEditing) : null; if (homeEditing) status.textContent = `${homeEditing.name} · ${why || '여기에 놓을 수 있어요'}`; for (const b of pad.querySelectorAll('button')) b.disabled = !homeEditing; put.disabled = !homeEditing || Boolean(why); back.disabled = !homeEditing || !placed.has(homeEditing.uid); };
    const move = (dx, dz) => { if (!homeEditing) return; const q = H.snapPos({ ...homeEditing, x: homeEditing.x + dx, z: homeEditing.z + dz }, homeInside.home.stage); homeEditing.x = q.x; homeEditing.z = q.z; show(); }; // (3회차 6: up against a wall too)
    for (const p of pieces) {
      const b = btn(`${p.name}${placed.has(p.uid) ? ' · 놓음' : ''}`, 'ghost furniturePiece');
      b.dataset.uid = p.uid; b.setAttribute('role', 'listitem');
      b.addEventListener('click', () => {
        for (const x of list.children) x.classList.toggle('selected', x === b);
        const at = placed.get(p.uid); const me = plaza.controller?.debug?.() || {}; const here = H.local(H.lotById(homeInside.home.lot), me.x ?? 0, me.z ?? 0);
        homeEditing = at ? { ...at, name: p.name } : { uid: p.uid, id: p.id, name: p.name, rot: 0, x: Math.round(Math.max(-3, Math.min(3, here.lx)) * 4) / 4, z: Math.round(Math.max(-3, Math.min(3, here.lz + 1)) * 4) / 4 };
        show();
      });
      list.append(b);
    }
    const arrows = [['←', 1, 0], ['↑', 0, 1], ['↓', 0, -1], ['→', -1, 0]]; // (the room is seen from its doorway: my left is its +x)
    for (const [label, dx, dz] of arrows) { const b = btn(label, 'ghost', () => move(dx * 0.25, dz * 0.25)); b.setAttribute('aria-label', { '←': '왼쪽으로', '↑': '안쪽으로', '↓': '앞쪽으로', '→': '오른쪽으로' }[label]); pad.append(b); }
    pad.append(btn('돌리기', 'ghost', () => { if (homeEditing) { homeEditing.rot = (homeEditing.rot + 1) % 4; show(); } }));
    const send = async (body, done) => {
      if (homeBusy) return; homeBusy = true;
      try { const r = await api('/api/home/place', { method: 'POST', body: JSON.stringify(body) }); showHome({ ...homeInside, home: r.home }); homeEditing = null; showToast(done); openHomeEdit(); }
      catch (error) { status.textContent = error.message; } finally { homeBusy = false; }
    };
    const put = btn('놓기', 'primary', () => homeEditing && send({ uid: homeEditing.uid, x: homeEditing.x, z: homeEditing.z, rot: homeEditing.rot }, `${homeEditing.name} — 놓았어요`));
    const back = btn('창고로 넣기', 'secondary', () => homeEditing && send({ uid: homeEditing.uid, remove: true }, `${homeEditing.name} — 가구 창고로 넣었어요`));
    const row = document.createElement('div'); row.className = 'goodBuy'; row.append(put, back);
    const fold = btn('접기', 'ghost tiny homeEditFold', () => { const folded = plazaDialog.classList.toggle('folded'); fold.textContent = folded ? '펼치기' : '접기'; fold.setAttribute('aria-expanded', String(!folded)); }); fold.setAttribute('aria-expanded', 'true');
    editBox.replaceChildren(fold, status, pad, row, line(`가구 ${homeInside.home.pieces.length}/${H.stageOf(homeInside.home.stage).pieces}점 · 벽 가구(액자·시계·커튼 창·선반)는 뒤가 벽에 닿게`), list);
    // (문제 기록 3회차 5 「창이 다 가려서 안 보여」: an edge strip -- the right side on a PC, the bottom on a phone -- folded
    // to its title with 접기, the camera over the whole room)
    homeEditing = null; openPlazaWindow('꾸미기', [editBox]); plazaDialog.classList.add('editMode'); plazaDialog.classList.remove('folded'); plaza.controller?.homeEditView?.(true); show();
    plazaDialog.addEventListener('close', () => { homeEditing = null; plaza.controller?.homeGhost?.(null); plaza.controller?.homeEditView?.(false); plazaDialog.classList.remove('editMode', 'folded'); }, { once: true });
  }
  // a tank or the insect case: what is in it (꺼내기 -- back to the bag) and what of my bag fits (넣기)
  const tankBox = document.createElement('div'); tankBox.className = 'homeTank'; tankBox.id = 'homeTank';
  async function openTank(uid) {
    const H = window.IslandHome; const p = homeInside?.home.pieces.find((x) => x.uid === uid); if (!p) return;
    const shape = H.shapeOf(p.id); const T = H.TANKS[shape]; const inside = homeInside.home.tanks[uid] || [];
    let bag = { items: [] }; try { bag = await api('/api/island/bag'); } catch (error) { showToast(error.message); return; }
    const act = async (body) => {
      if (homeBusy) return; homeBusy = true;
      try { const r = await api('/api/home/tank', { method: 'POST', body: JSON.stringify({ tank: uid, ...body, requestId: crypto.randomUUID() }) }); showHome({ ...(await api('/api/home/inside')), home: r.home }); }
      catch (error) { showToast(error.message, 4000); } finally { homeBusy = false; }
      openTank(uid);
    };
    const now = document.createElement('div'); now.className = 'giftList';
    for (const f of inside) now.append(btn(`${homeInside.names?.[f.itemId] || f.itemId} · 꺼내기`, 'ghost', () => act({ take: f.fid })));
    const can = document.createElement('div'); can.className = 'giftList';
    for (const item of bag.items.filter((e) => H.fits(shape, e.itemId))) { const b = btn('', 'ghost', () => act({ put: item.itemId })); b.append(itemIcon(item), ` ${item.name} ×${item.qty} · 넣기`); can.append(b); }
    const what = T.insects ? '곤충' : '물고기';
    tankBox.replaceChildren(line(`${inside.length}/${T.slots}마리${T.insects ? '' : ` · ${{ small: '작은', medium: '중간까지', large: '큰 것까지' }[T.biggest]} 물고기`}`, 'lostRequestLine'), ...(inside.length ? [now] : []), line(can.children.length ? `가방의 ${what}` : `가방에 넣을 수 있는 ${what}가 없어요.`), can);
    openPlazaWindow(T.insects ? '곤충 상자' : '수조', [tankBox]);
  }
  // a frame: one of my 기념사진 (the places I took one) hung in it
  async function openFrame(uid) {
    const p = homeInside?.home.pieces.find((x) => x.uid === uid); if (!p) return;
    const list = document.createElement('div'); list.className = 'giftList';
    for (const id of homeInside.myPhotos || []) list.append(btn(`${homeInside.photos[id]}${p.photo === id ? ' · 걸려 있음' : ''}`, p.photo === id ? 'primary' : 'ghost', async () => {
      try { const r = await api('/api/home/place', { method: 'POST', body: JSON.stringify({ uid, x: p.x, z: p.z, rot: p.rot, photo: id }) }); showHome({ ...homeInside, home: r.home }); plazaDialog.close(); showToast('기념사진을 걸었어요'); } catch (error) { showToast(error.message); }
    }));
    tankBox.replaceChildren(list.children.length ? list : line('아직 찍은 기념사진이 없어요. 섬의 사진 명소에서 「사진」으로 찍어 보세요.'));
    openPlazaWindow('액자', [tankBox]);
  }
  // ---- 친구 (docs/friends-20261020.md): 내 정보의 「친구」 -- my friends (where each is, if here), the asks for me ----
  const friendsSection = byId('myFriends');
  async function renderFriends() {
    let f; try { f = await api('/api/friends'); } catch { return; }
    const head = document.createElement('div'); head.className = 'myInfoSectionHead'; const h3 = document.createElement('h3'); h3.textContent = `친구 ${f.friends.length}/${f.max}`; head.append(h3);
    const nodes = [head];
    if (!f.allowed) nodes.push(line('아이디로 로그인한 계정만 친구를 맺을 수 있어요.', 'smallMuted'));
    const act = async (path, body, done) => { try { await api(path, { method: 'POST', body: JSON.stringify(body) }); if (done) showToast(done); } catch (error) { showToast(error.message, 4000); } renderFriends(); };
    for (const r of f.incoming) { const row = document.createElement('div'); row.className = 'myPetRow friendAsk'; row.setAttribute('role', 'listitem'); const n = document.createElement('span'); n.textContent = `${r.name || '이웃'}님의 친구 신청`;
      row.append(n, btn('수락', 'primary tiny', () => act('/api/friends/answer', { id: r.id, accept: true }, '친구가 되었어요')), btn('거절', 'ghost tiny', () => act('/api/friends/answer', { id: r.id, accept: false }))); nodes.push(row); }
    for (const x of f.friends) { const row = document.createElement('div'); row.className = 'myPetRow friendRow'; row.setAttribute('role', 'listitem'); const n = document.createElement('span'); n.textContent = `${x.name || '이웃'} · ${x.where || '접속 안 함'}`;
      row.append(n, btn('끊기', 'ghost tiny', () => { if (window.confirm(`${x.name || '이웃'}님과 친구를 끊을까요?`)) act('/api/friends/remove', { id: x.id }, '친구를 끊었어요'); })); nodes.push(row); }
    if (f.allowed && !f.friends.length && !f.incoming.length) nodes.push(line('섬에서 다른 사람에게 다가가 SPACE → 「친구 신청」을 해 보세요.', 'smallMuted'));
    friendsSection.replaceChildren(...nodes);
  }
  function storeKeeperTalk() {
    const lines = ['「어서 오세요! 백화점 잡화 코너예요.」', '「진열된 물건 앞에 서서 SPACE를 누르면 보여 드릴게요.」'].map((s) => { const p = document.createElement('p'); p.className = 'lostRequestLine'; p.textContent = s; return p; });
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'primary'; ok.textContent = '둘러볼게요'; ok.addEventListener('click', () => plazaDialog.close());
    lostCard.replaceChildren(...lines, ok); openTalk('잡화점 주인');
  }
  const goodCard = document.createElement('div'); goodCard.className = 'goodCard'; goodCard.id = 'goodCard';
  let goodBusy = false;
  function openGood(id) {
    const g = storeGoods.find((x) => x.id === id); if (!g || !g.price) { showToast('곧 판매할 물건이에요.'); return; }
    const img = GOOD_ICONS.has(id) ? Object.assign(document.createElement('img'), { src: `/assets/items/goods/${id}.png`, alt: '', className: 'goodIcon' }) : Object.assign(document.createElement('span'), { textContent: '🚲', className: 'goodIcon' }); // (자전거: no picture of its own -- its mark)
    const name = document.createElement('strong'); name.textContent = `${g.name} · ${Number(g.price).toLocaleString('ko-KR')}P`;
    const what = document.createElement('p'); what.className = 'lookMeta'; what.textContent = GOOD_USE[g.use] || '';
    const row = document.createElement('div'); row.className = 'goodBuy';
    const once = ['tool', 'bike'].includes(g.use); // (5회차 10-①: a tool is bought once -- one, and 「가지고 있어요」 while one is in the bag)
    for (const qty of once ? [1] : [1, 5, 10]) { const b = document.createElement('button'); b.type = 'button'; b.className = qty === 1 ? 'primary' : 'secondary'; b.textContent = `${qty}개 · ${Number(g.price * qty).toLocaleString('ko-KR')}P`; b.dataset.qty = qty;
      b.addEventListener('click', async () => {
        if (goodBusy) return; goodBusy = true;
        try { const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {}); await api('/api/island/store/buy', { method: 'POST', body: JSON.stringify({ itemId: id, qty, requestId: crypto.randomUUID() }) }); showToast(`🛍️ ${g.name} ${qty}개를 가방에 넣었어요.`); loadPoints(); if (id.startsWith('bike_')) refreshBikes(); }
        catch (error) { showToast(error.message, 4000); } finally { goodBusy = false; }
      }); row.append(b); }
    goodCard.replaceChildren(img, name, what, row);
    if (once) api('/api/island/bag').then((b) => { if ((b.items || []).some((e) => e.itemId === id && e.qty > 0)) { const own = row.querySelector('button'); own.disabled = true; own.textContent = '가지고 있어요'; } }).catch(() => {});
    openPlazaWindow('잡화점', [goodCard]); plazaDialog.classList.add('shopMode');
  }
  // v1.10.84 관공서 실내: the server takes me in (at the hall's door, past the mayor) or out (at the room's door) and says
  // where I stand now; the island's map is put away inside (body.townhallRoom)
  let townhallBusy = false;
  async function townhallDoor(entering) {
    if (townhallBusy) return; townhallBusy = true;
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      const r = await api(entering ? '/api/island/townhall/enter' : '/api/island/townhall/leave', { method: 'POST', body: '{}' });
      closeIslandWindows(); plaza.controller?.setSpace?.(r.space, r.x, r.z); document.body.classList.toggle('townhallRoom', r.space === 'townhall');
    } catch (error) { showToast(error.message); } finally { townhallBusy = false; }
  }
  // v1.10.85 관공서 예금 창구 (사용자 2026-10-17): the wallet and the deposit, interest by tiers added at each Seoul midnight;
  // anything in or out at any time (the server checks I am at the window, and pays each request once)
  const bankDialog = byId('bankDialog'); let bankNow = null; let bankBusy = false;
  const fmtP = (n) => `${Number(n).toLocaleString('ko-KR')}P`;
  function showBank(v) {
    bankNow = v; byId('bankWallet').textContent = fmtP(v.balance); byId('bankDeposit').textContent = fmtP(v.deposit);
    // (경제 점검 ⑥-A: the interest by tiers -- the server's tiers and tomorrow's interest)
    const tiers = (v.tiers || []).map((t, i, all) => (t.upTo == null ? `그 위 ${t.percent}%` : `${i ? `${fmtP(all[i - 1].upTo)}~` : ''}${fmtP(t.upTo)}까지 ${t.percent}%`)).join(' · ');
    byId('bankRate').textContent = `예금에는 매일 자정(한국 시간) 구간별 이자가 붙습니다 — ${tiers}(7일 이상 접속하지 않으면 그 뒤로는 붙지 않아요). 내일 예상 이자 +${fmtP(v.tomorrow ?? 0)}`;
  }
  async function openBank() {
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      showBank(await api('/api/island/bank')); byId('bankStatus').textContent = ''; byId('bankAmount').value = ''; bankDialog.showModal();
    } catch (error) { showToast(error.message); }
  }
  async function bankMove(kind) {
    if (bankBusy || !bankNow) return;
    const typed = Math.floor(Number(byId('bankAmount').value));
    const amount = kind === 'allIn' ? bankNow.balance : kind === 'allOut' ? -bankNow.deposit : kind === 'in' ? typed : -typed;
    if (!Number.isSafeInteger(amount) || amount === 0) { byId('bankStatus').textContent = kind.startsWith('all') ? '옮길 포인트가 없습니다.' : '금액을 입력해 주세요.'; return; }
    bankBusy = true;
    try {
      const r = await api('/api/island/bank', { method: 'POST', body: JSON.stringify({ amount, requestId: crypto.randomUUID() }) });
      showBank(r); byId('bankAmount').value = ''; loadPoints();
      byId('bankStatus').textContent = amount > 0 ? `${fmtP(amount)} 맡겼습니다.` : `${fmtP(-amount)} 찾았습니다.`;
    } catch (error) { byId('bankStatus').textContent = error.message; } finally { bankBusy = false; }
  }
  byId('bankForm').addEventListener('submit', (event) => { event.preventDefault(); bankMove('in'); });
  for (const b of byId('bankForm').querySelectorAll('button[type=button]')) b.addEventListener('click', () => bankMove(b.dataset.bank));
  byId('bankCloseBtn').addEventListener('click', () => bankDialog.close());
  // v1.10.80 농부 밭: the week's shared field (stage, helpers' names) -- asked while the island is up
  let islandTimeSeq = 0; // (a change pushed meanwhile wins over a slower read)
  function refreshIslandTime() { const seq = ++islandTimeSeq; api('/api/island/time').then((d) => { if (seq !== islandTimeSeq) return; plaza.controller?.setTimeMode?.(d.mode); plaza.controller?.setIslandLook?.(d); const ss = byId('islandSeasonSelect'); if (ss) ss.value = d.seasonHold == null ? 'auto' : 'hold'; const ds = byId('islandDecorSelect'); if (ds) ds.value = d.decor; const sel = byId('islandTimeSelect'); if (sel) sel.value = d.mode; }).catch(() => {}); } // v1.10.90
  // A4 날씨: the server's weather for everyone; asked on entering the island, pushed when the administrator holds it, and
  // asked again when its block ends
  let weatherTimer = null;
  function showWeather(d) {
    plaza.controller?.setWeather?.(d.kind); const sel = byId('islandWeatherSelect'); if (sel && d.mode) sel.value = d.mode;
    clearTimeout(weatherTimer); if (d.until && d.serverNow) weatherTimer = setTimeout(refreshIslandWeather, Math.max(5000, d.until - d.serverNow + 1500));
  }
  let weatherSeq = 0; // (a slower earlier read does not undo the administrator's change -- Codex review)
  function refreshIslandWeather() { const seq = ++weatherSeq; api('/api/island/weather').then((d) => { if (seq === weatherSeq) showWeather(d); }).catch(() => {}); }
  // A4 주말 섬 대회: a bar over the island -- 10 minutes before (what and when), while it runs (the time left, the top 3
  // and me, every 10 s), and a while after (the winner); the server judges, the page only shows
  let contestPoll = null; let contestTick = null; let contestSeen = null;
  const contestScore = (c, n) => `${Number(n).toLocaleString('ko-KR')}${c.unit}`;
  function refreshContest() {
    clearTimeout(contestPoll); if (!document.body.classList.contains('plazaMode')) return;
    api('/api/island/contest').then((d) => {
      const c = d.contest; const bar = byId('contestBar'); const offset = d.serverNow - Date.now(); clearInterval(contestTick);
      if (c.phase === 'live' && contestSeen !== c.id + ':live') { contestSeen = c.id + ':live'; showToast(`🏆 ${c.name} 시작! ${c.how}으로 겨뤄요.`, 5000); }
      const show = (text) => { bar.textContent = text; bar.classList.toggle('hidden', !text); };
      const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
      const draw = () => {
        const now = Date.now() + offset;
        if (c.phase === 'soon') show(`🏆 곧 ${c.name} · ${clock(c.start - now)} 뒤 시작 · ${c.how}`);
        else if (c.phase === 'live') show(`🏆 ${c.name} · 남은 ${clock(c.end - now)} · ${d.top.length ? d.top.slice(0, 3).map((r) => `${r.rank}위 ${r.name} ${contestScore(c, r.score)}`).join(' · ') : '아직 기록 없음'}${d.mine ? ` · 나 ${d.mine.rank}위` : ''}`);
        else if (d.last?.id === c.id && now - c.end < 30 * 60000) show(d.last.rewarded ? `🏆 ${d.last.name} 우승 ${d.last.top[0]?.name || ''} · ${contestScore(c, d.last.top[0]?.score || 0)}` : `🏆 ${d.last.name} 끝 · 참가자가 적어 시상은 없어요`);
        else show('');
      };
      draw(); if (c.phase === 'soon' || c.phase === 'live') contestTick = setInterval(draw, 1000);
      contestPoll = setTimeout(refreshContest, c.phase === 'live' || c.phase === 'soon' ? 10000 : 60000);
    }).catch(() => { contestPoll = setTimeout(refreshContest, 60000); });
  }
  byId('contestForm')?.addEventListener('submit', async (event) => { // A4 관리자: 대회 일정
    event.preventDefault(); const [hour, minute] = byId('contestTime').value.split(':').map(Number);
    try { await api('/api/admin/contest', { method: 'POST', body: JSON.stringify({ day: Number(byId('contestDay').value), hour, minute, minutes: Number(byId('contestMinutes').value), enabled: byId('contestEnabled').checked }) }); showToast('주말 섬 대회 일정을 바꿨어요.'); } catch (error) { showToast(error.message, 4000); }
  });
  // A4 밤하늘 별똥별: the server says when the next star falls (the same moment for everyone); while it falls a streak
  // crosses the top of the view and 「소원 빌기」 shows; yesterday's wishes come back as a small gift on the first look
  let starTimers = []; let starPoll = null; let starShown = null;
  function refreshStars() {
    clearTimeout(starPoll); if (!document.body.classList.contains('plazaMode')) return;
    api('/api/island/stars').then((d) => {
      if (d.gift) showToast(`어젯밤 별똥별에 빈 소원이 선물로 왔어요 · +${Number(d.gift).toLocaleString('ko-KR')}P`, 5000);
      const offset = d.serverNow - Date.now(); starTimers.forEach(clearTimeout); starTimers = [];
      for (const st of [d.now, d.next].filter(Boolean)) { const wait = st.at - offset - Date.now(); if (wait < 120000) starTimers.push(setTimeout(() => showStar(st, d.wishMs - Math.max(0, -wait)), Math.max(0, wait))); }
      starPoll = setTimeout(refreshStars, 60000);
    }).catch(() => { starPoll = setTimeout(refreshStars, 60000); });
  }
  function showStar(st, ms) {
    if (starShown === st.id || ms <= 0 || !document.body.classList.contains('plazaMode')) return; starShown = st.id;
    const streak = byId('plazaStar'); const btn = byId('starWishBtn');
    streak.classList.remove('hidden', 'fall'); void streak.offsetWidth; streak.classList.add('fall'); btn.classList.remove('hidden'); btn.disabled = false; btn.dataset.star = st.id;
    setTimeout(() => { btn.classList.add('hidden'); streak.classList.add('hidden'); }, ms);
  }
  byId('starWishBtn')?.addEventListener('click', async () => {
    const btn = byId('starWishBtn'); btn.disabled = true;
    try { const r = await api('/api/island/stars/wish', { method: 'POST', body: JSON.stringify({ id: btn.dataset.star }) }); showToast(r.already ? '이미 소원을 빌었어요.' : '소원을 빌었어요! 내일 작은 선물이 와요.', 4000); } catch (error) { showToast(error.message, 3500); }
    btn.classList.add('hidden');
  });
  // v1.10.91 경제 값 관리: the table by group (the default beside each), a confirm listing the changes, and the history
  // with a 되돌리기 for each change (back to the value before it)
  let economyNow = null;
  function drawEconomy(v) {
    economyNow = v; const box = byId('economyTable'); if (!box) return;
    const groups = [...new Set(v.defs.map((d) => d.group))];
    box.replaceChildren(...groups.map((g) => { const f = document.createElement('fieldset'); const l = document.createElement('legend'); l.textContent = g; f.append(l);
      for (const d of v.defs.filter((x) => x.group === g)) { const row = document.createElement('label'); row.className = 'economyRow';
        const name = document.createElement('span'); name.textContent = d.label; const input = document.createElement('input'); input.type = 'number'; input.min = d.min; input.max = d.max; input.step = 1; input.dataset.key = d.key; input.value = d.changed ? d.value : ''; input.placeholder = String(d.def);
        const def = document.createElement('small'); def.textContent = `기본 ${d.def.toLocaleString('ko-KR')}`; row.append(name, input, def); f.append(row); }
      return f; }));
    byId('economyHistory').replaceChildren(...v.history.slice(0, 30).map((h, i) => { const li = document.createElement('li'); li.textContent = `${new Date(h.at).toLocaleString('ko-KR')} · ${h.label}: ${h.before.toLocaleString('ko-KR')} → ${h.after.toLocaleString('ko-KR')} `;
      const back = document.createElement('button'); back.type = 'button'; back.className = 'ghost'; back.textContent = '되돌리기'; back.addEventListener('click', () => saveEconomy({ [h.key]: h.before === v.defs.find((d) => d.key === h.key)?.def ? null : h.before })); li.append(back); return li; }));
  }
  async function saveEconomy(changes) {
    const keys = Object.keys(changes); if (!keys.length) { showToast('바뀐 값이 없습니다.'); return; }
    const text = keys.map((k) => { const d = economyNow.defs.find((x) => x.key === k); return `${d.group} · ${d.label}: ${d.value.toLocaleString('ko-KR')} → ${(changes[k] ?? d.def).toLocaleString('ko-KR')}`; }).join('\n');
    if (!window.confirm(`이렇게 바꿀까요?\n\n${text}`)) return;
    try { drawEconomy(await api('/api/admin/economy', { method: 'POST', body: JSON.stringify({ changes }) })); showToast('경제 값을 저장했습니다.'); } catch (error) { showToast(error.message, 4000); }
  }
  byId('economySave')?.addEventListener('click', () => {
    const changes = {};
    for (const input of byId('economyTable').querySelectorAll('input[data-key]')) { const d = economyNow.defs.find((x) => x.key === input.dataset.key); const v = input.value === '' ? null : Math.floor(Number(input.value));
      if (v !== null && (!Number.isSafeInteger(v) || v < d.min || v > d.max)) { showToast(`${d.label}: ${d.min.toLocaleString('ko-KR')}~${d.max.toLocaleString('ko-KR')} 사이로 적어 주세요.`, 4000); input.focus(); return; }
      const want = v === d.def ? null : v; if (want !== (d.changed ? d.value : null)) changes[d.key] = want; } // (the default itself: no override)
    saveEconomy(changes);
  });
  // E1 행사 달력 (관리자): each festival's days (moved or as made) and an off switch
  function drawCalendar(data) {
    const table = byId('calendarTable'); if (!table) return;
    table.replaceChildren(...data.festivals.map((f) => {
      const o = data.override?.[f.id] || {}; const row = document.createElement('div'); row.className = 'economyRow calendarRow'; row.dataset.festival = f.id;
      const name = document.createElement('span'); name.textContent = `${f.name} (원래 ${f.start} ~ ${f.end})`;
      const mk = (cls, value, label) => { const i = document.createElement('input'); i.type = 'date'; i.className = cls; i.value = value || ''; i.setAttribute('aria-label', `${f.name} ${label}`); return i; };
      const off = document.createElement('label'); off.className = 'calOffLabel'; const box = document.createElement('input'); box.type = 'checkbox'; box.className = 'calOff'; box.checked = Boolean(o.off); off.append(box, ' 끄기');
      row.append(name, mk('calStart', o.start, '시작일'), mk('calEnd', o.end, '끝날'), off); return row;
    }));
  }
  byId('calendarBox')?.addEventListener('toggle', (event) => { if (event.target.open) api('/api/admin/calendar').then(drawCalendar).catch((error) => showToast(error.message)); });
  byId('calendarSave')?.addEventListener('click', async () => {
    const override = {}; for (const row of document.querySelectorAll('#calendarTable [data-festival]')) { const start = row.querySelector('.calStart').value; const end = row.querySelector('.calEnd').value; const off = row.querySelector('.calOff').checked; if (start || end || off) override[row.dataset.festival] = { ...(start ? { start } : {}), ...(end ? { end } : {}), off }; }
    if (!window.confirm('행사 달력을 저장할까요? 섬에 바로 적용됩니다.')) return;
    try { await api('/api/admin/calendar', { method: 'POST', body: JSON.stringify({ override }) }); drawCalendar(await api('/api/admin/calendar')); showToast('행사 달력을 저장했습니다.'); } catch (error) { showToast(error.message, 4000); }
  });
  byId('economyBox')?.addEventListener('toggle', (event) => { if (event.target.open) api('/api/admin/economy').then(drawEconomy).catch((error) => showToast(error.message)); });
  // 경제 점검 ⑥-E (관리자 「경제」 통계): the points held, the last 14 days' in and out (each day, and by reason), the ten
  // holding most -- their names hidden unless asked (the first letter only)
  let economyStatsNow = null;
  function drawEconomyStats(s = economyStatsNow) {
    economyStatsNow = s; const box = byId('economyStats'); if (!box || !s) return;
    const P = (n) => `${Number(n).toLocaleString('ko-KR')}P`; const mask = byId('economyStatsMask').checked;
    const el = (tag, text) => { const e = document.createElement(tag); if (text != null) e.textContent = text; return e; };
    const table = (head, rows) => { const t = el('table'); t.className = 'economyStatsTable'; const tr = el('tr'); for (const h of head) tr.append(el('th', h)); t.append(tr); for (const r of rows) { const row = el('tr'); for (const c of r) row.append(el('td', c)); t.append(row); } return t; };
    const days = [...new Set(s.flows.map((f) => f.day))]; const reasons = [...new Set(s.flows.map((f) => f.reason))];
    const of = (list) => [list.reduce((n, f) => n + f.in, 0), list.reduce((n, f) => n + f.out, 0)];
    box.replaceChildren(
      el('p', `전체 ${P(s.wallets + s.deposits)} · 지갑 ${P(s.wallets)} · 예금 ${P(s.deposits)} · 계정 ${s.accounts}개`),
      el('h4', '날짜별 (최근 14일)'), table(['날짜', '들어옴', '나감', '차이'], days.map((d) => { const [i, o] = of(s.flows.filter((f) => f.day === d)); return [d, P(i), P(o), P(i - o)]; })),
      el('h4', '사유별 (14일 합)'), table(['사유', '들어옴', '나감'], reasons.map((r) => [r, ...of(s.flows.filter((f) => f.reason === r))]).sort((a, b) => (b[1] + b[2]) - (a[1] + a[2])).map(([r, i, o]) => [pointHistoryTitle({ reason: r }) || r, P(i), P(o)])),
      el('h4', '많이 가진 10명'), table(['순위', '이름', '지갑', '예금', '합'], s.top.map((t) => [String(t.rank), mask ? `${[...t.name][0] || ''}${'*'.repeat(Math.max(1, [...t.name].length - 1))}` : t.name, P(t.balance), P(t.deposit), P(t.total)])));
  }
  byId('economyStatsBox')?.addEventListener('toggle', (event) => { if (event.target.open) api('/api/admin/economy/stats').then(drawEconomyStats).catch((error) => showToast(error.message)); });
  byId('economyStatsMask')?.addEventListener('change', () => drawEconomyStats());
  // v1.10.90 운영 스위치: read when the admin panel shows, each box saved as it changes
  const opsBox = byId('opsSwitches');
  const drawSwitches = (sw) => { for (const c of opsBox?.querySelectorAll('input[data-switch]') || []) c.checked = sw[c.dataset.switch] !== false; };
  opsBox?.addEventListener('change', async (event) => {
    const c = event.target.closest('input[data-switch]'); if (!c) return;
    try { drawSwitches((await api('/api/admin/switches', { method: 'POST', body: JSON.stringify({ [c.dataset.switch]: c.checked }) })).switches); showToast(`${c.parentElement.textContent.trim()}: ${c.checked ? '켬' : '끔'}`); if (c.dataset.switch === 'dalmaruPreview') { try { if (c.checked) localStorage.setItem('gc.islandMap', 'dalmaru'); else localStorage.removeItem('gc.islandMap'); } catch {} setTimeout(() => location.reload(), 800); } } catch (error) { c.checked = !c.checked; showToast(error.message, 4000); }
  });
  new MutationObserver(() => { if (!adminPanel.classList.contains('hidden')) { api('/api/admin/contest').then(({ config: c }) => { byId('contestDay').value = String(c.day); byId('contestTime').value = `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`; byId('contestMinutes').value = String(c.minutes); byId('contestEnabled').checked = c.enabled; }).catch(() => {}); // (A4 대회 일정)
 api('/api/admin/switches').then((d) => drawSwitches(d.switches)).catch(() => {}); api('/api/island/time').then((d) => { const sel = byId('islandTimeSelect'); if (sel) sel.value = d.mode; }).catch(() => {}); } }).observe(adminPanel, { attributes: true, attributeFilter: ['class'] });
  for (const [form, select, path, label] of [['islandSeasonForm', 'islandSeasonSelect', '/api/admin/island/season', '계절 회전'], ['islandDecorForm', 'islandDecorSelect', '/api/admin/island/decor', '이벤트 장식']]) { // A5 관리자
    byId(form)?.addEventListener('submit', async (event) => { event.preventDefault(); const mode = byId(select).value; try { await api(path, { method: 'POST', body: JSON.stringify({ mode }) }); showToast(`${label}: ${byId(select).selectedOptions[0].textContent}`); } catch (error) { showToast(error.message, 4000); } });
  }
  byId('islandWeatherForm')?.addEventListener('submit', async (event) => { // A4 관리자: 날씨
    event.preventDefault(); const mode = byId('islandWeatherSelect').value;
    try { await api('/api/admin/island/weather', { method: 'POST', body: JSON.stringify({ mode }) }); showToast(`섬 날씨: ${byId('islandWeatherSelect').selectedOptions[0].textContent}`); } catch (error) { showToast(error.message, 4000); }
  });
  byId('islandTimeForm')?.addEventListener('submit', async (event) => { // v1.10.90 관리자: 섬 시간대
    event.preventDefault(); const mode = byId('islandTimeSelect').value;
    try { await api('/api/admin/island/time', { method: 'POST', body: JSON.stringify({ mode }) }); showToast(`섬 시간대: ${byId('islandTimeSelect').selectedOptions[0].textContent}`); } catch (error) { showToast(error.message, 4000); }
  });
  function refreshFarm() { if (plaza.controller?.setFarm && document.body.classList.contains('plazaMode')) api('/api/island/farm').then((v) => plaza.controller?.setFarm?.(v)).catch(() => {}); }
  setInterval(refreshFarm, 15000);
  let questTalkGen = 0; plazaDialog.addEventListener('close', () => { questTalkGen += 1; });
  function openQuestTalk(data) {
    plaza.controller?.emote?.(data.done && data.reward ? 'clap' : 'nod');
    const line = document.createElement('p'); line.className = 'lostRequestLine'; line.textContent = `「${data.say}」`;
    const meta = document.createElement('p'); meta.className = 'lookMeta';
    const doneText=data.fixed?'이야기 끝':'이번 주 이야기 끝';
    meta.textContent = data.reward && !data.finished ? `+${Number(data.reward).toLocaleString('ko-KR')}P${data.done ? ` · ${doneText}` : ''}` : data.done ? doneText : ''; // (U: a step's pay is on its done card -- the bubble keeps their words)
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'primary'; ok.textContent = '확인'; /* (Q: taking it on is 「할게요!」 on the ask's note -- this only closes) */ ok.addEventListener('click', () => plazaDialog.close());
    const sell = data.story === 'fisher' ? (() => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost'; b.textContent = '물고기 팔기'; b.addEventListener('click', () => { plazaDialog.close(); openIslandPlace('fisher'); }); return [b]; })() : []; // v1.10.42
    // v1.10.80 농부 부탁: a game step opens its round right here (GameLaunch, back to the island after); a paid round at the
    // goal is the step done -- then a word with the farmer hands it in
    const game = data.minigame ? (() => { const b = document.createElement('button'); b.type = 'button'; b.className = 'primary'; b.textContent = '도와줄게요'; b.addEventListener('click', async () => {
      plazaDialog.close(); const m = data.minigame;
      if (m.ai) { // A2c 정자 할아버지: a game room against the server's AI (쉬움 -- a harder one counts too, from the game hall)
        try { const room = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ gameType: m.game.slice(3), visibility: 'private', title: `${data.name}의 대국`, ai: m.level || 'easy' }) }); enterRoomState(room.state); showToast(`자리를 고르면 AI가 맞은편에 앉아요. 이기면 ${data.name}에게 다시 말을 걸어 주세요.`, 5000); }
        catch (error) { showToast(error.message); }
        return;
      }
      const r = await window.GameLaunch.play(m.game, { level: m.level, goal: m.goal, place: 'quest' });
      if (m.puzzle ? r?.score != null : r?.done) showToast(`해냈어요! ${data.name}에게 다시 말을 걸어 주세요.`, 4000); // (v1.10.93: any resident's round; A2b: a puzzle solved -- the daily, sent with its answer)
      else if (m.puzzle) { if (r && 'outcome' in r) showToast('오늘의 문제를 끝까지 풀어 주세요!', 4000); }
      else if (r?.score != null) showToast(m.game === 'numbers' ? `${Math.round(m.goal / 1000)}초 안에 끝내야 해요. 다시 도전해 보세요!` : `${Number(m.goal).toLocaleString('ko-KR')}점이 필요해요. 다시 도전해 보세요!`, 4000);
    }); return [b]; })() : [];
    if (game.length) ok.className = 'ghost';
    if (data.story === 'farmer') refreshFarm();
    if (data.finished) showDoneCard(data.finished); // (Q 끝내기: a step's end a small stamp, the story's a big one)
    if (data.offer) { // (Q 부탁 받기: their ask with its note -- 「할게요!」 starts it, 「다음에요」 keeps nothing)
      const yes = document.createElement('button'); yes.type = 'button'; yes.className = 'primary'; yes.textContent = '할게요!';
      yes.addEventListener('click', async () => {
        yes.disabled = true; const gen = questTalkGen; const live = () => plazaDialog.open && gen === questTalkGen; // (C4 P3-2: closed or another window since -- the late answer does not cover it)
        try { const r = await api('/api/island/event', { method: 'POST', body: JSON.stringify({ id: `quest${data.story}`, accept: true }) }); showIslandEvents(r.events || islandEventsNear); showQuestTracker(r.track || []); if (live()) openQuestTalk(r); }
        catch (error) { showToast(error.message); if (live()) plazaDialog.close(); }
      });
      const later = document.createElement('button'); later.type = 'button'; later.className = 'ghost'; later.textContent = '다음에요'; later.addEventListener('click', () => plazaDialog.close());
      lostCard.replaceChildren(line, offerNote(data.offer), yes, later);
      openTalk(data.name, false); return;
    }
    lostCard.replaceChildren(line, ...(meta.textContent ? [meta] : []), ...game, ok, ...sell);
    openTalk(data.name, !data.waiting); // a step taken, paid or ended; only "how is it going" stays over the shoulder
  }
  // Q 부탁 받기·끝내기 (gamecenter-notes docs/quest-accept-complete-20261026.md): an ask's note -- what, where, what it pays,
  // until when -- on paper; and the end's card in the middle, the red 「완료」 stamp pressed on and what came of it (a story's
  // step a small stamp, the story or an errand a big one; still under 움직임 줄이기)
  const fmtPts = (n) => `${Number(n).toLocaleString('ko-KR')}P`;
  function offerNote(o) {
    const card = document.createElement('div'); card.className = 'isle-paper questNote';
    const head = document.createElement('strong'); head.textContent = `📜 ${o.title}`; card.append(head);
    for (const text of [o.label && `할 일 · ${o.label}`, o.where && `어디 · 보통 ${o.where} 쪽에 있어요`, o.reward && `받는 것 · +${fmtPts(o.reward)} · 호감도`, o.until && `기한 · ${o.until}`].filter(Boolean)) { const p = document.createElement('p'); p.textContent = text; card.append(p); }
    return card;
  }
  function showDoneCard(f) {
    const step = f.whole === false; // (a story's step, not its end)
    document.querySelector('.questDone')?.remove();
    const card = document.createElement('div'); card.className = `isle-paper questDone${step ? ' small' : ''}${motionMode() === 'on' ? ' still' : ''}`; card.setAttribute('role', 'status'); // (움직임 줄이기 켬: the stamp without its press)
    const title = document.createElement('strong'); title.textContent = step ? `${f.step}단계 끝!` : f.whole ? '이야기 끝!' : '부탁 완료!';
    const stamp = document.createElement('span'); stamp.className = 'questStamp'; stamp.textContent = step ? `${f.step}단계` : '완료';
    const what = document.createElement('p'); what.className = 'questDoneWhat'; what.textContent = f.title;
    const got = document.createElement('ul'); got.className = 'questDoneGot';
    for (const text of [f.reward && `+${fmtPts(f.reward)}`, ...(f.gains || []).map((g) => `${g.name} 호감도 +${g.delta}`)].filter(Boolean)) { const li = document.createElement('li'); li.textContent = text; got.append(li); }
    card.append(stamp, title, what, got);
    const close = () => card.remove(); card.addEventListener('click', close); setTimeout(close, 3600);
    (byId('plazaStage') || document.body).append(card);
  }
  // v1.10.42 낚시: SPACE by the water casts (the server picks the fish and the bite); SPACE again pulls in -- in time it is
  // in the bag (and the 도감), too early or too late it got away. The scene shows the cast, the bite and the catch.
  let fishBusy = false; let fishId = null; let fishSeq = null; // (Codex 검토 #1: the cast's arrows, the server's)
  async function fishAction() {
    if (fishBusy) return;
    const phase = plaza.controller?.fishingNow?.();
    fishBusy = true;
    try {
      if (!phase) {
        const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
        const data = await api('/api/island/fish/start', { method: 'POST', body: '{}' });
        fishId = data.fishId; fishSeq = Array.isArray(data.seq) ? data.seq : null;
        if (data.bait) showToast(`🪱 ${data.bait}를 썼어요.`); // v1.10.92
        if (!plaza.controller?.fishBegin?.(data, () => { fishId = null; fishArrowsEnd(); }, fishArrowsStart)) { fishId = null; api('/api/island/fish/cancel', { method: 'POST', body: '{}' }).catch(() => {}); }
      } else if (phase === 'cast' || phase === 'wait') await pullFish(); // (too early: it got away)
    } catch (error) { showToast(error.message); } finally { fishBusy = false; }
  }
  async function pullFish(presses = []) {
    try {
      const data = await api('/api/island/fish/finish', { method: 'POST', body: JSON.stringify({ fishId, presses }) });
      plaza.controller?.fishResult?.(data.species);
      showToast(`${data.grade === 'big' ? '🎉 대어! ' : ''}🐟 ${data.name} +1${data.firstTime ? ' · 도감 등록' : ''}`);
    } catch (error) { plaza.controller?.fishResult?.(null); showToast(error.message); console.info('fish', error.data?.error); }
  }
  // (문제 기록 3회차 4 「낚시 미니게임: 입질 때 화살표」) at the bite, arrows to press in order (4~12, more the rarer the
  // fish) before the bar runs out: the arrow keys on a PC, the four buttons on a phone; a wrong one shakes the row red and
  // starts it over (「틀렸어요! 처음부터」), the last one pulls it in. Out of time, the scene lets it go (the bite's end).
  const FISH_DIRS = ['up', 'right', 'down', 'left']; const FISH_KEYS = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' };
  const fishArrowsBox = byId('fishArrows'); let fishGame = null;
  function fishArrowsStart(n, ms) {
    // (the server's arrows, the first n of its twelve; every press kept with its time, sent at the pull -- Codex 검토 #1)
    fishGame = { seq: fishSeq?.length >= n ? fishSeq.slice(0, n) : Array.from({ length: n }, () => FISH_DIRS[Math.floor(Math.random() * 4)]), at: 0, presses: [], shownAt: performance.now() };
    const row = fishArrowsBox.querySelector('.fishArrowSeq');
    row.replaceChildren(...fishGame.seq.map((dir) => { const s = document.createElement('span'); s.dataset.dir = dir; return s; }));
    fishArrowsBox.classList.remove('hidden', 'wrong'); fishArrowMark(); // (shown first: a hidden bar runs no transition)
    document.body.classList.add('islandFishing'); // (F 사용자 아이폰 제보: the stick and the phone's buttons sat over the arrows -- out of the way while they show)
    const bar = fishArrowsBox.querySelector('.fishArrowTime i'); bar.style.transition = 'none'; bar.style.width = '100%'; void bar.offsetWidth; bar.style.transition = `width ${ms}ms linear`; bar.style.width = '0%';
  }
  function fishArrowsEnd() { fishGame = null; fishArrowsBox.classList.add('hidden'); document.body.classList.remove('islandFishing'); }
  function fishArrowMark() { [...fishArrowsBox.querySelectorAll('.fishArrowSeq span')].forEach((s, k) => { s.classList.toggle('done', k < fishGame.at); s.classList.toggle('now', k === fishGame.at); }); }
  function fishArrow(dir) {
    if (!fishGame || fishBusy) return;
    fishGame.presses.push({ dir, t: Math.round(performance.now() - fishGame.shownAt) });
    if (fishGame.seq[fishGame.at] !== dir) { // (사용자 지시 10/26: a wrong arrow starts it over -- that press the first again if it is the first one; the server judges the same)
      fishGame.at = dir === fishGame.seq[0] ? 1 : 0; fishArrowMark();
      fishArrowsBox.classList.remove('wrong'); void fishArrowsBox.offsetWidth; fishArrowsBox.classList.add('wrong'); return;
    }
    fishGame.at += 1; fishArrowMark();
    if (fishGame.at === fishGame.seq.length) { const { presses } = fishGame; fishArrowsEnd(); fishBusy = true; pullFish(presses).finally(() => { fishBusy = false; }); }
  }
  window.addEventListener('keydown', (e) => { if (!fishGame || !FISH_KEYS[e.code]) return; e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) fishArrow(FISH_KEYS[e.code]); }, true);
  fishArrowsBox.querySelectorAll('.fishArrowPad button').forEach((b) => b.addEventListener('click', () => fishArrow(b.dataset.dir)));
  // v1.10.42 도감: the bag window's other page -- every find, the ones not found yet as silhouettes
  const DEX_ICON = { herb: 'herb', berry: 'berries', mushroom: 'mushrooms' };
  // v1.10.43: the page `on` is 'dex' (the finds) or 'photo' (기념사진: the photo spots and the day each was taken); false the bag
  async function showDex(on) {
    const grid = document.getElementById('islandBagGrid'); const dex = document.getElementById('islandDexGrid');
    for (const [id, page] of [['islandDexBtn', 'dex'], ['islandPhotoBtn', 'photo']]) document.getElementById(id).classList.toggle('selected', on === page);
    document.getElementById('islandBagTitle').textContent = on === 'dex' ? '도감' : on === 'photo' ? '기념사진' : '가방';
    grid.classList.toggle('hidden', Boolean(on)); dex.classList.toggle('hidden', !on);
    if (!on) return;
    try {
      const data = await api('/api/island/dex');
      const list = data.entries.filter((e) => (on === 'photo' ? e.kind === 'photo' : !e.keepsake));
      const spots = list.filter((e) => !e.keepsake); // v1.10.60: the count is of the photo spots; a story keepsake shows on the page but is not one of them
      document.getElementById('islandBagCount').textContent = on === 'photo' ? `${spots.filter((e) => e.count).length}/${spots.length}` : `${data.found}/${data.total}`;
      dex.replaceChildren(...list.map((e) => {
        if (e.kind === 'photo') {
          const cell = document.createElement('div'); cell.className = `islandDexCell islandPhotoCell${e.count ? '' : ' unfound'}`; cell.setAttribute('role', 'listitem');
          const icon = document.createElement('img'); icon.src = `/assets/dex/${e.icon || e.id}.png`; icon.alt = ''; icon.width = 64; icon.height = 64;
          const name = document.createElement('span'); name.textContent = e.count ? e.name : '???';
          const day = document.createElement('small'); day.textContent = e.first ? new Date(e.first).toLocaleDateString('ko-KR') : '';
          cell.append(icon, name, day); return cell;
        }
        const cell = document.createElement('div'); cell.className = `islandDexCell${e.count ? '' : ' unfound'}`; cell.setAttribute('role', 'listitem');
        const img = document.createElement('img'); img.src = e.kind === 'insect' ? `/assets/dex/${e.id}.svg` : `/assets/dex/${DEX_ICON[e.id] || e.id}.png`; // (B 47: the insects' drawn icons) img.alt = ''; img.width = 64; img.height = 64;
        const name = document.createElement('span'); name.textContent = e.count ? e.name : '???';
        const n = document.createElement('small'); n.textContent = e.count ? `×${e.count}` : '';
        cell.append(img, name, n); return cell;
      }));
    } catch (error) { showToast(error.message); }
  }
  // v1.10.43 기념사진: 「사진」 (or P) -- the island without name tags or the page around it; 「촬영」 counts three while my
  // character poses, saves the picture as a PNG on this PC and, by a photo spot, keeps the spot in the 기념사진 page
  const photoBar = document.getElementById('photoBar'); const photoCount = document.getElementById('photoCount');
  let photoShot = null;
  function cancelPhotoShot() {
    const shot = photoShot; photoShot = null;
    if (shot) { clearTimeout(shot.timer); shot.wake?.(false); shot.abort.abort(); if (!shot.now) shot.controller.photoPose?.(false); } // an instant shot never touched the motion
    photoCount.classList.add('hidden');
  }
  function enterPhoto() {
    if (!plaza.controller?.setPhotoMode?.(true, () => { cancelPhotoShot(); document.body.classList.remove('photoMode'); photoBar.classList.add('hidden'); })) return;
    document.body.classList.add('photoMode'); photoBar.classList.remove('hidden'); plazaStage.focus({ preventScroll: true });
  }
  const leavePhoto = () => plaza.controller?.setPhotoMode?.(false);
  // v1.10.81 기념사진 2버튼 (IDEAS #future-photo-action, 사용자 확정 2026-10-08): 「즉시 촬영」 takes the frame as it is now --
  // the pose, the place, what is in hand, mid-pull or mid-cast -- with no countdown and nothing stopped or moved;
  // 「포즈 촬영」 is the 3-2-1 self-timer with PhotoPose as before, held back while an action of mine is under way (pulling,
  // fishing, seated, on the train) so it never cuts into one. Both save the PNG and keep the photo spot the same way.
  async function takePhoto({ now = false } = {}) {
    if (photoShot || !document.body.classList.contains('photoMode')) return;
    if (!now && plaza.controller?.actionBusy?.()) { showToast('하던 행동이 끝나면 포즈 촬영할 수 있어요. 지금 모습은 「즉시 촬영」으로 찍어 보세요.', 4000); return; }
    const shot = { controller: plaza.controller, token: sessionToken, abort: new AbortController(), timer: null, wake: null, now };
    photoShot = shot;
    const current = () => photoShot === shot && plaza.controller === shot.controller && sessionToken === shot.token && document.body.classList.contains('photoMode');
    try {
      if (!now) shot.controller.photoPose?.();
      for (const n of now ? [] : [3, 2, 1]) {
        if (!current()) return;
        photoCount.textContent = String(n); photoCount.classList.remove('hidden');
        const waited = await new Promise((resolve) => { shot.wake = resolve; shot.timer = setTimeout(() => { shot.wake = null; resolve(true); }, 1000); });
        if (!waited || !current()) return;
      }
      photoCount.classList.add('hidden');
      const blob = await shot.controller.capture?.();
      if (!current()) return;
      if (!now) shot.controller.photoPose?.(false);
      if (blob) {
        const a = document.createElement('a'); const d = new Date(); const pad = (n) => String(n).padStart(2, '0');
        a.download = `game-island-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
        a.href = URL.createObjectURL(blob); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000);
      }
      const p = shot.controller.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p), signal: shot.abort.signal }).catch(() => {});
      if (!current()) return;
      const data = await api('/api/island/photo', { method: 'POST', body: '{}', signal: shot.abort.signal }).catch(() => null);
      if (!current()) return;
      showToast(data?.spot ? `📷 ${data.spot.name}${data.first ? ' · 기념사진 기록' : ''}` : '📷 저장했습니다');
    } finally { if (photoShot === shot) { photoShot = null; photoCount.classList.add('hidden'); if (!now) shot.controller.photoPose?.(false); } }
  }
  document.getElementById('islandPhotoTab').addEventListener('click', () => enterPhoto());
  document.getElementById('photoShootBtn').addEventListener('click', () => takePhoto());
  document.getElementById('photoNowBtn').addEventListener('click', () => takePhoto({ now: true }));
  document.getElementById('photoCloseBtn').addEventListener('click', () => leavePhoto());
  window.addEventListener('keydown', (event) => {
    if (!document.body.classList.contains('plazaMode') || event.isComposing || event.repeat) return;
    if (event.code === 'Escape' && document.body.classList.contains('photoMode')) { event.preventDefault(); leavePhoto(); return; }
    if (event.code !== 'KeyP' || document.querySelector('dialog[open]') || (event.target !== document.body && event.target !== plazaStage)) return;
    event.preventDefault(); if (document.body.classList.contains('photoMode')) leavePhoto(); else enterPhoto();
  });
  // v1.10.44 앉기: the server says the seat is mine, then I sit (an arrow key stands me up)
  // v1.10.47 관광열차: SPACE by a stop gets on the train standing there (the server checks the stop, the train and a free
  // seat); on board, SPACE at a stop gets off there. A plain hint (the next train's time) does nothing.
  async function trainPlatform(stop, line) {
    if (!plaza.controller?.platform?.() && !plaza.controller?.canInteract?.(`train:enter:${stop}`)) return;
    try { const r = await api('/api/island/train/platform', { method: 'POST', body: JSON.stringify({ stop, line }) }); plaza.controller?.setPlatform?.({ ...r, stop }); }
    catch (error) { showToast(error.message); }
  }
  function trainMenu(stop) {
    const R = globalThis.IslandTrain; const current = plaza.controller?.platform?.();
    const button = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'primary'; b.textContent = label; b.onclick = () => { plazaDialog.addEventListener('close', fn, { once: true }); plazaDialog.close(); }; return b; };
    const choices = Object.entries(R.LINES).filter(([line, L]) => L.order.includes(stop) && line !== current?.line).map(([line, L]) => button(L.name, () => trainPlatform(stop, line)));
    if (current) {
      const boarding = button('타기', () => trainAction('board'));
      const refresh = () => { boarding.disabled = !(plaza.controller?.trainDocked?.(stop) || []).some((d) => d.line === current.line); };
      refresh(); const timer = setInterval(refresh, 200);
      plazaDialog.addEventListener('close', () => clearInterval(timer), { once: true }); choices.unshift(boarding);
    }
    if (current) choices.push(button('내려가기', () => trainPlatform(stop, 'ground')));
    lostCard.replaceChildren(...choices); lostCard.classList.remove('hidden'); openPlazaWindow(R.STATIONS[stop].name, [lostCard]);
  }
  async function trainAction(what) {
    if (plaza.controller?.debug?.().train?.().lifting) return;
    if (what === 'platform' ? !plaza.controller?.platform?.() : what !== 'board' && !plaza.controller?.canInteract?.(`train:${what}`)) return;
    try {
      if (what === 'ride') { const r = await api('/api/island/train/alight', { method: 'POST', body: '{}' }); plaza.controller?.alight?.(r); return; }
      if (what === 'platform') { trainMenu(plaza.controller?.platform?.().station); return; }
      if (what.startsWith('enter:')) {
        const stop = what.slice(6); const lines = Object.entries(globalThis.IslandTrain.LINES).filter(([, L]) => L.order.includes(stop));
        const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) });
        if (lines.length === 1) await trainPlatform(stop, lines[0][0]); else trainMenu(stop); return;
      }
      const platform = plaza.controller?.platform?.(); if (!platform) return;
      const r = await api('/api/island/train/board', { method: 'POST', body: JSON.stringify({ stop: platform.station, line: platform.line }) }); plaza.controller?.board?.(r.train, r.seat);
    } catch (error) { showToast(error.message); }
  }
  // A-7 민원실 창구 (사용자 2026-10-19): a window's business opens seated in its customer's chair, the camera on the clerk;
  // closing the window stands me up (and standing up closes it)
  let counterSeat = null; // { door, dialog } while seated at a window
  const COUNTER_OPEN = { 'room:desk': () => openIslandPlace('office'), 'room:tax': () => openTax(), 'room:bank': () => openBank(), 'room:rename': () => openNaming() }; // (달마루섬 5단계: 개명 신청 = the 작명소)
  const counterDialogs = { 'room:desk': islandPlaceDialog, 'room:tax': taxDialog, 'room:bank': bankDialog, 'room:rename': document.getElementById('namingDialog') };
  // (창 3단계: the clerk's words in a speech bubble over the window's paper, its 접수 stamp box by the title)
  const COUNTER_SAY = { 'room:desk': '어서 오세요. 주운 물건은 여기서 정산해 드려요.', 'room:tax': '세금 창구예요. 우체통으로 간 고지서는 여기서 내시면 돼요.', 'room:bank': '예금 창구예요. 맡기시면 매일 자정에 이자가 붙어요.', 'room:rename': '개명 신청이요? 새 이름을 적어 주세요.' };
  for (const [door, dialog] of Object.entries(counterDialogs)) dialog.addEventListener('close', () => { dialog.classList.remove('counterMode'); dialog.querySelector('.counterSay')?.remove(); if (counterSeat?.door === door && !dialog.open) { counterSeat = null; plaza.controller?.talkCamera?.(false); plaza.controller?.standUp?.(); } });
  async function sitDown(seat) {
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      await api('/api/island/sit', { method: 'POST', body: JSON.stringify({ seat }) });
      plaza.controller?.sit?.(seat);
      const door = globalThis.IslandTerrain?.plazaProps().seats.find((x) => x.id === seat)?.door;
      if (door && COUNTER_OPEN[door]) {
        await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(plaza.controller?.pose?.()) }).catch(() => {}); // (seated: where the server checks the counter)
        counterSeat = { door }; plaza.controller?.counterCamera?.(door);
        const dialog = counterDialogs[door]; const say = document.createElement('p'); say.className = 'counterSay'; say.textContent = COUNTER_SAY[door];
        dialog.querySelector('.counterSay')?.remove(); dialog.querySelector('.recordsDialogHead').after(say); dialog.classList.add('counterMode');
        await COUNTER_OPEN[door]();
      }
    } catch (error) { for (const d of Object.values(counterDialogs)) if (!d.open) { d.classList.remove('counterMode'); d.querySelector('.counterSay')?.remove(); } showToast(error.message); }
  }
  // v1.10.44 다른 사람에게 SPACE: 인사 · 환호 · 게임 초대 (the game hall's room window, then the invite to them)
  let islandInviteTo = null;
  function openPlayerMenu(plazaId) {
    const who = plaza.controller?.debug?.().others?.find((o) => o.id === plazaId);
    const make = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.addEventListener('click', () => { plazaDialog.addEventListener('close', () => fn(), { once: true }); plazaDialog.close(); }); return b; }; // after the window has closed (it puts its sections back then)
    lostCard.replaceChildren(make('인사', 'primary', () => plaza.controller?.emote?.('bow')), make('환호', 'ghost', () => plaza.controller?.emote?.('cheer')),
      make('게임 초대', 'secondary', async () => {
        try {
          if (!plaza.controller?.canInteract?.(`player:${plazaId}`)) throw new Error('가까이 가서 다시 시도해 주세요.');
          await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(plaza.controller.pose()) });
          await api('/api/island/invite/prepare', { method: 'POST', body: JSON.stringify({ plazaId }) });
          islandInviteTo = { id: plazaId, at: Date.now() }; PLAZA_FACILITIES.find((f) => f.id === 'games')?.open();
        } catch (error) { showToast(error.message); }
      }),
      make('선물하기', 'ghost', () => openGift(plazaId, who?.name || '상대')),
      make('친구 신청', 'ghost', async () => { try { const r = await api('/api/friends/request', { method: 'POST', body: JSON.stringify({ to: plazaId }) }); showToast(r.friends ? '친구가 되었어요!' : '친구 신청을 보냈어요'); } catch (error) { showToast(error.message, 4000); } })); // 묶음 4 친구 // v1.10.92 선물 포장지
    if (plazaPlayers.find((p) => p.id === plazaId)?.title === '생일 주인공') lostCard.prepend(make('🎉 생일 축하하기', 'primary', async () => { // B 47: once a day each
      try { await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(plaza.controller.pose()) }).catch(() => {}); const d = await api('/api/island/birthday/cheer', { method: 'POST', body: JSON.stringify({ plazaId }) }); plaza.controller?.emote?.('clap'); showToast(`축하했어요! (올해 ${d.count}명이 축하)`); } catch (error) { showToast(error.message); }
    }));
    openTalk(who?.name || '');
  }
  // v1.10.92 선물: what of my bag can be given (not a lost thing, not the wrap itself), one tap gives one
  async function openGift(plazaId, name) {
    try {
      const bag = await api('/api/island/bag'); const wraps = bag.items.filter((e) => e.itemId === 'gift_wrap').reduce((n, e) => n + e.qty, 0);
      const head = document.createElement('p'); head.className = 'lostRequestLine'; head.textContent = wraps ? `${name}님에게 무엇을 선물할까요? (포장지 ${wraps}장)` : '선물 포장지가 필요해요. 잡화점에서 살 수 있어요.';
      const list = document.createElement('div'); list.className = 'giftList';
      if (wraps) for (const item of bag.items.filter((e) => !['lost', 'wallet', 'gift_wrap'].includes(e.itemId))) { const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost'; b.append(itemIcon(item), ` ${item.name} ×${item.qty}`);
        b.addEventListener('click', async () => { try { const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {}); await api('/api/island/gift', { method: 'POST', body: JSON.stringify({ plazaId, itemId: item.itemId, requestId: crypto.randomUUID() }) }); plazaDialog.close(); showToast(`🎁 ${name}님에게 ${item.name}을(를) 선물했어요.`); plaza.controller?.emote?.('bow'); } catch (error) { showToast(error.message, 4000); } });
        list.append(b); }
      const close = document.createElement('button'); close.type = 'button'; close.className = 'primary'; close.textContent = '닫기'; close.addEventListener('click', () => plazaDialog.close());
      lostCard.replaceChildren(head, list, close); openTalk(name);
    } catch (error) { showToast(error.message); }
  }
  // B 47 처음 온 사람 안내 (사용자 2026-10-18: 첫 접속이면 무조건, 끝난 뒤에도 광장 한쪽 안내 주민이 말 걸면 가르쳐 줌): a big
  // line over the island for the step, the arrow toward its place, each step marked done where it happens in the game
  const touchNow = () => document.body.classList.contains('touchIsland');
  const GUIDE = {
    move: { title: '걸어 보기', pc: '방향키(←↑↓→)를 눌러 걸어 보세요.', phone: '왼쪽 아래 조이스틱을 밀어서 걸어 보세요.' },
    camera: { title: '화면 돌려 보기', pc: 'A·D 키(또는 마우스로 화면 끌기)로 화면을 돌려 보세요. W·S는 위아래로 봐요. Q는 가까이, E는 멀리 봐요(마우스 휠과 같아요).', phone: '조이스틱이 아닌 빈 화면을 손가락으로 끌어서 돌려 보세요.' },
    talk: { title: '주민에게 말 걸기', pc: '화살표를 따라 광장의 안내 주민이나 걸어 다니는 주민 가까이 가서 Space를 누르세요.', phone: '주민 가까이 가서 오른쪽 아래 행동 버튼을 누르세요.' },
    weed: { title: '잡초 하나 뽑기', pc: '풀숲의 잡초 가까이 가서 Space를 1초쯤 누르고 있으세요.', phone: '잡초 가까이 가서 행동 버튼을 1초쯤 누르고 있으세요.' },
    deliver: { title: '관공서에 납품하기', pc: '화살표를 따라 관공서에 들어가 민원 창구에서 잡초를 납품하세요. 포인트를 받아요.', phone: '화살표를 따라 관공서 민원 창구에서 잡초를 납품하세요. 포인트를 받아요.' },
    games: { title: '게임관 들어가 보기', pc: '화살표를 따라 게임관 앞에서 Space를 눌러 들어가 보세요.', phone: '화살표를 따라 게임관 앞에서 행동 버튼을 눌러 보세요.' },
    menu: { title: '메뉴 열어 보기', pc: 'Esc 키를 누르면 메뉴가 열려요. 테마·전체 화면·접속 종료가 여기 있어요.', phone: '왼쪽 위 ☰ 버튼을 누르면 메뉴가 열려요.' },
  };
  let guideNow = null; let guideWatch = null;
  const guidePanel = document.createElement('div'); guidePanel.id = 'guidePanel'; guidePanel.className = 'guidePanel hidden'; guidePanel.setAttribute('role', 'status'); document.body.append(guidePanel);
  function guideTargetOf(kind) {
    const T = globalThis.IslandTerrain; if (!T) return null;
    if (kind === 'talk') return T.VILLAGE.guide; if (kind === 'deliver') return T.facilityDoor('townhall'); if (kind === 'games') return T.facilityDoor('games');
    return null;
  }
  function showGuide(d) {
    guideNow = d && d.active ? d : null; clearInterval(guideWatch);
    const kind = guideNow?.steps[guideNow.step]; plaza.controller?.setGuideTarget?.(kind ? guideTargetOf(kind) : null);
    guidePanel.classList.toggle('hidden', !kind); if (!kind) return;
    const g = GUIDE[kind]; const el = (tag, cls, text) => { const n = document.createElement(tag); n.className = cls; n.textContent = text; return n; };
    guidePanel.replaceChildren(el('span', 'guideStep', `안내 ${guideNow.step + 1}/${guideNow.steps.length}`), el('strong', 'guideTitle', g.title), el('span', 'guideText', touchNow() ? g.phone : g.pc));
    if (kind === 'move' || kind === 'camera') { // watched here (the island knows where I am and how the view turned)
      const D = () => plaza.controller?.debug?.(); const start = D(); if (!start) return;
      guideWatch = setInterval(() => { const n = D(); if (!n) return; if (kind === 'move' ? Math.hypot(n.x - start.x, n.z - start.z) > 3 : Math.abs((n.camYaw ?? 0) - (start.camYaw ?? 0)) > 0.6) guideDone(kind); }, 500);
    }
  }
  function refreshGuide(body = null) {
    return api('/api/island/guide', body ? { method: 'POST', body: JSON.stringify(body) } : {}).then((d) => {
      showGuide(d);
      if (d.gift) showToast(`🎉 안내를 모두 마쳤어요! 환영 선물 +${Number(d.gift).toLocaleString('ko-KR')}P`, 7000);
      else if (d.done && body?.done) showToast('🎉 안내를 모두 마쳤어요!', 5000);
      return d;
    }).catch(() => null);
  }
  function guideDone(kind) { if (guideNow && guideNow.steps[guideNow.step] === kind) { guideNow = null; clearInterval(guideWatch); refreshGuide({ done: kind }); } }
  // talking to her: what each step is again, or the whole guide from the start
  function talkGuide() {
    guideDone('talk');
    const line = document.createElement('p'); line.className = 'lostRequestLine'; line.textContent = '「어서 와요! 궁금한 걸 골라 보세요. 처음부터 같이 해 봐도 좋아요.」';
    const list = document.createElement('div'); list.className = 'guideTopics';
    for (const [kind, g] of Object.entries(GUIDE)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost'; b.textContent = g.title;
      b.addEventListener('click', () => { line.textContent = `「${touchNow() ? g.phone : g.pc}」`; });
      list.append(b);
    }
    const again = document.createElement('button'); again.type = 'button'; again.className = 'primary'; again.textContent = '처음부터 다시 배우기';
    again.addEventListener('click', () => { plazaDialog.close(); refreshGuide({ restart: true }); });
    const close = document.createElement('button'); close.type = 'button'; close.className = 'ghost'; close.textContent = '닫기'; close.addEventListener('click', () => plazaDialog.close());
    lostCard.replaceChildren(line, list, again, close); openTalk('안내 주민');
  }
  // B 47 생일: today's names on the plaza's corner, my birthday's gift (once a year), my birthday in 내 정보
  let birthdayMine = null; let birthdaySeq = 0; // (a pushed change wins over a slower read)
  function refreshBirthday() {
    const seq = birthdaySeq;
    return api('/api/island/birthday').then((d) => {
      birthdayMine = d.mine; if (seq === birthdaySeq) plaza.controller?.setBirthdays?.(d.today.map((t) => t.name)); showBirthdayForm();
      if (d.gift) showToast(`🎂 생일 축하해요! 생일 선물 +${Number(d.gift).toLocaleString('ko-KR')}P · 오늘 하루 「생일 주인공」`, 7000);
    }).catch(() => {});
  }
  function showBirthdayForm() {
    const m = birthdayMine; if (!m) return;
    byId('birthdayMonth').value = m.month || ''; byId('birthdayDay').value = m.day || ''; byId('birthdayHidden').checked = Boolean(m.hidden);
    byId('birthdayStatus').textContent = m.month ? (m.cheers ? `올해 ${m.cheers}명이 축하해 줬어요.` : '') : '생일을 넣으면 그날 광장에 장식이 서고 친구들이 축하할 수 있어요.';
  }
  byId('birthdayForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await api('/api/island/birthday', { method: 'POST', body: JSON.stringify({ month: Number(byId('birthdayMonth').value), day: Number(byId('birthdayDay').value), hidden: byId('birthdayHidden').checked }) }); byId('birthdayStatus').textContent = '저장했어요.'; refreshBirthday(); } catch (error) { byId('birthdayStatus').textContent = error.message; }
  });
  byId('adminBirthdayForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await api('/api/admin/birthday', { method: 'POST', body: JSON.stringify({ label: byId('adminBirthdayName').value, month: Number(byId('adminBirthdayMonth').value), day: Number(byId('adminBirthdayDay').value) }) }); showToast('생일을 넣었어요.'); } catch (error) { showToast(error.message, 4000); }
  });
  // B 47 우체통: letters for me (30 days), a new one to anyone (200 characters; a parcel is one thing of my bag and a gift wrap)
  let mailUnread = 0;
  function refreshMail(notice = false) {
    return api('/api/island/mail').then((d) => { if (notice && d.unread && d.unread !== mailUnread) showToast(`✉️ 읽지 않은 편지가 ${d.unread}통 있어요 · 광장 동쪽 우체통에서 열어 보세요`, 6000); mailUnread = d.unread; return d; }).catch(() => null);
  }
  // B 47 박물관: what is on show with its giver, and my fish and insects that are not yet (one tap gives one)
  async function openMuseum() {
    try {
      const [d, bag] = await Promise.all([api('/api/island/museum'), api('/api/island/bag')]);
      const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
      const box = el('div', 'mailBox');
      const mine = bag.items.filter((e) => d.exhibits.some((x) => x.id === e.itemId && !x.by));
      const give = el('div', 'guideTopics');
      if (!mine.length) give.append(el('p', 'smallMuted', '아직 전시되지 않은 물고기·곤충이 가방에 없어요.'));
      for (const e of mine) { const b = el('button', 'ghost', `🎁 ${e.name}`); b.type = 'button'; b.addEventListener('click', async () => { try { const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {}); await api('/api/island/museum/donate', { method: 'POST', body: JSON.stringify({ itemId: e.itemId }) }); showToast(`${e.name}을(를) 기증했어요. 박물관에 이름이 남아요!`); openMuseum(); } catch (error) { showToast(error.message); } }); give.append(b); }
      const list = el('div', 'museumList'); list.setAttribute('role', 'list');
      for (const x of d.exhibits) { const row = el('div', `museumItem${x.by ? '' : ' empty'}`); row.setAttribute('role', 'listitem'); row.append(el('span', '', x.by ? x.name : '???'), el('small', 'smallMuted', x.by ? `${x.by}님 기증` : '빈 자리')); list.append(row); }
      box.append(el('h3', '', `전시 ${d.shown}/${d.total}`), el('p', 'smallMuted', '물고기와 곤충을 종류마다 한 번 기증하면 섬 모두의 전시가 되고, 처음 기증한 사람의 이름이 남아요.'), el('h3', '', '기증하기'), give, el('h3', '', '전시 목록'), list);
      openPlazaWindow('섬 박물관', [box]);
    } catch (error) { showToast(error.message); }
  }
  async function openMailbox(replyTo = null) {
    const d = await refreshMail(); if (!d) { showToast('우체통을 열지 못했어요.'); return; }
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const box = el('div', 'mailBox');
    const list = el('div', 'mailList'); list.setAttribute('role', 'list');
    if (!d.letters.length) list.append(el('p', 'smallMuted', '받은 편지가 없어요.'));
    for (const l of d.letters) {
      const row = el('div', `mailLetter${l.read ? '' : ' unread'}`); row.setAttribute('role', 'listitem');
      const islander = String(l.from || '').startsWith('resident:'); // (R3 ⑥: an islander's letter -- their name as it is, a neighbour)
      const office = l.from === 'office'; // (주민세 고지서: from the 관공서, its own stamp, no reply)
      const head = el('div', 'mailHead'); const who = el('strong', '', islander || office ? l.fromName : `${l.fromName}님`); if (islander) who.append(el('span', 'smallMuted', ' · 주민'));
      { const stamp = el('span', `mailStamp${office ? ' office' : ''}`, office ? '관공서' : islander ? '주민' : '섬'); stamp.setAttribute('aria-hidden', 'true'); const c = office ? '#8f2f24' : islander && globalThis.IslandCast?.WALKERS[Number(String(l.from).slice(9))]?.tagColor; if (c) stamp.style.setProperty('--stamp', c); row.append(stamp); } // (창 2단계: a stamp in the islander's own colour)
      head.append(who, el('span', 'smallMuted', new Date(l.at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })));
      row.append(head, el('p', 'mailText', l.text));
      if (l.itemId) row.append(el('p', 'smallMuted', `🎁 함께 온 선물: ${l.itemName || "선물"} (가방에 들어 있어요)`));
      if (l.skinId) row.append(el('p', 'smallMuted', `🎁 선물받은 스킨: ${l.skinName || '스킨'} (내 정보에서 입을 수 있어요)`)); // 3-1 스킨 선물
      const reply = el('button', 'ghost tiny', '답장'); reply.type = 'button'; reply.hidden = islander || office; /* (answered by talking to them; a bill at the window) */ reply.addEventListener('click', () => { const pick = d.people.find((p) => p.label === l.fromName); if (pick) { to.value = pick.id; text.focus(); } });
      row.append(reply);
      if (!l.read) api('/api/island/mail/read', { method: 'POST', body: JSON.stringify({ id: l.id }) }).catch(() => {});
      list.append(row);
    }
    const form = el('form', 'mailForm');
    const to = el('select'); to.setAttribute('aria-label', '받는 사람'); to.append(new Option('받는 사람', ''), ...d.people.map((p) => new Option(p.label, p.id))); if (replyTo) to.value = replyTo;
    const text = el('textarea'); text.maxLength = d.max; text.rows = 3; text.placeholder = `편지 (${d.max}자까지)`; text.setAttribute('aria-label', '편지 내용');
    const bag = await api('/api/island/bag').catch(() => ({ items: [] })); const wraps = bag.items.filter((e) => e.itemId === 'gift_wrap').reduce((n, e) => n + e.qty, 0);
    const item = el('select'); item.setAttribute('aria-label', '함께 보낼 선물');
    item.append(new Option(wraps ? `선물 없이 (포장지 ${wraps}장)` : '선물 없이 (선물은 포장지가 있어야 해요)', ''));
    if (wraps) for (const e of bag.items.filter((x) => !['lost', 'wallet', 'gift_wrap'].includes(x.itemId))) item.append(new Option(`🎁 ${e.name} ×${e.qty}`, e.itemId));
    const send = el('button', 'primary', `보내기 (오늘 ${d.left}통 남음)`); send.type = 'submit'; send.disabled = d.left <= 0;
    const status = el('p', 'smallMuted'); status.setAttribute('role', 'status');
    form.append(to, text, item, send, status);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (!to.value) { status.textContent = '받는 사람을 골라 주세요.'; return; }
      send.disabled = true;
      try {
        const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
        const r = await api('/api/island/mail/send', { method: 'POST', body: JSON.stringify({ to: to.value, text: text.value, itemId: item.value || null, requestId: crypto.randomUUID() }) });
        showToast(`${r.to}님에게 편지를 보냈어요.`); plazaDialog.close();
      } catch (error) { status.textContent = error.message; send.disabled = false; }
    });
    box.append(el('h3', '', `받은 편지${d.unread ? ` (새 편지 ${d.unread})` : ''}`), list, el('h3', '', '편지 쓰기'), form);
    openPlazaWindow('우체통', [box]); plazaDialog.classList.add('mailMode'); // (창 2단계: letter paper)
    mailUnread = 0;
  }
  async function sendIslandInvite() {
    const to = islandInviteTo; islandInviteTo = null;
    if (!to || Date.now() - to.at > 5 * 60 * 1000) return;
    try { const data = await api('/api/island/invite', { method: 'POST', body: JSON.stringify({ plazaId: to.id }) }); showToast(`${data.to || '상대'}님에게 대전 초대를 보냈습니다.`); } catch (error) { showToast(error.message, 4200); }
  }
  // v1.10.41 관공서 정문 시장: one formal line and one button; his leave lasts this visit (the server keeps it)
  function openMayor() {
    const line = document.createElement('p'); line.className = 'lostRequestLine'; line.textContent = `「${plaza.controller?.mayorLine?.() || '무슨 용무로 오셨소?'}」`;
    const ok = document.createElement('button'); ok.type = 'button'; ok.className = 'primary'; ok.textContent = '용무가 있습니다';
    ok.addEventListener('click', async () => {
      ok.disabled = true;
      try {
        const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
        const data = await api('/api/island/mayor', { method: 'POST', body: '{}' });
        plaza.controller?.setTownhallPass?.(Boolean(data.townhallPass)); plazaDialog.close();
      } catch (error) { showToast(error.message); ok.disabled = false; }
    });
    lostCard.replaceChildren(line, ok);
    openTalk('시장');
  }
  const questTracker = document.getElementById('questTracker');
  let questTrack = []; let errandTrack = []; // v1.10.91: the day's errands under way share the tracker
  // (Q 할 일 카드, docs/quest-accept-complete-20261026.md ②) what I am doing, on paper, three at most: who asked, the thing
  // to do and how far (0/1); the moment a story's step is done its line turns ✓ 「○○에게 돌아가 말해요」 (and a short note);
  // a line pressed opens it -- its thing to do and 「그만둘래요」 (asked once more)
  // (C4 P3-6: with an errand under way a story gives it one of the three lines)
  let questReady = null; let questOpen = null; // (null: not read yet -- what is ready when I come in is no news)
  function showQuestTracker(list = questTrack) {
    questTrack = list;
    const items = [...list.slice(0, errandTrack.length ? 2 : 3).map((t) => ({ key: `q:${t.story}`, who: t.name, text: t.ready ? '✓ 돌아가 말해요' : t.label, /* (the name is the line's own column) */ count: t.need > 1 && !t.ready ? `${t.count}/${t.need}` : t.ready ? '' : '0/1', ready: t.ready, drop: { story: t.story } })),
      ...errandTrack.map((e) => ({ key: `e:${e.id}`, who: '심부름', text: e.label, count: '', ready: false, drop: { id: e.id }, title: e.title }))].slice(0, 3);
    if (questReady) for (const t of list) if (t.ready && !questReady.has(t.story)) showToast(`✓ ${t.name}에게 돌아가 말해요`, 4000);
    questReady = new Set(list.filter((t) => t.ready).map((t) => t.story));
    questTracker.replaceChildren(...items.map((it) => {
      const line = document.createElement('button'); line.type = 'button'; line.className = `questLine${it.ready ? ' ready' : ''}`; line.dataset.key = it.key;
      const who = document.createElement('b'); who.textContent = it.who; const what = document.createElement('span'); what.textContent = it.text; line.append(who, what);
      if (it.count) { const c = document.createElement('small'); c.textContent = it.count; line.append(c); }
      line.addEventListener('click', () => { questOpen = questOpen === it.key ? null : it.key; showQuestTracker(); });
      if (questOpen !== it.key) return line;
      const box = document.createElement('div'); box.className = 'questLineOpen'; box.append(line);
      const stop = document.createElement('button'); stop.type = 'button'; stop.className = 'ghost tiny'; stop.textContent = '그만둘래요';
      stop.addEventListener('click', async () => {
        if (!confirm(`「${it.title || it.text}」 그만둘까요? 다시 말을 걸면 또 부탁해요.`)) return;
        try {
          if (it.drop.story) { const r = await api('/api/island/quest/drop', { method: 'POST', body: JSON.stringify(it.drop) }); showIslandEvents(r.events || islandEventsNear); questOpen = null; showQuestTracker(r.track || []); }
          else { questOpen = null; showErrands(await api('/api/island/errand/drop', { method: 'POST', body: JSON.stringify(it.drop) })); }
        } catch (error) { showToast(error.message); }
      });
      box.append(stop); return box;
    }));
    questTracker.classList.toggle('hidden', !items.length);
  }
  // v1.10.91 주민 대화·심부름: any islander standing by me talks -- their own words, or the day's errand (asked, a thing
  // brought, someone found); the stars over their heads and the tracker follow the server's view
  function showErrands(view) {
    if (!view) return;
    plaza.controller?.setResidentMarks?.(view.marks || {}); errandTrack = view.track || []; showQuestTracker();
  }
  function refreshErrands() { if (document.body.classList.contains('plazaMode')) api('/api/island/errands').then(showErrands).catch(() => {}); }
  setInterval(refreshErrands, 20000);
  // A-6 주민 대화 (docs/residents-talk-hills-20261018.md 1·2): whoever walks by talks; the server holds them on every screen
  // while this window is open (renewed every few seconds, let go when it closes), and after their words come the choices
  let residentBusy = false; let residentTalk = null; // { n, timer } while a talk is open
  // (대화창 새 단장: four at most -- 「이야기해요」 opens the talk topics in the same bubble; only what can be done today)
  const TALK_CHOICES = [['talk', '이야기해요'], ['errand', '부탁할 거 있어요?'], ['gift', '선물해요'], ['bye', '잘 가요']]; // (R2 ④ 오늘의 이야기 · R3 ⑥ 선물)
  const TALK_TOPICS = [['how', '요즘 어때요?'], ['rumor', '섬 소문 있어요?'], ['ask', '이야기 나눠요'], ['back', '← 돌아가기']];
  const talkToday = (list, today) => list.filter(([topic]) => !today || !((topic === 'errand' && !today.errand) || (topic === 'gift' && today.gifted) || (topic === 'ask' && today.asked)));
  // R2: my 호감도 with each islander (their greeting as I pass by -- the scene), again after each talk
  async function refreshAffinity() { try { const d = await api('/api/island/affinity'); plaza.controller?.setAffinity?.(d.residents); } catch {} }
  // (CI 2026-10-27: a talk again straight after -- the bye and the new talk went together; the server taking the bye second
  // let the new talk go, its keep then 409 and the window shut. The next talk waits for the bye)
  let residentBye = null;
  function endResidentTalk() {
    const t = residentTalk; residentTalk = null; if (!t) return;
    clearInterval(t.timer);
    residentBye = api('/api/island/resident/bye', { method: 'POST', body: JSON.stringify({ n: t.n }) }).then((d) => plaza.controller?.setResidents?.(d.residents)).catch(() => {});
  }
  plazaDialog.addEventListener('close', () => { if (!plazaDialog.open) endResidentTalk(); });
  function showResidentTalk(data, first) {
    showErrands(data);
    const lines = data.say.map((s) => { const line = document.createElement('p'); line.className = 'lostRequestLine'; line.textContent = `「${s}」`; return line; });
    const meta = document.createElement('p'); meta.className = 'lookMeta talkMeta'; const hearts = data.affinity ? `${data.affinity.name} ` : ''; // v1.10.91 호감도 (대화창 새 단장: a small line of its own)
    meta.textContent = data.reward ? `+${Number(data.reward).toLocaleString('ko-KR')}P · 심부름 완료${hearts ? ` · ${hearts}` : ''}` : `${data.role}${hearts ? ` · ${hearts}` : ''}`;
    if (data.affinity) { const h = document.createElement('span'); h.className = 'talkHearts'; h.textContent = '♥'.repeat(data.affinity.level + 1); meta.append(h); }
    const list = document.createElement('div'); list.className = 'talkChoices';
    const fill = (choices) => list.replaceChildren(...choices.map(([topic, label, choice]) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.topic = topic; b.textContent = label; if (choice != null) b.dataset.choice = choice;
      b.addEventListener('click', () => (topic === 'bye' ? plazaDialog.close() : topic === 'talk' ? (fill(talkToday(TALK_TOPICS, data.today)), list.querySelector('button')?.focus()) : topic === 'back' ? (fill(talkToday(TALK_CHOICES, data.today)), list.querySelector('button')?.focus()) : askResident(data.n, topic, choice)));
      return b;
    }));
    // (R2 ④) their question of the day: three answers in place of the usual choices; (R3 ⑥) what I could give them;
    // (Q 부탁 받기) an errand asked: its note and 「할게요!」 / 「다음에요」
    fill(data.offer ? [['accept', '할게요!', data.offer.id], ['decline', '다음에요']] : data.question ? data.question.answers.map((a) => ['answer', a.text, a.id]) : data.gifts?.length ? [...data.gifts.map((g) => ['gift', g.name, g.itemId]), ['bye', '잘 가요']] : talkToday(TALK_CHOICES, data.today));
    lostCard.replaceChildren(...lines, ...(data.offer ? [offerNote(data.offer)] : []), meta, list);
    if (data.finished) showDoneCard(data.finished); // (Q 끝내기)
    if (data.accepted) showToast(`📜 할 일에 넣었어요 · ${data.accepted.title}`);
    openTalk(data.name, Boolean(data.reward), globalThis.IslandCast?.WALKERS[data.n]?.tagColor);
    if (data.reward) { plaza.controller?.emote?.('clap'); loadPoints(); }
    if (data.affinity) plaza.controller?.setAffinity?.([{ n: data.n, points: data.affinity.points, level: data.affinity.level }]);
    for (const note of data.stages || []) { showToast(`💛 ${note}`, 6000); loadPoints(); } // (R2: a level reached)
    if (first) {
      residentTalk = { n: data.n, timer: setInterval(() => {
        if (!plazaDialog.open || !plazaDialog.classList.contains('talkMode') || lostCard.classList.contains('hidden')) { endResidentTalk(); return; }
        api('/api/island/resident/keep', { method: 'POST', body: JSON.stringify({ n: data.n }) }).catch((error) => { if (error.status === 409 && residentTalk?.n === data.n) plazaDialog.close(); });
      }, 4000) };
    }
  }
  async function askResident(n, topic, choice = null) {
    if (residentBusy) return; residentBusy = true;
    try { const data = await api('/api/island/resident/talk', { method: 'POST', body: JSON.stringify({ n, topic, ...(choice != null ? (topic === 'gift' ? { itemId: choice } : topic === 'accept' ? { errand: choice } : { choice }) : {}) }) }); if (data.bag) drawIslandBag(data.bag); if (residentTalk?.n === n) showResidentTalk(data, false); } // (Codex review: closed meanwhile -- the answer is dropped)
    catch (error) { showToast(error.message); if (error.status === 409) plazaDialog.close(); } finally { residentBusy = false; }
  }
  async function talkResident(n) {
    guideDone('talk'); // B 47 안내
    if (residentBusy) return; residentBusy = true;
    try {
      const p = plaza.controller?.pose?.(); if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      endResidentTalk(); await Promise.race([residentBye, new Promise((r) => { setTimeout(r, 1500); })]); // (C4 P3-8: a stuck bye -- not every talk shut)
      showResidentTalk(await api('/api/island/resident/talk', { method: 'POST', body: JSON.stringify({ n }) }), true);
    } catch (error) { showToast(error.message); } finally { residentBusy = false; }
  }
  let islandEventBusy = false;
  async function solveIslandEvent(key) {
    const id = key.split(':')[2];
    if (!id || islandEventBusy || weedBusy) return;
    islandEventBusy = true; let resourceStarted=false; let completed=false;
    const departureController = id === 'questfisher' ? plaza.controller : null;
    let departureDialog = false;
    departureController?.holdQuestDeparture?.(true); // before any state reply can show the completed story
    if (key.startsWith('ev:lost_owner:')) islandReturning = id;
    try {
      const p = plaza.controller?.pose?.(); // where I stand first, so the server sees me at it
      if (p) await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p) }).catch(() => {});
      const ev = islandEventsNear.find(e => e.id === id && e.resource);
      let data;
      if (ev) {
        const spec=await api('/api/island/resource/start',{method:'POST',body:JSON.stringify({id})}); resourceStarted=true;
        const done=await new Promise(resolve=>{if (!plaza.controller?.gatherResource?.(ev,spec,resolve)) resolve(false);});
        if (!done) return;
        const body=JSON.stringify({id,requestId:crypto.randomUUID()});
        try { data=await api('/api/island/resource/finish',{method:'POST',body}); } catch(error) { if(error.status) throw error; data=await api('/api/island/resource/finish',{method:'POST',body}); }
      } else data = await api('/api/island/event', { method: 'POST', body: JSON.stringify({ id, owner: key.startsWith('ev:lost_owner:') }) });
      plaza.controller?.setResidents?.(data.residents);
      if (ev) { completed=true; plaza.controller?.finishGather?.(true); }
      if (data.action === 'talk') { showIslandEvents(data.events || islandEventsNear); openLostRequest(id, data.points); return; } // v1.10.34 부탁
      if (data.action === 'quest') {
        showIslandEvents(data.events || islandEventsNear); showQuestTracker(data.track || []);
        if (departureController === plaza.controller && data.story === 'fisher' && data.done && data.reward) { questDepartureDialog = departureController; departureDialog = true; }
        openQuestTalk(data); if (data.reward) loadPoints(); return;
      } // v1.10.37
      if (data.action === 'pickup' || data.action === 'item') showToast(`${data.item.icon} ${data.item.name} +${data.item.qty}`);
      else showToast(`+${Number(data.points).toLocaleString('ko-KR')}P${data.bonus ? ` · 주간 생활활동 +${Number(data.bonus).toLocaleString('ko-KR')}P` : ''}`);
      // v1.10.31: the character's motion for what the server took -- picked up, a photo taken, given back
      // v1.10.32: given back hand to hand (the owner takes it, then goes), picked with a basket
      if (data.action === 'return') plaza.controller?.returnLost?.(id);
      else if (!ev) plaza.controller?.playMine?.(key.startsWith('ev:photo:') ? 'photo' : 'pickup');
      if (/^ev:(herb|berry|mushroom|candy):/.test(key)) plaza.controller?.holdBasket?.();
      if (data.points) loadPoints();
      if (data.action !== 'pickup') islandEventsGone.set(id, {at:Date.now(),generation:islandEventsNear.find(e=>e.id===id)?.generation || 0});
      showIslandEvents(data.events || islandEventsNear);
    } catch (error) {
      showToast(error.message);
      if (error.status === 409 && /사라졌/.test(error.message)) forgetIslandEvents([id]);
    } finally { if (!departureDialog) departureController?.holdQuestDeparture?.(false); plaza.controller?.finishGather?.(); if(resourceStarted && !completed) await api('/api/island/resource/cancel',{method:'POST',body:JSON.stringify({id})}).catch(()=>{}); islandEventBusy = false; islandReturning = null; }
  }

  // v1.10.9 작명소: my name now, a new one (Korean letters, digits, spaces), 30,000P (v1.10.35) on a second press that names the
  // price, then 24 hours before the next change. One request id per name until the server answers (a retry after a
  // lost answer is the same change, paid once).
  const namingDialog = document.getElementById('namingDialog');
  const namingInput = document.getElementById('namingInput');
  const namingSubmit = document.getElementById('namingSubmit');
  const namingStatus = document.getElementById('namingStatus');
  let namingArmed = null; let namingArmTimer = 0; let namingRequest = null; let namingFee = 100000;
  function disarmNaming() { namingArmed = null; clearTimeout(namingArmTimer); namingSubmit.textContent = '이름 바꾸기'; }
  async function loadNaming() {
    try {
      const data = await api('/api/nickname');
      namingFee = data.fee || namingFee;
      document.getElementById('namingCurrent').textContent = `지금 이름 · ${data.name}`;
      document.getElementById('namingPrice').textContent = `${namingFee.toLocaleString('ko-KR')}P`;
      const until = data.until ? new Date(data.until) : null;
      document.getElementById('namingWait').textContent = until ? `${until.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}부터 다시 바꿀 수 있습니다` : '';
      namingSubmit.disabled = Boolean(until) || !data.allowed; namingInput.disabled = !data.allowed;
    } catch (error) { namingStatus.textContent = error.message; }
  }
  function openNaming() {
    namingStatus.textContent = ''; namingInput.value = ''; disarmNaming();
    namingDialog.showModal(); loadNaming();
  }
  document.getElementById('namingCloseBtn').addEventListener('click', () => namingDialog.close());
  namingDialog.addEventListener('close', () => { disarmNaming(); if (document.body.classList.contains('plazaMode')) plazaStage.focus({ preventScroll: true }); });
  namingInput.addEventListener('input', disarmNaming);
  document.getElementById('namingForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = namingInput.value;
    if (!name.trim()) { namingStatus.textContent = '새 이름을 입력해 주세요.'; return; }
    if (!/^[가-힣ㄱ-ㅎㅏ-ㅣ0-9 ]+$/.test(name) || name.length > 12) { namingStatus.textContent = '한글·숫자·공백으로 12자까지 입력해 주세요.'; return; }
    if (namingArmed !== name) { // first press: say what it costs
      namingArmed = name; if (namingRequest?.name !== name) namingRequest = { name, id: crypto.randomUUID() };
      namingSubmit.textContent = `${namingFee.toLocaleString('ko-KR')}P 변경 확인`; namingStatus.textContent = '';
      clearTimeout(namingArmTimer); namingArmTimer = setTimeout(disarmNaming, 10000);
      return;
    }
    disarmNaming(); namingSubmit.disabled = true;
    try {
      const data = await api('/api/nickname', { method: 'POST', body: JSON.stringify({ name, requestId: namingRequest.id }) });
      namingRequest = null;
      sessionLabel = data.name; applyPlazaAvatar(); plazaLastSent = null; identityLabel.textContent = identityText();
      namingStatus.textContent = `「${data.name}」(으)로 바꿨습니다`;
      namingInput.value = ''; loadPoints(); await loadNaming();
    } catch (error) {
      namingStatus.textContent = error.message;
      if (error.status !== 409 && error.status !== 400) return; // a lost answer: the same request may be sent again
      namingRequest = null; await loadNaming();
    } finally { namingSubmit.disabled = Boolean(document.getElementById('namingWait').textContent); }
  });

  // v1.10.5 기부: the window at the plaza's donation box -- this week's top five and my total, last week's 호구왕, and
  // giving: the amount (typed or +1만/+10만/+100만), then a second press that says the amount (points are burned).
  const donationDialog = document.getElementById('donationDialog');
  const donationAmount = document.getElementById('donationAmount');
  const donationSubmit = document.getElementById('donationSubmit');
  const donationStatusEl = document.getElementById('donationStatus');
  let donationArmed = null; let donationArmTimer = 0;
  // v1.10.6: one request id per confirmed amount, kept until the server says it went through -- a retry after a lost
  // answer is then the same request (burned once). Another amount gets a new id.
  let donationRequest = null;
  const pts = (n) => `${Number(n || 0).toLocaleString('ko-KR')}P`;
  function disarmDonation() { donationArmed = null; clearTimeout(donationArmTimer); donationSubmit.textContent = '기부'; }
  async function loadDonation() {
    try {
      const data = await api('/api/donation');
      document.getElementById('donationBalance').textContent = data.balance != null ? `보유 ${pts(data.balance)}` : '';
      document.getElementById('donationMine').textContent = `이번 주 내 기부 ${pts(data.myTotal)}${data.myRank ? ` · ${data.myRank}위` : ''}`;
      const list = document.getElementById('donationRanking'); list.replaceChildren();
      for (const row of data.ranking) {
        const item = document.createElement('div'); item.className = `donationRow${row.me ? ' me' : ''}`; item.setAttribute('role', 'listitem');
        const who = document.createElement('span'); who.textContent = `${row.rank}위 ${row.name}`;
        const total = document.createElement('strong'); total.textContent = pts(row.total);
        item.append(who, total); list.append(item);
      }
      if (!data.ranking.length) { const empty = document.createElement('p'); empty.className = 'emptyState'; empty.textContent = '이번 주 기부가 아직 없어요.'; list.append(empty); }
      document.getElementById('donationLast').textContent = data.hoguking ? `지난주 호구왕 · ${data.hoguking}` : '';
      plazaStatues = data.statues || plazaStatues; plazaStatuesWeek = data.week ?? plazaStatuesWeek; plaza.controller?.setStatues?.(plazaStatues, plazaStatuesWeek);
    } catch (error) { donationStatusEl.textContent = error.message; }
  }
  function openDonation() {
    donationStatusEl.textContent = ''; donationAmount.value = ''; disarmDonation();
    donationDialog.showModal(); loadDonation();
  }
  document.getElementById('donationCloseBtn').addEventListener('click', () => donationDialog.close());
  donationDialog.addEventListener('close', () => { disarmDonation(); if (document.body.classList.contains('plazaMode')) plazaStage.focus({ preventScroll: true }); });
  donationDialog.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { donationAmount.value = String((Number(donationAmount.value) || 0) + Number(b.dataset.add)); disarmDonation(); }));
  donationAmount.addEventListener('input', disarmDonation);
  document.getElementById('donationForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const amount = Math.floor(Number(donationAmount.value));
    if (!Number.isSafeInteger(amount) || amount < 1) { donationStatusEl.textContent = '기부할 포인트를 입력해 주세요.'; return; }
    if (donationArmed !== amount) { // first press: say exactly what will be given
      donationArmed = amount; if (donationRequest?.amount !== amount) donationRequest = { amount, id: crypto.randomUUID() };
      donationSubmit.textContent = `${pts(amount)} 기부 확인`; donationStatusEl.textContent = '';
      clearTimeout(donationArmTimer); donationArmTimer = setTimeout(disarmDonation, 10000); // the confirm stays 10 s
      return;
    }
    disarmDonation(); donationSubmit.disabled = true;
    try {
      const data = await api('/api/donation', { method: 'POST', body: JSON.stringify({ amount, requestId: donationRequest.id }) });
      donationRequest = null;
      donationStatusEl.textContent = `${pts(amount)} 기부했습니다 · 이번 주 ${pts(data.total)}`;
      donationAmount.value = ''; loadPoints(); loadDonation();
    } catch (error) { donationStatusEl.textContent = error.message; }
    finally { donationSubmit.disabled = false; }
  });

  // v1.10.3 첫 접속 성별 선택: the first visit to the island asks once (남자/여자); the server keeps the first answer.
  const genderDialog = document.getElementById('genderDialog');
  const genderConfirmBtn = document.getElementById('genderConfirmBtn');
  let genderPick = null;
  function openGenderChoice() {
    if (genderDialog.open) return;
    genderPick = null; genderConfirmBtn.disabled = true; document.getElementById('genderStatus').textContent = '';
    genderDialog.querySelectorAll('.genderChoice').forEach((b) => b.setAttribute('aria-checked', 'false'));
    genderDialog.showModal();
  }
  genderDialog.addEventListener('cancel', (event) => event.preventDefault()); // a choice is needed (Esc does not close it)
  genderDialog.querySelectorAll('.genderChoice').forEach((button) => button.addEventListener('click', () => {
    genderPick = button.dataset.gender; genderConfirmBtn.disabled = false;
    genderDialog.querySelectorAll('.genderChoice').forEach((b) => b.setAttribute('aria-checked', String(b === button)));
  }));
  genderConfirmBtn.addEventListener('click', async () => {
    if (!genderPick) return;
    genderConfirmBtn.disabled = true;
    try {
      const data = await api('/api/avatar/gender', { method: 'POST', body: JSON.stringify({ gender: genderPick }) });
      plazaAvatar = data.avatar || plazaAvatar; applyPlazaAvatar(); plazaLastSent = null;
      genderDialog.close();
      if (document.body.classList.contains('plazaMode')) plazaStage.focus({ preventScroll: true });
    } catch (error) {
      document.getElementById('genderStatus').textContent = error.message; genderConfirmBtn.disabled = false;
      if (error.status === 409) { genderDialog.close(); refreshPlazaAvatar(); }
    }
  });

  // v1.9.3 V3: my pose goes to the server while I am in the plaza (about 8 a second while moving, every 3 seconds
  // standing); everyone's poses come back on the lobby stream as `plaza` snapshots and are drawn by the scene.
  let plazaSendTimer = null; let plazaLastSent = null; let plazaLastSentAt = 0; let plazaSending = false; let plazaMyId = null;
  let plazaPlayers = [];
  let plazaVisit = 0; let plazaStateRequest = null; let plazaDeparture = null;
  function plazaPresenceTick() {
    const c = plaza.controller;
    if (!c?.pose || plazaDeparture || !document.body.classList.contains('plazaMode')) return;
    // CI 3차: a start or a stop goes at once -- not after the pose still on its way (one at a time). On a busy page that
    // took 0.5 s; meanwhile the others' screens walked me on past my last moving pose and, the stop come, drew me a step
    // back (plaza.spec 「멀티유저」 never-backward, 0.1-0.47 m). The newer pose replaces the one on its way.
    if (plazaSending && (!plazaLastSent || c.pose().moving === plazaLastSent.moving)) return;
    if (plazaSending) plazaStateRequest?.abort();
    const p = c.pose(); const now = Date.now(); const prev = plazaLastSent;
    const changed = !prev || Math.hypot(p.x - prev.x, p.z - prev.z) > 0.05 || Math.abs(p.yaw - prev.yaw) > 0.05 || p.moving !== prev.moving
      || p.act !== prev.act || p.actN !== prev.actN || p.seat !== prev.seat; // v1.10.44: a sit, a wave or a cheer goes at once
    if (!changed && now - plazaLastSentAt < 3000) return;
    plazaSending = true; plazaLastSent = p; plazaLastSentAt = now;
    const sentAt = Date.now(); const visit = plazaVisit;
    const abort = new AbortController();
    plazaStateRequest = abort;
    api('/api/plaza/state', { method: 'POST', body: JSON.stringify(p), signal: abort.signal })
      .then((data) => {
        if (visit !== plazaVisit || c !== plaza.controller || !plazaSendTimer) return;
        plaza.controller?.setResidents?.(data.residents);
        plaza.controller?.setServerTime?.(data.now, sentAt, Date.now()); // v1.10.12: the islanders walk on the server's clock
        if (data.id && data.id !== plazaMyId) { plazaMyId = data.id; showPlazaPlayers(); }
        if (data.corrected && sentAt > (plaza.controller?.trainChangedAt?.() || 0)) { plaza.controller?.correctTo?.(data.x, data.z); plazaLastSent = null; } // discard a correction sent before boarding/alighting
        if (typeof data.townhallPass === 'boolean') plaza.controller?.setTownhallPass?.(data.townhallPass); // v1.10.41 the mayor's leave
        if (data.jail) jailedBy(data); // R4: put in the 구치소's cell
        plaza.controller?.setTrainService?.(data.trainService); plaza.controller?.setTrainShift?.(data.trainShift || 0); // v1.10.47 관광열차 (moved only in tests)
        const riding = plaza.controller?.riding?.();
        const waiting = plaza.controller?.platform?.();
        if (sentAt > (plaza.controller?.trainChangedAt?.() || 0) + 1500) {
          if (!riding && data.ride) plaza.controller?.board?.(data.ride.id, data.ride.seat);
          else if (!riding && !waiting && data.platform) plaza.controller?.setPlatform?.({ platform: data.platform });
          else if (!riding && waiting && data.platform === null) { const st = globalThis.IslandTrain.stationOf(waiting.station); plaza.controller?.setPlatform?.({ ...st.spot, stop: st.id, platform: null }); }
        }
        if (riding && data.ride === null && sentAt > riding.at + 1500) plaza.controller?.alight?.(null); // the server has no ride of mine (a restart)
        if (Array.isArray(data.events)) showIslandEvents(data.events); // v1.10.11: the events near me
        if (Array.isArray(data.quests)) showQuestTracker(data.quests); // v1.10.37
        if (data.taxNote) showToast(data.taxNote, 6000); // (주민세 고지서: the day before its last day, once)
      })
      .catch(() => {}).finally(() => { if (plazaStateRequest === abort) { plazaStateRequest = null; plazaSending = false; } });
  }
  function showPlazaPlayers() {
    const meNow = plazaPlayers.find((p) => p.id === plazaMyId); // B 47 (my pet, as the server has it)
    if (meNow && JSON.stringify(meNow.pet || null) !== JSON.stringify(myPet)) {
      // (펫 깜빡임: a none in a snapshot or two -- a server just up -- is not my pet gone; 3 s of it is: put home elsewhere)
      if (!meNow.pet && myPet && Date.now() - (myPetGoneAt ||= Date.now()) < 3000) {} else { myPetGoneAt = 0; myPet = meNow.pet || null; plaza.controller?.setMyPet?.(myPet); }
    } else myPetGoneAt = 0;
    plaza.controller?.setOthers?.(plazaPlayers.filter((p) => p.id !== plazaMyId));
    const mine = plazaPlayers.find((p) => p.id === plazaMyId); // the server says when my champion mark starts or ends (v1.9.5)
    if (mine && Boolean(mine.champion) !== plazaChampion) { plazaChampion = Boolean(mine.champion); applyPlazaAvatar(); }
    if (mine && Boolean(mine.hoguking) !== plazaHoguking) { plazaHoguking = Boolean(mine.hoguking); applyPlazaAvatar(); } // v1.10.5
  }
  function setPlazaPresence(on) {
    if (on && !plazaSendTimer) { plazaVisit += 1; plazaLastSent = null; plazaSendTimer = setInterval(plazaPresenceTick, 125); }
    if (!on && plazaSendTimer) {
      clearInterval(plazaSendTimer); plazaSendTimer = null; plazaVisit += 1;
      plazaStateRequest?.abort(); plazaStateRequest = null; plazaSending = false;
      if (sessionToken) {
        const leavingToken = sessionToken;
        // Cleanup belongs to that session; a late 401 must not expire a later login.
        const departure = (plazaDeparture || Promise.resolve()).then(() => fetch('/api/plaza/leave', {
          method: 'POST', headers: { 'X-Session-Token': leavingToken, 'Content-Type': 'application/json' }, body: '{}', cache: 'no-store',
        })).catch(() => {});
        plazaDeparture = departure;
        departure.finally(() => { if (plazaDeparture === departure) plazaDeparture = null; });
      }
      plaza.controller?.setOthers?.([]);
    }
  }
  function applyPlazaAvatar() {
    plaza.controller?.setAvatar?.({ look: plazaAvatar?.look || {}, title: plazaAvatar?.title || null, champion: plazaChampion, hoguking: plazaHoguking, delinquent: Boolean(plazaAvatar?.delinquent), name: sessionRole === 'admin' ? '관리자' : (sessionLabel || '게스트') });
  }
  window.PlazaDebug = () => (plaza.controller ? { ...plaza.controller.debug(), myId: plazaMyId } : null);
  // For tests: stand somewhere else as if entering the plaza again there (leave, then the next pose starts fresh).
  window.PlazaWarp = async (x, z) => {
    if (plazaDeparture) await plazaDeparture;
    while (plazaSending) await new Promise((resolve) => setTimeout(resolve, 20)); // no update in flight across the warp
    plazaSending = true;
    try { await api('/api/plaza/leave', { method: 'POST', body: '{}' }); plaza.controller?.debug().teleport(x, z); }
    finally { plazaSending = false; plazaLastSent = null; }
  };

  // v1.9.4 상시 등반 도전: the window (today / this week / ranking, start or resume) and the climb screen.
  const climbDialog = document.getElementById('climbDialog');
  let climbInfo = null;
  const meters = (n) => `${Number(n || 0).toLocaleString('ko-KR')}m`;
  async function loadClimb() {
    const status = document.getElementById('climbDialogStatus');
    status.textContent = '';
    try { climbInfo = await api('/api/climb'); } catch (error) { status.textContent = error.message; return; }
    byId('climbTodayBest').textContent = meters(climbInfo.today.best);
    byId('climbTodayPaid').textContent = `+${Number(climbInfo.today.paid).toLocaleString('ko-KR')}P`;
    byId('climbWeekBest').textContent = meters(climbInfo.weekBest);
    byId('climbWeekRank').textContent = climbInfo.ranking.me ? `${climbInfo.ranking.me.rank}위` : '';
    byId('climbChampions').textContent = climbInfo.champions?.names?.length ? `지난주 챔피언 · ${climbInfo.champions.names.join(', ')}` : '';
    byId('climbChampions').classList.toggle('hidden', !climbInfo.champions?.names?.length);
    const resume = Boolean(climbInfo.active);
    byId('climbStartBtn').textContent = resume ? `이어서 도전 · ${meters(Math.floor(climbInfo.active.state.y))}` : '도전 시작';
    byId('climbRestartBtn').classList.toggle('hidden', !resume);
    const list = byId('climbRanking');
    list.replaceChildren(...(climbInfo.ranking.top.length ? climbInfo.ranking.top.map((row) => {
      const item = document.createElement('li');
      item.className = `climbRankRow${row.me ? ' me' : ''}`;
      const rank = document.createElement('b'); rank.textContent = `${row.rank}위`;
      const name = document.createElement('span'); name.textContent = row.name || '-';
      const best = document.createElement('strong'); best.textContent = meters(row.best);
      item.append(rank, name, best);
      return item;
    }) : [Object.assign(document.createElement('li'), { className: 'climbRankEmpty', textContent: '아직 기록이 없습니다.' })]));
  }
  async function enterClimb(restart) {
    climbDialog.close();
    if (plazaDialog.open) plazaDialog.close();
    showView('climb');
    try { await window.ClimbClient.begin(restart); }
    catch (error) { showView('lobby'); showToast(error.message, 3500); }
  }
  byId('climbBtn').addEventListener('click', () => { climbDialog.showModal(); loadClimb(); });
  byId('climbCloseBtn').addEventListener('click', () => climbDialog.close());
  byId('climbStartBtn').addEventListener('click', () => enterClimb(false));
  byId('climbRestartBtn').addEventListener('click', () => enterClimb(true));
  window.ClimbClient?.mount({
    api, canvas: byId('climbCanvas'), hud: byId('climbHud'), endButton: byId('climbEndBtn'), leaveButton: byId('climbLeaveBtn'), status: byId('climbStatus'),
    result: byId('climbResult'), resultTitle: byId('climbResultTitle'), resultDetail: byId('climbResultDetail'), againButton: byId('climbAgainBtn'), lobbyButton: byId('climbLobbyBtn'),
    onExit: () => { showView('lobby'); loadPoints(); },
  });
  window.ClimbDebug = () => window.ClimbClient?.debug() || null;

  Object.defineProperty(window, '__plazaController', { get: () => plaza.controller, configurable: true }); // tests try looks on

  function identityText() {
    return sessionRole === 'admin' ? '관리자 세션' : `${sessionLabel || '게스트'} · 입장 파일 세션`;
  }

  async function api(path, options = {}) {
    const requestToken = sessionToken; // keep the initiating account across awaits
    const headers = { ...(options.headers || {}) };
    if (options.method === 'POST' && document.body.classList.contains('plazaMode')) {
      const places = { '/api/points/attendance': 'attendance', '/api/donation': 'donate', '/api/nickname': 'naming', '/api/climb/start': 'climb', '/api/avatar/surgery': 'faces', '/api/avatar/dye': 'dye' };
      let place = places[path];
      if (path === '/api/skins/buy' || (headers['X-Island-Facility'] && ['/api/skins/equip', '/api/skins/title'].includes(path))) {
        place = skinShopMode === 'transform' ? 'transform' : skinShopMode === 'avatar:outfit' ? 'avatar' : skinShopMode === 'avatar:hair' ? 'hair' : skinShopMode === 'avatar:hat' ? 'accessories' : 'shop';
        headers['X-Island-Facility'] = place;
      }
      if (place) {
        if (!(place === 'naming' && counterSeat?.door === 'room:rename') && !plaza.controller?.canInteract?.(place)) throw new Error('가까이 가서 다시 시도해 주세요.'); // (seated at 개명 신청: the server checks the window)
        const pose = plaza.controller.pose();
        await api('/api/plaza/state', { method: 'POST', body: JSON.stringify(pose) });
        if (!plaza.controller?.canInteract?.(place)) throw new Error('가까이 가서 다시 시도해 주세요.');
      }
    }
    if (requestToken) headers['X-Session-Token'] = requestToken;
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const res = await fetch(path, { ...options, headers, cache: 'no-store' });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) {
      if (res.status === 401 && requestToken && requestToken === sessionToken) expireSession(data.message); // (not before entering: the 로그인 screen's own calls)
      const err = new Error(data.message || '요청을 처리하지 못했습니다.');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // v1.10.35 무입력 로그아웃: a key, the mouse, a click or a touch tells the server at most once a minute that someone is
  // here; 30 minutes without one and the server ends the session (server.js INPUT_IDLE_MS)
  let inputSentAt = 0;
  const sawInput = () => {
    const now = Date.now(); if (!sessionToken || now - inputSentAt < 60 * 1000) return;
    inputSentAt = now; api('/api/session/input', { method: 'POST', body: '{}' }).catch(() => {});
  };
  const inputWindows = new WeakSet();
  function bindInputActivity(target) {
    if (inputWindows.has(target)) return;
    inputWindows.add(target);
    for (const type of ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart']) target.addEventListener(type, sawInput, { capture: true, passive: true });
  }
  bindInputActivity(window);

  function expireSession(message = '입장 세션이 만료되었습니다. 다시 입장해 주세요.') {
    try { sessionStorage.removeItem('gameCenterGuestSession'); } catch {} // see session-lock.js
    stopStream();
    stopLobbyStream();
    stopPresenceRefresh();
    sessionToken = '';
    sessionRole = '';
    sessionLabel = '';
    state = null;
    lastResultEffectKey = null;
    resetRecentActionTracking();
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
      adminWindowBtn.classList.toggle('hidden', sessionRole !== 'admin'); byId('issueLogBtn').classList.toggle('hidden', !canIssue()); refreshIssueWriter();
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
    leavePhoto(); // cancel before waiting for the logout request, including a slow/offline response
    try { if (sessionToken) await api('/api/logout', { method: 'POST' }); } catch {}
    expireSession('나갔습니다. 다시 이용하려면 로그인하거나 입장 파일을 여세요.');
  }

  function gameName(type) {
    return type === 'omok2v2' ? '오목 2vs2' : type === 'baseball' ? '숫자야구'
      : type === 'connect4' ? '사목 (4목)' : type === 'yut' ? '윷놀이' : type === 'bingo' ? '빙고' : type === 'dots' ? '점과 상자' : type === 'cityking' ? '랜드킹' : type === 'pictionary' ? '그림 맞히기' : type === 'liar' ? '라이어게임' : type === 'oldmaid' ? '도둑잡기' : type === 'marathon' ? '마라톤' : type === 'twentyquestions' ? '스무고개' : type === 'davinci' ? '다빈치 코드' : type === 'pandemic' ? '팬데믹' : type === 'halligalli' ? '할리갈리' : type === 'gostop' ? '고스톱 · 맞고' : type === 'rpg' ? '잿빛 원정'
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
  function isDavinciGame() { return state?.gameType === 'davinci'; }
  function isGostopGame() { return state?.gameType === 'gostop'; }
  function isRpgGame() { return state?.gameType === 'rpg'; }
  function isHalliGame() { return state?.gameType === 'halligalli'; }
  function isPandemicGame() { return state?.gameType === 'pandemic'; }
  function isCityKingGame() { return state?.gameType === 'cityking'; }
  function isTwentyGame() { return state?.gameType === 'twentyquestions'; }
  function isNumberedSeatGame() { return isRpgGame() || isGostopGame() || isTeamGame() || isBingoGame() || isPictionaryGame() || isLiarGame() || isOldMaidGame() || isCityKingGame() || isTwentyGame() || isDavinciGame() || isHalliGame() || isPandemicGame(); }
  function numberedSeats() { return isGostopGame() ? ['1','2','3'] : isHalliGame() ? ['1','2','3','4','5','6'] : isOldMaidGame() ? ['1','2','3','4'] : (isPictionaryGame() || isLiarGame() || isTwentyGame()) ? ['1','2','3','4','5','6','7','8'] : ['1','2','3','4']; }
  function seatColor(value) { return ['1','3'].includes(value) ? 'black' : ['2','4'].includes(value) ? 'white' : value; }
  // Winner is the same black/white color for most games; 2v2 seat numbers map to team colors.
  // Bingo uses numbered seats; pictionary's winner is an array of seats, so it never matches 'black'/'white'
  // below and falls through to null, which is correct since it has its own win display, not the shared effect.
  function resultOutcome(game, playerSeat, gameType) {
    if (game?.status !== 'finished' || !playerSeat || !game.winner) return null;
    // bingo/cityking naturally produce a single winning seat; pictionary/liar/oldmaid naturally
    // produce an array (ties, or "everyone but the loser"); resigning in bingo/pictionary/liar/
    // oldmaid can now also produce either shape depending on how many seats are left, so all five
    // are normalized the same way here rather than assuming one fixed shape per game.
    if (['gostop', 'bingo', 'cityking', 'pictionary', 'liar', 'oldmaid', 'twentyquestions', 'davinci', 'halligalli', 'pandemic'].includes(gameType)) {
      const winners = Array.isArray(game.winner) ? game.winner.map(String) : [String(game.winner)];
      return winners.includes(String(playerSeat)) ? 'win' : 'loss';
    }
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
    "yut": "각자 말 4개를 모두 먼저 완주하면 승리합니다. 도·개·걸·윷·모만큼 움직이며, 윷·모가 나오거나 상대 말을 잡으면 한 번 더 던집니다. 빽도가 나오면 보드 위의 말 하나를 한 칸 뒤로 물립니다(대기 중인 말은 낼 수 없고, 물릴 말이 없으면 차례가 자동으로 넘어갑니다). 출발 직후 첫 번째 칸의 말이 빽도로 물러나면 한 바퀴를 돌아온 것과 같이 완주 직전 칸으로 들어갑니다. 같은 편 말끼리는 업어서 함께 이동하고 모서리에 정확히 멈추면 지름길을 이용하며, 중앙에 정확히 멈춘 말은 항상 짧은 지름길로 출발합니다. 완주 직전 칸에 정확히 멈춘 말은 그 칸에 머무르고 다음 이동에서 한 칸 이상 더 나아가야 완주하지만, 그 칸을 지나칠 만큼 눈이 넉넉하면 그 던지기 안에서 곧바로 완주합니다.",
    "bingo": "2~4명이 참가합니다. 방장이 시작 전에 판 크기(5×5/7×7)와 숫자 범위(1~50/75/100/150)를 정하면 각자 그 범위에서 중복 없는 숫자로 자신의 판을 받습니다. 자기 차례에 자신의 판에서 아직 선택되지 않은 숫자를 누르면 같은 숫자를 가진 모든 참가자의 판도 함께 체크됩니다. 방장이 정한 목표 줄 수(5×5는 최대 12줄, 7×7은 최대 16줄)를 가로·세로·두 대각선을 합쳐 먼저 달성하면 승리합니다.",
    "dots": "5×5 점 사이에 번갈아 선을 하나씩 긋습니다. 네 변을 완성해 상자를 만든 사람이 그 상자를 차지하고 한 번 더 긋습니다. 모든 선을 그은 뒤 차지한 상자가 더 많은 사람이 승리합니다.",
    "cityking": "독자 규칙의 도시 보드게임입니다. 주사위를 굴려 도시를 매입하고 상대가 소유한 도시에는 통행료를 냅니다. 자기 소유 도시에 도착하면 매입가의 50%로 별장·빌딩·호텔을 방문당 한 단계 건설할 수 있습니다. 통행료는 기본·2배·3배·5배이며, 건설비는 순자산에 포함됩니다. 출발 보너스와 이벤트를 활용해 상대를 파산시키거나 50턴 뒤 순자산이 높은 쪽이 승리합니다.",
    "othello": "8×8 판에서 흑이 먼저 둡니다. 상대 돌을 양쪽에서 감싸면 가운데 돌을 내 색으로 뒤집습니다. 둘 곳이 없으면 자동 패스하며, 양쪽 모두 둘 수 없으면 종료되고 돌이 많은 쪽이 이깁니다.",
    "baseball": "방장이 방 생성 때 3자리 또는 4자리 숫자야구를 정합니다. 첫 자리는 0이 아니고 숫자는 서로 달라야 합니다. 숫자와 자리가 같으면 스트라이크, 숫자만 같으면 볼, 모두 다르면 아웃입니다. 선택한 자릿수만큼 스트라이크를 먼저 맞히면 승리합니다. 상대의 비밀 숫자는 보이지 않습니다.",
    "pictionary": "개인전 2~8명, 팀전 4·6·8명(홀수 자리 A팀·짝수 자리 B팀). 출제자만 보는 제시어를 그림으로 표현하고, 나머지는 전용 입력창으로 맞힙니다. 방장이 난이도·제한시간(60/90/120초)·카테고리 공개를 정합니다. 시간이 50% 남으면 글자 수, 25% 남으면 초성 힌트가 열리고, 첫 정답 뒤 10초 동안 더 맞힐 수 있습니다. 점수는 빨리 맞힐수록 높고(1~100점, 첫 정답 +20점), 출제자는 정답자 점수의 25%를 받습니다. 팀전에서 상대 팀 그림을 맞히면 절반만 받습니다. 글자·숫자를 그리는 것은 금지입니다.",
    "twentyquestions": "2~8인 개인전·협동전. 1~10라운드 및 출제 횟수 추천 선택. 무작위 카테고리를 보고 출제자가 비밀 정답을 정합니다. 도전자는 순서대로 질문 20개 또는 질문 대신 정답을 제출하고, 출제자는 예·아니오·비슷함·애매함으로 답하며 정답을 직접 판정합니다. 오답이면 다음 사람 차례이며 질문 20개 후 모두 최종 정답 기회 1회씩 받습니다. 개인전 정답자는 +1점, 협동전 성공 시 도전자 전원 +1점, 전원 실패 시 출제자 +1점. 최종 최고점 공동 우승 가능.",
    "liar": "3~8명이 참여합니다. 시민은 제시어를 알고 라이어 1명은 모릅니다. 전원이 순서대로 힌트를 두 번 말한 뒤 비밀 투표하며, 동률이면 후보만 추가 힌트 후 한 번 재투표합니다. 라이어가 지목되면 30초 안에 제시어를 맞힐 마지막 기회를 얻습니다.",
    "oldmaid": "2~4명이 53장(조커 1장 포함)을 나누고 같은 계급의 카드 두 장씩 자동으로 버립니다. 내 차례에는 다음 활성 참가자의 카드 뒷면 중 한 장을 선택해 뽑습니다. 자기 손패는 카드 섞기로 순서를 바꿀 수 있습니다. 짝이 생기면 자동으로 버리며 마지막 조커 보유자가 패배합니다.",
    "halligalli": "2~6명이 순서대로 카드를 공개합니다. 공개된 카드 맨 위의 한 과일 합이 정확히 5개면 종을 먼저 치세요. 맞히면 공개 카드를 전부 가져오고, 틀리면 다른 참가자에게 카드 한 장씩 줍니다. 카드가 없어도 자기 차례 전 종으로 카드를 얻으면 생존합니다. 방장이 정한 5분 또는 10분이 끝나면 뒷면 카드가 가장 많은 사람이 승리하며 공동 승리할 수 있습니다.",
    "pandemic": "2~4명이 힘을 모으는 협력 게임입니다. 모두 함께 승리하거나 함께 패배합니다. 파랑·노랑·검정·빨강 네 가지 질병의 치료제를 모두 개발하면 승리하고, 확산이 8번 일어나거나 질병 큐브가 부족하거나 플레이어 카드 2장을 뽑을 수 없으면 패배합니다. 각자 서로 다른 직업(비상 대책 설계자·운항관리자·위생병·건축 전문가·검역 전문가·연구자·과학자)을 받습니다. 차례마다 행동을 최대 4번 하고(이동·연구소 건설·질병 치료·정보 공유·치료제 개발), 플레이어 카드 2장을 뽑은 뒤(전염 카드가 나오면 즉시 처리), 감염률만큼 도시를 감염시킵니다. 손패는 7장까지이며 이벤트 카드는 행동을 쓰지 않고 누구의 차례에도 쓸 수 있습니다. 난이도는 전염 카드 4·5·6장입니다. 원작: 팬데믹(Pandemic, Z-Man Games).",
    "davinci": "2~4명 개인전. 타일 색은 모두 볼 수 있고 숫자는 본인 것만 볼 수 있습니다. 0~11의 흑·백 타일을 숫자 오름차순, 같은 숫자는 흑·백 순으로 정렬합니다. 차례마다 한 장을 뽑고 상대 타일 숫자를 추측합니다. 맞히면 계속 추측하거나 멈추고, 틀리면 뽑은 타일을 공개합니다. 더미가 비면 틀렸을 때 자기 타일을 공개합니다. 마지막 생존자가 승리합니다.",
    "gostop": "2명은 맞고(각 10장·바닥 8장), 3명은 고스톱(각 7장·바닥 6장)입니다. 넷마블 대박맞고 계열 대박모드로 맞고 7점·고스톱 3점부터 고/스톱을 고르며 1고 +1점 ×2, 2고 +2점 ×4 … 7고 ×128입니다. 광·열끗·고도리·띠·홍단·청단·초단·피 점수와 9월 국진(열끗/쌍피 선택), 쪽·따닥·판쓸이·뻑·자뻑·흔들기·폭탄·콩알탄·보너스피, 총통·3뻑 10점 승리, 피박·광박·멍박·고박, 나가리(다음 판 ×2)를 적용합니다. 방장이 정한 점당 10/50/100P로 아일랜드 포인트만 정산하며 실제 돈과는 관계없습니다. 화투 그림: Louie Mantia Jr.·Marcus Richert·Spenĉjo(Wikimedia Commons, CC BY-SA 4.0).",
    "rpg": "1~4인 협동 3D 로그라이크 액션 RPG입니다. 수호자·사냥꾼·비술사 중 하나를 골라 방향키로 직접 움직이고 Space로 기본 공격, Q/W/E/R로 스킬, Shift로 대시합니다. 방의 몬스터를 모두 물리치면 레벨업 스킬·능력치·아이템을 고르고 다음 방으로 갑니다. 여덟 번째 방의 보스를 쓰러뜨리면 원정 성공이며, 한 판이 끝나면 성장은 초기화됩니다."
});
  function showGameRule(type) {
    gameRulesText.textContent = gameRules[type] || '';
    renderGameGuide(document.getElementById('gameGuideMore'), type);
  }
  // v1.10.69 게임 안내 (한판마당 자료, public/game-guides.js): 상황 예시 그림 · 자주 하는 실수 · 잘하는 요령 under the rule
  function renderGameGuide(box, type) {
    const g = window.GameGuides?.[type];
    box.replaceChildren();
    if (!g) return;
    const add = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    for (const c of g.cases) {
      const fig = add('figure', 'gameGuideCase');
      const pic = add('div', 'gameGuideFig'); pic.innerHTML = c.svg; // our own constant figures (no outside data)
      const cap = add('figcaption'); cap.append(add('strong', null, c.title), add('span', null, c.text));
      fig.append(pic, cap); box.append(fig);
    }
    if (g.mistakes.length) {
      box.append(add('h4', null, '자주 하는 실수'));
      const list = add('ul', 'gameGuideList');
      for (const [m, fix] of g.mistakes) { const li = add('li'); li.append(add('strong', null, m), add('span', null, fix)); list.append(li); }
      box.append(list);
    }
    box.append(add('h4', null, '잘하는 요령'));
    const tips = add('ul', 'gameGuideList');
    for (const t of g.tips) tips.append(add('li', null, t));
    box.append(tips);
  }

  // v1.10.73 게임방 틀: the room's top bar shows the game's own colour tile and icon, as its card in the game hall
  let roomArtType = null; let roomIcons = null;
  async function paintRoomArt(type) {
    const g = window.GamehallCatalog?.GAMES.find((x) => x.room === (type === 'omok2v2' ? 'omok' : type));
    const tile = document.getElementById('roomGameArt');
    if (!g) { tile.classList.add('hidden'); roomArtType = null; return; }
    if (roomArtType === type) return;
    roomArtType = type; tile.classList.remove('hidden');
    tile.style.setProperty('--g1', g.colors[0]); tile.style.setProperty('--g2', g.colors[1]);
    if (!g.svg) try { roomIcons ||= await import('/reflex/js/icons.js'); } catch {}
    if (roomArtType === type) tile.innerHTML = g.svg ? `<svg viewBox="0 0 64 64">${window.GamehallCatalog.SVG[g.svg]}</svg>` : roomIcons?.art(g.art) || '';
  }
  let gameTabReady = false; // v1.10.63: set once the remembered tabs are shown (startup must not override them)
  function selectGame(type) {
    if (type === 'rpg' && rpgTouchOnly()) { type = 'omok'; showToast(RPG_PC_ONLY, 3500); }
    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'bingo', 'dots', 'cityking', 'pictionary', 'liar', 'oldmaid', 'twentyquestions', 'davinci', 'halligalli', 'pandemic', 'gostop', 'rpg'].includes(type) ? type : 'omok';
    for (const button of gameChoiceButtons) button.classList.toggle('selected', button.dataset.game === selectedGameType);
    const resolvedType = selectedGameType === 'omok' && omokMode() === '2v2' ? 'omok2v2' : selectedGameType;
    selectedGameText.textContent = `${gameDisplayName(resolvedType)} 방을 만듭니다.`;
    omokModeChoices.classList.toggle('hidden', selectedGameType !== 'omok');
    syncRoomAiChoices();
    baseballDigitChoices.classList.toggle('hidden', selectedGameType !== 'baseball');
    gostopStakeChoices.classList.toggle('hidden', selectedGameType !== 'gostop');
    gameRulesSelect.value = resolvedType;
    showGameRule(resolvedType);
    if (gameTabReady) followSelectedGame(); // v1.10.63
  }

  // v1.10.63 게임 선택 탭 (사용자 2026-10-11): 멀티게임 / 싱글게임, and under 멀티게임 대전게임 / 협동게임 -- each tab
  // shows its games below (index.html data-game-pane / data-kind). The last tabs are kept per browser; a first visit
  // opens on 멀티게임 · 대전게임. Moving to a kind that does not hold the selected game selects its first game, so
  // 방 만들기 never makes a game that is out of sight.
  const gamePicker = document.getElementById('gamePicker');
  const gameCard = gamePicker.closest('.lobbyCard');
  const gameTab = { mode: 'multi', kind: 'versus' };
  try {
    const saved = JSON.parse(localStorage.getItem('gc.gameTab') || 'null');
    if (['multi', 'single'].includes(saved?.mode)) gameTab.mode = saved.mode;
    if (['versus', 'coop'].includes(saved?.kind)) gameTab.kind = saved.kind;
  } catch {}
  function renderGameTab() {
    gameCard.dataset.gameView = gameTab.mode;
    gamePicker.dataset.kind = gameTab.kind;
    for (const tab of gameCard.querySelectorAll('[data-game-mode]')) tab.setAttribute('aria-selected', String(tab.dataset.gameMode === gameTab.mode));
    for (const tab of gameCard.querySelectorAll('[data-game-kind]')) tab.setAttribute('aria-selected', String(tab.dataset.gameKind === gameTab.kind));
    try { localStorage.setItem('gc.gameTab', JSON.stringify(gameTab)); } catch {}
  }
  // a game selected by any path (a click, coming back from a room, a password join) brings its 대전/협동 tab along
  function followSelectedGame() {
    const kind = gamePicker.querySelector(`[data-game="${selectedGameType}"]`)?.closest('.gameOption')?.dataset.kind;
    if (kind && kind !== gameTab.kind) { gameTab.kind = kind; renderGameTab(); }
  }
  // a tab picked: the selected game stays if it is still in sight (in this kind, or one of the games in development)
  function showGameTab() {
    const inSight = gamePicker.querySelector(`.gameOption[data-kind="${gameTab.kind}"] [data-game="${selectedGameType}"]`)
      || gameCard.querySelector(`.developmentGamePicker [data-game="${selectedGameType}"]`);
    const first = gamePicker.querySelector(`.gameOption[data-kind="${gameTab.kind}"] .gameChoice`);
    if (gameTab.mode === 'multi' && !inSight && first) selectGame(first.dataset.game);
    renderGameTab();
  }
  for (const tab of gameCard.querySelectorAll('[data-game-mode]')) tab.addEventListener('click', () => { gameTab.mode = tab.dataset.gameMode; showGameTab(); });
  for (const tab of gameCard.querySelectorAll('[data-game-kind]')) tab.addEventListener('click', () => { gameTab.kind = tab.dataset.gameKind; showGameTab(); });
  // v1.10.63 keyboard in the game hall: arrow keys move among the buttons of one row of tabs, game cards or room cards;
  // Enter/Space press the focused one (native buttons), Tab still leaves the group
  const ARROW_GROUPS = '.gameTabs, .gamePicker, .soloGamesPanel, #publicRoomList, .gamehallChips, .gamehallGrid, .gameSheetActions'; // v1.10.73: the game hall's chips, cards and sheet buttons
  document.addEventListener('keydown', event => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    const group = step && event.target.closest?.(ARROW_GROUPS);
    if (!group || event.altKey || event.ctrlKey || event.metaKey || event.target.matches('input, textarea, select, summary')) return;
    const buttons = [...group.querySelectorAll('button:not(:disabled)')].filter(button => button.offsetParent);
    const at = buttons.indexOf(event.target);
    if (at < 0 || buttons.length < 2) return;
    event.preventDefault();
    buttons[(at + step + buttons.length) % buttons.length].focus();
  });

  // v1.10.72 게임방 AI 자리: offered for 오목 1vs1 · 사목 · 오델로 (an AI room is private practice: no points, no record)
  // (looked up each time: selectGame may run before this point at start-up)
  const roomAiLevel = () => (document.getElementById('roomAiChoices').classList.contains('hidden') ? '' : document.querySelector('input[name="roomAi"]:checked')?.value || '');
  // G-포인트: 「내기 1,000P」 for a game against each other with a person (the server's pointPolicy 'entry' games); the rest
  // settle their own way (고스톱) or have no points (party, co-op, 잿빛 원정)
  // (inside the function, not a const beside it: selectGame may run before this point at start-up)
  const roomStakes = () => !document.getElementById('roomStakesChoices').classList.contains('hidden') && document.querySelector('input[name="roomStakes"]:checked')?.value === '1';
  function syncRoomAiChoices() {
    const ai = document.getElementById('roomAiChoices');
    ai.classList.toggle('hidden', !(['connect4', 'othello'].includes(selectedGameType) || (selectedGameType === 'omok' && omokMode() === '1v1')));
    const withAi = !ai.classList.contains('hidden') && Boolean(document.querySelector('input[name="roomAi"]:checked')?.value);
    document.getElementById('roomStakesChoices').classList.toggle('hidden', ['gostop', 'rpg', 'pictionary', 'liar', 'twentyquestions', 'pandemic'].includes(selectedGameType) || withAi);
  }
  for (const radio of document.querySelectorAll('input[name="omokMode"], input[name="roomAi"]')) radio.addEventListener('change', syncRoomAiChoices);
  async function createRoom() {
    try {
      const ai = roomAiLevel();
      const visibility = document.querySelector('input[name="roomVisibility"]:checked')?.value || 'private';
      const digitCount = Number(document.querySelector('input[name="baseballDigitCount"]:checked')?.value || 3);
      const data = await api('/api/rooms', { method: 'POST', body: JSON.stringify({
        gameType: selectedGameType === 'omok' && omokMode() === '2v2' ? 'omok2v2' : selectedGameType,
        visibility,
        title: roomTitleInput.value,
        ...(selectedGameType === 'baseball' ? { digitCount } : {}),
        ...(selectedGameType === 'gostop' ? { pointsPerScore: Number(document.querySelector('input[name="gostopStake"]:checked')?.value || 100) } : {}),
        ...(ai ? { ai } : {}),
        ...(roomStakes() ? { stakes: true } : {}),
      }) });
      roomTitleInput.value = '';
      enterRoomState(data.state);
      sendIslandInvite(); // v1.10.44: the room made for an island invite
      showToast(ai ? 'AI 방을 만들었습니다. 자리를 고르면 AI가 맞은편에 앉아요 (연습 · 포인트·전적 없음).'
        : visibility === 'public' ? '공개방을 만들었습니다. 로비 목록에서 바로 참여할 수 있어요.' : `비공개방 생성 완료 · 비밀번호 ${data.state.me.roomCode}`);
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
    renderGamehallRooms(); // v1.10.73: the game hall's own lists of these rooms
    const rooms = Array.isArray(lobbyState.rooms) ? lobbyState.rooms : [];
    if (!rooms.length) {
      const empty = document.createElement('p');
      empty.className = 'emptyState';
      empty.textContent = '현재 공개방이 없습니다. 왼쪽에서 공개방을 만들고 상대를 기다려 보세요.';
      publicRoomList.appendChild(empty);
      return;
    }
    for (const room of rooms) publicRoomList.appendChild(publicRoomRow(room));
  }
  // v1.10.63 room card: game badge + status chip, title, players, join/watch (v1.10.73: also in the game hall's sheet)
  function publicRoomRow(room) {
    {
      const row = document.createElement('div');
      row.className = 'publicRoomRow';
      row.dataset.status = room.status || 'playing';
      const main = document.createElement('div');
      main.className = 'publicRoomMain';
      const head = document.createElement('span');
      head.className = 'publicRoomHead';
      const badge = document.createElement('b');
      badge.className = 'publicRoomGame';
      const displayedGame = gameDisplayName(room.gameType);
      badge.textContent = displayedGame;
      const chip = document.createElement('i');
      chip.className = 'publicRoomStatus';
      chip.textContent = room.status === 'waiting' ? '모집 중' : room.status === 'finished' ? '종료' : room.status === 'paused' ? '일시정지' : '진행 중';
      head.append(badge, chip);
      const name = document.createElement('strong');
      name.textContent = room.title || `${room.host || '방장'}의 ${displayedGame}방`;
      const info = document.createElement('small');
      info.textContent = `선수 ${room.playerCount || 0}/${room.maxPlayers || 2} · 접속 ${room.connectedCount || 0}명${room.stakes ? ' · 내기 1,000P' : ''}`; // (G-포인트)
      main.append(head, name, info);
      const enter = document.createElement('button');
      enter.type = 'button';
      enter.className = room.status === 'waiting' ? 'secondary tiny' : 'ghost tiny';
      enter.textContent = room.status === 'waiting' ? '바로 입장' : '관전하기';
      enter.setAttribute('aria-label', `${name.textContent} ${enter.textContent}`);
      enter.addEventListener('click', async () => {
        enter.disabled = true;
        try { await joinPublicRoom(room.id); }
        catch (err) { showToast(err.message, 4200); await loadPublicRooms().catch(() => {}); }
        finally { enter.disabled = false; }
      });
      row.append(main, enter);
      return row;
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

  function openAnnouncementEditor(item = null) { loadNoticeQueue(); // (A5: the queued ones beside the editor)
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

  // A5 공지 예약: the queued notices (administrator only) with a 취소 each
  async function loadNoticeQueue() {
    const box = byId('noticeQueue'); if (!box || sessionRole !== 'admin') return;
    try {
      const { queue } = await api('/api/admin/notice-queue');
      box.replaceChildren(...queue.map((e) => { const row = document.createElement('div'); row.className = 'noticeQueueRow'; const t = document.createElement('span'); t.textContent = `⏰ ${new Date(e.at).toLocaleString('ko-KR')} · ${e.title}`; const b = document.createElement('button'); b.type = 'button'; b.className = 'ghost tiny'; b.textContent = '취소'; b.addEventListener('click', async () => { await api(`/api/admin/notice-queue/${e.id}`, { method: 'DELETE' }).catch(() => {}); loadNoticeQueue(); }); row.append(t, b); return row; }));
      box.classList.toggle('hidden', !queue.length);
    } catch {}
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
        body: JSON.stringify({ title, body, pinned: announcementPinned.checked, ...(!id && byId('announcementAt').value ? { publishAt: new Date(byId('announcementAt').value).toISOString() } : {}) }), // (A5 공지 예약)
      }).then((r) => { if (r.scheduled) showToast(`예약했어요 · ${new Date(r.scheduled.at).toLocaleString('ko-KR')}에 게시`); return r; });
      byId('announcementAt').value = '';
      closeAnnouncementEditor();
      await loadAnnouncements(); loadNoticeQueue();
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
    renderSignups((await api('/api/admin/signups')).signups || []);
  }
  // v1.10.63 가입 신청: 이름 · 아이디 · 원하는 닉네임, 승인(계정이 생김) / 거절
  function renderSignups(signups) {
    const list = byId('signupList');
    list.replaceChildren();
    if (!signups.length) { const empty = document.createElement('p'); empty.className = 'emptyState'; empty.textContent = '대기 중인 가입 신청이 없습니다.'; list.append(empty); return; }
    for (const s of signups) {
      const row = document.createElement('div'); row.className = 'keyRow compactKeyRow signupRow';
      const main = document.createElement('div'); main.className = 'keyMain';
      const name = document.createElement('strong'); name.textContent = s.nickname;
      const info = document.createElement('small'); info.textContent = `이름 ${s.realName} · 아이디 ${s.loginId} · 신청 ${new Date(s.pendingAt).toLocaleString('ko-KR')}`;
      main.append(name, info);
      const actions = document.createElement('div'); actions.className = 'keyActions';
      for (const [label, cls, act] of [['승인', 'secondary', 'approve'], ['거절', 'danger', 'reject']]) {
        const b = document.createElement('button'); b.type = 'button'; b.className = `${cls} tiny compactAction`; b.textContent = label;
        b.setAttribute('aria-label', `${s.nickname} 가입 ${label}`);
        b.addEventListener('click', async () => {
          if (act === 'reject' && !window.confirm(`${s.nickname}(${s.loginId})의 가입 신청을 거절할까요?`)) return;
          b.disabled = true;
          try { await api(`/api/admin/signups/${s.id}/${act}`, { method: 'POST', body: '{}' }); showToast(act === 'approve' ? `${s.nickname} 가입을 승인했습니다.` : '가입 신청을 거절했습니다.'); await loadGuestKeys(); }
          catch (err) { showToast(err.message, 4000); b.disabled = false; }
        });
        actions.append(b);
      }
      row.append(main, actions); list.append(row);
    }
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
      const grantBtn = document.createElement('button');
      grantBtn.className = 'secondary tiny compactAction';
      grantBtn.type = 'button';
      grantBtn.textContent = '포인트 지급';
      grantBtn.setAttribute('aria-label', `${key.label} 포인트 지급`);
      grantBtn.addEventListener('click', () => openPointGrant(key));
      const messengerBtn = document.createElement('button'); // v1.10.78 메신저 허용 (IDEAS #future-messenger)
      messengerBtn.className = 'ghost tiny compactAction';
      messengerBtn.type = 'button';
      const messengerLabel = () => { messengerBtn.textContent = key.messenger ? '메신저 해제' : '메신저 허용'; messengerBtn.setAttribute('aria-pressed', String(Boolean(key.messenger))); };
      messengerLabel();
      messengerBtn.addEventListener('click', async () => {
        messengerBtn.disabled = true;
        try {
          const data = await api(`/api/admin/keys/${key.id}/messenger`, { method: 'POST', body: JSON.stringify({ allowed: !key.messenger }) });
          key.messenger = data.messenger; messengerLabel();
          showToast(`${key.label}: 메신저 ${key.messenger ? '허용' : '해제'}`);
        } catch (err) { showToast(err.message, 4000); } finally { messengerBtn.disabled = false; }
      });
      const issueBtn = document.createElement('button'); // (2026-10-20) 문제 기록 허용, as 메신저
      issueBtn.className = 'ghost tiny compactAction'; issueBtn.type = 'button';
      const issueLabel = () => { issueBtn.textContent = key.issues ? '문제 기록 해제' : '문제 기록 허용'; issueBtn.setAttribute('aria-pressed', String(Boolean(key.issues))); };
      issueLabel();
      issueBtn.addEventListener('click', async () => {
        issueBtn.disabled = true;
        try {
          const data = await api(`/api/admin/keys/${key.id}/issues`, { method: 'POST', body: JSON.stringify({ allowed: !key.issues }) });
          key.issues = data.issues; issueLabel(); showToast(`${key.label}: 문제 기록 ${key.issues ? '허용' : '해제'}`);
        } catch (err) { showToast(err.message, 4000); } finally { issueBtn.disabled = false; }
      });
      actions.append(detailBtn, memoBtn, reissueBtn, grantBtn, messengerBtn, issueBtn, revokeBtn);

      const detail = document.createElement('div');
      detail.className = 'keyDetail hidden';
      const used = key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString('ko-KR') : '사용 기록 없음';
      const presence = key.presence?.online ? (key.presence.inRoom ? '접속 중 · 방 참여 중' : '접속 중') : '오프라인';
      detail.textContent = `아이디 ${key.loginId || '미설정'}${key.realName ? ` · 이름 ${key.realName}` : ''} · 상태 ${presence} · 최근 사용 ${used} · 총 ${key.useCount || 0}회`;
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
      if (key.loginId) { // v1.10.63 비밀번호 분실: a temporary password, shown once to tell the player
        const resetBtn = document.createElement('button'); resetBtn.type = 'button'; resetBtn.className = 'ghost tiny compactAction'; resetBtn.textContent = '비밀번호 초기화';
        resetBtn.addEventListener('click', async () => {
          if (!window.confirm(`${key.label}(${key.loginId})의 비밀번호를 임시 비밀번호로 바꿀까요?`)) return;
          try { const data = await api(`/api/admin/keys/${key.id}/password-reset`, { method: 'POST', body: '{}' }); window.alert(`아이디 ${data.loginId}
임시 비밀번호 ${data.password}

본인에게 전달하고, 로그인 뒤 비밀번호를 바꾸게 해 주세요.`); }
          catch (err) { showToast(err.message, 4000); }
        });
        detail.appendChild(resetBtn);
      }
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

  // v1.7.3 operator point grant: pick an amount (10,000P units) and a reason, then confirm the exact
  // "who / how much" sentence. One request id per confirmation, so a double click or a retry of the
  // same confirmation grants once; the server re-validates everything.
  const pointGrantDialog = document.getElementById('pointGrantDialog');
  const pointGrantTarget = document.getElementById('pointGrantTarget');
  const pointGrantEdit = document.getElementById('pointGrantEdit');
  const pointGrantAmount = document.getElementById('pointGrantAmount');
  const pointGrantCategory = document.getElementById('pointGrantCategory');
  const pointGrantMemo = document.getElementById('pointGrantMemo');
  const pointGrantConfirm = document.getElementById('pointGrantConfirm');
  const pointGrantError = document.getElementById('pointGrantError');
  const pointGrantCancelBtn = document.getElementById('pointGrantCancelBtn');
  const pointGrantNextBtn = document.getElementById('pointGrantNextBtn');
  let pointGrant = null;
  function newGrantRequestId() {
    if (window.crypto?.randomUUID) return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  function setPointGrantStep(step) {
    pointGrant.step = step;
    pointGrantEdit.classList.toggle('hidden', step !== 'edit');
    pointGrantConfirm.classList.toggle('hidden', step === 'edit');
    pointGrantNextBtn.textContent = step === 'edit' ? '다음' : '지급 확정';
    pointGrantCancelBtn.textContent = step === 'edit' ? '취소' : '수정';
  }
  function openPointGrant(key) {
    pointGrant = { key, step: 'edit', requestId: null, busy: false };
    pointGrantTarget.textContent = `대상 계정: ${key.label}`;
    pointGrantAmount.value = '10000';
    pointGrantCategory.value = 'event';
    pointGrantMemo.value = '';
    pointGrantMemo.classList.add('hidden');
    pointGrantError.textContent = '';
    pointGrantNextBtn.disabled = false;
    setPointGrantStep('edit');
    pointGrantDialog.showModal();
    pointGrantAmount.focus();
  }
  for (const button of pointGrantDialog.querySelectorAll('[data-grant-amount]')) {
    button.addEventListener('click', () => { pointGrantAmount.value = button.dataset.grantAmount; pointGrantError.textContent = ''; });
  }
  pointGrantCategory.addEventListener('change', () => pointGrantMemo.classList.toggle('hidden', pointGrantCategory.value !== 'other'));
  pointGrantCancelBtn.addEventListener('click', () => {
    if (!pointGrant || pointGrant.busy) return;
    if (pointGrant.step === 'confirm') return setPointGrantStep('edit');
    pointGrantDialog.close();
  });
  pointGrantNextBtn.addEventListener('click', async () => {
    if (!pointGrant || pointGrant.busy) return;
    const amount = Number(pointGrantAmount.value);
    if (pointGrant.step === 'edit') {
      if (!Number.isSafeInteger(amount) || amount <= 0 || amount % 10000 !== 0) {
        pointGrantError.textContent = '지급액은 10,000P 단위의 양수로 입력해 주세요.';
        return;
      }
      const category = pointGrantCategory.selectedOptions[0]?.textContent || '';
      const memo = pointGrantCategory.value === 'other' && pointGrantMemo.value.trim() ? ` (${pointGrantMemo.value.trim().slice(0, 40)})` : '';
      pointGrant.requestId = newGrantRequestId(); // one id per confirmation
      pointGrant.amount = amount;
      pointGrantConfirm.textContent = `${pointGrant.key.label}에게 ${amount.toLocaleString('ko-KR')}P를 지급합니다. · 사유: ${category}${memo}`;
      pointGrantError.textContent = '';
      return setPointGrantStep('confirm');
    }
    pointGrant.busy = true;
    pointGrantNextBtn.disabled = true;
    pointGrantCancelBtn.disabled = true;
    try {
      const data = await api(`/api/admin/keys/${pointGrant.key.id}/points`, { method: 'POST', body: JSON.stringify({
        amount: pointGrant.amount, category: pointGrantCategory.value, memo: pointGrantMemo.value, requestId: pointGrant.requestId,
      }) });
      pointGrantDialog.close();
      showToast(data.applied
        ? `${data.label}에게 ${Number(data.amount).toLocaleString('ko-KR')}P 지급 완료 · ${Number(data.balanceBefore).toLocaleString('ko-KR')}P → ${Number(data.balanceAfter).toLocaleString('ko-KR')}P`
        : '이미 처리된 지급 요청입니다. 중복 지급되지 않았습니다.', 5000);
    } catch (err) {
      pointGrantError.textContent = err.message;
    } finally {
      if (pointGrant) pointGrant.busy = false;
      pointGrantNextBtn.disabled = false;
      pointGrantCancelBtn.disabled = false;
    }
  });
  pointGrantDialog.addEventListener('cancel', (event) => { if (pointGrant?.busy) event.preventDefault(); });

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

  function renderRecordsSection(data, select, summary, detail) {
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
      const rankSuffix = row?.avgRank ? ` · 평균 순위 ${row.avgRank}위` : '';
      detail.textContent = row?.played ? `${select.value === 'all' ? '전체 게임' : gameDisplayName(select.value)} 기준 · 총 ${row.played}대국${rankSuffix}` : '아직 기록된 대국이 없습니다.';
    };
    select.onchange = update;
    update();
  }

  // v1.7.35: legend skins an account owns show as badges under the name (server-provided, names only).
  function renderBadges(box, badges) {
    if (!box) return;
    box.replaceChildren(...(badges || []).map((badge) => {
      const chip = document.createElement('span');
      chip.className = 'recordsBadge';
      chip.textContent = `${badge.name} · ${badge.game}`;
      return chip;
    }));
    box.classList.toggle('hidden', !badges?.length);
  }

  function renderRecords(data, select, name, summary, detail, badgesBox) {
    renderBadges(badgesBox, data?.badges);
    name.textContent = data?.player?.label || '기록 없음';
    renderRecordsSection(data, select, summary, detail);
  }

  async function loadMyRecords() {
    if (!sessionToken) return;
    const token = sessionToken;
    try {
      const data = await api('/api/records/me');
      if (token !== sessionToken) return;
      ownRecords = data;
      renderRecords(data, myRecordsGame, myRecordsName, myRecordsSummary, myRecordsDetail, document.getElementById('myRecordsBadges'));
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
      recordsHeadToHead.classList.add('hidden');
      recordsSearchInput.focus();
      return;
    }
    await showPlayerRecords(playerId);
  }

  async function showPlayerRecords(playerId) {
    recordsProfileName.textContent = '전적 조회 중...';
    recordsHeadToHead.classList.add('hidden');
    try {
      const data = await api(`/api/records/${encodeURIComponent(playerId)}`);
      if (!recordsDialog.open) return;
      viewedRecords = data;
      renderRecords(data, recordsProfileGame, recordsProfileName, recordsProfileSummary, recordsProfileDetail, document.getElementById('recordsProfileBadges'));
    } catch (error) {
      if (recordsDialog.open) recordsProfileName.textContent = `전적 조회 실패 · ${error.message}`;
      return;
    }
    h2hSummary.textContent = '상대 전적 조회 중...';
    h2hDetail.textContent = '';
    try {
      const versus = await api(`/api/records/${encodeURIComponent(playerId)}/versus-me`);
      if (!recordsDialog.open) return;
      recordsHeadToHead.classList.remove('hidden');
      renderRecordsSection(versus, h2hGame, h2hSummary, h2hDetail);
    } catch (error) {
      // Viewing my own profile: there is no head-to-head against myself, so stay hidden.
      if (error.data?.error === 'SAME_PLAYER') { recordsHeadToHead.classList.add('hidden'); return; }
      if (recordsDialog.open) { recordsHeadToHead.classList.remove('hidden'); h2hSummary.textContent = `상대 전적 조회 실패 · ${error.message}`; }
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

  // v1.6.86: Game Center points (in-game only). The server owns balance and attendance.
  let pointsRequest = 0;
  function renderPoints(account) {
    if (!account) return;
    pointWallet.classList.remove('hidden');
    pointBalanceText.textContent = `보유 ${Number(account.balance || 0).toLocaleString('ko-KR')}P`;
    const claimed = Boolean(account.attendance?.claimed);
    attendanceBtn.textContent = claimed ? '오늘 출석 완료' : `오늘 출석 +${Number(account.attendanceAmount || 50000).toLocaleString('ko-KR')}P`;
    attendanceBtn.disabled = claimed;
    window.GameActionable?.set(attendanceBtn, !claimed);
    window.GostopUI?.setPointAccount?.(account);
    // The history is refetched only when the server balance really differs from the newest row shown.
    if (pointHistoryOpen && pointHistoryLatestBalance !== Number(account.balance)) loadPointHistory({ reset: true });
  }

  const ADMIN_GRANT_CATEGORY_LABELS = { event: '이벤트', reward: '보상', correction: '운영 보정', other: '기타' };

  // v1.7.0: lobby point history (read-only view of the server ledger; never computes balances).
  const POINT_HISTORY_PAGE = 30;
  let pointHistoryOpen = false;
  let pointHistoryCursor = null;
  let pointHistoryLatestBalance = null;
  let pointHistoryRequest = 0;
  const seoulDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  const seoulClock = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
  const seoulDate = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
  function pointHistoryTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const clock = seoulClock.format(date);
    return seoulDay.format(date) === seoulDay.format(new Date()) ? `오늘 ${clock}` : `${seoulDate.format(date)} ${clock}`;
  }
  function pointHistoryTitle(item) {
    if (item.reason === 'initial_grant') return '신규 계정 지급';
    if (item.reason === 'economy_reset') return '경제 개편 초기화'; // v1.10.35
    if (item.reason === 'solo_game') return '혼자 게임 보상'; // v1.10.37
    if (item.reason === 'quest') return '섬 주민 부탁'; // v1.10.37
    if (item.reason === 'daily_attendance') return '출석체크';
    if (item.reason === 'bank_deposit') return '예금 맡기기'; // v1.10.85
    if (item.reason === 'bank_withdraw') return '예금 찾기';
    if (item.reason === 'resident_tax') return '주민세'; // v1.10.86 (taken at midnight until v1.10.154's 고지서)
    if (item.reason === 'ip_skin_refund') return 'IP 스킨 정리 환불'; // v1.10.90
    if (item.reason === 'outfit_retire_refund') return '변신 옷 정리 환불'; // (2026-10-21)
    if (item.reason === 'island_buy') return '잡화점'; // v1.10.92
    if (item.reason === 'tax_payment') return '주민세 납부';
    if (item.reason === 'skin_gift') return item.memo || '스킨 선물'; // 3-1 (「선물 ○○ → △△」)
    if (item.reason === 'game_win' || item.reason === 'game_loss') {
      if (item.gameType === 'gostop') {
        const game = item.mode === 'matgo' ? '맞고' : item.mode === 'gostop' ? '고스톱' : '고스톱·맞고';
        const bonus = item.detail === 'firstPpeok' || item.detail === 'secondPpeok';
        return `${game} ${bonus ? '뻑 보너스 정산' : item.detail === 'forfeit' ? '기권 정산' : '정산'}`;
      }
      return '게임 정산';
    }
    // v1.7.3 common entry fee, its payout/refund, and operator grants.
    if (item.reason === 'game_entry') return `${gameName(item.gameType)} 참가`;
    if (item.reason === 'game_reward') return `${gameName(item.gameType)} 승리 보상`;
    if (item.reason === 'game_refund') return `${gameName(item.gameType)} 무효 환불`;
    if (item.reason === 'admin_grant') {
      const category = ADMIN_GRANT_CATEGORY_LABELS[item.detail] || '기타';
      return `관리자 지급 · ${category}${item.detail === 'other' && item.memo ? ` (${item.memo})` : ''}`;
    }
    if (item.reason === 'event_reward') return item.memo || '이벤트 보상';
    if (item.reason === 'daily_mission') return `오늘의 미션 · ${item.memo || '완료'}`;
    if (item.reason === 'achievement') return `업적 · ${item.memo || '달성'}`;
    if (item.reason === 'weekly_mission') return `주간 미션 · ${item.memo || '완료'}`;
    if (item.reason === 'climb_daily') return `등반 도전 · ${item.memo || '기록'}`; // v1.9.4
    if (item.reason === 'donation') return `기부 · ${item.memo || '소각'}`; // v1.10.5
    if (item.reason === 'nickname') return `개명소 · ${item.memo || '이름 변경'}`; // v1.10.9
    if (item.reason === 'island_sale') return `게임 아일랜드 · ${item.memo || '정산'}`; // v1.10.10
    if (item.reason === 'nickname_refund') return `개명소 환불 · ${item.memo || '이름 변경'}`;
    if (item.reason === 'climb_weekly_rank') return `등반 주간 순위 · ${item.memo || '보상'}`; // v1.9.5
    if (item.reason === 'first_win') return item.memo || '첫 승리 보너스';
    return '기타 시스템 조정';
  }
  function pointHistoryRow(item) {
    const row = document.createElement('div');
    row.className = 'pointHistoryRow';
    row.setAttribute('role', 'listitem');
    const top = document.createElement('div');
    top.className = 'top';
    const title = document.createElement('span');
    const when = document.createElement('span');
    when.className = 'when';
    when.textContent = pointHistoryTime(item.at);
    title.append(when, pointHistoryTitle(item));
    const delta = document.createElement('span');
    delta.className = `delta ${item.delta >= 0 ? 'gain' : 'loss'}`;
    delta.textContent = `${item.delta >= 0 ? '+' : '-'}${Math.abs(item.delta).toLocaleString('ko-KR')}P`;
    top.append(title, delta);
    const balances = document.createElement('div');
    balances.className = 'balances';
    balances.textContent = `${Number(item.balanceBefore).toLocaleString('ko-KR')}P → ${Number(item.balanceAfter).toLocaleString('ko-KR')}P`;
    row.append(top, balances);
    return row;
  }
  async function loadPointHistory({ reset = false } = {}) {
    if (!reset && pointHistoryCursor === null) return;
    const ticket = ++pointHistoryRequest;
    pointHistoryMore.disabled = true;
    pointHistoryStatus.textContent = '불러오는 중…';
    try {
      const query = new URLSearchParams({ limit: String(POINT_HISTORY_PAGE) });
      if (!reset) query.set('before', String(pointHistoryCursor));
      const page = await api(`/api/points/history?${query}`);
      if (ticket !== pointHistoryRequest) return;
      if (reset) {
        pointHistoryList.replaceChildren();
        pointHistoryLatestBalance = page.items.length ? page.items[0].balanceAfter : null;
      }
      for (const item of page.items) pointHistoryList.appendChild(pointHistoryRow(item));
      pointHistoryCursor = page.hasMore ? page.nextBefore : null;
      pointHistoryMore.classList.toggle('hidden', !page.hasMore);
      pointHistoryStatus.textContent = pointHistoryList.childElementCount ? '' : '아직 포인트 내역이 없습니다.';
    } catch (error) {
      if (ticket === pointHistoryRequest) pointHistoryStatus.textContent = `내역을 불러오지 못했습니다 · ${error.message}`;
    } finally {
      if (ticket === pointHistoryRequest) pointHistoryMore.disabled = false;
    }
  }
  function setPointHistoryOpen(open) {
    pointHistoryOpen = open;
    pointHistoryPanel.classList.toggle('hidden', !open);
    pointHistoryBtn.setAttribute('aria-expanded', String(open));
    if (open) loadPointHistory({ reset: true });
    else pointHistoryRequest += 1;
  }
  async function loadPoints() {
    const ticket = ++pointsRequest;
    try {
      const account = await api('/api/points');
      if (ticket === pointsRequest) renderPoints(account);
    } catch {}
  }
  async function claimAttendance() {
    attendanceBtn.disabled = true;
    try {
      const result = await api('/api/points/attendance', { method: 'POST', body: '{}' });
      showToast(result.granted ? `출석 완료 +${Number(result.amount).toLocaleString('ko-KR')}P` : '오늘은 이미 출석했습니다.');
    } catch (err) { showToast(err.message); }
    await loadPoints();
  }

  // v1.7.16 daily missions: the server deals three missions per Asia/Seoul day and counts finished
  // matches; this only shows them. The button keeps a short `미션 N/3`, the panel is a modal like the
  // player lookup, and in a room only a short toast appears (nothing here decides progress or pay).
  const missionBtn = document.getElementById('missionBtn');
  const missionDialog = document.getElementById('missionDialog');
  const missionSummary = document.getElementById('missionSummary');
  const missionList = document.getElementById('missionList');
  let missionRequest = 0;

  function missionRow(item, { bonus = false, event = false } = {}) {
    const row = document.createElement('div');
    row.className = `missionRow${item.done ? ' done' : ''}`;
    row.setAttribute('role', 'listitem');
    const top = document.createElement('div');
    top.className = 'top';
    const title = document.createElement('span');
    title.textContent = `${item.done ? '✓ ' : ''}${item.title}`;
    const reward = document.createElement('span');
    reward.className = 'reward';
    reward.textContent = `+${Number(item.reward).toLocaleString('ko-KR')}P`;
    top.append(title, reward);
    row.appendChild(top);
    if (!bonus) {
      const bar = document.createElement('div');
      bar.className = 'bar';
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(item.target));
      bar.setAttribute('aria-valuenow', String(item.progress));
      bar.setAttribute('aria-label', item.title);
      const fill = document.createElement('i');
      fill.style.width = `${Math.round(item.progress / item.target * 100)}%`;
      bar.appendChild(fill);
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = `${item.progress}/${item.target}`;
      row.append(bar, count);
    } else {
      const note = document.createElement('span');
      note.className = 'count';
      note.textContent = event ? (item.done ? '받았습니다' : '수령 가능') : item.done ? '오늘 받았습니다' : '오늘 첫 승리 1회 · 무승부·공동승리 제외';
      row.appendChild(note);
    }
    return row;
  }

  function renderMissions(data) {
    missionBtn.textContent = `미션 ${data.doneCount}/${data.total}`;
    missionSummary.textContent = data.remainingReward > 0
      ? `오늘 더 받을 수 있는 포인트 ${Number(data.remainingReward).toLocaleString('ko-KR')}P`
      : '오늘 미션 보상을 모두 받았습니다';
    missionList.replaceChildren(...data.missions.map(item => missionRow(item)), missionRow({ ...data.firstWin }, { bonus: true }));
    if (data.weekly) renderWeekly(data.weekly);
  }

  // v1.7.18 weekly missions (Monday to Monday, Asia/Seoul): same rows as today's missions, plus the all-done bonus.
  const weeklySummary = document.getElementById('weeklySummary');
  const weeklyList = document.getElementById('weeklyList');
  function renderWeekly(data) {
    const [, month, day] = data.resetsOn.split('-').map(Number);
    weeklySummary.textContent = `${month}월 ${day}일(월) 0시에 새로 시작 · 이번 주 더 받을 수 있는 포인트 ${Number(data.remainingReward).toLocaleString('ko-KR')}P`;
    weeklyList.replaceChildren(...data.missions.map(item => missionRow(item)), missionRow({ title: data.bonus.title, reward: data.bonus.reward, done: data.bonus.done, progress: data.doneCount, target: data.total }));
  }

  async function loadMissions() {
    const ticket = ++missionRequest;
    try {
      const data = await api('/api/missions');
      if (ticket === missionRequest) renderMissions(data);
    } catch {}
  }

  // v1.7.17 achievements tab: one-time lifetime rewards computed by the server from the match record.
  const achievementSummary = document.getElementById('achievementSummary');
  const achievementList = document.getElementById('achievementList');
  const missionTabToday = document.getElementById('missionTabToday');
  const missionTabAchievements = document.getElementById('missionTabAchievements');
  const missionPanelToday = document.getElementById('missionPanelToday');
  const missionPanelAchievements = document.getElementById('missionPanelAchievements');
  let achievementRequest = 0;

  function renderAchievements(data) {
    achievementSummary.textContent = `달성 ${data.doneCount}/${data.total} · 받은 업적 보상 ${Number(data.earned).toLocaleString('ko-KR')}P`;
    const groups = new Map();
    for (const item of data.items) {
      if (!groups.has(item.group)) groups.set(item.group, { name: item.groupName, items: [] });
      groups.get(item.group).items.push(item);
    }
    const nodes = [];
    for (const [group, info] of groups) {
      const details = document.createElement('details');
      details.className = 'achGroup';
      details.open = group === 'variety';
      const summary = document.createElement('summary');
      const done = info.items.filter(item => item.done).length;
      summary.textContent = `${info.name}  ${done}/${info.items.length}`;
      const rows = document.createElement('div');
      rows.className = 'missionList';
      rows.setAttribute('role', 'list');
      rows.append(...info.items.map(item => missionRow(item)));
      details.append(summary, rows);
      nodes.push(details);
    }
    achievementList.replaceChildren(...nodes);
  }

  async function loadAchievements() {
    const ticket = ++achievementRequest;
    try {
      const data = await api('/api/achievements');
      if (ticket !== achievementRequest) return;
      renderAchievements(data);
      if (data.granted?.length) loadPoints(); // earned (and paid) just now
    } catch {}
  }

  const missionTabWeekly = document.getElementById('missionTabWeekly');
  const missionPanelWeekly = document.getElementById('missionPanelWeekly');
  // v1.8.9 events tab: every open point event from the same /api/events the lobby popup uses; a row opens that popup.
  const missionTabEvents = document.getElementById('missionTabEvents');
  const missionPanelEvents = document.getElementById('missionPanelEvents');
  const eventSummary = document.getElementById('eventSummary');
  const eventList = document.getElementById('eventList');
  let eventsTabRequest = 0;
  async function loadEventsTab() {
    const ticket = ++eventsTabRequest;
    try {
      const { events, account } = await api('/api/events');
      if (ticket !== eventsTabRequest) return;
      eventAccount = account;
      eventSummary.textContent = events.length ? `진행 중 ${events.length}개 · 받음 ${events.filter(ev => ev.claimed).length}개` : '진행 중인 이벤트가 없습니다.';
      eventList.replaceChildren(...events.map((event) => {
        const row = missionRow({ title: event.title, reward: event.rewardPoints, done: event.claimed }, { bonus: true, event: true });
        if (event.notice) row.querySelector('.reward').textContent = '안내'; // v1.10.33
        const open = document.createElement('button');
        open.type = 'button';
        open.className = event.claimed ? 'ghost tiny' : 'secondary tiny';
        open.textContent = event.notice ? '보기' : event.claimed ? '받음' : '받으러 가기';
        open.addEventListener('click', () => openEventDialog(event));
        row.append(open);
        return row;
      }));
    } catch {}
  }
  function selectMissionTab(name) {
    const tabs = { today: [missionTabToday, missionPanelToday], weekly: [missionTabWeekly, missionPanelWeekly], achievements: [missionTabAchievements, missionPanelAchievements], events: [missionTabEvents, missionPanelEvents] };
    for (const [key, [tab, panel]] of Object.entries(tabs)) {
      tab.setAttribute('aria-selected', String(key === name));
      panel.classList.toggle('hidden', key !== name);
    }
    if (name === 'achievements') loadAchievements(); else if (name === 'events') loadEventsTab(); else loadMissions(); // today and weekly share one response
  }
  missionTabWeekly.addEventListener('click', () => selectMissionTab('weekly'));
  missionTabToday.addEventListener('click', () => selectMissionTab('today'));
  missionTabAchievements.addEventListener('click', () => selectMissionTab('achievements'));
  missionTabEvents.addEventListener('click', () => selectMissionTab('events'));

  missionBtn.addEventListener('click', () => { missionDialog.showModal(); selectMissionTab('today'); });
  document.getElementById('missionCloseBtn').addEventListener('click', () => missionDialog.close());

  // v1.7.30 skin shop: a large modal like the player lookup. The server owns the catalog, prices, ownership and the
  // balance; this only lists them and sends "buy X" / "equip X". A purchase takes two clicks (the second one says
  // the price) so a stray click never spends points.
  const skinShopDialog = document.getElementById('skinShopDialog');
  let myInfoSkins = null; // { catalog, owned: Set, equipped } — 구매 기능 없이 보유 스킨만 표시
  let myInfoSkinFamily = null;
  let transformationPending = false;

  function applySkinEquipment(data) {
    for (const skins of [myInfoSkins, skinShop]) {
      if (!skins) continue;
      skins.equipped = data.equipped;
      skins.avatar = data.avatar;
    }
    plazaAvatar = data.avatar || plazaAvatar;
    applyPlazaAvatar();
    plazaLastSent = null;
  }

  function renderTransformationChoice(skins) {
    const transformations = window.CharacterTransformations;
    const look = skins.avatar?.look || skins.equipped?.avatar || {};
    const character = transformations?.match(look);
    if (!character || character.human || !character.variants?.current || !character.variants?.native) return null;
    const mode = transformations.modeOf(character, look);
    const row = document.createElement('div');
    row.className = 'skinTransformation';
    const name = document.createElement('strong');
    name.textContent = character.label;
    const choices = document.createElement('div');
    choices.className = 'skinTransformationChoices';
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', `${character.label} 체형`);
    choices.setAttribute('aria-busy', String(transformationPending));
    for (const [value, label] of [['current', '우리 체형'], ['native', '고유 체형']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ghost tiny${value === mode ? ' selected' : ''}`;
      button.dataset.action = 'transformation';
      button.dataset.character = character.id;
      button.dataset.mode = value;
      button.setAttribute('aria-pressed', String(value === mode));
      button.disabled = transformationPending;
      button.textContent = label;
      choices.append(button);
    }
    row.append(name, choices);
    return row;
  }

  async function changeTransformation(button, status) {
    if (transformationPending) return;
    const { character: characterId, mode } = button.dataset;
    if (button.getAttribute('aria-pressed') === 'true') return;
    const token = sessionToken;
    transformationPending = true;
    status.textContent = '';
    if (myInfoSkins) renderMyInfoSkins();
    if (skinShop) renderSkinShop();
    try {
      const data = await api('/api/avatar/transformation', { method: 'POST', body: JSON.stringify({ characterId, mode }) });
      if (token !== sessionToken) return;
      applySkinEquipment(data);
    } catch (error) {
      if (token === sessionToken) status.textContent = error.message;
    } finally {
      transformationPending = false;
      if (myInfoSkins) renderMyInfoSkins();
      if (skinShop) renderSkinShop();
    }
  }

  // v1.10.89 분류·검색 (사용자 2026-10-17 「내가 산 것도, 상점도 찾기 힘들다」): one filter bar for 상점 and 내 정보 -- name
  // search, 등급, (character skins) 시리즈, (상점) 보유 여부 -- each window keeping its own choice; the search redraws the
  // cards only (the box keeps the focus and a Korean word being typed)
  const SKIN_SERIES = [['basic', '기본'], ['animal', '동물 세트'], ['x2', '추가 의상'], ['ip', '캐릭터']];
  const seriesOf = (skin) => (skin.ip ? 'ip' : /^avatar_animal_/.test(skin.id) ? 'animal' : /^avatar_x2_/.test(skin.id) ? 'x2' : 'basic');
  const skinFilters = { shop: { q: '', tier: '', series: '', own: '' }, mine: { q: '', tier: '', series: '', own: '' } };
  const skinResults = { shop: null, mine: null }; // the cards' redraw of each window (the search calls it)
  function filterSkins(skins, f, owned) {
    const q = f.q.trim().toLowerCase();
    return skins.filter((s) => (!f.tier || s.tier === f.tier) && (!f.series || seriesOf(s) === f.series) && (!f.own || (f.own === 'owned') === owned.has(s.id))
      && (!q || [s.name, s.slotLabel, s.ip, s.character].some((t) => String(t || '').toLowerCase().includes(q))));
  }
  function skinFilterBar(view, skins, { own = false } = {}) {
    const f = skinFilters[view];
    const bar = document.createElement('div'); bar.className = 'skinFilterBar';
    const search = document.createElement('input'); search.type = 'search'; search.className = 'skinSearch'; search.placeholder = '이름 검색';
    search.setAttribute('aria-label', '이름으로 찾기'); search.value = f.q; search.dataset.view = view;
    const count = document.createElement('span'); count.className = 'skinCount';
    const top = document.createElement('div'); top.className = 'skinFilterTop'; top.append(search, count); bar.append(top);
    const chips = (key, label, options) => {
      if (f[key] && !options.some(([value]) => value === f[key])) f[key] = ''; // not in this list (another tab): all
      if (options.length < 2) return;
      const group = document.createElement('div'); group.className = 'skinChips'; group.setAttribute('role', 'group'); group.setAttribute('aria-label', label);
      for (const [value, text] of [['', `${label} 전체`], ...options]) {
        const b = document.createElement('button'); b.type = 'button'; b.className = `ghost tiny skinChip${f[key] === value ? ' selected' : ''}`;
        b.dataset.filter = key; b.dataset.value = value; b.setAttribute('aria-pressed', String(f[key] === value)); b.textContent = text; group.append(b);
      }
      bar.append(group);
    };
    chips('tier', '등급', SKIN_TIER_ORDER.filter((t) => skins.some((s) => s.tier === t)).map((t) => [t, skins.find((s) => s.tier === t).tierLabel]));
    chips('series', '시리즈', SKIN_SERIES.filter(([k]) => skins.some((s) => seriesOf(s) === k)));
    if (own) chips('own', '보유', [['missing', '안 산 것'], ['owned', '산 것']]);
    return bar;
  }
  function slotTabsOf(skins, current, { all = false } = {}) { // character skins: a tab per 부위 (and 전체 in 내 정보)
    const slots = [...new Set(skins.map((s) => s.slot))];
    const tabs = document.createElement('div'); tabs.className = 'skinTabs skinSlotTabs'; tabs.setAttribute('role', 'tablist');
    for (const slot of [...(all ? [''] : []), ...slots]) {
      const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'skinTab'; tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(slot === current)); tab.dataset.slot = slot;
      const label = slot ? skins.find((s) => s.slot === slot).slotLabel || slot : '전체'; tab.textContent = all ? `${label} ${slot ? skins.filter((s) => s.slot === slot).length : skins.length}` : label; // (내 정보 counts what I have)
      tabs.append(tab);
    }
    return tabs;
  }
  // 3-1 꾸미기 창 (사용자 2026-10-19, gamecenter-notes docs/shop-tryon-20261019.md): every dress-up window -- the 옷가게·
  // 미용실·소품 가게 (the skin shop's avatar parts), 성형외과·염색사, 변신 의상실, 내 정보's equipment -- shows my character
  // in 3D beside its list from the moment it opens (a phone: above it). Pointing at, focusing or pressing an item puts it
  // on there at once; nothing is bought or worn by that, and the preview goes with the window. Drag: turn · wheel or two
  // fingers: nearer/further · 정면/옆/뒤 · 걷기/서기. One preview at a time (plaza-scene tryOn).
  const tryOnHosts = { shop: 'skinShopTryOn', mine: 'myInfoTryOn' };
  const canTryOn = (skin) => skin.id.startsWith('avatar_') && skin.slot && typeof plaza.controller?.tryOn === 'function';
  const dressRooms = new Map(); // box -> { canvas, name }
  // (사용자 참고 그림 2026-10-19, docs/shop-tryon 「화면 모양」) the preview: a 「미리보기」 chip, my character on a round
  // pedestal over a light sky-and-grass stage, turn (drag) · nearer · further on the right, ◀ ▶ through 정면·옆·뒤·걷기 under
  // it, and a small 「착용 전 → 착용 후」 pair when the look differs from what I wear
  const DRESS_VIEWS = [['정면', 0, false], ['옆', Math.PI / 2, false], ['뒤', Math.PI, false], ['걷기', 0, true]];
  const dressShots = new Map(); let dressShotChain = Promise.resolve();
  const dressShot = (look) => { const key = JSON.stringify(look || {}); if (dressShots.has(key)) return Promise.resolve(dressShots.get(key));
    return (dressShotChain = dressShotChain.then(() => new Promise((done) => { let n = 0; if (!plaza.controller?.tryOnShot?.(look, (url) => { n += 1; if (n === 2) { dressShots.set(key, url); done(url); } })) done(null); }))); };
  function dressView(box, look, label, base = null) {
    if (!box || typeof plaza.controller?.tryOn !== 'function') return false;
    let room = dressRooms.get(box);
    if (!room || !box.contains(room.canvas)) {
      const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
      const stage = el('div', 'dressStage'); const canvas = el('canvas', 'dressCanvas'); canvas.setAttribute('role', 'img');
      const chip = el('span', 'dressChip', '미리보기'); const note = el('p', 'dressNote', '선택한 아이템을 착용한 모습을 3D로 미리 볼 수 있어요.');
      const side = el('div', 'dressSideTools');
      const tool = (parent, text, title, fn) => { const b = el('button', 'dressTool', text); b.type = 'button'; b.title = title; b.setAttribute('aria-label', title); b.addEventListener('click', fn); parent.append(b); return b; };
      tool(side, '⟲', '캐릭터 회전(끌어서 돌리기)', () => plaza.controller?.tryOnPose?.({ turn: Math.PI / 4 }));
      tool(side, '＋', '확대', () => plaza.controller?.tryOnPose?.({ zoom: 0.6 })); tool(side, '－', '축소', () => plaza.controller?.tryOnPose?.({ zoom: -0.6 }));
      const nav = el('div', 'dressNav'); const dots = el('span', 'dressDots'); let at = 0;
      const go = (k) => { at = (k + DRESS_VIEWS.length) % DRESS_VIEWS.length; const [name, yaw, walk] = DRESS_VIEWS[at]; plaza.controller?.tryOnPose?.({ yaw, walk }); dots.replaceChildren(...DRESS_VIEWS.map((v, n) => { const d = el('i', n === at ? 'on' : ''); d.title = v[0]; return d; })); dots.title = name; };
      tool(nav, '‹', '이전 모습', () => go(at - 1)); nav.append(dots); tool(nav, '›', '다음 모습', () => go(at + 1)); go(0);
      const compare = el('div', 'dressCompare hidden'); const fig = (cap) => { const f = el('figure'); const img = el('img'); img.alt = cap; f.append(img, el('figcaption', '', cap)); compare.append(f); return img; };
      const before = fig('착용 전'); compare.append(el('span', 'dressArrow', '›')); const after = fig('착용 후');
      const touches = new Map(); let pinch = 0;
      canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); touches.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; });
      canvas.addEventListener('pointermove', (e) => {
        const was = touches.get(e.pointerId); if (!was) return; touches.set(e.pointerId, [e.clientX, e.clientY]);
        if (touches.size === 1) plaza.controller?.tryOnPose?.({ turn: (e.clientX - was[0]) * 0.012 });
        else if (touches.size === 2) { const [a, b] = [...touches.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch) plaza.controller?.tryOnPose?.({ zoom: (d - pinch) * 0.02 }); pinch = d; }
      });
      for (const end of ['pointerup', 'pointercancel']) canvas.addEventListener(end, (e) => { touches.delete(e.pointerId); pinch = 0; });
      canvas.addEventListener('wheel', (e) => { e.preventDefault(); plaza.controller?.tryOnPose?.({ zoom: -e.deltaY * 0.004 }); }, { passive: false });
      stage.append(chip, note, el('div', 'dressPedestal'), canvas, side, nav, compare);
      const name = el('strong', 'dressName'); const cap = el('div', 'skinTryOnCap'); cap.append(name);
      box.replaceChildren(stage, cap); room = { canvas, name, compare, before, after, shown: '' }; dressRooms.set(box, room);
    }
    box.classList.remove('hidden'); room.name.textContent = label; room.canvas.setAttribute('aria-label', `${label} -- 내 캐릭터`);
    if (!plaza.controller.tryOn(room.canvas, look || {})) { closeDress(box); return false; }
    // 착용 전 → 착용 후 (only when it differs; the pictures come once the models are in)
    const key = JSON.stringify([base, look]); const differs = base && JSON.stringify(base) !== JSON.stringify(look || {});
    room.compare.classList.toggle('hidden', !differs);
    if (differs && room.shown !== key && typeof plaza.controller?.tryOnShot === 'function') {
      room.shown = key; dressShot(base).then((url) => { if (room.shown === key && url) room.before.src = url; }).then(() => dressShot(look)).then((url) => { if (room.shown === key && url) room.after.src = url; });
    }
    return true;
  }
  function closeDress(box) { if (!box || !dressRooms.has(box)) return; box.classList.add('hidden'); box.replaceChildren(); dressRooms.delete(box); plaza.controller?.tryOnClose?.(); }
  // an item's card or button: pointing at it, focusing it or pressing it shows it on (the look: what I wear with it)
  function dressOnHover(el, box, look, label) { const show = () => dressView(box, look(), label); el.addEventListener('pointerenter', show); el.addEventListener('focusin', show); el.addEventListener('click', show); }
  // (2026-10-20 내 정보 변신 온·오프: while transformed, another item is shown on me untransformed -- the island keeps the transformation)
  const tryOnLook = (base, skin) => { const look = { ...base, [skin.slot]: skin.id }; if (skin.slot !== 'transform') delete look.transform; return look; };
  const tryOnLabel = (base, skin) => `${skin.name} · ${skin.slotLabel || ''}${base.transform && skin.slot !== 'transform' ? ' · 변신 중이라 섬에서는 변신 모습이에요' : ''}`;
  function showTryOn(view, skins, skin) { const base = skins.avatar?.look || {}; dressView(document.getElementById(tryOnHosts[view]), tryOnLook(base, skin), tryOnLabel(base, skin)); }
  function hideTryOn(view) { closeDress(document.getElementById(tryOnHosts[view])); }
  const dressPicked = { shop: null, mine: null }; // the card picked in each window (its skin id)
  function skinCardButtons(card, skin, view, skins) {
    if (!canTryOn(skin)) return;
    const box = document.getElementById(tryOnHosts[view]); const base = () => skins.avatar?.look || {}; const look = () => tryOnLook(base(), skin);
    card.dataset.pick = skin.id; card.classList.toggle('selected', dressPicked[view] === skin.id);
    card.addEventListener('pointerenter', () => dressView(box, look(), tryOnLabel(base(), skin), base()));
    card.addEventListener('click', (event) => { // (its own button still does its own thing -- the bar's buttons press it)
      dressPicked[view] = skin.id; for (const c of card.parentElement.parentElement.parentElement.querySelectorAll('.skinCard.selected')) c.classList.remove('selected'); card.classList.add('selected');
      dressView(box, look(), tryOnLabel(base(), skin), base()); dressDetail(view, skin); dressBarSync(view);
      if (event.target.closest('button')) return;
    });
    if (dressPicked[view] === skin.id) { dressDetail(view, skin); }
  }
  // 아래 상세 띠: the picked item -- its picture, name, tags (grade, slot, character), a line about it
  const dressBars = { shop: null, mine: null };
  function dressParts(view) {
    if (dressBars[view]?.isConnected) return dressBars[view];
    const host = view === 'shop' ? skinShopDialog : document.getElementById('myInfoTryOn').closest('.myInfoSection');
    const detail = document.createElement('div'); detail.className = 'dressDetail hidden';
    const bar = document.createElement('div'); bar.className = 'dressBar';
    const points = document.createElement('span'); points.className = 'dressPoints';
    const make = (cls, text, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text; b.addEventListener('click', fn); bar.append(b); return b; };
    bar.append(points);
    const press = (action) => { const id = dressPicked[view]; const body = view === 'shop' ? skinShopBody : myInfoSkinBody; body.querySelector(`.skinCard[data-pick="${id}"] button[data-skin="${id}"]`)?.click(); };
    const buy = make('dressBuy', '구매', () => press('buy')); const wear = make('dressWear', '착용', () => press('equip'));
    if (view !== 'shop') { buy.hidden = true; points.hidden = true; } // (bugs 11: 내 정보 wears and takes off -- buying is the shops')
    const gift = make('dressGift', '선물하기', () => openSkinGift(view)); gift.hidden = view !== 'shop'; // (3-1 사용자 2026-10-19 「선물 허용으로」: from the shop, for someone else)
    make('dressClose', '닫기', () => (view === 'shop' ? skinShopDialog : myInfoDialog).close());
    const giftForm = document.createElement('form'); giftForm.className = 'dressGiftForm hidden';
    host.append(detail, giftForm, bar); dressBars[view] = bar; Object.assign(bar, { detail, points, buy, wear, gift, giftForm });
    return bar;
  }
  // 3-1 스킨 선물 (사용자 2026-10-19 「선물 허용으로」「우체국으로 쪽지 오는걸로」): the picked skin for someone with an account (the
  // 우체통's list), a note if I like; I pay, it is theirs, the note comes to their 우체통
  async function openSkinGift(view) {
    const bar = dressParts(view); const id = dressPicked[view]; const skin = skinShop?.catalog.flatMap((fam) => fam.skins).find((x) => x.id === id); if (!skin) return;
    const form = bar.giftForm; form.classList.remove('hidden'); form.replaceChildren();
    let people = []; try { people = (await api('/api/island/mail')).people || []; } catch (error) { showToast(error.message); }
    const head = document.createElement('strong'); head.textContent = `${skin.name} 선물하기 · ${skinPrice(skin.price)}`;
    const who = document.createElement('select'); who.required = true; who.setAttribute('aria-label', '받는 사람');
    who.append(Object.assign(document.createElement('option'), { value: '', textContent: '받는 사람 고르기' }), ...people.map((p) => Object.assign(document.createElement('option'), { value: p.id, textContent: p.label })));
    const note = document.createElement('input'); note.type = 'text'; note.maxLength = 200; note.placeholder = '함께 보낼 쪽지(비워 두면 「선물했어요!」)'; note.setAttribute('aria-label', '쪽지');
    const send = document.createElement('button'); send.type = 'submit'; send.className = 'dressGift'; send.textContent = '보내기';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'ghost'; cancel.textContent = '취소'; cancel.addEventListener('click', () => form.classList.add('hidden'));
    const status = document.createElement('p'); status.className = 'smallMuted'; status.setAttribute('role', 'status');
    form.append(head, who, note, send, cancel, status);
    const requestId = crypto.randomUUID(); // (one per form: a lost answer is never paid twice)
    who.addEventListener('change', async () => { // (as they are picked: one who has it already cannot get it)
      status.textContent = ''; send.disabled = !who.value; if (!who.value) return;
      try { const c = await api('/api/skins/gift/check', { method: 'POST', body: JSON.stringify({ skinId: skin.id, to: who.value }) }); if (c.owned) { status.textContent = `${who.selectedOptions[0].textContent}님은 이미 가지고 있어요.`; send.disabled = true; } } catch {}
    });
    form.onsubmit = async (event) => {
      event.preventDefault(); if (!who.value) { status.textContent = '받는 사람을 골라 주세요.'; return; }
      const name = who.selectedOptions[0].textContent;
      if (!window.confirm(`${name}님에게 ${skin.name}을(를) ${skinPrice(skin.price)}에 선물할까요?`)) return;
      send.disabled = true;
      try {
        const out = await api('/api/skins/gift', { method: 'POST', body: JSON.stringify({ skinId: skin.id, to: who.value, text: note.value, requestId }) });
        showToast(`${out.to}님에게 ${skin.name}을(를) 보냈어요. 우체통으로 쪽지가 가요.`); form.classList.add('hidden'); loadPoints(); loadSkinShop();
      } catch (error) { status.textContent = error.message; send.disabled = false; }
    };
  }
  function dressDetail(view, skin) {
    const { detail } = dressParts(view); detail.classList.remove('hidden');
    const name = document.createElement('strong'); name.textContent = skin.name;
    const tags = document.createElement('span'); tags.className = 'dressTags';
    for (const t of [skin.slotLabel, skin.tierLabel, skin.ip ? `${skin.ip} 캐릭터` : null].filter(Boolean)) { const c = document.createElement('i'); c.textContent = t; tags.append(c); }
    const line = document.createElement('p'); line.textContent = '지금 입은 모습에 이것만 바꿔 입어요. 사기 전에 오른쪽에서 미리 입어 볼 수 있어요.';
    detail.replaceChildren(name, tags, line);
  }
  // 맨 아래 버튼 줄: 보유 포인트 · 구매(초록) · 착용(파랑) · 선물하기(분홍) · 닫기 -- 구매·착용 press the picked card's own button
  function dressBarSync(view) {
    const bar = dressParts(view); const skins = view === 'shop' ? skinShop : myInfoSkins; if (!skins) return;
    bar.points.textContent = skinPrice(skins.balance ?? 0); bar.points.title = `보유 포인트 ${skinPrice(skins.balance ?? 0)}`; bar.points.setAttribute('aria-label', bar.points.title);
    const id = dressPicked[view]; const own = (view === 'shop' ? skinShopBody : myInfoSkinBody).querySelector(`.skinCard[data-pick="${id}"] button[data-skin="${id}"]`);
    const act = own?.dataset.action; bar.buy.disabled = act !== 'buy'; bar.wear.disabled = !(act === 'equip' || act === 'unequip');
    bar.buy.textContent = act === 'buy' ? own.textContent : own && !act ? own.textContent : act ? '보유' : '구매'; bar.wear.textContent = act === 'unequip' ? '벗기' : '착용';
    const pickedSkin = id && skins.catalog?.flatMap((fam) => fam.skins).find((x) => x.id === id); bar.gift.disabled = !pickedSkin || Boolean(pickedSkin.ip) || (skins.balance ?? 0) < pickedSkin.price; // (3-1 선물: a picked skin I can pay for, never an IP one)
    bar.gift.title = pickedSkin?.ip ? 'IP 스킨은 선물할 수 없어요' : '';
  }
  // the window opened: what I wear now, before anything is pointed at
  function dressStart(view, skins, on) {
    const box = document.getElementById(tryOnHosts[view]); (view === 'shop' ? skinShopDialog : box?.closest('.myInfoSection'))?.classList.toggle('dressing', Boolean(on));
    if (!on) { closeDress(box); return; }
    if (!dressRooms.has(box)) dressView(box, skins.avatar?.look || {}, '지금 내 모습');
  }

  let myInfoSkinSlot = '';
  // (사용자 2026-10-20 「캐릭터 변신도 내 정보에서 다른 스킨 장착할 때 온·오프」) the transformations I own, on and off here as
  // at the 변신 의상실 -- what else I wear stays saved under it and shows again once it is off; buying stays the 의상실's
  let myTransforms = null; let myTransformBusy = false;
  function transformBlock() {
    const box = document.createElement('div'); box.className = 'myTransforms'; box.id = 'myTransforms';
    const act = (t, label, cls) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = label; b.dataset.transform = t.character;
      b.addEventListener('click', async () => {
        if (myTransformBusy) return; myTransformBusy = true; b.disabled = true;
        try {
          const data = await api('/api/skins/equip', { method: 'POST', body: JSON.stringify(t.chosen ? { skinId: null, game: 'avatar', slot: 'transform' } : { skinId: t.skinId }) });
          applySkinEquipment(data); myTransforms = (await api('/api/transformations')).list; showToast(t.chosen ? '변신을 풀었어요' : `${t.name}(으)로 변신했어요`); renderMyInfoSkins();
        } catch (error) { showToast(error.message, 4000); } finally { myTransformBusy = false; b.disabled = false; }
      });
      return b;
    };
    const draw = () => {
      const owned = (myTransforms || []).filter((t) => t.owned); const on = owned.find((t) => t.chosen);
      const line = document.createElement('div'); line.className = 'myTransformLine';
      const text = document.createElement('strong'); text.textContent = on ? `변신 중: ${on.name}` : '변신 안 함'; line.append(text);
      if (on) line.append(act(on, '풀기', 'ghost tiny'));
      const list = document.createElement('div'); list.className = 'myTransformList'; list.setAttribute('role', 'list');
      for (const t of owned) {
        const row = document.createElement('div'); row.className = `myTransformRow${t.chosen ? ' chosen' : ''}`; row.setAttribute('role', 'listitem');
        const name = document.createElement('span'); name.textContent = t.name;
        row.append(name, act(t, t.chosen ? '변신 풀기' : '변신하기', t.chosen ? 'ghost tiny' : 'primary tiny'));
        dressOnHover(row, document.getElementById(tryOnHosts.mine), () => ({ ...(myInfoSkins?.avatar?.look || {}), transform: t.character }), t.name);
        list.append(row);
      }
      const hint = document.createElement('p'); hint.className = 'lookMeta'; hint.textContent = '변신은 백화점 변신 의상실에서 살 수 있어요.';
      box.replaceChildren(line, owned.length ? list : hint);
    };
    if (myTransforms) draw();
    api('/api/transformations').then((r) => { myTransforms = r.list; if (box.isConnected) draw(); }).catch(() => {});
    return box;
  }
  function renderMyInfoSkins() {
    myInfoSkinBody.replaceChildren();
    if (!myInfoSkins) return;
    dressStart('mine', myInfoSkins, typeof plaza.controller?.tryOn === 'function'); // (3-1: my character beside what I own)
    const families = myInfoSkins.catalog
      .map((family) => ({ ...family, skins: family.skins.filter((skin) => myInfoSkins.owned.has(skin.id)) }))
      .filter((family) => family.skins.length || (family.family === 'avatar' && [...myInfoSkins.owned].some((id) => id.startsWith('avatar_tf_')))); // (a transformation alone: its on/off is here -- 2026-10-21 its parts are gone)
    if (!families.length) {
      const empty = document.createElement('p');
      empty.className = 'emptyState';
      empty.textContent = '보유한 스킨이 없습니다.';
      myInfoSkinBody.append(empty);
      return;
    }
    if (!families.some((family) => family.family === myInfoSkinFamily)) myInfoSkinFamily = families[0].family;
    const tabs = document.createElement('div');
    tabs.className = 'skinTabs';
    tabs.setAttribute('role', 'tablist');
    for (const family of families) {
      const tab = document.createElement('button');
      tab.type = 'button'; tab.className = 'skinTab'; tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(family.family === myInfoSkinFamily));
      tab.dataset.family = family.family;
      tab.textContent = `${family.name} ${family.skins.length}`; // v1.10.89: how many in each
      tabs.append(tab);
    }
    myInfoSkinBody.append(tabs);
    const family = families.find((item) => item.family === myInfoSkinFamily);
    if (!family) return;
    if (family.family === 'avatar') {
      myInfoSkinBody.append(transformBlock()); // (2026-10-20: on and off here too)
      const choice = renderTransformationChoice(myInfoSkins);
      if (choice) myInfoSkinBody.append(choice);
    }
    let skinsHere = family.skins;
    if (family.family === 'avatar') { // v1.10.89: 부위 tabs (전체 first)
      if (myInfoSkinSlot && !skinsHere.some((s) => s.slot === myInfoSkinSlot)) myInfoSkinSlot = '';
      myInfoSkinBody.append(slotTabsOf(skinsHere, myInfoSkinSlot, { all: true }));
      if (myInfoSkinSlot) skinsHere = skinsHere.filter((s) => s.slot === myInfoSkinSlot);
    }
    myInfoSkinBody.append(skinFilterBar('mine', skinsHere));
    const results = document.createElement('div'); results.className = 'skinResults'; myInfoSkinBody.append(results);
    const fill = () => {
      results.replaceChildren();
      const shown = filterSkins(skinsHere, skinFilters.mine, myInfoSkins.owned);
      myInfoSkinBody.querySelector('.skinCount').textContent = `${shown.length}개`;
      if (!shown.length) { const p = document.createElement('p'); p.className = 'emptyState'; p.textContent = '조건에 맞는 스킨이 없습니다.'; results.append(p); }
      for (const tierKey of SKIN_TIER_ORDER) {
        const skins = shown.filter((skin) => skin.tier === tierKey);
        if (!skins.length) continue;
        const section = document.createElement('section');
        section.className = 'skinFamily';
        const heading = document.createElement('h3');
        heading.textContent = skins[0].tierLabel;
        const grid = document.createElement('div');
        grid.className = 'skinGrid';
        for (const skin of skins) {
          const equipped = myInfoSkins.equipped?.[family.family]?.[skin.slot] === skin.id;
          const card = document.createElement('div');
          card.className = `skinCard${equipped ? ' equipped' : ''}`;
          // (bugs 11: no picture where my 3D look is beside the list -- one line each, and no canvas painted)
          const noPic = family.family === 'avatar' && typeof plaza.controller?.tryOn === 'function';
          const preview = noPic ? null : document.createElement('canvas');
          if (preview) {
            preview.width = 260; preview.height = 130;
            preview.setAttribute('role', 'img');
            preview.setAttribute('aria-label', `${skin.name} 미리보기`);
            window.SkinLooks?.paintPreview(preview, skin.id);
          } else card.classList.add('noPic');
          const name = document.createElement('span');
          name.className = 'skinName'; name.textContent = skin.name;
          const meta = document.createElement('span');
          meta.className = 'skinMeta';
          meta.textContent = `${skin.slotLabel ? `${skin.tierLabel} · ${skin.slotLabel}` : skin.tierLabel}${skin.ip ? ` · ${skin.ip} 캐릭터` : ''}`; // v1.10.74: a character skin names its owner
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.skin = skin.id;
          button.disabled = transformationPending;
          if (equipped) {
            button.className = 'ghost';
            button.textContent = '장착 중 · 해제';
            button.dataset.action = 'unequip';
            button.dataset.slot = skin.slot;
            button.dataset.game = family.family;
          } else {
            button.className = 'secondary';
            button.textContent = '장착';
            button.dataset.action = 'equip';
          }
          card.append(...(preview ? [preview] : []), name, meta, button);
          skinCardButtons(card, skin, 'mine', myInfoSkins);
          grid.append(card);
        }
        section.append(heading, grid);
        results.append(section);
      }
    };
    skinResults.mine = () => { fill(); if (typeof plaza.controller?.tryOn === 'function') dressBarSync('mine'); }; skinResults.mine();
  }

  async function loadMyInfoSkins() {
    myInfoSkinStatus.textContent = '';
    try {
      const data = await api('/api/skins');
      myInfoSkins = { catalog: data.catalog, owned: new Set(data.owned), equipped: data.equipped, avatar: data.avatar };
      renderMyInfoSkins();
    } catch (error) {
      if (myInfoDialog.open) myInfoSkinStatus.textContent = `보유 스킨을 불러오지 못했습니다 · ${error.message}`;
    }
  }

  myInfoSkinBody.addEventListener('click', async (event) => {
    const tab = event.target.closest('button.skinTab');
    if (tab && myInfoSkins) { if (tab.dataset.slot !== undefined) myInfoSkinSlot = tab.dataset.slot; else { myInfoSkinFamily = tab.dataset.family; myInfoSkinSlot = ''; } renderMyInfoSkins(); return; }
    const chip = event.target.closest('button.skinChip');
    if (chip && myInfoSkins) { skinFilters.mine[chip.dataset.filter] = chip.dataset.value; renderMyInfoSkins(); return; }
    const button = event.target.closest('button[data-action]');
    if (!button || !myInfoSkins) return;
    if (button.dataset.action === 'transformation') { await changeTransformation(button, myInfoSkinStatus); return; }
    if (transformationPending) return;
    myInfoSkinStatus.textContent = '';
    const { action, skin: skinId } = button.dataset;
    try {
      if (action === 'equip') {
        const data = await api('/api/skins/equip', { method: 'POST', body: JSON.stringify({ skinId }) });
        applySkinEquipment(data);
      } else if (action === 'unequip') {
        const data = await api('/api/skins/equip', { method: 'POST', body: JSON.stringify({ skinId: null, game: button.dataset.game, slot: button.dataset.slot }) });
        applySkinEquipment(data);
      }
      renderMyInfoSkins();
      if (skinShop) { skinShop.equipped = myInfoSkins.equipped; renderSkinShop(); }
    } catch (error) {
      myInfoSkinStatus.textContent = error.message;
      loadMyInfoSkins();
    }
  });

  for (const [body, view] of [[myInfoSkinBody, 'mine'], [document.getElementById('skinShopBody'), 'shop']]) { // v1.10.89: the search redraws the cards only
    body.addEventListener('input', (event) => { if (!event.target.matches('input.skinSearch')) return; skinFilters[view].q = event.target.value; skinResults[view]?.(); });
  }
  myInfoDialog.addEventListener('close', () => hideTryOn('mine'));
  skinShopDialog.addEventListener('close', () => hideTryOn('shop'));
  myInfoBtn.addEventListener('click', () => {
    setPointHistoryOpen(false);
    myInfoDialog.showModal(); refreshBirthday(); renderFriends(); // B 47 생일, 묶음 4 친구
    loadPoints();
    loadMyInfoSkins();
  });
  myInfoCloseBtn.addEventListener('click', () => myInfoDialog.close());
  myInfoDialog.addEventListener('close', () => setPointHistoryOpen(false));
  const skinShopBody = document.getElementById('skinShopBody');
  const skinShopBalance = document.getElementById('skinShopBalance');
  const skinShopStatus = document.getElementById('skinShopStatus');
  let skinShop = null; // { catalog, owned: Set, equipped, balance }
  let skinBuyArmed = null;
  let skinBuyTimer = 0;
  const skinPrice = (n) => `${Number(n).toLocaleString('ko-KR')}P`;

  let skinShopFamily = null;
  let skinShopMode = 'all'; // v1.10.1 게임 아일랜드: 'game' (game skins) or 'avatar' (character skins) by which shop was entered
  const SKIN_SHOP_TITLES = { all: '상점', game: '게임 스킨 상점', avatar: '캐릭터 스킨 상점', 'avatar:outfit': '옷가게', 'avatar:hair': '미용실', 'avatar:hat': '소품 가게' }; // (v1.10.91: was 잡화점)
  const SKIN_TIER_ORDER = ['common', 'premium', 'rare', 'theme', 'legend']; // v1.10.32 희귀: character skins
  // v1.10.32: the slots each character shop sells (잡화점: the five accessory slots, one tab each)
  const SHOP_SLOTS = { 'avatar:outfit': ['outfit'], 'avatar:hair': ['hair'], 'avatar:hat': ['hat', 'cape', 'tail', 'shoes', 'necklace'] };
  let skinShopSlot = null;
  let skinShopEpoch = 0;
  function renderSkinShop() {
    skinShopBody.textContent = '';
    if (!skinShop) return;
    skinShopBalance.textContent = `보유 ${skinPrice(skinShop.balance)}`;
    const avatarMode = skinShopMode.startsWith('avatar');
    dressStart('shop', skinShop, avatarMode && typeof plaza.controller?.tryOn === 'function'); // (3-1: the parts shops -- my character beside the list)
    const families = skinShop.catalog.filter(f => skinShopMode === 'all' || avatarMode === (f.family === 'avatar'));
    if (!families.some(f => f.family === skinShopFamily)) skinShopFamily = families[0]?.family;
    const tabs = document.createElement('div');
    tabs.className = 'skinTabs';
    tabs.setAttribute('role', 'tablist');
    for (const family of families) {
      const tab = document.createElement('button');
      tab.type = 'button'; tab.className = 'skinTab'; tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(family.family === skinShopFamily));
      tab.dataset.family = family.family;
      tab.textContent = family.name;
      tabs.append(tab);
    }
    skinShopBody.append(tabs);
    const family = families.find(f => f.family === skinShopFamily);
    if (!family) return;
    if (family.family === 'avatar') {
      const choice = renderTransformationChoice(skinShop);
      if (choice) skinShopBody.append(choice);
    }
    // character skins: one slot at a time (v1.10.30 one shop per kind; v1.10.32 a tab per slot where a shop has several)
    let slotOnly = null;
    if (family.family === 'avatar') {
      const slots = SHOP_SLOTS[skinShopMode] || [...new Set(family.skins.map(skin => skin.slot))];
      if (!slots.includes(skinShopSlot)) skinShopSlot = slots[0];
      slotOnly = skinShopSlot;
      if (slots.length > 1) skinShopBody.append(slotTabsOf(family.skins.filter(skin => slots.includes(skin.slot)), slotOnly));
    }
    const skinsHere = family.skins.filter(skin => !slotOnly || skin.slot === slotOnly);
    skinShopBody.append(skinFilterBar('shop', skinsHere, { own: true })); // v1.10.89 검색·등급·시리즈·보유
    const results = document.createElement('div'); results.className = 'skinResults'; skinShopBody.append(results);
    const fill = () => {
      results.replaceChildren();
      const shown = filterSkins(skinsHere, skinFilters.shop, skinShop.owned);
      skinShopBody.querySelector('.skinCount').textContent = `${shown.length}개`;
      if (!shown.length) { const p = document.createElement('p'); p.className = 'emptyState'; p.textContent = '조건에 맞는 스킨이 없습니다.'; results.append(p); }
      for (const tierKey of SKIN_TIER_ORDER) {
        const skins = shown.filter(skin => skin.tier === tierKey);
        if (!skins.length) continue;
        const section = document.createElement('section');
        section.className = 'skinFamily';
        const heading = document.createElement('h3');
        heading.textContent = skins[0].tierLabel;
        const grid = document.createElement('div');
        grid.className = 'skinGrid';
        for (const skin of skins) {
          const owned = skinShop.owned.has(skin.id);
          const equipped = skinShop.equipped?.[family.family]?.[skin.slot] === skin.id;
          const card = document.createElement('div');
          card.className = `skinCard${equipped ? ' equipped' : ''}`;
          // (bugs 11: no picture where my 3D look is beside the list -- one line each, and no canvas painted)
          const noPic = family.family === 'avatar' && typeof plaza.controller?.tryOn === 'function';
          const preview = noPic ? null : document.createElement('canvas');
          if (preview) {
            preview.width = 260; preview.height = 130;
            preview.setAttribute('role', 'img');
            preview.setAttribute('aria-label', `${skin.name} 미리보기`);
            window.SkinLooks?.paintPreview(preview, skin.id);
          } else card.classList.add('noPic');
          const name = document.createElement('span');
          name.className = 'skinName';
          name.textContent = skin.name;
          const meta = document.createElement('span');
          meta.className = 'skinMeta';
          const tier = document.createElement('span'); tier.textContent = `${skin.slotLabel ? `${skin.tierLabel} · ${skin.slotLabel}` : skin.tierLabel}${skin.ip ? ` · ${skin.ip} 캐릭터` : ''}`; // v1.10.74
          const price = document.createElement('span'); price.textContent = owned ? '보유 중' : skinPrice(skin.price);
          meta.append(tier, price);
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.skin = skin.id;
          button.disabled = transformationPending;
          if (equipped) { button.className = 'ghost'; button.textContent = '장착 중 · 해제'; button.dataset.action = 'unequip'; button.dataset.slot = skin.slot; button.dataset.game = family.family; }
          else if (owned) { button.className = 'secondary'; button.textContent = '장착'; button.dataset.action = 'equip'; }
          else if (skinShop.balance < skin.price) { button.className = 'ghost'; button.textContent = '포인트 부족'; button.disabled = true; }
          else { button.className = 'primary'; button.dataset.action = 'buy'; button.textContent = skinBuyArmed === skin.id ? `한 번 더 누르면 ${skinPrice(skin.price)} 결제` : `구매 ${skinPrice(skin.price)}`; }
          card.append(...(preview ? [preview] : []), name, meta, button);
          skinCardButtons(card, skin, 'shop', skinShop);
          grid.append(card);
        }
        section.append(heading, grid);
        results.append(section);
      }
    };
    skinResults.shop = () => { fill(); if (avatarMode) dressBarSync('shop'); }; skinResults.shop();
    if (family.family === 'avatar' && (!slotOnly || slotOnly === 'outfit')) skinShopBody.append(renderTitlePicker());
  }

  // v1.9.2 광장 칭호: any owned legend skin's name can be worn under the player's name in the plaza.
  function renderTitlePicker() {
    const section = document.createElement('section');
    section.className = 'skinFamily skinTitles';
    const heading = document.createElement('h3');
    heading.textContent = '칭호';
    const list = document.createElement('div');
    list.className = 'skinTitleList';
    const current = skinShop.equipped?.avatar?.title || null;
    const legends = [...skinShop.catalog.flatMap(f => f.family === 'avatar' ? [] : f.skins.filter(s => s.tier === 'legend' && skinShop.owned.has(s.id))), ...(skinShop.dexTitles || [])]; // v1.10.42 + 도감 칭호
    for (const skin of [{ id: null, name: '칭호 없음' }, ...legends]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `ghost tiny skinTitle${(skin.id || null) === current ? ' selected' : ''}`;
      button.setAttribute('aria-pressed', String((skin.id || null) === current));
      button.dataset.action = 'title';
      button.dataset.skin = skin.id || '';
      button.textContent = skin.name;
      button.disabled = transformationPending;
      list.append(button);
    }
    section.append(heading, list);
    return section;
  }

  async function loadSkinShop() {
    const epoch = ++skinShopEpoch; const mode = skinShopMode; const token = sessionToken;
    skinShopStatus.textContent = '';
    try {
      const data = await api('/api/skins');
      if (epoch !== skinShopEpoch || mode !== skinShopMode || token !== sessionToken || !skinShopDialog.open) return;
      skinShop = { catalog: data.catalog, owned: new Set(data.owned), equipped: data.equipped, avatar: data.avatar, balance: data.balance, dexTitles: data.dexTitles || [] };
      renderSkinShop();
    } catch (error) {
      if (epoch === skinShopEpoch && token === sessionToken && skinShopDialog.open) skinShopStatus.textContent = `상점을 불러오지 못했습니다 · ${error.message}`;
    }
  }

  skinShopBody.addEventListener('click', async (event) => {
    const tab = event.target.closest('button.skinTab');
    if (tab && skinShop) { if (tab.dataset.slot) skinShopSlot = tab.dataset.slot; else skinShopFamily = tab.dataset.family; skinBuyArmed = null; renderSkinShop(); return; }
    const chip = event.target.closest('button.skinChip');
    if (chip && skinShop) { skinFilters.shop[chip.dataset.filter] = chip.dataset.value; skinBuyArmed = null; renderSkinShop(); return; }
    const button = event.target.closest('button[data-action]');
    if (!button || !skinShop) return;
    if (button.dataset.action === 'transformation') { await changeTransformation(button, skinShopStatus); return; }
    if (transformationPending) return;
    const { action, skin: skinId } = button.dataset;
    const epoch = skinShopEpoch; const shop = skinShop; const token = sessionToken;
    const current = () => epoch === skinShopEpoch && shop === skinShop && token === sessionToken && skinShopDialog.open;
    skinShopStatus.textContent = '';
    try {
      if (action === 'buy') {
        if (skinBuyArmed !== skinId) { // first click: ask again, forget the ask after a few seconds
          skinBuyArmed = skinId;
          clearTimeout(skinBuyTimer);
          skinBuyTimer = setTimeout(() => { skinBuyArmed = null; renderSkinShop(); }, 4000);
          renderSkinShop();
          return;
        }
        skinBuyArmed = null;
        const data = await api('/api/skins/buy', { method: 'POST', body: JSON.stringify({ skinId }) });
        if (!current()) return;
        skinShop.owned.add(skinId);
        skinShop.balance = data.balance;
        skinShopStatus.textContent = '';
      } else if (action === 'equip') {
        const data = await api('/api/skins/equip', { method: 'POST', headers: { 'X-Island-Facility': 'shop' }, body: JSON.stringify({ skinId }) });
        if (!current()) return;
        applySkinEquipment(data);
      } else if (action === 'unequip') {
        const data = await api('/api/skins/equip', { method: 'POST', headers: { 'X-Island-Facility': 'shop' }, body: JSON.stringify({ skinId: null, game: button.dataset.game, slot: button.dataset.slot }) });
        if (!current()) return;
        applySkinEquipment(data);
      } else if (action === 'title') {
        const data = await api('/api/skins/title', { method: 'POST', headers: { 'X-Island-Facility': 'shop' }, body: JSON.stringify({ skinId: skinId || null }) });
        if (!current()) return;
        applySkinEquipment(data);
      }
      renderSkinShop();
    } catch (error) {
      if (!current()) return;
      skinBuyArmed = null;
      skinShopStatus.textContent = error.message;
      loadSkinShop();
    }
  });
  // v1.10.91 변신 의상실 (사용자 2026-10-18, A안): transformations bought and chosen here, apart from the parts -- a card per
  // character: buy (a confirm with the price), 변신하기 / 변신 풀기, and its body (우리 체형 / 고유 체형) once chosen
  const tfCard = document.createElement('div'); tfCard.className = 'tfShop'; tfCard.id = 'transformShop';
  const tfDress = document.createElement('div'); tfDress.className = 'skinTryOn dressSide hidden'; tfDress.setAttribute('aria-live', 'polite');
  const tfRoom = document.createElement('div'); tfRoom.className = 'dressRoom'; tfRoom.append(tfCard, tfDress); // (3-1 꾸미기 창)
  let tfBusy = false;
  async function drawTransformShop() {
    const { list } = await api('/api/transformations');
    const note = document.createElement('p'); note.className = 'lookMeta'; note.textContent = '파츠를 입는 것만으로는 변신하지 않아요. 변신은 여기서 사고 고릅니다.';
    tfCard.replaceChildren(note, ...list.map((t) => {
      const row = document.createElement('div'); row.className = `tfRow${t.chosen ? ' chosen' : ''}`; row.dataset.character = t.character;
      const name = document.createElement('strong'); name.textContent = t.name;
      const meta = document.createElement('small'); meta.textContent = t.owned ? (t.chosen ? '변신 중' : '보유') : `${Number(t.price).toLocaleString('ko-KR')}P${t.ip ? ` · ${t.ip}` : ''}`;
      const act = document.createElement('button'); act.type = 'button'; act.className = t.owned ? (t.chosen ? 'ghost' : 'primary') : 'secondary';
      act.textContent = t.owned ? (t.chosen ? '변신 풀기' : '변신하기') : '사기';
      act.addEventListener('click', () => transformAction(t));
      row.append(name, meta, act);
      dressOnHover(row, tfDress, () => ({ ...(plazaAvatar?.look || {}), transform: t.character }), `${t.name}`); // (3-1: the transformation tried on)
      if (t.chosen && t.modes.length > 1) for (const [value, label] of [['current', '우리 체형'], ['native', '고유 체형']]) { const b = document.createElement('button'); b.type = 'button'; b.className = `ghost tiny${t.mode === value ? ' selected' : ''}`; b.textContent = label; b.setAttribute('aria-pressed', String(t.mode === value));
        b.addEventListener('click', async () => { try { const data = await api('/api/avatar/transformation', { method: 'POST', body: JSON.stringify({ characterId: t.character, mode: value }) }); applySkinEquipment(data); drawTransformShop(); } catch (error) { showToast(error.message); } }); row.append(b); }
      return row; }));
  }
  async function transformAction(t) {
    if (tfBusy) return; tfBusy = true; const was = skinShopMode; skinShopMode = 'transform'; // (the island's facility check: the 변신 의상실)
    try {
      if (!t.owned) { if (!window.confirm(`${t.name}을(를) ${Number(t.price).toLocaleString('ko-KR')}P에 살까요?`)) return; await api('/api/skins/buy', { method: 'POST', body: JSON.stringify({ skinId: t.skinId }) }); loadPoints(); showToast(`${t.name} 구매 완료`); }
      else { const data = await api('/api/skins/equip', { method: 'POST', headers: { 'X-Island-Facility': 'transform' }, body: JSON.stringify(t.chosen ? { skinId: null, game: 'avatar', slot: 'transform' } : { skinId: t.skinId }) }); applySkinEquipment(data); showToast(t.chosen ? '변신을 풀었어요.' : `${t.name}!`); }
      await drawTransformShop();
    } catch (error) { showToast(error.message, 4000); } finally { skinShopMode = was; tfBusy = false; }
  }
  async function openTransformShop() {
    try { await drawTransformShop(); openPlazaWindow('변신 의상실', [tfRoom]); dressView(tfDress, plazaAvatar?.look || {}, '지금 내 모습'); } catch (error) { showToast(error.message); }
  }
  function openSkinShop(mode = 'all') {
    ++skinShopEpoch; clearTimeout(skinBuyTimer);
    skinShop = null; skinShopBody.replaceChildren(); skinShopBalance.textContent = ''; skinShopStatus.textContent = '';
    skinShopMode = mode; skinBuyArmed = null; skinShopSlot = null;
    document.getElementById('skinShopTitle').textContent = SKIN_SHOP_TITLES[mode];
    skinShopDialog.showModal(); loadSkinShop();
  }
  document.getElementById('skinShopBtn').addEventListener('click', () => openSkinShop('all'));
  document.getElementById('skinShopCloseBtn').addEventListener('click', () => skinShopDialog.close());
  skinShopDialog.addEventListener('close', () => { if (!skinShopDialog.open) { ++skinShopEpoch; clearTimeout(skinBuyTimer); skinBuyArmed = null; if (document.body.classList.contains('plazaMode') && !document.querySelector('dialog[open]')) plazaStage.focus({ preventScroll: true }); } });

  // v1.7.15 point-reward events: the server says which events are open and which this account already
  // claimed; the modal is built from that data (nothing about a specific event is written in the page).
  // Closing the modal never claims. It is not shown again during this page session, only on the next
  // entry, and the server (not this Set) decides what is still claimable.
  const eventDialog = document.getElementById('eventDialog');
  const eventDialogTitle = document.getElementById('eventDialogTitle');
  const eventDialogHeadline = document.getElementById('eventDialogHeadline');
  const eventDialogMessage = document.getElementById('eventDialogMessage');
  const eventDialogTeaser = document.getElementById('eventDialogTeaser');
  const eventDialogReward = document.getElementById('eventDialogReward');
  const eventDialogNote = document.getElementById('eventDialogNote');
  const eventDialogError = document.getElementById('eventDialogError');
  const eventDialogClaimBtn = document.getElementById('eventDialogClaimBtn');
  const eventDismissBtn = document.getElementById('eventDismissBtn');
  const eventDismissForm = document.getElementById('eventDismissForm');
  const eventDismissInput = document.getElementById('eventDismissInput');
  const eventDismissError = document.getElementById('eventDismissError');
  const eventPrompted = new Set();
  const EVENT_DISMISS_PHRASE = '오늘 하루 보지 않음';
  // v1.7.21: the popup opens on every lobby entry, claimed or not. "Hide for today" is a per-account, per-event
  // choice kept in this browser (localStorage, keyed by the account the server names) for the current Seoul day.
  // ponytail: not shared across browsers/devices; move it into the point store if that is ever needed.
  const eventHideKey = (account, eventId) => `eventHide:${account}:${eventId}`;
  let eventAccount = '';
  let eventCurrent = null;
  let eventClaiming = false;

  function eventHiddenToday(account, eventId) {
    try { return localStorage.getItem(eventHideKey(account, eventId)) === seoulDay.format(new Date()); } catch { return false; }
  }

  async function checkEvents() {
    const token = sessionToken;
    try {
      const { events, account } = await api('/api/events');
      // The answer can arrive late: only show it if this is still the same login and the player is still in the
      // lobby (not already in a room). Nothing is marked as shown, so the next lobby entry asks again.
      if (token !== sessionToken || lobbyView.classList.contains('hidden')) return;
      // v1.7.31: an event I have not claimed yet comes before one I already claimed, whatever order the server lists them in.
      const candidates = events.filter(event => !eventPrompted.has(`${sessionToken}:${event.id}`) && !eventHiddenToday(account, event.id));
      const next = candidates.find(event => !event.claimed) || candidates[0];
      if (next && !eventDialog.open) { eventAccount = account; openEventDialog(next); }
    } catch {}
  }

  function openEventDialog(event) {
    eventCurrent = event;
    eventDismissForm.classList.add('hidden');
    eventDismissBtn.setAttribute('aria-expanded', 'false');
    eventDismissInput.value = '';
    eventDismissError.textContent = '';
    eventPrompted.add(`${sessionToken}:${event.id}`);
    eventDialogTitle.textContent = event.notice ? `📢 ${event.title}` : `🎉 ${event.title} 🎉`; // v1.10.33: a notice
    eventDialogHeadline.textContent = event.headline;
    eventDialogMessage.textContent = event.message;
    eventDialogTeaser.textContent = event.teaser || '';
    eventDialogTeaser.classList.toggle('hidden', !event.teaser);
    eventDialogReward.textContent = event.notice ? '' : `+${Number(event.rewardPoints).toLocaleString('ko-KR')}P`;
    eventDialogReward.classList.toggle('hidden', Boolean(event.notice));
    eventDialogNote.textContent = event.note;
    eventDialogClaimBtn.textContent = event.claimed ? '이미 받았습니다' : event.buttonLabel;
    eventDialogClaimBtn.disabled = Boolean(event.claimed);
    document.getElementById('eventDialogCloseBtn').classList.toggle('hidden', Boolean(event.notice)); // a notice: one button, it closes
    eventDialogError.textContent = '';
    eventDialog.showModal();
  }

  async function claimEventReward() {
    if (eventCurrent?.notice) { eventDialog.close(); return; } // v1.10.33: nothing to claim
    if (!eventCurrent || eventClaiming) return;
    eventClaiming = true;
    eventDialogClaimBtn.disabled = true;
    eventDialogError.textContent = '';
    try {
      const result = await api(`/api/events/${encodeURIComponent(eventCurrent.id)}/claim`, { method: 'POST', body: '{}' });
      eventDialog.close();
      await loadPoints();
      if (result.granted) showRewardEffect(result.amount, result.successMessage);
      else showToast('이미 받은 이벤트입니다.');
      if (!missionPanelEvents.classList.contains('hidden')) loadEventsTab();
    } catch (err) {
      if (err.status === 401) { eventDialog.close(); return; }
      eventDialogError.textContent = err.message;
      // Not open / already over: nothing more to try. A network or server error may be retried.
      eventDialogClaimBtn.disabled = err.status === 404 || err.status === 409;
    } finally {
      eventClaiming = false;
    }
  }

  eventDialogClaimBtn.addEventListener('click', claimEventReward);
  eventDismissBtn.addEventListener('click', () => {
    const opening = eventDismissForm.classList.toggle('hidden') === false;
    eventDismissBtn.setAttribute('aria-expanded', String(opening));
    eventDismissError.textContent = '';
    if (opening) eventDismissInput.focus();
  });
  eventDismissForm.addEventListener('submit', (submit) => {
    submit.preventDefault();
    if (!eventCurrent) return;
    // Only the exact phrase hides it (surrounding spaces ignored, composed Hangul normalized).
    if (eventDismissInput.value.trim().normalize('NFC') !== EVENT_DISMISS_PHRASE) {
      eventDismissError.textContent = `"${EVENT_DISMISS_PHRASE}"을 정확히 입력해 주세요.`;
      return;
    }
    try { localStorage.setItem(eventHideKey(eventAccount, eventCurrent.id), seoulDay.format(new Date())); }
    catch { eventDismissError.textContent = '이 브라우저에서는 설정을 저장할 수 없습니다.'; return; }
    eventDialog.close();
    showToast('오늘은 이 이벤트 창을 다시 열지 않습니다.');
  });
  document.getElementById('eventDialogCloseBtn').addEventListener('click', () => eventDialog.close());
  eventDialog.addEventListener('close', () => { eventCurrent = null; });
  // v1.7.31: the popup belongs to the lobby. If it opened while a room create/join request was still pending, entering
  // the room closes it and forgets that it was shown, so it is offered again when the player returns to the lobby.
  function closeEventDialogForRoom() {
    if (!eventDialog.open) return;
    if (eventCurrent) eventPrompted.delete(`${sessionToken}:${eventCurrent.id}`);
    eventDialog.close();
  }

  function enterLobby() {
    rpgUnmount();
    stopStream();
    // Closing both windows here (rather than leaving either to linger) mirrors the same reasoning
    // as before: whichever panel is currently popped out -- chat's separate window, 게임 진행's
    // native PIP window, or both at once -- must not keep sitting over the lobby after the player
    // leaves. This never touches either preference or localStorage, so the user's chosen mode is
    // still honored the next time they enter a room.
    closeChatPip();
    closeGameInfoPip();
    state = null;
    lastResultEffectKey = null;
    clearResultEffect();
    resetTurnAlertTracking();
    setBaseDocumentTitle('아일랜드');
    lobbyChatAnnouncer.reset();
    islandBubbleSeen = null; // the first snapshot after coming back is only a baseline (no old bubbles)
    showView('lobby');
    renderLobbyChat();
    loadAnnouncements().catch(err => showToast(err.message, 3500));
    loadMyRecords();
    loadPoints();
    loadMissions();
    checkEvents();
    loadPublicRooms().catch(err => showToast(err.message, 3500));
    startLobbyStream();
    startPresenceRefresh();
  }

  // v1.7.23 (IDEAS backlog 7): everything a game remembers between two snapshots to animate the difference (the newest
  // piece, a dice or piece move, a card flight, a drawn tile) belongs to the room it was seen in. Entering a room clears it,
  // so the first snapshot of that room is only a baseline and nothing from the previous room is replayed or compared.
  function resetRoomAnimationState() {
    tumbleGen += 1;
    pieceMotionKey = null; pieceMotionStart = 0;
    if (pieceMotionFrame !== null) cancelAnimationFrame(pieceMotionFrame);
    pieceMotionFrame = null;
    yutLastThrowKey = null; yutThrowTrackingStarted = false; yutThrowAnimating = false; yutLastThrowFlags = null;
    yutLastMoveKey = null; yutMoveTrackingStarted = false; yutPieceAnimation = null; yutMoveAnimationGen += 1; yutHoverTargetKey = null;
    cityLastRollKey = null; cityRollTrackingStarted = false; cityAnimation = null; cityDiceAnimating = false;
    if (cityAnimationFrame !== null) cancelAnimationFrame(cityAnimationFrame);
    cityAnimationFrame = null;
    if (davinciGuessFeedbackTimer) clearTimeout(davinciGuessFeedbackTimer);
    davinciGuessFeedbackTimer = null; davinciGuessFeedbackKey = null; davinciLastDrawKey = null; davinciFxPlayed = null; davinciSpecialPlayed = null; davinciPrevStatus = null;
    davinciBaselinePending = true; davinciRevealRound = null;
    window.GostopUI?.reset?.();
    window.TwentyQuestionsUI?.reset?.();
  }

  function enterRoomState(next) {
    bubbleSeen = null; systemSeen = null; // (A3 G1-6: a room just entered shows no old line as a bubble -- nor, G-틀①, an old note)
    closeEventDialogForRoom();
    stopPresenceRefresh();
    stopLobbyStream();
    resetTurnAlertTracking(); // the first snapshot of a (re)entered room is only a baseline
    state = next;
    lastResultEffectKey = null;
    resetRecentActionTracking();
    resetRoomAnimationState();
    clearResultEffect();
    chatUnreadCount = 0;
    chatAtBottom = true;
    chatLastSeenId = 0;
    lastRenderedChatIds = [];
    roomChatAnnouncer.reset();
    chatOverlayOpen = false;
    gameInfoOverlayOpen = false;
    gameInfoActiveTab = 'system';
    updateChatBadges();
    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'bingo', 'dots', 'cityking', 'pictionary', 'liar'].includes(state?.gameType) ? state.gameType : 'omok';
    seat = state?.me?.seat || null;
    isHost = Boolean(state?.me?.isHost);
    showView('room');
    inviteTargetList.replaceChildren();
    renderRoom();
    if (state?.gameType === 'gostop') loadPoints();
    scheduleRoomSideHeightSync();
    startStream();
    if (isHost && state.game.status === 'selecting') loadInviteTargets().catch(() => {});
    // Only actually opens when this call chain started from a real click (create/join/accept
    // invite) -- a silent page-load reconnect has no such gesture, so this just no-ops and each
    // button stays available for one manual click instead. Restoring both is safe now: chat opens
    // via window.open (no "one at a time" limit) while 게임 진행 keeps the real native PIP, so the
    // two never compete for the same browser-wide PIP slot.
    if (chatPipPref && chatPipSupported && !chatPipActive()) openChatPip();
    if (gameInfoPipPref && gameInfoPipSupported && !gameInfoPipActive()) openGameInfoPip();
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
    if (event === 'plaza') { plaza.controller?.setTrainService?.(parsed.trainService); plazaPlayers = Array.isArray(parsed.players) ? parsed.players : []; showPlazaPlayers(); return; }
    if (event === 'islandEvent') { forgetIslandEvents(parsed.removed); return; } // v1.10.11: solved by someone: gone everywhere at once
    if (event === 'islandWeed') { plaza.controller?.removeWeeds?.(parsed.gone); return; } // v1.10.31: a weed pulled by someone
    if (event === 'islandTime') { refreshIslandTime(); return; } // v1.10.90 섬 시간대 (A5: with the season and the decorations, asked again)
    if (event === 'islandWeather') { refreshIslandWeather(); return; } // A4 날씨 (held or let go by the administrator)
    if (event === 'residents') { plaza.controller?.setResidents?.(parsed.list); return; } // A-6: a talk holds or lets go of an islander
    if (event === 'birthdays') { birthdaySeq += 1; plaza.controller?.setBirthdays?.(parsed.names || []); return; } // B 47 생일
    if (event === 'petshop') { if (plaza.controller?.space?.() === 'petshop') refreshPetshop(); else petshopState = null; return; } // 묶음 2-2: one taken somewhere
    if (event === 'insects') { plaza.controller?.insectsGone?.(parsed.gone); return; } // 묶음 5: one caught or sent off somewhere
    if (event === 'homes') { refreshHomes(); return; } // 묶음 4: a house new somewhere, or its roof
    if (event === 'friends') { showToast(parsed.kind === 'request' ? `${parsed.name || '이웃'}님이 친구 신청을 했어요 · 내 정보 「친구」에서 수락할 수 있어요` : '친구 신청이 받아들여졌어요', 5000); if (myInfoDialog.open) renderFriends(); return; } // 묶음 4 친구
    if (event === 'furniture') { if (plaza.controller?.space?.() === 'furniture') refreshFurniture(); else furnitureState = null; return; } // 묶음 2: a piece sold somewhere
    if (event === 'birthdayCheer') { plaza.controller?.birthdayCheer?.(parsed.to === plazaMyId ? 'me' : parsed.to); return; }
    if (event === 'birthdayCheered') { showToast(`🎉 ${parsed.name}님이 생일을 축하해 줬어요 (올해 ${parsed.count}명)`, 5000); return; }
    if (event === 'mail') { showToast(`✉️ ${parsed.from}님에게서 편지가 왔어요 · 광장 동쪽 우체통에서 열어 보세요`, 6000); return; } // B 47 우체통
    if (event === 'contest') { refreshContest(); return; } // A4 주말 섬 대회 (soon, start, end)
    if (event === 'plants') { refreshPlants(); return; } // B 45 (someone planted or fertilized)
    if (event === 'islandWeeds') { loadWeeds(); return; } // a new day: the weeds pulled yesterday grew back elsewhere
    if (event === 'statues') { plazaStatues = Array.isArray(parsed.statues) ? parsed.statues : []; plazaStatuesWeek = parsed.week ?? plazaStatuesWeek; plaza.controller?.setStatues?.(plazaStatues, plazaStatuesWeek); return; } // v1.10.5
    if (event === 'lobbyState') {
      lobbyState = parsed || { messages: [], connectedCount: 0, rooms: [], invitations: [] };
      // Announced from the stream only: the first snapshot after entering the lobby is just the baseline.
      lobbyChatAnnouncer.update(lobbyState.messages || [], lobbyState.me?.chatId || '');
      renderLobbyChat();
      islandChatUpdate();
      renderPublicRooms();
      renderLobbyInvitations();
    } else if (event === 'pointsChanged') {
      loadPoints(); // the server changed my balance (operator grant, refund): re-read it once
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

  // v1.6.84: a room snapshot older than the one on screen (by the server's stateSeq) is dropped --
  // e.g. an action's HTTP response that lands after the SSE push of a later change.
  function isStaleRoomState(next) {
    return Boolean(state && next && Number.isFinite(state.stateSeq) && Number.isFinite(next.stateSeq) && next.stateSeq < state.stateSeq);
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
      if (isStaleRoomState(parsed)) return;
      const settledGostop = needsGostopPoints(parsed, state);
      state = parsed;
      seat = state.me?.seat || null;
      isHost = Boolean(state.me?.isHost);
      renderRoom();
      if (settledGostop) loadPoints();
    } else if (event === 'rpgTick') {
      if (isRpgGame()) rpgBridge.controller?.tick(parsed);
    } else if (event === 'missionUpdate') {
      // v1.7.16: the server counted this match for my missions; a few short lines, one after another.
      if (Number.isInteger(parsed.doneCount)) missionBtn.textContent = `미션 ${parsed.doneCount}/${parsed.total}`;
      (Array.isArray(parsed.lines) ? parsed.lines : []).slice(0, 6).forEach((line, index) => setTimeout(() => showToast(String(line), 2200), index * 2300));
    } else if (event === 'sessionExpired') {
      expireSession(parsed.message);
    }
  }

  function needsGostopPoints(next, previous) {
    if (next?.gameType !== 'gostop' || !next.me?.seat) return false;
    const settled = game => (game?.bonusAwards || []).filter(award => award.settled)
      .map(award => `${award.turn}:${award.paid}`).join('|');
    const nextBonus = settled(next.game);
    if (nextBonus && nextBonus !== settled(previous?.game)) return true;
    return ['finished', 'draw'].includes(next.game?.status)
      && (previous?.gameType !== 'gostop' || previous.game?.status !== next.game.status
        || previous.game?.round !== next.game.round
        || previous.game?.settlement?.status !== next.game?.settlement?.status);
  }

  function characterPairActive() {
    return ['yut','dots','connect4'].includes(state?.gameType) && Object.values(state?.players || {}).some(player => window.SkinLooks?.def?.(player?.skin)?.characterSides);
  }

  function choiceKo(choice) {
    if (characterPairActive() && ['black','white'].includes(choice)) return choice === 'black' ? '흑' : '백';
    if ((isRpgGame() || isGostopGame() || isBingoGame() || isPictionaryGame() || isLiarGame() || isOldMaidGame() || isDavinciGame() || isHalliGame() || isPandemicGame()) && numberedSeats().includes(choice)) return `${choice}번`;
    if (isTeamGame() && ['1','2','3','4'].includes(choice)) return `${seatColor(choice) === 'black' ? '흑' : '백'}팀 ${choice}번`;
    if (choice === 'black') return state?.gameType === 'baseball' ? '선공' : state?.gameType === 'connect4' ? '빨강' : ['yut','dots','cityking'].includes(state?.gameType) ? '파랑' : (isTeamGame() ? '흑팀' : '흑');
    if (choice === 'white') return state?.gameType === 'baseball' ? '후공' : state?.gameType === 'connect4' ? '노랑' : ['yut','dots','cityking'].includes(state?.gameType) ? '빨강' : (isTeamGame() ? '백팀' : '백');
    if (choice === 'spectator') return '관전';
    return '미선택';
  }

  function seatKo(value) {
    if (characterPairActive() && ['black','white'].includes(value)) return value === 'black' ? '흑' : '백';
    if ((isRpgGame() || isGostopGame() || isBingoGame() || isPictionaryGame() || isLiarGame() || isOldMaidGame() || isCityKingGame() || isDavinciGame() || isHalliGame() || isPandemicGame()) && numberedSeats().includes(value)) return `${value}번`;
    if (isTeamGame() && ['1','2','3','4'].includes(value)) return `${seatColor(value) === 'black' ? '흑' : '백'}팀 ${value}번`;
    if (value === 'black') return state?.gameType === 'baseball' ? '선공' : state?.gameType === 'connect4' ? '빨강' : ['yut','dots'].includes(state?.gameType) ? '파랑' : (isTeamGame() ? '흑팀' : '흑');
    if (value === 'white') return state?.gameType === 'baseball' ? '후공' : state?.gameType === 'connect4' ? '노랑' : ['yut','dots'].includes(state?.gameType) ? '빨강' : (isTeamGame() ? '백팀' : '백');
    return '관전';
  }

  // v1.6.84: "who has to act right now?" -- read from each game's own server state (never plain
  // `turn` everywhere) and painted on the existing seat/player cards in a sky-blue language that
  // differs from recent-action amber (v1.6.80), actionable mint (v1.6.82) and the my-seat outline.
  // Phases where everyone may act at once (votes, secret setup, guesses in pictionary, the Halli
  // Galli bell) deliberately have no actor. Pure function of current state, so a refresh, reconnect
  // or spectator join shows the right seat immediately; finished/waiting states show nothing.
  function currentActorSeats({ holdAnimations = true } = {}) {
    const g = state?.game;
    const none = { seats: new Set(), paused: false };
    if (!g || g.status !== 'playing') return none;
    const one = value => (value === null || value === undefined || value === '' ? [] : [String(value)]);
    let seats = [];
    switch (state.gameType) {
      case 'omok2v2':
        seats = one(g.nextSeat);
        break;
      case 'yut':
        // Keep the mover highlighted until its throw/hop animation has visibly settled, so a
        // back-do auto-pass or a finished move doesn't jump the highlight ahead of the board.
        if (holdAnimations && yutPieceAnimation && g.lastMove?.color) seats = one(g.lastMove.color);
        else if (holdAnimations && yutThrowAnimating && g.lastThrow?.color) seats = one(g.lastThrow.color);
        else seats = one(g.turn);
        break;
      case 'cityking':
        seats = one(g.phase === 'liquidate' ? g.liquidating : g.turn);
        break;
      case 'twentyquestions':
        // Secret entry, answering and judging belong to the drawer; asking and final guesses to the
        // challenger whose turn the server reports; the result pause belongs to nobody.
        if (['secret', 'answering', 'judging'].includes(g.phase)) seats = one(g.drawerSeat);
        else if (['asking', 'final-guesses'].includes(g.phase)) seats = one(g.turnSeat);
        break;
      case 'pictionary':
        if (g.phase === 'drawing') seats = one(g.drawerSeat);
        break;
      case 'pandemic':
        seats = one(g.pending?.type === 'consent' ? g.pending.owner : g.pending?.type === 'share' ? g.pending.other : g.pending?.seat || g.turn);
        break;
      case 'liar':
        // Only the hint phases have one public speaker. Votes are simultaneous, and the final guess
        // is made by the liar, whose seat the public state never names -- so neither is marked.
        if (['hint1', 'hint2', 'extraHint'].includes(g.phase)) seats = one(g.currentSpeaker);
        break;
      default:
        // omok, connect4, othello, dots, baseball (turns only once playing -- secret setup is
        // simultaneous), bingo, oldmaid (the drawer), davinci (the guesser, including its own
        // reveal-after-miss), halligalli (the card flipper -- never everyone who may ring the bell).
        seats = one(g.turn);
    }
    return { seats: new Set(seats), paused: Boolean(g.paused) };
  }

  // G-틀② 이름표 판 둘레: while a hand is played my name card sits under the board, the others above it (the board between
  // us, as at a table) -- the two-colour games and 2vs2 오목; a table game's own seats (고스톱, 다빈치 …) stay for G-게임별
  const mySeatSpot = document.getElementById('mySeatSpot');
  const seatCardOf = (s) => (/^(black|white)$/.test(s) ? document.getElementById(`${s}Player`) : document.querySelector(`#teamPlayers [data-seat="${s}"], #mySeatSpot [data-seat="${s}"]`));
  function placeMySeat() {
    const playing = document.body.classList.contains('roomPlaying');
    const mine = playing && seat ? (/^(black|white)$/.test(seat) ? (standardPlayers.classList.contains('hidden') ? null : seatCardOf(seat)) : teamPlayers.querySelector(`.teamPlayer[data-seat="${seat}"]:not(.bingoSeat)`)) : null;
    for (const c of [...mySeatSpot.children]) if (c !== mine) { if (c === blackPlayer) standardPlayers.prepend(c); else if (c === whitePlayer) standardPlayers.append(c); else c.remove(); }
    if (mine && mine.parentElement !== mySeatSpot) mySeatSpot.append(mine);
  }
  function renderCurrentActor() {
    const { seats, paused } = currentActorSeats();
    const cards = [
      ['black', blackPlayer], ['white', whitePlayer],
      ...[...teamPlayers.children, ...mySeatSpot.querySelectorAll('.teamPlayer')].map(card => [card.dataset.seat, card]),
    ];
    for (const [seatId, card] of cards) {
      if (!card) continue;
      const on = Boolean(seatId) && seats.has(String(seatId));
      card.classList.toggle('currentActor', on && !paused);
      // A paused match keeps a faint, glow-less marker so nobody reads it as "move now".
      card.classList.toggle('currentActorPaused', on && paused);
    }
  }

  // v1.7.8: who is acting, by name, so a spectator reads the table the way a person sitting at it would.
  function actorName(value) {
    const label = state?.players?.[value]?.label;
    return label ? `${label}님${value === seat ? '(나)' : ''}` : seatKo(value);
  }

  function twentyHeadline(g) {
    switch (g.phase) {
      case 'secret': return `${actorName(g.drawerSeat)} 정답 정하는 중`;
      case 'asking': return `${actorName(g.turnSeat)} 질문 차례`;
      case 'answering': return `${actorName(g.drawerSeat)} 답변 중`;
      case 'judging': return `${actorName(g.drawerSeat)} 정답 판정 중`;
      case 'final-guesses': return `${actorName(g.turnSeat)} 최종 정답 차례`;
      default: return '준비';
    }
  }

  // One short public sentence for the last thing that happened, built from each game's own public state
  // (see recent-action.js; it never falls back to the room's system chat).
  function recentNarration() {
    return window.RecentAction.narrate(state, { actorName });
  }

  function renderHeadlineContext() {
    const g = state?.game;
    // (G-게임별 윷 검토: not the held mover -- after my 빽도's auto-pass the line is already the other's turn)
    const mine = Boolean(seat && g?.status === 'playing' && !g.paused && currentActorSeats({ holdAnimations: false }).seats.has(String(seat)));
    statusText.classList.toggle('selfActHeadline', mine);
    // (G-게임별: on a phone my own name dropped from my turn's line -- 「내 차례 · 숫자 추측」 in one line, as 고스톱's)
    // (도둑잡기 검토: and on any screen 「내 차례 · 누구님 차례 · …」 says it twice -- the second 「…님 차례 · 」 dropped)
    if (mine && !statusText.textContent.startsWith('내 차례')) statusText.textContent = `내 차례 · ${statusText.textContent.replace(isMobileLayout() ? /^[^·]*(\(나\)|님 차례) · / : /^[^·]*님 차례 · /, '')}`;
    const text = recentNarration();
    recentActionLine.classList.toggle('hidden', !text);
    if (text) {
      const label = document.createElement('strong');
      label.textContent = '방금';
      recentActionLine.replaceChildren(label, document.createTextNode(text));
    } else {
      recentActionLine.replaceChildren();
    }
  }

  // v1.6.85: background "my turn" alert. When a step that needs *my* action begins while this tab
  // is not being looked at, the tab title gets a short prefix and -- only if the player switched it
  // on themselves -- one system notification. Everything is keyed on the server state that defines
  // the step (never chat, timers or presence), so a re-sent snapshot never alerts twice; the first
  // snapshot after entering a room is only a baseline, so a reconnect never looks like a new turn.
  const TURN_ALERT_PREFIX = '● 내 차례! | ';
  const TURN_NOTIFY_KEY = 'turnNotifyPref';
  let baseDocumentTitle = document.title || '아일랜드';
  let turnAlertActive = false;
  let turnAlertBaselineReady = false;
  const seenTurnAlertKeys = new Set();
  let turnNotification = null;
  let turnNotifyPref = false;
  try { turnNotifyPref = localStorage.getItem(TURN_NOTIFY_KEY) === '1'; } catch {}

  const messengerBlink = window.MessengerAlert.titleBlink(() => applyDocumentTitle()); // v1.10.190: a new message while away
  function applyDocumentTitle() {
    const next = messengerBlink.text(turnAlertActive ? `${TURN_ALERT_PREFIX}${baseDocumentTitle}` : baseDocumentTitle);
    if (document.title !== next) document.title = next;
  }

  function setBaseDocumentTitle(title) {
    baseDocumentTitle = title;
    applyDocumentTitle();
  }

  function pageInBackground() {
    if (document.visibilityState === 'hidden') return true;
    if (typeof document.hasFocus !== 'function' || document.hasFocus()) return false;
    // Focus inside our own chat window / game-info PiP still counts as looking at the game.
    for (const win of [chatPipWindow, gameInfoPipWindow]) {
      try { if (win && !win.closed && win.document?.hasFocus?.()) return false; } catch {}
    }
    return true;
  }

  // Short, public wording only -- never a secret word, hidden number or role.
  function turnAlertVerb(type, g) {
    switch (type) {
      case 'omok': case 'omok2v2': case 'othello': case 'connect4': return '착수할';
      case 'dots': return '선을 그을';
      case 'bingo': return '숫자를 고를';
      case 'baseball': return g.status === 'setup' ? '비밀 숫자를 정할' : '추측할';
      case 'yut': return g.phase === 'move' ? '말을 움직일' : '윷을 던질';
      case 'cityking': return g.phase === 'liquidate' ? '자산을 정리할' : g.phase === 'roll' ? '주사위를 굴릴' : '행동할';
      case 'davinci': return g.phase === 'reveal-own' ? '타일을 공개할' : '추측할';
      case 'halligalli': return '카드를 뒤집을';
      case 'pandemic': return '행동할';
      case 'gostop': return g.phase === 'go-stop' ? '고/스톱을 정할' : g.phase === 'gukjin' ? '국진을 정할' : g.phase?.startsWith('choose') ? '먹을 패를 고를' : '패를 낼';
      case 'oldmaid': return '카드를 뽑을';
      case 'pictionary': return '그림을 그릴';
      case 'liar': return ['vote', 'revote'].includes(g.phase) ? '투표할' : ['hint1', 'hint2', 'extraHint'].includes(g.phase) ? '힌트를 낼' : '행동할';
      case 'twentyquestions':
        return { secret: '정답을 정할', asking: '질문할', answering: '답변할', judging: '판정할', 'final-guesses': '최종 정답을 낼' }[g.phase] || '행동할';
      default: return '행동할';
    }
  }

  // The server fields that advance exactly when a new step starts, per game. Deliberately not
  // e.g. Halli Galli's revision (other players' bell rings bump it during my own flip turn).
  function turnAlertSequence(type, g) {
    switch (type) {
      case 'yut': return [g.moveCount, g.phase, g.lastThrow?.at];
      case 'cityking': return [g.turnCount, g.phase, g.lastRoll?.at, g.liquidating];
      case 'halligalli': return [g.flipId];
      case 'pandemic': return [g.moveCount, g.turn];
      case 'liar': return [g.phaseId];
      case 'pictionary': return [g.roundNumber, g.phase];
      case 'twentyquestions': return [g.roundNumber, g.moveCount, g.phase];
      case 'baseball': return [g.status, g.moveCount];
      default: return [g.moveCount, g.phase];
    }
  }

  // The step waiting on me right now, or null. Same actor rules as the v1.6.84 seat highlight (but
  // from settled server state: a hidden tab's animations are paused, and must not hold an alert
  // back), plus the simultaneous steps that still wait on me personally (a vote, a secret number).
  function myTurnAlertRequest() {
    const g = state?.game;
    if (!state || !seat || !g || g.paused) return null;
    const type = state.gameType;
    let needed = false;
    if (type === 'baseball' && g.status === 'setup') needed = !g.ready?.[seat];
    else if (g.status !== 'playing') needed = false;
    else if (type === 'liar' && ['vote', 'revote'].includes(g.phase)) needed = !g.myVoted && (g.voteTargets || []).some(target => target !== seat);
    else if (type === 'liar' && g.phase === 'guess') needed = Boolean(g.canGuess);
    else needed = currentActorSeats({ holdAnimations: false }).seats.has(String(seat));
    if (!needed) return null;
    const key = [type, g.round ?? '', ...turnAlertSequence(type, g).map(value => value ?? ''), seat].join('|');
    return { key, body: `${state.gameName || gameName(type)}에서 ${turnAlertVerb(type, g)} 차례입니다.` };
  }

  function notificationsSupported() {
    return typeof window.Notification === 'function';
  }

  function closeTurnNotification() {
    if (!turnNotification) return;
    try { turnNotification.close(); } catch {}
    turnNotification = null;
  }

  function clearTurnAlert() {
    closeTurnNotification();
    if (!turnAlertActive) return;
    turnAlertActive = false;
    applyDocumentTitle();
  }

  function resetTurnAlertTracking() {
    turnAlertBaselineReady = false;
    seenTurnAlertKeys.clear();
    clearTurnAlert();
  }

  function raiseTurnAlert(request) {
    turnAlertActive = true;
    applyDocumentTitle();
    if (!turnNotifyPref || !notificationsSupported() || Notification.permission !== 'granted') return;
    closeTurnNotification();
    try {
      // One tag, so the OS replaces rather than stacks; clicking only refocuses this same tab.
      const notification = new Notification('아일랜드 · 내 차례', { body: request.body, tag: 'gamecenter-my-turn' });
      notification.onclick = () => {
        try { window.focus(); } catch {}
        notification.close();
      };
      turnNotification = notification;
    } catch {}
  }

  function evaluateTurnAlert() {
    const request = myTurnAlertRequest();
    // The first snapshot after entering a room only sets the baseline, whatever it shows. A reload
    // briefly pauses the room (the old connection dropped) until this new one registers, so the
    // baseline extends to the first un-paused snapshot -- otherwise my own reconnect would read as
    // a brand-new turn.
    const baseline = !turnAlertBaselineReady;
    if (!state?.game?.paused) turnAlertBaselineReady = true;
    if (!request) { clearTurnAlert(); return; }
    const fresh = !seenTurnAlertKeys.has(request.key);
    if (fresh) {
      seenTurnAlertKeys.add(request.key);
      if (seenTurnAlertKeys.size > 200) seenTurnAlertKeys.delete(seenTurnAlertKeys.values().next().value);
    }
    if (fresh && !baseline && pageInBackground()) raiseTurnAlert(request);
  }

  function updateTurnNotifyBtn() {
    if (!turnNotifyBtn) return;
    const supported = notificationsSupported();
    turnNotifyBtn.classList.toggle('hidden', !supported);
    if (!supported) return;
    const denied = Notification.permission === 'denied';
    const on = turnNotifyPref && Notification.permission === 'granted';
    turnNotifyBtn.textContent = denied ? '내 차례 알림 · 차단됨' : on ? '내 차례 알림 · 켜짐' : '내 차례 알림 · 꺼짐';
    turnNotifyBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
    turnNotifyBtn.classList.toggle('turnNotifyOn', on);
    turnNotifyBtn.title = denied ? '브라우저 사이트 설정에서 알림을 허용하면 사용할 수 있습니다.' : '다른 탭을 보는 중 내 차례가 되면 시스템 알림을 보냅니다.';
  }

  async function toggleTurnNotify() {
    if (!notificationsSupported()) return;
    let next = !(turnNotifyPref && Notification.permission === 'granted');
    // The permission prompt only ever comes from this explicit click.
    if (next && Notification.permission === 'default') {
      let result = 'default';
      try { result = await Notification.requestPermission(); } catch {}
      if (result !== 'granted') next = false;
    }
    if (next && Notification.permission === 'denied') {
      next = false;
      showToast('브라우저에서 이 사이트의 알림이 차단되어 있습니다.', 3500);
    }
    turnNotifyPref = next;
    try { localStorage.setItem(TURN_NOTIFY_KEY, next ? '1' : '0'); } catch {}
    updateTurnNotifyBtn();
  }

  function setPlayerCard(el, color, player) {
    // (G-틀② 이름표: the name first, its seat and whether it is here under it)
    el.querySelector('strong').textContent = player ? (player.label || '게스트') : seatKo(color);
    const small = el.querySelector('small');
    el.classList.toggle('occupied', Boolean(player));
    el.classList.toggle('disconnected', Boolean(player && !player.connected));
    if (!player) small.textContent = '선택 가능';
    else small.textContent = `${seatKo(color)} · ${player.connected ? '접속 중' : '연결 끊김'}`;
    el.classList.toggle('mySeat', seat === color);
    seatFace(el, player);
    // (G-틀② 이름표의 게임 숫자: 윷 완주·점과 상자 상자·오델로 돌 -- the score the game keeps for this seat)
    el.querySelector('.seatNum')?.remove();
    const score = state?.game?.scores?.[color]; const unit = { yut: '완주', dots: '상자', othello: '돌' }[state?.gameType];
    if (player && unit && Number.isFinite(Number(score))) { const n = document.createElement('b'); n.className = 'seatNum'; n.textContent = `${unit} ${score}`; el.append(n); }
  }
  // A3 G1-5: a small island face (skin and hair colour) and the worn title on a name card
  function seatFace(card, player) {
    card.querySelector('.seatFace')?.remove(); card.querySelector('.seatTitle')?.remove();
    if (!player) return;
    const f = document.createElement('span'); f.className = 'seatFace'; f.setAttribute('aria-hidden', 'true');
    if (player.face?.skin) f.style.setProperty('--skin', player.face.skin); if (player.face?.hair) f.style.setProperty('--hair', player.face.hair);
    card.prepend(f);
    if (player.title) { const t = document.createElement('small'); t.className = 'seatTitle'; t.textContent = player.title; (card.querySelector('div') || card).append(t); }
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

  // v1.10.2 게임 아일랜드 채팅: Enter opens an input over the island, the message goes through the lobby chat (same server
  // flow and storage), every screen shows it as a bubble over its sender, and the 「채팅」 tab opens the conversation.
  const islandChatTab = document.getElementById('islandChatTab');
  const islandChatPanel = document.getElementById('islandChatPanel');
  const islandChatMessages = document.getElementById('islandChatMessages');
  const islandChatForm = document.getElementById('islandChatForm');
  const islandChatInput = document.getElementById('islandChatInput');
  const islandChatOpacity = document.getElementById('islandChatOpacity');
  let islandBubbleSeen = null;
  function islandChatUpdate() {
    const rows = lobbyState?.messages || []; const ownId = lobbyState?.me?.chatId || '';
    const atBottom = islandChatMessages.scrollHeight - islandChatMessages.scrollTop - islandChatMessages.clientHeight < 40;
    if (fillMessageList(islandChatMessages, rows, '아직 메시지가 없습니다.', ownId) && atBottom) islandChatMessages.scrollTop = islandChatMessages.scrollHeight;
    const newest = rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
    if (islandBubbleSeen === null) { islandBubbleSeen = newest; return; } // the first snapshot is only a baseline
    for (const row of rows) {
      if (!(Number(row.id) > islandBubbleSeen) || row.type === 'system') continue;
      const who = row.senderId && row.senderId === ownId ? 'me' : plazaPlayers.find((p) => p.chatId && p.chatId === row.senderId)?.id;
      if (who) plaza.controller?.speak?.(who, row.text);
      if (islandChatPanel.classList.contains('hidden') && who !== 'me') islandChatTab.classList.add('unread');
    }
    islandBubbleSeen = Math.max(islandBubbleSeen, newest);
  }
  // F② 채팅 창 옮기기·크기 (gamecenter-notes docs/fish-pad-chat-box-20261026.md): the head drags it, the corner grip sizes
  // it (mouse and finger alike), kept on the island (220×140 to 90%); each device keeps its own (gc.islandChatBox, as
  // fractions of the island so a turned screen fits again), the input line under it (over it near the bottom)
  let chatBox = null; try { const b = JSON.parse(localStorage.getItem('gc.islandChatBox') || 'null'); if (['x', 'y', 'w', 'h'].every((k) => Number.isFinite(b?.[k]))) chatBox = b; } catch {}
  function fitChatBox(b) {
    const W = plazaStage.clientWidth; const H = plazaStage.clientHeight; if (!W || !H) return null;
    const w = Math.min(Math.max(b.w * W, 220), W * 0.9); const h = Math.min(Math.max(b.h * H, 140), H * 0.9);
    return { x: Math.min(Math.max(b.x * W, 0), W - w), y: Math.min(Math.max(b.y * H, 0), H - h), w, h, W, H };
  }
  function applyChatBox() {
    const p = islandChatPanel.style; const f = islandChatForm.style; const at = chatBox && fitChatBox(chatBox);
    if (!at) { for (const k of ['left', 'top', 'width', 'height']) p[k] = ''; for (const k of ['left', 'top', 'bottom', 'width', 'transform']) f[k] = ''; return; }
    Object.assign(p, { left: `${at.x}px`, top: `${at.y}px`, width: `${at.w}px`, height: `${at.h}px` });
    const below = at.y + at.h + 6; const formH = 48;
    Object.assign(f, { left: `${at.x}px`, top: `${below + formH <= at.H ? below : Math.max(0, at.y - formH - 6)}px`, bottom: 'auto', width: `${at.w}px`, transform: 'none' });
  }
  const chatBoxNow = () => { const r = islandChatPanel.getBoundingClientRect(); const s = plazaStage.getBoundingClientRect(); return { x: (r.left - s.left) / s.width, y: (r.top - s.top) / s.height, w: r.width / s.width, h: r.height / s.height }; };
  function chatBoxDrag(handle, mode) {
    handle.addEventListener('pointerdown', (event) => {
      if (event.button > 0 || (mode === 'move' && event.target.closest('button, input, label'))) return;
      event.preventDefault(); const start = chatBoxNow(); const s = plazaStage.getBoundingClientRect(); const x0 = event.clientX; const y0 = event.clientY;
      handle.setPointerCapture?.(event.pointerId);
      const move = (e) => {
        const dx = (e.clientX - x0) / s.width; const dy = (e.clientY - y0) / s.height;
        chatBox = mode === 'move' ? { ...start, x: start.x + dx, y: start.y + dy } : { ...start, w: Math.min(start.w + dx, 1 - start.x), h: Math.min(start.h + dy, 1 - start.y) };
        applyChatBox();
      };
      const up = () => {
        for (const [type, fn] of [['pointermove', move], ['pointerup', up], ['pointercancel', up]]) handle.removeEventListener(type, fn);
        const at = chatBox && fitChatBox(chatBox); if (!at) return;
        chatBox = { x: at.x / at.W, y: at.y / at.H, w: at.w / at.W, h: at.h / at.H }; // (kept as it shows: on the island)
        try { localStorage.setItem('gc.islandChatBox', JSON.stringify(chatBox)); } catch {}
      };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
    });
  }
  chatBoxDrag(document.getElementById('islandChatHead'), 'move'); chatBoxDrag(document.getElementById('islandChatGrip'), 'size');
  document.getElementById('islandChatHome').addEventListener('click', () => { chatBox = null; try { localStorage.removeItem('gc.islandChatBox'); } catch {} applyChatBox(); });
  window.addEventListener('resize', applyChatBox);
  function setIslandChatPanel(open) {
    islandChatPanel.classList.toggle('hidden', !open); if (open) applyChatBox();
    islandChatTab.setAttribute('aria-expanded', String(open));
    if (open) { islandChatTab.classList.remove('unread'); islandChatMessages.scrollTop = islandChatMessages.scrollHeight; }
  }
  islandChatTab.addEventListener('click', () => {
    // v1.10.62 모바일: no Enter on a phone, so the tab also opens the input (and opens it again after a message)
    if (touchIsland && islandChatForm.classList.contains('hidden')) { setIslandChatPanel(true); islandChatForm.classList.remove('hidden'); islandChatInput.focus(); return; }
    setIslandChatPanel(islandChatPanel.classList.contains('hidden')); plazaStage.focus({ preventScroll: true });
  });
  document.getElementById('islandChatClose').addEventListener('click', () => { setIslandChatPanel(false); plazaStage.focus({ preventScroll: true }); });
  const applyIslandChatAlpha = (value) => islandChatPanel.style.setProperty('--island-chat-alpha', String(Math.max(25, Math.min(100, Number(value) || 80)) / 100));
  try { const saved = localStorage.getItem('gc.islandChatAlpha'); if (saved) islandChatOpacity.value = saved; } catch {}
  applyIslandChatAlpha(islandChatOpacity.value);
  islandChatOpacity.addEventListener('input', () => { applyIslandChatAlpha(islandChatOpacity.value); try { localStorage.setItem('gc.islandChatAlpha', islandChatOpacity.value); } catch {} });
  function closeIslandChatInput() { islandChatInput.value = ''; islandChatForm.classList.add('hidden'); if (document.body.classList.contains('plazaMode')) plazaStage.focus({ preventScroll: true }); }
  window.addEventListener('keydown', (event) => { // Enter anywhere on the island starts typing
    if (event.key !== 'Enter' || event.isComposing || event.repeat || !document.body.classList.contains('plazaMode') || document.querySelector('dialog[open]')) return;
    if (event.target !== document.body && event.target !== plazaStage) return; // a focused field or button keeps its own Enter
    event.preventDefault();
    applyChatBox(); islandChatForm.classList.remove('hidden'); islandChatInput.focus();
  });
  islandChatInput.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); closeIslandChatInput(); } });
  islandChatInput.addEventListener('blur', () => { if (!islandChatInput.value.trim()) islandChatForm.classList.add('hidden'); });
  islandChatForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = islandChatInput.value.trim();
    if (!text) { closeIslandChatInput(); return; }
    islandChatInput.disabled = true;
    try { const r = await api('/api/lobby/chat', { method: 'POST', body: JSON.stringify({ text }) }); islandChatInput.disabled = false; closeIslandChatInput(); jailAnswer(r.jail); }
    catch (err) { islandChatInput.disabled = false; showToast(err.message, 3500); islandChatInput.focus(); }
  });

  function renderLobbyChat() {
    if (!lobbyChatMessages) return;
    const rows = lobbyState?.messages || [];
    lobbyConnectedCount.textContent = `대기 ${lobbyState?.connectedCount || 0}명`;
    const wasAtBottom = lobbyChatMessages.scrollHeight - lobbyChatMessages.scrollTop - lobbyChatMessages.clientHeight < 40;
    const oldScrollTop = lobbyChatMessages.scrollTop;
    const anchor = firstVisibleMessage(lobbyChatMessages);
    const changed = fillMessageList(lobbyChatMessages, rows, '아직 대기방 메시지가 없습니다.', lobbyState.me?.chatId || '');
    if (!changed) return;
    if (wasAtBottom) lobbyChatMessages.scrollTop = lobbyChatMessages.scrollHeight;
    else restoreMessagePosition(lobbyChatMessages, anchor, oldScrollTop);
  }

  function buildChatMessageEl(row, previousRow, ownId) {
    const item = document.createElement('div');
    item.className = `chatMessage ${row.type === 'system' ? 'system' : ''}`;
    item.dataset.messageId = String(row.id);
    if (row.type === 'system') {
      item.textContent = row.text;
    } else {
      const mine = Boolean(ownId && row.senderId === ownId);
      item.classList.toggle('mine', mine);
      const sameSender = previousRow && previousRow.type !== 'system' && (row.senderId ? previousRow.senderId === row.senderId : previousRow.label === row.label)
        && Math.abs(new Date(row.at) - new Date(previousRow.at)) < 5 * 60 * 1000;
      if (!mine && !sameSender) {
        const head = document.createElement('div');
        head.className = 'chatMessageHead';
        const who = document.createElement('strong');
        who.textContent = row.label || '게스트';
        head.appendChild(who);
        item.appendChild(head);
      }
      const body = document.createElement('div');
      body.className = 'chatMessageBody';
      const time = document.createElement('time');
      const d = new Date(row.at);
      time.textContent = Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const text = document.createElement('div');
      text.className = 'chatMessageText';
      text.textContent = row.channel === 'train' ? `🚃 ${row.text}` : row.text; // v1.10.82: said on the train (its riders only)
      body.append(text, time);
      item.appendChild(body);
      item.setAttribute('aria-label', `${row.label || '게스트'}: ${row.text}`);
    }
    return item;
  }

  // v1.7.2: the message lists are rebuilt on every change, so they are not live regions themselves (a
  // screen reader would re-read the whole history). A separate hidden status region announces only the
  // messages that arrived since the last render; the first render of a list only records what exists.
  function createChatAnnouncer(region) {
    let lastId = null;
    return {
      reset() { lastId = null; region.replaceChildren(); },
      update(rows, ownId) {
        const ids = rows.map(row => Number(row.id)).filter(Number.isFinite);
        const newest = ids.length ? Math.max(...ids) : 0;
        if (lastId === null || newest < lastId) { lastId = newest; return; }
        const fresh = rows.filter(row => Number(row.id) > lastId && row.type !== 'system' && !(ownId && row.senderId === ownId));
        lastId = newest;
        if (!fresh.length) return;
        const text = fresh.slice(-3).map(row => `${row.label || '게스트'}: ${row.text}`).join('. ');
        region.replaceChildren(document.createTextNode(fresh.length > 3 ? `새 메시지 ${fresh.length}건. ${text}` : text));
      },
    };
  }
  const lobbyChatAnnouncer = createChatAnnouncer(document.getElementById('lobbyChatAnnounce'));
  const roomChatAnnouncer = createChatAnnouncer(document.getElementById('chatAnnounce'));

  // v1.7.29: when messages were only added at the end, keep every element already drawn (and the reader's place)
  // and append just the new ones; anything else (first draw, trimmed history, edits, another viewer id) redraws.
  function fillMessageList(container, rows, emptyText, ownId = '') {
    const keys = rows.map(row => [row.id, row.type, row.label, row.text, row.at, row.senderId].join('\u0001'));
    const drawn = messageListState.get(container);
    const sameStart = Boolean(drawn && drawn.ownId === ownId && drawn.keys.length && drawn.keys.length <= keys.length && drawn.keys.every((key, index) => key === keys[index]));
    if (sameStart && drawn.keys.length === keys.length) return false;
    messageListState.set(container, { ownId, keys });
    if (sameStart) {
      for (let i = drawn.keys.length; i < rows.length; i++) container.appendChild(buildChatMessageEl(rows[i], rows[i - 1], ownId));
      return true;
    }
    container.innerHTML = '';
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'chatEmpty';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return true;
    }
    for (let i = 0; i < rows.length; i++) container.appendChild(buildChatMessageEl(rows[i], rows[i - 1], ownId));
    return true;
  }

  function firstVisibleMessage(container) {
    const top = container.getBoundingClientRect().top;
    const item = [...container.children].find(child => child.getBoundingClientRect().bottom > top);
    return item?.dataset.messageId ? { id: item.dataset.messageId, offset: item.getBoundingClientRect().top - top } : null;
  }

  function restoreMessagePosition(container, anchor, oldScrollTop) {
    container.scrollTop = oldScrollTop;
    const item = anchor && [...container.children].find(child => child.dataset.messageId === anchor.id);
    if (item) container.scrollTop += item.getBoundingClientRect().top - container.getBoundingClientRect().top - anchor.offset;
  }

  // Liar hint phases stay private, and the current Twenty Questions drawer cannot use room chat
  // while a round is actively playing. Challengers and spectators keep normal chat access.
  function chatLockedForHints() {
    const g = state?.game;
    return isLiarGame() && g?.status === 'playing' && ['hint1', 'hint2', 'extraHint'].includes(g.phase);
  }

  function chatLockedForTwentyDrawer() {
    const g = state?.game;
    return Boolean(isTwentyGame() && g?.status === 'playing' && seat && String(seat) === String(g.drawerSeat));
  }

  function chatLockMessage() {
    if (chatLockedForHints()) return '힌트 진행 중에는 채팅할 수 없습니다';
    if (chatLockedForTwentyDrawer()) return '출제자는 스무고개 진행 중 채팅할 수 없습니다';
    return '';
  }

  // A3 G1-6: a seated player's newest chat line shows a moment as a bubble on their name card (matched by name)
  let bubbleSeen = null; // (the first view of a room shows no old line)
  function chatBubble(row) {
    if (!row?.text || !document.body.classList.contains('roomPlaying')) return;
    const who = Object.entries(state?.players || {}).find(([, p]) => p && p.label && p.label === row.label); if (!who) return;
    const card = seatCardOf(who[0]); if (!card?.offsetParent) return;
    card.querySelector('.seatBubble')?.remove();
    const b = document.createElement('span'); b.className = 'seatBubble'; b.textContent = String(row.text).slice(0, 40); card.append(b); setTimeout(() => b.remove(), 4000);
  }
  // G-틀① 시스템 기록은 판 위 쪽지: the folded panel's newest system line shows a moment over the board while a hand is played
  let systemSeen = null; let boardNoteTimer = null;
  function boardNote(text) {
    const note = byId('boardNote'); if (!text || !document.body.classList.contains('roomPlaying')) return;
    note.textContent = String(text).slice(0, 80); note.classList.remove('hidden'); clearTimeout(boardNoteTimer); boardNoteTimer = setTimeout(() => note.classList.add('hidden'), 3000);
  }
  function renderChat() {
    const lockMessage = state ? chatLockMessage() : '';
    const locked = Boolean(lockMessage);
    chatInput.disabled = locked;
    chatSendBtn.disabled = locked;
    chatLockNotice.textContent = lockMessage;
    chatLockNotice.classList.toggle('hidden', !locked);
    chatInput.placeholder = locked ? lockMessage : '메시지 입력';

    const rows = state?.chat?.messages || [];
    const chatRows = rows.filter(row => row.type !== 'system');
    const systemRows = rows.filter(row => row.type === 'system');

    const newestId = chatRows.length ? chatRows[chatRows.length - 1].id : 0;
    const hasNewChat = newestId > chatLastSeenId && lastRenderedChatIds.length > 0;
    chatLastSeenId = Math.max(chatLastSeenId, newestId);

    const wasAtBottom = chatAtBottom;
    const oldScrollTop = chatMessages.scrollTop;
    const anchor = wasAtBottom ? null : firstVisibleMessage(chatMessages);
    chatRendering = true;
    roomChatAnnouncer.update(chatRows, state?.me?.chatId || '');
    const chatChanged = fillMessageList(chatMessages, chatRows, '아직 메시지가 없습니다.', state?.me?.chatId || '');
    fillMessageList(systemMessages, systemRows, '시스템 메시지가 없습니다.');
    const newestSystem = systemRows.length ? Number(systemRows[systemRows.length - 1].id) || 0 : 0;
    const newestText = systemRows[systemRows.length - 1]?.text || '';
    if (systemSeen !== null && newestSystem > systemSeen && !(state?.gameType === 'yut' && /님이 \S+[을를] 던졌습니다\.$/.test(newestText))) boardNote(newestText); // (G-틀①; G-게임별 윷 검토: a throw is told by its big card)
    systemSeen = newestSystem;
    lastRenderedChatIds = chatRows.map(row => row.id);
    if (bubbleSeen !== null && newestId > bubbleSeen) chatBubble(chatRows[chatRows.length - 1]); // A3 G1-6 (a line newer than the last view)
    bubbleSeen = newestId;

    if (chatChanged && wasAtBottom) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } else if (chatChanged) {
      restoreMessagePosition(chatMessages, anchor, oldScrollTop);
    }
    // Otherwise leave scrollTop untouched — a reader scrolled up in history is never yanked back down.
    chatRendering = false;

    if (hasNewChat) {
      if (chatVisible() && wasAtBottom) {
        markChatSeen();
      } else {
        chatUnreadCount += 1;
        updateChatBadges();
        if (!wasAtBottom) chatJumpBtn.classList.remove('hidden');
      }
    }
    applyChatLayout();
    applyGameInfoLayout();
  }

  // A3 G1-1 게임방 공통 틀: while a hand is played the room shows one screen -- the room's info folds behind ⓘ, empty
  // seats step aside, a canvas board fits the height left (with the actions under it), and on a phone the 💬·🎮 buttons
  // move into the top bar so they never cover the board
  const roomInfoBtn = document.getElementById('roomInfoBtn');
  roomInfoBtn.addEventListener('click', () => { const open = !document.body.classList.contains('roomInfoOpen'); document.body.classList.toggle('roomInfoOpen', open); roomInfoBtn.setAttribute('aria-expanded', String(open)); fitBoard(); });
  const floatHome = chatFloatBtn.parentElement; const topActions = document.querySelector('.roomBar .topActions');
  // G1-3 내 행동은 판 바로 아래: the game's controls (윷 던지기, 숫자야구 추측, 라이어 힌트 …) leave the side panel for the spot under
  // the board while a hand is played (ids kept -- keys and tests lean on them); a mark keeps their place in the panel
  const actionsPanel = document.getElementById('gameActionsPanel'); const actionsMark = document.createComment('gameActionsPanel'); actionsPanel.before(actionsMark);
  const boardActionsSpot = document.getElementById('quickChat');
  // (G-틀①: the panel folds while a hand is played -- the yut sticks' and the dice's throw goes under the board with the actions)
  const diceSection = document.getElementById('diceYutSection'); const diceMark = document.createComment('diceYutSection'); diceSection.before(diceMark);
  const guessMark = document.createComment('baseballGuessForm'); baseballGuessForm.before(guessMark);
  // G-틀③ 게임방 소리 (room-sound.js): a move made -- a stone in the stone games, a card in the others (the yut sticks sound
  // as they are thrown) --, my turn come, the hand over (my win or loss, or just its end). The first view of a room is quiet.
  const STONE_GAMES = new Set(['omok', 'omok2v2', 'othello', 'connect4', 'dots']);
  let soundSeen = null;
  function roomSounds(g) {
    const now = { room: state?.me?.roomCode || state?.roomId || null, moves: Number(g.moveCount) || 0, round: g.round || 0, status: g.status, mine: Boolean(seat && currentActorSeats().seats.has(String(seat))), bell: g.lastBell ? `${g.lastBell.flipId}:${g.lastBell.at}` : null };
    const was = soundSeen; soundSeen = now; const S = window.RoomSound;
    if (!S || !was || was.room !== now.room || was.round !== now.round) return;
    if (now.bell && now.bell !== was.bell) S.play('bell'); // (할리갈리: someone rang it)
    else if (now.status === 'playing' && now.moves > was.moves && state.gameType !== 'yut') S.playPlan ? S.playPlan(S.landPlan(state.gameType, g.lastMove, reducedMotionActive())) : S.play(STONE_GAMES.has(state.gameType) ? 'stone' : 'card'); // (G-게임별 v187: as the stone lands)
    else if (now.status === 'playing' && now.mine && !was.mine) S.play('turn');
    if (was.status === 'playing' && ['finished', 'draw'].includes(now.status)) { const o = seat ? resultOutcome(g, seat, state.gameType) : null; S.play(o === 'win' ? 'win' : o === 'loss' ? 'lose' : 'end'); }
  }
  // G-틀④ 결과는 판 위 장면: the winner's name plate is crowned and lit while the result stands (a team: its colour's cards)
  function markWinners(g) {
    document.querySelectorAll('.seatWinner').forEach((c) => c.classList.remove('seatWinner'));
    if (g.status !== 'finished') return;
    for (const w of [].concat(g.winners?.length ? g.winners : g.winner || []).map(String)) {
      seatCardOf(w)?.classList.add('seatWinner');
      if (/^(black|white)$/.test(w)) document.querySelectorAll(`#teamPlayers .teamPlayer.${w}, #mySeatSpot .teamPlayer.${w}`).forEach((c) => c.classList.add('seatWinner'));
    }
  }
  function setRoomPlaying(on) {
    on = Boolean(on) && !roomView.classList.contains('hidden');
    if (on !== document.body.classList.contains('roomPlaying')) {
      document.body.classList.toggle('roomPlaying', on); if (!on) { document.body.classList.remove('roomInfoOpen'); roomInfoBtn.setAttribute('aria-expanded', 'false'); }
      chatOverlayOpen = false; gameInfoOverlayOpen = false; applyChatLayout(); applyGameInfoLayout(); // (G-틀①: the panels fold for the hand, back after)
    }
    menuResignBtn.classList.toggle('hidden', !on || resignBtn.classList.contains('hidden')); // (C4 P3-4: not a watcher's, nor when 기권 cannot be pressed)
    // (G-틀④ 검토: and while a hand's result stands -- never over 다음 판 on a phone; G-게임별 다빈치 검토: and before a hand too --
    // never over the room's words while seats are chosen: in the room the round buttons are always in the bar)
    const inBar = on || !roomView.classList.contains('hidden');
    const roomBar = document.querySelector('header.roomBar'); if (roomBar) document.body.style.setProperty('--roomBarBottom', `${Math.max(8, roomBar.offsetTop + roomBar.offsetHeight + 8)}px`); /* (a phone's toast just under it, before a hand) */
    for (const b of [gameInfoFloatBtn, chatFloatBtn]) { const home = inBar ? topActions : floatHome; if (b.parentElement !== home) (inBar ? topActions.prepend(b) : floatHome.append(b)); }
    if (on && actionsPanel.nextElementSibling !== boardActionsSpot) boardActionsSpot.before(actionsPanel); else if (!on && actionsMark.nextSibling !== actionsPanel) actionsMark.after(actionsPanel);
    // (G-게임별 윷: a yut hand throws on a straw mat beside the board -- a phone's under it -- not over the board)
    // (G-게임별 v187: 숫자야구's guess right under my secret, above the record -- on a PC within the screen; its home is the actions panel)
    const guessSpot = document.querySelector('#baseballPanel .baseballHistoryHead'); if (on && state?.gameType === 'baseball' && guessSpot) { if (guessSpot.previousElementSibling !== baseballGuessForm) guessSpot.before(baseballGuessForm); } else if (guessMark.nextSibling !== baseballGuessForm) guessMark.after(baseballGuessForm);
    if (on && state?.gameType === 'yut') { if (diceSection.previousElementSibling !== canvasWrap) canvasWrap.after(diceSection); }
    else if (on && diceSection.nextElementSibling !== actionsPanel) actionsPanel.before(diceSection); else if (!on && diceMark.nextSibling !== diceSection) diceMark.after(diceSection);
    placeMySeat(); fitBoard(); renderTurnRing();
    const boardKey = `${state?.gameType}:${state?.game?.round}:${state?.game?.moveCount}`; if (boardKey !== touchPickKey) { touchPickKey = boardKey; touchPick = null; } // (Codex review: a first tap holds for this board only)
  }
  function fitBoard() {
    const wrap = canvasWrap; wrap.style.maxWidth = '';
    if (!document.body.classList.contains('roomPlaying') || !wrap.offsetParent || wrap.classList.contains('cityBoard')) return;
    const below = [...document.querySelectorAll('#mySeatSpot, #yutControls, .boardCard > .diceYutSection, .boardCard > .gameActionsPanel, #quickChat, .boardCard > .mobileActions')].reduce((n, el) => n + (el.offsetParent ? el.offsetHeight + 8 : 0), 0);
    const mat = document.querySelector('#boardScroll > .diceYutSection'); const stacked = mat?.offsetParent && getComputedStyle(mat.parentElement).flexDirection === 'column'; // (윷 멍석: under the board on a phone)
    const top = wrap.getBoundingClientRect().top + window.scrollY;
    wrap.style.maxWidth = `${Math.max(160, Math.floor(window.innerHeight - top - below - (stacked ? mat.offsetHeight + 8 : 0) - 12))}px`;
  }
  window.addEventListener('resize', () => fitBoard());
  // (G-게임별 다빈치 검토) on a phone the side panel is an overlay behind 🎮, and the start of 다빈치·도둑잡기·할리갈리… is in it:
  // the live start button mirrored under the board, so a host on a phone sees how to begin
  const mobileStartBtn = document.getElementById('mobileStartBtn'); let mobileStartTarget = null;
  mobileStartBtn.addEventListener('click', () => mobileStartTarget?.click());
  function syncMobileStart() {
    mobileStartTarget = isMobileLayout() && !roomView.classList.contains('hidden') ? [...gameInfoPanel.querySelectorAll('button[id$="StartBtn"]')].find((b) => !b.closest('.hidden') && !b.disabled) || null : null;
    mobileStartBtn.classList.toggle('hidden', !mobileStartTarget);
    if (mobileStartTarget) mobileStartBtn.textContent = mobileStartTarget.textContent;
  }
  // A3 G1-4 차례 시간 고리: the turn seat's clock (the server's public turnTimer) round that seat's name card, for everyone,
  // on PC and phone; the last 10 seconds red
  let turnRingClock = 0; let turnRingTimer = null;
  function renderTurnRing() {
    document.querySelectorAll('.turnRing').forEach((r) => r.remove());
    const t = state?.turnTimer; clearInterval(turnRingTimer); turnRingTimer = null;
    if (!t || !document.body.classList.contains('roomPlaying')) return;
    // (G-게임별 다빈치: no seat cards while a hand is played -- the ring on that seat's rack label)
    const card = [seatCardOf(t.seat), document.querySelector(`#davinciHands .davinciHand[data-owner="${t.seat}"] > strong`), document.querySelector(`#oldmaidSeats .oldmaidSeat[data-seat="${t.seat}"] .oldmaidSeatInfo`), String(t.seat) === String(seat) ? document.querySelector('#oldmaidPanel .oldmaidMyHeader h3') : null].find((c) => c?.offsetParent);
    if (!card) return;
    turnRingClock = Date.now() - Number(t.serverNow || Date.now());
    const ring = document.createElement('span'); ring.className = 'turnRing'; ring.setAttribute('role', 'timer'); const text = document.createElement('b'); ring.append(text); card.append(ring);
    const total = Math.max(1000, t.deadlineAt - Number(t.serverNow || Date.now()));
    const tick = () => { const left = Math.max(0, t.deadlineAt - (Date.now() - turnRingClock)); const s = Math.ceil(left / 1000);
      text.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; ring.style.setProperty('--p', String(Math.min(1, left / total))); ring.classList.toggle('late', s <= 10);
      ring.setAttribute('aria-label', `${t.seat === seat ? '내' : '상대'} 차례 남은 시간 ${s}초`); if (!left) { clearInterval(turnRingTimer); turnRingTimer = null; } };
    tick(); turnRingTimer = setInterval(tick, 250);
  }
  function renderTeamPlayers() {
    teamPlayers.replaceChildren();
    const bingo = isBingoGame();
    const pictionary = isPictionaryGame();
    const liar = isLiarGame();
    const oldmaid = isOldMaidGame();
    const city = isCityKingGame();
    const twenty = isTwentyGame();
    const davinci = isDavinciGame();
    const pandemic = isPandemicGame();
    const halli = isHalliGame();
    const gostop = isGostopGame();
    // Land King is host-started like bingo/oldmaid, so this strip only ever shows seats the
    // engine actually knows about once playing; before start it still lists every open seat.
    const seats = city && state.game.status !== 'selecting' ? (state.game.seatOrder || []) : numberedSeats();
    for (const number of seats) {
      const player = state.players[number];
      const card = document.createElement('div');
      const color = seatColor(number);
      const currentTurn = twenty ? (state.game.turnSeat === number || (state.game.drawerSeat === number && ['secret','answering','judging'].includes(state.game.phase))) : pictionary ? state.game.drawerSeat === number : liar ? state.game.currentSpeaker === number : oldmaid ? state.game.turn === number : (davinci || pandemic) ? state.game.turn === number : halli ? state.game.turn === number : bingo ? state.game.turn === number : city ? state.game.turn === number : state.game.nextSeat === number;
      const eliminated = (city && state.game.players?.[number]?.eliminated) || (halli && state.game.eliminated?.includes(number));
      card.className = `teamPlayer ${(isRpgGame() || gostop || bingo || pictionary || liar || oldmaid || city || twenty || davinci || halli || pandemic) ? 'bingoSeat' : color}${seat === number ? ' mySeat' : ''}${player && !player.connected ? ' disconnected' : ''}${eliminated ? ' disconnected' : ''}`;
      card.dataset.seat = number; // public seat number only -- renderCurrentActor() keys on it
      card.classList.toggle('emptySeat', !player); // (A3 G1-1: hidden while a hand is played)
      const title = document.createElement('strong');
      title.textContent = twenty ? `${number}번${number === state.game.drawerSeat && state.game.status === 'playing' ? ' · 출제자' : state.game.turnSeat === number && state.game.status === 'playing' ? ' · 질문 차례' : ''}` : pictionary
        ? `${number}번${state.game.mode === 'team' ? ` · ${Number(number) % 2 ? 'A' : 'B'}팀` : ''}${currentTurn && state.game.status === 'playing' ? ' · 출제자' : ''}`
        : liar ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 발언 차례' : ''}`
        : oldmaid ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 뽑기 차례' : ''}`
        : bingo ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 현재 턴' : ''}`
        : halli ? `${number}번${eliminated ? ' · 탈락' : currentTurn && state.game.status === 'playing' ? ' · 뒤집을 차례' : ''}`
        : pandemic ? `${number}번${state.game.roles?.[number] ? ` · ${PANDEMIC_ROLE_KO[state.game.roles[number]] || ''}` : ''}${currentTurn && state.game.status === 'playing' ? ' · 내 차례' : ''}`
        : davinci ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 추측 차례' : ''}`
        : gostop ? `${number}번${state.game.status === 'playing' && state.game.turn === number ? ' · 차례' : ''}`
        : isRpgGame() ? `${number}번${state.game.classes?.[number] ? ` · ${state.game.classInfo?.[state.game.classes[number]]?.name || ''}` : ''}`
        : city ? `${number}번${eliminated ? ' · 파산' : currentTurn && state.game.status === 'playing' ? ' · 현재 차례' : ''}`
        : `${number}번 · ${color === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;
      const name = document.createElement('small');
      name.textContent = player
        ? `${player.label}${gostop && state.game.seats?.[number] ? ` · 손패 ${state.game.seats[number].handCount}장 · ${state.game.seats[number].score}점` : ''}${oldmaid ? ` · ${state.game.counts?.[number] ?? 0}장` : halli ? ` · 뒷면 ${state.game.pileCounts?.[number] ?? 0}장` : pandemic ? ` · 손패 ${state.game.hands?.[number]?.length ?? 0}장` : davinci ? ` · 타일 ${state.game.hands?.[number]?.length ?? 0}장` : (pictionary || liar || twenty) ? ` · ${state.game.scores?.[number] || 0}점` : bingo ? ` · ${state.game.lineCounts?.[number] || 0}줄` : city ? ` · 현금 ${state.game.players?.[number]?.cash ?? 0}` : ''} · ${player.connected ? '접속 중' : '연결 끊김'}`
        : '자리 선택 가능';
      card.append(title, name);
      seatFace(card, player); // A3 G1-5
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
    const twenty = isTwentyGame();
    const davinci = isDavinciGame();
    const pandemic = isPandemicGame();
    const halli = isHalliGame();
    const team = isTeamGame();
    const numbered = isNumberedSeatGame();
    const seats = numberedSeats();
    roleChooser.classList.toggle('connectFourRole', connect4);
    roleChooser.classList.toggle('blueRedRole', yut || dots || city);
    standardRoleButtons.classList.toggle('hidden', numbered);
    teamRoleButtons.classList.toggle('hidden', !numbered);
    roleChooser.classList.toggle('hidden', !selecting);
    if (numbered) {
      roleChooser.querySelector('small').textContent = isRpgGame() ? '1~4명이 자리를 선택하고 역할(수호자·사냥꾼·비술사)을 고르면 방장이 원정을 시작합니다.' : isGostopGame() ? '2~3명이 자리를 선택합니다. 2명은 맞고, 3명은 고스톱이며 방장이 점당 포인트를 정하고 시작합니다.' : twenty ? '2~8명이 자리를 선택합니다. 방장이 개인전/협동전과 1~10라운드를 정한 후 시작합니다.' : pictionary
        ? (state.game.mode === 'team' ? '팀전: 홀수 자리는 A팀, 짝수 자리는 B팀입니다. 4·6·8명이 두 팀 같은 인원으로 앉아야 시작합니다.' : '2~8명이 자리를 선택할 수 있습니다. 방장이 설정을 정하고 그림 맞히기를 시작합니다.')
        : liar ? '3~8명이 자리를 선택할 수 있습니다. 방장이 1판/3판을 정하고 시작합니다.'
        : halli ? '2~6명이 자리를 선택합니다. 방장이 5분 또는 10분을 정하고 시작합니다.'
        : pandemic ? '2~4명이 자리를 선택합니다. 방장이 난이도를 정하고 시작하면 모두 함께 질병과 싸웁니다.'
        : davinci ? '2~4명이 자리를 선택합니다. 방장이 시작하면 숫자 타일을 나눠 받습니다.'
        : oldmaid ? '2~4명이 자리를 선택할 수 있습니다. 방장이 시작하면 카드를 나누고 짝을 자동으로 버립니다.'
        : bingo
        ? '2~4명이 1~4번 자리를 선택할 수 있습니다. 방장이 승리 줄 수를 정하고 시작합니다.'
        : city ? '2~4명이 1~4번 자리를 선택할 수 있습니다. 방장이 랜드킹을 시작합니다.'
        : '1·3번은 흑팀, 2·4번은 백팀입니다. 네 명이 모두 자리를 정하면 1→2→3→4 순서로 시작합니다.';
      for (const button of teamSeatButtons) {
        const number = button.dataset.teamSeat;
        button.classList.toggle('hidden', !seats.includes(number));
        button.textContent = pictionary && state.game.mode === 'team' ? `${number}번 · ${Number(number) % 2 ? 'A' : 'B'}팀`
          : (isRpgGame() || isGostopGame() || bingo || pictionary || liar || oldmaid || city || twenty || davinci || halli || pandemic) ? `${number}번 자리`
          : `${number}번 · ${seatColor(number) === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;
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
    for (const [button, ink] of [[chooseBlackBtn,'#282132'],[chooseWhiteBtn,'#fff9ef']]) button.querySelector('.stoneMini').style.background = characterPairActive() ? ink : '';
    if (characterPairActive()) {
      chooseBlackBtn.lastChild.nodeValue = '흑 선택'; chooseWhiteBtn.lastChild.nodeValue = '백 선택';
      const help = roleChooser.querySelector('small');
      help.textContent = connect4 ? help.textContent.replaceAll('빨강','흑').replaceAll('노랑','백') : help.textContent.replaceAll('파랑','흑').replaceAll('빨강','백');
    }
    chooseBlackBtn.disabled = Boolean(state.players.black && seat !== 'black');
    chooseWhiteBtn.disabled = Boolean(state.players.white && seat !== 'white');
    chooseBlackBtn.classList.toggle('selected', choice === 'black');
    chooseWhiteBtn.classList.toggle('selected', choice === 'white');
    chooseSpectatorBtn.classList.toggle('selected', choice === 'spectator');
  }

  // v1.6.40: universal connection-drop popup. A brief network blip should never pop this up --
  // syncGamePause on the server already only flags `paused` once a participant's SSE stream and
  // session both drop, but we additionally debounce showing the dialog itself so a disconnect that
  // resolves within a couple of seconds (the client's own SSE stream retries after 1.8s) never even
  // flashes the popup. "기다리기" only dismisses this one pause episode -- the persistent end-game
  // button stays available the whole time, and a fresh pause (new round, a different seat, or the
  // same seat going quiet again) always re-prompts. v1.6.63: the same `disconnectedSeats`/`paused`
  // pair is also set when a still-connected seat just sits on its own turn for a minute
  // (server-side syncGamePause folds that in), so this dialog and the confirm text below cover
  // both "gone" and "gone quiet" without the client needing to tell them apart.
  function pauseEpisodeKey(g) {
    const disconnected = (g?.disconnectedSeats || []);
    return disconnected.length ? `${g.round || 1}:${disconnected.slice().sort().join(',')}` : null;
  }

  // v1.8.4: my seat is flagged unresponsive while I am actually here -- the first real input tells the server so,
  // and it restarts my idle clock (lifting the pause) instead of leaving the others to wait or end the game.
  let presentSentAt = 0;
  function announcePresence() {
    const g = state?.game;
    if (!seat || !g || g.status !== 'playing' || !g.paused || !(g.disconnectedSeats || []).includes(seat)) return;
    if (Date.now() - presentSentAt < 1500) return;
    presentSentAt = Date.now();
    api('/api/room/present', { method: 'POST', body: '{}' }).then((data) => {
      if (data?.state && !isStaleRoomState(data.state)) { state = data.state; renderRoom(); }
    }).catch(() => {});
  }
  for (const type of ['pointerdown', 'keydown']) document.addEventListener(type, announcePresence, true);

  function updatePauseDialog() {
    const g = state?.game;
    const active = g && g.status === 'playing' && g.paused && seat;
    const key = active ? pauseEpisodeKey(g) : null;

    if (key !== pauseDialogPendingKey) {
      if (pauseDialogShowTimer !== null) clearTimeout(pauseDialogShowTimer);
      pauseDialogShowTimer = null;
      pauseDialogPendingKey = key;
      if (key && key !== pauseDialogDismissedKey) {
        const disconnectedNow = g.disconnectedSeats.slice();
        pauseDialogShowTimer = setTimeout(() => {
          pauseDialogShowTimer = null;
          if (pauseEpisodeKey(state?.game) !== key || key === pauseDialogDismissedKey) return;
          pauseDialogShownKey = key;
          const names = disconnectedNow.map((s) => `${state.players?.[s]?.label || seatKo(s)}`).join(', ');
          pauseDialogMessage.textContent = `참가자 ${names}님이 응답하지 않아 게임이 일시 중단되었습니다.`;
          if (!pauseDialog.open) pauseDialog.showModal();
        }, 2000);
      }
    }

    if (!key) {
      pauseDialogShownKey = null;
      pauseDialogDismissedKey = null;
      if (pauseDialog.open) pauseDialog.close();
    }
  }

  function renderRoom() {
    if (!state) return;
    window.GameBoot?.prefetch?.(`game.${state.gameType}`); // v1.10.25: this game's resources, once, in the background
    const g = state.game;
    seat = state.me?.seat || null;
    isHost = Boolean(state.me?.isHost);
    renderMyActionTimer(true);
    const gameLabel = ['omok', 'omok2v2'].includes(state.gameType)
      ? gameDisplayName(state.gameType) : (state.gameName || gameName(state.gameType));
    const roomLabel = state.title || gameLabel;
    roomIdentityLabel.textContent = state.title ? `${gameLabel} · ${identityText()}` : identityText();
    roomGameLogo.textContent = roomLabel;
    paintRoomArt(state.gameType);
    const myPoints = state.me?.pointBalance;
    roomPointBadge.classList.toggle('hidden', myPoints === null || myPoints === undefined);
    if (myPoints !== null && myPoints !== undefined) roomPointBadge.textContent = `내 포인트 ${Number(myPoints).toLocaleString('ko-KR')}P`;
    // v1.7.3: the room's point rule beside my balance (server-provided, never computed here).
    const pointRule = state.points?.policy === 'entry' ? `내기 ${Number(state.points.entryFee).toLocaleString('ko-KR')}P · 승자 ${100 - state.points.burnPercent}%`
      : state.points?.policy === 'settlement' ? `정산 ${state.points.burnPercent}% 소각`
      : state.points?.policy === 'practice' ? 'AI 연습 · 포인트·전적 없음' // v1.10.72
      : state.points?.policy === 'friendly' ? '친선 · 포인트 없음' : state.points?.policy === 'none' ? '포인트·전적 없음' : ''; // (G-포인트)
    roomPointRule.classList.toggle('hidden', !pointRule);
    roomPointRule.textContent = pointRule;
    roomPointRule.title = state.points?.policy === 'entry'
      ? `게임이 시작될 때 참가자마다 ${Number(state.points.entryFee).toLocaleString('ko-KR')}P가 차감됩니다. 모인 포인트의 ${100 - state.points.burnPercent}%는 승자가 나눠 받고 ${state.points.burnPercent}%는 소각됩니다. 관전과 같은 판 재접속은 차감하지 않습니다.`
      : state.points?.policy === 'settlement' ? `정산으로 실제 이동하는 포인트의 ${state.points.burnPercent}%는 소각되고 나머지를 승자가 받습니다.` : '';
    rulesText.textContent = state.rules || '';
    setBaseDocumentTitle(`${roomLabel} · 아일랜드`);
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
    const twenty = isTwentyGame();
    const oldmaid = isOldMaidGame();
    const davinci = isDavinciGame();
    const pandemic = isPandemicGame();
    const halli = isHalliGame();
    roundNumber.textContent = twenty ? `${g.roundNumber || 0}/${g.totalRounds || '?'}라운드` : pictionary ? `${g.roundNumber || 1}/${g.totalRounds || 0}라운드` : liar ? `${g.roundNumber || 0}/${g.totalRounds || 1}판` : `${g.round || 1}판`;
    moveCountLabel.textContent = twenty ? '진행 행동' : pictionary ? '진행 라운드' : liar ? '진행 행동' : oldmaid ? '뽑기 횟수' : state.gameType === 'baseball' ? '추측 횟수' : state.gameType === 'yut' ? '말 이동 수' : state.gameType === 'bingo' ? '선택 수' : state.gameType === 'dots' ? '그은 선 수' : state.gameType === 'cityking' ? '진행 수' : '착수 수';
    moveCount.textContent = String(g.moveCount || 0);
    mySeat.textContent = seat ? seatKo(seat) : choiceKo(state.me?.choice);
    connectedCount.textContent = `${state.connectedCount || 0}명`;
    spectatorCount.textContent = `${state.spectatorCount || 0}명`;
    const scores = !pictionary && !liar && !twenty && g.scores;
    gameScoreRow.classList.toggle('hidden', !scores);
    gameScoreText.textContent = scores ? (state.gameType === 'yut'
      ? `${seatKo('black')} 완주 ${scores.black} · ${seatKo('white')} 완주 ${scores.white}`
      : state.gameType === 'dots' ? `${seatKo('black')} 상자 ${scores.black} · ${seatKo('white')} 상자 ${scores.white}`
        : state.gameType === 'cityking' ? `파랑 자산 ${scores.black} · 빨강 자산 ${scores.white}`
        : `흑 ${scores.black} · 백 ${scores.white}`) : (state.gameType === 'bingo' ? Object.entries(g.lineCounts || {}).map(([n, count]) => `${n}번 ${count}줄`).join(' · ') || '-' : '-');
    // A3 G1-5: a two-seat game's score between the name cards, always in sight (오델로 「2 : 2」 as in the AI practice)
    const versus = document.querySelector('#standardPlayers .versus'); if (versus) { const two = scores && Number.isFinite(Number(scores.black)) && Number.isFinite(Number(scores.white)) && state.gameType !== 'cityking'; versus.textContent = two ? `${scores.black} : ${scores.white}` : 'VS'; versus.classList.toggle('versusScore', Boolean(two)); }
    seatLabel.textContent = isHost ? `방장 · ${seat ? `${seatKo(seat)} 플레이어` : choiceKo(state.me?.choice)}` : `참가자 · ${seat ? `${seatKo(seat)} 플레이어` : choiceKo(state.me?.choice)}`;

    // v1.6.40: a paused, disconnect-affected match takes over the status line for every game type
    // (it used to be shown only for the 4-seat team game); each game's own turn/phase text is only
    // shown while nobody required to act is disconnected.
    const pauseStatusText = g.status === 'playing' && g.paused
      ? `일시정지 · ${(g.disconnectedSeats || []).map((s) => seatKo(s)).join(', ')} 응답 대기`
      : null;
    if (isRpgGame()) {
      const roomInfo = g.room ? `${g.roomIndex + 1}/${g.roomCount} ${g.room.label}` : '';
      statusText.textContent = g.status === 'selecting' ? '잿빛 원정 · 역할 선택 · 방장 시작 대기'
        : g.status === 'finished' ? (g.result?.kind === 'clear' ? '잿빛 원정 성공' : '잿빛 원정 종료')
        : g.phase === 'intermission' ? `잿빛 원정 · ${roomInfo} · 성장 정비` : `잿빛 원정 · ${roomInfo} 전투 중`;
    } else if (isGostopGame()) {
      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '고스톱 · 맞고 · 방장 시작 대기' : g.status === 'draw' ? '나가리' : g.status === 'finished' ? `${g.mode === 'matgo' ? '맞고' : '고스톱'} 종료`
        : `${g.turn === seat && isMobileLayout() ? '' : `${state.players[g.turn]?.label || '참가자'}님 · `}${g.phase === 'go-stop' ? '고/스톱 선택' : g.phase === 'gukjin' ? '국진 선택' : g.phase?.startsWith('choose') ? '먹을 패 선택' : '패를 낼 차례'}`);
    } else if (halli) {
      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '할리갈리 · 방장 시작 대기' : g.status === 'finished' ? '할리갈리 종료' : `${actorName(g.turn)} 카드 뒤집기 차례`);
    } else if (pandemic) {
      const phase = g.pending?.next === 'intensify' ? '전염 강화 대기' : ({ actions: `행동 ${g.actionsLeft}번 남음`, draw: '카드 획득', infect: '도시 감염' }[g.phase] || '진행 대기');
      statusText.textContent = g.status === 'selecting' ? '팬데믹 · 방장 시작 대기' : g.status === 'finished' ? (g.winner?.length ? '팬데믹 · 모두 함께 승리!' : '팬데믹 · 함께 패배') : `${actorName(g.turn)} 차례 · ${phase}`;
    } else if (davinci) {
      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '다빈치 코드 · 방장 시작 대기' : g.status === 'finished' ? '다빈치 코드 종료' : `${actorName(g.turn)} · ${g.phase === 'reveal-own' ? '자기 타일 공개' : '숫자 추측'}`);
    } else if (twenty) {
      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '스무고개 · 방장 시작 대기' : g.status === 'round-ended' ? '라운드 결과 · 다음 라운드 대기' : g.status === 'finished' ? '스무고개 종료' : `스무고개 · ${g.category || '카테고리 선택'} · ${twentyHeadline(g)}`);
    } else if (oldmaid) {
      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '도둑잡기 자리 선택 · 방장 시작'
        : g.status === 'finished' ? (g.endReason === 'resign' ? '도둑잡기 종료' : `${state.players[g.loser]?.label || '조커 보유자'}님 패배`)
        : isMobileLayout() ? (g.turn === seat ? '카드 한 장 뽑기' : g.target === seat ? '상대가 내 카드를 뽑는 중' : `${state.players[g.turn]?.label || '플레이어'}님이 뽑는 중`) // (도둑잡기 검토: a phone's line short, one line)
        : `${state.players[g.turn]?.label || '플레이어'}님 차례 · ${state.players[g.target]?.label || '상대'}님 카드 뽑기`);
    } else if (liar) {
      const speaker = g.currentSpeaker ? `${state.players[g.currentSpeaker]?.label || g.currentSpeaker + '번'}님` : '';
      const phases = { hint1: '1차 힌트', hint2: '2차 힌트', extraHint: '동률 후보 추가 힌트', vote: '라이어 투표', revote: '재투표', guess: '라이어 최종 추측', reveal: '판 결과 공개' };
      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '참가자 자리 선택 · 방장 시작' : g.status === 'finished' ? '라이어게임 종료' : `${phases[g.phase] || '진행 중'}${speaker ? ` · ${speaker}` : ''}`);
    } else if (pictionary) {
      const drawerLabel = g.drawerSeat ? `${state.players[g.drawerSeat]?.label || g.drawerSeat + '번'}님` : '출제자';
      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '참가자 자리 선택 · 방장 시작'
        : g.status === 'finished' ? '그림 맞히기 종료'
        : g.phase === 'reveal' ? `${drawerLabel} 라운드 결과 공개`
        : `${drawerLabel} 그리는 중`);
    } else if (isBingoGame()) {
      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '빙고 참가자 자리 선택 · 방장 시작'
        : g.status === 'finished' ? '빙고 종료'
        : `${seatKo(g.turn)} · ${state.players[g.turn]?.label || '플레이어'}님 숫자 선택 차례`);
    } else if (g.status === 'selecting') statusText.textContent = team ? '4명 자리 선택 중' : '역할 선택 중';
    else if (g.status === 'setup') statusText.textContent = `비밀 숫자 ${g.digitCount || 3}자리 설정 중`;
    else if (g.status === 'playing') {
      statusText.textContent = pauseStatusText || (team ? `${seatKo(g.nextSeat)} · ${state.players[g.nextSeat]?.label || '플레이어'}님 차례`
        : state.gameType === 'yut'
          ? `${seatKo(g.turn)} · ${actorName(g.turn)} ${g.phase === 'move' ? `${g.lastThrow?.name || ''}만큼 움직일 말 선택` : '윷 던질 차례'}${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스` : ''}`
          : state.gameType === 'cityking'
            ? `${seatKo(g.turn)} · ${actorName(g.turn)} ${g.phase === 'buy' ? '도시 매입 여부 선택' : '주사위 굴릴 차례'}`
          : `${seatKo(g.turn)} · ${actorName(g.turn)} 차례${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스` : ''}`);
    } else if (g.status === 'finished') statusText.textContent = `${seatKo(g.winner)} 승리`;
    else statusText.textContent = '무승부';
    if (g.status === 'finished' && g.endReason === 'disconnect') {
      const names = (g.disconnectedAtEnd || []).map((s) => `${state.players?.[s]?.label || seatKo(s)}`).join(', ');
      statusText.textContent += ` · ${names} 응답 없음으로 종료`;
    } else if (g.status === 'finished' && g.endReason === 'resign') {
      statusText.textContent += ' · 기권으로 종료';
    }
    renderHeadlineContext();
    updatePauseDialog();

    if (numbered) renderTeamPlayers();
    else {
      setPlayerCard(blackPlayer, 'black', state.players.black);
      setPlayerCard(whitePlayer, 'white', state.players.white);
    }
    renderParticipants();
    renderChat();
    renderRoleChooser();
    renderCurrentActor();
    evaluateTurnAlert();

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
    const canResign = canAct && (g.status === 'playing' || (state.gameType === 'baseball' && g.status === 'setup'));
    // v1.6.40: any connected, seated participant may end a paused match -- not just the host of
    // the 4-seat team game it started on -- matching the server's generalized end-game handler.
    const canEndPaused = canAct && g.status === 'playing' && g.paused;
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
    const gostop = isGostopGame();
    const rpg = isRpgGame();
    canvasWrap.classList.toggle('hidden', rpg || gostop || baseball || bingo || pictionary || liar || oldmaid || twenty || davinci || halli || pandemic);
    canvasWrap.classList.toggle('connectFour', state.gameType === 'connect4');
    canvasWrap.classList.toggle('yutBoard', yut);
    canvasWrap.classList.toggle('actionableBoard', boardTurnActionable());
    baseballPanel.classList.toggle('hidden', !baseball);
    baseballPanel.classList.toggle('resultWinPanel', baseball && outcome === 'win');
    baseballPanel.classList.toggle('resultLossPanel', baseball && outcome === 'loss');
    baseballSecretForm.classList.toggle('hidden', !baseball);
    baseballGuessForm.classList.toggle('hidden', !baseball);
    yutControls.classList.toggle('hidden', !yut);
    // v1.6.56: yutThrowBtn/yutMoveChoices used to be inside #yutControls and inherited its hidden
    // toggle for free; now that they live in the sidebar's #gameActionsPanel (shared across every
    // game), each moved control needs this same "hide entirely when it's not even this game" toggle
    // of its own -- renderYut()'s own finer-grained toggle (disabled state, move-choice contents)
    // still runs right after this and only when yut is actually active, same order as before.
    yutThrowBtn.classList.toggle('hidden', !yut);
    yutMoveChoices.classList.toggle('hidden', !yut);
    // v1.6.55: the dice/yut animation stage is shared UI (embedded in #gameInfoPanel, see index.html)
    // that's only relevant while a dice/yut-style game is active -- today that's just yut, but a
    // future dice game adds itself to this same condition rather than growing a second stage.
    diceYutSection.classList.toggle('hidden', !yut);
    if (yut) renderYut();
    else {
      yutLastThrowKey = null;
      yutThrowTrackingStarted = false;
      yutThrowAnimating = false;
      yutLastThrowFlags = null;
      yutLastMoveKey = null;
      yutMoveTrackingStarted = false;
      yutPieceAnimation = null;
      yutMoveAnimationGen += 1;
      yutHoverTargetKey = null;
    }
    bingoPanel.classList.toggle('hidden', !bingo);
    bingoSetupRow.classList.toggle('hidden', !bingo || g.status === 'playing'); // (G-게임별 v187: the settings are for before a hand)
    if (bingo) renderBingo();
    cityControls.classList.toggle('hidden', !city);
    cityActionPanel.classList.toggle('hidden', !city);
    canvasWrap.classList.toggle('cityBoard', city);
    if (city) renderCityControls();
    else {
      citySelectedTileIndex = null;
      cityLastRollKey = null;
      cityRollTrackingStarted = false;
      cityAnimation = null;
      if (cityAnimationFrame !== null) cancelAnimationFrame(cityAnimationFrame);
      cityAnimationFrame = null;
      if (canvas.width !== 720 || canvas.height !== 720) { canvas.width = 720; canvas.height = 720; }
    }
    pictionaryPanel.classList.toggle('hidden', !pictionary);
    pictionaryStartBtn.classList.toggle('hidden', !pictionary);
    pictionaryGuessForm.classList.toggle('hidden', !pictionary);
    if (pictionary) renderPictionary();
    liarPanel.classList.toggle('hidden', !liar);
    liarSetupRow.classList.toggle('hidden', !liar);
    liarHintForm.classList.toggle('hidden', !liar);
    liarGuessForm.classList.toggle('hidden', !liar);
    if (liar) renderLiar();
    document.getElementById('twentyPanel').classList.toggle('hidden', !twenty);
    document.getElementById('twentyActionPanel').classList.toggle('hidden', !twenty);
    if (twenty) window.TwentyQuestionsUI.render(state);
    halliPanel.classList.toggle('hidden', !halli);
    halliSetupRow.classList.toggle('hidden', !halli || g.status !== 'selecting');
    if (halli) renderHalli();
    gostopPanel.classList.toggle('hidden', !gostop);
    // v1.8.5: a table game (고스톱·맞고) uses a wider page on PC so the table, not the web panels, is the centre.
    document.body.classList.toggle('tableGameRoom', gostop || davinci || oldmaid);
    // while a hand is being played the table itself shows every seat (name, hand, captures), so the generic seat strip steps aside
    // (G-게임별 다빈치·도둑잡기: its racks / seats round the table are the name plates too)
    document.body.classList.toggle('tableGamePlaying', (gostop || davinci || oldmaid) && g.status !== 'selecting');
    document.body.classList.toggle('roomResult', ['finished', 'draw'].includes(g.status)); // (G-틀④: the bar stays thin over a result)
    setRoomPlaying(g.status === 'playing' || g.status === 'setup'); // A3 G1-1
    roomSounds(g); markWinners(g);
    requestAnimationFrame(syncMobileStart);
    if (gostop) window.GostopUI.render(state);
    rpgPanel.classList.toggle('hidden', !rpg);
    if (rpg) rpgRender(state); else rpgUnmount();
    pandemicPanel.classList.toggle('hidden', !pandemic);
    if (pandemic) window.PandemicUI.render(state);
    davinciPanel.classList.toggle('hidden', !davinci);
    davinciStartBtn.classList.toggle('hidden', !davinci || g.status !== 'selecting');
    if (davinci) renderDavinci();
    oldmaidPanel.classList.toggle('hidden', !oldmaid);
    oldmaidStartBtn.classList.toggle('hidden', !oldmaid);
    oldmaidModeChooser.classList.toggle('hidden', !oldmaid);
    if (oldmaid) renderOldMaid();
    if (g.status !== 'finished') boardOverlay.classList.remove('legendResult');
    if (rpg || gostop || pictionary || liar || oldmaid || twenty || davinci || halli || pandemic) {
      boardOverlay.classList.add('hidden');
    } else if (baseball) {
      boardOverlay.classList.add('hidden');
      renderBaseball();
    } else if (g.status === 'selecting') {
      boardOverlay.classList.remove('resultWin', 'resultLoss');
      const choice = state.me?.choice;
      if (!choice) boardOverlay.textContent = team || city ? '1 · 2 · 3 · 4번 또는 관전을 선택하세요' : `${choiceKo('black')} · ${choiceKo('white')} · 관전 중 역할을 선택하세요`;
      else if (choice === 'spectator') boardOverlay.textContent = '관전자로 대기 중입니다';
      else boardOverlay.textContent = `${choiceKo(choice)} 선택 완료 · 다른 플레이어를 기다리는 중`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'playing' && g.paused) {
      boardOverlay.classList.remove('resultWin', 'resultLoss');
      boardOverlay.textContent = `일시정지 · ${(g.disconnectedSeats || []).map((s) => seatKo(s)).join(', ')} 플레이어를 기다리는 중`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'finished') {
      boardOverlay.classList.toggle('legendResult', legendWinOnBoard(g)); // keep the legend win sequence uncovered
      if (outcome) { setResultBoardOverlay(outcome, g); resultOverlayExtras(outcome); }
      else {
        boardOverlay.classList.remove('resultWin', 'resultLoss');
        boardOverlay.textContent = `${seatKo(g.winner)} 승리`;
      }
      if (g.endReason === 'disconnect') {
        const names = (g.disconnectedAtEnd || []).map((s) => `${state.players?.[s]?.label || seatKo(s)}`).join(', ');
        const note = document.createElement('span');
        note.textContent = `${names} 응답 없음으로 종료`;
        boardOverlay.appendChild(note);
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

    if (!twenty) drawBoard();
  }

  let baseballThemeApplied = null;
  let baseballPrevStatus = null;
  let baseballPlayedWin = null;
  function renderBaseball() {
    const g = state.game;
    const digitCount = Number(g.digitCount) === 4 ? 4 : 3;
    const numberPattern = `[1-9][0-9]{${digitCount - 1}}`;
    for (const input of [baseballSecretInput, baseballGuessInput]) {
      input.pattern = numberPattern;
      // minLength/maxLength must never cross during the swap, or the browser throws
      // (e.g. raising minLength past the still-3 maxLength when a 4-digit room loads).
      input.minLength = 0;
      input.maxLength = digitCount;
      input.minLength = digitCount;
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
    setActionable(baseballSecretInput, Boolean(g.status === 'setup' && seat && !myReady && !g.paused));
    setActionable(baseballGuessInput, Boolean(g.turn === seat && actionWindowOpen(g)));
    if (g.status === 'selecting') baseballHint.textContent = '선공·후공을 선택하면 각자 비밀 숫자를 설정할 수 있습니다.';
    else if (g.status === 'setup') baseballHint.textContent = !seat ? '플레이어들의 비밀 숫자 준비를 기다리는 중입니다.' : (myReady ? '비밀 숫자 설정 완료. 상대방이 준비할 때까지 기다려 주세요.' : `상대에게 보이지 않을 비밀 숫자 ${digitCount}개를 입력해 주세요.`);
    else if (g.status === 'playing') baseballHint.textContent = seat === g.turn ? '내 차례입니다! 상대의 숫자를 추측해 주세요.' : `${seatKo(g.turn)}이(가) 추측할 차례입니다.`;
    else if (g.status === 'finished' && seat) baseballHint.textContent = resultOutcome(g, seat, state.gameType) === 'win'
      ? '🏆 승리! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.'
      : '패배! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.';
    else baseballHint.textContent = g.winner ? `${seatKo(g.winner)} 승리! 다음 판 준비를 누르면 새 숫자로 다시 시작합니다.` : '이번 판이 끝났습니다.';
    const SLB = window.SkinLooks; // v1.7.38 skins: the host's theme paints the list; each row uses its guesser's skin
    SLB.h.unstyle(baseballHistory, baseballThemeApplied?.list); SLB.h.unstyle(baseballPanel, baseballThemeApplied?.panel);
    baseballThemeApplied = null;
    const themeB = SLB.def(state.skinTheme);
    if (themeB?.panel) { // the whole panel (not only the list) takes the host's theme, so the room reads differently at a glance
      baseballThemeApplied = {
        list: { backgroundColor: 'transparent', boxShadow: 'none' },
        panel: { backgroundImage: SLB.h.img(`bb-panel:${state.skinTheme}`, 720, 520, themeB.panel), backgroundSize: 'cover', ...themeB.frame },
      };
      SLB.h.style(baseballHistory, baseballThemeApplied.list); SLB.h.style(baseballPanel, baseballThemeApplied.panel);
    }
    baseballHistory.replaceChildren();
    const guesses = g.guesses || [];
    const latestGuess = guesses.at(-1);
    const baseballRecent = observeRecentAction(latestGuess
      ? `guess:${guesses.length}:${latestGuess.at || ''}:${latestGuess.color}:${latestGuess.guess}`
      : null);
    if (!guesses.length) {
      const empty = document.createElement('p');
      empty.className = 'chatEmpty';
      empty.textContent = '아직 추측 기록이 없습니다.';
      baseballHistory.appendChild(empty);
    }
    for (const [i, entry] of [...guesses].reverse().entries()) {
      const item = document.createElement('div');
      item.className = 'baseballHistoryRow' + (entry.color === seat ? ' mine' : '') + (i === 0 ? recentActionClasses(baseballRecent) : '');
      const rowSkin = SLB.def(state.players?.[entry.color]?.skin);
      if (rowSkin?.row) {
        SLB.h.style(item, rowSkin.row);
        if (entry.color === seat) item.style.boxShadow = `inset 5px 0 0 #60a5fa${rowSkin.row.boxShadow ? `, ${rowSkin.row.boxShadow}` : ''}`;
      }
      const left = document.createElement('span');
      left.textContent = `#${guesses.length - i} ${seatKo(entry.color)} · `;
      const digits = document.createElement('strong');
      digits.textContent = entry.guess;
      if (rowSkin?.digit) SLB.h.style(digits, rowSkin.digit);
      left.appendChild(digits);
      const result = document.createElement('span');
      result.className = 'result';
      const out = entry.strikes === 0 && entry.balls === 0;
      result.setAttribute('aria-label', out ? '아웃' : `${entry.strikes}S ${entry.balls}B`);
      // v1.7.12 실물감: ballpark scoreboard lamps -- S yellow, B green, O red.
      const digitsCount = String(entry.guess).length;
      for (const [label, lit, total, kind] of [['S', entry.strikes, digitsCount, 'strike'], ['B', entry.balls, digitsCount, 'ball'], ['O', out ? 1 : 0, 1, 'out']]) {
        const group = document.createElement('span');
        group.className = `sbo sbo-${kind}`;
        group.setAttribute('aria-hidden', 'true');
        group.append(label);
        for (let n = 0; n < total; n += 1) {
          const lamp = document.createElement('i');
          if (n < lit) lamp.className = 'on';
          if (rowSkin?.lamp) {
            const L = rowSkin.lamp; const color = n < lit ? L[kind] : L.off;
            SLB.h.style(lamp, { backgroundColor: color, borderRadius: L.radius, boxShadow: n < lit && L.glow ? `0 0 8px ${color}` : 'inset 0 1px 2px rgba(0,0,0,.5)', ...(L.pin ? { width: '8px', height: '15px' } : {}), ...(L.ring ? { outline: '2px solid rgba(20,100,90,.5)' } : {}) });
          }
          group.appendChild(lamp);
        }
        result.appendChild(group);
      }
      item.append(left, result);
      baseballHistory.appendChild(item);
      // v1.9.1: a legend row one strike short of the answer plays its `special` instead of the plain row effect.
      const oneShort = rowSkin?.legend && rowSkin.special && entry.strikes === String(entry.guess).length - 1;
      if (i === 0 && baseballRecent.fresh && oneShort) requestAnimationFrame(() => SLB.h.playFx(item, rowSkin.special, 1300, 40));
      else if (i === 0 && baseballRecent.fresh && rowSkin?.fx) requestAnimationFrame(() => SLB.h.playFx(item, rowSkin.fx, 700, 40));
    }
    const finishedKey = g.status === 'finished' ? `${state.me?.roomCode}:${g.round || 1}` : null;
    const winnerSkin = g.status === 'finished' && g.winner ? SLB.def(state.players?.[g.winner]?.skin) : null;
    if (finishedKey && finishedKey !== baseballPlayedWin && baseballPrevStatus === 'playing' && winnerSkin?.win) requestAnimationFrame(() => SLB.h.playFx(baseballHistory, winnerSkin.win, winnerSkin.legend ? 2200 : 1500, 10));
    if (finishedKey) baseballPlayedWin = finishedKey;
    baseballPrevStatus = g.status;
  }

  // G-게임별 윷 (gamecenter-notes docs/gamehall-audit-20261025.md 「윷놀이」): the throw's name big on the board a moment --
  // 윷·모 with 「한 번 더」 -- for everyone, as the sticks settle
  function yutCall(t) {
    if (!t?.name) return;
    canvasWrap.querySelector('.yutCall')?.remove();
    const el = document.createElement('div'); el.className = `yutCall${t.steps >= 4 ? ' again' : t.steps < 0 ? ' back' : ''}`; el.setAttribute('aria-hidden', 'true');
    const big = document.createElement('b'); big.textContent = `${t.name}!`;
    const small = document.createElement('small'); small.textContent = `${yutStepsLabel(t.steps)}${t.steps >= 4 ? ' · 한 번 더' : ''}`;
    el.append(big, small); canvasWrap.append(el); setTimeout(() => el.remove(), 1700);
  }
  function yutStepsLabel(steps) {
    return steps < 0 ? `${Math.abs(steps)}칸 후진` : `${steps}칸`;
  }

  function renderYut() {
    const g = state.game;
    const mine = Boolean(seat && g.turn === seat && g.status === 'playing');
    yutThrowBtn.disabled = !(mine && g.phase === 'throw') || yutThrowAnimating;
    setActionable(yutThrowBtn, !yutThrowBtn.disabled && actionWindowOpen(g), 'primary');
    yutThrowBtn.textContent = mine && g.phase === 'throw' ? '윷 던지기' : '던지기 대기';
    yutLastThrow.textContent = g.lastThrow
      ? `최근 결과: ${g.lastThrow.name} · ${yutStepsLabel(g.lastThrow.steps)}`
      : '아직 던진 윷이 없습니다';
    diceYutResult.textContent = g.lastThrow ? `${g.lastThrow.name} · ${yutStepsLabel(g.lastThrow.steps)}` : '멍석을 눌러 던져요'; // (G-게임별 윷: on the mat -- the 「최근 결과」 box is folded while a hand is played)
    diceYutSection.classList.toggle('canThrow', !yutThrowBtn.disabled);
    const throwKey = g.lastThrow ? `${g.lastThrow.at}:${g.lastThrow.color}:${g.lastThrow.backs}:${g.lastThrow.name}` : null;
    // Same reconnect-safe pattern as Land King's dice: yutThrowTrackingStarted (not a null check on
    // the key alone) tells a genuinely new throw apart from a stale one inherited on first render.
    const isNewThrow = Boolean(throwKey && yutThrowTrackingStarted && yutLastThrowKey !== throwKey);
    if (isNewThrow) {
      const backs = Math.max(0, Math.min(4, Number(g.lastThrow.backs) || 0));
      // Only the count of backs-up sticks is server-confirmed; which specific stick shows which
      // face is purely cosmetic, so shuffle it for visual variety each throw.
      const flags = [true, true, true, true].map((_, i) => i < backs);
      for (let i = flags.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [flags[i], flags[j]] = [flags[j], flags[i]];
      }
      yutLastThrowFlags = flags;
      yutSticks.forEach((el, i) => el.classList.toggle('backdoMark', g.lastThrow.name === '빽도' && flags[i]));
      yutThrowAnimating = true; const thrown = g.lastThrow; diceYutResult.textContent = '…'; // (not told before the sticks fall)
      animateYutThrow(yutSticks, flags, {
        // v1.6.82: also repaint the board so the movable-piece marks appear once the throw settles.
        onDone: () => { yutThrowAnimating = false; renderYut(); if (state?.gameType === 'yut') { drawYutBoard(); yutCall(thrown); } },
      });
    } else if (!yutThrowAnimating) {
      // v1.6.55: the dice/yut panel is now a small always-visible panel above chat instead of a
      // full-board overlay that only ever appeared mid-throw, so it must always show the correct
      // settled pose (not a default/neutral one) even on a render that isn't a fresh throw -- e.g.
      // the very first render after page load/reconnect (isNewThrow is deliberately false there,
      // see the comment above) or any re-render triggered by something unrelated to yut. Reuses the
      // last shuffled flags so the sticks don't visually re-shuffle on every unrelated re-render;
      // only computes a fresh shuffle once, the first time this game has anything to show.
      if (!yutLastThrowFlags) {
        const backs = g.lastThrow ? Math.max(0, Math.min(4, Number(g.lastThrow.backs) || 0)) : 0;
        const flags = [true, true, true, true].map((_, i) => i < backs);
        for (let i = flags.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [flags[i], flags[j]] = [flags[j], flags[i]];
        }
        yutLastThrowFlags = flags;
        yutSticks.forEach((el, i) => el.classList.toggle('backdoMark', g.lastThrow?.name === '빽도' && flags[i]));
      }
      yutSticks.forEach((el, i) => { el.style.transform = `translateY(0) rotateX(0deg) rotateZ(0deg) rotateY(${yutLastThrowFlags[i] ? 180 : 0}deg)`; });
    }
    yutLastThrowKey = throwKey;
    yutThrowTrackingStarted = true;

    // v1.6.57: only look for a new move to animate once the throw above has fully settled -- a move
    // is always the direct result of a throw the player already saw finish (move-choice buttons only
    // ever appear once yutThrowAnimating is false, see below), so gating this whole check on that
    // same flag guarantees "말 이동은 윷 던지기 애니메이션이 끝난 뒤에만" without any extra timers.
    // While the throw is still animating this block is skipped entirely; the throw's own onDone ->
    // renderYut() callback re-runs it once settled, so a move that already happened isn't missed.
    if (!yutThrowAnimating) {
      const lastMove = g.lastMove;
      const moveKey = lastMove ? `${lastMove.at}:${(lastMove.pieceIds || []).join(',')}` : null;
      // Same reconnect-safe pattern as the throw above: yutMoveTrackingStarted (not a null check on
      // the key alone) tells a genuinely new move apart from one inherited on first render/reconnect.
      const isNewMove = Boolean(moveKey && yutMoveTrackingStarted && yutLastMoveKey !== moveKey);
      if (isNewMove) {
        const path = lastMove.destination?.path;
        // A path of length <= 1 (home-entry landing on 0, or a back-do clamped in place) has no
        // actual travel to animate -- the normal instant redraw already shows the right thing.
        if (path && path.length > 1) {
          animateYutPieceMove(lastMove.pieceIds, path, {
            // Re-render once the hop-by-hop travel finishes so move-choice buttons (held back by
            // yutPieceAnimation above) reappear for a bonus throw's own new 'move' phase, if any.
            onDone: () => renderYut(),
          });
        }
      }
      yutLastMoveKey = moveKey;
      yutMoveTrackingStarted = true;
    }

    if (g.status === 'selecting') yutHint.textContent = `${seatKo('black')}과 ${seatKo('white')}이 정해지면 ${seatKo('black')}부터 시작합니다.`;
    else if (g.status === 'finished') yutHint.textContent = `${seatKo(g.winner)}이 말 4개를 모두 완주했습니다.`;
    else if (!seat) yutHint.textContent = `${seatKo(g.turn)}의 진행을 관전하고 있습니다.${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스(빽도로 물릴 말 없음)` : ''}`;
    else if (g.turn !== seat) yutHint.textContent = `${seatKo(g.turn)} 차례입니다.${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스(빽도로 물릴 말 없음)` : ''}`;
    else if (g.phase === 'throw') yutHint.textContent = '내 차례입니다. 윷을 던져 주세요.';
    else if (g.pendingSteps < 0) yutHint.textContent = `${g.lastThrow?.name || ''} · 한 칸 뒤로 물릴 말을 선택하세요.`;
    else yutHint.textContent = `${g.lastThrow?.name || ''} · ${g.pendingSteps || 0}칸 이동할 말을 선택하세요.`;

    // Buttons are rebuilt below without firing pointerleave/blur, so drop a hover link that came
    // from one of them unless the pointer/focus is still on the board or the list itself.
    if (yutHoverTargetKey !== null && !canvas.matches(':hover') && !yutMoveChoices.matches(':hover') && !yutMoveChoices.contains(document.activeElement)) yutHoverTargetKey = null;
    yutMoveChoices.replaceChildren();
    // v1.6.57: hold off on offering move choices until the throw animation (and any still-playing
    // piece-move animation from a prior bonus throw) has fully settled -- otherwise a fast click
    // could select a move before the player has even seen the throw land, which the "던지기가 끝난
    // 후에만 말 이동" requirement rules out. The server already allows the move the instant `phase`
    // flips to 'move'; this only delays the button/choice from *appearing* on screen.
    const moves = mine && g.phase === 'move' && !yutThrowAnimating && !yutPieceAnimation ? yutOfferedMoves(g.legalMoves || []) : [];
    const backward = g.pendingSteps < 0;
    // v1.6.41: distance-focused move-choice text (몇 칸 이동하는지가 핵심 정보) instead of the
    // destination tile number, which meant little without studying the board. The actual move
    // (piece, path, capture/backdo/finish rules) is unchanged -- only this label changed.
    const steps = Math.abs(g.pendingSteps || 0);
    for (const move of moves) {
      const button = document.createElement('button');
      button.type = 'button';
      // v1.6.83: the board itself is now the primary control; these stay as a quieter fallback that
      // shares the exact same request path (and duplicate-send guard) as clicking the piece.
      button.className = 'yutPieceChoice';
      button.disabled = yutMovePending;
      const number = Number(String(move.pieceId).split('-').at(-1));
      const carriedNumbers = (move.carried || [move.pieceId]).map(id => Number(String(id).split('-').at(-1))).sort((a, b) => a - b);
      const pieceLabel = carriedNumbers.length > 1 ? `${carriedNumbers.join('·')}번 말` : `${number}번 말`;
      const moveLabel = backward ? `${steps}칸 뒤로` : `${steps}칸 이동`;
      const statusNote = move.destination?.status === 'finished' ? ' · 완주'
        : move.destination?.position === 'finishLine' ? ' · 완주 직전 칸'
        : '';
      button.textContent = `${pieceLabel} · ${moveLabel}${statusNote}`;
      button.addEventListener('click', () => requestYutMove(move.pieceId));
      const linkBoard = on => {
        const key = on ? yutTargetForPiece(move.pieceId)?.key || null : null;
        if (key === yutHoverTargetKey) return;
        yutHoverTargetKey = key;
        if (state?.gameType === 'yut') drawYutBoard();
      };
      button.addEventListener('pointerenter', () => linkBoard(true));
      button.addEventListener('pointerleave', () => linkBoard(false));
      button.addEventListener('focus', () => linkBoard(true));
      button.addEventListener('blur', () => linkBoard(false));
      yutMoveChoices.appendChild(button);
    }
    if (g.phase === 'move' && !moves.length) {
      const waiting = document.createElement('span');
      waiting.className = 'smallMuted';
      waiting.textContent = mine ? '움직일 말을 확인하는 중입니다.' : `${seatKo(g.turn)}이 말을 고르는 중입니다.`;
      yutMoveChoices.appendChild(waiting);
    }
    // v1.6.84: the throw/hop animation flags are only settled here (and this also runs when either
    // animation finishes), so refresh the current-actor seat from this point too.
    renderCurrentActor();
  }


  let bingoThemeApplied = { panel: null, board: null };
  let bingoPrevLines = { key: null, lines: 0 };
  function renderBingo() {
    const g = state.game;
    const selected = new Set(g.selectedNumbers || []);
    const bingoRecent = observeRecentAction(g.lastSelected
      ? `select:${g.lastSelected.at || ''}:${g.lastSelected.seat}:${g.lastSelected.number}`
      : null);
    const occupied = ['1','2','3','4'].filter(number => state.players[number]);
    const gridSize = Number(g.gridSize) || 5;
    const poolMax = Number(g.poolMax) || 50;
    const configurable = isHost && g.status === 'selecting';
    bingoGridSelect.value = String(gridSize);
    bingoGridSelect.disabled = !configurable;
    bingoPoolSelect.value = String(poolMax);
    bingoPoolSelect.disabled = !configurable;
    // v1.6.66: the win-line target range depends on grid size (5x5 tops out at 12 lines, 7x7 at
    // 16), so the option list is rebuilt only when that ceiling actually changes -- not on every
    // render -- to avoid disturbing an open dropdown.
    const maxLines = gridSize * 2 + 2;
    if (Number(bingoTargetSelect.dataset.maxLines) !== maxLines) {
      bingoTargetSelect.replaceChildren();
      for (let n = 1; n <= maxLines; n += 1) {
        const option = document.createElement('option');
        option.value = String(n);
        option.textContent = `${n}줄`;
        bingoTargetSelect.appendChild(option);
      }
      bingoTargetSelect.dataset.maxLines = String(maxLines);
    }
    bingoTargetSelect.value = String(g.targetLines || 5);
    bingoTargetSelect.disabled = !configurable;
    bingoStartBtn.classList.toggle('hidden', g.status !== 'selecting');
    bingoStartBtn.disabled = !(isHost && occupied.length >= 2 && g.status === 'selecting');
    bingoSelectedNumbers.textContent = (g.selectedNumbers || []).length ? g.selectedNumbers.join(', ') : '없음';
    const summarySeats = g.seatOrder?.length ? g.seatOrder : occupied;
    bingoLineSummary.textContent = summarySeats.length
      ? summarySeats.map(number => `${state.players[number]?.label || number + '번'} ${g.lineCounts?.[number] || 0}줄`).join(' · ')
      : '-';
    if (g.status === 'selecting') bingoStatus.textContent = `승리 조건 ${g.targetLines || 5}줄 · 현재 선수 ${occupied.length}명 · 2명 이상이면 방장이 시작할 수 있습니다.`;
    else if (g.status === 'playing') bingoStatus.textContent = `승리 조건 ${g.targetLines}줄 · 현재 ${seatKo(g.turn)} 차례${g.lastSelected ? ` · 직전 선택 ${g.lastSelected.number}` : ''}`;
    else if (g.status === 'finished') {
      // The natural win (someone completes their target line count) always sets a lone seat;
      // resigning (v1.6.49) credits every other seated player instead, which can be more than
      // one -- normalized the same way here so resign doesn't hand this a shape it can't render.
      const winners = Array.isArray(g.winner) ? g.winner : [g.winner];
      const names = winners.map((w) => state.players[w]?.label || seatKo(w)).join(', ');
      bingoStatus.textContent = winners.length === 1
        ? `${names} 승리 · ${g.lineCounts?.[winners[0]] || 0}줄 완성`
        : `${names} 승리`;
    }

    bingoBoard.style.gridTemplateColumns = `repeat(${gridSize}, minmax(0,1fr))`;
    bingoBoard.classList.toggle('bingoGrid7', gridSize === 7);
    // v1.7.38 skins: the host's room theme paints the panel, board and cells for everyone; a selected number leaves
    // the viewer's own mark on their own board (the board is private), with a short effect and, for the legend, a
    // glitter burst when one more line is completed.
    const SL = window.SkinLooks;
    const themeDef = SL.def(state.skinTheme);
    SL.h.unstyle(bingoPanel, bingoThemeApplied.panel); SL.h.unstyle(bingoBoard, bingoThemeApplied.board);
    bingoThemeApplied = { panel: null, board: null };
    if (themeDef?.panel) {
      bingoThemeApplied.panel = { backgroundImage: SL.h.img(`bingo-panel:${state.skinTheme}`, 720, 520, themeDef.panel), backgroundSize: 'cover' };
      bingoThemeApplied.board = { ...themeDef.boardStyle, backgroundImage: SL.h.img(`bingo-board:${state.skinTheme}`, 480, 480, themeDef.panel), backgroundSize: 'cover' };
      SL.h.style(bingoPanel, bingoThemeApplied.panel); SL.h.style(bingoBoard, bingoThemeApplied.board);
    }
    const myMark = seat ? SL.def(state.players?.[seat]?.skin) : null;
    bingoBoard.replaceChildren();
    const board = state.me?.myBingoBoard;
    if (!Array.isArray(board) || board.length !== gridSize * gridSize) {
      const note = document.createElement('p');
      note.className = 'smallMuted bingoSpectatorNote';
      note.textContent = g.status === 'selecting' ? '자리를 선택하면 게임 시작 후 내 빙고판이 생성됩니다.' : '관전 중입니다. 참가자별 완성 줄 수와 선택 숫자를 확인할 수 있습니다.';
      bingoBoard.appendChild(note);
      return;
    }
    const myTurn = Boolean(seat && g.status === 'playing' && g.turn === seat);
    const bingoActionable = myTurn && actionWindowOpen(g);
    let freshCell = null;
    for (const number of board) {
      const button = document.createElement('button');
      button.type = 'button';
      if (themeDef?.cell) SL.h.style(button, { ...themeDef.cell, boxShadow: 'none' });
      if (selected.has(number) && myMark?.mark) {
        SL.h.style(button, { backgroundColor: themeDef?.cell?.backgroundColor || '#fffdf6', backgroundImage: SL.h.img(`bingo-mark:${state.players[seat].skin}`, 96, 96, myMark.mark), backgroundSize: '88% 88%', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', color: myMark.text.color, textShadow: myMark.text.shadow });
      }
      if (g.lastSelected?.number === number && bingoRecent.fresh) freshCell = button;
      button.className = `bingoCell${selected.has(number) ? ' selected' : ''}${g.lastSelected?.number === number ? recentActionClasses(bingoRecent) : ''}${actionableClasses(bingoActionable && !selected.has(number))}`;
      button.textContent = String(number);
      button.disabled = !myTurn || selected.has(number);
      button.setAttribute('aria-label', `${number}번${selected.has(number) ? ' 선택됨' : ''}`);
      button.addEventListener('click', () => {
        button.disabled = true;
        roomAction('select-bingo', { number, expectedMoveCount: g.moveCount || 0 });
      });
      bingoBoard.appendChild(button);
    }
    if (myMark?.fx && freshCell) requestAnimationFrame(() => SL.h.playFx(freshCell, myMark.fx, 700, 40));
    const lineKey = `${state.me?.roomCode}:${seat}`;
    const lines = Number(g.lineCounts?.[seat] || 0);
    // v1.9.1 legends: a newly completed line plays `special` on that line's cells, my win plays `win` over the board.
    const winners = g.status === 'finished' ? [].concat(g.winner || []) : [];
    const iWon = Boolean(seat && winners.includes(seat));
    if (myMark?.legend && bingoPrevLines.key === lineKey && lines > bingoPrevLines.lines) {
      const cells = [...bingoBoard.querySelectorAll('.bingoCell')];
      const done = (idx) => idx.every((k) => selected.has(board[k]));
      const before = new Set(bingoPrevLines.complete || []);
      const lineSets = bingoLineSets(gridSize).filter((idx) => done(idx) && !before.has(idx.join(',')));
      const fresh = lineSets[0];
      if (fresh && myMark.special && !iWon) requestAnimationFrame(() => {
        const box = bingoBoard.getBoundingClientRect(); const pad = 10;
        const rects = fresh.map((k) => { const r = cells[k].getBoundingClientRect(); return { x: r.left - box.left + pad, y: r.top - box.top + pad, w: r.width, h: r.height }; });
        SL.h.playFx(bingoBoard, (ctx, w, h, t) => myMark.special(ctx, w, h, t, rects), 1500, pad);
      });
    }
    const winKey = iWon ? `${lineKey}:${g.round || 1}:${g.moveCount || 0}` : null;
    if (myMark?.win && winKey && bingoPrevLines.key === lineKey && bingoPrevLines.winKey !== winKey && bingoPrevLines.status === 'playing') requestAnimationFrame(() => SL.h.playFx(bingoBoard, myMark.win, 2200, 10));
    bingoPrevLines = { key: lineKey, lines, winKey, status: g.status, complete: bingoLineSets(gridSize).filter((idx) => idx.every((k) => selected.has(board[k]))).map((idx) => idx.join(',')) };
  }

  // Index lists of every row, column and both diagonals of an n×n bingo board (the board array is row-major).
  function bingoLineSets(n) {
    const lines = [];
    for (let r = 0; r < n; r += 1) lines.push(Array.from({ length: n }, (_, c) => r * n + c));
    for (let c = 0; c < n; c += 1) lines.push(Array.from({ length: n }, (_, r) => r * n + c));
    lines.push(Array.from({ length: n }, (_, i) => i * n + i), Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));
    return lines;
  }

  function renderCityControls() {
    const g = state.game;
    const canActNow = Boolean(seat && g.status === 'playing' && (g.turn === seat || (g.phase === 'liquidate' && g.liquidating === seat)));
    const mine = Boolean(seat && g.turn === seat && g.status === 'playing');
    const turn = Math.max(0, Number(g.turnCount) || 0);
    const limit = Number(g.turnLimit) || 50;
    const name = seatNumber => state.players?.[seatNumber]?.label || `${seatNumber}번`;
    const extraText = g.extraRoll ? (g.phase === 'roll' ? ' · 더블 추가 굴림' : ' · 더블: 칸 처리 후 추가 굴림') : '';
    cityTurnSummary.textContent = `전체 턴 ${turn}/${limit} 완료 · 남은 ${Math.max(0, limit - turn)}턴 · ${g.turn ? name(g.turn) + ' 차례' + extraText : '대국 종료'}`;
    const seatedCount = Object.keys(state.players || {}).filter(k => /^[1-4]$/.test(k) && state.players[k]).length;
    cityStartBtn.classList.toggle('hidden', g.status !== 'selecting');
    cityStartBtn.disabled = !(isHost && g.status === 'selecting' && seatedCount >= 2);
    cityRollBtn.classList.toggle('hidden', g.status === 'selecting');
    cityLiquidateBanner.classList.toggle('hidden', g.phase !== 'liquidate');
    if (g.phase === 'liquidate') {
      const debtAmount = g.pendingDebt?.amount ?? 0;
      const liquidatingCash = g.players?.[g.liquidating]?.cash ?? 0;
      const shortBy = Math.max(0, debtAmount - liquidatingCash);
      cityLiquidateBanner.textContent = g.liquidating === seat
        ? `자산 정리 단계 · ${debtAmount} 중 ${shortBy}이(가) 부족합니다. 아래 "도시 정보·매각 관리"에서 도시나 건물을 매각해 부족한 금액을 채우세요. 충분해지면 자동으로 정산됩니다.`
        : `자산 정리 단계 · ${name(g.liquidating)}님이 ${debtAmount} 중 ${shortBy}이(가) 부족해 자산을 매각하고 있습니다.`;
      // My turn to sell -- open the panel automatically so the required action isn't hidden behind a click.
      if (g.liquidating === seat) cityTileDetailsToggle.open = true;
    }
    cityAssets.replaceChildren();
    for (const color of g.seatOrder || []) {
      const player = g.players?.[color];
      if (!player) continue;
      const bankrupt = Boolean(player.eliminated);
      const card = document.createElement('div');
      card.className = `cityAssetCard seat${color}${g.status === 'playing' && g.turn === color ? ' isTurn' : ''}${bankrupt ? ' bankrupt' : ''}`;
      const heading = document.createElement('strong');
      const dot = document.createElement('span');
      dot.className = 'cityAssetDot';
      heading.appendChild(dot);
      heading.appendChild(document.createTextNode(`${name(color)}${seat === color ? ' · 나' : ''}${g.turn === color && g.status === 'playing' ? ' · 현재 차례' : ''}${bankrupt ? ' · 파산' : ''}`));
      const metrics = document.createElement('div');
      metrics.className = 'cityAssetMetrics';
      const metricEntries = [
        ['현금', player.cash], ['순자산', g.scores?.[color] ?? player.cash],
        ['소유 도시', `${player.properties?.length || 0}개`], ['위치', `${player.position}번`],
      ];
      for (const [metricLabel, metricValue] of metricEntries) {
        const item = document.createElement('span');
        const dt = document.createElement('small');
        dt.textContent = metricLabel;
        item.append(dt, document.createTextNode(String(metricValue)));
        metrics.appendChild(item);
      }
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
    const rollKey = roll ? `${g.round}:${roll.at}:${roll.seat}:${roll.from}:${roll.to}` : null;
    // cityRollTrackingStarted (not "cityLastRollKey !== null") is what tells a genuinely new roll
    // apart from a stale one inherited on first render -- a fresh game's very first roll also goes
    // from "no roll" (cityLastRollKey === null) to a real key, so checking null alone would wrongly
    // skip animating it. Requiring one prior render instead still skips a reconnect that lands on an
    // already-existing roll, while still animating a fresh game's first roll correctly.
    const isNewRoll = Boolean(rollKey && cityRollTrackingStarted && cityLastRollKey !== rollKey);
    if (isNewRoll) {
      cityDiceAnimating = true;
      animateDiceRoll([cityDieFirst, cityDieSecond], [roll.first, roll.second], {
        onDone: () => { cityDiceAnimating = false; },
      });
    } else if (!cityDiceAnimating) {
      cityDieFirst.style.transform = DICE_CUBE_ROTATIONS[roll ? roll.first : 1];
      cityDieSecond.style.transform = DICE_CUBE_ROTATIONS[roll ? roll.second : 1];
    }
    if (isNewRoll) {
      if (cityAnimationFrame !== null) cancelAnimationFrame(cityAnimationFrame);
      cityAnimation = { seat: roll.seat, from: roll.from, position: roll.from, steps: roll.total, started: performance.now() };
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
    cityRollTrackingStarted = true;
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
    const tileBuildCost = tile?.type === 'property' ? Math.floor(tile.price / 2) : 0;
    cityTileBuildCost.textContent = tile?.type === 'property' ? (level < 3 ? `${tileBuildCost}` : '건설 완료') : '-';
    const sellValue = tile?.type === 'property' ? Math.floor(tile.price * 0.5) + Math.floor(tileBuildCost * 0.5) * level : 0;
    cityTileSellValue.textContent = tile?.type === 'property' && owner ? `${sellValue}` : '-';
    const canSellThis = Boolean(tile?.type === 'property' && owner === seat && canActNow);
    cityTileSellRow.classList.toggle('hidden', !(tile?.type === 'property' && owner === seat));
    citySellBuildingBtn.disabled = !(canSellThis && level > 0);
    citySellPropertyBtn.disabled = !canSellThis;
    setActionable(citySellPropertyBtn, canSellThis && g.phase === 'liquidate' && !g.paused);
    setActionable(citySellBuildingBtn, canSellThis && level > 0 && g.phase === 'liquidate' && !g.paused);
    if (tile?.type === 'property' && owner === seat) {
      const myCash = g.players?.[seat]?.cash ?? 0;
      const buildingRefund = level > 0 ? Math.floor(tileBuildCost * 0.5) : 0;
      cityTileSellPreview.textContent = level > 0
        ? `건물 매각 시 현금 ${myCash} → ${myCash + buildingRefund} · 도시 전체 매각 시 ${myCash} → ${myCash + sellValue}`
        : `매각 시 현금 ${myCash} → ${myCash + sellValue}`;
    } else {
      cityTileSellPreview.textContent = '';
    }
    cityRollBtn.disabled = !(mine && g.phase === 'roll');
    setActionable(cityRollBtn, !cityRollBtn.disabled && actionWindowOpen(g), 'primary');
    cityRollBtn.textContent = mine && g.phase === 'roll' ? (g.extraRoll ? '더블 · 추가 굴리기' : '주사위 굴리기') : '굴리기 대기';
    cityLastRoll.textContent = g.lastRoll
      ? `최근 주사위: ${g.lastRoll.first} + ${g.lastRoll.second} = ${g.lastRoll.total}${g.lastRoll.double ? ' · 더블!' : ''}`
      : '아직 주사위를 굴리지 않았습니다';
    const rankingText = Array.isArray(g.ranking) ? ' · 순위 ' + g.ranking.map((s, i) => `${i + 1}위 ${name(s)}`).join(', ') : '';
    // Central, at-a-glance result banner (spec F) -- the fuller narration stays in cityEvent below.
    const resultText = g.status === 'finished' ? `게임 종료 · ${g.winner ? `${name(g.winner)} 승리` : ''}${rankingText}`
      : g.status === 'draw' ? '게임 종료 · 순자산 동률로 무승부입니다.' : '';
    cityResultSummary.textContent = resultText;
    cityResultSummary.classList.toggle('hidden', !resultText);
    cityEvent.textContent = g.status === 'finished' ? `게임이 종료되었습니다 · ${g.winner ? `${name(g.winner)} 승리` : ''}${rankingText}`
      : g.status === 'draw' ? '게임이 종료되었습니다 · 순자산 동률로 무승부입니다.'
      : g.lastEvent || (g.status === 'selecting'
      ? '방장이 랜드킹을 시작하면 1번 참가자부터 진행합니다.'
      : !seat ? `${seatKo(g.turn)}의 차례를 관전하고 있습니다.`
        : g.phase === 'liquidate' ? (g.liquidating === seat ? '현금이 부족합니다. 자산을 정리하세요.' : `${seatKo(g.liquidating)}님이 자산을 정리하고 있습니다.`)
        : g.turn === seat ? (g.phase === 'roll' ? '주사위를 굴리세요.' : '내 차례입니다.') : `${seatKo(g.turn)} 차례입니다.`);
    const myCashNow = g.players?.[seat]?.cash ?? 0;
    const offer = g.pendingProperty === null ? null : g.tiles?.[g.pendingProperty];
    const canBuy = Boolean(offer && mine && g.phase === 'buy');
    cityPropertyOffer.textContent = offer ? `${offer.name} · 매입 ${offer.price} · 통행료 ${offer.toll}${mine ? ` · 매입 시 현금 ${myCashNow} → ${myCashNow - offer.price}` : ''}` : '';
    cityBuyBtn.classList.toggle('hidden', !offer);
    cityBuyBtn.disabled = !canBuy || myCashNow < (offer?.price ?? 0);
    citySkipBtn.classList.toggle('hidden', !offer);
    citySkipBtn.disabled = !canBuy;
    const buildTile = g.phase === 'build' && g.pendingProperty !== null ? g.tiles?.[g.pendingProperty] : null;
    const buildLevel = buildTile ? Math.max(0, Math.min(3, Number(g.developments?.[buildTile.index]) || 0)) : 0;
    const cost = buildTile ? Math.floor(buildTile.price / 2) : 0;
    cityBuildRow.classList.toggle('hidden', !buildTile);
    cityBuildOffer.textContent = buildTile ? `${buildTile.name} · 다음 ${['별장', '빌딩', '호텔'][buildLevel] || '건설 완료'} · 건설비 ${cost} · 건설 후 통행료 ${(buildTile.toll || 0) * [1, 2, 3, 5][Math.min(3, buildLevel + 1)]}${mine ? ` · 건설 시 현금 ${myCashNow} → ${myCashNow - cost}` : ''}` : '';
    cityBuildBtn.disabled = !(buildTile && mine && g.owners?.[buildTile.index] === seat && buildLevel < 3 && myCashNow >= cost);
    cityBuildSkipBtn.disabled = !(buildTile && mine);
    // Buy/build are a choice between two buttons, so the whole offer row is the actionable area.
    setActionable(cityBuyBtn.parentElement, canBuy && actionWindowOpen(g), 'area');
    setActionable(cityBuildRow, Boolean(buildTile && mine) && actionWindowOpen(g), 'area');
  }

  let pictionaryTool = 'pen';
  let pictionaryPrevStatus = null;
  let pictionaryDrawingActive = false;
  let pictionaryCurrentPoints = [];
  let pictionaryHasGuessedRound = null; // `${round}:${seat}` once a correct guess is submitted locally

  function pictionaryFillWhite() {
    pictionaryCtx.save();
    pictionaryCtx.globalCompositeOperation = 'source-over';
    const paper = window.SkinLooks.def(state?.skinTheme)?.paper; // the host's room theme paints the paper (v1.7.39)
    if (paper) pictionaryCtx.drawImage(boardTexture(`pict:${state.skinTheme}`, pictionaryCanvas.width, pictionaryCanvas.height, (c, tw, th) => paper(c, tw, th)), 0, 0);
    else {
      pictionaryCtx.fillStyle = '#fffdf6'; // v1.7.12: sketchbook paper tone
      pictionaryCtx.fillRect(0, 0, pictionaryCanvas.width, pictionaryCanvas.height);
    }
    pictionaryCtx.restore();
  }

  function pictionaryDrawStroke(stroke) {
    if (!stroke.points.length) return;
    // A drawer's tool skin paints every stroke of the round in the colour they picked (the eraser is never skinned).
    const hand = stroke.tool === 'eraser' ? null : window.SkinLooks.def(state?.players?.[state?.game?.drawerSeat]?.skin)?.seg;
    if (hand) {
      const W = pictionaryCanvas.width; const H = pictionaryCanvas.height;
      const pts = stroke.points.map(([x, y]) => [x * W, y * H]);
      pictionaryCtx.save();
      if (pts.length === 1) hand(pictionaryCtx, pts[0][0], pts[0][1], pts[0][0] + 0.01, pts[0][1], stroke.color, stroke.width);
      for (let i = 1; i < pts.length; i += 1) hand(pictionaryCtx, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], stroke.color, stroke.width);
      pictionaryCtx.restore();
      return;
    }
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
    const strokes = state?.game?.strokes || [];
    for (const stroke of strokes) pictionaryDrawStroke(stroke);
    const lastStroke = strokes.at(-1);
    const lastPoint = lastStroke?.points?.at(-1);
    if (lastPoint) {
      const recent = observeRecentAction(`stroke:${strokes.length}`);
      const x = lastPoint[0] * pictionaryCanvas.width;
      const y = lastPoint[1] * pictionaryCanvas.height;
      const pulse = recent.strength || 0;
      pictionaryCtx.save();
      pictionaryCtx.strokeStyle = `rgba(245,158,11,${0.52 + pulse * 0.4})`;
      pictionaryCtx.lineWidth = 2 + pulse * 2.5;
      pictionaryCtx.beginPath();
      pictionaryCtx.arc(x, y, 7 + pulse * 5, 0, Math.PI * 2);
      pictionaryCtx.stroke();
      pictionaryCtx.restore();
      scheduleRecentActionCanvas(recent, redrawPictionaryCanvas);
    }
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

  const PICTIONARY_DIFFICULTY_KO = { easy: '쉬움', normal: '보통', hard: '어려움' };
  function pictionaryName(s) { return state.players[s]?.label || `${s}번`; }
  function pictionaryTeamTag(g, s) { return g.mode === 'team' ? ` · ${Number(s) % 2 ? 'A' : 'B'}팀` : ''; }

  function renderPictionaryConfig(g) {
    const selecting = g.status === 'selecting';
    pictionaryConfig.classList.toggle('hidden', !selecting);
    if (!selecting) return;
    for (const radio of pictionaryConfig.querySelectorAll('[data-pictionary-mode]')) { radio.checked = radio.value === g.mode; radio.disabled = !isHost; }
    for (const radio of pictionaryConfig.querySelectorAll('[data-pictionary-difficulty]')) { radio.checked = radio.value === g.difficulty; radio.disabled = !isHost; }
    for (const radio of pictionaryConfig.querySelectorAll('[data-pictionary-seconds]')) { radio.checked = Number(radio.value) === g.roundSeconds; radio.disabled = !isHost; }
    pictionaryShowCategory.checked = g.showCategory !== false;
    pictionaryShowCategory.disabled = !isHost;
  }

  let pictionaryThemeApplied = null;
  let pictionaryPrevPhase = null;
  function renderPictionary() {
    const g = state.game;
    const isDrawer = Boolean(seat && seat === g.drawerSeat);
    renderPictionaryConfig(g);
    pictionaryStartBtn.classList.toggle('hidden', !(isHost && g.status === 'selecting'));
    pictionaryStartBtn.disabled = g.status !== 'selecting';
    const settings = `${g.mode === 'team' ? '팀전' : '개인전'} · ${PICTIONARY_DIFFICULTY_KO[g.difficulty] || '보통'} · ${g.roundSeconds || 90}초`;
    pictionaryDrawerLabel.textContent = g.status === 'selecting'
      ? `${settings} · 참가자가 모이면 방장이 시작합니다`
      : g.status === 'finished'
        ? (Array.isArray(g.winner) && g.winner.length
          ? (g.mode === 'team' && g.teamTotals
            ? `최종 · A팀 ${g.teamTotals.A}점 : B팀 ${g.teamTotals.B}점 · ${g.teamTotals.A === g.teamTotals.B ? '공동 승리' : `${g.teamTotals.A > g.teamTotals.B ? 'A' : 'B'}팀 승리`}`
            : `최종 승리: ${g.winner.map(pictionaryName).join(', ')}`)
          : '그림 맞히기 종료')
        : g.phase === 'reveal'
          ? `${g.roundNumber}/${g.totalRounds}라운드 결과`
          : `${g.roundNumber}/${g.totalRounds}라운드 · ${isDrawer ? '내가 그리는 중' : `${pictionaryName(g.drawerSeat)}${pictionaryTeamTag(g, g.drawerSeat)} 님이 그리는 중`}`;
    const timerEndsAt = g.phase === 'drawing' ? g.roundEndsAt : g.phase === 'reveal' ? g.revealEndsAt : null;
    const pictionaryTimerDuplicated = g.phase === 'drawing' && !g.firstCorrectAt && desktopActionTimerOwns('pictionary');
    pictionaryTimer.classList.toggle('hidden', !timerEndsAt || pictionaryTimerDuplicated);
    pictionaryTimer.classList.toggle('overtime', Boolean(g.phase === 'drawing' && g.firstCorrectAt));
    if (timerEndsAt && !pictionaryTimerDuplicated) {
      pictionaryTimer.textContent = g.phase === 'reveal' ? `다음 라운드 · ${pictionaryCountdownText(timerEndsAt)}`
        : g.firstCorrectAt ? `추가 정답시간 ${pictionaryCountdownText(timerEndsAt)}` : pictionaryCountdownText(timerEndsAt);
    }

    // Category and hints are public; the word itself stays with the drawer until the round ends.
    const hintParts = [];
    if (g.phase === 'drawing') {
      if (g.category) hintParts.push(['카테고리', g.category]);
      if (g.hints?.length) hintParts.push(['글자 수', `${g.hints.length}글자`]);
      if (g.hints?.choseong) hintParts.push(['초성', g.hints.choseong]);
    }
    pictionaryHints.replaceChildren(...hintParts.map(([label, value]) => {
      const chip = document.createElement('span');
      chip.className = 'pictionaryHintChip';
      const small = document.createElement('small');
      small.textContent = label;
      const strong = document.createElement('strong');
      strong.textContent = value;
      chip.append(small, strong);
      return chip;
    }));
    pictionaryHints.classList.toggle('hidden', !hintParts.length);

    pictionaryWordBox.classList.toggle('hidden', !(isDrawer && g.phase === 'drawing' && state.me?.myWord));
    if (state.me?.myWord) pictionaryWord.textContent = state.me.myWord;

    if (g.phase === 'reveal' && g.lastRound) {
      const r = g.lastRound;
      const lines = [`정답 「${r.word}」${r.category ? ` · ${r.category}` : ''}`];
      lines.push(r.awards?.length
        ? r.awards.map((a, i) => `${i + 1}. ${pictionaryName(a.seat)} +${a.points}${a.first ? ' (첫 정답)' : ''}${a.crossTeam ? ' (상대 팀)' : ''}`).join('  ')
        : '아무도 맞히지 못했습니다');
      lines.push(`출제자 ${pictionaryName(r.drawerSeat)} +${r.drawerBonus || 0}`);
      if (r.teamTotals) lines.push(`누적 A팀 ${r.teamTotals.A} : B팀 ${r.teamTotals.B}`);
      pictionaryRoundResult.replaceChildren(...lines.map((text, i) => {
        const line = document.createElement(i === 0 ? 'strong' : 'span');
        line.textContent = text;
        return line;
      }));
      pictionaryRoundResult.classList.remove('hidden');
    } else {
      pictionaryRoundResult.classList.add('hidden');
    }

    const canDraw = pictionaryCanDraw();
    // v1.7.39 skins: the host's theme frames the paper for everyone; my own tool skin gives my cursor; a legend
    // tool adds a short celebration when the round reveals a correct answer.
    const SLP = window.SkinLooks; const wrap = pictionaryCanvas.parentElement;
    SLP.h.unstyle(wrap, pictionaryThemeApplied);
    pictionaryThemeApplied = null;
    const themeP = SLP.def(state.skinTheme);
    if (themeP?.paper) {
      pictionaryThemeApplied = { ...themeP.frame.css, backgroundImage: SLP.h.img(`pict-wrap:${state.skinTheme}`, 720, 480, themeP.paper), backgroundSize: 'cover' };
      SLP.h.style(wrap, pictionaryThemeApplied);
    }
    const myTool = seat ? SLP.def(state.players?.[seat]?.skin) : null;
    pictionaryCanvas.style.cursor = canDraw && myTool?.cursor ? `${SLP.h.img(`pict-cursor:${state.players[seat].skin}`, 32, 32, (c, w) => myTool.cursor(c, w))} 4 28, crosshair` : '';
    // v1.9.1: a found answer plays the drawer's legend `special` (older skins: `win`); the end of the game plays the
    // `win` of a final winner who has a legend tool.
    if (g.phase === 'reveal' && pictionaryPrevPhase === 'drawing' && g.lastRound?.awards?.length) {
      const winTool = SLP.def(state.players?.[g.drawerSeat]?.skin);
      const roundFx = winTool?.legend ? winTool.special : winTool?.win;
      if (roundFx) requestAnimationFrame(() => SLP.h.playFx(wrap, roundFx, 1800, 10));
    }
    if (g.status === 'finished' && pictionaryPrevStatus === 'playing') {
      const finalTool = [].concat(g.winner || []).map((s) => SLP.def(state.players?.[s]?.skin)).find((d) => d?.legend && d.win);
      if (finalTool) requestAnimationFrame(() => SLP.h.playFx(wrap, finalTool.win, 2400, 10));
    }
    pictionaryPrevPhase = g.phase;
    pictionaryPrevStatus = g.status;
    setActionable(pictionaryCanvas.parentElement, canDraw && !g.paused, 'area');
    pictionaryDrawTools.classList.toggle('hidden', !canDraw);
    pictionaryRuleNote.classList.toggle('hidden', !canDraw);
    pictionaryUndoBtn.disabled = !(g.strokes || []).length;
    pictionaryCanvas.classList.toggle('drawable', canDraw);

    const alreadyGuessed = (g.correctGuessers || []).includes(seat);
    const canGuess = Boolean(seat && !isDrawer && g.status === 'playing' && g.phase === 'drawing' && !alreadyGuessed);
    pictionaryGuessForm.classList.toggle('hidden', !canGuess);
    pictionaryGuessInput.disabled = !canGuess;
    setActionable(pictionaryGuessInput, canGuess && !g.paused);

    // Wrong guesses stay short and newest-first; correct answers only mark who got it, never the word.
    const log = g.phase === 'drawing' ? [...(g.guessLog || [])].reverse().slice(0, 8) : [];
    pictionaryGuessLog.replaceChildren(...log.map(entry => {
      const item = document.createElement('li');
      item.textContent = `${pictionaryName(entry.seat)}: ${entry.text}`;
      return item;
    }));
    pictionaryGuessLog.classList.toggle('hidden', !log.length);

    pictionaryScoreboard.replaceChildren();
    const seats = g.seatOrder.length ? g.seatOrder : numberedSeats().filter(n => state.players[n]);
    if (g.mode === 'team' && g.teamTotals) {
      const totals = document.createElement('div');
      totals.className = 'pictionaryScoreRow pictionaryTeamTotals';
      const a = document.createElement('span'); a.textContent = `A팀 ${g.teamTotals.A}점`;
      const b = document.createElement('strong'); b.textContent = `B팀 ${g.teamTotals.B}점`;
      totals.append(a, b);
      pictionaryScoreboard.appendChild(totals);
    }
    const ranked = [...seats].sort((a, b) => (g.scores?.[b] || 0) - (g.scores?.[a] || 0));
    const awards = Object.fromEntries((g.roundAwards || []).map(a => [a.seat, a]));
    for (const s of ranked) {
      const row = document.createElement('div');
      const drawing = s === g.drawerSeat && g.status === 'playing';
      row.className = `pictionaryScoreRow${drawing ? ' isDrawer' : ''}${s === seat ? ' isMe' : ''}${awards[s] ? ' isCorrect' : ''}`;
      const name = document.createElement('span');
      name.textContent = `${pictionaryName(s)}${pictionaryTeamTag(g, s)}${drawing ? ' · 그리는 중' : awards[s] ? ` · 정답 +${awards[s].points}` : ''}`;
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

  let liarThemeApplied = null;
  let liarPlayedResult = null;
  let liarPrevHadResult = null;
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
    const liarTimerDuplicated = desktopActionTimerOwns('liar');
    liarTimer.classList.toggle('hidden', !g.deadlineAt || liarTimerDuplicated);
    if (g.deadlineAt && !liarTimerDuplicated) liarTimer.textContent = liarCountdownText(g.deadlineAt);

    // v1.7.40 skins: the host's theme paints the panel; each hint bubble uses its speaker's skin; a new hint flashes.
    const SLL = window.SkinLooks;
    SLL.h.unstyle(liarPanel, liarThemeApplied);
    liarThemeApplied = null;
    const themeL = SLL.def(state.skinTheme);
    if (themeL?.panel) { liarThemeApplied = { backgroundImage: SLL.h.img(`liar-panel:${state.skinTheme}`, 720, 520, themeL.panel), backgroundSize: 'cover', ...themeL.frame }; SLL.h.style(liarPanel, liarThemeApplied); }
    liarHintLog.replaceChildren();
    const liarHints = g.hints || [];
    const latestHint = liarHints.at(-1);
    const liarRecent = observeRecentAction(g.lastResult
      ? `result:${g.round}:${g.lastResult.reason || g.lastResult.winningSide || ''}`
      : latestHint ? `hint:${liarHints.length}:${latestHint.stage}:${latestHint.seat}:${latestHint.text}` : null);
    for (const [hintIndex, hint] of liarHints.entries()) {
      const row = document.createElement('div');
      row.className = `liarHintRow${hint.timedOut ? ' timedOut' : ''}${!g.lastResult && hintIndex === liarHints.length - 1 ? recentActionClasses(liarRecent) : ''}`;
      const hintSkin = SLL.def(state.players?.[hint.seat]?.skin);
      if (hintSkin?.row) SLL.h.style(row, hintSkin.row);
      const who = document.createElement('strong');
      if (hintSkin?.who) SLL.h.style(who, hintSkin.who);
      const stage = hint.stage === 'hint1' ? '1차' : hint.stage === 'hint2' ? '2차' : '추가';
      who.textContent = `${stage} · ${state.players[hint.seat]?.label || hint.seat + '번'}`;
      const text = document.createElement('span');
      text.textContent = hint.text;
      row.append(who, text);
      liarHintLog.appendChild(row);
      if (hintIndex === liarHints.length - 1 && !g.lastResult && liarRecent.fresh && hintSkin?.fx) requestAnimationFrame(() => SLL.h.playFx(row, hintSkin.fx, 700, 40));
    }
    if (!(g.hints || []).length) {
      const empty = document.createElement('p'); empty.className = 'smallMuted'; empty.textContent = '아직 공개된 힌트가 없습니다.'; liarHintLog.appendChild(empty);
    }

    const hintPhase = ['hint1','hint2','extraHint'].includes(g.phase);
    const canHint = Boolean(seat && g.status === 'playing' && hintPhase && g.currentSpeaker === seat);
    liarHintForm.classList.toggle('hidden', !canHint);
    liarHintInput.disabled = !canHint;
    setActionable(liarHintInput, canHint && !g.paused);

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
        button.type = 'button'; button.className = 'ghost liarVoteBtn' + actionableClasses(actionWindowOpen(g));
        button.textContent = state.players[target]?.label || `${target}번`;
        button.addEventListener('click', () => roomAction('liar-vote', { target, expectedPhaseId: g.phaseId }));
        liarVoteBox.appendChild(button);
      }
    }

    liarGuessForm.classList.toggle('hidden', !g.canGuess);
    liarGuessInput.disabled = !g.canGuess;
    setActionable(liarGuessInput, Boolean(g.canGuess && seat) && !g.paused);

    const result = g.lastResult;
    // A resign ends the game mid-round, before liar.js ever computes lastResult (no vote or reveal
    // happened) -- so this box would otherwise just stay empty with no explanation.
    const resignedFinish = g.status === 'finished' && g.endReason === 'resign' && !result;
    liarResult.classList.toggle('hidden', !result && !resignedFinish);
    liarResult.classList.remove('recentActionTarget', 'recentActionFresh');
    if (result) liarResult.className += recentActionClasses(liarRecent);
    liarResult.replaceChildren();
    if (resignedFinish) {
      const title = document.createElement('strong');
      title.textContent = '게임 종료 · 기권';
      const detail = document.createElement('p');
      detail.textContent = `최종 승자: ${(Array.isArray(g.winner) ? g.winner : [g.winner]).map((s) => state.players[s]?.label || s + '번').join(', ')}`;
      liarResult.append(title, detail);
    } else if (result) {
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

    const liarKey = result ? `${state.me?.roomCode}:${g.round}:${result.roundNumber ?? g.roundNumber}` : null;
    const liarSkin = result ? SLL.def(state.players?.[result.liarSeat]?.skin) : null;
    // v1.9.2: the reveal plays the liar's legend `special` (older skins: `win`); the end of the game the `win` of a final
    // winner with a legend (after the reveal).
    const liarRevealFx = liarSkin?.legend ? liarSkin.special : liarSkin?.win;
    const liarFresh = liarKey && liarKey !== liarPlayedResult && liarPrevHadResult === false;
    if (liarFresh && liarRevealFx) requestAnimationFrame(() => SLL.h.playFx(liarPanel, liarRevealFx, 1800, 10));
    if (liarFresh && g.status === 'finished') {
      const finalSkin = [].concat(g.winner || []).map((s) => SLL.def(state.players?.[s]?.skin)).find((d) => d?.legend && d.win);
      if (finalSkin) setTimeout(() => SLL.h.playFx(liarPanel, finalSkin.win, 2400, 10), liarRevealFx ? 1800 : 0);
    }
    if (liarKey) liarPlayedResult = liarKey;
    liarPrevHadResult = Boolean(result);
    liarScoreboard.replaceChildren();
    const seats = g.players?.length ? g.players : occupied;
    for (const s of [...seats].sort((a,b) => (g.scores?.[b] || 0) - (g.scores?.[a] || 0))) {
      const row = document.createElement('div'); row.className = `liarScoreRow${s === seat ? ' isMe' : ''}`;
      const name = document.createElement('span'); name.textContent = state.players[s]?.label || `${s}번`;
      const score = document.createElement('strong'); score.textContent = `${g.scores?.[s] || 0}점`;
      row.append(name, score); liarScoreboard.appendChild(row);
    }
  }

  // Rotates the seat list so that `anchorSeat` (my own seat, or the fixed spectator anchor)
  // always comes first in the grid.
  function oldmaidRotatedSeats(order, anchorSeat) {
    if (!order?.length) return [];
    const anchorIndex = anchorSeat && order.includes(anchorSeat) ? order.indexOf(anchorSeat) : 0;
    return order.slice(anchorIndex).concat(order.slice(0, anchorIndex));
  }

  // v1.6.52: factored out of renderOldMaid() so oldmaidDrawCard() can also use it to briefly show
  // an intermediate hand (the drawn card added, before any pair is removed) for the draw-flight
  // and pair-glow animation to land in and play out against -- see oldmaidDrawCard below. Each
  // face gets data-cardId so oldmaidGlowAndRemovePair() can find the exact DOM elements to animate.
  function oldmaidRenderMyHandFaces(hand) {
    oldmaidMyHand.replaceChildren();
    oldmaidMyHand.style.setProperty('--n', String(Math.max(1, hand.length))); // (도둑잡기 검토: one row, overlapped to fit -- styles.css)
    for (const card of hand) {
      const red = card.suit === '♥' || card.suit === '♦';
      const face = document.createElement('span');
      face.className = 'oldmaidCard oldmaidFace' + (card.rank === 'JOKER' ? ' joker' : red ? ' red' : '');
      fillOldmaidFace(face, card);
      face.setAttribute('aria-label', card.rank === 'JOKER' ? '조커' : `${card.suit} ${card.rank}`);
      face.dataset.cardId = card.id;
      oldmaidMyHand.appendChild(face);
    }
  }

  let oldmaidThemeApplied = null;
  let oldmaidTrayApplied = null;
  let oldmaidPrevStatus = null;
  function renderOldMaid() {
    const g = state.game;
    const rosterSeats = g.seatOrder?.length ? g.seatOrder : numberedSeats().filter(number => state.players[number]);
    const active = rosterSeats.length;
    oldmaidStartBtn.classList.toggle('hidden', g.status !== 'selecting');
    oldmaidStartBtn.disabled = !(isHost && active >= 2 && g.status === 'selecting');
    oldmaidShuffleBtn.disabled = !(seat && g.status === 'playing' && (g.counts?.[seat] || 0) > 0);
    const label = number => state.players[number]?.label || `${number}번`;
    // A resign never sets g.loser (there's no joker holder to blame -- someone just quit), so it
    // gets its own text here rather than falling into the "조커를 보유했습니다" wording below.
    const resigned = g.status === 'finished' && g.endReason === 'resign';
    const oldmaidWinnerNames = () => (Array.isArray(g.winner) ? g.winner : [g.winner]).map(label).join(', ');
    oldmaidStatus.textContent = g.status === 'selecting'
      ? `참가자 ${active}명 · 2~4명이 자리를 선택하면 방장이 시작합니다.`
      : g.status === 'finished' ? (resigned ? `종료 · 기권으로 종료 · 승자: ${oldmaidWinnerNames()}` : `종료 · ${label(g.loser)}님이 조커를 보유했습니다.`)
      : g.turn === seat ? `내 차례! ${label(g.target)}님의 카드 한 장을 뽑으세요.`
      : `${label(g.turn)}님 차례 · ${label(g.target)}님의 카드를 뽑는 중`;
    oldmaidResult.classList.toggle('hidden', g.status !== 'finished');
    oldmaidResult.textContent = g.status === 'finished'
      ? (resigned ? `🏳️ 기권으로 종료 · 승자: ${oldmaidWinnerNames()}` : `🃏 ${label(g.loser)}님 패배 · 나머지 참가자 승리`) : '';
    oldmaidPanel.classList.toggle('effectsOff', !oldmaidEffectsActive());
    oldmaidEffectsToggle.checked = oldmaidEffectsOn;

    // A fresh deal reuses the same seats, so effect history (who has already been shown
    // escaping, whether the finish flourish already played) resets per round.
    if (oldmaidKnownRound !== g.round) {
      oldmaidKnownRound = g.round;
      oldmaidSeenEscaped = new Set();
      oldmaidSeenFinishedKey = null;
      oldmaidLastMoves = 0;
      oldmaidPeekArmed = false;
    }

    oldmaidModeChooser.classList.toggle('hidden', g.status !== 'selecting');
    for (const radio of oldmaidModeRadios) {
      radio.checked = radio.value === (g.mode || 'normal');
      radio.disabled = !isHost;
    }
    const ability = state.me?.myOldMaidAbility;
    const showAbility = g.mode === 'special' && g.status === 'playing' && Boolean(seat) && Boolean(ability);
    oldmaidAbilityBar.classList.toggle('hidden', !showAbility);
    if (showAbility) {
      const ABILITY_KO = { peek: '엿보기', redirect: '방향 전환', shield: '방어막', detect: '조커 탐지' };
      const ABILITY_DESC = {
        peek: '내 차례에 뽑기 전, 지금 뽑을 대상의 카드 한 장을 나에게만 공개합니다.',
        redirect: '이번 차례만 뽑기 대상을 반대쪽 참가자로 바꿉니다. 2인전에서는 사용할 수 없습니다.',
        shield: '지금 발동해두면, 다음번 누군가 내 카드를 뽑을 때 그 사람이 고른 카드 대신 서버가 무작위로 한 장을 뽑습니다.',
        detect: '내 차례에 뽑기 대상이 조커를 갖고 있는지(위치는 제외) 나에게만 공개합니다.',
      };
      oldmaidAbilityDesc.textContent = ABILITY_DESC[ability.type] || '';
      const myTurnNow = g.turn === seat;
      const needsTurn = ability.type !== 'shield';
      const tooFewForRedirect = ability.type === 'redirect' && active < 3;
      const canUse = !ability.used && !tooFewForRedirect && (!needsTurn || myTurnNow);
      // The label's status word always matches the button right below it -- never claims
      // "사용 가능" while the button is actually disabled for some other reason.
      oldmaidAbilityLabel.textContent = `내 능력: ${ABILITY_KO[ability.type] || ability.type}${ability.used ? ' · 사용 완료' : canUse ? ' · 사용 가능' : ' · 지금은 사용 불가'}`;
      oldmaidAbilityUseBtn.disabled = !canUse;
      oldmaidAbilityUseBtn.textContent = ability.type === 'peek' ? (oldmaidPeekArmed ? '대상 카드를 선택하세요' : '카드 엿보기')
        : ability.type === 'redirect' ? '방향 전환'
        : ability.type === 'shield' ? (ability.shieldArmed ? '방어막 발동 중' : '방어막 사용')
        : ability.type === 'detect' ? '조커 탐지' : '능력 사용';
      // When the button is disabled, say exactly why instead of leaving the player to guess.
      const hintText = ability.used ? '이미 사용한 능력입니다.'
        : tooFewForRedirect ? '2인전에서는 방향 전환을 사용할 수 없습니다.'
        : needsTurn && !myTurnNow ? '내 차례가 되면 사용할 수 있습니다.'
        : ability.type === 'shield' && ability.shieldArmed ? '방어막이 발동 중입니다. 다음번 카드를 뽑히면 자동으로 소모됩니다.'
        : '';
      oldmaidAbilityHint.textContent = hintText;
      oldmaidAbilityHint.classList.toggle('hidden', !hintText);
      oldmaidAbilityReveal.classList.toggle('hidden', !ability.reveal);
      if (ability.reveal?.type === 'peek') {
        const c = ability.reveal.card;
        oldmaidAbilityReveal.textContent = `🔒 나에게만 보임 · 엿본 카드(${label(ability.reveal.targetSeat)}): ${c.rank === 'JOKER' ? '🃏 조커' : `${c.suit} ${c.rank}`}`;
      } else if (ability.reveal?.type === 'detect') {
        oldmaidAbilityReveal.textContent = `🔒 나에게만 보임 · ${label(ability.reveal.targetSeat)}님의 조커 보유: ${ability.reveal.hasJoker ? '있음' : '없음'}`;
      }
    } else {
      oldmaidPeekArmed = false;
    }

    // v1.6.54: max 4 players now, arranged on a fixed compass cross (동/북/서 for opponents) instead
    // of a wrapping grid -- "나"(me) is represented by the existing "내 손패" dock below, not a
    // seat bubble here, so this loop only ever renders opponents. Compass slots fill in a fixed
    // priority (북 first, so a lone opponent in a 2인전 sits "across the table" from me; 동, then
    // 서) rather than by seat number, so the layout reads the same regardless of which numbers were
    // picked.
    const latestOldMaidDraw = (g.history || []).at(-1);
    const oldmaidRecent = observeRecentAction(latestOldMaidDraw
      ? `draw:${g.moveCount}:${latestOldMaidDraw.actor}:${latestOldMaidDraw.target}:${latestOldMaidDraw.pairs}`
      : null);
    const iAmSeated = Boolean(seat && rosterSeats.includes(seat));
    const rotated = oldmaidRotatedSeats(rosterSeats, iAmSeated ? seat : null);
    const opponents = iAmSeated ? rotated.slice(1) : rotated;
    const COMPASS_ORDER = ['north', 'east', 'west'];
    // v1.7.41 skins: the host's theme paints the panel; a seat shows its owner's card backs; my own tray uses my skin.
    const SLO = window.SkinLooks;
    SLO.h.unstyle(oldmaidPanel, oldmaidThemeApplied);
    oldmaidThemeApplied = null;
    const themeO = SLO.def(state.skinTheme);
    if (themeO?.panel) { oldmaidThemeApplied = { backgroundImage: SLO.h.img(`om-panel:${state.skinTheme}`, 720, 520, themeO.panel), backgroundSize: 'cover', ...themeO.frame }; SLO.h.style(oldmaidPanel, oldmaidThemeApplied); }
    const myTray = seat ? SLO.def(state.players?.[seat]?.skin) : null;
    SLO.h.unstyle(oldmaidMyHand, oldmaidTrayApplied);
    oldmaidTrayApplied = myTray?.tray || null;
    if (oldmaidTrayApplied) SLO.h.style(oldmaidMyHand, oldmaidTrayApplied);
    oldmaidSeatsEl.replaceChildren();
    opponents.forEach((number, index) => {
      const count = g.counts?.[number] ?? 0;
      const isLoser = g.status === 'finished' && number === g.loser;
      const escaped = g.status !== 'selecting' && count === 0 && !isLoser;

      const seatEl = document.createElement('div');
      seatEl.className = 'oldmaidSeat'
        + (g.turn === number ? ' turn' : '') + (g.target === number ? ' target' : '')
        + (escaped ? ' escaped' : '') + (isLoser ? ' finalGlow' : '')
        + (latestOldMaidDraw?.target === number ? recentActionClasses(oldmaidRecent) : '')
        + (latestOldMaidDraw?.actor === number ? recentActionClasses(oldmaidRecent, 'actor') : '');
      seatEl.dataset.seat = number;
      seatEl.dataset.compass = COMPASS_ORDER[index] || 'north';
      const seatSkin = SLO.def(state.players?.[number]?.skin);
      if (seatSkin?.seat) SLO.h.style(seatEl, seatSkin.seat);

      const info = document.createElement('div');
      info.className = 'oldmaidSeatInfo';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = label(number);
      info.appendChild(oldmaidFace(number)); // (G-게임별: the seat's tag the name plate, with the island face)
      info.appendChild(nameSpan);
      if (g.status !== 'selecting') {
        const countSpan = document.createElement('span');
        countSpan.textContent = `${count}장`;
        info.appendChild(countSpan);
      }
      if (isLoser) {
        const badge = document.createElement('span');
        badge.className = 'oldmaidSeatBadge loser';
        badge.textContent = '패배';
        info.appendChild(badge);
      } else if (escaped) {
        const badge = document.createElement('span');
        badge.className = 'oldmaidSeatBadge';
        badge.textContent = '탈출 성공';
        info.appendChild(badge);
      }
      seatEl.appendChild(info);
      // (G-게임별: what to do, over the hand to draw from -- outside the card-drawing block, which writes no text at all)
      if (count > 0 && seat && g.status === 'playing' && g.turn === seat && g.target === number && !g.paused) seatEl.appendChild(Object.assign(document.createElement('small'), { className: 'oldmaidHint', textContent: '한 장을 눌러 뽑아요' }));

      {
        if (count > 0) {
          const cards = document.createElement('div');
          cards.className = 'oldmaidSeatCards';
          cards.style.setProperty('--n', String(count)); // (G-게임별: the hand held as a fan)
          const canDraw = Boolean(seat && g.status === 'playing' && g.turn === seat && g.target === number);
          for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'oldmaidCard oldmaidBack' + (canDraw ? ' selectable' : '');
            button.style.setProperty('--i', String(cardIndex));
            if (seatSkin?.back) SLO.h.style(button, seatSkin.back);
            if (canDraw && !g.paused) button.classList.add('actionableTarget');
            button.disabled = !canDraw;
            button.setAttribute('aria-label', `${label(number)}님의 ${cardIndex + 1}번째 카드 뽑기`);
            button.addEventListener('click', () => {
              if (oldmaidPeekArmed && canDraw) {
                oldmaidPeekArmed = false;
                oldmaidUsePeek(cardIndex);
              } else {
                oldmaidDrawCard(number, cardIndex, button);
              }
            });
            cards.appendChild(button);
          }
          seatEl.appendChild(cards);
        } else if (g.status !== 'selecting') {
          const empty = document.createElement('div');
          empty.className = 'oldmaidSeatEmpty';
          empty.textContent = isLoser ? '조커 보유 중' : '카드 없음';
          seatEl.appendChild(empty);
        }
      }
      oldmaidSeatsEl.appendChild(seatEl);
    });

    oldmaidMyHand.classList.remove('recentActionTarget', 'recentActionActor', 'recentActionFresh');
    if (seat && latestOldMaidDraw?.target === seat) oldmaidMyHand.className += recentActionClasses(oldmaidRecent);
    else if (seat && latestOldMaidDraw?.actor === seat) oldmaidMyHand.className += recentActionClasses(oldmaidRecent, 'actor');
    if (seat && Array.isArray(state.me?.myOldMaidHand)) {
      oldmaidRenderMyHandFaces(state.me.myOldMaidHand);
    } else {
      oldmaidMyHand.replaceChildren();
      oldmaidMyHand.textContent = seat ? '게임 시작 후 내 카드가 표시됩니다.' : '관전자는 다른 참가자의 카드 내용을 볼 수 없습니다.';
    }
    if (seat && g.status === 'playing' && !state.me.myOldMaidHand?.length) oldmaidMyHand.textContent = '카드를 모두 버렸습니다!';

    oldmaidHistory.replaceChildren();
    for (const item of (g.history || []).slice(-12).reverse()) {
      const line = document.createElement('p');
      line.textContent = `${label(item.actor)}님이 ${label(item.target)}님의 카드 1장을 뽑았습니다.${item.pairs ? ` · ${item.pairs}쌍 버림` : ''}${item.emptied ? ` · ${label(item.emptied)}님 카드 소진` : ''}`;
      oldmaidHistory.appendChild(line);
    }
    if (!g.history?.length) oldmaidHistory.textContent = '아직 카드를 뽑지 않았습니다.';

    oldmaidRunEffects(g);
    // G-게임별 도둑잡기: my hand's heading with my face; the last stand (two hands left, three cards or fewer -- the joker is
    // among them) the table pulses; the turn's ring back on its name plate after the seats were redrawn
    const myHead = oldmaidPanel.querySelector('.oldmaidMyHeader h3'); myHead.querySelector('.seatFace')?.remove(); if (seat && rosterSeats.includes(seat)) myHead.prepend(oldmaidFace(seat));
    const holding = rosterSeats.filter((s) => (g.counts?.[s] ?? 0) > 0);
    oldmaidPanel.classList.toggle('lastStand', g.status === 'playing' && holding.length === 2 && holding.reduce((n, s) => n + g.counts[s], 0) <= 3);
    renderTurnRing();
    // (도둑잡기 검토: a board note or a toast over the other's fan hid the card to draw -- below the seats, above my hand)
    placeOldmaidNotes(); requestAnimationFrame(placeOldmaidNotes); // (and once the rest of the room is drawn)
  }
  // (CI 흔들림 뿌리: measured in the next frame the note stood a frame where the last stand had moved the seats -- now at once,
  // and again whenever the seats change size later: a font come in, the fan settled)
  const oldmaidNoteWatch = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!oldmaidPanel.classList.contains('hidden')) placeOldmaidNotes(); }) : null;
  oldmaidNoteWatch?.observe(oldmaidSeatsEl);
  function placeOldmaidNotes() {
    // (the seats themselves -- their grid has an empty row below -- and 「조커는 누구에게?」 under them in the last stand)
    const bottoms = [...oldmaidSeatsEl.querySelectorAll('.oldmaidSeat')].map((el) => el.getBoundingClientRect().bottom).filter((b) => b > 0);
    // (a box round the note -- a transform, a backdrop filter -- makes its `fixed` that box's: where a fixed top:0 lands
    // beside it is measured, so the top given is the screen's)
    const originOf = (el) => { if (!el?.parentElement) return 0; const p = document.createElement('i'); p.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden'; el.parentElement.append(p); const o = p.getBoundingClientRect().top; p.remove(); return o; };
    if (!bottoms.length) return; const y = Math.max(...bottoms) + (oldmaidPanel.classList.contains('lastStand') ? 44 : 10);
    document.body.style.setProperty('--oldmaidNoteTop', `${Math.round(y - originOf(document.querySelector('.boardNote')))}px`);
    document.body.style.setProperty('--oldmaidToastTop', `${Math.round(y - originOf(document.getElementById('toast')))}px`);
  }
  function oldmaidFace(number) {
    const f = document.createElement('span'); f.className = 'seatFace'; f.setAttribute('aria-hidden', 'true');
    const look = state.players?.[number]?.face; if (look?.skin) f.style.setProperty('--skin', look.skin); if (look?.hair) f.style.setProperty('--hair', look.hair);
    return f;
  }

  // One-shot decorative flourishes, all derived from state the server already confirmed
  // (history entries, counts, status/loser) -- never a source of truth, and always safe to
  // skip if effects are off or the relevant seat element isn't on screen.
  function oldmaidRunEffects(g) {
    const history = g.history || []; const moves = Number(g.moveCount) || 0; const fresh = moves > oldmaidLastMoves ? history.slice(-(moves - oldmaidLastMoves)) : [];
    if (moves - oldmaidLastMoves === 1 && history.at(-1)?.pairs > 0) window.RoomSound?.play('right'); // (G-게임별: a pair thrown -- 딩동; one new draw only, not a reload's whole history)
    if (!oldmaidEffectsActive()) {
      oldmaidLastMoves = moves;
      for (const number of g.seatOrder || []) if ((g.counts?.[number] ?? 1) === 0) oldmaidSeenEscaped.add(number);
      if (g.status === 'finished') oldmaidSeenFinishedKey = `${g.round}:${g.loser}`;
      return;
    }
    // v1.9.2 skins: a drawer's `fx` plays over the seat they drew from, a legend's `special` over its owner's seat when
    // they escape, and a winner's legend `win` over the panel when the game ends.
    const skinOf = (number) => window.SkinLooks.def(state.players?.[number]?.skin);
    const playOn = (el, draw, ms, pad) => { if (el && draw) requestAnimationFrame(() => window.SkinLooks.h.playFx(el, draw, ms, pad)); };
    if (fresh.length) {
      for (const entry of fresh) {
        if (entry.pairs > 0) oldmaidShowPairEffect(entry.actor, entry.pairs);
        playOn(oldmaidFindSeatEl(entry.target), skinOf(entry.actor)?.fx, 800, 40);
      }
    }
    oldmaidLastMoves = moves;

    for (const number of g.seatOrder || []) {
      const emptied = (g.counts?.[number] ?? 1) === 0 && !(g.status === 'finished' && number === g.loser);
      if (emptied && !oldmaidSeenEscaped.has(number)) {
        oldmaidSeenEscaped.add(number);
        oldmaidShowEscapeEffect(number);
        const escaper = skinOf(number);
        if (escaper?.legend) playOn(oldmaidFindSeatEl(number), escaper.special, 1400, 60);
      }
    }

    if (g.status === 'finished') {
      const key = `${g.round}:${g.loser}`;
      if (oldmaidSeenFinishedKey !== key) {
        oldmaidSeenFinishedKey = key;
        const finalSkin = [].concat(g.winner || []).map(skinOf).find((d) => d?.legend && d.win);
        if (finalSkin) setTimeout(() => playOn(oldmaidPanel, finalSkin.win, 2400, 10), 900);
      }
    }
  }

  function oldmaidFindSeatEl(number) {
    return oldmaidSeatsEl.querySelector(`[data-seat="${CSS.escape(String(number))}"]`);
  }

  function oldmaidShowPairEffect(actorSeat, pairs) {
    const seatEl = oldmaidFindSeatEl(actorSeat);
    if (!seatEl) return;
    seatEl.classList.add('pairPulse');
    const badge = document.createElement('span');
    badge.className = 'oldmaidPairBadge';
    badge.textContent = pairs > 1 ? `PAIR! ×${pairs}` : 'PAIR!';
    seatEl.appendChild(badge);
    setTimeout(() => { seatEl.classList.remove('pairPulse'); badge.remove(); }, 1100);
  }

  function oldmaidShowEscapeEffect(number) {
    const seatEl = oldmaidFindSeatEl(number);
    if (!seatEl) return;
    seatEl.classList.add('escapeCelebrate');
    const banner = document.createElement('div');
    banner.className = 'oldmaidEscapeBanner';
    banner.textContent = '탈출 성공!';
    seatEl.appendChild(banner);
    setTimeout(() => { seatEl.classList.remove('escapeCelebrate'); banner.remove(); }, 1300);
  }

  function oldmaidCardFaceClass(card) {
    const red = card.suit === '♥' || card.suit === '♦';
    return card.rank === 'JOKER' ? ' joker' : red ? ' red' : '';
  }
  // v1.7.12 실물감: a real playing-card face -- rank+suit indices in two corners and a big centre pip.
  function fillOldmaidFace(el, card) {
    const joker = card.rank === 'JOKER';
    const corner = (extra) => {
      const index = document.createElement('span');
      index.className = `omIndex${extra}`;
      index.setAttribute('aria-hidden', 'true');
      index.append(joker ? 'J' : card.rank, document.createElement('br'), joker ? '★' : card.suit);
      return index;
    };
    const pip = document.createElement('span');
    pip.className = 'omPip';
    pip.setAttribute('aria-hidden', 'true');
    pip.textContent = joker ? '🃏' : card.suit;
    el.replaceChildren(corner(''), pip, corner(' omIndexBottom'));
  }
  function oldmaidCardFaceText(card) {
    return card.rank === 'JOKER' ? '🃏 조커' : `${card.suit} ${card.rank}`;
  }

  // v1.6.43: the draw flyer is now driven entirely by the server-confirmed drawn card (found by
  // diffing my hand before/after the request resolves -- see oldmaidDrawCard), never started
  // optimistically on click. It starts from the clicked seat's on-screen position (captured before
  // the request, since the room re-render that follows replaces that button) and shows the card
  // FACE-UP the whole flight: this element only ever exists in the drawer's own browser, so the
  // face is never sent to or visible from any other participant's screen.
  // v1.6.53: lands on the real drawn-card element's own position (destRect, passed in by the
  // caller) instead of the whole hand container's box -- aiming at the container meant the ghost
  // could fly toward a mostly-empty stretch of it while the actual new card appeared elsewhere in
  // the row, making the landing look like it vanished into empty space instead of into the hand.
  // v1.6.54: opponents can now sit on a compass cross where the same "내 손패" destination can be
  // much closer (west neighbor) or much farther (north, across the table) than the old wrapping
  // grid ever produced -- a fixed .38s transform made short hops sluggish and long hops feel
  // rushed, and it also looked inconsistent across different browser-window sizes. Duration is now
  // derived from travel distance at a constant px/ms speed (matching classic Solitaire's dealing
  // animation), clamped to a sane range, and applied as an inline transition so perceived speed
  // stays the same regardless of distance or viewport.
  const OLDMAID_FLY_SPEED_PX_PER_MS = 1.5;
  const OLDMAID_FLY_MIN_MS = 220;
  const OLDMAID_FLY_MAX_MS = 620;

  function oldmaidFlyDrawnCard(originRect, card, destRect) {
    return new Promise((resolve) => {
      const flyer = document.createElement('span');
      flyer.className = 'oldmaidCard oldmaidFace oldmaidFlyingCard' + oldmaidCardFaceClass(card);
      fillOldmaidFace(flyer, card);
      flyer.setAttribute('aria-label', oldmaidCardFaceText(card));
      flyer.style.left = `${originRect.left}px`;
      flyer.style.top = `${originRect.top}px`;
      flyer.style.width = `${originRect.width}px`;
      flyer.style.height = `${originRect.height}px`;
      const dx = (destRect.left + destRect.width / 2) - (originRect.left + originRect.width / 2);
      const dy = (destRect.top + destRect.height / 2) - (originRect.top + originRect.height / 2);
      const distance = Math.hypot(dx, dy);
      const duration = Math.min(OLDMAID_FLY_MAX_MS, Math.max(OLDMAID_FLY_MIN_MS, distance / OLDMAID_FLY_SPEED_PX_PER_MS));
      const opacityDelay = Math.max(0, duration - 80);
      flyer.style.transitionProperty = 'transform, opacity';
      flyer.style.transitionDuration = `${duration}ms, .18s`;
      flyer.style.transitionTimingFunction = 'cubic-bezier(.22,.85,.32,1), ease';
      flyer.style.transitionDelay = `0s, ${opacityDelay}ms`;
      oldmaidFlyerLayer.appendChild(flyer);
      requestAnimationFrame(() => { flyer.style.transform = `translate(${dx}px, ${dy}px) scale(.92)`; });
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        flyer.classList.add('landed');
        setTimeout(() => { flyer.remove(); resolve(); }, 240);
      };
      setTimeout(finish, duration + 520);
    });
  }

  // v1.6.52: pair-completion now glows and fades the ACTUAL matching cards inside "내 손패" (found
  // by data-cardId, set by oldmaidRenderMyHandFaces) instead of separate floating clones -- so the
  // sequence reads as "the drawn card flies into my hand, then (if it matches) glows together with
  // its partner and both fade away", not two disconnected effects. Only ever called with cards
  // diffed out of my own already-private myOldMaidHand; the real hand array itself is never
  // written here, this only toggles CSS classes on already-rendered DOM elements.
  function oldmaidGlowAndRemovePair(removedCards) {
    return new Promise((resolve) => {
      const ids = new Set(removedCards.map((card) => card.id));
      const cardEls = [...oldmaidMyHand.querySelectorAll('.oldmaidFace')].filter((el) => ids.has(el.dataset.cardId));
      if (!cardEls.length) return resolve();
      for (const el of cardEls) el.classList.add('pairGlow');
      setTimeout(() => {
        for (const el of cardEls) el.classList.add('pairFadeOut');
        setTimeout(resolve, 320);
      }, 380);
    });
  }

  // Joker tension: only ever evaluated from MY OWN already-private hand (state.me.myOldMaidHand),
  // right after MY OWN draw resolves -- never derived from or added to shared game state, so
  // nothing about who holds the joker is exposed to opponents or spectators.
  function oldmaidShowJokerTension() {
    const flash = document.createElement('div');
    flash.className = 'oldmaidJokerFlash';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 700);
    const jokerCard = oldmaidMyHand.querySelector('.oldmaidFace.joker');
    if (jokerCard) {
      jokerCard.classList.add('jokerShake');
      setTimeout(() => jokerCard.classList.remove('jokerShake'), 500);
    }
    try { if (navigator.vibrate) navigator.vibrate(120); } catch {}
  }

  async function oldmaidDrawCard(targetSeat, index, buttonEl) {
    if (oldmaidDrawBusy || !state?.game) return;
    const g = state.game;
    oldmaidDrawBusy = true;
    buttonEl.classList.add('selected');
    for (const candidate of oldmaidSeatsEl.querySelectorAll('.oldmaidBack')) candidate.disabled = true;
    const beforeHand = state.me?.myOldMaidHand || [];
    // The button this rect comes from is destroyed by roomAction()'s re-render below, so it must
    // be captured now, before the request -- not read again afterward.
    const originRect = oldmaidEffectsActive() ? buttonEl.getBoundingClientRect() : null;
    try {
      const data = await roomAction('draw-oldmaid', { targetSeat, index, expectedRevision: g.revision });
      if (oldmaidEffectsActive()) {
        let afterHand = state.me?.myOldMaidHand || [];
        const afterIds = new Set(afterHand.map(card => card.id));
        // The server tells us exactly which card was drawn -- required because a draw that
        // immediately completes a pair removes that same card from the hand again before this
        // ever reaches the client, so it can never be recovered by diffing beforeHand/afterHand
        // (that used to be how this worked, and silently skipped the animation on every such pair).
        const drawnCard = data?.drawnOldMaidCard || null;
        // A failed/stale draw never gets a drawnOldMaidCard back -- nothing animates, which is
        // exactly right: the animation only ever reflects a confirmed result.
        if (drawnCard) {
          const removedCards = [...beforeHand, drawnCard].filter(card => !afterIds.has(card.id));
          const completesPair = removedCards.length >= 2;
          // v1.6.52: when the draw instantly completes a pair, roomAction() already re-rendered
          // "내 손패" with that pair already gone -- so without this, the fly-in ghost would land
          // on a hand that never visibly held the card, and the pair effect would look like a
          // separate, disconnected flourish. Showing the drawn card in the hand first (purely a
          // local, cosmetic display -- the real state never changes) gives the fly-in a real card
          // to land next to, then the matching pair glows together and fades from that same spot.
          if (completesPair) oldmaidRenderMyHandFaces([...beforeHand, drawnCard]);
          if (originRect?.width && originRect?.height) {
            // v1.6.53: land on the drawn card's own real position in the hand, not the hand
            // container's box -- flying toward the container's center could point at a stretch of
            // empty padding while the actual new card sat elsewhere in the row, making the ghost
            // look like it vanished into empty space instead of landing among the real cards.
            const targetEl = oldmaidMyHand.querySelector(`[data-card-id="${CSS.escape(String(drawnCard.id))}"]`);
            const destRect = (targetEl || oldmaidMyHand).getBoundingClientRect();
            await oldmaidFlyDrawnCard(originRect, drawnCard, destRect);
          }
          if (completesPair) {
            await oldmaidGlowAndRemovePair(removedCards);
            afterHand = state.me?.myOldMaidHand || afterHand; // (도둑잡기 검토: the hand as it is now -- one drawn from me during the glow already gone, not the one just after my draw)
            oldmaidRenderMyHandFaces(afterHand);
          }
          if (drawnCard.rank === 'JOKER') oldmaidShowJokerTension();
        }
      }
    } finally {
      oldmaidDrawBusy = false;
    }
  }

  async function oldmaidUsePeek(index) {
    if (oldmaidDrawBusy || !state?.game) return;
    oldmaidDrawBusy = true;
    try {
      await roomAction('use-ability-oldmaid', { type: 'peek', index, expectedRevision: state.game.revision });
    } catch (err) {
      showToast(err.message, 3000);
    } finally {
      oldmaidDrawBusy = false;
    }
  }

  let halliThemeApplied = null;
  const halliNarrow = matchMedia('(max-width:640px)'); const halliTouch = matchMedia('(hover: none) and (pointer: coarse)');
  function renderHalli() {
    const g = state.game;
    const playerName = (number) => state.players[number]?.label || `${number}번`;
    const currentBell = g.lastBell?.flipId === g.flipId ? g.lastBell : null;
    const halliAction = currentBell
      ? { type: 'bell', seat: currentBell.seat, id: currentBell.flipId, at: currentBell.at || '' }
      : g.lastFlip ? { type: 'flip', seat: g.lastFlip.seat, id: g.lastFlip.flipId, at: g.lastFlip.at || '' } : null;
    const halliRecent = observeRecentAction(halliAction
      ? `${halliAction.type}:${halliAction.id}:${halliAction.seat}:${halliAction.at}`
      : null);
    halliClockOffset = Date.now() - (g.serverNow || Date.now());
    halliTimeSelect.value = String(g.durationMinutes || 5);
    halliTimeSelect.disabled = !(isHost && g.status === 'selecting');
    halliStartBtn.disabled = !(isHost && g.status === 'selecting' && Object.values(state.players).filter(Boolean).length >= 2);
    halliFlipBtn.disabled = !(seat && g.status === 'playing' && g.turn === seat);
    // Only the turn-bound flip is marked. The bell is open to everyone all game long, so lighting it
    // up would just be permanent noise (and would hint nothing the fruit cards don't already show).
    setActionable(halliFlipBtn, !halliFlipBtn.disabled && !g.paused, 'primary');
    halliBellBtn.disabled = !(seat && g.status === 'playing' && !g.eliminated.includes(seat));
    const left = g.endsAt ? Math.max(0, Math.ceil((g.endsAt - (Date.now() - halliClockOffset)) / 1000)) : 0;
    halliStatus.textContent = g.status === 'selecting' ? '2~6명이 준비되면 시작할 수 있습니다.'
      : g.status === 'finished' ? `승리: ${(g.winner || []).map(s => state.players[s]?.label || s + '번').join(', ')}`
      : `${g.turn}번 차례 · 남은 시간 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; // (A3 G1-8: the 0.3 s bell lock stays, unexplained)
    // v1.7.41 skins: the host's theme paints the panel; each player's card plot uses that player's skin frame.
    const SLH = window.SkinLooks;
    SLH.h.unstyle(halliPanel, halliThemeApplied);
    halliThemeApplied = null;
    const themeH = SLH.def(state.skinTheme);
    if (themeH?.panel) { halliThemeApplied = { backgroundImage: SLH.h.img(`hg-panel:${state.skinTheme}`, 720, 520, themeH.panel), backgroundSize: 'cover', ...themeH.frame }; SLH.h.style(halliPanel, halliThemeApplied); }
    halliCards.replaceChildren();
    let halliFxTarget = null;
    const fruitAssets = {
      '딸기': window.GameBoot.assetUrl('/assets/halli/strawberry.svg'),
      '바나나': window.GameBoot.assetUrl('/assets/halli/banana.svg'),
      '라임': window.GameBoot.assetUrl('/assets/halli/lime.svg'),
      '자두': window.GameBoot.assetUrl('/assets/halli/plum.svg'),
    };
    for (const owner of g.seatOrder || []) {
      const card = document.createElement('div');
      card.className = `halliCard${g.eliminated.includes(owner) ? ' eliminated' : ''}`;
      if (!currentBell && g.lastFlip?.seat === owner) card.className += recentActionClasses(halliRecent);
      if (currentBell?.seat === owner) card.className += recentActionClasses(halliRecent, 'actor');
      if (currentBell?.transfers?.some(move => move.from === owner)) card.className += recentActionClasses(halliRecent, 'source');
      if (currentBell?.transfers?.some(move => move.to === owner)) card.className += recentActionClasses(halliRecent);
      if (g.lastBell?.flipId === g.flipId && (g.lastBell.transfers || []).length) {
        if (g.lastBell.transfers.some(move => move.to === owner)) card.classList.add('receivedCards');
        if (!g.lastBell.correct && g.lastBell.seat === owner) card.classList.add('paidPenalty');
      }
      const plotSkin = SLH.def(state.players?.[owner]?.skin);
      if (plotSkin?.card) SLH.h.style(card, plotSkin.card);
      // v1.9.2: a right bell that takes five or more cards plays the ringer's legend `special` instead of the bell effect.
      const bigCatch = currentBell?.correct && (currentBell.totalTransferred || 0) >= 5 && plotSkin?.legend && plotSkin.special;
      if (currentBell?.seat === owner && bigCatch) halliFxTarget = { el: card, fx: plotSkin.special, ms: 1400 };
      else if (currentBell?.seat === owner && plotSkin?.fx) halliFxTarget = { el: card, fx: plotSkin.fx, ms: 800 };
      const name = document.createElement('strong');
      name.className = 'halliPlayerName';
      if (plotSkin?.text) SLH.h.style(name, { color: plotSkin.text.color, textShadow: 'none' });
      name.textContent = state.players[owner]?.label || `${owner}번`;
      const face = document.createElement('div');
      const top = g.faceTops?.[owner];
      if (top && fruitAssets[top.fruit]) {
        face.className = 'halliFace';
        const heading = document.createElement('div');
        heading.className = 'halliFruitHeading';
        const fruitName = document.createElement('span');
        fruitName.className = 'halliFruitName';
        fruitName.textContent = top.fruit;
        const fruitCount = document.createElement('strong');
        fruitCount.className = 'halliFruitCount';
        fruitCount.textContent = `${top.count}개`;
        heading.append(fruitName, fruitCount);
        const visuals = document.createElement('div');
        visuals.className = `halliFruitVisuals count-${top.count}`;
        visuals.setAttribute('aria-label', `${top.fruit} ${top.count}개`);
        for (let index = 0; index < top.count; index += 1) {
          const image = document.createElement('img');
          image.className = 'halliFruitIcon';
          image.src = fruitAssets[top.fruit];
          image.alt = '';
          image.setAttribute('aria-hidden', 'true');
          visuals.append(image);
        }
        face.append(heading, visuals);
      } else {
        face.className = 'halliEmptyFace';
        face.textContent = halliNarrow.matches ? '카드 없음' : '아직 공개한 카드 없음'; // (G-게임별 v187 검토: a phone's narrow pile)
      }
      const count = document.createElement('small');
      count.className = 'halliCardCounts';
      if (plotSkin?.text) SLH.h.style(count, { color: plotSkin.text.color, textShadow: 'none' });
      count.textContent = halliNarrow.matches ? `뒷 ${g.pileCounts?.[owner] || 0} · 앞 ${g.faceCounts?.[owner] || 0}` : `뒷면 ${g.pileCounts?.[owner] || 0}장 · 앞면 ${g.faceCounts?.[owner] || 0}장`;
      card.append(name, face, count);
      halliCards.append(card);
    }
    if (halliFxTarget && halliRecent.fresh) requestAnimationFrame(() => SLH.h.playFx(halliFxTarget.el, halliFxTarget.fx, halliFxTarget.ms, 50));
    if (g.status === 'finished' && halliPrevStatus === 'playing') { // v1.9.2: a winner's legend `win` over the panel
      const finalSkin = [].concat(g.winner || []).map((s) => SLH.def(state.players?.[s]?.skin)).find((d) => d?.legend && d.win);
      if (finalSkin) requestAnimationFrame(() => SLH.h.playFx(halliPanel, finalSkin.win, 2400, 10));
    }
    halliPrevStatus = g.status;
    halliTransferDetails.replaceChildren();
    halliTransferResult.classList.toggle('success', Boolean(g.lastBell?.correct));
    halliTransferResult.classList.toggle('penalty', Boolean(g.lastBell && !g.lastBell.correct));
    if (!g.lastBell) {
      halliLastBell.textContent = halliTouch.matches ? '종을 눌러 치세요.' : '스페이스바 또는 종 버튼으로 종을 칠 수 있습니다.'; // (a touch screen has no space bar)
    } else {
      const bell = g.lastBell;
      const moves = bell.transfers || [];
      const total = bell.totalTransferred ?? moves.reduce((sum, move) => sum + move.count, 0);
      halliLastBell.textContent = bell.correct
        ? `직전 종 성공 · ${playerName(bell.seat)}님이 공개 카드 ${total}장 획득`
        : `직전 종 오판 · ${playerName(bell.seat)}님이 뒷면 카드 ${total}장 벌칙`;
      if (!moves.length) {
        const noCards = document.createElement('p');
        noCards.textContent = bell.correct ? '옮길 공개 카드가 없습니다.' : '줄 수 있는 뒷면 카드가 없습니다.';
        halliTransferDetails.append(noCards);
      }
      for (const move of moves) {
        const row = document.createElement('div');
        row.className = 'halliTransferRow';
        if (bell.correct && move.top && fruitAssets[move.top.fruit]) {
          const icon = document.createElement('img');
          icon.className = 'halliTransferFruitIcon';
          icon.src = fruitAssets[move.top.fruit];
          icon.alt = '';
          icon.setAttribute('aria-hidden', 'true');
          row.append(icon);
        }
        const source = document.createElement('span');
        source.textContent = `${playerName(move.from)}님 ${bell.correct ? '공개' : '뒷면'} 카드 ${move.count}장${bell.correct && move.top ? ` (맨 위 ${move.top.fruit} ${move.top.count}개)` : ''}`;
        const arrow = document.createElement('span');
        arrow.className = 'halliTransferArrow';
        arrow.textContent = '→';
        const destination = document.createElement('strong');
        destination.textContent = `${playerName(move.to)}님 뒷면 더미`;
        row.append(source, arrow, destination);
        halliTransferDetails.append(row);
      }
    }
    halliBellLog.replaceChildren();
    for (const entry of (g.bellLog || []).slice(-6).reverse()) {
      const line = document.createElement('p');
      line.textContent = `${state.players[entry.seat]?.label || entry.seat + '번'} · ${entry.type === 'ring' ? entry.correct ? '종 성공' : '종 오판' : entry.type === 'late' ? '늦게 종을 침' : entry.type === 'disconnected' ? '연결 끊김 탈락' : '카드 소진 탈락'}`;
      halliBellLog.append(line);
    }
  }

  const DAVINCI_GUESS_FEEDBACK_MS = 520;

  function davinciFeedbackKey(feedback) {
    return feedback ? [feedback.submittedAt, feedback.seat, feedback.target, feedback.tileId, feedback.number, feedback.correct].join(':') : null;
  }

  function visibleDavinciGuessFeedback(game) {
    const feedback = game?.lastGuess;
    if (!feedback) {
      if (davinciGuessFeedbackTimer) clearTimeout(davinciGuessFeedbackTimer);
      davinciGuessFeedbackTimer = null;
      davinciGuessFeedbackKey = null;
      davinciGuessFeedbackUntil = 0;
      return null;
    }
    const key = davinciFeedbackKey(feedback);
    if (key !== davinciGuessFeedbackKey) {
      davinciGuessFeedbackKey = key;
      window.RoomSound?.play(feedback.correct ? 'right' : 'wrong'); // (G-게임별: 딩 or 둥 with the tile's answer)
      davinciGuessFeedbackUntil = Date.now() + DAVINCI_GUESS_FEEDBACK_MS;
      if (davinciGuessFeedbackTimer) clearTimeout(davinciGuessFeedbackTimer);
      davinciGuessFeedbackTimer = setTimeout(() => {
        davinciGuessFeedbackTimer = null;
        if (davinciFeedbackKey(state?.game?.lastGuess) === key) renderDavinci();
      }, DAVINCI_GUESS_FEEDBACK_MS + 25);
    }
    return Date.now() < davinciGuessFeedbackUntil ? feedback : null;
  }

  function renderDavinciFocusLine(selection) {
    if (!selection) return;
    const groups = [...davinciHands.querySelectorAll('.davinciHand')];
    const attacker = groups.find(group => group.dataset.owner === selection.seat);
    const target = groups.flatMap(group => [...group.querySelectorAll('.davinciTile')])
      .find(button => button.dataset.tileId === selection.tileId);
    const label = attacker?.querySelector('strong');
    if (!attacker || !target || !label) return;
    const bounds = davinciHands.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const labelRect = label.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const startX = labelRect.right - bounds.left + 4;
    const startY = labelRect.top - bounds.top + labelRect.height / 2;
    const endX = targetRect.left - bounds.left + targetRect.width / 2;
    const endY = targetRect.top - bounds.top + targetRect.height / 2;
    const bendX = startX + (endX - startX) * .45;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.classList.add('davinciFocusLine');
    svg.setAttribute('viewBox', `0 0 ${Math.max(1, bounds.width)} ${Math.max(1, bounds.height)}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    const defs = document.createElementNS(ns, 'defs');
    const marker = document.createElementNS(ns, 'marker');
    marker.setAttribute('id', 'davinciFocusArrow');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('refX', '6');
    marker.setAttribute('refY', '3.5');
    marker.setAttribute('orient', 'auto');
    const arrow = document.createElementNS(ns, 'path');
    arrow.setAttribute('d', 'M0,0 L7,3.5 L0,7 Z');
    arrow.setAttribute('fill', '#fbbf24');
    marker.append(arrow);
    defs.append(marker);
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M${startX.toFixed(1)} ${startY.toFixed(1)} C${bendX.toFixed(1)} ${startY.toFixed(1)}, ${bendX.toFixed(1)} ${endY.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`);
    path.setAttribute('marker-end', 'url(#davinciFocusArrow)');
    svg.append(defs, path);
    davinciHands.prepend(svg);
  }

  // v1.6.96: the middle of the table -- the face-down draw pile (count) and this turn's drawn
  // tile beside it. Everyone sees the drawn tile's colour (public); only the drawer sees its number.
  function renderDavinciCenter(g) {
    const center = document.createElement('div');
    center.className = 'davinciCenter';
    const pile = document.createElement('div');
    pile.className = 'davinciPile';
    const stack = Math.min(6, g.pileCount || 0);
    for (let i = 0; i < stack; i += 1) {
      const back = document.createElement('span');
      back.className = 'davinciPileTile'; // colour of pile tiles is not public: a neutral back
      back.style.setProperty('--i', String(i));
      pile.append(back);
    }
    const count = document.createElement('small');
    count.className = 'davinciPileCount';
    count.textContent = g.pileCount ? `더미 ${g.pileCount}장` : '더미 없음';
    pile.append(count);
    pile.setAttribute('aria-label', `뽑을 타일 더미 ${g.pileCount || 0}장`);
    center.append(pile);
    if (g.status === 'playing' && g.drawn && g.turn) {
      const mineDrawn = g.turn === seat ? state.me?.myDavinciDrawn : null;
      const slot = document.createElement('div');
      slot.className = 'davinciDrawnSlot';
      const drawKey = `${g.round}:${g.turn}:${g.pileCount}`;
      const tile = document.createElement('span');
      tile.className = `davinciTile ${g.drawn.color} unrevealed ${mineDrawn ? 'known-private' : 'tile-back'} davinciDrawnTile${drawKey !== davinciLastDrawKey ? ' draw-in' : ''}`;
      davinciLastDrawKey = drawKey;
      const value = document.createElement('span');
      value.className = 'davinciTileValue';
      value.textContent = mineDrawn ? String(mineDrawn.number) : '?';
      tile.append(value);
      tile.setAttribute('aria-label', mineDrawn ? `이번에 뽑은 내 비공개 타일 ${mineDrawn.number}` : `${state.players[g.turn]?.label || g.turn + '번'}님이 뽑은 ${g.drawn.color === 'black' ? '흑' : '백'} 타일`);
      const caption = document.createElement('small'); // (G-게임별: short, never wrapped -- who drew it; mine with 「틀리면 공개」 under)
      caption.textContent = mineDrawn ? '내가 뽑은 타일' : '상대가 뽑은 타일';
      slot.append(tile, caption);
      if (mineDrawn) { const sub = document.createElement('small'); sub.className = 'davinciDrawnNote'; sub.textContent = '틀리면 공개'; slot.append(sub); }
      center.append(slot);
    } else davinciLastDrawKey = null;
    if (g.status === 'playing' && g.phase === 'continue') {
      const note = document.createElement('p');
      note.className = 'davinciCenterNote';
      note.textContent = g.turn === seat ? '정답! 계속 추리하거나 멈추세요' : `${state.players[g.turn]?.label || g.turn + '번'}님 정답 · 계속할지 고르는 중`;
      center.append(note);
      if (g.turn === seat) { // (G-게임별: 멈추기 on the table -- the row under it is folded while a hand is played)
        const stop = document.createElement('button'); stop.type = 'button'; stop.className = 'davinciTableStop secondary'; stop.textContent = '여기서 멈추기';
        stop.disabled = davinciSelectionPending || davinciGuessPending; stop.addEventListener('click', () => davinciStopBtn.click()); center.append(stop);
      }
    }
    return center;
  }

  // One-click guessing: a number pad opens beside the chosen tile; picking a number submits it
  // through the same guess path as the fallback select + button below. Every number 0~11 is
  // drawn identically -- the pad never narrows the candidates; deducing them is the player's job.
  function renderDavinciPicker(g, focus, active) {
    davinciHands.querySelector('.davinciPicker')?.remove();
    const selectionKey = focus ? `${g.revision}:${focus.target}:${focus.tileId}` : null;
    const targetTile = focus && g.hands?.[focus.target]?.find(tile => tile.id === focus.tileId && !tile.revealed);
    if (!active || !targetTile || focus.seat !== seat || !['guess', 'continue'].includes(g.phase) || davinciGuessPending || davinciSelectionPending || g.paused || davinciPickerClosedFor === selectionKey) return;
    const picker = document.createElement('div');
    picker.className = `davinciPicker ${targetTile.color}`;
    picker.setAttribute('role', 'group');
    picker.setAttribute('aria-label', '추측할 숫자 선택');
    const title = document.createElement('strong');
    title.textContent = `${state.players[focus.target]?.label || focus.target + '번'}님의 ${targetTile.color === 'black' ? '흑' : '백'} 타일은?`;
    picker.append(title);
    const grid = document.createElement('div');
    grid.className = 'davinciPickerGrid';
    for (let n = 0; n <= 11; n += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `davinciPickNumber ${targetTile.color}${[6, 9].includes(n) ? ' underline-num' : ''}`;
      button.textContent = String(n);
      button.title = `${n}(으)로 추측`;
      button.setAttribute('aria-label', `${n}(으)로 추측`);
      button.addEventListener('click', () => { davinciNumber.value = String(n); davinciGuessBtn.click(); });
      grid.append(button);
    }
    picker.append(grid);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'davinciPickerClose secondary';
    close.textContent = '닫기 (Esc)';
    close.addEventListener('click', () => { davinciPickerClosedFor = selectionKey; renderDavinci(); });
    picker.append(close);
    davinciHands.append(picker);
    const place = () => {
      const tileEl = [...davinciHands.querySelectorAll('.davinciTile')].find(el => el.dataset.tileId === focus.tileId);
      if (!tileEl || !picker.isConnected) return;
      const bounds = davinciHands.getBoundingClientRect();
      const rect = tileEl.getBoundingClientRect();
      const width = picker.offsetWidth || 260; const height = picker.offsetHeight || 150;
      // Open toward the middle of the table so the pad never covers my own rack at the bottom.
      const hand = tileEl.closest('.davinciHand')?.getBoundingClientRect() || rect;
      const side = tileEl.closest('.pos-left') ? 'left' : tileEl.closest('.pos-right') ? 'right' : '';
      let left = side === 'left' ? hand.right - bounds.left + 10
        : side === 'right' ? hand.left - bounds.left - width - 10
          : rect.left - bounds.left + rect.width / 2 - width / 2;
      let top = side ? rect.top - bounds.top + rect.height / 2 - height / 2 : rect.bottom - bounds.top + 10;
      if (!side && top + height > bounds.height - 6) top = rect.top - bounds.top - height - 10;
      left = Math.max(6, Math.min(bounds.width - width - 6, left));
      top = Math.max(6, Math.min(bounds.height - height - 6, top));
      picker.style.left = `${Math.round(left)}px`;
      picker.style.top = `${Math.round(top)}px`;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(place); else place();
  }

  async function selectDavinciTarget(owner, tileId) {
    const g = state?.game;
    if (!g || g.status !== 'playing' || g.turn !== seat || !['guess', 'continue'].includes(g.phase) || davinciSelectionPending || davinciGuessPending) return;
    // Pressing the tile that is already my target: nothing to send, but the caller just cleared davinciPickerClosedFor
    // (I had closed the number pad with Esc/닫기), so draw again to bring the pad back (v1.7.25, IDEAS backlog 12).
    if (g.selection?.seat === seat && g.selection.target === owner && g.selection.tileId === tileId) { renderDavinci(); return; }
    davinciSelectionPending = true;
    renderDavinci();
    try {
      await roomAction('select-davinci', { targetSeat: owner, tileId, expectedRevision: g.revision });
    } finally {
      davinciSelectionPending = false;
      if (isDavinciGame()) renderDavinci();
    }
  }

  let davinciThemeApplied = null;
  let davinciTableThemeApplied = null;
  function renderDavinci() {
    const g = state.game;
    if (davinciBaselinePending) {
      // Entering or reconnecting: the drawn tile and the last guess already on the table are the baseline, so they are
      // drawn as they are instead of playing the draw / guess / answer effects again. Only later snapshots animate.
      davinciBaselinePending = false;
      const guessKey = davinciFeedbackKey(g.lastGuess);
      davinciGuessFeedbackKey = guessKey; davinciGuessFeedbackUntil = 0;
      davinciFxPlayed = guessKey && `guess:${guessKey}`; davinciSpecialPlayed = guessKey && `special:${guessKey}`;
      davinciLastDrawKey = g.status === 'playing' && g.drawn && g.turn ? `${g.round}:${g.turn}:${g.pileCount}` : null;
    }
    if (davinciRevealRound !== g.round) {
      davinciRevealStates.clear();
      davinciRevealRound = g.round;
    }
    davinciStartBtn.disabled = !(isHost && g.status === 'selecting' && Object.values(state.players).filter(Boolean).length >= 2);
    const active = g.status === 'playing' && g.turn === seat;
    const focus = g.selection || null;
    const feedback = visibleDavinciGuessFeedback(g);
    const latestDavinciGuess = (g.history || []).at(-1);
    observeRecentAction(latestDavinciGuess
      ? `guess:${g.history.length}:${latestDavinciGuess.seat}:${latestDavinciGuess.target}:${latestDavinciGuess.id}:${latestDavinciGuess.number}`
      : null);
    const seconds = g.deadlineAt ? Math.max(0, Math.ceil((g.deadlineAt - Date.now()) / 1000)) : 0;
    const inlineTimer = (!active || !desktopActionTimerOwns('davinci')) && String(state.turnTimer?.seat) !== String(g.turn); // (A3 G1-4: the turn's ring on the name card says it)
    const inlineTimerText = inlineTimer && g.deadlineAt ? ` · 남은 시간 ${seconds}초` : '';
    davinciStatus.textContent = g.status === 'selecting' ? '2~4명이 자리를 선택하면 방장이 시작합니다.'
      : g.status === 'finished' ? `승리: ${(g.winner || []).map(s => state.players[s]?.label || s + '번').join(', ')}`
      : `${g.turn === seat ? '내 차례' : `${state.players[g.turn]?.label || g.turn + '번'}님 차례`} · ${g.phase === 'reveal-own' ? (g.turn === seat ? '틀렸어요 · 공개할 내 타일을 고르세요' : '틀려서 자기 타일을 공개하는 중') : g.turn === seat ? '상대 타일을 누르고 숫자를 고르세요' : '상대 타일을 추리하는 중'}${inlineTimerText} · 더미 ${g.pileCount}장`;
    // v1.7.40 skins: the host's theme paints the panel; a rack's tiles are decorated by their owner's skin.
    const SLD = window.SkinLooks;
    SLD.h.unstyle(davinciPanel, davinciThemeApplied);
    davinciThemeApplied = null;
    const themeD = SLD.def(state.skinTheme);
    if (themeD?.panel) { davinciThemeApplied = { backgroundImage: SLD.h.img(`dv-panel:${state.skinTheme}`, 720, 520, themeD.panel), backgroundSize: 'cover', ...themeD.frame }; SLD.h.style(davinciPanel, davinciThemeApplied); }
    // v1.9.8: the table covers most of the panel, so it wears the theme too (instead of the green felt) under a light
    // veil that keeps the tiles and racks readable; without a theme the felt stays.
    SLD.h.unstyle(davinciHands, davinciTableThemeApplied);
    davinciTableThemeApplied = themeD?.panel ? { background: `linear-gradient(rgba(8,12,20,.16),rgba(8,12,20,.32)), ${SLD.h.img(`dv-panel:${state.skinTheme}`, 720, 520, themeD.panel)} center/cover no-repeat` } : null;
    SLD.h.style(davinciHands, davinciTableThemeApplied);
    if (g.status === 'finished' && davinciPrevStatus === 'playing') { // v1.9.2: a winner's legend `win` over the panel
      const finalSkin = [].concat(g.winner || []).map((s) => SLD.def(state.players?.[s]?.skin)).find((d) => d?.legend && d.win);
      if (finalSkin) requestAnimationFrame(() => SLD.h.playFx(davinciPanel, finalSkin.win, 2400, 10));
    }
    davinciPrevStatus = g.status;
    davinciHands.replaceChildren();
    // v1.6.96: a table seen from my chair -- my rack at the bottom, opponents around it, the draw
    // pile and this turn's drawn tile in the middle. Only public fields (colour, revealed numbers,
    // guess history) and my own tiles are drawn; nothing new is sent by the server.
    const tableSeats = (g.seatOrder?.length ? g.seatOrder : Object.keys(g.hands || {})).filter(owner => g.hands?.[owner]);
    const anchor = seat && g.hands?.[seat] ? seat : tableSeats[0];
    const around = tableSeats.length ? [...tableSeats.slice(tableSeats.indexOf(anchor) + 1), ...tableSeats.slice(0, Math.max(0, tableSeats.indexOf(anchor)))] : [];
    const layoutFor = { 0: [], 1: ['top'], 2: ['left', 'right'], 3: ['left', 'top', 'right'] }[around.length] || around.map(() => 'top');
    const positions = new Map([[anchor, 'bottom'], ...around.map((owner, i) => [owner, layoutFor[i]])]);
    davinciHands.className = `davinciHands davinciTable seats-${tableSeats.length}`;
    const missesFor = (owner, id) => [...new Set((g.history || []).filter(h => h.target === owner && h.id === id && !h.correct).map(h => h.number))];
    const firstRender = davinciRevealStates.size === 0;
    for (const owner of tableSeats) {
      const tiles = g.hands[owner];
      const group = document.createElement('div');
      const isTurn = g.status === 'playing' && g.turn === owner;
      const isTargetOwner = focus?.target === owner;
      const isTargeting = focus?.seat === owner;
      group.className = `davinciHand pos-${positions.get(owner) || 'top'}${isTurn ? ' is-active-turn' : ''}${isTargetOwner ? ' is-target-owner' : ''}${isTargeting ? ' is-targeting' : ''}${owner === seat ? ' is-my-hand' : ''}`;
      group.dataset.owner = owner;
      const ownerLabel = state.players[owner]?.label || owner + '번';
      const label = document.createElement('strong');
      const hiddenLeft = tiles.filter(tile => !tile.revealed).length;
      label.textContent = `${ownerLabel}${owner === seat ? ' (나)' : ''}${g.status === 'playing' ? ` · 남은 비공개 ${hiddenLeft}장` : ''}${hiddenLeft === 0 && g.status !== 'selecting' ? ' · 탈락' : ''}`;
      { const f = document.createElement('span'); f.className = 'seatFace'; f.setAttribute('aria-hidden', 'true'); const look = state.players[owner]?.face; if (look?.skin) f.style.setProperty('--skin', look.skin); if (look?.hair) f.style.setProperty('--hair', look.hair); label.prepend(f); } // (G-게임별: the rack's label the name plate, with the island face)
      group.setAttribute('aria-label', `${ownerLabel}의 타일${isTargeting ? ' · 현재 추리 중' : ''}${isTargetOwner ? ' · 현재 추리 대상' : ''}`);
      group.append(label);
      if (active && g.phase === 'guess' && owner !== seat && !g.paused && tiles.some(tile => !tile.revealed) && focus?.seat !== seat) { // (G-게임별: what to do, on the rack to do it on)
        const hint = document.createElement('small'); hint.className = 'davinciHint'; hint.textContent = '상대 타일을 눌러 숫자를 맞혀요'; group.append(hint);
      }
      const rack = document.createElement('div');
      rack.className = 'davinciRack';
      group.append(rack);
      for (const tile of tiles) {
        const mine = owner === seat && state.me?.myDavinciTiles?.find(t => t.id === tile.id);
        const selected = focus?.target === owner && focus.tileId === tile.id;
        const feedbackForTile = feedback?.target === owner && feedback.tileId === tile.id;
        const latestGuessTile = latestDavinciGuess?.target === owner && latestDavinciGuess.id === tile.id;
        const localGuessForTile = davinciGuessPending && focus?.seat === seat && selected;
        const revealPending = active && g.phase === 'reveal-own' && owner === seat && !tile.revealed;
        const wasRevealed = davinciRevealStates.get(tile.id);
        const revealingNow = tile.revealed && wasRevealed === false && !feedbackForTile;
        const placedNow = !firstRender && wasRevealed === undefined;
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.tileId = tile.id;
        const value = tile.revealed ? String(tile.number) : mine ? String(mine.number) : '?';
        button.className = ['davinciTile', tile.color, tile.revealed ? 'revealed' : 'unrevealed', !tile.revealed && mine ? 'known-private' : '', !tile.revealed && !mine ? 'tile-back' : '', ['6', '9'].includes(value) ? 'underline-num' : '', selected ? 'selected-target' : '', revealPending ? 'pending-reveal' : '', revealingNow ? 'reveal-now' : '', placedNow ? 'placed-now' : '', feedbackForTile ? 'guess-result' : '', feedbackForTile && feedback.correct ? 'guess-correct' : '', feedbackForTile && !feedback.correct ? 'guess-wrong' : '', localGuessForTile ? 'guess-submitting' : '', latestGuessTile && !feedbackForTile ? 'recentActionDavinci' : ''].filter(Boolean).join(' ');
        const valueElement = document.createElement('span');
        valueElement.className = 'davinciTileValue';
        valueElement.textContent = value;
        button.append(valueElement);
        const tileSkin = SLD.def(state.players?.[owner]?.skin);
        if (tileSkin?.tile) SLD.h.style(button, tileSkin.tile(tile.color, tile.revealed));
        // v1.8.4: the answer effect plays once per guess (the same feedback is re-rendered several times), and is aimed
        // at the tile that is on screen when the frame runs -- this render's button may already have been replaced.
        const fxKey = feedbackForTile && feedback.correct ? `guess:${davinciFeedbackKey(feedback)}` : revealingNow ? `reveal:${tile.id}` : null;
        // v1.9.2: a right guess by a legend owner plays the guesser's `special` over the guessed tile (once per guess).
        const guesserSkin = feedbackForTile && feedback.correct ? SLD.def(state.players?.[feedback.seat]?.skin) : null;
        const specialKey = guesserSkin?.legend && guesserSkin.special ? `special:${davinciFeedbackKey(feedback)}` : null;
        if (specialKey && specialKey !== davinciSpecialPlayed) {
          davinciSpecialPlayed = specialKey;
          const tileId = tile.id;
          requestAnimationFrame(() => { const live = button.isConnected ? button : davinciHands.querySelector(`[data-tile-id="${tileId}"]`); if (live) SLD.h.playFx(live, guesserSkin.special, 1300, 60); });
        } else if (tileSkin?.fx && fxKey && fxKey !== davinciFxPlayed) {
          davinciFxPlayed = fxKey;
          const tileId = tile.id;
          requestAnimationFrame(() => { const live = button.isConnected ? button : davinciHands.querySelector(`[data-tile-id="${tileId}"]`); if (live) SLD.h.playFx(live, tileSkin.fx, 700, 30); });
        }
        const guessNumber = feedbackForTile ? feedback.number : localGuessForTile ? davinciGuessPendingNumber : null;
        if (guessNumber !== null && guessNumber !== undefined) {
          const guessElement = document.createElement('span');
          guessElement.className = 'davinciGuessValue';
          guessElement.textContent = String(guessNumber);
          guessElement.setAttribute('aria-hidden', 'true');
          button.append(guessElement);
        }
        // Deduction memo: numbers already guessed wrong on this hidden tile (public history).
        const misses = tile.revealed ? [] : missesFor(owner, tile.id);
        if (misses.length) {
          const memo = document.createElement('span');
          memo.className = 'davinciMemo';
          memo.textContent = misses.slice(-4).map(n => `✗${n}`).join(' ');
          memo.setAttribute('aria-hidden', 'true');
          button.append(memo);
        }
        const stateText = tile.revealed ? '공개 완료' : mine ? '비공개 · 내 화면에서 숫자 확인' : '비공개';
        const feedbackText = feedbackForTile ? ` · 추측 숫자 ${feedback.number} · ${feedback.correct ? '정답' : '오답'}` : localGuessForTile ? ` · 추측 숫자 ${davinciGuessPendingNumber} 제출 중` : '';
        button.setAttribute('aria-label', `${owner}번 ${tile.color === 'black' ? '흑' : '백'} 타일 ${value} · ${stateText}${selected ? ' · 현재 추리 대상' : ''}${misses.length ? ` · 틀린 추측 ${misses.join(', ')}` : ''}${feedbackText}`);
        const canReveal = active && g.phase === 'reveal-own' && owner === seat && !tile.revealed;
        const canSelect = active && !davinciSelectionPending && !davinciGuessPending && ['guess', 'continue'].includes(g.phase) && owner !== seat && !tile.revealed;
        button.disabled = !(canReveal || canSelect);
        // Built only from public tile fields (owner/revealed) and my own turn/phase -- the same
        // condition that enables the button -- so it never encodes a hidden number.
        if ((canReveal || canSelect) && !selected && !feedbackForTile && !localGuessForTile && !g.paused) button.classList.add('actionableTarget');
        button.addEventListener('click', () => {
          if (g.phase === 'reveal-own') roomAction('reveal-davinci', { tileId: tile.id, expectedRevision: g.revision });
          else { davinciPickerClosedFor = null; selectDavinciTarget(owner, tile.id); }
        });
        rack.append(button);
        davinciRevealStates.set(tile.id, tile.revealed);
      }
      davinciHands.append(group);
    }
    davinciHands.append(renderDavinciCenter(g));
    davinciPrivate.replaceChildren();
    davinciPrivate.classList.add('hidden');
    renderDavinciPicker(g, focus, active);
    const selectedTarget = focus?.seat === seat && g.hands[focus.target]?.some(tile => tile.id === focus.tileId && !tile.revealed);
    davinciGuessBtn.disabled = !(active && !davinciSelectionPending && !davinciGuessPending && ['guess', 'continue'].includes(g.phase) && selectedTarget);
    davinciStopBtn.classList.toggle('hidden', !(active && g.phase === 'continue'));
    davinciGuessBtn.closest('.davinciActions').classList.toggle('hidden', g.status !== 'playing'); // (다빈치 검토: no 「추측할 숫자」 row before a hand)
    setActionable(davinciGuessBtn, !davinciGuessBtn.disabled && !g.paused, 'primary');
    davinciStopBtn.disabled = davinciSelectionPending || davinciGuessPending;
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => renderDavinciFocusLine(focus));
    else renderDavinciFocusLine(focus);
    renderTurnRing(); // (the racks were just redrawn: the turn's ring back on its label)
  }

  function drawBoard() {
    if (state?.gameType === 'rpg' || state?.gameType === 'gostop' || state?.gameType === 'baseball' || state?.gameType === 'bingo' || state?.gameType === 'pictionary' || state?.gameType === 'liar' || state?.gameType === 'oldmaid' || state?.gameType === 'davinci' || state?.gameType === 'halligalli' || state?.gameType === 'pandemic') return;
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
      // The finish line is a resting waypoint just outside the start corner, not the same tile as
      // node 0 -- a piece parked there (after a full lap, per lib/games/yut.js FINISH_LINE) must be
      // visually distinguishable from one actually sitting on the start corner, or a back-do off of
      // it looks like nothing moved when another piece of the same color happens to be on node 0.
      finishLine:[678,678],
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

  // v1.6.82: the moves renderYut() offers as buttons -- the server's legalMoves for my 'move' phase,
  // held back while a throw/piece animation is still settling exactly like the buttons are.
  function yutActionableMoves() {
    const g = state?.game;
    if (!actionWindowOpen(g) || g.turn !== seat || g.phase !== 'move' || yutThrowAnimating || yutPieceAnimation) return [];
    return g.legalMoves || [];
  }

  const YUT_PIECE_NUMBER = id => Number(String(id).split('-').at(-1));

  // v1.7.25 (IDEAS backlog 11): the server lists one move per waiting home piece, but home pieces are interchangeable and
  // the board offers them as ONE start-corner token that sends the lowest-numbered waiting piece (yutSelectableTargets).
  // The fallback buttons offer that same single home move, so no button is left that would do nothing when pressed.
  function yutOfferedMoves(legalMoves) {
    const mine = state?.game?.pieces?.[seat] || [];
    const isHome = move => mine.find(piece => piece.id === move.pieceId)?.status === 'home';
    let lowest = null;
    for (const move of legalMoves) {
      if (isHome(move) && (!lowest || YUT_PIECE_NUMBER(move.pieceId) < YUT_PIECE_NUMBER(lowest.pieceId))) lowest = move;
    }
    return legalMoves.filter(move => !isHome(move) || move === lowest);
  }
  const YUT_HOME_TOKEN_NODE = 0; // the start corner: board pieces never rest there (laps end on finishLine)
  const YUT_TARGET_RADIUS = 26;
  let yutFingerTimer = null;

  // v1.6.83: every legal move as ONE on-board selection target, laid out with the very same
  // yutNodePosition()/yutStackOffsets() geometry drawPieceStack() paints with, so what is drawn and
  // what is clickable can never drift apart. A stacked group is a single capsule (the server moves
  // it as one unit via `carried`); home pieces are interchangeable, so they share one start-corner
  // token that sends the lowest-numbered waiting piece -- the same move its fallback button sends.
  function yutSelectableTargets() {
    const g = state?.game;
    const moves = yutMovePending ? [] : yutActionableMoves();
    if (!moves.length) return [];
    const mine = g.pieces?.[seat] || [];
    const targets = [];
    let homeTarget = null;
    for (const move of moves) {
      const piece = mine.find(item => item.id === move.pieceId);
      if (!piece || piece.status === 'finished') continue;
      const finishing = move.destination?.status === 'finished';
      const dest = finishing ? 'finishLine' : move.destination?.position;
      if (piece.status === 'home') {
        const waiting = mine.filter(item => item.status === 'home').length;
        if (!homeTarget || YUT_PIECE_NUMBER(move.pieceId) < YUT_PIECE_NUMBER(homeTarget.move.pieceId)) {
          const [x, y] = yutNodePosition(YUT_HOME_TOKEN_NODE);
          homeTarget = { key: 'home', kind: 'home', move, x1: x, x2: x, y, numbers: [YUT_PIECE_NUMBER(move.pieceId)], waiting, dest, finishing };
        }
        continue;
      }
      const group = mine.filter(item => item.status === 'board' && item.position === piece.position)
        .sort((a, b) => YUT_PIECE_NUMBER(a.id) - YUT_PIECE_NUMBER(b.id));
      const offsets = yutStackOffsets(group.length);
      const [x, y] = yutNodePosition(piece.position);
      const numbers = (move.carried || [move.pieceId]).map(YUT_PIECE_NUMBER).sort((a, b) => a - b);
      targets.push({ key: `board:${piece.position}`, kind: 'board', move, x1: x + offsets[0], x2: x + offsets[offsets.length - 1], y, numbers, dest, finishing });
    }
    if (homeTarget) targets.push(homeTarget);
    return targets;
  }

  function yutTargetForPiece(pieceId) {
    return yutSelectableTargets().find(target => target.move.pieceId === pieceId || (target.move.carried || []).includes(pieceId)) || null;
  }

  function yutTargetAt(px, py) {
    // Distance to the capsule's centre segment: any part of a stacked group hits the same move.
    let best = null;
    for (const target of yutSelectableTargets()) {
      const cx = Math.max(target.x1, Math.min(target.x2, px));
      const distance = Math.hypot(px - cx, py - target.y);
      if (distance <= YUT_TARGET_RADIUS && (!best || distance < best.distance)) best = { target, distance };
    }
    return best?.target || null;
  }

  function yutCapsule(x1, x2, y, r) {
    ctx.beginPath();
    ctx.arc(x1, y, r, Math.PI / 2, Math.PI * 1.5);
    ctx.arc(x2, y, r, Math.PI * 1.5, Math.PI / 2);
    ctx.closePath();
  }

  async function requestYutMove(pieceId) {
    if (yutMovePending || !yutTargetForPiece(pieceId)) return;
    yutMovePending = true;
    yutHoverTargetKey = null;
    canvas.style.cursor = '';
    renderYut();
    drawYutBoard();
    try {
      await roomAction('move-yut', { pieceId });
    } finally {
      yutMovePending = false;
      if (state?.gameType === 'yut') { renderYut(); drawYutBoard(); }
    }
  }

  function drawYutBoard() {
    const g = state.game;
    const yutRecent = observeRecentAction(g.lastMove
      ? `move:${g.lastMove.at || ''}:${(g.lastMove.pieceIds || []).join(',')}`
      : null);
    const yutRecentIds = new Set(g.lastMove?.pieceIds || []);
    // v1.7.10 실물감: a straw mat (멍석) under a hanji 말판 drawn in ink, like a real yut board.
    const theme = window.SkinLooks.def(state.skinTheme)?.board; // the host's room theme (v1.7.37)
    ctx.drawImage(theme ? boardTexture(`yut:${state.skinTheme}`, 720, 720, (c, tw, th) => theme.paint(c, tw, th)) : boardTexture('yut-mat', 720, 720, paintYutMat), 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = theme ? theme.ink : 'rgba(28,18,10,.78)';
    ctx.lineWidth = 5;
    const paths = [
      [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,'finishLine',0],
      [5,21,22,23,24,25,15], [10,26,27,23,28,29,'finishLine'],
    ];
    for (const path of paths) {
      ctx.beginPath();
      path.forEach((node, i) => { const [x,y] = yutNodePosition(node); if (i) ctx.lineTo(x,y); else ctx.moveTo(x,y); });
      ctx.stroke();
    }
    // v1.6.41: the start/finish tile (node 0) gets a solid, high-contrast blue fill instead of the
    // shared brown corner style, so it reads at a glance without a text label. The "지름길"/"출발 ·
    // 완주" labels that used to float over the board's center and start corner were removed -- the
    // path lines and this tile's distinct color already show the same information, and the finish
    // count is already shown in the score row above the board.
    const nodes = [...new Set(paths.flat())];
    for (const node of nodes) {
      const [x,y] = yutNodePosition(node);
      const isStart = node === 0;
      const isFinish = node === 'finishLine';
      const corner = [0,5,10,15,23].includes(node);
      if (isStart) {
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath(); ctx.arc(x,y,30,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fef9c3';
        ctx.lineWidth = 4;
        ctx.stroke();
        continue;
      }
      // v1.6.64: a distinct green tile for the "완주 직전 칸" (FINISH_LINE) resting waypoint, so a
      // piece parked there -- and a back-do moving it off again -- is never mistaken for the blue
      // start tile it used to sit directly on top of.
      if (isFinish) {
        ctx.fillStyle = '#15803d';
        ctx.beginPath(); ctx.arc(x,y,22,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fef9c3';
        ctx.lineWidth = 3;
        ctx.stroke();
        continue;
      }
      // Brush-inked stations on the paper: corners (모·뒷모·방) get a double ring.
      ctx.fillStyle = theme ? theme.node : '#f6ecd2';
      ctx.strokeStyle = theme ? theme.ink : 'rgba(28,18,10,.85)';
      ctx.lineWidth = 3.2;
      ctx.beginPath(); ctx.arc(x,y,corner ? 25 : 17,0,Math.PI*2); ctx.fill(); ctx.stroke();
      if (corner) {
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x,y,17,0,Math.PI*2); ctx.stroke();
      }
      ctx.fillStyle = theme ? theme.ink : 'rgba(28,18,10,.7)';
      ctx.beginPath(); ctx.arc(x,y,corner ? 5 : 3.5,0,Math.PI*2); ctx.fill();
    }

    // v1.6.57: drawPieceStack is the same per-stack rendering this loop always did, just pulled out
    // so a piece mid-step-by-step-move (see yutPieceAnimation/animateYutPieceMove) can be drawn once
    // more, separately, at its interpolated in-transit pixel position instead of its already-final
    // server position -- the visuals are identical either way, only which (x,y) gets passed differs.
    const drawPieceStack = (x, y, color, pieces) => {
      const fill = color === 'black' ? '#2563eb' : '#ef4444';
      const ordered = [...pieces].sort((a, b) => Number(a.id.split('-').at(-1)) - Number(b.id.split('-').at(-1)));
      const offsets = yutStackOffsets(ordered.length);
      for (const [index, piece] of ordered.entries()) {
        const px = x + offsets[index];
        drawYutToken(px, y, fill, piece.id.split('-').at(-1), color);
      }
    };
    const animatingIds = yutPieceAnimation?.pieceIds || null;
    const grouped = new Map();
    for (const color of ['black','white']) for (const piece of g.pieces?.[color] || []) {
      if (piece.status !== 'board') continue;
      if (animatingIds?.has(piece.id)) continue; // drawn separately below, mid-transit
      const key = `${piece.position}:${color}`;
      if (!grouped.has(key)) grouped.set(key, { position: piece.position, color, pieces: [] });
      grouped.get(key).pieces.push(piece);
    }
    for (const { position, color, pieces } of grouped.values()) {
      const [x,y] = yutNodePosition(position);
      drawPieceStack(x, y, color, pieces);
    }
    if (animatingIds) {
      // The whole piggybacked group travels together in lockstep (identical path), so there is only
      // ever one in-transit (x,y) to draw at -- but keep colors separate in case a future rule ever
      // lets pieces of different colors be captured/carried mid-animation together.
      for (const color of ['black','white']) {
        const pieces = (g.pieces?.[color] || []).filter(piece => animatingIds.has(piece.id));
        if (pieces.length) {
          const trailSkin = window.SkinLooks.def(state.players?.[color]?.skin);
          if (trailSkin?.trail) { ctx.save(); trailSkin.trail(ctx, yutTrail, 18, color, pieces[0].id.split('-').at(-1)); ctx.restore(); }
          drawPieceStack(yutPieceAnimation.x, yutPieceAnimation.y, color, pieces);
        }
      }
    }
    // v1.9.0 legends: once the move has landed, a catch plays the catcher's `special` on the spot and a win the
    // winner's `win` over the board (after the catch, if both).
    const lm = g.lastMove;
    const catchSkin = lm?.captured?.length ? window.SkinLooks.def(state.players?.[lm.color]?.skin) : null;
    const yutWinSkin = g.status === 'finished' && g.winner ? window.SkinLooks.def(state.players?.[g.winner]?.skin) : null;
    const catchMs = catchSkin?.legend && catchSkin.special ? 1400 : 0;
    const yutWinMs = yutWinSkin?.legend && yutWinSkin.win ? 2400 : 0;
    if (!animatingIds && lm && (catchMs || yutWinMs)) {
      const elapsed = pieceMotion(`yutfx:${lm.at || ''}:${g.status}`, catchMs + yutWinMs) * (catchMs + yutWinMs);
      if (catchMs && elapsed < catchMs) {
        const [x, y] = yutNodePosition(lm.destination?.position ?? 0);
        ctx.save(); catchSkin.special(ctx, [{ x, y }], 28, elapsed / catchMs, lm.color, String(lm.pieceIds?.[0] || '').split('-').at(-1)); ctx.restore();
      }
      if (yutWinMs && elapsed > catchMs && elapsed < catchMs + yutWinMs) {
        const [x, y] = yutNodePosition(0);
        ctx.save(); yutWinSkin.win(ctx, [{ x, y }], 28, (elapsed - catchMs) / yutWinMs, g.winner, { w: 720, h: 720 }); ctx.restore();
      }
    }
    // v1.6.83: selectable targets (mint, the v1.6.82 actionable colour). Destinations are dashed
    // rings carrying the moving piece number(s); the targets themselves are solid capsules drawn
    // OUTSIDE the piece, so the amber recent-move ring drawn next stays visible just inside it.
    const selectable = animatingIds ? [] : yutSelectableTargets();
    if (!selectable.length && canvas.style.cursor) canvas.style.cursor = '';
    if (selectable.length) {
      const hovered = selectable.find(target => target.key === yutHoverTargetKey) || null;
      const mint = alpha => `rgba(4,120,87,${alpha})`;
      if (hovered?.move.destination?.path?.length > 1) {
        // Only while pointing at / focusing a target: its real server path, lightly traced.
        ctx.save();
        ctx.strokeStyle = 'rgba(16,185,129,.55)';
        ctx.lineWidth = 5;
        ctx.setLineDash([2, 9]);
        ctx.lineCap = 'round';
        ctx.beginPath();
        hovered.move.destination.path.forEach((node, index) => {
          const [x, y] = yutNodePosition(node === 'finished' ? 'finishLine' : node);
          if (index) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        });
        ctx.stroke();
        ctx.restore();
      }
      const byDestination = new Map();
      for (const target of selectable) {
        if (target.dest === undefined || target.dest === null) continue;
        const key = String(target.dest);
        if (!byDestination.has(key)) byDestination.set(key, []);
        byDestination.get(key).push(target);
      }
      for (const [dest, targets] of byDestination) {
        const [x, y] = yutNodePosition(dest === 'finishLine' ? dest : Number(dest));
        const emphasised = hovered && targets.includes(hovered);
        drawActionableMark(x, y, 27, { dashed: !emphasised, rgb: '4,120,87', alpha: emphasised ? 1 : .9, width: emphasised ? 4.5 : 3 });
        const label = targets.map(target => `${target.numbers.join('·')}${target.finishing ? ' 완주' : ''}`).join(' / ');
        ctx.save();
        ctx.font = '900 12px system-ui, sans-serif';
        const width = ctx.measureText(label).width + 12;
        const lx = Math.min(720 - width - 2, x + 16);
        const ly = y - 38;
        ctx.fillStyle = emphasised ? mint(1) : mint(.88);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(lx, ly, width, 18, 9);
        else ctx.rect(lx, ly, width, 18);
        ctx.fill();
        ctx.fillStyle = '#ecfdf5';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, lx + 6, ly + 9.5);
        ctx.restore();
      }
      for (const target of selectable) {
        const emphasised = target === hovered;
        if (target.kind === 'home') {
          // The waiting pieces' token, drawn on the (never occupied) start corner only while entering
          // a new piece is actually legal; a small count shows how many are still at home.
          ctx.save();
          drawYutToken(target.x1, target.y, seat === 'black' ? '#2563eb' : '#ef4444', String(target.numbers[0]), seat);
          ctx.textAlign = 'center';
          if (target.waiting > 1) {
            ctx.fillStyle = '#0f172a';
            ctx.beginPath(); ctx.arc(target.x1 + 16, target.y - 16, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '900 11px system-ui, sans-serif';
            ctx.fillText(`×${target.waiting}`, target.x1 + 16, target.y - 12);
          }
          ctx.restore();
        }
        ctx.save();
        if (emphasised) {
          ctx.fillStyle = 'rgba(52,211,153,.2)';
          yutCapsule(target.x1, target.x2, target.y, YUT_TARGET_RADIUS + 2);
          ctx.fill();
        }
        ctx.strokeStyle = emphasised ? mint(1) : mint(.95);
        ctx.lineWidth = emphasised ? 5 : 3.5;
        ctx.shadowColor = 'rgba(52,211,153,.55)';
        ctx.shadowBlur = emphasised ? 10 : 6;
        yutCapsule(target.x1, target.x2, target.y, emphasised ? YUT_TARGET_RADIUS + 2 : YUT_TARGET_RADIUS);
        ctx.stroke();
        ctx.restore();
        // (G-게임별 윷: 「이 말」 -- a big finger over it, pointing down; on the top row under it, pointing up)
        const up = target.y < 140; const nod = reducedMotionActive() ? 0 : Math.sin(performance.now() / 170) * 6; const gap = YUT_TARGET_RADIUS + 8 + nod;
        ctx.save(); ctx.font = '64px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = up ? 'top' : 'bottom';
        ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 8; ctx.fillText(up ? '👆' : '👇', (target.x1 + target.x2) / 2, up ? target.y + gap : target.y - gap); ctx.restore();
      }
      if (!reducedMotionActive() && !yutFingerTimer) yutFingerTimer = setTimeout(() => { yutFingerTimer = null; if (state?.gameType === 'yut' && document.body.classList.contains('roomPlaying')) drawYutBoard(); }, 50); // (the finger nods while there is a piece to pick)
    }
    if (!animatingIds && yutRecentIds.size) {
      for (const { position, pieces } of grouped.values()) {
        const ordered = [...pieces].sort((a, b) => Number(a.id.split('-').at(-1)) - Number(b.id.split('-').at(-1)));
        const offsets = yutStackOffsets(ordered.length);
        const [x, y] = yutNodePosition(position);
        ordered.forEach((piece, index) => {
          if (yutRecentIds.has(piece.id)) drawRecentActionRing(x + offsets[index], y, 22, yutRecent);
        });
      }
    }
    const home = color => (g.pieces?.[color] || []).filter(piece => piece.status === 'home').length;
    const done = color => (g.pieces?.[color] || []).filter(piece => piece.status === 'finished').length;
    ctx.textAlign = 'left';
    ctx.font = '850 18px system-ui, sans-serif';
    ctx.fillStyle = characterPairActive() ? '#282132' : '#1d4ed8'; ctx.fillText(`${seatKo('black')} 집 ${home('black')} · 완주 ${done('black')}`, 120, 690);
    ctx.fillStyle = characterPairActive() ? '#282132' : '#b91c1c'; ctx.fillText(`${seatKo('white')} 집 ${home('white')} · 완주 ${done('white')}`, 390, 690);
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
    // v1.7.10 실물감: pencil-and-paper. A notebook page, marker lines drawn stroke by stroke, and
    // claimed boxes hatched with the owner's pen and initialled.
    const theme = window.SkinLooks.def(state.skinTheme)?.board; // the host's room theme (v1.7.37)
    ctx.drawImage(theme ? boardTexture(`dots:${state.skinTheme}`, 720, 720, (c, tw, th) => theme.paint(c, tw, th)) : boardTexture('notebook', 720, 720, paintNotebook), 0, 0);
    const lastEdge = g.lastMove?.edgeId;
    // A line skin may add a short effect (premium/legend) after the stroke is drawn.
    const lastOwner = lastEdge === undefined ? null : (lastEdge < 20 ? g.edges?.h?.[Math.floor(lastEdge / 4)]?.[lastEdge % 4] : g.edges?.v?.[Math.floor((lastEdge - 20) / 5)]?.[(lastEdge - 20) % 5]);
    const lineSkin = (owner) => window.SkinLooks.def(state.players?.[owner]?.skin);
    const fxMs = lastOwner && lineSkin(lastOwner)?.lineFx ? 700 : 0;
    // v1.9.0 legends: one line closing two or more boxes plays the owner's `special`; the end of the game the winner's `win`.
    const boxRect = ([row, col]) => ({ x: pad + col * gap + 12, y: pad + row * gap + 12, size: gap - 24 });
    const claimedNow = g.lastMove?.claimed || [];
    const dotsSpecialSkin = lastOwner && claimedNow.length >= 2 && lineSkin(lastOwner)?.legend ? lineSkin(lastOwner) : null;
    const dotsSpecialMs = dotsSpecialSkin?.special ? 1300 : 0;
    const dotsWinSkin = g.status === 'finished' && g.winner ? lineSkin(g.winner) : null;
    const dotsWinMs = dotsWinSkin?.legend && dotsWinSkin.win ? 2400 : 0;
    const dotsTotal = 380 + fxMs + dotsSpecialMs + dotsWinMs;
    const dotsMotion = pieceMotion(lastEdge !== undefined ? `dots:${g.moveCount}:${g.lastMove?.at || ''}` : '', dotsTotal);
    const drawStroke = Math.min(1, dotsMotion * dotsTotal / 380);
    const newBoxes = new Set((g.lastMove?.claimed || []).map(([row, col]) => `${row},${col}`));

    for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) {
      const owner = g.boxes?.[row]?.[col];
      if (!owner) continue;
      // A box closed by the line still being drawn is shaded only once that line is finished.
      const shade = newBoxes.has(`${row},${col}`) ? Math.max(0, (drawStroke - .7) / .3) : 1;
      if (shade <= 0) continue;
      const bx = pad + col * gap + 12;
      const by = pad + row * gap + 12;
      const size = gap - 24;
      ctx.save();
      ctx.globalAlpha = shade;
      ctx.beginPath(); ctx.rect(bx, by, size, size); ctx.clip();
      if (lineSkin(owner)?.box) { ctx.restore(); ctx.save(); ctx.globalAlpha = shade; lineSkin(owner).box(ctx, bx, by, size, owner, 1); ctx.restore(); continue; }
      ctx.strokeStyle = owner === 'black' ? 'rgba(37,99,235,.38)' : 'rgba(220,38,38,.38)';
      ctx.lineWidth = 3;
      for (let d = -size; d < size * 2; d += 13) { ctx.beginPath(); ctx.moveTo(bx + d, by); ctx.lineTo(bx + d - size, by + size); ctx.stroke(); }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = shade;
      ctx.fillStyle = owner === 'black' ? '#1d4ed8' : '#b91c1c';
      ctx.font = 'italic 950 34px "Segoe Print", "Comic Sans MS", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(owner === 'black' ? 'P' : 'R', pad + (col + .5) * gap, pad + (row + .5) * gap + 12);
      ctx.restore();
    }

    const dotsRecent = observeRecentAction(g.lastMove
      ? `edge:${g.moveCount}:${g.lastMove.at || ''}:${lastEdge}`
      : null);
    for (let edgeId = 0; edgeId < 40; edgeId += 1) {
      const owner = edgeId < 20
        ? g.edges?.h?.[Math.floor(edgeId / 4)]?.[edgeId % 4]
        : g.edges?.v?.[Math.floor((edgeId - 20) / 5)]?.[(edgeId - 20) % 5];
      let [x1,y1,x2,y2] = dotsEdgeEndpoints(edgeId);
      if (!owner) {
        // Faint pencil guide for an undrawn line.
        ctx.save();
        ctx.strokeStyle = 'rgba(71,85,105,.18)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 7]);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.restore();
        continue;
      }
      if (edgeId === lastEdge && drawStroke < 1) {
        const t = easeOutCubic(drawStroke);
        x2 = x1 + (x2 - x1) * t;
        y2 = y1 + (y2 - y1) * t;
      }
      if (lineSkin(owner)?.line) {
        ctx.save(); lineSkin(owner).line(ctx, x1, y1, x2, y2, owner); ctx.restore();
        if (edgeId === lastEdge && fxMs && drawStroke >= 1) {
          const [ex1, ey1, ex2, ey2] = dotsEdgeEndpoints(edgeId);
          const fxT = Math.min(1, (dotsMotion * dotsTotal - 380) / fxMs);
          if (fxT < 1) { ctx.save(); lineSkin(owner).lineFx(ctx, ex1, ey1, ex2, ey2, owner, fxT); ctx.restore(); }
        }
      } else {
      // Marker ink: a solid core with a slightly darker, uneven edge.
      ctx.lineCap = 'round';
      ctx.strokeStyle = owner === 'black' ? '#1e40af' : '#b91c1c';
      ctx.lineWidth = edgeId === lastEdge ? 14 : 11;
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      ctx.strokeStyle = owner === 'black' ? 'rgba(96,165,250,.55)' : 'rgba(252,165,165,.55)';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x1,y1 - 1.5); ctx.lineTo(x2,y2 - 1.5); ctx.stroke();
      }
      if (edgeId === lastEdge && drawStroke >= 1) {
        // Amber recent-move trace (white vanished on the paper page).
        ctx.strokeStyle = `rgba(250,204,21,${0.8 + dotsRecent.strength * 0.2})`;
        ctx.lineWidth = 3 + dotsRecent.strength * 3;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        scheduleRecentActionCanvas(dotsRecent);
      }
    }

    const dotsElapsed = dotsMotion * dotsTotal;
    if (dotsSpecialMs) {
      const t = (dotsElapsed - 380 - fxMs) / dotsSpecialMs;
      if (t > 0 && t < 1) { ctx.save(); dotsSpecialSkin.special(ctx, claimedNow.map(boxRect), t, lastOwner); ctx.restore(); }
    }
    if (dotsWinMs) {
      const t = (dotsElapsed - dotsTotal + dotsWinMs) / dotsWinMs;
      const mine = [];
      for (let row = 0; row < 4; row += 1) for (let col = 0; col < 4; col += 1) if (g.boxes?.[row]?.[col] === g.winner) mine.push(boxRect([row, col]));
      if (t > 0 && t < 1) { ctx.save(); dotsWinSkin.win(ctx, mine, t, g.winner, { w: 720, h: 720 }); ctx.restore(); }
    }

    if (boardTurnActionable()) {
      // The server's legalEdges list: exactly the lines that are still undrawn.
      ctx.save();
      ctx.strokeStyle = `rgba(${ACTIONABLE_RGB},.62)`;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.setLineDash([10, 8]);
      for (const edgeId of state.game.legalEdges || []) {
        const [x1,y1,x2,y2] = dotsEdgeEndpoints(edgeId);
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
      }
      ctx.restore();
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
      // A pressed pencil dot: graphite with a faint smudge.
      ctx.fillStyle = theme ? theme.dot[0] : 'rgba(55,65,81,.18)';
      ctx.beginPath(); ctx.arc(x + 1, y + 1, 11, 0, Math.PI * 2); ctx.fill();
      const lead = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 9);
      lead.addColorStop(0, theme ? theme.dot[1] : '#6b7280');
      lead.addColorStop(1, theme ? theme.dot[1] : '#1f2937');
      ctx.fillStyle = lead;
      ctx.beginPath(); ctx.arc(x, y, 8.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // v1.6.37: the board display is 7 rows x 11 columns (was 7x7), but the 24 real game tiles,
  // their index order and movement logic are unchanged -- only these drawing coordinates moved.
  // Rows (left/right sides) keep the original 7-position spacing untouched. Columns (top/bottom
  // sides) grew from 7 to 11 positions; the 5 non-corner tiles per side are spread across the
  // now-wider row at every other column. The 4 leftover columns per side get no invented tile --
  // drawCityBoard() paints a continuous path strip behind the whole row instead, so those gaps
  // read as the walking path continuing rather than a break in it.
  const CITY_CANVAS_W = 980;
  const CITY_CANVAS_H = 720;
  const CITY_PAD_X = 70;
  const CITY_PAD_Y = 87;
  const CITY_STEP_X = 84;
  const CITY_STEP_Y = 91;
  const CITY_TOP_COLS = [0, 1, 3, 5, 7, 9, 10];
  const CITY_BOTTOM_COLS = [10, 9, 7, 5, 3, 1, 0];

  function cityCellPosition(index) {
    if (index <= 6) return [CITY_PAD_X + CITY_TOP_COLS[index] * CITY_STEP_X, CITY_PAD_Y];
    if (index <= 12) return [CITY_PAD_X + 10 * CITY_STEP_X, CITY_PAD_Y + (index - 6) * CITY_STEP_Y];
    if (index <= 18) return [CITY_PAD_X + CITY_BOTTOM_COLS[index - 12] * CITY_STEP_X, CITY_PAD_Y + 6 * CITY_STEP_Y];
    return [CITY_PAD_X, CITY_PAD_Y + (24 - index) * CITY_STEP_Y];
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
    cityTileDetailsToggle.open = true;
    renderCityControls();
    drawCityBoard();
  }

  function drawCityBoard() {
    const g = state.game;
    const cityRecent = observeRecentAction(g.lastRoll
      ? `roll:${g.lastRoll.at || ''}:${g.lastRoll.seat}:${g.lastRoll.from}:${g.lastRoll.to}`
      : null);
    if (canvas.width !== CITY_CANVAS_W || canvas.height !== CITY_CANVAS_H) {
      canvas.width = CITY_CANVAS_W;
      canvas.height = CITY_CANVAS_H;
    }
    // v1.7.11 실물감: a printed cardboard board game -- cream board on a green table, asphalt road.
    ctx.drawImage(boardTexture('city-board', CITY_CANVAS_W, CITY_CANVAS_H, paintCityBoard), 0, 0);
    // v1.6.56: #cityActionPanel (start/roll/buy/build controls) moved off the board into the
    // sidebar's #gameActionsPanel, so this interior space is no longer a DOM overlay -- restored to
    // a canvas-drawn status readout (turn/phase + last roll), reusing #cityTurnSummary/#cityLastRoll's
    // own already-computed text (renderCityControls() always runs immediately before this in every
    // render path, see its call sites) rather than recomputing the same turn/phase logic twice.
    const cityCenterX = CITY_PAD_X + 5 * CITY_STEP_X;
    const cityCenterY = CITY_PAD_Y + 3 * CITY_STEP_Y;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Printed logo banner in the middle of the board, then the live turn readout under it.
    ctx.save();
    ctx.translate(cityCenterX, cityCenterY - 34);
    ctx.rotate(-.06);
    ctx.fillStyle = '#b91c1c';
    ctx.shadowColor = 'rgba(60,20,0,.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillRect(-150, -26, 300, 52);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 3;
    ctx.strokeRect(-144, -20, 288, 40);
    ctx.fillStyle = '#fff7e0';
    ctx.font = '950 30px Inter, Pretendard, sans-serif';
    ctx.fillText('랜드킹', 0, 1);
    ctx.restore();
    ctx.fillStyle = '#1f2937';
    ctx.font = '800 15px Inter, Pretendard, sans-serif';
    ctx.fillText(cityTurnSummary.textContent, cityCenterX, cityCenterY + 18);
    ctx.fillStyle = '#4b5563';
    ctx.font = '700 13px Inter, Pretendard, sans-serif';
    ctx.fillText(cityLastRoll.textContent, cityCenterX, cityCenterY + 42);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    const CITY_TYPE_BG = { start: '#bbf7d0', property: '#dbeafe', event: '#fef3c7', tax: '#fee2e2', rest: '#e2e8f0' };
    const CITY_TYPE_ICON = { start: '🚩', property: '🏙️', event: '🎁', tax: '💰', rest: '☕' };
    const CITY_PLAYER_COLORS = { '1': '#2563eb', '2': '#ef4444', '3': '#16a34a', '4': '#9333ea' };
    // A continuous walking-path strip along the top/bottom rows, drawn *behind* the tiles: each
    // tile's own box covers the strip within its footprint, so only the gaps between tiles show
    // it -- reading as one connected road through the 4 decorative filler positions per row
    // instead of isolated blank patches.
    ctx.lineCap = 'butt';
    for (const roadY of [CITY_PAD_Y, CITY_PAD_Y + 6 * CITY_STEP_Y]) {
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 26;
      ctx.beginPath(); ctx.moveTo(CITY_PAD_X, roadY); ctx.lineTo(CITY_PAD_X + 10 * CITY_STEP_X, roadY); ctx.stroke();
      ctx.save();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([14, 12]);
      ctx.beginPath(); ctx.moveTo(CITY_PAD_X, roadY); ctx.lineTo(CITY_PAD_X + 10 * CITY_STEP_X, roadY); ctx.stroke();
      ctx.restore();
    }
    ctx.lineCap = 'round';
    // v1.6.82: while I must liquidate, the tiles I own are the ones I can pick to sell.
    const cityLiquidating = actionWindowOpen(g) && g.phase === 'liquidate' && g.liquidating === seat;
    for (const tile of g.tiles || []) {
      const [x, y] = cityCellPosition(tile.index);
      const owner = g.owners?.[tile.index];
      // Printed cardboard square: a soft drop shadow, the type colour, a thin inner print line.
      ctx.save();
      ctx.shadowColor = 'rgba(40,30,10,.35)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = CITY_TYPE_BG[tile.type] || '#e2e8f0';
      ctx.fillRect(x - 39, y - 39, 78, 78);
      ctx.restore();
      ctx.strokeStyle = 'rgba(31,41,55,.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 35.5, y - 35.5, 71, 71);
      // Ownership stripe: a solid color band across the top of the tile in the owner's color,
      // in addition to the border, so ownership reads clearly even at a glance.
      if (owner) {
        ctx.fillStyle = CITY_PLAYER_COLORS[owner] || '#475569';
        ctx.fillRect(x - 39, y - 39, 78, 8);
      }
      ctx.strokeStyle = owner ? (CITY_PLAYER_COLORS[owner] || '#475569') : '#475569';
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
      if (cityLiquidating && tile.type === 'property' && owner === seat) drawActionableMark(x, y, 36, { square: true, dashed: true, rgb: '5,150,105', width: 3 });
      if (g.lastRoll?.to === tile.index) drawRecentActionRing(x, y, 46, cityRecent, { square: true });
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(CITY_TYPE_ICON[tile.type] || '📍', x, y - 24);
      ctx.fillStyle = '#172033';
      ctx.font = '900 12px system-ui, sans-serif';
      const words = String(tile.name).length > 4 ? [String(tile.name).slice(0, 4), String(tile.name).slice(4)] : [String(tile.name)];
      words.forEach((word, i) => ctx.fillText(word, x, y - 6 + i * 15));
      if (tile.type === 'property') {
        ctx.font = '750 10px system-ui, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText(`${tile.price} / ${g.tolls?.[tile.index] ?? tile.toll}`, x, y + 27);
        if (owner) {
          const level = Math.max(0, Math.min(3, Number(g.developments?.[tile.index]) || 0));
          // Plastic pieces on the tile instead of emoji: green houses (별장 1, 빌딩 2), a red hotel (3).
          drawCityBuildings(x - 22, y - 26, level);
          ctx.fillStyle = '#1d4ed8';
          ctx.font = '900 9px system-ui, sans-serif';
          ctx.fillText(`${['도시', '별장', '빌딩', '호텔'][level]} ${level}단계`, x + 8, y - 29);
        }
      }
    }
    const CITY_TOKEN_OFFSETS = [[-16, -22], [16, -22], [-16, -4], [16, -4]];
    (g.seatOrder || []).forEach((color, tokenIndex) => {
      const player = g.players?.[color];
      if (!player) return;
      const animatedPosition = cityAnimation?.seat === color ? cityAnimation.position : player.position;
      const [x, y] = cityCellPosition(animatedPosition);
      const [ox, oy] = CITY_TOKEN_OFFSETS[tokenIndex % 4];
      const isTurn = g.status === 'playing' && g.turn === color;
      if (isTurn) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x + ox, y + oy, 13, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = player.eliminated ? 0.35 : 1;
      const initial = (state.players?.[color]?.label || `${color}번`)[0] || color;
      drawCityPawn(x + ox, y + oy, CITY_PLAYER_COLORS[color] || '#64748b', initial);
      ctx.globalAlpha = 1;
    });
    // Per-seat cash is already shown clearly in the .cityAssetCard list below the board; the
    // board itself only needs the tiles and tokens, so it doesn't duplicate (and collide with)
    // that text here.
  }

  // Connect Four uses a 7x6 gravity board, independent of the Omok and Othello geometry.
  function connect4Layout() {
    const cell = (canvas.width - 40) / 7;
    return { cell, left: (canvas.width - cell * 7) / 2, top: 103 };
  }

  // v1.7.9 강한 실물감: the newest piece moves like a real one (a stone set down, a disc flipped, a
  // disc falling behind the Connect Four grid). Keyed like the recent-action ring; the first snapshot
  // after entering a room is only a baseline, so a refresh or reconnect never replays an old move.
  let pieceMotionKey = null;
  let pieceMotionStart = 0;
  let pieceMotionFrame = null;
  window.PieceMotionDebug = () => pieceMotionKey; // null = nothing seen yet (next move is only a baseline); '' = empty board seen
  function pieceMotion(key, duration) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    // An empty board is a seen state too, so the very first move of a game still animates. Every caller therefore
    // passes an empty key while there is no last move (v1.7.24: they used to skip the call, so the first move seen
    // right after entering a room was taken as the baseline and never animated).
    if (!key) { pieceMotionKey = ''; return 1; }
    if (key !== pieceMotionKey) {
      pieceMotionStart = pieceMotionKey === null ? now - duration : now;
      pieceMotionKey = key;
    }
    if (reducedMotionActive()) return 1;
    const t = Math.min(1, (now - pieceMotionStart) / duration);
    if (t < 1 && !pieceMotionFrame && typeof requestAnimationFrame === 'function') {
      pieceMotionFrame = requestAnimationFrame(() => { pieceMotionFrame = null; if (state) drawBoard(); });
    }
    return t;
  }
  const easeOutCubic = t => 1 - (1 - t) ** 3;
  function easeOutBounce(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + .75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + .9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + .984375;
  }

  // Deterministic pseudo-random so textures never flicker between frames.
  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
  }
  const boardTextureCache = new Map();
  function boardTexture(kind, width, height, paint) {
    const key = `${kind}:${width}x${height}`;
    if (!boardTextureCache.has(key)) {
      const layer = document.createElement('canvas');
      layer.width = width;
      layer.height = height;
      paint(layer.getContext('2d'), width, height);
      boardTextureCache.set(key, layer);
    }
    return boardTextureCache.get(key);
  }

  // Kaya go board: warm straight-grain wood, darker growth lines, a bevelled rim.
  function paintKayaWood(c, w, h) {
    const base = c.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, '#eccb8c');
    base.addColorStop(.5, '#dfb772');
    base.addColorStop(1, '#d1a45a');
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    const rand = seededRandom(1979);
    for (let i = 0; i < 90; i += 1) {
      const y = rand() * h;
      const wave = 2 + rand() * 6;
      c.strokeStyle = `rgba(${rand() < .5 ? '120,78,32' : '160,108,48'},${.05 + rand() * .1})`;
      c.lineWidth = .6 + rand() * 1.8;
      c.beginPath();
      c.moveTo(0, y);
      for (let x = 0; x <= w; x += 40) c.lineTo(x, y + Math.sin((x / w) * Math.PI * (1 + rand())) * wave);
      c.stroke();
    }
    const light = c.createRadialGradient(w * .3, h * .25, w * .05, w * .5, h * .5, w * .75);
    light.addColorStop(0, 'rgba(255,245,220,.22)');
    light.addColorStop(1, 'rgba(90,55,20,.18)');
    c.fillStyle = light;
    c.fillRect(0, 0, w, h);
    const rim = 14;
    for (const [x, y, rw, rh, dir] of [[0, 0, w, rim, 'top'], [0, h - rim, w, rim, 'bottom'], [0, 0, rim, h, 'left'], [w - rim, 0, rim, h, 'right']]) {
      const g = dir === 'top' || dir === 'bottom' ? c.createLinearGradient(0, y, 0, y + rh) : c.createLinearGradient(x, 0, x + rw, 0);
      const outer = dir === 'top' || dir === 'left' ? 'rgba(255,240,210,.35)' : 'rgba(70,40,10,.4)';
      g.addColorStop(dir === 'top' || dir === 'left' ? 0 : 1, outer);
      g.addColorStop(dir === 'top' || dir === 'left' ? 1 : 0, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(x, y, rw, rh);
    }
  }

  // Othello board: green baize with a fine nap and a darker edge.
  function paintBaize(c, w, h) {
    c.fillStyle = '#1b7446';
    c.fillRect(0, 0, w, h);
    const rand = seededRandom(1971);
    for (let i = 0; i < 9000; i += 1) {
      c.fillStyle = rand() < .5 ? `rgba(0,40,20,${rand() * .16})` : `rgba(140,220,170,${rand() * .07})`;
      c.fillRect(rand() * w, rand() * h, 1.4, 1.4);
    }
    const vignette = c.createRadialGradient(w / 2, h / 2, w * .3, w / 2, h / 2, w * .75);
    vignette.addColorStop(0, 'rgba(255,255,255,.04)');
    vignette.addColorStop(1, 'rgba(0,20,10,.35)');
    c.fillStyle = vignette;
    c.fillRect(0, 0, w, h);
  }

  // Yut: a woven straw mat with a hanji sheet laid on it (the board lines are inked over it later).
  function paintYutMat(c, w, h) {
    c.fillStyle = '#b8914f';
    c.fillRect(0, 0, w, h);
    const rand = seededRandom(1592);
    for (let y = 0; y < h; y += 6) {
      for (let x = (y / 6) % 2 ? 0 : 12; x < w; x += 24) {
        c.fillStyle = `rgba(${rand() < .5 ? '120,86,36' : '214,178,110'},${.25 + rand() * .3})`;
        c.fillRect(x, y, 12, 5);
      }
    }
    const inset = 26;
    c.save();
    c.shadowColor = 'rgba(40,24,6,.45)';
    c.shadowBlur = 14;
    c.shadowOffsetY = 5;
    const paper = c.createLinearGradient(inset, inset, w - inset, h - inset);
    paper.addColorStop(0, '#f8efd8');
    paper.addColorStop(1, '#eadbb4');
    c.fillStyle = paper;
    c.fillRect(inset, inset, w - inset * 2, h - inset * 2 - 40);
    c.restore();
    for (let i = 0; i < 1800; i += 1) {
      c.fillStyle = `rgba(150,120,70,${rand() * .12})`;
      c.fillRect(inset + rand() * (w - inset * 2), inset + rand() * (h - inset * 2 - 40), 2 + rand() * 6, .8);
    }
  }

  // A lacquered wooden 말: coloured face, darker rim, a highlight and a carved number.
  function drawYutToken(x, y, fill, label, color) {
    ctx.save();
    const nativeSkin = state?.players?.[color]?.skin;
    if (window.SkinLooks.def(nativeSkin)?.shape === 'character') {
      ctx.translate(x, y); window.SkinLooks.paintStone(ctx, 19, nativeSkin, color, label); ctx.restore(); return;
    }
    ctx.fillStyle = 'rgba(30,16,4,.35)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 4, 19, 17, 0, 0, Math.PI * 2); ctx.fill();
    const skinId = state?.players?.[color]?.skin;
    if (window.SkinLooks.def(skinId)?.stone) { // a piece skin draws the whole figure, number plate included
      ctx.translate(x, y); window.SkinLooks.paintStone(ctx, 19, skinId, color, label); ctx.restore(); return;
    }
    const body = ctx.createRadialGradient(x - 6, y - 7, 2, x, y, 19);
    body.addColorStop(0, fill === '#2563eb' ? '#93c5fd' : '#fca5a5');
    body.addColorStop(.5, fill);
    body.addColorStop(1, fill === '#2563eb' ? '#1e3a8a' : '#7f1d1d');
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,200,.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff7e0';
    ctx.font = '950 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label, x, y + 5);
    ctx.restore();
  }

  // Land King: a cream printed board on a green table, with a thin printed border.
  function paintCityBoard(c, w, h) {
    c.fillStyle = '#1f5f3f';
    c.fillRect(0, 0, w, h);
    const rand = seededRandom(1935);
    for (let i = 0; i < 6000; i += 1) {
      c.fillStyle = `rgba(0,30,15,${rand() * .15})`;
      c.fillRect(rand() * w, rand() * h, 1.5, 1.5);
    }
    c.save();
    c.shadowColor = 'rgba(0,0,0,.45)';
    c.shadowBlur = 18;
    c.shadowOffsetY = 6;
    c.fillStyle = '#f4ecd6';
    c.fillRect(14, 14, w - 28, h - 28);
    c.restore();
    for (let i = 0; i < 3000; i += 1) {
      c.fillStyle = `rgba(140,110,60,${rand() * .07})`;
      c.fillRect(14 + rand() * (w - 28), 14 + rand() * (h - 28), 2, 1);
    }
    c.strokeStyle = 'rgba(120,53,15,.55)';
    c.lineWidth = 3;
    c.strokeRect(24, 24, w - 48, h - 48);
  }

  // Plastic house (green) / hotel (red) pieces standing on a Land King tile.
  function drawCityBuildings(x, y, level) {
    const piece = (px, py, width, height, color) => {
      ctx.fillStyle = color;
      ctx.strokeStyle = 'rgba(0,0,0,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, py + height); ctx.lineTo(px, py + height * .45); ctx.lineTo(px + width / 2, py);
      ctx.lineTo(px + width, py + height * .45); ctx.lineTo(px + width, py + height); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      ctx.fillRect(px + 1, py + height * .5, width * .3, height * .45);
    };
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetY = 1;
    if (level >= 3) piece(x - 4, y - 7, 18, 14, '#dc2626');
    else for (let i = 0; i < level; i += 1) piece(x - 4 + i * 11, y - 5, 9, 11, '#16a34a');
    ctx.restore();
  }

  // A turned wooden pawn seen from above-front: shadow, cone body, round head, player initial.
  function drawCityPawn(x, y, color, initial) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(x + 1, y + 10, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
    const body = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
    body.addColorStop(0, color);
    body.addColorStop(.4, 'rgba(255,255,255,.55)');
    body.addColorStop(.55, color);
    body.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x - 9, y + 10); ctx.lineTo(x - 4, y - 2); ctx.lineTo(x + 4, y - 2); ctx.lineTo(x + 9, y + 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = body;
    ctx.globalAlpha *= .6;
    ctx.fill();
    ctx.globalAlpha /= .6;
    const head = ctx.createRadialGradient(x - 2, y - 9, 1, x, y - 6, 8);
    head.addColorStop(0, '#ffffff');
    head.addColorStop(.35, color);
    head.addColorStop(1, 'rgba(0,0,0,.6)');
    ctx.fillStyle = head;
    ctx.beginPath(); ctx.arc(x, y - 6, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '950 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial, x, y - 5.5);
    ctx.restore();
  }

  // Dots and Boxes: a ruled notebook page, like the pencil-and-paper game.
  function paintNotebook(c, w, h) {
    c.fillStyle = '#fbf8ef';
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(96,165,250,.35)';
    c.lineWidth = 1;
    for (let y = 30; y < h; y += 30) { c.beginPath(); c.moveTo(0, y + .5); c.lineTo(w, y + .5); c.stroke(); }
    c.strokeStyle = 'rgba(239,68,68,.45)';
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(46.5, 0); c.lineTo(46.5, h); c.stroke();
    const rand = seededRandom(1889);
    for (let i = 0; i < 2500; i += 1) {
      c.fillStyle = `rgba(120,110,90,${rand() * .05})`;
      c.fillRect(rand() * w, rand() * h, 1.2, 1.2);
    }
  }

  function drawConnect4Board() {
    const w = canvas.width;
    const h = canvas.height;
    const { cell, left, top } = connect4Layout();
    const g = state.game;
    // v1.7.36: the host's room theme paints the table behind the frame and tints the frame itself.
    const theme = window.SkinLooks.def(state.skinTheme)?.board;
    if (theme) ctx.drawImage(boardTexture(`c4:${state.skinTheme}`, w, h, (c, tw, th) => theme.paint(c, tw, th)), 0, 0);
    else {
      const surface = ctx.createLinearGradient(0, 0, 0, h);
      surface.addColorStop(0, '#15233d');
      surface.addColorStop(1, '#070f1f');
      ctx.fillStyle = surface;
      ctx.fillRect(0, 0, w, h);
    }
    const radius = cell * .40;
    const gridW = cell * 7;
    const gridH = cell * 6;

    // Behind the grid: the dark slot, then the discs (so the plastic frame overlaps their rims).
    ctx.fillStyle = theme?.slot || '#0a1830';
    ctx.fillRect(left, top, gridW, gridH);
    const last = g.lastMove;
    const winners = new Set((g.winningLine || []).map(([x, y]) => `${x},${y}`));
    const connectRecent = observeRecentAction(last ? `drop:${g.moveCount}:${last.at || ''}:${last.x}:${last.y}` : null);
    // A chip skin may add a landing effect (premium/legend) and a win effect (legend) after the fall.
    const fallMs = 260 + 70 * (last?.y ?? 0);
    const colorSkin = (color) => window.SkinLooks.def(state.players?.[color]?.skin);
    const lastColor = last ? g.board[last.y]?.[last.x] : null;
    const lastSkin = lastColor ? colorSkin(lastColor) : null;
    const winFirst = g.winningLine?.[0];
    const winColor = winFirst ? g.board[winFirst[1]]?.[winFirst[0]] : null;
    const winSkin = winColor ? colorSkin(winColor) : null;
    // v1.9.0: a legend also marks exactly three in a row (the move that threatens four) along those chips.
    const threePts = !winFirst && lastSkin?.special && lastColor
      ? exactLine(g.board, last.x, last.y, lastColor, 3, (x, y) => ({ x: left + (x + .5) * cell, y: top + (y + .5) * cell })) : null;
    const extraMs = winSkin?.win ? 2200 : threePts ? 1300 : lastSkin?.fx ? 700 : 0;
    const motionT = pieceMotion(last ? `c4:${g.moveCount}:${last.at || ''}` : '', fallMs + extraMs);
    const fall = Math.min(1, motionT * (fallMs + extraMs) / fallMs);
    const drawDisc = (cx, cy, color) => {
      ctx.save();
      if (colorSkin(color)?.stone) { // a skin draws the whole chip (it is clipped by the frame's round holes anyway)
        ctx.translate(cx, cy); window.SkinLooks.paintStone(ctx, radius + 3, state.players[color].skin, color); ctx.restore(); return;
      }
      const disc = ctx.createRadialGradient(cx - radius * .35, cy - radius * .38, 2, cx, cy, radius);
      if (color === 'black') { disc.addColorStop(0, '#ff9aa6'); disc.addColorStop(.45, '#e11d48'); disc.addColorStop(1, '#881337'); }
      else { disc.addColorStop(0, '#fff6b8'); disc.addColorStop(.48, '#facc15'); disc.addColorStop(1, '#b7791f'); }
      ctx.fillStyle = disc;
      ctx.beginPath(); ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2); ctx.fill();
      // Moulded ring on the face, like the real plastic checkers.
      ctx.strokeStyle = color === 'black' ? 'rgba(80,0,20,.45)' : 'rgba(120,80,0,.4)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, radius * .62, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    };
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 7; x++) {
        const color = g.board[y][x];
        if (!color) continue;
        const cx = left + (x + .5) * cell;
        let cy = top + (y + .5) * cell;
        if (last?.x === x && last?.y === y && fall < 1) {
          const from = top - cell * .9;
          cy = from + (cy - from) * easeOutBounce(fall);
        }
        drawDisc(cx, cy, color);
      }
    }

    // The blue plastic frame with round holes, drawn over the discs.
    ctx.save();
    ctx.beginPath();
    ctx.rect(left - 14, top - 14, gridW + 28, gridH + 28);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) {
      const cx = left + (x + .5) * cell;
      const cy = top + (y + .5) * cell;
      ctx.moveTo(cx + radius, cy);
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    }
    const plastic = ctx.createLinearGradient(left, top - 14, left + gridW, top + gridH + 14);
    const plasticStops = theme?.plastic || ['#3b82f6', '#1d4ed8', '#1e3a8a'];
    plastic.addColorStop(0, plasticStops[0]);
    plastic.addColorStop(.5, plasticStops[1]);
    plastic.addColorStop(1, plasticStops[2]);
    ctx.fillStyle = plastic;
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fill('evenodd');
    ctx.restore();
    ctx.save();
    for (let y = 0; y < 6; y++) for (let x = 0; x < 7; x++) {
      const cx = left + (x + .5) * cell;
      const cy = top + (y + .5) * cell;
      // Inner bevel of each hole: light top-left, shadow bottom-right.
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(15,23,60,.55)';
      ctx.beginPath(); ctx.arc(cx, cy, radius - 1, Math.PI * .1, Math.PI * 1.1); ctx.stroke();
      ctx.strokeStyle = 'rgba(147,197,253,.55)';
      ctx.beginPath(); ctx.arc(cx, cy, radius - 1, Math.PI * 1.1, Math.PI * 2.1); ctx.stroke();
    }
    const gloss = ctx.createLinearGradient(0, top - 14, 0, top + gridH * .45);
    gloss.addColorStop(0, 'rgba(255,255,255,.18)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(left - 14, top - 14, gridW + 28, 18);
    // Feet of the stand.
    ctx.fillStyle = theme?.feet || '#1e3a8a';
    for (const fx of [left - 30, left + gridW + 2]) {
      ctx.beginPath();
      ctx.moveTo(fx, top + gridH + 14); ctx.lineTo(fx + 28, top + gridH + 14);
      ctx.lineTo(fx + 40, h - 6); ctx.lineTo(fx - 12, h - 6); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 7; x++) {
        if (!g.board[y][x]) continue;
        const cx = left + (x + .5) * cell;
        const cy = top + (y + .5) * cell;
        const isLast = last?.x === x && last?.y === y;
        if (isLast && fall < 1) continue;
        if (winners.has(`${x},${y}`) && !colorSkin(g.board[y][x])?.legend) { // a legend keeps its own look and win
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(cx, cy, radius * .77, 0, Math.PI * 2); ctx.stroke();
        } else if (isLast) {
          ctx.fillStyle = g.board[y][x] === 'black' ? '#ffffff' : '#6b3e03';
          ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
        }
        if (isLast) drawRecentActionRing(cx, cy, radius * .9, connectRecent);
      }
    }

    theme?.overlay?.(ctx, { left, top, gridW, gridH });
    if (lastSkin?.fx && fall >= 1 && motionT * (fallMs + extraMs) < fallMs + 700) {
      ctx.save(); ctx.translate(left + (last.x + .5) * cell, top + (last.y + .5) * cell);
      lastSkin.fx(ctx, radius, Math.min(1, (motionT * (fallMs + extraMs) - fallMs) / 700), lastColor); ctx.restore();
    }
    if (threePts && fall >= 1 && motionT < 1) {
      ctx.save(); lastSkin.special(ctx, threePts, radius, Math.min(1, (motionT * (fallMs + extraMs) - fallMs) / 1300), lastColor); ctx.restore();
    }
    if (winSkin?.win) {
      const pts = g.winningLine.map(([x, y]) => ({ x: left + (x + .5) * cell, y: top + (y + .5) * cell }));
      ctx.save(); winSkin.win(ctx, pts, radius, motionT, winColor); ctx.restore();
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
      ctx.fillText(String(x + 1), cx, top - 30);
    }
    if (boardTurnActionable()) {
      // Legal columns come from the server; the ring sits where the disc would land.
      for (const x of g.legalColumns || []) {
        let landing = 5;
        while (landing >= 0 && g.board[landing][x]) landing--;
        if (landing < 0) continue;
        drawActionableMark(left + (x + .5) * cell, top + (landing + .5) * cell, cell * .42, { dashed: true, width: 3 });
      }
    }
    if (hover && canPlace(hover.x, hover.y)) {
      const x = hover.x;
      const cx = left + (x + .5) * cell;
      let landing = 5;
      while (landing >= 0 && g.board[landing][x]) landing--;
      ctx.save();
      ctx.fillStyle = seat === 'black' ? 'rgba(244,63,94,.85)' : 'rgba(250,204,21,.88)';
      ctx.beginPath(); ctx.arc(cx, top - 58, cell * .3, 0, Math.PI * 2); ctx.fill();
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
    // v1.7.35: the host's room theme (shared in the room state) replaces the wood board; without one, the classic kaya.
    const theme = window.SkinLooks.def(state?.skinTheme)?.board;
    ctx.drawImage(theme ? boardTexture(`omok:${state.skinTheme}`, w, h, (c, tw, th) => theme.paint(c, tw, th, PAD)) : boardTexture('kaya', w, h, paintKayaWood), 0, 0);

    ctx.strokeStyle = theme ? theme.line : 'rgba(50,30,10,.82)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < SIZE; i++) {
      const p = PAD + i * GRID;
      ctx.beginPath(); ctx.moveTo(PAD, p); ctx.lineTo(w - PAD, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, PAD); ctx.lineTo(p, h - PAD); ctx.stroke();
    }
    ctx.lineWidth = 2.4;
    ctx.strokeRect(PAD, PAD, w - PAD * 2, h - PAD * 2);
    ctx.fillStyle = theme ? theme.star : '#3b2610';
    for (const [x, y] of [[3,3],[11,3],[7,7],[3,11],[11,11]]) {
      ctx.beginPath(); ctx.arc(PAD + x * GRID, PAD + y * GRID, 5, 0, Math.PI * 2); ctx.fill();
    }

    if (!state) return;
    const winning = new Set((state.game.winningLine || []).map(([x, y]) => `${x},${y}`));
    const last = state.game.lastMove;
    const omokRecent = observeRecentAction(last ? `place:${state.game.moveCount}:${last.at || ''}:${last.x}:${last.y}` : null);
    // A skin may add a short effect where the last stone landed (premium/legend) and a win effect (legend): the
    // motion then runs longer, and the stone itself still settles in the usual 300 ms.
    const lastColor = last ? state.game.board[last.y]?.[last.x] : null;
    const lastSkin = last && lastColor ? window.SkinLooks.def(stoneSkin(last.x, last.y, lastColor)) : null;
    const winPts = (state.game.winningLine || []).map(([x, y]) => ({ x: PAD + x * GRID, y: PAD + y * GRID }));
    const winFirst = state.game.winningLine?.[0];
    const winColor = winFirst ? state.game.board[winFirst[1]]?.[winFirst[0]] : null;
    const winSkin = winFirst && winColor ? window.SkinLooks.def(stoneSkin(winFirst[0], winFirst[1], winColor)) : null;
    // v1.8.7: a legend also marks four in a row (the move that threatens five) with its own effect along those stones.
    const fourPts = !winFirst && lastSkin?.special && lastColor ? omokFourLine(last.x, last.y, lastColor) : null;
    const motionMs = winSkin?.win ? 2400 : fourPts ? 1300 : lastSkin?.fx ? 900 : 300;
    const motionT = pieceMotion(last ? `omok:${state.game.moveCount}:${last.at || ''}` : '', motionMs);
    const setDown = Math.min(1, motionT * motionMs / 300);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const color = state.game.board[y][x];
        const isLast = last?.x === x && last?.y === y;
        if (color) drawStone(x, y, color, winning.has(`${x},${y}`), isLast, isLast ? setDown : 1);
      }
    }
    if (boardTurnActionable()) {
      // Same criterion as canPlace(): an empty intersection. Black's renju-forbidden points are not
      // pre-marked -- the server alone judges them on placement, exactly as before this marker.
      for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
        if (!state.game.board[y][x]) drawActionableMark(PAD + x * GRID, PAD + y * GRID, 3, { rgb: '15,118,110', alpha: .62, fill: true });
      }
    }
    if (lastSkin?.fx && setDown >= 1 && motionT * motionMs < 900) {
      ctx.save(); ctx.translate(PAD + last.x * GRID, PAD + last.y * GRID);
      lastSkin.fx(ctx, GRID * .44, Math.min(1, (motionT * motionMs - 300) / 600), lastColor); ctx.restore();
    }
    if (fourPts && setDown >= 1 && motionT < 1) { ctx.save(); lastSkin.special(ctx, fourPts, GRID * .44, motionT, lastColor); ctx.restore(); }
    if (winSkin?.win) { ctx.save(); winSkin.win(ctx, winPts, GRID * .44, motionT, winColor); ctx.restore(); }
    if (last && setDown >= 1) drawRecentActionRing(PAD + last.x * GRID, PAD + last.y * GRID, GRID * .43, omokRecent);
    if (hover && canPlace(hover.x, hover.y)) drawGhost(hover.x, hover.y, seatColor(seat));
  }

  // A two-sided disc: the face colour on top and a sliver of the other side at the rim.
  // A flipping disc turns over on an ease-out curve: it is edge-on (thinnest) when the turn is half done, and that is
  // the moment the face colour has to change. v1.7.25: it used to change at half of the *time*, when the disc had
  // already opened up again, so a nearly full-size disc visibly changed colour. flip: 0..1, color: the final colour.
  function othelloFlipPose(flip, color) {
    const angle = flip < 1 ? Math.PI * easeOutCubic(flip) : Math.PI;
    const squash = Math.max(.06, Math.abs(Math.cos(angle)));
    const face = angle < Math.PI / 2 ? (color === 'black' ? 'white' : 'black') : color;
    return { angle, squash, face };
  }
  window.OthelloFlipPose = othelloFlipPose; // for the browser tests (pure function)

  function drawOthelloDisc(x, y, color, last, { flip = 1, drop = 1 } = {}) {
    const cell = canvas.width / 8;
    const cx = (x + .5) * cell;
    const cy = (y + .5) * cell;
    const r = cell * .38;
    const { angle, squash, face } = othelloFlipPose(flip, color);
    const skinId = state?.players?.[face]?.skin; // the face showing right now decides whose skin is drawn
    const lift = (flip < 1 ? Math.sin(angle) * cell * .12 : 0) + (1 - easeOutCubic(drop)) * cell * .3;
    const scale = 1 + (1 - easeOutCubic(drop)) * .25;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath(); ctx.ellipse(cx + 2, cy + 4, r * squash * scale, r * scale * .96, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(cx, cy - lift);
    ctx.scale(squash * scale, scale);
    ctx.fillStyle = face === 'black' ? '#e8e8e8' : '#1a1a1a';
    ctx.beginPath(); ctx.arc(0, 3, r, 0, Math.PI * 2); ctx.fill();
    if (window.SkinLooks.def(skinId)?.stone) window.SkinLooks.paintStone(ctx, r, skinId, face);
    else {
      const gradient = ctx.createRadialGradient(-r * .3, -r * .35, r * .08, 0, 0, r);
      if (face === 'black') { gradient.addColorStop(0, '#5a5a5a'); gradient.addColorStop(.45, '#1c1c1c'); gradient.addColorStop(1, '#030303'); }
      else { gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.6, '#f1f1ee'); gradient.addColorStop(1, '#c4c8cb'); }
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (last && flip >= 1 && drop >= 1) {
      ctx.fillStyle = color === 'black' ? '#f8fafc' : '#ef4444';
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawOthelloBoard() {
    const w = canvas.width;
    const cell = w / 8;
    const theme = window.SkinLooks.def(state?.skinTheme)?.board; // the host's room theme (v1.7.36)
    ctx.drawImage(theme ? boardTexture(`oth:${state.skinTheme}`, w, w, (c, tw, th) => theme.paint(c, tw, th)) : boardTexture('baize', w, w, paintBaize), 0, 0);
    ctx.strokeStyle = theme ? theme.line : 'rgba(3,30,16,.9)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i <= 8; i += 1) {
      const p = i * cell;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, w); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(w, p); ctx.stroke();
    }
    ctx.fillStyle = theme ? theme.dot : 'rgba(3,30,16,.95)';
    for (const [x, y] of [[2, 2], [6, 2], [2, 6], [6, 6]]) {
      ctx.beginPath(); ctx.arc(x * cell, y * cell, 5, 0, Math.PI * 2); ctx.fill();
    }

    // Only the server's legalMoves list for my turn -- never "every empty square".
    if (boardTurnActionable()) {
      for (const { x, y } of state.game.legalMoves || []) {
        drawActionableMark((x + .5) * cell, (y + .5) * cell, cell * .1, { rgb: '167,243,208', alpha: .72, fill: true });
        drawActionableMark((x + .5) * cell, (y + .5) * cell, cell * .3, { rgb: '167,243,208', alpha: .7, width: 2.5 });
      }
    }

    const last = state?.game?.lastMove;
    const othelloRecent = observeRecentAction(last ? `place:${state.game.moveCount}:${last.at || ''}:${last.x}:${last.y}` : null);
    const flippedCells = new Set((last?.flippedCells || []).map(item => `${item.x},${item.y}`));
    // The placed disc lands first, then its captured neighbours turn over one after another.
    const flipCount = flippedCells.size;
    // A disc skin with an effect lets each turned disc flash once it has landed face-up (a wave along the capture).
    const fxSkinOf = (color) => window.SkinLooks.def(state?.players?.[color]?.skin);
    const lastColor = last ? state.game.board[last.y]?.[last.x] : null;
    const hasFx = Boolean(last && fxSkinOf(lastColor)?.fx);
    const baseMs = 260 + 110 * flipCount + 320;
    // v1.9.0 legends: a corner or a flip of five or more plays the mover's `special`; a finished game the winner's `win`.
    const corner = last && (last.x === 0 || last.x === 7) && (last.y === 0 || last.y === 7);
    const specialSkin = last && (corner || flipCount >= 5) ? fxSkinOf(lastColor) : null;
    const specialMs = specialSkin?.special ? 1300 : 0;
    const g = state.game;
    const winSkin = g.status === 'finished' && g.winner ? fxSkinOf(g.winner) : null;
    const winMs = winSkin?.legend && winSkin.win ? 2400 : 0;
    const totalMs = baseMs + (hasFx ? 600 : 0) + specialMs + winMs;
    const motion = pieceMotion(last ? `oth:${state.game.moveCount}:${last.at || ''}` : '', totalMs);
    const elapsedMs = motion * totalMs;
    const flipOrder = [...flippedCells];
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const color = state?.game?.board?.[y]?.[x];
        if (!color) continue;
        const key = `${x},${y}`;
        const isLast = last?.x === x && last?.y === y;
        const order = flipOrder.indexOf(key);
        const drop = isLast ? Math.min(1, elapsedMs / 260) : 1;
        const flip = order >= 0 && elapsedMs < baseMs ? Math.max(0, Math.min(1, (elapsedMs - 200 - order * 110) / 320)) : 1;
        drawOthelloDisc(x, y, color, isLast, { flip, drop });
        const discFx = hasFx && (order >= 0 || isLast) ? fxSkinOf(color)?.fx : null;
        if (discFx) {
          const t = isLast ? (elapsedMs - 260) / 600 : (elapsedMs - 200 - order * 110 - 320) / 600;
          if (t > 0 && t < 1) { ctx.save(); ctx.translate((x + .5) * cell, (y + .5) * cell); discFx(ctx, cell * .38, t, color); ctx.restore(); }
        }
        if (othelloRecent.fresh && flippedCells.has(key) && flip >= 1) {
          drawRecentActionRing((x + .5) * cell, (y + .5) * cell, cell * .34, othelloRecent, { secondary: true });
        }
      }
    }
    if (last && motion >= 1) drawRecentActionRing((last.x + .5) * cell, (last.y + .5) * cell, cell * .43, othelloRecent);
    const centre = (p) => ({ x: (p.x + .5) * cell, y: (p.y + .5) * cell });
    if (specialMs) {
      const t = (elapsedMs - baseMs) / specialMs;
      if (t > 0 && t < 1) { ctx.save(); specialSkin.special(ctx, [centre(last), ...(last.flippedCells || []).map(centre)], cell * .38, t, lastColor); ctx.restore(); }
    }
    if (winMs) {
      const t = (elapsedMs - totalMs + winMs) / winMs;
      const pts = [];
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) if (g.board[y][x] === g.winner) pts.push(centre({ x, y }));
      if (t > 0 && t < 1) { ctx.save(); winSkin.win(ctx, pts, cell * .38, t, { w, h: w }); ctx.restore(); }
    }

    if (hover && canPlace(hover.x, hover.y)) {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 4;
      ctx.strokeRect(hover.x * cell + 5, hover.y * cell + 5, cell - 10, cell - 10);
    }
  }

  // Go stones: slate-black with a soft sheen, clamshell-white with faint growth lines. The newest
  // stone is set down from just above the board (bigger, higher shadow) and settles.
  // The skin of whoever placed the stone at (x, y): the player of that color, or in 2vs2 the seat that played it.
  function stoneSkin(x, y, color) {
    if (!state?.players) return null;
    const seat = state.gameType === 'omok2v2' ? state.game?.stoneSeats?.[`${x},${y}`] : color;
    return state.players[seat]?.skin || null;
  }

  // v1.8.7: the stones of a straight line of exactly four through (x, y), as canvas points -- the cosmetic "four in a
  // row" moment a legend marks. Read from the board the player already sees; it decides nothing.
  // Cells of the line through (x, y) that is exactly `n` long in `color` (rows, columns, both diagonals), mapped by `toPt`.
  function exactLine(board, x, y, color, n, toPt) {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const line = [[x, y]];
      for (const s of [1, -1]) for (let k = 1; k <= n; k += 1) { const nx = x + dx * k * s; const ny = y + dy * k * s; if (board[ny]?.[nx] !== color) break; line.push([nx, ny]); }
      if (line.length === n) return line.sort((p, q) => p[0] - q[0] || p[1] - q[1]).map(([px, py]) => toPt(px, py));
    }
    return null;
  }
  function omokFourLine(x, y, color) {
    const board = state?.game?.board;
    if (!board) return null;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
      const line = [[x, y]];
      for (const s of [1, -1]) for (let k = 1; k < 5; k += 1) { const nx = x + dx * k * s; const ny = y + dy * k * s; if (board[ny]?.[nx] !== color) break; line.push([nx, ny]); }
      if (line.length === 4) return line.sort((p, q) => p[0] - q[0] || p[1] - q[1]).map(([px, py]) => ({ x: PAD + px * GRID, y: PAD + py * GRID }));
    }
    return null;
  }

  function drawStone(x, y, color, winning, last, setDown = 1) {
    const cx = PAD + x * GRID;
    const cy = PAD + y * GRID;
    const r = GRID * .44;
    const rise = 1 - easeOutCubic(setDown);
    const scale = 1 + rise * .3;
    const lift = rise * GRID * .45;
    const board = window.SkinLooks.def(state?.skinTheme)?.board; // v1.8.7: a theme may light the stones for its background
    ctx.save();
    ctx.fillStyle = board?.shadow || `rgba(40,20,0,${.32 - rise * .12})`;
    ctx.beginPath(); ctx.ellipse(cx + 2 + lift * .3, cy + 3 + lift * .2, r * scale * (1 + rise * .15), r * scale * .92, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(cx, cy - lift);
    ctx.scale(scale, scale);
    const skin = stoneSkin(x, y, color);
    const legend = window.SkinLooks.def(skin)?.legend; // a legend keeps its own silhouette: no theme ring, no win ring
    window.SkinLooks.paintStone(ctx, r, skin, color); // no skin = the classic slate and shell
    if (board?.accent && !legend) board.accent(ctx, r, color);
    ctx.restore();
    if (setDown < 1) return;
    if (winning && legend) {
      ctx.fillStyle = '#ffd85a';
      ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    } else if (winning) {
      ctx.strokeStyle = color === 'black' ? '#ffd85a' : '#ef4444';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cx, cy, r * .7, 0, Math.PI * 2); ctx.stroke();
    } else if (last) {
      ctx.fillStyle = color === 'black' ? '#f8fafc' : '#ef4444';
      ctx.beginPath(); ctx.arc(cx, cy, 5.2, 0, Math.PI * 2); ctx.fill();
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

  // Client (CSS) pixels -> the canvas's own drawing coordinates, whatever size it is displayed at.
  function canvasPixel(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      px: (ev.clientX - rect.left) * (canvas.width / rect.width),
      py: (ev.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function canvasPoint(ev) {
    const { px, py } = canvasPixel(ev);
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
    if (state?.gameType === 'rpg' || state?.gameType === 'gostop' || state?.gameType === 'baseball' || state?.gameType === 'yut' || state?.gameType === 'cityking' || state?.gameType === 'bingo' || state?.gameType === 'liar' || state?.gameType === 'oldmaid' || state?.gameType === 'twentyquestions' || state?.gameType === 'davinci' || state?.gameType === 'halligalli' || state?.gameType === 'pandemic') return false;
    if (!state || !seat || state.game.status !== 'playing') return false;
    if (state.game.paused) return false;
    if (isTeamGame() ? state.game.nextSeat !== seat : state.game.turn !== seat) return false;
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
      if (data.state && !isStaleRoomState(data.state)) {
        const settledGostop = needsGostopPoints(data.state, state);
        state = data.state;
        renderRoom();
        if (settledGostop) loadPoints();
      }
      return data;
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
      if (data.state && !isStaleRoomState(data.state)) { state = data.state; renderRoom(); }
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
      const r = await api('/api/lobby/chat', {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      lobbyChatInput.value = '';
      jailAnswer(r.jail); // (R4: the essay typed here counts the same)
    } catch (err) {
      showToast(err.message, 3500);
    } finally {
      lobbyChatInput.disabled = false;
      lobbyChatInput.focus();
    }
  }

  // A3 G1-6 빠른 말: a set word goes out as a room chat line (the chat's own rules: locked while hints are given etc.)
  document.getElementById('quickChat').addEventListener('click', async (event) => {
    const b = event.target.closest('button'); if (!b) return;
    const lock = chatLockMessage(); if (lock) { showToast(lock, 2500); return; }
    b.disabled = true; try { await api('/api/room/chat', { method: 'POST', body: JSON.stringify({ text: b.textContent }) }); } catch (err) { showToast(err.message, 3500); } finally { setTimeout(() => { b.disabled = false; }, 1500); }
  });
  async function sendChat(event) {
    event.preventDefault();
    if (chatLockMessage()) return;
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
  // v1.10.71 게임별 랭킹: the games are those of the rule picker (each room game); the server counts the records
  const rankingDialog = document.getElementById('rankingDialog');
  const rankingGame = document.getElementById('rankingGame');
  let rankingWeek = 'this';
  rankingGame.replaceChildren(...[...gameRulesSelect.options].filter((o) => !['cityking', 'rpg'].includes(o.value)).map((o) => new Option(o.textContent, o.value)), new Option('두 세계 영웅전 (최고 기록)', 'herosurv')); // (사용자 2026-10-19)
  async function loadRanking() {
    const list = document.getElementById('rankingList'); const mine = document.getElementById('rankingMe');
    const game = rankingGame.value; const week = rankingWeek;
    list.replaceChildren(); mine.textContent = '불러오는 중…';
    let data;
    try { data = await api(`/api/records/ranking?game=${encodeURIComponent(game)}&week=${week}`); }
    catch (error) { mine.textContent = error.message; return; }
    if (game !== rankingGame.value || week !== rankingWeek) return; // changed meanwhile
    const line = data.kind === 'score' ? (r) => `${r.label} · ${Number(r.score).toLocaleString('ko-KR')}점${r.hero ? ` · ${r.hero}` : ''}${r.stage != null ? ` · ${r.stage}단계` : ''}` : (r) => `${r.label} · ${r.w}승 ${r.d}무 ${r.l}패 (${r.n}판)`; // (두 세계 영웅전: each one's best, all time)
    list.replaceChildren(...data.top.map((r) => {
      const li = document.createElement('li'); li.className = r.me ? 'me' : '';
      const place = document.createElement('b'); place.textContent = `${r.rank}위`;
      li.append(place, document.createTextNode(` ${line(r)}`));
      return li;
    }));
    if (!data.top.length) list.append(Object.assign(document.createElement('li'), { className: 'rankingEmpty', textContent: data.kind === 'score' ? '아직 기록이 없어요.' : `아직 ${data.min}판 넘게 둔 사람이 없어요.` }));
    mine.textContent = data.me ? `내 순위 ${data.me.rank}위 · ${line(data.me)}` : data.kind === 'score' ? '한 판을 끝내면 최고 기록이 올라요. (주간 구분 없음)' : `${data.min}판을 두면 순위에 올라요.`;
  }
  document.getElementById('rankingBtn').addEventListener('click', () => {
    rankingGame.value = [...rankingGame.options].some((o) => o.value === gameRulesSelect.value) ? gameRulesSelect.value : 'omok'; // 랜드킹·잿빛 원정: no board (Codex review)
    rankingDialog.showModal(); loadRanking();
  });
  document.getElementById('rankingCloseBtn').addEventListener('click', () => rankingDialog.close());
  rankingGame.addEventListener('change', loadRanking);
  for (const b of document.querySelectorAll('.rankingWeeks [data-week]')) b.addEventListener('click', () => {
    rankingWeek = b.dataset.week;
    for (const x of document.querySelectorAll('.rankingWeeks [data-week]')) x.setAttribute('aria-checked', String(x === b));
    loadRanking();
  });
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

  // v1.10.63 아이디·비밀번호 로그인 (IDEAS 2026-10-11): the first screen is 로그인 / 회원가입 신청; a login opens 내 계정
  // (게임 접속 · 입장 파일 받기 · 비밀번호 변경 · 로그아웃). The account token is kept in this tab (sessionStorage) so a
  // reload or 접속 종료 comes back to 내 계정. An entry file of an account with no login id comes here with a setup
  // ticket (body data-setup): the id and password first, then the game.
  const accountGate = byId('accountGate'); const accountPanel = byId('accountPanel'); const accountSetupForm = byId('accountSetupForm');
  const accountMessage = byId('accountMessage');
  const ACCOUNT_KEY = 'gc.account';
  let setupTicket = document.body.dataset.setup || '';
  const accountToken = { get: () => { try { return sessionStorage.getItem(ACCOUNT_KEY) || ''; } catch { return ''; } },
    set: (t) => { try { if (t) sessionStorage.setItem(ACCOUNT_KEY, t); else sessionStorage.removeItem(ACCOUNT_KEY); } catch {} } };
  // v1.10.190: an entry file only logs in (body data-account) -- 내 계정 here, the island by 「게임 접속」
  if (document.body.dataset.account) { accountToken.set(document.body.dataset.account); history.replaceState(null, '', '/'); }
  const say = (text, bad = false) => { accountMessage.textContent = text; accountMessage.classList.toggle('bad', bad); };
  const accountApi = (path, body, method = 'POST') => api(path, { method, headers: { 'X-Account-Token': accountToken.get() }, ...(body ? { body: JSON.stringify(body) } : {}) });
  let accountPane = '';
  function showAccountPane(pane) { // 'login' | 'signup' | 'account' | 'setup'
    accountPane = pane;
    accountGate.classList.toggle('hidden', pane === 'account' || pane === 'setup');
    accountPanel.classList.toggle('hidden', pane !== 'account');
    accountSetupForm.classList.toggle('hidden', pane !== 'setup');
    for (const tab of accountGate.querySelectorAll('[data-account-tab]')) tab.setAttribute('aria-selected', String(tab.dataset.accountTab === pane));
    for (const form of accountGate.querySelectorAll('[data-account-pane]')) form.classList.toggle('hidden', form.dataset.accountPane !== pane);
  }
  for (const tab of accountGate.querySelectorAll('[data-account-tab]')) tab.addEventListener('click', () => { say(''); showAccountPane(tab.dataset.accountTab); });
  function showAccount(account) {
    messenger.show(account.messenger === true);
    byId('accountTitle').textContent = `${account.label}님`;
    byId('accountSub').textContent = `아이디 ${account.loginId}`;
    showAccountPane('account');
  }
  async function openAccountGate() { // the gate is shown: which part of it
    if (setupTicket) { byId('accountSetupLead').textContent = `${document.body.dataset.label || ''}님, 이제 아이디와 비밀번호로도 로그인합니다. 설정해야 로그인할 수 있고, 입장 파일은 앞으로도 그대로 쓸 수 있습니다.`; showAccountPane('setup'); return; }
    if (!accountToken.get()) { if (accountPane !== 'login' && accountPane !== 'signup') showAccountPane('login'); return; } // the tab in use stays
    try { showAccount((await accountApi('/api/account/me', null, 'GET')).account); }
    catch { accountToken.set(''); showAccountPane('login'); }
  }
  // 중복 확인: the answer belongs to the id it was asked for (a changed id needs asking again; the server checks once more at the end)
  function idChecker(input, button) {
    let checked = '';
    input.addEventListener('input', () => { checked = ''; });
    button.addEventListener('click', async () => {
      try {
        const data = await api('/api/account/check-id', { method: 'POST', body: JSON.stringify({ loginId: input.value }) });
        checked = data.available ? data.loginId : '';
        say(data.available ? `「${data.loginId}」은(는) 사용할 수 있는 아이디입니다.` : '이미 사용 중인 아이디입니다.', !data.available);
      } catch (err) { checked = ''; say(err.message, true); }
    });
    return () => checked && checked === input.value.trim().toLowerCase();
  }
  const signupIdChecked = idChecker(byId('signupIdInput'), byId('signupCheckBtn'));
  const setupIdChecked = idChecker(byId('setupIdInput'), byId('setupCheckBtn'));
  byId('accountLoginForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await api('/api/account/login', { method: 'POST', body: JSON.stringify({ loginId: byId('loginIdInput').value, password: byId('loginPasswordInput').value }) });
      byId('loginPasswordInput').value = ''; accountToken.set(data.accountToken); say(''); showAccount(data.account);
    } catch (err) { say(err.message, true); }
  });
  byId('accountSignupForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!signupIdChecked()) { say('아이디 중복 확인을 먼저 해 주세요.', true); return; }
    if (byId('signupPasswordInput').value !== byId('signupPasswordConfirm').value) { say('비밀번호 확인이 일치하지 않습니다.', true); return; }
    try {
      await api('/api/account/signup', { method: 'POST', body: JSON.stringify({ realName: byId('signupNameInput').value, loginId: byId('signupIdInput').value, password: byId('signupPasswordInput').value, nickname: byId('signupNicknameInput').value }) });
      event.target.reset(); showAccountPane('login');
      say('가입 신청을 보냈습니다. 관리자 승인 후 로그인할 수 있습니다.');
    } catch (err) { say(err.message, true); }
  });
  accountSetupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!setupIdChecked()) { say('아이디 중복 확인을 먼저 해 주세요.', true); return; }
    if (byId('setupPasswordInput').value !== byId('setupPasswordConfirm').value) { say('비밀번호 확인이 일치하지 않습니다.', true); return; }
    try {
      const data = await api('/api/account/setup', { method: 'POST', body: JSON.stringify({ ticket: setupTicket, loginId: byId('setupIdInput').value, password: byId('setupPasswordInput').value }) });
      setupTicket = ''; accountToken.set(data.accountToken); say(''); showAccount(data.account); history.replaceState(null, '', '/');
    } catch (err) { say(err.message, true); }
  });
  function enterWithAccount() { byId('accountEntryToken').value = accountToken.get(); byId('accountEntryForm').submit(); } // the same entry as a file's
  byId('accountPlayBtn').addEventListener('click', enterWithAccount);
  // 메신저 단독 창 (gamecenter-notes docs/messenger-standalone-20261025.md B안): the messenger is its own page now
  // (/messenger, public/messenger.js) -- open beside the game or without it, an app of its own. Here only its buttons (내 계정
  // and the island's) with what is unread, opening that window (the same one again), and the island's small notice.
  const messenger = (() => {
    const msgBtn = byId('accountMessengerBtn'); const tab = byId('islandMessengerTab'); let on = false;
    const { unreadOf } = window.MessengerAlert;
    // (사용자 2026-10-25 「섬 앱에서 누르면 크롬으로 열려」: the blank window used to find an open one is outside the installed
    // app's scope, so the app handed it to the browser -- in the app, no blank one: the messenger itself in a small window,
    // the one opened kept and brought forward)
    const asApp = () => ['standalone', 'window-controls-overlay', 'minimal-ui'].some((m) => window.matchMedia?.(`(display-mode: ${m})`).matches) || navigator.standalone === true;
    let opened = null;
    function open() { // (an open messenger window comes to the front as it is; a new one gets this tab's login with it)
      let w;
      if (asApp()) w = opened && !opened.closed ? opened : (opened = window.open('/messenger', 'gc-messenger', 'popup,width=440,height=780'));
      else {
        w = window.open('', 'gc-messenger');
        try { if (!w || w.location.href === 'about:blank') w = window.open('/messenger', 'gc-messenger'); } catch { w = window.open('/messenger', 'gc-messenger'); }
      }
      w?.focus(); try { new BroadcastChannel('gc-messenger').postMessage({ account: accountToken.get() }); } catch {}
    }
    msgBtn.addEventListener('click', open); tab.addEventListener('click', open);
    // v1.10.87 알림: the buttons count what is unread in my rooms (the server's count, a room with 알림 끄기 left out)
    async function badge() {
      if (!on) return;
      try {
        const unread = unreadOf((await accountApi('/api/messenger', null, 'GET')).rooms); const n = unread > 99 ? '99+' : unread;
        msgBtn.textContent = unread ? `메신저 · 새 메시지 ${n}` : '메신저'; tab.textContent = unread ? `메신저 ${n}` : '메신저';
        for (const b of [msgBtn, tab]) b.classList.toggle('hasUnread', unread > 0);
        window.MessengerAlert.setBadge(navigator, unread); messengerBlink.update(unread, pageInBackground()); // (v1.10.190: the app icon's count, as the messenger window's)
      } catch {}
    }
    setInterval(badge, 30000);
    // A5 메신저 실시간 받기: a held stream (fetch, as the account's token goes in a header); a room's change counts again at once
    let streamCtl = null; let streamWanted = false;
    async function openStream() {
      if (!streamWanted || streamCtl) return; streamCtl = new AbortController();
      try {
        const res = await fetch('/api/messenger/stream', { headers: { 'X-Account-Token': accountToken.get() }, signal: streamCtl.signal, cache: 'no-store' });
        if (!res.ok || !res.body) throw new Error(String(res.status));
        const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
        for (;;) {
          const { value, done } = await reader.read(); if (done) break;
          buf += dec.decode(value, { stream: true }); let cut;
          while ((cut = buf.indexOf('\n\n')) >= 0) { const chunk = buf.slice(0, cut); buf = buf.slice(cut + 2); if (/^event: msg$/m.test(chunk)) { badge(); islandNotice(); } }
        }
      } catch {}
      streamCtl = null;
      if (streamWanted) setTimeout(openStream, 5000);
    }
    function wantStream(want) { streamWanted = want; if (want) openStream(); else { streamCtl?.abort(); streamCtl = null; } }
    // v1.10.90 섬 안 알림: on the island, a new message in a room not muted shows as a small toast
    let islandSeen = null;
    async function islandNotice() {
      if (!on || !document.body.classList.contains('plazaMode')) { islandSeen = null; return; }
      try {
        const rooms = (await accountApi('/api/messenger', null, 'GET')).rooms; const now = Object.fromEntries(rooms.map((r) => [r.id, r.unread]));
        if (islandSeen) for (const r of rooms) if (!r.muted && r.unread > (islandSeen[r.id] || 0) && r.last && !r.last.system) showToast(`💬 ${r.name} · ${r.last.label}: ${r.last.text.slice(0, 40)}`, 4000);
        islandSeen = now;
      } catch {}
    }
    setInterval(islandNotice, 15000);
    return { show: (want) => { on = Boolean(want); msgBtn.classList.toggle('hidden', !on); tab.classList.toggle('hidden', !on); if (on) setTimeout(badge, 0); wantStream(on); } }; // (after the account panel shows; A5: the stream while permitted)
  })();
  // (on the island too: the account this tab logged in with, if the messenger is theirs)
  if (accountToken.get()) accountApi('/api/account/me', null, 'GET').then((d) => messenger.show(d.account?.messenger === true)).catch(() => {});
  byId('accountLogoutBtn').addEventListener('click', async () => {
    await accountApi('/api/account/logout').catch(() => {});
    messenger.show(false); accountToken.set(''); say('로그아웃했습니다.'); showAccountPane('login');
  });
  byId('accountPasswordBtn').addEventListener('click', () => {
    const form = byId('accountPasswordForm'); const open = form.classList.toggle('hidden') === false;
    byId('accountPasswordBtn').setAttribute('aria-expanded', String(open)); if (open) byId('passwordCurrentInput').focus();
  });
  byId('accountPasswordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (byId('passwordNextInput').value !== byId('passwordNextConfirm').value) { say('새 비밀번호 확인이 일치하지 않습니다.', true); return; }
    try {
      await accountApi('/api/account/password', { current: byId('passwordCurrentInput').value, next: byId('passwordNextInput').value });
      event.target.reset(); event.target.classList.add('hidden'); byId('accountPasswordBtn').setAttribute('aria-expanded', 'false');
      say('비밀번호를 바꿨습니다.');
    } catch (err) { say(err.message, true); }
  });
  // 입장 파일 받기 = 재발급: asked once, since the file got before stops working
  byId('accountFileBtn').addEventListener('click', async () => {
    if (!window.confirm('새 파일을 받으면 이전에 받은 입장 파일은 더 이상 쓸 수 없습니다. 새로 받을까요?')) return;
    try {
      const data = await accountApi('/api/account/entry-file');
      const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([data.html], { type: 'text/html' })); link.download = data.fileName;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 10000);
      say('새 입장 파일을 받았습니다. 이전 파일은 이제 쓸 수 없습니다.');
    } catch (err) { say(err.message, true); }
  });
  logoutBtn.addEventListener('click', requestLogout);
  // v1.10.64 (사용자 2026-10-12): in a room Tab goes round the room's own controls -- from the last back to the first
  // (Shift+Tab the other way), never out to the browser's bar or the hidden pages. An open window keeps its own Tab.
  const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey || roomView.classList.contains('hidden') || document.querySelector('dialog[open]')) return;
    const ring = [...roomView.querySelectorAll(FOCUSABLE), ...document.querySelectorAll('.chatFloatBtn')]
      .filter((el) => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert], details:not([open]) > :not(summary)'));
    if (!ring.length) return;
    const at = ring.indexOf(document.activeElement);
    const next = at < 0 ? (event.shiftKey ? ring.length - 1 : 0) : event.shiftKey && at === 0 ? ring.length - 1 : !event.shiftKey && at === ring.length - 1 ? 0 : null;
    if (next === null) return; // inside the ring: the browser's own order
    event.preventDefault(); ring[next].focus();
  });
  byId('roomMenuBtn').addEventListener('click', () => openGameMenu()); // v1.10.64: the room's 접속 종료 is in the menu (Esc, or this on a phone)
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
  if (rpgTouchOnly()) { // the list shows names only (v1.6.90 decision): the button is simply disabled, as it was while the game was closed
    const rpgChoice = document.querySelector('.gameChoice[data-game="rpg"]');
    if (rpgChoice) { rpgChoice.disabled = true; rpgChoice.setAttribute('aria-disabled', 'true'); rpgChoice.title = RPG_PC_ONLY; }
  }
  // v1.10.63 (사용자 2026-10-12): out of a room back to choosing a game -- on the island the 게임관 window opens at once
  leaveRoomBtn.addEventListener('click', async () => {
    await leaveRoom();
    if (document.body.classList.contains('plazaMode') && !state) PLAZA_FACILITIES.find((f) => f.id === 'games')?.open();
  });
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
  diceYutSection.addEventListener('click', () => { if (state?.gameType === 'yut' && diceYutSection.classList.contains('canThrow') && !yutThrowBtn.disabled) yutThrowBtn.click(); }); // (G-게임별 윷: a tap on the mat throws)
  yutThrowBtn.addEventListener('click', async () => {
    yutThrowBtn.disabled = true;
    await roomAction('throw-yut');
    if (state?.gameType === 'yut') renderYut();
  });
  bingoGridSelect.addEventListener('change', () => roomAction('set-bingo-grid', { gridSize: Number(bingoGridSelect.value) }));
  bingoPoolSelect.addEventListener('change', () => roomAction('set-bingo-pool', { poolMax: Number(bingoPoolSelect.value) }));
  bingoTargetSelect.addEventListener('change', () => roomAction('set-bingo-target', { targetLines: Number(bingoTargetSelect.value) }));
  bingoStartBtn.addEventListener('click', () => roomAction('start-bingo'));
  cityRollBtn.addEventListener('click', async () => {
    const expectedMoveCount = state?.game?.moveCount ?? 0;
    cityRollBtn.disabled = true;
    await roomAction('roll-city', { expectedMoveCount });
    if (state?.gameType === 'cityking') renderCityControls();
  });
  cityStartBtn.addEventListener('click', () => roomAction('start-city'));
  cityBuyBtn.addEventListener('click', () => roomAction('buy-city'));
  citySkipBtn.addEventListener('click', () => roomAction('skip-city'));
  cityBuildBtn.addEventListener('click', () => roomAction('build-city'));
  cityBuildSkipBtn.addEventListener('click', () => roomAction('skip-build-city'));
  citySellBuildingBtn.addEventListener('click', () => {
    if (citySelectedTileIndex === null) return;
    roomAction('sell-building-city', { tileIndex: citySelectedTileIndex });
  });
  citySellPropertyBtn.addEventListener('click', () => {
    if (citySelectedTileIndex === null) return;
    roomAction('sell-property-city', { tileIndex: citySelectedTileIndex });
  });
  cityTileSelect.addEventListener('change', () => {
    if (state?.gameType !== 'cityking') return;
    const index = Number(cityTileSelect.value);
    if (!Number.isInteger(index) || !state.game.tiles?.[index]) return;
    citySelectedTileIndex = index;
    renderCityControls();
    drawCityBoard();
  });

  halliStartBtn.addEventListener('click', () => roomAction('start-halligalli'));
  halliTimeSelect.addEventListener('change', () => roomAction('set-halligalli-time', { minutes: Number(halliTimeSelect.value) }));
  halliFlipBtn.addEventListener('click', () => roomAction('flip-halligalli', { expectedRevision: state.game.revision }));
  halliBellBtn.addEventListener('click', () => roomAction('ring-halligalli', { expectedFlipId: state.game.flipId }));
  document.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.repeat || !isHalliGame() || !state?.me?.seat || state.game.status !== 'playing') return;
    const target = event.target;
    if (target?.closest?.('input, textarea, select, button, dialog[open]') || target?.isContentEditable || document.querySelector('dialog[open]')) return;
    event.preventDefault();
    if (!halliBellBtn.disabled) halliBellBtn.click();
  });
  setInterval(() => {
    if (!isHalliGame() || state.game.status !== 'playing') return;
    const left = Math.max(0, Math.ceil((state.game.endsAt - (Date.now() - halliClockOffset)) / 1000));
    halliStatus.textContent = halliStatus.textContent.replace(/남은 시간 \d+:\d{2}/, `남은 시간 ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
  }, 1000);
  davinciStartBtn.addEventListener('click', () => roomAction('start-davinci'));
  davinciGuessBtn.addEventListener('click', async () => {
    const target = state?.game?.selection;
    if (!target || target.seat !== seat || !state) return;
    const number = Number(davinciNumber.value);
    davinciGuessPending = true;
    davinciGuessPendingNumber = number;
    renderDavinci();
    try {
      await roomAction('guess-davinci', { targetSeat: target.target, tileId: target.tileId, number, expectedRevision: state.game.revision });
    } finally {
      davinciGuessPending = false;
      davinciGuessPendingNumber = null;
      if (isDavinciGame()) renderDavinci();
    }
  });
  davinciStopBtn.addEventListener('click', () => roomAction('stop-davinci', { expectedRevision: state.game.revision }));
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isDavinciGame() || !davinciHands.querySelector('.davinciPicker')) return;
    event.preventDefault(); // this Esc closes the picker, not opens the menu
    const g = state.game;
    davinciPickerClosedFor = g.selection ? `${g.revision}:${g.selection.target}:${g.selection.tileId}` : null;
    renderDavinci();
  });
  setInterval(() => {
    if (state?.gameType === 'davinci' && state.game?.status === 'playing' && !davinciPanel.classList.contains('hidden')) {
      const timer = Math.max(0, Math.ceil((state.game.deadlineAt - Date.now()) / 1000));
      davinciStatus.textContent = davinciStatus.textContent.replace(/남은 시간 \d+초/, `남은 시간 ${timer}초`);
    }
  }, 1000);
  oldmaidStartBtn.addEventListener('click', () => roomAction('start-oldmaid'));
  oldmaidShuffleBtn.addEventListener('click', async () => {
    if (oldmaidShuffleBtn.disabled || !state) return;
    oldmaidShuffleBtn.disabled = true;
    await roomAction('shuffle-oldmaid', { expectedRevision: state.game.revision });
  });
  oldmaidEffectsToggle.addEventListener('change', () => {
    oldmaidEffectsOn = oldmaidEffectsToggle.checked;
    try { localStorage.setItem('oldmaidEffects', oldmaidEffectsOn ? 'on' : 'off'); } catch {}
    oldmaidPanel.classList.toggle('effectsOff', !oldmaidEffectsActive());
  });
  for (const radio of oldmaidModeRadios) {
    radio.addEventListener('change', () => {
      if (!radio.checked || radio.disabled) return;
      roomAction('set-oldmaid-mode', { mode: radio.value }).catch(err => showToast(err.message, 3000));
    });
  }
  oldmaidAbilityUseBtn.addEventListener('click', async () => {
    const ability = state?.me?.myOldMaidAbility;
    if (!ability || ability.used || !state?.game) return;
    if (ability.type === 'peek') {
      oldmaidPeekArmed = !oldmaidPeekArmed;
      renderOldMaid();
      return;
    }
    oldmaidAbilityUseBtn.disabled = true;
    try {
      await roomAction('use-ability-oldmaid', { type: ability.type, expectedRevision: state.game.revision });
    } catch (err) {
      showToast(err.message, 3000);
    } finally {
      oldmaidAbilityUseBtn.disabled = false;
    }
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
  function setPictionaryTool(tool) {
    pictionaryTool = tool;
    for (const [button, value] of [[pictionaryPenBtn, 'pen'], [pictionaryEraserBtn, 'eraser']]) {
      button.classList.toggle('selected', tool === value);
      button.setAttribute('aria-pressed', String(tool === value));
    }
  }
  pictionaryPenBtn.addEventListener('click', () => setPictionaryTool('pen'));
  pictionaryEraserBtn.addEventListener('click', () => setPictionaryTool(pictionaryTool === 'eraser' ? 'pen' : 'eraser'));
  pictionaryUndoBtn.addEventListener('click', () => roomAction('pictionary-undo'));
  pictionaryConfig.addEventListener('change', (event) => {
    const input = event.target;
    if (input.matches('[data-pictionary-mode]')) roomAction('set-pictionary-config', { mode: input.value });
    else if (input.matches('[data-pictionary-difficulty]')) roomAction('set-pictionary-config', { difficulty: input.value });
    else if (input.matches('[data-pictionary-seconds]')) roomAction('set-pictionary-config', { roundSeconds: Number(input.value) });
    else if (input === pictionaryShowCategory) roomAction('set-pictionary-config', { showCategory: input.checked });
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
      if (data.state && !isStaleRoomState(data.state)) { state = data.state; renderRoom(); }
      // Keep whatever the player typed while this guess was in flight.
      if (pictionaryGuessInput.value.trim() === guess) pictionaryGuessInput.value = '';
      showToast(state.game.correctGuessers.includes(seat) ? '정답입니다!' : data.pictionaryClose ? '정답에 가깝습니다!' : '오답입니다. 다시 시도해 보세요.', 2200);
    } catch (err) { showToast(err.message, 2800); }
    finally { button.disabled = false; }
  });
  setInterval(() => {
    renderMyActionTimer();
  }, 250);

  setInterval(() => {
    if (state?.gameType !== 'pictionary' || pictionaryPanel.classList.contains('hidden')) return;
    const g = state.game;
    const endsAt = g.phase === 'drawing' ? g.roundEndsAt : g.phase === 'reveal' ? g.revealEndsAt : null;
    if (!endsAt || (g.phase === 'drawing' && desktopActionTimerOwns('pictionary'))) return;
    // (CI 3차: the room's render's words -- this tick wrote 「결과 공개」 a second after the render wrote 「다음 라운드」, so the
    // timer changed its words each second; pictionary-v2.spec waiting for 「다음 라운드」 failed when it read between)
    pictionaryTimer.textContent = g.phase === 'reveal' ? `다음 라운드 · ${pictionaryCountdownText(endsAt)}` : pictionaryCountdownText(endsAt);
  }, 1000);

  setInterval(() => {
    if (state?.gameType !== 'liar' || liarPanel.classList.contains('hidden') || desktopActionTimerOwns('liar')) return;
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
  const endPausedConfirmMsg = '응답이 없는 참가자를 패배로, 응답 중인 참가자를 승리로 기록하며 대국을 종료할까요?';
  endGameBtn.addEventListener('click', () => confirm(endPausedConfirmMsg) && roomAction('end-game'));
  sideEndGameBtn.addEventListener('click', () => confirm(endPausedConfirmMsg) && roomAction('end-game'));
  pauseWaitBtn.addEventListener('click', () => {
    pauseDialogDismissedKey = pauseDialogShownKey;
    pauseDialog.close();
  });
  pauseEndBtn.addEventListener('click', () => {
    pauseDialog.close();
    roomAction('end-game');
  });
  pauseDialog.addEventListener('close', () => {
    if (pauseDialogShownKey) pauseDialogDismissedKey = pauseDialogShownKey;
  });
  resignBtn.addEventListener('click', () => confirm('기권할까요?') && roomAction('resign'));
  sideResignBtn.addEventListener('click', () => confirm('기권할까요?') && roomAction('resign'));
  nextRoundBtn.addEventListener('click', () => roomAction('next-round'));
  sideNextRoundBtn.addEventListener('click', () => roomAction('next-round'));

  let touchPick = null; let touchPickKey = null; // A3 G3-1: the point a first tap chose (on this board, moveCount unchanged)
  canvas.addEventListener('pointermove', (ev) => {
    if (state?.gameType === 'yut') {
      const { px, py } = canvasPixel(ev);
      const key = yutTargetAt(px, py)?.key || null;
      canvas.style.cursor = key ? 'pointer' : '';
      if (key !== yutHoverTargetKey) { yutHoverTargetKey = key; drawYutBoard(); }
      return;
    }
    canvas.style.cursor = '';
    hover = canvasPoint(ev);
    drawBoard();
  });
  canvas.addEventListener('pointerleave', (ev) => {
    if (ev.pointerType === 'touch' && touchPick) return; // (A3 G3-1: the first tap's preview stone stays)
    hover = null;
    canvas.style.cursor = '';
    if (state?.gameType === 'yut') {
      if (yutHoverTargetKey !== null) { yutHoverTargetKey = null; drawYutBoard(); }
      return;
    }
    drawBoard();
  });
  canvas.addEventListener('pointerup', (ev) => {
    if (state?.gameType === 'yut') {
      const { px, py } = canvasPixel(ev);
      const target = yutTargetAt(px, py);
      if (target) requestYutMove(target.move.pieceId);
      return;
    }
    if (state?.gameType === 'cityking') { selectCityTileFromPointer(ev); return; }
    const p = canvasPoint(ev);
    if (!p || !canPlace(p.x, p.y)) return;
    // A3 G3-1 오목 터치 두 번 누르기: on a touch screen the first tap shows the stone (the hover preview), the same point
    // again places it, another point moves the preview; a mouse still places at once
    if (ev.pointerType === 'touch' && /^omok/.test(state?.gameType || '')) {
      const key = `${p.x},${p.y}`;
      if (touchPick !== key) { touchPick = key; hover = p; drawBoard(); return; }
    }
    touchPick = null;
    roomAction('move', state?.gameType === 'connect4' ? { x: p.x } : p);
  });

  // v1.6.85: coming back to this tab (or its window regaining focus) ends a pending turn alert.
  const endTurnAlertIfLooking = () => { if (!pageInBackground()) { clearTurnAlert(); messengerBlink.seen(); } };
  document.addEventListener('visibilitychange', endTurnAlertIfLooking);
  window.addEventListener('focus', endTurnAlertIfLooking);
  turnNotifyBtn?.addEventListener('click', () => { toggleTurnNotify(); });
  updateTurnNotifyBtn();

  window.TwentyQuestionsUI.init(roomAction);
  window.GostopUI.init(roomAction);
  window.PandemicUI.init(roomAction);
  attendanceBtn.addEventListener('click', claimAttendance);
  for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', () => {
    if (document.body.classList.contains('plazaMode') && !document.querySelector('dialog[open]')) plazaStage.focus({ preventScroll: true });
  });
  pointHistoryBtn.addEventListener('click', () => setPointHistoryOpen(!pointHistoryOpen));
  pointHistoryClose.addEventListener('click', () => { setPointHistoryOpen(false); pointHistoryBtn.focus(); });
  pointHistoryMore.addEventListener('click', () => loadPointHistory());
  selectGame('omok');
  showGameTab(); // v1.10.63: the remembered 멀티/싱글 and 대전/협동 tabs
  gameTabReady = true;  drawBoard();
  window.GameBoot.ready.then(loadSession); // v1.10.14: after the Chrome check and the resource pack (public/game-boot.js)
})();
