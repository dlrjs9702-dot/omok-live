(() => {
  'use strict';

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
  const roomLogoutBtn = document.getElementById('roomLogoutBtn');
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
  const yutSticks = [1, 2, 3, 4].map(n => document.getElementById(`yutStick${n}`));
  // v1.6.55: common dice/yut animation stage, embedded inside #gameInfoPanel (see below).
  const diceYutSection = document.getElementById('diceYutSection');
  const diceYutStage = document.getElementById('diceYutStage');
  const diceYutResult = document.getElementById('diceYutResult');
  const bingoPanel = document.getElementById('bingoPanel');
  const bingoSetupRow = document.getElementById('bingoSetupRow');
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
  const marathonPanel = document.getElementById('marathonPanel');
  const marathonStatus = document.getElementById('marathonStatus');
  const marathonStartBtn = document.getElementById('marathonStartBtn');
  const marathonConfigChooser = document.getElementById('marathonConfigChooser');
  const marathonLayoutChooser = document.getElementById('marathonLayoutChooser');
  const marathonModeRadios = [...document.querySelectorAll('[data-marathon-mode]')];
  const marathonLayoutRadios = [...document.querySelectorAll('[data-marathon-layout]')];
  const marathonDifficultyRadios = [...document.querySelectorAll('[data-marathon-difficulty]')];
  const marathonTrack = document.getElementById('marathonTrack');
  const marathonTurnLabel = document.getElementById('marathonTurnLabel');
  const marathonRollBtn = document.getElementById('marathonRollBtn');
  const marathonLastRoll = document.getElementById('marathonLastRoll');
  const marathonMissionBox = document.getElementById('marathonMissionBox');
  const marathonMissionType = document.getElementById('marathonMissionType');
  const marathonMissionTimer = document.getElementById('marathonMissionTimer');
  const marathonMissionPrompt = document.getElementById('marathonMissionPrompt');
  const marathonAnswerForm = document.getElementById('marathonAnswerForm');
  const marathonAnswerInput = document.getElementById('marathonAnswerInput');
  const marathonReflexOptions = document.getElementById('marathonReflexOptions');
  const marathonMissionFeedback = document.getElementById('marathonMissionFeedback');
  const marathonResult = document.getElementById('marathonResult');
  const marathonHistory = document.getElementById('marathonHistory');
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
  let yutMoveAnimationGen = 0;
  let state = null;
  let seat = null;
  let isHost = false;
  let marathonMemoryHideKey = null;
  let marathonMemoryHideTimer = null;
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
  let lastResultEffectKey = null;

  // Room sidebar (chat/system/room-info) state. The sidebar never depends on measuring the
  // board's rendered height (that was the cause of the chat panel being pushed off-screen on
  // tall boards like Land King/Old Maid) — it is bounded purely by viewport height in CSS.
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
  let chatLastSeenId = 0;
  let lastRenderedChatIds = [];

  function isMobileLayout() { try { return window.matchMedia('(max-width:880px)').matches; } catch { return false; } }

  // v1.6.56: cityking/oldmaid no longer auto-collapse the sidebar by default. That default existed
  // to give their wide boards more room, back when the sidebar was optional for actually playing
  // them -- now that #gameActionsPanel (start/roll/buy/build buttons etc.) lives inside
  // #gameInfoPanel, collapsing it by default would hide controls a host needs just to start the
  // game. The user can still collapse it manually as before.
  function chatShouldCollapse() { return chatCollapsedPref === true; }
  function gameInfoShouldCollapse() { return gameInfoCollapsedPref === true; }

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
    pipWindow.document.title = `채팅 · ${state?.gameName || '게임센터'}`;
    chatPanelHome = { parent: chatPanel.parentElement, next: chatPanel.nextElementSibling };
    pipWindow.document.body.appendChild(chatPanel);
    chatPipWindow = pipWindow;
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
      pipWindow.document.title = `게임 진행 · ${state?.gameName || '게임센터'}`;
      gameInfoPanelHome = { parent: gameInfoPanel.parentElement, next: gameInfoPanel.nextElementSibling };
      pipWindow.document.body.appendChild(gameInfoPanel);
      gameInfoPipWindow = pipWindow;
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
    chatAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight < 40;
    if (chatAtBottom) { chatJumpBtn.classList.add('hidden'); if (chatVisible()) markChatSeen(); }
  });
  chatInput.addEventListener('focus', () => {
    // Belt-and-suspenders for the mobile keyboard: the overlay already sizes itself with dvh,
    // but scrolling the input into view also covers older WebKit builds that resize the layout
    // viewport late.
    setTimeout(() => chatInput.scrollIntoView({ block: 'end', behavior: 'smooth' }), 150);
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
  window.addEventListener('resize', () => { applyChatLayout(); applyGameInfoLayout(); });
  window.addEventListener('orientationchange', () => { applyChatLayout(); applyGameInfoLayout(); });

  // Old Maid table effects state. Purely cosmetic bookkeeping: never the source of truth for
  // game state (that always comes from `state.game`, applied immediately by roomAction/SSE).
  let oldmaidEffectsOn = true;
  try { oldmaidEffectsOn = localStorage.getItem('oldmaidEffects') !== 'off'; } catch {}
  let oldmaidDrawBusy = false;
  let oldmaidPeekArmed = false;
  let oldmaidLastHistoryLen = 0;
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
  function animateTumble(els, spins, buildFrame, finalTransforms, { duration = 700, settleMs = 420, decorate, onDone } = {}) {
    els.forEach(el => el.classList.remove('settling'));
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
      : type === 'connect4' ? '사목 (4목)' : type === 'yut' ? '윷놀이' : type === 'bingo' ? '빙고' : type === 'dots' ? '점과 상자' : type === 'cityking' ? '랜드킹' : type === 'pictionary' ? '그림 맞히기' : type === 'liar' ? '라이어게임' : type === 'oldmaid' ? '도둑잡기' : type === 'marathon' ? '마라톤'
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
  function isCityKingGame() { return state?.gameType === 'cityking'; }
  function isMarathonGame() { return state?.gameType === 'marathon'; }
  function isNumberedSeatGame() { return isTeamGame() || isBingoGame() || isPictionaryGame() || isLiarGame() || isOldMaidGame() || isCityKingGame() || isMarathonGame(); }
  // Marathon's own selectable seat count depends on its pre-start team layout (2v2 needs exactly 4
  // seats; individual/3v3/2v2v2 use all 6) -- mirrors server.js's marathonSeatSlots().
  function marathonSeatSlots() {
    const g = state?.game;
    if (g?.mode === 'team' && g?.teamLayout === '2v2') return ['1','2','3','4'];
    return ['1','2','3','4','5','6'];
  }
  function numberedSeats() { return isOldMaidGame() ? ['1','2','3','4'] : isMarathonGame() ? marathonSeatSlots() : (isPictionaryGame() || isLiarGame()) ? ['1','2','3','4','5','6','7','8'] : ['1','2','3','4']; }
  // Mirrors marathon.js's groupForSeat(): odd/even split for 2v2 and 3v3, a 1-of-3 cycle for
  // 2v2v2. Only meaningful once the host has picked team mode; individual mode has no groups.
  function marathonGroupForSeat(seat) {
    const layout = state?.game?.teamLayout;
    const n = Number(seat);
    if (layout === '2v2v2') return ['A', 'B', 'C'][(n - 1) % 3];
    return n % 2 ? 'A' : 'B';
  }
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
    if (['bingo', 'cityking', 'pictionary', 'liar', 'oldmaid'].includes(gameType)) {
      const winners = Array.isArray(game.winner) ? game.winner.map(String) : [String(game.winner)];
      return winners.includes(String(playerSeat)) ? 'win' : 'loss';
    }
    if (gameType === 'marathon') {
      // Self-contained like every other branch here (derives the group from playerSeat + game
      // fields only, mirroring marathon.js's own groupForSeat()) rather than relying on the
      // myGroup field publicState() also exposes, since this function only ever receives game.
      const n = Number(playerSeat);
      const myGroup = game.mode === 'team'
        ? (game.teamLayout === '2v2v2' ? ['A', 'B', 'C'][(n - 1) % 3] : (n % 2 ? 'A' : 'B'))
        : String(playerSeat);
      const winners = Array.isArray(game.winner) ? game.winner.map(String) : [String(game.winner)];
      return winners.includes(myGroup) ? 'win' : 'loss';
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
    "yut": "각자 말 4개를 모두 먼저 완주하면 승리합니다. 도·개·걸·윷·모만큼 움직이며, 윷·모가 나오거나 상대 말을 잡으면 한 번 더 던집니다. 빽도가 나오면 보드 위의 말 하나를 한 칸 뒤로 물립니다(대기 중인 말은 낼 수 없고, 물릴 말이 없으면 차례가 자동으로 넘어갑니다). 같은 편 말끼리는 업어서 함께 이동하고 모서리에 정확히 멈추면 지름길을 이용하며, 중앙에 정확히 멈춘 말은 항상 짧은 지름길로 출발합니다. 완주 직전 칸에 도착한 말은 그 칸에 머무르고, 다음 이동에서 한 칸 이상 더 나아가야 완주합니다.",
    "bingo": "2~4명이 1~50 중 서로 다른 25개 숫자로 된 5×5 판을 받습니다. 자기 차례에 자신의 판에서 아직 선택되지 않은 숫자를 누르면 같은 숫자를 가진 모든 참가자의 판도 함께 체크됩니다. 방장이 시작 전에 1~12줄 중 승리 조건을 정하며 가로·세로·두 대각선을 합쳐 먼저 조건을 달성하면 승리합니다.",
    "dots": "5×5 점 사이에 번갈아 선을 하나씩 긋습니다. 네 변을 완성해 상자를 만든 사람이 그 상자를 차지하고 한 번 더 긋습니다. 모든 선을 그은 뒤 차지한 상자가 더 많은 사람이 승리합니다.",
    "cityking": "독자 규칙의 도시 보드게임입니다. 주사위를 굴려 도시를 매입하고 상대가 소유한 도시에는 통행료를 냅니다. 자기 소유 도시에 도착하면 매입가의 50%로 별장·빌딩·호텔을 방문당 한 단계 건설할 수 있습니다. 통행료는 기본·2배·3배·5배이며, 건설비는 순자산에 포함됩니다. 출발 보너스와 이벤트를 활용해 상대를 파산시키거나 50턴 뒤 순자산이 높은 쪽이 승리합니다.",
    "othello": "8×8 판에서 흑이 먼저 둡니다. 상대 돌을 양쪽에서 감싸면 가운데 돌을 내 색으로 뒤집습니다. 둘 곳이 없으면 자동 패스하며, 양쪽 모두 둘 수 없으면 종료되고 돌이 많은 쪽이 이깁니다.",
    "baseball": "방장이 방 생성 때 3자리 또는 4자리 숫자야구를 정합니다. 첫 자리는 0이 아니고 숫자는 서로 달라야 합니다. 숫자와 자리가 같으면 스트라이크, 숫자만 같으면 볼, 모두 다르면 아웃입니다. 선택한 자릿수만큼 스트라이크를 먼저 맞히면 승리합니다. 상대의 비밀 숫자는 보이지 않습니다.",
    "pictionary": "2~8명이 참여합니다. 라운드마다 한 명이 출제자가 되어 서버가 정한 제시어를 90초 동안 그림으로 표현하고 나머지는 정답을 맞힙니다. 정답자는 100점, 출제자는 정답자 1명당 50점을 얻습니다. 전원이 한 번씩 출제자를 맡으면 총점이 가장 높은 사람이 승리하며, 제시어는 출제자에게만 보입니다.",
    "liar": "3~8명이 참여합니다. 시민은 제시어를 알고 라이어 1명은 모릅니다. 전원이 순서대로 힌트를 두 번 말한 뒤 비밀 투표하며, 동률이면 후보만 추가 힌트 후 한 번 재투표합니다. 라이어가 지목되면 30초 안에 제시어를 맞힐 마지막 기회를 얻습니다.",
    "oldmaid": "2~4명이 53장(조커 1장 포함)을 나누고 같은 계급의 카드 두 장씩 자동으로 버립니다. 내 차례에는 다음 활성 참가자의 카드 뒷면 중 한 장을 선택해 뽑습니다. 자기 손패는 카드 섞기로 순서를 바꿀 수 있습니다. 짝이 생기면 자동으로 버리며 마지막 조커 보유자가 패배합니다.",
    "marathon": "2~6인 개인전 또는 4인 2대2·6인 3대3·6인 2대2대2 팀전. 주사위 1개를 굴려 이동하고, 도착한 칸마다(같은 칸 재방문 포함) 타이핑·기억력·반응·계산 미션이 매번 새로 나옵니다. 제한시간 안에 맞히면 그 자리에 머물고, 못 맞히면 2칸 뒤로 물러나며 그 자리에서 새 미션이 바로 이어집니다. 30칸 이상 도달하면 즉시 승리합니다. 팀전은 말 하나를 공유하며 팀원끼리 주사위를 돌아가며 굴리고 미션은 팀원 누구나 제출할 수 있습니다."
});
  function showGameRule(type) {
    gameRulesText.textContent = gameRules[type] || '';
  }

  function selectGame(type) {
    selectedGameType = ['othello', 'baseball', 'omok2v2', 'connect4', 'yut', 'bingo', 'dots', 'cityking', 'pictionary', 'liar', 'oldmaid', 'marathon'].includes(type) ? type : 'omok';
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

  function renderRecords(data, select, name, summary, detail) {
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
      renderRecords(data, recordsProfileGame, recordsProfileName, recordsProfileSummary, recordsProfileDetail);
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

  function enterLobby() {
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
    chatUnreadCount = 0;
    chatAtBottom = true;
    chatLastSeenId = 0;
    lastRenderedChatIds = [];
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
    if (isMarathonGame() && numberedSeats().includes(value)) return marathonGroupLabel(state.game.mode === 'team' ? marathonGroupForSeat(value) : value, state.game);
    if ((isBingoGame() || isPictionaryGame() || isLiarGame() || isOldMaidGame() || isCityKingGame()) && numberedSeats().includes(value)) return `${value}번`;
    if (isTeamGame() && ['1','2','3','4'].includes(value)) return `${seatColor(value) === 'black' ? '흑' : '백'}팀 ${value}번`;
    if (value === 'black') return state?.gameType === 'baseball' ? '선공' : state?.gameType === 'connect4' ? '빨강' : ['yut','dots'].includes(state?.gameType) ? '파랑' : (isTeamGame() ? '흑팀' : '흑');
    if (value === 'white') return state?.gameType === 'baseball' ? '후공' : state?.gameType === 'connect4' ? '노랑' : ['yut','dots'].includes(state?.gameType) ? '빨강' : (isTeamGame() ? '백팀' : '백');
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

  function buildChatMessageEl(row) {
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
    return item;
  }

  function fillMessageList(container, rows, emptyText) {
    container.innerHTML = '';
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'chatEmpty';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }
    for (const row of rows) container.appendChild(buildChatMessageEl(row));
  }

  // v1.6.42: only the liar game's hint phases lock room chat (so hints stay spoken-in-turn, not
  // traded ahead of time) -- every other game and every other liar-game phase is unaffected.
  function chatLockedForHints() {
    const g = state?.game;
    return isLiarGame() && g?.status === 'playing' && ['hint1', 'hint2', 'extraHint'].includes(g.phase);
  }

  function renderChat() {
    const locked = state ? chatLockedForHints() : false;
    chatInput.disabled = locked;
    chatSendBtn.disabled = locked;
    chatLockNotice.classList.toggle('hidden', !locked);
    chatInput.placeholder = locked ? '힌트 진행 중에는 채팅할 수 없습니다' : '메시지 입력';

    const rows = state?.chat?.messages || [];
    const chatRows = rows.filter(row => row.type !== 'system');
    const systemRows = rows.filter(row => row.type === 'system');

    const newestId = chatRows.length ? chatRows[chatRows.length - 1].id : 0;
    const hasNewChat = newestId > chatLastSeenId && lastRenderedChatIds.length > 0;
    chatLastSeenId = Math.max(chatLastSeenId, newestId);

    const wasAtBottom = chatAtBottom;
    fillMessageList(chatMessages, chatRows, '아직 메시지가 없습니다.');
    fillMessageList(systemMessages, systemRows, '시스템 메시지가 없습니다.');
    lastRenderedChatIds = chatRows.map(row => row.id);

    if (wasAtBottom) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    // Otherwise leave scrollTop untouched — a reader scrolled up in history is never yanked back down.

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

  function renderTeamPlayers() {
    teamPlayers.replaceChildren();
    const bingo = isBingoGame();
    const pictionary = isPictionaryGame();
    const liar = isLiarGame();
    const oldmaid = isOldMaidGame();
    const city = isCityKingGame();
    const marathon = isMarathonGame();
    // Land King is host-started like bingo/oldmaid, so this strip only ever shows seats the
    // engine actually knows about once playing; before start it still lists every open seat.
    const seats = city && state.game.status !== 'selecting' ? (state.game.seatOrder || []) : numberedSeats();
    for (const number of seats) {
      const player = state.players[number];
      const card = document.createElement('div');
      const color = seatColor(number);
      const marathonGroup = marathon ? (state.game.mode === 'team' ? marathonGroupForSeat(number) : number) : null;
      const marathonRoller = marathon && state.game.status === 'playing' && state.game.currentRoller === number;
      const currentTurn = pictionary ? state.game.drawerSeat === number : liar ? state.game.currentSpeaker === number : oldmaid ? state.game.turn === number : bingo ? state.game.turn === number : city ? state.game.turn === number : marathon ? marathonRoller : state.game.nextSeat === number;
      const eliminated = city && state.game.players?.[number]?.eliminated;
      card.className = `teamPlayer ${(bingo || pictionary || liar || oldmaid || city || marathon) ? 'bingoSeat' : color}${seat === number ? ' mySeat' : ''}${currentTurn && state.game.status === 'playing' ? ' myTurn' : ''}${player && !player.connected ? ' disconnected' : ''}${eliminated ? ' disconnected' : ''}`;
      const title = document.createElement('strong');
      title.textContent = pictionary
        ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 출제자' : ''}`
        : liar ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 발언 차례' : ''}`
        : oldmaid ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 뽑기 차례' : ''}`
        : bingo ? `${number}번${currentTurn && state.game.status === 'playing' ? ' · 현재 턴' : ''}`
        : city ? `${number}번${eliminated ? ' · 파산' : currentTurn && state.game.status === 'playing' ? ' · 현재 차례' : ''}`
        : marathon ? `${number}번${state.game.mode === 'team' ? ` · ${marathonGroup}팀` : ''}${marathonRoller ? ' · 굴릴 차례' : ''}`
        : `${number}번 · ${color === 'black' ? '⚫ 흑팀' : '⚪ 백팀'}`;
      const name = document.createElement('small');
      const marathonPos = marathon && state.game.status === 'playing' ? (state.game.positions?.[marathonGroup] ?? 0) : null;
      name.textContent = player
        ? `${player.label}${oldmaid ? ` · ${state.game.counts?.[number] ?? 0}장` : (pictionary || liar) ? ` · ${state.game.scores?.[number] || 0}점` : bingo ? ` · ${state.game.lineCounts?.[number] || 0}줄` : city ? ` · 현금 ${state.game.players?.[number]?.cash ?? 0}` : marathon && marathonPos !== null ? ` · ${marathonPos}칸` : ''} · ${player.connected ? '접속 중' : '연결 끊김'}`
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
    const marathon = isMarathonGame();
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
        : oldmaid ? '2~4명이 자리를 선택할 수 있습니다. 방장이 시작하면 카드를 나누고 짝을 자동으로 버립니다.'
        : bingo
        ? '2~4명이 1~4번 자리를 선택할 수 있습니다. 방장이 승리 줄 수를 정하고 시작합니다.'
        : city ? '2~4명이 1~4번 자리를 선택할 수 있습니다. 방장이 랜드킹을 시작합니다.'
        : marathon ? (state.game.mode === 'team'
            ? `팀전(${state.game.teamLayout || '2v2'})입니다. 아래 자리 번호에 표시된 팀대로 정확한 인원이 자리를 선택해야 합니다.`
            : '2~6명이 자리를 선택할 수 있습니다. 방장이 설정을 정하고 마라톤을 시작합니다.')
        : '1·3번은 흑팀, 2·4번은 백팀입니다. 네 명이 모두 자리를 정하면 1→2→3→4 순서로 시작합니다.';
      for (const button of teamSeatButtons) {
        const number = button.dataset.teamSeat;
        button.classList.toggle('hidden', !seats.includes(number));
        button.textContent = (bingo || pictionary || liar || oldmaid || city) ? `${number}번 자리`
          : marathon ? `${number}번${state.game.mode === 'team' ? ` · ${marathonGroupForSeat(number)}팀` : ''}`
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

    // v1.6.40: a paused, disconnect-affected match takes over the status line for every game type
    // (it used to be shown only for the 4-seat team game); each game's own turn/phase text is only
    // shown while nobody required to act is disconnected.
    const pauseStatusText = g.status === 'playing' && g.paused
      ? `일시정지 · ${(g.disconnectedSeats || []).map((s) => seatKo(s)).join(', ')} 응답 대기`
      : null;
    if (isMarathonGame()) {
      // Marathon has its own dedicated status line (marathonStatus, set inside renderMarathon())
      // since its turn model (roll vs. mission phase, individual seats vs. team groups) doesn't
      // fit this shared ternary chain -- this shared header just needs to not show stale/wrong
      // text borrowed from some other game's fields (g.turn etc. don't exist on marathon's state).
      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '마라톤 자리 선택 · 방장 시작'
        : g.status === 'finished' ? '마라톤 종료'
        : g.phase === 'roll' ? `${marathonGroupLabel(g.turnGroup, g)} 주사위 차례`
        : `${marathonGroupLabel(g.turnGroup, g)} 미션 진행 중`);
    } else if (oldmaid) {
      statusText.textContent = pauseStatusText || (g.status === 'selecting' ? '도둑잡기 자리 선택 · 방장 시작'
        : g.status === 'finished' ? (g.endReason === 'resign' ? '도둑잡기 종료' : `${state.players[g.loser]?.label || '조커 보유자'}님 패배`)
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
          ? `${seatKo(g.turn)} · ${g.phase === 'move' ? `${g.lastThrow?.name || ''}만큼 움직일 말 선택` : '윷 던질 차례'}${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스` : ''}`
          : state.gameType === 'cityking'
            ? `${seatKo(g.turn)} · ${g.phase === 'buy' ? '도시 매입 여부 선택' : '주사위 굴릴 차례'}`
          : `${seatKo(g.turn)} 차례${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스` : ''}`);
    } else if (g.status === 'finished') statusText.textContent = `${seatKo(g.winner)} 승리`;
    else statusText.textContent = '무승부';
    if (g.status === 'finished' && g.endReason === 'disconnect') {
      const names = (g.disconnectedAtEnd || []).map((s) => `${state.players?.[s]?.label || seatKo(s)}`).join(', ');
      statusText.textContent += ` · ${names} 응답 없음으로 종료`;
    } else if (g.status === 'finished' && g.endReason === 'resign') {
      statusText.textContent += ' · 기권으로 종료';
    }
    updatePauseDialog();

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
    const marathon = isMarathonGame();
    canvasWrap.classList.toggle('hidden', baseball || bingo || pictionary || liar || oldmaid || marathon);
    canvasWrap.classList.toggle('connectFour', state.gameType === 'connect4');
    canvasWrap.classList.toggle('yutBoard', yut);
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
    }
    bingoPanel.classList.toggle('hidden', !bingo);
    bingoSetupRow.classList.toggle('hidden', !bingo);
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
    oldmaidPanel.classList.toggle('hidden', !oldmaid);
    oldmaidStartBtn.classList.toggle('hidden', !oldmaid);
    oldmaidModeChooser.classList.toggle('hidden', !oldmaid);
    if (oldmaid) renderOldMaid();
    marathonPanel.classList.toggle('hidden', !marathon);
    marathonStartBtn.classList.toggle('hidden', !marathon);
    marathonConfigChooser.classList.toggle('hidden', !marathon);
    marathonRollBtn.classList.toggle('hidden', !marathon);
    marathonAnswerForm.classList.toggle('hidden', !marathon);
    if (marathon) renderMarathon();
    else if (marathonMemoryHideTimer) { clearTimeout(marathonMemoryHideTimer); marathonMemoryHideTimer = null; marathonMemoryHideKey = null; }
    if (pictionary || liar || oldmaid || marathon) {
      boardOverlay.classList.add('hidden');
    } else if (baseball) {
      boardOverlay.classList.add('hidden');
      renderBaseball();
    } else if (g.status === 'selecting') {
      boardOverlay.classList.remove('resultWin', 'resultLoss');
      const choice = state.me?.choice;
      if (!choice) boardOverlay.textContent = team || city ? '1 · 2 · 3 · 4번 또는 관전을 선택하세요' : state.gameType === 'connect4' ? '빨강 · 노랑 · 관전 중 역할을 선택하세요' : ['yut','dots'].includes(state.gameType) ? '파랑 · 빨강 · 관전 중 역할을 선택하세요' : '흑 · 백 · 관전 중 역할을 선택하세요';
      else if (choice === 'spectator') boardOverlay.textContent = '관전자로 대기 중입니다';
      else boardOverlay.textContent = `${choiceKo(choice)} 선택 완료 · 다른 플레이어를 기다리는 중`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'playing' && g.paused) {
      boardOverlay.classList.remove('resultWin', 'resultLoss');
      boardOverlay.textContent = `일시정지 · ${(g.disconnectedSeats || []).map((s) => seatKo(s)).join(', ')} 플레이어를 기다리는 중`;
      boardOverlay.classList.remove('hidden');
    } else if (g.status === 'finished') {
      if (outcome) setResultBoardOverlay(outcome, g);
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

    drawBoard();
  }

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

  function yutStepsLabel(steps) {
    return steps < 0 ? `${Math.abs(steps)}칸 후진` : `${steps}칸`;
  }

  function renderYut() {
    const g = state.game;
    const mine = Boolean(seat && g.turn === seat && g.status === 'playing');
    yutThrowBtn.disabled = !(mine && g.phase === 'throw') || yutThrowAnimating;
    yutThrowBtn.textContent = mine && g.phase === 'throw' ? '윷 던지기' : '던지기 대기';
    yutLastThrow.textContent = g.lastThrow
      ? `최근 결과: ${g.lastThrow.name} · ${yutStepsLabel(g.lastThrow.steps)}`
      : '아직 던진 윷이 없습니다';
    diceYutResult.textContent = yutLastThrow.textContent;
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
      yutThrowAnimating = true;
      animateYutThrow(yutSticks, flags, {
        onDone: () => { yutThrowAnimating = false; renderYut(); },
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

    if (g.status === 'selecting') yutHint.textContent = '파랑과 빨강이 정해지면 파랑부터 시작합니다.';
    else if (g.status === 'finished') yutHint.textContent = `${seatKo(g.winner)}이 말 4개를 모두 완주했습니다.`;
    else if (!seat) yutHint.textContent = `${seatKo(g.turn)}의 진행을 관전하고 있습니다.${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스(빽도로 물릴 말 없음)` : ''}`;
    else if (g.turn !== seat) yutHint.textContent = `${seatKo(g.turn)} 차례입니다.${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스(빽도로 물릴 말 없음)` : ''}`;
    else if (g.phase === 'throw') yutHint.textContent = '내 차례입니다. 윷을 던져 주세요.';
    else if (g.pendingSteps < 0) yutHint.textContent = `${g.lastThrow?.name || ''} · 한 칸 뒤로 물릴 말을 선택하세요.`;
    else yutHint.textContent = `${g.lastThrow?.name || ''} · ${g.pendingSteps || 0}칸 이동할 말을 선택하세요.`;

    yutMoveChoices.replaceChildren();
    // v1.6.57: hold off on offering move choices until the throw animation (and any still-playing
    // piece-move animation from a prior bonus throw) has fully settled -- otherwise a fast click
    // could select a move before the player has even seen the throw land, which the "던지기가 끝난
    // 후에만 말 이동" requirement rules out. The server already allows the move the instant `phase`
    // flips to 'move'; this only delays the button/choice from *appearing* on screen.
    const moves = mine && g.phase === 'move' && !yutThrowAnimating && !yutPieceAnimation ? (g.legalMoves || []) : [];
    const backward = g.pendingSteps < 0;
    // v1.6.41: distance-focused move-choice text (몇 칸 이동하는지가 핵심 정보) instead of the
    // destination tile number, which meant little without studying the board. The actual move
    // (piece, path, capture/backdo/finish rules) is unchanged -- only this label changed.
    const steps = Math.abs(g.pendingSteps || 0);
    for (const move of moves) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'yutPieceChoice';
      const number = Number(String(move.pieceId).split('-').at(-1));
      const carriedNumbers = (move.carried || [move.pieceId]).map(id => Number(String(id).split('-').at(-1))).sort((a, b) => a - b);
      const pieceLabel = carriedNumbers.length > 1 ? `${carriedNumbers.join('·')}번 말` : `${number}번 말`;
      const moveLabel = backward ? `${steps}칸 뒤로` : `${steps}칸 이동`;
      const statusNote = move.destination?.status === 'finished' ? ' · 완주'
        : move.destination?.position === 'finishLine' ? ' · 완주 직전 칸'
        : '';
      button.textContent = `${pieceLabel} · ${moveLabel}${statusNote}`;
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

  const MARATHON_MISSION_TYPE_KO = { typing: '타이핑', memory: '기억력', reflex: '반응', calculation: '계산' };
  function marathonGroupLabel(group, g) {
    if (!group) return '-';
    return (g?.mode === 'team') ? `${group}팀` : `${group}번`;
  }
  // Deterministic color slot per group, purely for the track markers -- seat numbers 1-6 map to
  // slots 0-5 directly, team letters A/B/C map the same way regardless of which seats compose them.
  function marathonColorSlot(group) {
    const idx = ['A', '1', 'B', '2', 'C', '3', '4', '5', '6'].indexOf(group);
    return idx >= 0 ? idx % 6 : 0;
  }
  function marathonMissionRevealEndsAt(g) {
    if (!g.mission || g.mission.type !== 'memory' || !g.deadlineAt || !g.mission.revealMs) return null;
    return (g.deadlineAt - g.mission.timeLimitMs) + g.mission.revealMs;
  }

  function renderMarathon() {
    const g = state.game;
    // Before start, g.seatOrder is still empty (the engine only fills it in start()) -- the seats
    // actually chosen so far live in state.players, same as every other host-started numbered-seat
    // game checks for its own start-button enable condition.
    const seatCount = g.status === 'selecting'
      ? numberedSeats().filter((number) => state.players[number]).length
      : (g.seatOrder || []).length;
    const layoutOk = g.mode !== 'team' || (g.teamLayout && seatCount === (g.teamLayout === '2v2' ? 4 : 6));
    const individualOk = g.mode !== 'team' ? (seatCount >= 2 && seatCount <= 6) : true;
    marathonStatus.textContent = g.status === 'selecting'
      ? `참가자 ${seatCount}명 · ${g.mode === 'team' ? `팀전(${g.teamLayout || '구성 필요'})` : '개인전'} · 난이도 ${{easy:'쉬움',normal:'보통',hard:'어려움'}[g.difficulty] || g.difficulty}`
      : g.status === 'finished' ? `종료 · ${marathonGroupLabel(Array.isArray(g.winner) ? g.winner[0] : g.winner, g)} 승리`
      : g.phase === 'roll' ? `${marathonGroupLabel(g.turnGroup, g)} 차례 · 주사위를 굴려주세요`
      : `${marathonGroupLabel(g.turnGroup, g)} 미션 진행 중`;
    marathonStartBtn.classList.toggle('hidden', g.status !== 'selecting');
    marathonStartBtn.disabled = !(isHost && g.status === 'selecting' && layoutOk && individualOk);

    marathonConfigChooser.classList.toggle('hidden', g.status !== 'selecting');
    for (const radio of marathonModeRadios) { radio.checked = radio.value === (g.mode || 'individual'); radio.disabled = !isHost; }
    marathonLayoutChooser.classList.toggle('hidden', g.mode !== 'team');
    for (const radio of marathonLayoutRadios) { radio.checked = radio.value === (g.teamLayout || '2v2'); radio.disabled = !isHost; }
    for (const radio of marathonDifficultyRadios) { radio.checked = radio.value === (g.difficulty || 'normal'); radio.disabled = !isHost; }

    // Track: a labeled start tile plus 30 numbered tiles, each showing every group currently
    // standing on it (a tile can hold more than one group's marker at once).
    marathonTrack.replaceChildren();
    const markersFor = (pos) => (g.groupOrder || []).filter((gr) => (g.positions?.[gr] ?? 0) === pos);
    const appendMarkers = (el, pos) => {
      for (const gr of markersFor(pos)) {
        const dot = document.createElement('span');
        dot.className = `marathonMarker marathonMarker-${marathonColorSlot(gr)}`;
        dot.textContent = marathonGroupLabel(gr, g);
        el.appendChild(dot);
      }
    };
    const startTile = document.createElement('div');
    startTile.className = 'marathonTile marathonStartTile';
    const startLabel = document.createElement('span');
    startLabel.className = 'marathonTileNum';
    startLabel.textContent = '출발';
    startTile.appendChild(startLabel);
    appendMarkers(startTile, 0);
    marathonTrack.appendChild(startTile);
    for (let i = 1; i <= 30; i += 1) {
      const tile = document.createElement('div');
      tile.className = 'marathonTile' + (i === 30 ? ' marathonFinishTile' : '');
      const num = document.createElement('span');
      num.className = 'marathonTileNum';
      num.textContent = String(i);
      tile.appendChild(num);
      appendMarkers(tile, i);
      marathonTrack.appendChild(tile);
    }

    // Dice
    marathonRollBtn.classList.toggle('hidden', g.status !== 'playing');
    const canRoll = Boolean(seat && g.status === 'playing' && g.phase === 'roll' && g.myTurn && g.currentRoller === seat);
    marathonRollBtn.disabled = !canRoll;
    marathonTurnLabel.textContent = g.status !== 'playing' ? ''
      : g.phase === 'roll' ? `${marathonGroupLabel(g.turnGroup, g)} 차례${canRoll ? ' · 내 차례!' : ''}`
      : `${marathonGroupLabel(g.turnGroup, g)} 미션 진행 중`;
    const lastRoll = [...(g.history || [])].reverse().find((entry) => entry.type === 'roll');
    marathonLastRoll.textContent = lastRoll ? `마지막 굴림: ${marathonGroupLabel(lastRoll.group, g)} · 🎲${lastRoll.roll} · ${lastRoll.position}칸` : '';

    // Mission
    const missionActive = g.status === 'playing' && g.phase === 'mission' && g.mission;
    marathonMissionBox.classList.toggle('hidden', !missionActive);
    marathonMissionFeedback.classList.add('hidden');
    if (missionActive) {
      const mission = g.mission;
      const canAnswer = Boolean(seat && g.myGroup && g.myGroup === mission.group);
      marathonMissionType.textContent = `${MARATHON_MISSION_TYPE_KO[mission.type] || mission.type} 미션 · ${marathonGroupLabel(mission.group, g)}${canAnswer ? ' · 우리 차례' : ''}`;
      marathonMissionTimer.textContent = g.deadlineAt ? liarCountdownText(g.deadlineAt) : '';

      if (mission.type === 'memory') {
        const revealEndsAt = marathonMissionRevealEndsAt(g);
        const stillRevealing = revealEndsAt && Date.now() < revealEndsAt;
        marathonMissionPrompt.textContent = stillRevealing ? `잘 기억하세요: ${mission.prompt}` : '순서대로 숫자를 입력하세요';
        if (stillRevealing && marathonMemoryHideKey !== g.phaseId) {
          marathonMemoryHideKey = g.phaseId;
          if (marathonMemoryHideTimer) clearTimeout(marathonMemoryHideTimer);
          marathonMemoryHideTimer = setTimeout(renderMarathon, Math.max(50, revealEndsAt - Date.now()));
        }
      } else if (mission.type === 'calculation') {
        marathonMissionPrompt.textContent = `${mission.prompt} = ?`;
      } else if (mission.type === 'typing') {
        marathonMissionPrompt.textContent = `다음 문장을 그대로 입력하세요: "${mission.prompt}"`;
      } else {
        marathonMissionPrompt.textContent = `화면에 표시된 것과 같은 버튼을 누르세요: ${mission.prompt}`;
      }

      const isReflex = mission.type === 'reflex';
      marathonAnswerForm.classList.toggle('hidden', !canAnswer || isReflex);
      marathonAnswerInput.disabled = !canAnswer;
      marathonReflexOptions.classList.toggle('hidden', !canAnswer || !isReflex);
      marathonReflexOptions.replaceChildren();
      if (canAnswer && isReflex) {
        for (const option of mission.options || []) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'secondary marathonReflexBtn';
          button.textContent = option;
          button.addEventListener('click', () => marathonSubmitAnswer(option));
          marathonReflexOptions.appendChild(button);
        }
      }
    } else {
      marathonAnswerForm.classList.add('hidden');
      marathonReflexOptions.classList.add('hidden');
    }

    marathonResult.classList.toggle('hidden', g.status !== 'finished');
    if (g.status === 'finished') {
      const winners = Array.isArray(g.winner) ? g.winner : [g.winner];
      marathonResult.textContent = `🏁 ${winners.map((w) => marathonGroupLabel(w, g)).join(', ')} 승리! 30칸을 먼저 통과했습니다.`;
    }

    marathonHistory.replaceChildren();
    for (const entry of [...(g.history || [])].reverse()) {
      const line = document.createElement('p');
      if (entry.type === 'roll') line.textContent = `${marathonGroupLabel(entry.group, g)} · 주사위 ${entry.roll} · ${entry.position}칸 도착`;
      else if (entry.type === 'mission-success') line.textContent = `${marathonGroupLabel(entry.group, g)} · ${MARATHON_MISSION_TYPE_KO[entry.missionType] || entry.missionType} 미션 성공`;
      else if (entry.type === 'mission-timeout') line.textContent = `${marathonGroupLabel(entry.group, g)} · ${MARATHON_MISSION_TYPE_KO[entry.missionType] || entry.missionType} 미션 시간 초과 · 2칸 후퇴`;
      else if (entry.type === 'finish') line.textContent = `🏁 ${marathonGroupLabel(entry.group, g)} 결승선 통과!`;
      else continue;
      marathonHistory.appendChild(line);
    }
    if (!(g.history || []).length) marathonHistory.textContent = '아직 진행된 기록이 없습니다.';
  }

  async function marathonSubmitAnswer(answer) {
    if (!state?.game || state.game.phase !== 'mission') return;
    const phaseId = state.game.phaseId;
    const attemptsBefore = state.game.mission?.attempts ?? 0;
    await roomAction('answer-marathon', { answer, expectedPhaseId: phaseId });
    if (state?.gameType !== 'marathon') return;
    const g = state.game;
    // Same phaseId with more attempts than before means this specific submission was wrong (the
    // mission stayed open for retry); a phaseId/phase change means it either succeeded or the
    // deadline moved on, and renderMarathon() already reflects that -- no feedback needed there.
    if (g.phase === 'mission' && g.phaseId === phaseId && (g.mission?.attempts ?? 0) > attemptsBefore) {
      marathonMissionFeedback.textContent = '오답입니다. 다시 시도해 보세요.';
      marathonMissionFeedback.classList.remove('hidden');
      marathonAnswerInput.value = '';
      marathonAnswerInput.focus();
    }
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
    // A resign ends the game mid-round, before liar.js ever computes lastResult (no vote or reveal
    // happened) -- so this box would otherwise just stay empty with no explanation.
    const resignedFinish = g.status === 'finished' && g.endReason === 'resign' && !result;
    liarResult.classList.toggle('hidden', !result && !resignedFinish);
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
    for (const card of hand) {
      const red = card.suit === '♥' || card.suit === '♦';
      const face = document.createElement('span');
      face.className = 'oldmaidCard oldmaidFace' + (card.rank === 'JOKER' ? ' joker' : red ? ' red' : '');
      face.textContent = card.rank === 'JOKER' ? '🃏 조커' : `${card.suit} ${card.rank}`;
      face.setAttribute('aria-label', card.rank === 'JOKER' ? '조커' : `${card.suit} ${card.rank}`);
      face.dataset.cardId = card.id;
      oldmaidMyHand.appendChild(face);
    }
  }

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
      oldmaidLastHistoryLen = 0;
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
    const iAmSeated = Boolean(seat && rosterSeats.includes(seat));
    const rotated = oldmaidRotatedSeats(rosterSeats, iAmSeated ? seat : null);
    const opponents = iAmSeated ? rotated.slice(1) : rotated;
    const COMPASS_ORDER = ['north', 'east', 'west'];
    oldmaidSeatsEl.replaceChildren();
    opponents.forEach((number, index) => {
      const count = g.counts?.[number] ?? 0;
      const isLoser = g.status === 'finished' && number === g.loser;
      const escaped = g.status !== 'selecting' && count === 0 && !isLoser;

      const seatEl = document.createElement('div');
      seatEl.className = 'oldmaidSeat'
        + (g.turn === number ? ' turn' : '') + (g.target === number ? ' target' : '')
        + (escaped ? ' escaped' : '') + (isLoser ? ' finalGlow' : '');
      seatEl.dataset.seat = number;
      seatEl.dataset.compass = COMPASS_ORDER[index] || 'north';

      const info = document.createElement('div');
      info.className = 'oldmaidSeatInfo';
      const nameSpan = document.createElement('span');
      nameSpan.textContent = label(number);
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

      {
        if (count > 0) {
          const cards = document.createElement('div');
          cards.className = 'oldmaidSeatCards';
          const canDraw = Boolean(seat && g.status === 'playing' && g.turn === seat && g.target === number);
          for (let cardIndex = 0; cardIndex < count; cardIndex += 1) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'oldmaidCard oldmaidBack' + (canDraw ? ' selectable' : '');
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
  }

  // One-shot decorative flourishes, all derived from state the server already confirmed
  // (history entries, counts, status/loser) -- never a source of truth, and always safe to
  // skip if effects are off or the relevant seat element isn't on screen.
  function oldmaidRunEffects(g) {
    const history = g.history || [];
    if (!oldmaidEffectsActive()) {
      oldmaidLastHistoryLen = history.length;
      for (const number of g.seatOrder || []) if ((g.counts?.[number] ?? 1) === 0) oldmaidSeenEscaped.add(number);
      if (g.status === 'finished') oldmaidSeenFinishedKey = `${g.round}:${g.loser}`;
      return;
    }
    if (history.length > oldmaidLastHistoryLen) {
      for (const entry of history.slice(oldmaidLastHistoryLen)) {
        if (entry.pairs > 0) oldmaidShowPairEffect(entry.actor, entry.pairs);
      }
    }
    oldmaidLastHistoryLen = history.length;

    for (const number of g.seatOrder || []) {
      const emptied = (g.counts?.[number] ?? 1) === 0 && !(g.status === 'finished' && number === g.loser);
      if (emptied && !oldmaidSeenEscaped.has(number)) {
        oldmaidSeenEscaped.add(number);
        oldmaidShowEscapeEffect(number);
      }
    }

    if (g.status === 'finished') {
      const key = `${g.round}:${g.loser}`;
      if (oldmaidSeenFinishedKey !== key) oldmaidSeenFinishedKey = key;
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
      flyer.textContent = oldmaidCardFaceText(card);
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
        const afterHand = state.me?.myOldMaidHand || [];
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

  function drawBoard() {
    if (state?.gameType === 'baseball' || state?.gameType === 'bingo' || state?.gameType === 'pictionary' || state?.gameType === 'liar' || state?.gameType === 'oldmaid' || state?.gameType === 'marathon') return;
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
      // The finish line sits right where the outer ring closes back on the start corner.
      finishLine:[630,630],
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
    // v1.6.41: the start/finish tile (node 0) gets a solid, high-contrast blue fill instead of the
    // shared brown corner style, so it reads at a glance without a text label. The "지름길"/"출발 ·
    // 완주" labels that used to float over the board's center and start corner were removed -- the
    // path lines and this tile's distinct color already show the same information, and the finish
    // count is already shown in the score row above the board.
    const nodes = [...new Set(paths.flat())];
    for (const node of nodes) {
      const [x,y] = yutNodePosition(node);
      const isStart = node === 0;
      const corner = [0,5,10,15,23].includes(node);
      if (isStart) {
        ctx.fillStyle = '#1d4ed8';
        ctx.beginPath(); ctx.arc(x,y,30,0,Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#fef9c3';
        ctx.lineWidth = 4;
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = corner ? '#7c3f17' : '#9a5b27';
      ctx.beginPath(); ctx.arc(x,y,corner ? 25 : 18,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f8e7bf';
      ctx.beginPath(); ctx.arc(x,y,corner ? 15 : 10,0,Math.PI*2); ctx.fill();
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
        if (pieces.length) drawPieceStack(yutPieceAnimation.x, yutPieceAnimation.y, color, pieces);
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
    if (canvas.width !== CITY_CANVAS_W || canvas.height !== CITY_CANVAS_H) {
      canvas.width = CITY_CANVAS_W;
      canvas.height = CITY_CANVAS_H;
    }
    const bg = ctx.createLinearGradient(0, 0, CITY_CANVAS_W, CITY_CANVAS_H);
    bg.addColorStop(0, '#172554');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CITY_CANVAS_W, CITY_CANVAS_H);
    // v1.6.56: #cityActionPanel (start/roll/buy/build controls) moved off the board into the
    // sidebar's #gameActionsPanel, so this interior space is no longer a DOM overlay -- restored to
    // a canvas-drawn status readout (turn/phase + last roll), reusing #cityTurnSummary/#cityLastRoll's
    // own already-computed text (renderCityControls() always runs immediately before this in every
    // render path, see its call sites) rather than recomputing the same turn/phase logic twice.
    const cityCenterX = CITY_PAD_X + 5 * CITY_STEP_X;
    const cityCenterY = CITY_PAD_Y + 3 * CITY_STEP_Y;
    ctx.fillStyle = 'rgba(15,23,42,.55)';
    ctx.fillRect(CITY_PAD_X + CITY_STEP_X, CITY_PAD_Y + CITY_STEP_Y, 8 * CITY_STEP_X, 4 * CITY_STEP_Y);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fde68a';
    ctx.font = '900 20px Inter, Pretendard, sans-serif';
    ctx.fillText('랜드킹', cityCenterX, cityCenterY - 24);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '700 15px Inter, Pretendard, sans-serif';
    ctx.fillText(cityTurnSummary.textContent, cityCenterX, cityCenterY + 6);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px Inter, Pretendard, sans-serif';
    ctx.fillText(cityLastRoll.textContent, cityCenterX, cityCenterY + 30);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    const CITY_TYPE_BG = { start: '#bbf7d0', property: '#dbeafe', event: '#fef3c7', tax: '#fee2e2', rest: '#e2e8f0' };
    const CITY_TYPE_ICON = { start: '🚩', property: '🏙️', event: '🎁', tax: '💰', rest: '☕' };
    const CITY_BUILD_ICON = ['🏠', '🏡', '🏢', '🏨'];
    const CITY_PLAYER_COLORS = { '1': '#2563eb', '2': '#ef4444', '3': '#16a34a', '4': '#9333ea' };
    // A continuous walking-path strip along the top/bottom rows, drawn *behind* the tiles: each
    // tile's own box covers the strip within its footprint, so only the gaps between tiles show
    // it -- reading as one connected road through the 4 decorative filler positions per row
    // instead of isolated blank patches.
    ctx.strokeStyle = 'rgba(148,163,184,.4)';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(CITY_PAD_X, CITY_PAD_Y);
    ctx.lineTo(CITY_PAD_X + 10 * CITY_STEP_X, CITY_PAD_Y);
    ctx.moveTo(CITY_PAD_X, CITY_PAD_Y + 6 * CITY_STEP_Y);
    ctx.lineTo(CITY_PAD_X + 10 * CITY_STEP_X, CITY_PAD_Y + 6 * CITY_STEP_Y);
    ctx.stroke();
    for (const tile of g.tiles || []) {
      const [x, y] = cityCellPosition(tile.index);
      const owner = g.owners?.[tile.index];
      ctx.fillStyle = CITY_TYPE_BG[tile.type] || '#e2e8f0';
      ctx.fillRect(x - 39, y - 39, 78, 78);
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
          ctx.font = '13px system-ui, sans-serif';
          ctx.fillText(CITY_BUILD_ICON[level], x - 20, y - 29);
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
      ctx.fillStyle = CITY_PLAYER_COLORS[color] || '#64748b';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x + ox, y + oy, 10, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '950 10px system-ui, sans-serif';
      const initial = (state.players?.[color]?.label || `${color}번`)[0] || color;
      ctx.fillText(initial, x + ox, y + oy + 1);
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
      if (data.state) {
        state = data.state;
        renderRoom();
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
    if (chatLockedForHints()) return;
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
  yutThrowBtn.addEventListener('click', async () => {
    yutThrowBtn.disabled = true;
    await roomAction('throw-yut');
    if (state?.gameType === 'yut') renderYut();
  });
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

  for (const radio of marathonModeRadios) {
    radio.addEventListener('change', () => roomAction('set-marathon-config', { mode: radio.value }));
  }
  for (const radio of marathonLayoutRadios) {
    radio.addEventListener('change', () => roomAction('set-marathon-config', { teamLayout: radio.value }));
  }
  for (const radio of marathonDifficultyRadios) {
    radio.addEventListener('change', () => roomAction('set-marathon-config', { difficulty: radio.value }));
  }
  marathonStartBtn.addEventListener('click', () => roomAction('start-marathon'));
  marathonRollBtn.addEventListener('click', async () => {
    const expectedPhaseId = state?.game?.phaseId;
    marathonRollBtn.disabled = true;
    await roomAction('roll-marathon', { expectedPhaseId });
  });
  marathonAnswerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const answer = marathonAnswerInput.value.trim();
    if (!answer) return;
    marathonAnswerInput.disabled = true;
    try { await marathonSubmitAnswer(answer); marathonAnswerInput.value = ''; }
    finally { marathonAnswerInput.disabled = false; }
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
  setInterval(() => {
    if (state?.gameType !== 'marathon' || marathonPanel.classList.contains('hidden')) return;
    if (state.game.phase !== 'mission' || !state.game.deadlineAt) return;
    marathonMissionTimer.textContent = liarCountdownText(state.game.deadlineAt);
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
