const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const { getGame, hasGame, pointPolicy } = require('./lib/games');
const { buildActionTimer, currentTurnSeat } = require('./lib/action-timer');
const TEAM_SEATS = ['1', '2', '3', '4'];
const PICTIONARY_SEATS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const OLDMAID_SEATS = ['1', '2', '3', '4'];
const HALLI_SEATS = ['1', '2', '3', '4', '5', '6'];
const isTeam = (room) => room.gameType === 'omok2v2';
const isBingo = (room) => room.gameType === 'bingo';
const isPictionary = (room) => room.gameType === 'pictionary';
const isTwenty = (room) => room.gameType === 'twentyquestions';
const isDavinci = (room) => room.gameType === 'davinci';
const isHalli = (room) => room.gameType === 'halligalli';
const isPandemic = (room) => room.gameType === 'pandemic';
const isLiar = (room) => room.gameType === 'liar';
const isOldMaid = (room) => room.gameType === 'oldmaid';
const isCityKing = (room) => room.gameType === 'cityking';
const isGostop = (room) => room.gameType === 'gostop';
const isRpg = (room) => room.gameType === 'rpg';
const GOSTOP_SEATS = ['1', '2', '3'];
const isNumberedSeatGame = (room) => isRpg(room) || isGostop(room) || isTeam(room) || isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isTwenty(room) || isDavinci(room) || isHalli(room) || isPandemic(room);
const seatsFor = (room) => isGostop(room) ? GOSTOP_SEATS : isHalli(room) ? HALLI_SEATS : (isDavinci(room) || isPandemic(room)) ? OLDMAID_SEATS : isOldMaid(room) ? OLDMAID_SEATS : (isPictionary(room) || isLiar(room) || isTwenty(room)) ? PICTIONARY_SEATS : TEAM_SEATS;
const teamColor = (seat) => TEAM_SEATS.includes(String(seat)) ? (Number(seat) % 2 ? 'black' : 'white') : null;
// Seats actually holding a player, for any room type -- the generic set connection-drop handling
// (pause detection, disconnect-forced ending) operates over.
const assignedSeatsFor = (room) => isNumberedSeatGame(room)
  ? seatsFor(room).filter(seat => room.players[seat])
  : ['black', 'white'].filter(color => room.players[color]);
const { createAccessStore, hashPassword, verifyPassword, normalizeLoginId, loginIdOk } = require('./lib/access-store');
const { createAnnouncementStore } = require('./lib/announcement-store');
const { createMessengerStore } = require('./lib/messenger-store');
const { createMatchStore } = require('./lib/match-records');
const { buildMatchResult, matchSeats, winningSeats } = require('./lib/match-result');
const { toastLines, weeklyToastLines, weekStart } = require('./lib/missions');
const Minesweeper = require('./lib/minesweeper'); // v1.10.37 혼자 하는 게임
const Reflex = require('./lib/reflex'); // v1.10.68 순발력 게임
const PuzzleDaily = require('./lib/puzzle-daily'); // v1.10.69 오늘의 문제
const Cards = require('./lib/cards'); // v1.10.70 카드 게임
const GameRanking = require('./lib/game-ranking'); // v1.10.71 게임별 랭킹
const RoomAi = require('./lib/room-ai');
const IslandWeather = require('./lib/island-weather'); // A4 날씨
const IslandStars = require('./lib/island-stars'); // A4 별똥별
const IslandContest = require('./lib/island-contest'); // A4 주말 섬 대회
const Together = require('./lib/island-together'); // B 47 생일·우체통
const SERVER_VERSION = require('./package.json').version; // (관리자 「문제 기록」에 붙는 버전)
const IslandInsects = require('./lib/island-insects'); // B 47 곤충 채집
const bugSwings = new Map(); // session token -> the swing (one at a time)
const petOf = new Map(); // B 47 반려동물: account -> { kind, name } | null (read from its 'pet' doc once)
const PET_KINDS = ['puppy', 'kitten', 'bird'];
const IslandPlants = require('./lib/island-plants'); // B 45 꽃·나무 심기 // v1.10.72 게임방 AI 자리
const IslandQuests = require('./lib/island-quests'); // v1.10.37 연계 퀘스트
const IslandErrands = require('./lib/island-errands'); // v1.10.91 주민 심부름
const Economy = require('./lib/economy'); // v1.10.91 경제 값 관리
require('./lib/island-items').setPriceHook(Economy.priceOf);
const IslandCast = require('./public/plaza/island-cast'); // v1.10.91 주민 이름·대사
const IslandNpcs = require('./public/plaza/island-npcs');
const IslandStore = require('./public/plaza/island-store'); // v1.10.92 잡화점
const IslandFurniture = require('./public/plaza/island-furniture'); // 묶음 2 가구점 (백화점 2층)
const IslandFishing = require('./lib/island-fishing'); // v1.10.42 낚시·도감
const { skinById, familyOf, catalogView, badgesOf, avatarLookOf, FAMILY_NAMES, SLOTS: SKIN_SLOTS, SURGERY_FEE, DYE_FEE, FACE_PARTS, FACE_LABELS, DYE_PALETTE, DYEABLE, BODY_DYES, SKIN_TONES, bodyDyeColor, faceDesign, dyeColor, transformationById, transformationModeAllowed } = require('./lib/skins');
const ClimbSim = require('./public/climb/climb-sim.js');
const IslandTerrain = require('./public/plaza/island-terrain.js');
const { poseTime } = require('./lib/plaza-pose-time');
const IslandTrain = require('./public/plaza/island-train.js'); // v1.10.47 관광열차
const IslandItems = require('./lib/island-items'); // v1.10.10 게임 아일랜드 이벤트 인벤토리
const { createIslandEvents } = require('./lib/island-events'); // v1.10.11 서버 공용 랜덤 이벤트 // v1.10.7: the island's shape, shared with the browser
const { competitionRanking, climbWeekOf, previousWeek } = require('./lib/climb');
const nextWeekOf = (week) => new Date(Date.parse(`${week}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10); // v1.10.89
const { evaluate: evaluateAchievements, achievementView, achievementToasts } = require('./lib/achievements');
const { EVENTS: POINT_EVENTS, validateEvent, eventStatus, publicEvent } = require('./lib/point-events');
const { donationRanking, createPointStore, validUserId, kstDate, DONATION_MAX, NICKNAME_FEE, ENTRY_FEE, ENTRY_BURN_PERCENT, SETTLEMENT_BURN_PERCENT, ADMIN_GRANT_UNIT, ADMIN_GRANT_MAX, ADMIN_GRANT_CATEGORIES } = require('./lib/point-store');
const PointStore = require('./lib/point-store'); // v1.10.86 주민세 constants
const SkinCatalog = require('./lib/skins'); // v1.10.90 IP_SKIN_IDS / IP_ON
const releaseAnnouncements = require('./lib/release-announcements');
const { classifyBrowser, parseSecChUa } = require('./public/browser-gate.js'); // v1.10.14 Chrome-only, shared with the page
const { buildAssetManifest } = require('./lib/asset-manifest'); // v1.10.14 game resource pack
const { buildCodeManifest, prepareIndex, codeCacheHeaders, hashedUrl } = require('./lib/code-manifest'); // v1.10.24 code hash URLs
const {
  MAX_CHAT_LENGTH,
  createRoomSocial,
  appendSystemMessage,
  appendChatMessage,
  publicChatMessages,
} = require('./lib/room-social');
const {
  generateRoomCode,
  normalizeRoomCode,
  newSecret,
  safeEqualText,
  sanitizeLabel,
  safeFilename,
  makeGuestFile,
} = require('./lib/security');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATABASE_URL = process.env.DATABASE_URL || '';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
// v1.10.14: the game center is Google Chrome only. Tests also admit Playwright's unbranded Chromium and plain HTTP
// clients ('other'); Edge is never admitted. ALLOWED_BROWSERS (space separated) overrides, e.g. for the gate test.
const ALLOWED_BROWSERS = String(process.env.ALLOWED_BROWSERS || (process.env.NODE_ENV === 'test' ? 'chrome chromium other' : 'chrome ios')).split(/\s+/).filter(Boolean);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? '' : 'dev-admin');
const MAX_BODY = 48 * 1024;
const SESSION_IDLE_MS = Math.max(10, Number(process.env.SESSION_IDLE_MINUTES || 60)) * 60 * 1000;
const SESSION_MAX_MS = Math.max(1, Number(process.env.SESSION_MAX_HOURS || 8)) * 60 * 60 * 1000;
// v1.10.35 무입력 로그아웃 (IDEAS, 사용자 확정 2026-10-06): 30 minutes without a real input -- a key, the mouse, a click or
// a touch -- ends the session, for everyone (players in a match, spectators, the island, admins). The page reports an
// input at most once a minute (POST /api/session/input); an open stream's pings and other requests do not count.
const INPUT_IDLE_MS = 30 * 60 * 1000;
const INPUT_IDLE_MESSAGE = '30분 동안 입력이 없어 로그아웃되었습니다.';
const ROOM_TTL_MS = Math.max(2, Number(process.env.ROOM_TTL_HOURS || 12)) * 60 * 60 * 1000;
const GUEST_LOCK_TTL_MS = Math.max(30, Number(process.env.GUEST_LOCK_TTL_SECONDS || 90)) * 1000;
// v1.6.99: a page's pagehide release is deferred this long, so a browser refresh can resume the
// same session (the tab keeps its token in sessionStorage) instead of dropping back to the gate.
const SESSION_RELEASE_GRACE_MS = Math.max(1000, Number(process.env.SESSION_RELEASE_GRACE_MS || 10000));
// Overridable only so tests don't have to wait a real minute; production always gets the 60s/5s
// defaults below.
const AFK_TIMEOUT_MS = Math.max(200, Number(process.env.AFK_TIMEOUT_MS) || 60_000);
const AFK_TICK_MS = Math.max(50, Number(process.env.AFK_TICK_MS) || 5000);

if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD 환경변수가 필요합니다.');
  process.exit(1);
}

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8', // v1.10.66 홈 화면 앱
  // v1.10.15 3D asset pipeline: glTF models and the files a .gltf refers to (buffers, textures)
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  // v1.10.61 두 세계 영웅전: only for a local copy of the big files (public/herosurv, gitignored); the live ones are on R2
  '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream',
};

const sessions = new Map(); // token -> session
const activeGuestSessions = new Map(); // guestKeyId -> sessionToken
const rooms = new Map(); // roomId -> room
const streams = new Map(); // roomId -> Set<{res, sessionToken}>
const lobbyStreams = new Set(); // Set<{res, sessionToken}>
const lobbySocial = { social: createRoomSocial() }; // memory-only, never persisted
const LOBBY_CHAT_MESSAGES = 50;
const rateLimits = new Map();
const invitations = new Map(); // inviteId -> {fromToken,toToken,roomId,createdAt}; memory-only
const islandInviteIntents = new Map(); // short-lived proximity check before making a game room
const INVITE_TTL_MS = 2 * 60 * 1000;
let accessStore;
let announcementStore;
let messengerStore;
let matchStore;
let pointStore;
// v1.7.30 skins: each account's equipped skins, kept in memory so the (synchronous) room view can share them with
// everyone in the room. Loaded when a session is created and replaced on every equip; the store is the truth.
const equippedSkinCache = new Map(); // point account -> { <family>: { piece, theme } }
async function loadEquippedSkins(account) {
  try { equippedSkinCache.set(account, (await pointStore.skinState(account)).equipped); }
  catch (error) { console.error('스킨 장착 정보 불러오기 실패:', error.message); }
}
function equippedSkin(account, family, slot) {
  const id = account && equippedSkinCache.get(account)?.[family]?.[slot];
  return id && skinById(id) ? id : null; // only skins the catalog knows are ever shared
}
// The point account behind a room identity (`guest:<key id>` or `admin:<public id>`).
function accountOfIdentity(identity) { return typeof identity === 'string' ? (identity.startsWith('guest:') ? identity : 'admin') : null; }
// v1.7.20 point-reward events (lib/point-events.js). The test server never offers the real, date-bound
// events, so its results do not depend on the day the tests run; tests register their own through
// /api/test/events and may restrict one to a single account (eventAudience).
const eventRegistry = process.env.NODE_ENV === 'test' ? [] : [...POINT_EVENTS];
const eventAudience = new Map();
// v1.7.20/17: the test server only pays missions and achievements to accounts a test opted in
// (/api/test/missions or /api/test/rewards), so the exact-balance point tests are not affected by the
// first-win bonus and the other payouts.
const rewardTestAccounts = new Set();
function eventsForAccount(userId) { return eventRegistry.filter(event => !eventAudience.has(event.id) || eventAudience.get(event.id).has(userId)); }
let indexTemplate = '';
let herosurvTemplate = '';
const HEROSURV_ASSETS = (process.env.HEROSURV_ASSETS ?? 'https://gamecenter-games.dlrjs9702.workers.dev').replace(/\/$/, '');
// v1.10.24 (lib/code-manifest.js): the code files' content hashes and the page's import map CSP hash source
let codeRevs = new Map();
let importMapCsp = '';
// v1.10.14 resource pack (lib/asset-manifest.js) and its emergency off switch: ASSET_CACHE=off (Render environment, no
// code change) sends every page the "off" manifest, so browsers drop the worker and the gc-res:* caches and load assets
// from the server as before. Pages and /asset-cache.json are no-store, so a change reaches browsers on their next load.
let assetCacheEnabled = !/^(off|false|0)$/i.test(process.env.ASSET_CACHE || '');
// v1.10.15: island 3D models switched off one by one without a code change (ISLAND_ASSETS_OFF=facility.townhall,...
// or * for all); those targets keep their procedural look (public/plaza/asset-pipeline.js)
const islandAssetsOff = String(process.env.ISLAND_ASSETS_OFF || '').split(',').map((id) => id.trim()).filter(Boolean);
const assetManifestJson = { on: '', off: JSON.stringify({ enabled: false, version: '', assets: [], assetsOff: islandAssetsOff }) };
let assetPackVersion = '';

function nowIso() { return new Date().toISOString(); }
function nowMs() { return Date.now(); }
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function publicBaseUrl(req) {
  // Render's own public URL is authoritative even when an older PUBLIC_BASE_URL
  // still points at the Worker. Never derive an entry file's target from a
  // forwarded Host in production.
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '');
  // v1.7.22: Render also always provides the bare hostname; use it when the full URL variable is missing.
  if (process.env.RENDER_EXTERNAL_HOSTNAME) return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || (IS_PRODUCTION ? 'https' : 'http')).split(',')[0].trim();
  const host = req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function securityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Content-Security-Policy': `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'${importMapCsp ? ` ${importMapCsp}` : ''}; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
    ...extra,
  };
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, securityHeaders({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  }));
  res.end(body);
}

function sendError(res, status, code, message, extra = {}) {
  sendJson(res, status, { error: code, message, ...extra });
}

function escapeAttr(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function sendIndex(res, bootstrap = {}) {
  const html = indexTemplate
    .replace('__SESSION_TOKEN__', escapeAttr(bootstrap.sessionToken || ''))
    .replace('__SESSION_ROLE__', escapeAttr(bootstrap.role || ''))
    .replace('__SESSION_LABEL__', escapeAttr(bootstrap.label || ''))
    .replace('__SETUP_TICKET__', escapeAttr(bootstrap.setupTicket || ''))
    .replace('__BROWSERS__', escapeAttr(ALLOWED_BROWSERS.join(' ')))
    .replace('__ASSET_MANIFEST__', () => (assetCacheEnabled ? assetManifestJson.on : assetManifestJson.off));
  res.writeHead(200, securityHeaders({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
  }));
  res.end(html);
}

// v1.10.61 두 세계 영웅전 page: the asset host it fetches the big files from is the one other origin it may connect to;
// blob: images are the engine's own (cursor, icon). An empty HEROSURV_ASSETS reads them from public/herosurv (local dev).
function sendHerosurv(res) {
  const assetOrigin = HEROSURV_ASSETS ? ` ${new URL(HEROSURV_ASSETS).origin}` : '';
  res.writeHead(200, securityHeaders({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(herosurvTemplate),
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'SAMEORIGIN', // (사용자 2026-10-19: opened in a window over the island, our own page only)
    'Content-Security-Policy': `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; connect-src 'self'${assetOrigin}; img-src 'self' data: blob:; base-uri 'none'; frame-ancestors 'self'; form-action 'self'`,
  }));
  res.end(herosurvTemplate);
}

// v1.10.14: page requests from a browser outside ALLOWED_BROWSERS get only the Chrome notice. Checked before a guest
// entry file is validated, so opening it in Edge first neither records a use nor holds the key for the Chrome tab.
function browserBlocked(req) {
  return !ALLOWED_BROWSERS.includes(classifyBrowser({ brands: parseSecChUa(req.headers['sec-ch-ua']), ua: req.headers['user-agent'] }));
}
function sendChromeOnly(res) { sendSimpleHtml(res, 403, 'Chrome 전용', 'Google Chrome으로 접속해 주세요. 아이폰은 Safari나 Chrome으로 접속할 수 있습니다.'); }

function sendSimpleHtml(res, status, title, message) {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeAttr(title)}</title><style>body{font-family:system-ui,sans-serif;background:#111827;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}.box{max-width:460px;padding:30px;background:#1f2937;border-radius:20px;text-align:center}p{color:#d1d5db;line-height:1.6}</style></head><body><div class="box"><h1>${escapeAttr(title)}</h1><p>${escapeAttr(message)}</p></div></body></html>`;
  res.writeHead(status, securityHeaders({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
  }));
  res.end(html);
}

// Third-party browser modules served from node_modules (same origin: the page CSP allows only
// 'self' scripts). Exact allow-list, nothing else under node_modules is reachable.
const THREE_ADDONS = path.join(__dirname, 'node_modules', 'three', 'examples', 'jsm');
const VENDOR_FILES = {
  '/vendor/three/three.module.js': path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.js'),
  '/vendor/three/three.core.js': path.join(__dirname, 'node_modules', 'three', 'build', 'three.core.js'),
  // v1.10.15: the glTF loader and what it imports (public/plaza/asset-loader.js), from the same three package
  '/vendor/three/addons/loaders/GLTFLoader.js': path.join(THREE_ADDONS, 'loaders', 'GLTFLoader.js'),
  '/vendor/three/addons/utils/BufferGeometryUtils.js': path.join(THREE_ADDONS, 'utils', 'BufferGeometryUtils.js'),
  '/vendor/three/addons/utils/SkeletonUtils.js': path.join(THREE_ADDONS, 'utils', 'SkeletonUtils.js'),
  // v1.10.26: the Meshopt decoder for the pipeline's compressed models (WebAssembly inside; CSP 'wasm-unsafe-eval')
  '/vendor/three/addons/libs/meshopt_decoder.module.js': path.join(THREE_ADDONS, 'libs', 'meshopt_decoder.module.js'),
};
// v1.10.24: served as they are -- the addons' bare 'three' resolves through the page's import map to the very module
// URL the game imports (one Three.js instance, shared classes); no rewriting.

const vendorCache = new Map();
// v1.10.24 code cache rule: immutable for the current hash, otherwise no-cache with an ETag (and 304 when it matches).
function codeHeaders(req, pathname) {
  return codeCacheHeaders(codeRevs, pathname, new URL(req?.url || '/', 'http://local').search);
}
function notModified(req, res, headers) {
  // a proxy (Cloudflare) may weaken the tag it passes on (W/"..."): the same file either way
  const sent = String(req?.headers?.['if-none-match'] || '').split(',').map((tag) => tag.trim().replace(/^W\//, ''));
  if (!headers?.ETag || !sent.includes(headers.ETag)) return false;
  res.writeHead(304, securityHeaders(headers));
  res.end();
  return true;
}

async function serveVendor(req, res, pathname) {
  const filePath = VENDOR_FILES[pathname];
  if (!filePath) return false;
  const cache = codeHeaders(req, pathname) || { 'Cache-Control': 'no-cache' };
  if (notModified(req, res, cache)) return true;
  let entry = vendorCache.get(pathname);
  if (!entry) {
    try {
      const raw = await fsp.readFile(filePath);
      entry = { raw, gz: require('node:zlib').gzipSync(raw, { level: 9 }) };
      vendorCache.set(pathname, entry);
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }
  const gzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] || ''));
  const body = gzip ? entry.gz : entry.raw;
  res.writeHead(200, securityHeaders({ 'Content-Type': MIME['.js'], 'Content-Length': body.length, ...cache, Vary: 'Accept-Encoding',
    ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) }));
  res.end(body);
  return true;
}

// v1.8.6: the public hwatu card faces (public/hwatu/*.svg, CC BY-SA 4.0) never change, so they are served gzipped
// from memory with a long cache instead of being re-downloaded (~2.7 MB for the deck) on every page load.
const hwatuCache = new Map();
async function serveHwatu(req, res, relative) {
  if (!/^hwatu\/[a-z0-9-]+\.svg$/.test(relative)) return false;
  let entry = hwatuCache.get(relative);
  if (!entry) {
    try {
      const raw = await fsp.readFile(path.join(PUBLIC_DIR, relative));
      entry = { raw, gz: require('node:zlib').gzipSync(raw, { level: 9 }) };
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
    hwatuCache.set(relative, entry);
  }
  const gzip = /\bgzip\b/.test(String(req?.headers?.['accept-encoding'] || ''));
  const body = gzip ? entry.gz : entry.raw;
  res.writeHead(200, securityHeaders({ 'Content-Type': MIME['.svg'], 'Content-Length': body.length, 'Cache-Control': 'public, max-age=604800', Vary: 'Accept-Encoding',
    ...(gzip ? { 'Content-Encoding': 'gzip' } : {}) }));
  res.end(body);
  return true;
}

async function serveStatic(res, pathname, req = null) {
  const relative = pathname.replace(/^\//, '');
  if (!relative || relative.includes('..')) return false;
  if (relative.startsWith('hwatu/')) return serveHwatu(req, res, relative);
  const filePath = path.join(PUBLIC_DIR, relative);
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    if (!MIME[ext]) return false;
    const cache = codeHeaders(req, pathname) || { 'Cache-Control': 'no-cache' }; // v1.10.24: code by hash
    if (notModified(req, res, cache)) return true;
    res.writeHead(200, securityHeaders({
      'Content-Type': MIME[ext],
      'Content-Length': stat.size,
      ...cache,
    }));
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function parseJson(req) {
  if (Object.hasOwn(req, 'islandParsedJson')) return req.islandParsedJson;
  const raw = await readBody(req);
  if (!raw) return (req.islandParsedJson = {});
  try { return (req.islandParsedJson = JSON.parse(raw)); }
  catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
}

async function parseForm(req) {
  const raw = await readBody(req);
  return Object.fromEntries(new URLSearchParams(raw));
}

function checkRateLimit(key, limit, windowMs) {
  const now = nowMs();
  const row = rateLimits.get(key);
  if (!row || now - row.startedAt >= windowMs) {
    rateLimits.set(key, { startedAt: now, count: 1 });
    return true;
  }
  row.count += 1;
  return row.count <= limit;
}

function createSession({ role, label, guestKeyId = null }) {
  const token = newSecret(32);
  const t = nowMs();
  const session = {
    token,
    publicId: newSecret(16), // safe lobby identifier; never expose session token
    role,
    label,
    guestKeyId,
    createdAt: t,
    lastSeen: t,
    leaseSeenAt: t,
    lastInput: t,
    currentRoomId: null,
  };
  sessions.set(token, session);
  if (guestKeyId) activeGuestSessions.set(guestKeyId, token);
  // Warm the point balance cache (and create a first-time account) without blocking the login.
  pointStore?.ensureAccount(pointAccountForSession(session)).then(() => loadEquippedSkins(pointAccountForSession(session))).catch(error => console.error('포인트 계정 확인 실패:', error.message));
  return session;
}

// Session tokens are intentionally short-lived and browser-specific. Guest keys are the
// durable identity that must survive a refresh, reconnect, or a browser handoff, while an
// admin session is only durable for the lifetime of that login.
function sessionIdentity(session) {
  if (!session) return null;
  return session.guestKeyId ? `guest:${session.guestKeyId}` : `admin:${session.publicId}`;
}

// v1.7.29: the chat sender id shown to clients. Derived from the account with a per-boot secret, so it is
// stable across rooms, the lobby and a relogin (and a nickname change) but reveals nothing about the account.
const CHAT_ID_KEY = crypto.randomBytes(32);
function chatIdFor(session) {
  const identity = sessionIdentity(session);
  return identity ? crypto.createHmac('sha256', CHAT_ID_KEY).update(identity).digest('hex').slice(0, 16) : null;
}

function participantIdentity(participant) {
  if (!participant) return null;
  if (participant.identity) return participant.identity;
  if (participant.guestKeyId) return `guest:${participant.guestKeyId}`;
  return participant.recordId || null;
}

function isRoomHost(room, session) {
  if (!room || !session) return false;
  const identity = sessionIdentity(session);
  if (room.hostIdentity && room.hostIdentity === identity) return true;
  const oldHost = room.participants?.[room.hostSessionToken];
  return room.hostSessionToken === session.token
    || (!room.hostIdentity && participantIdentity(oldHost) === identity);
}

// v1.10.35: every session whose last real input is 30 minutes old is logged out (its pages are told why)
function sweepInputIdle() {
  const now = nowMs();
  for (const [token, session] of sessions) if (now - (session.lastInput ?? session.createdAt) > INPUT_IDLE_MS) releaseSessionToken(token, { message: INPUT_IDLE_MESSAGE });
}

function releaseSessionToken(token, { message = null, voluntary = false } = {}) {
  const session = sessions.get(token);
  if (!session) return false;
  sessions.delete(token);
  dropPlazaPresence(token); // End pending weed/resource collection and remove the released visit immediately.
  soloGames.delete(token); // v1.10.37: a game left behind is void
  townhallPass.delete(token); townhallStrict.delete(token); // v1.10.41: the mayor's leave lasts the visit
  fishCasts.delete(token); // v1.10.42: a cast left in the water ends with the visit
  freeSeat(token); // v1.10.44
  trainRiders.delete(token); trainVisitors.delete(token); // v1.10.47
  let cancelledInvitation = false;
  for (const [id, invite] of invitations) {
    if (invite.fromToken === token || invite.toToken === token) {
      invitations.delete(id);
      cancelledInvitation = true;
    }
  }
  if (session.guestKeyId && activeGuestSessions.get(session.guestKeyId) === token) {
    activeGuestSessions.delete(session.guestKeyId);
  }
  for (const [roomId, set] of streams) {
    for (const entry of [...set]) {
      if (entry.sessionToken !== token) continue;
      try {
        if (message) sseWrite(entry.res, 'sessionExpired', { message });
        entry.res.end();
      } catch {}
      set.delete(entry);
    }
    if (!set.size) streams.delete(roomId);
  }
  let lobbyChanged = false;
  for (const entry of [...lobbyStreams]) {
    if (entry.sessionToken !== token) continue;
    try {
      if (message) sseWrite(entry.res, 'sessionExpired', { message });
      entry.res.end();
    } catch {}
    lobbyStreams.delete(entry);
    lobbyChanged = true;
  }
  for (const room of rooms.values()) {
    const p = room.participants[token];
    if (!p) continue;
    p.connected = false;
    // v1.6.99: a refresh, dropped page or expired session -- seated or spectating, in any game
    // state -- as long as they had not left the room themselves; their next entry with the same key
    // puts them back where they were. An explicit 접속 종료 keeps the old rule (only a seat in a
    // match still in progress is held for them).
    p.rejoinable = session.currentRoomId === room.id && (!voluntary
      || Boolean(findSeat(room, token) && (room.game.status === 'playing' || (isTwenty(room) && room.game.status === 'round-ended'))));
    p.rejoinOnlyWhilePlaying = voluntary;
    // v1.9.10: see roomAwaits -- whether opening the entry file again brings this person straight back into the room.
    p.droppedMidMatch = room.game.status === 'playing' || (isTwenty(room) && room.game.status === 'round-ended');
    syncGamePause(room);
    broadcast(room);
  }
  if (lobbyChanged || session.currentRoomId || cancelledInvitation) broadcastLobby();
  return true;
}

// A page asked to release this session (pagehide) and nothing has used it since: a refresh that
// resumed it would have sent a heartbeat or request, touching lastSeen/leaseSeenAt.
function releaseStillPending(session) {
  const requested = session.releaseRequestedAt;
  return Boolean(requested && Math.max(session.lastSeen || 0, session.leaseSeenAt || 0) <= requested && !sessionHasLiveStream(session.token));
}

function sessionHasLiveStream(token) {
  for (const set of streams.values()) for (const entry of set) if (entry.sessionToken === token) return true;
  for (const entry of lobbyStreams) if (entry.sessionToken === token) return true;
  return false;
}

// v1.10.29: `page` is the id of the page (one load of the tab, public/session-lock.js) whose pagehide sent this. On a
// reload the old page's beacon can reach the server after the new page's first heartbeat; the new page may then go a
// while without another request (a slow PC preparing the game resources), and the deferred release used to end the
// session it had just resumed (「입장 세션이 만료되었습니다」). A release from a page that no longer holds the lease
// (a newer page has sent its heartbeat) is ignored; one without a page id is handled as before.
function requestSessionRelease(token, page = '', sequence = 0) {
  const session = sessions.get(token);
  if (!session) return;
  // Admin sessions are not kept in the page across reloads, so there is nothing to resume.
  if (session.role !== 'guest') { releaseSessionToken(token); return; }
  session.leasePages ||= new Set();
  session.closedLeasePages ||= new Set();
  // A known former document cannot release a newer lease. An unseen document may
  // have closed before its first heartbeat body arrived; remember its closure.
  session.closedLeasePages.add(page);
  if (sequence && sequence < (session.leaseSequence || 0)) return;
  if (sequence) session.leaseSequence = sequence;
  if (page && session.leasePage && session.leasePage !== page && session.leasePages.has(page)) return;
  session.releaseRequestedAt = nowMs();
  setTimeout(() => {
    const current = sessions.get(token);
    if (current && releaseStillPending(current)) releaseSessionToken(token);
  }, SESSION_RELEASE_GRACE_MS).unref?.();
}

// v1.10.63 아이디·비밀번호 로그인 (IDEAS 2026-10-11 확정): a login gives an account token (memory, 12 hours) for the
// 내 계정 screen; 「게임 접속」 posts it to /guest-entry, which then enters exactly as the entry file does (same account
// row, same one-place-at-a-time lock). An entry file of an account with no login id yet gets a setup ticket instead
// (15 minutes): the id and password are set first, then the same entry. Both live only in this process (a restart
// asks for the login again).
const ACCOUNT_TTL_MS = 12 * 60 * 60 * 1000;
const MESSENGER_ROOM_MAX = 30; const MESSENGER_ROOMS_MAX = 20; const MESSENGER_TEXT_MAX = 500; // v1.10.78 메신저
const SETUP_TTL_MS = 15 * 60 * 1000;
const accountTokens = new Map(); // token -> { keyId, exp }
const setupTickets = new Map(); // ticket -> { keyId, exp }
const setupNotRequired = process.env.NODE_ENV === 'test'; // tests enter by files; a test turns the setup on per key
const setupRequiredKeys = new Set();
function issueTicket(map, keyId, ttl) {
  const now = nowMs();
  for (const [t, row] of map) if (row.exp < now) map.delete(t);
  const token = newSecret(32); map.set(token, { keyId, exp: now + ttl }); return token;
}
function ticketOf(map, token) {
  const row = map.get(String(token || ''));
  if (!row) return null;
  if (row.exp < nowMs()) { map.delete(String(token)); return null; }
  return row;
}
const accountOf = (req) => ticketOf(accountTokens, req.headers['x-account-token']);
function dropAccountTokens(keyId, keep = null) { for (const [t, row] of accountTokens) if (row.keyId === keyId && t !== keep) accountTokens.delete(t); }
const PASSWORD_MIN = 8; const PASSWORD_MAX = 64;
const passwordOk = (p) => typeof p === 'string' && p.length >= PASSWORD_MIN && p.length <= PASSWORD_MAX;
const accountView = (key) => ({ loginId: key.loginId, label: key.label, realName: key.realName || '' });
const accountOut = async (key) => ({ ...accountView(key), messenger: (await messengerStore.allowedIds()).includes(key.id), issues: (await issueWriters()).includes(key.id) }); // v1.10.78: shows 메신저; 문제 기록 허용 (2026-10-20)

function guestKeyInUse(guestKeyId) {
  const token = activeGuestSessions.get(guestKeyId);
  if (!token) return false;
  const session = sessions.get(token);
  if (!session || session.guestKeyId !== guestKeyId) {
    activeGuestSessions.delete(guestKeyId);
    return false;
  }
  const now = nowMs();
  const leaseSeenAt = session.leaseSeenAt || session.lastSeen || session.createdAt;
  if (
    releaseStillPending(session) ||
    now - session.createdAt > SESSION_MAX_MS ||
    now - session.lastSeen > SESSION_IDLE_MS ||
    now - leaseSeenAt > GUEST_LOCK_TTL_MS
  ) {
    releaseSessionToken(token, { message: '입장 세션이 만료되었습니다.' });
    return false;
  }
  return true;
}

function getSession(req, { touch = true } = {}) {
  const token = String(req.headers['x-session-token'] || '');
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  const now = nowMs();
  if (now - session.lastSeen > SESSION_IDLE_MS || now - session.createdAt > SESSION_MAX_MS) {
    releaseSessionToken(token, { message: '입장 세션이 만료되었습니다.' });
    return null;
  }
  if (touch) {
    session.lastSeen = now;
    if (session.guestKeyId) session.leaseSeenAt = now;
  }
  return session;
}

function requireSession(req, res) {
  const session = getSession(req);
  if (!session) {
    sendError(res, 401, 'AUTH_REQUIRED', '입장 권한이 없습니다. 관리자라면 비밀번호로, 게스트라면 발급받은 입장 파일로 다시 들어와 주세요.');
    return null;
  }
  return session;
}

function requireAdmin(req, res) {
  const session = requireSession(req, res);
  if (!session) return null;
  if (session.role !== 'admin') {
    sendError(res, 403, 'ADMIN_ONLY', '관리자만 사용할 수 있습니다.');
    return null;
  }
  return session;
}

const { writeUnlessBacklogged } = require('./lib/sse-backpressure');

// A5 메신저 실시간 받기: each permitted account's open streams; a change in a room is told to its members at once
// (only the room's id -- the page asks for the lines as before, with the same checks)
const messengerStreams = new Map(); // key id -> Set<res>
async function pokeRoom(roomId, also = []) {
  const room = await messengerStore.room(roomId).catch(() => null);
  for (const id of new Set([...(room?.members || []), ...also])) for (const res of messengerStreams.get(id) || []) { try { sseWrite(res, 'msg', { room: roomId }); } catch {} }
}
function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function trimLobbyMessages() {
  const messages = lobbySocial.social?.messages || [];
  if (messages.length > LOBBY_CHAT_MESSAGES) {
    messages.splice(0, messages.length - LOBBY_CHAT_MESSAGES);
  }
}

// Only lobby users with an active SSE connection can receive a direct invitation.
function lobbyPeers() {
  const people = new Map();
  for (const entry of lobbyStreams) {
    const session = sessions.get(entry.sessionToken);
    if (session && !session.currentRoomId) people.set(session.token, session);
  }
  return [...people.values()];
}

function publicRoomSummary(room) {
  if (room.visibility !== 'public') return null;
  const host = sessions.get(room.hostSessionToken);
  if (!host || host.currentRoomId !== room.id) return null;
  const engine = getGame(room.gameType);
  return {
    id: room.id, gameType: room.gameType, gameName: engine?.name || '게임',
    title: room.title || null,
    host: host.label || '방장',
    playerCount: isNumberedSeatGame(room) ? seatsFor(room).filter(seat => room.players[seat]).length
      : Number(Boolean(room.players.black)) + Number(Boolean(room.players.white)),
    maxPlayers: isNumberedSeatGame(room) ? seatsFor(room).length : 2,
    connectedCount: Object.values(room.participants).filter(p => p.connected && sessions.has(p.sessionToken)).length,
    status: room.game.status === 'selecting' ? 'waiting'
      : ['finished', 'draw'].includes(room.game.status) ? 'finished'
      : room.game.paused ? 'paused' : 'playing',
  };
}

function listPublicRooms() {
  return [...rooms.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(publicRoomSummary).filter(Boolean);
}

function pruneInvitations() {
  const time = nowMs();
  for (const [id, invite] of invitations) {
    const sender = sessions.get(invite.fromToken);
    const recipient = sessions.get(invite.toToken);
    const room = rooms.get(invite.roomId);
    if (time > invite.createdAt + INVITE_TTL_MS || !sender || !recipient || recipient.currentRoomId
      || !room || room.hostSessionToken !== invite.fromToken
      || sender.currentRoomId !== room.id || room.game.status !== 'selecting') {
      invitations.delete(id);
    }
  }
}

function invitationsFor(session) {
  pruneInvitations();
  if (!session || session.currentRoomId) return [];
  return [...invitations.entries()].filter(([, invite]) => invite.toToken === session.token)
    .map(([id, invite]) => {
      const from = sessions.get(invite.fromToken);
      const room = rooms.get(invite.roomId);
      return { id, from: from?.label || '방장', game: getGame(room.gameType)?.name || '게임',
        expiresAt: new Date(invite.createdAt + INVITE_TTL_MS).toISOString() };
    });
}

// v1.10.82 근거리·같은 열차 채팅 (IDEAS #future-local-chat, 사용자 확정 2026-10-08): an island message goes to who was within
// LOCAL_CHAT_M of the sender when it was sent (on the ground), or to who rode the same train -- fixed then (`to`, session
// tokens): it stays with whoever got it and never reaches anyone else, the stream and its history alike. A message
// from outside the island (the classic lobby) has no `to` and goes to everyone, as before.
const LOCAL_CHAT_M = 20;
function chatAudience(session) {
  const at = plazaPresence.get(session.token); if (!at) return { to: null, channel: null };
  const ride = trainRiders.get(session.token); const to = new Set([session.token]);
  for (const [token, p] of plazaPresence) {
    if (token === session.token) continue; const other = trainRiders.get(token);
    if ((p.space || 'island') !== (at.space || 'island')) continue; // v1.10.84: the 민원실 and the island never mix
    if (ride ? other?.id === ride.id : !other && Math.hypot(p.x - at.x, p.z - at.z) <= LOCAL_CHAT_M) to.add(token);
  }
  return { to, channel: ride ? 'train' : 'near' };
}
function lobbyMessagesFor(session) {
  const visible = new Set(lobbySocial.social.messages.filter((m) => !m.to || (session && m.to.has(session.token))).map((m) => m.id));
  const channel = new Map(lobbySocial.social.messages.filter((m) => m.channel).map((m) => [m.id, m.channel]));
  return publicChatMessages(lobbySocial).filter((m) => visible.has(m.id)).map((m) => (channel.has(m.id) ? { ...m, channel: channel.get(m.id) } : m)).slice(-LOBBY_CHAT_MESSAGES);
}
function publicLobbyState(session = null) {
  return {
    connectedCount: lobbyPeers().length,
    messages: lobbyMessagesFor(session),
    rooms: listPublicRooms(),
    invitations: invitationsFor(session),
    me: { chatId: chatIdFor(session) },
  };
}

function broadcastLobby() {
  pruneInvitations();
  for (const entry of [...lobbyStreams]) {
    const session = sessions.get(entry.sessionToken);
    if (!session || session.currentRoomId) {
      try { entry.res.end(); } catch {}
      lobbyStreams.delete(entry);
      continue;
    }
    try {
      sseWrite(entry.res, 'lobbyState', publicLobbyState(session));
    } catch {
      lobbyStreams.delete(entry);
    }
  }
}

// v1.9.4 상시 등반 도전: each account's climb in progress, simulated here (public/climb/climb-sim.js) from the player's
// inputs only -- the browser runs the same steps for instant feedback, but where a climber is (and so the record) is
// the server's. Memory only: a refresh or reconnect resumes it, a redeploy or 30 idle minutes drops it, and nothing is
// ever recorded unless the player ends the climb standing safely. Climbers never collide with each other.
const climbs = new Map(); // point account -> { id, token, name, state, credit, lastAt, startedAt }
const CLIMB_IDLE_MS = 30 * 60 * 1000;
const CLIMB_BURST_TICKS = 90; // at most 3 seconds of inputs may arrive at once (a slow network catching up)
const CLIMB_MAX_BATCH = 60;
function climbView(climb) { return climb ? { id: climb.id, state: climb.state } : null; }
function climbOthers(account, climb, now) {
  const out = [];
  for (const [other, c] of climbs) {
    if (other === account || now - c.lastAt > 10000 || Math.abs(c.state.y - climb.state.y) > 40) continue;
    out.push({ name: c.name, x: Math.round(c.state.x * 100) / 100, y: Math.round(c.state.y * 100) / 100 });
    if (out.length >= 30) break;
  }
  return out;
}
const climbPruner = setInterval(() => { const now = nowMs(); for (const [account, c] of climbs) if (now - c.lastAt > CLIMB_IDLE_MS) climbs.delete(account); }, 60 * 1000);
climbPruner.unref?.();
// v1.9.5 주간 랭킹·챔피언: a week that has ended is settled once (prizes by competition ranking, IDEAS 「상시 등반
// 도전」), at startup, every minute and whenever someone opens the climb window. The champions of the week that
// just ended are this week's champions; when a new week starts they are no longer anyone's, by construction.
let climbSettling = null;
let championCache = { week: null, ids: new Set(), names: [] };
async function settleClimbWeeks(now = nowMs()) {
  if (climbSettling) return climbSettling;
  climbSettling = (async () => {
    const current = climbWeekOf(now); // one clock reading for the whole run
    const paidTo = new Set();
    for (const week of await pointStore.climbUnsettledWeeks(current)) {
      const result = await pointStore.settleClimbWeek(week);
      if (result.applied) for (const payout of result.payouts) paidTo.add(payout.userId);
    }
    await refreshChampions(now);
    if (paidTo.size) notifyPointsChanged([...paidTo]);
  })().catch((error) => console.error('등반 주간 결산 실패:', error.message)).finally(() => { climbSettling = null; });
  return climbSettling;
}
async function refreshChampions(now = nowMs()) {
  const week = previousWeek(climbWeekOf(now));
  const result = await pointStore.climbWeekResult(week);
  const ids = new Set(result?.champions || []);
  const names = (result?.ranking || []).filter((row) => ids.has(row.userId)).map((row) => row.name);
  const changed = championCache.week !== week || [...ids].sort().join() !== [...championCache.ids].sort().join();
  championCache = { week, ids, names };
  if (changed) { // name tags in the plaza follow at once
    for (const entry of plazaPresence.values()) entry.champion = ids.has(entry.account);
    plazaDirty = true;
  }
}
// v1.10.5 기부 동상 (IDEAS 「기부 동상」): a week of donations is closed once after it ends (startup, every minute, and
// when the donation window opens). Its 1st and 2nd are kept as statues -- their look as it was when the week closed --
// shown from Monday 00:30 (until then the statues of the week before stay), and its 1st is 「호구왕」 from the close
// until the next week closes (one week).
let donationSettling = null;
let donationCache = { week: null, hoguking: null, statues: [], statuesWeek: null };
const STATUE_SWAP_MS = 30 * 60 * 1000;
const weekStartMs = (week) => Date.parse(`${week}T00:00:00+09:00`);
async function settleDonationWeeks(now = nowMs()) {
  if (donationSettling) return donationSettling;
  donationSettling = (async () => {
    const current = climbWeekOf(now);
    for (const week of await pointStore.donationUnsettledWeeks(current)) {
      const top = donationRanking(await pointStore.donationWeekRows(week)).slice(0, 2);
      const statues = [];
      for (const row of top) {
        const equipped = equippedSkinCache.get(row.userId) || (await pointStore.skinState(row.userId)).equipped;
        const { look, title } = avatarLookOf(equipped);
        statues.push({ rank: row.rank, name: row.name || '게스트', total: row.total, look, title });
      }
      await pointStore.settleDonationWeek(week, statues);
    }
    await refreshDonation(now);
  })().catch((error) => console.error('기부 주간 결산 실패:', error.message)).finally(() => { donationSettling = null; });
  return donationSettling;
}
async function refreshDonation(now = nowMs()) {
  const current = climbWeekOf(now); const week = previousWeek(current);
  const result = await pointStore.donationWeekResult(week);
  const statuesWeek = now >= weekStartMs(current) + STATUE_SWAP_MS ? week : previousWeek(week);
  const shown = statuesWeek === week ? result : await pointStore.donationWeekResult(statuesWeek);
  const hoguking = result?.hoguking || null;
  const changed = donationCache.week !== week || donationCache.hoguking !== hoguking || donationCache.statuesWeek !== statuesWeek;
  donationCache = { week, hoguking, statues: shown?.statues || [], statuesWeek };
  if (changed) {
    for (const entry of plazaPresence.values()) entry.hoguking = entry.account === hoguking;
    plazaDirty = true;
    for (const entry of lobbyStreams) { try { sseWrite(entry.res, 'statues', statueSnapshot()); } catch { lobbyStreams.delete(entry); } } // the plaza statues change for everyone
  }
}
let contestWinnerStatue = null; // A4: the last contest's winner (kept with its result; read once at start and on settling)
const statueSnapshot = () => ({ week: donationCache.statuesWeek, statues: [...donationCache.statues, ...(contestWinnerStatue ? [{ contest: true, ...contestWinnerStatue }] : [])] });
function isHoguking(account, now = nowMs()) {
  return Boolean(account) && donationCache.week === previousWeek(climbWeekOf(now)) && donationCache.hoguking === account;
}

// v1.10.89 낚시왕 (IDEAS #future-fishing-dex) · v1.10.90 제초왕 (IDEAS #future-weed-board): a week's (Seoul Monday to
// Monday) 1st -- by the points the harbour fisherman paid / by the weeds handed in at the town hall -- closed once after it
// ends, holds the title the week after (worn in the title slot, shown only while it is theirs). A tie: who reached the
// total first, then the account id. Nobody: no title. From the week of 2026-10-12 on (no earlier week is made up).
// v1.10.90 운영 스위치 (IDEAS #future-admin-console ②): what the administrator turns on and off without a deploy --
// 새 가입 신청 받기, 메신저 (everyone's). Kept on the server; read once and then from memory.
// v1.10.91 주민 심부름: where each account is in today's errands (memory; what was paid stays paid in the store)
// ponytail: in memory, a restart forgets an errand under way (ask again); keep it in the store if that ever matters
const errandStages = new Map(); // `<day>|<account>` -> { [errand id]: stage }
async function errandView(account) {
  const day = kstDate(nowMs()); const errands = IslandErrands.errandsOf(day);
  for (const k of errandStages.keys()) if (!k.startsWith(`${day}|`)) errandStages.delete(k); // (yesterday's)
  const done = new Set(await pointStore.claimedEvents(account, errands.map((e) => e.id))); const stages = errandStages.get(`${day}|${account}`) || {};
  const goods = new Set(((await pointStore.islandBag(account)).items || []).map((e) => e.itemId));
  return { marks: IslandErrands.marks(errands, stages, done, goods), track: IslandErrands.track(errands, stages, done).map((t) => { const e = errands.find((x) => x.id === t.id); return { ...t, reward: Economy.value(`errand:${e.kind}`) + Economy.value('errand:far') * (e.far || 0) }; }), done: done.size, total: errands.length };
}
// the island's time of day for a resident's words (the administrator's fixed one, or Seoul's hour)
function islandPhase(mode, ms) { if (IslandCast.PHASES.includes(mode)) return mode; const h = new Date(ms + 9 * 3600000).getUTCHours(); return h >= 6 && h < 10 ? 'morning' : h >= 10 && h < 17 ? 'day' : h >= 17 && h < 20 ? 'evening' : 'night'; }
const OPS_DEFAULTS = { signups: true, messenger: true, dalmaruPreview: false }; let opsCache = null; // (달마루섬 미리보기: the administrator's island only)
// world values read-modify-written one at a time (one server process; two admin saves must not undo each other)
let worldQueue = Promise.resolve();
const ISSUE_KINDS = ['bug', 'odd', 'idea']; const ISSUE_STATUS = ['open', 'doing', 'done']; const ISSUE_MAX = 500; // 관리자 「문제 기록」
const ISSUE_DAY_MAX = 30; // (2026-10-20: an allowed account writes up to this many a day -- the administrator has no cap)
const issueWriters = async () => (await pointStore.worldValue('issueWriters')) || []; // (the accounts the administrator lets write)
const canWriteIssues = async (session) => session?.role === 'admin' || Boolean(session?.guestKeyId && (await issueWriters()).includes(session.guestKeyId));
function worldEdit(fn) { const run = worldQueue.then(fn); worldQueue = run.catch(() => {}); return run; }
async function opsSwitches() { if (!opsCache) opsCache = { ...OPS_DEFAULTS, ...((await pointStore.worldValue('switches')) || {}) }; return opsCache; }
const WEEKLY_FIRST_WEEK = '2026-10-12';
const WEEKLY_TITLES = {
  fishking: { title: 'title_fishking', name: '낚시왕', about: '어부 판매 주간 1위', rows: (from, to) => pointStore.fishSalesWeek(from, to) },
  weedking: { title: 'title_weedking', name: '제초왕', about: '관공서 잡초 납품 주간 1위', rows: async (from, to) => (await pointStore.weedStats(from, to)).submits },
};
const weeklyCache = Object.fromEntries(Object.keys(WEEKLY_TITLES).map((id) => [id, { week: null, holder: null }]));
let weeklySettling = null;
async function settleWeeklyTitles(now = nowMs()) {
  if (weeklySettling) return weeklySettling;
  weeklySettling = (async () => {
    for (const [id, def] of Object.entries(WEEKLY_TITLES)) {
      // every week from the first, oldest first; a closed one is skipped, so a failed run leaves no week out (Codex review)
      for (let week = WEEKLY_FIRST_WEEK, last = previousWeek(climbWeekOf(now)); week <= last; week = nextWeekOf(week)) {
        const key = `${id}_week:${week}`;
        if (await pointStore.settlementOf(key)) continue;
        const rows = (await def.rows(new Date(weekStartMs(week)).toISOString(), new Date(weekStartMs(nextWeekOf(week))).toISOString()))
          .sort((a, b) => b.total - a.total || String(a.lastAt).localeCompare(String(b.lastAt)) || a.userId.localeCompare(b.userId));
        const labels = new Map((await accessStore.list()).map((k) => [`guest:${k.id}`, k.label]));
        const ranking = rows.slice(0, 10).map((r, i) => ({ userId: r.userId, name: labels.get(r.userId) || (r.userId === 'admin' ? '관리자' : '게스트'), total: r.total, rank: i + 1 }));
        await pointStore.settleTitleWeek(key, { kind: `${id}_week`, week, holder: ranking[0]?.userId || null, ranking });
      }
    }
    await refreshWeeklyTitles(now);
  })().catch((error) => console.error('주간 칭호 결산 실패:', error.message)).finally(() => { weeklySettling = null; });
  return weeklySettling;
}
async function refreshWeeklyTitles(now = nowMs()) {
  const week = previousWeek(climbWeekOf(now)); let changed = false;
  for (const id of Object.keys(WEEKLY_TITLES)) {
    const r = await pointStore.settlementOf(`${id}_week:${week}`); const holder = r?.holder ?? r?.fishking ?? null;
    if (weeklyCache[id].week === week && weeklyCache[id].holder === holder) continue;
    weeklyCache[id] = { week, holder }; changed = true;
  }
  if (changed) refreshTaxLooks(); // name tags follow at once
}
const holdsWeekly = (id, account, now = nowMs()) => Boolean(account) && weeklyCache[id].week === previousWeek(climbWeekOf(now)) && weeklyCache[id].holder === account;
const weeklyTitleOf = (skinId) => Object.entries(WEEKLY_TITLES).find(([, d]) => d.title === skinId) || null; // -> [id, def]
const heldWeeklyTitles = (account) => Object.entries(WEEKLY_TITLES).filter(([id]) => holdsWeekly(id, account)).map(([, d]) => ({ id: d.title, name: d.name }));

function isChampion(account, now = nowMs()) {
  return championCache.week === previousWeek(climbWeekOf(now)) && championCache.ids.has(account);
}
const climbWeekTicker = setInterval(() => {
  if (championCache.week !== previousWeek(climbWeekOf(nowMs()))) refreshChampions().catch(() => {}); // Monday 00:00: last week's champions expire at once
  settleDonationWeeks(); // v1.10.5: closes last week's donations (Monday 00:00) and swaps the statues (00:30)
  settleWeeklyTitles(); // v1.10.89 낚시왕 · v1.10.90 제초왕
  settleClimbWeeks();
}, 60 * 1000);
climbWeekTicker.unref?.();

async function climbRankingView(week, account) {
  const ranked = competitionRanking(await pointStore.climbWeekRows(week));
  const mine = ranked.find((row) => row.userId === account) || null;
  return { week, top: ranked.slice(0, 20).map(({ rank, name, best, userId }) => ({ rank, name, best, me: userId === account })), me: mine ? { rank: mine.rank, best: mine.best } : null, total: ranked.length };
}

// v1.9.3 3D 광장 V3: who is walking in the plaza right now. Memory only (a redeploy clears it, the next position
// update brings each player back). The client sends its pose about 8 times a second while moving and every few
// seconds while standing; the server sends everyone in the lobby one snapshot at most every PLAZA_TICK_MS.
const PLAZA_TICK_MS = 150;
const PLAZA_STALE_MS = 15000;
const PLAZA_BOUND = IslandTerrain.ISLAND_RADIUS; // v1.10.0: the whole island (130; 달마루섬 200)
const plazaPresence = new Map(); // session token -> { id, name, look, title, x, z, yaw, moving, at }
// v1.9.6 player collision: the last word on where a plaza player stands. Smaller than the screen's circles (0.45 each,
// 0.28 at a door) so it only removes a real overlap (lag, a hand-made request) and never fights normal walking.
const PLAZA_SERVER_MIN = 0.5;
// The last position stored for a session, kept when its plaza entry drops (a lost stream, a slow client) so the next
// update is still checked along its path. Only an explicit leave (room, classic lobby, logout) forgets it.
const plazaLastPos = new Map(); // session token -> { x, z }
// Only the sender moves: out of anyone else it overlaps, to the nearest spot on that person's circle (a few passes for
// a crowd). Returns the corrected position.
function plazaSeparate(token, x, z, prev) {
  // First the path since my last position: if it runs into someone I was not touching, I stop at the contact on my
  // side (two people walking at each other can never swap places between two updates).
  // (Entering the plaza again -- a reconnect, coming back from a room -- starts without a previous position.)
  if (prev) {
    const sx = x - prev.x; const sz = z - prev.z; const len2 = sx * sx + sz * sz;
    if (len2 > 1e-8) {
      let tHit = 1;
      for (const [other, entry] of plazaPresence) {
        if (other === token || entry.ride || entry.platform) continue;
        const fx = prev.x - entry.x; const fz = prev.z - entry.z;
        const c = fx * fx + fz * fz - PLAZA_SERVER_MIN * PLAZA_SERVER_MIN;
        if (c <= 0) continue; // already overlapping at the start: the separation below handles it
        const bq = 2 * (fx * sx + fz * sz); const disc = bq * bq - 4 * len2 * c;
        if (bq >= 0 || disc < 0) continue; // moving away, or the line misses the circle
        const t = (-bq - Math.sqrt(disc)) / (2 * len2);
        if (t >= 0 && t < tHit) tHit = t;
      }
      if (tHit < 1) { const k = Math.max(0, tHit - 1e-3); x = prev.x + sx * k; z = prev.z + sz * k; }
    }
  }
  for (let pass = 0; pass < 4; pass += 1) {
    let moved = false;
    for (const [other, entry] of plazaPresence) {
      if (other === token || entry.ride || entry.platform) continue;
      let dx = x - entry.x; let dz = z - entry.z; let d = Math.hypot(dx, dz);
      if (d >= PLAZA_SERVER_MIN) continue;
      if (d < 1e-4) { dx = (prev?.x ?? x + 1) - entry.x; dz = (prev?.z ?? z) - entry.z; d = Math.hypot(dx, dz); }
      if (d < 1e-4) { dx = 1; dz = 0; d = 1; }
      x = entry.x + (dx / d) * PLAZA_SERVER_MIN; z = entry.z + (dz / d) * PLAZA_SERVER_MIN; moved = true;
    }
    if (!moved) break;
  }
  const clamp = (v) => Math.max(-PLAZA_BOUND, Math.min(PLAZA_BOUND, v));
  return { x: Math.round(clamp(x) * 100) / 100, z: Math.round(clamp(z) * 100) / 100 };
}
let plazaDirty = false;
// v1.10.84 관공서 실내 (IslandTerrain.TOWNHALL_ROOM): who is in the 민원실 (session tokens). Inside, a pose stays in the
// room; leaving the island or the visit ends it -- a new visit starts outside the hall's door.
const townhallInside = new Set();
const storeInside = new Set(); // v1.10.92 잡화점: who is in the store's room (the same rules as the 민원실)
const furnitureInside = new Set(); // 묶음 2 가구점: who is up on the 2nd floor (still in the store: storeInside too)
// the day's display and what of it is sold (world 'furniture': { day, sold: { slot: account }, buys: { account: n } })
async function furnitureDay() { const day = kstDate(nowMs()); const st = (await pointStore.worldValue('furniture')) || {}; return st.day === day ? { day, sold: st.sold || {}, buys: st.buys || {} } : { day, sold: {}, buys: {} }; }
const furnitureView = (st, account) => ({ day: st.day, perDay: Economy.value('furniture:perDay'), mine: st.buys[account] || 0,
  display: Object.entries(IslandFurniture.displayOf(st.day)).map(([slot, id]) => { const g = IslandFurniture.good(id); return { slot, id, name: g.name, rarity: g.rarity, price: Economy.value(`furniture:${g.rarity}`), sold: Boolean(st.sold[slot]) }; }),
  base: IslandFurniture.BASE_SLOTS.map((s) => { const g = IslandFurniture.good(s.good); return { slot: s.id, id: g.id, name: g.name, rarity: 'base', price: Economy.value('furniture:base'), sold: false }; }) });
// v1.10.86 주민세 (사용자 2026-10-17): every account pays each Seoul day 3% of what it has (wallet + deposit), at least
// 20,000P (lib/point-store.js taxCollect); what it cannot pay is owed, up to 200,000P. Anyone owing is a 체납자: that title
// over any other, and the 줄무늬 outfit in white and black over whatever is worn, until it is paid at the 민원 창구.
const taxDebt = new Map(); // account -> what it owes
const PRISON_OUTFIT = 'avatar_outfit_2';
function lookFor(account, equipped) {
  const shown = avatarLookOf(equipped);
  const weekly = weeklyTitleOf(equipped?.avatar?.title); if (weekly) shown.title = holdsWeekly(weekly[0], account) ? weekly[1].name : null; // v1.10.89 낚시왕 · v1.10.90 제초왕
  if (birthdays.today.has(account)) shown.title = Together.BIRTHDAY_TITLE; // B 47 생일: the day's title
  if (!(taxDebt.get(account) > 0)) return shown;
  const dye = { ...(shown.look.dye || {}) }; delete dye[shown.look.outfit]; delete dye[PRISON_OUTFIT];
  return { look: { ...shown.look, outfit: PRISON_OUTFIT, top: undefined, bottom: undefined, dye, prisoner: true }, title: null, delinquent: true };
}
// B 47 생일: whose birthday it is today (not hidden), read from every account's 'birthday' doc -- again each Seoul day
// and whenever one is set (ponytail: one read per account; a birthday index if the accounts grow into the hundreds)
const birthdays = { day: null, today: new Map(), loading: null, gen: 0 };
function refreshBirthdays(force = false) {
  const day = kstDate(nowMs()); if (!pointStore || (!force && birthdays.day === day)) return birthdays.loading;
  birthdays.day = day;
  const gen = ++birthdays.gen; // (an older read finishing late does not undo a newer one -- Codex review)
  birthdays.loading = (async () => {
    const today = new Map();
    for (const key of await accessStore.list()) {
      if (key.revokedAt || key.pendingAt) continue; const account = `guest:${key.id}`;
      const doc = (await pointStore.questDoc(account, 'birthday')).doc;
      if (!doc.hidden && Together.isBirthday(doc, nowMs())) today.set(account, String(key.label || '').slice(0, 24));
    }
    if (gen !== birthdays.gen) return;
    const changed = [...today.keys()].join() !== [...birthdays.today.keys()].join(); birthdays.today = today;
        if (changed) { refreshTaxLooks(); broadcastIsland('birthdays', { names: [...today.values()] }); }
  })().catch((error) => { birthdays.day = null; console.error('생일 확인 실패:', error.message); }).finally(() => { if (gen === birthdays.gen) birthdays.loading = null; });
  return birthdays.loading;
}
setInterval(() => refreshBirthdays(), 60000).unref?.();
// 달마루섬 5단계 (사용자 결정: 심은 꽃·나무는 전부 씨앗으로): once, when the server first runs on the new island -- every
// planted flower back to its owner's bag as its seed, every tree as a sapling (「달마루섬 이사 돌려받기」, no activity
// bonus), then the ground cleared. Each return is its own claim (a restart half way never gives twice); a full bag
// keeps that plant in the list for the next start.
async function dalmaruMoveIn() {
  if (IslandTerrain.MAP !== 'dalmaru' || !pointStore || await pointStore.worldValue('dalmaruMoved')) return;
  if (!(await pointStore.worldValue('dalmaruWeeds'))) { await pointStore.islandWeedReset(); await pointStore.setWorldValue('dalmaruWeeds', { at: new Date().toISOString() }); } // (잡초: the new island's own, numbered afresh)
  const plants = await pointStore.islandPlants(); const returned = []; let kept = 0;
  for (const p of plants) {
    const itemId = p.kind === 'tree' ? 'sapling' : `seed_flower_${p.color}`;
    const out = await pointStore.islandGive({ userId: p.owner, itemId, qty: 1, claimId: `dalmaru-move:${p.id}`, note: '달마루섬 이사 돌려받기', quiet: true }).catch(() => null);
    if (out && (out.applied || out.kind === 'island_give')) returned.push(p.id); else kept += 1;
  }
  await pointStore.islandClearPlants(returned);
  if (!kept) await pointStore.setWorldValue('dalmaruMoved', { at: new Date().toISOString(), returned: returned.length });
  if (plants.length) console.log(`달마루섬 이사: 심은 꽃·나무 ${returned.length}개를 씨앗으로 돌려줌${kept ? `, ${kept}개는 가방이 가득 차 다음에` : ''}`);
}
// B 47 박물관: one gift at a time (two at once for the same kind: the first stays), the thing out of the giver's bag
let museumChain = Promise.resolve();
function museumGive(account, itemId, name) {
  const run = museumChain.then(async () => {
    const shown = (await pointStore.worldValue('museum')) || {}; if (shown[itemId]) return 'shown';
    await pointStore.setWorldValue('museum', { ...shown, [itemId]: { by: name, at: nowMs() } }); // (on show first: a failure after it never loses the thing -- Codex review)
    const out = await pointStore.questApply(account, 'museumGiven', (d) => ({ doc: { ...d, [itemId]: (d[itemId] || 0) + 1 }, take: { itemId, qty: 1 } })).catch(() => null);
    if (!out?.doc) { await pointStore.setWorldValue('museum', shown); return 'missing'; }
    return 'ok';
  });
  museumChain = run.catch(() => {}); return run;
}
// one account's open lobby streams get an event (a letter came)
function notifyAccount(account, type, data) {
  for (const entry of [...lobbyStreams]) { const session = sessions.get(entry.sessionToken); if (!session || pointAccountForSession(session) !== account) continue; try { sseWrite(entry.res, type, data); } catch { lobbyStreams.delete(entry); } }
}
const nearMailbox = (session) => { const me = plazaPresence.get(session.token); const m = IslandTerrain.VILLAGE.mailbox; return Boolean(me && (me.space || 'island') === 'island' && Math.hypot(me.x - m.x, me.z - m.z) <= 3); };
// the day each account last came in, once a day per account (lib/point-store.js bankAccrue: no interest after 7 days away)
const visitNoted = new Map();
function noteVisit(account) {
  const today = kstDate(nowMs()); if (!account || visitNoted.get(account) === today) return;
  visitNoted.set(account, today); pointStore.noteVisit(account).catch((error) => { visitNoted.delete(account); console.error('접속 기록 실패:', error.message); });
}
let taxDay = null; let taxRunning = null;
function collectTaxes(now = nowMs(), forced = null) {
  const day = forced || kstDate(now);
  if (taxDay === day || taxRunning) return taxRunning;
  taxRunning = (async () => {
    // the days since the last one collected, oldest first (a server asleep through days takes each of them -- Codex
    // review), at most the last 30; the very first run takes today only
    const last = forced ? null : await pointStore.taxLastDay();
    const days = [];
    for (let d = day, n = 0; n < 30 && (!last || d > last); n += 1) { days.unshift(d); if (!last) break; d = kstDate(Date.parse(`${d}T12:00:00+09:00`) - 86400000); }
    const changed = new Set();
    for (const d of days) for (const key of await accessStore.list()) { // every account (a revoked one too -- Codex review)
      const account = `guest:${key.id}`;
      const out = await pointStore.taxCollect(account, d);
      if (out.applied) changed.add(account);
      taxDebt.set(account, out.debt || 0);
    }
    taxDay = day;
    if (changed.size) { notifyPointsChanged([...changed]); refreshTaxLooks(); }
  })().catch((error) => console.error('주민세 징수 실패:', error.message)).finally(() => { taxRunning = null; });
  return taxRunning;
}
function refreshTaxLooks() { // who is on the island shows the change at once
  for (const entry of plazaPresence.values()) {
    const shown = lookFor(entry.account, equippedSkinCache.get(entry.account));
    entry.look = shown.look; entry.title = shown.title; entry.delinquent = Boolean(shown.delinquent);
  }
  plazaDirty = true;
}
function plazaSnapshot() {
  // v1.10.2: chatId (the same public id lobby chat messages carry) lets each screen put a message over its sender
  // t is the sender's bounded, server-aligned draw time (old clients use receipt time).
  // Authoritative freshness and interactions still use entry.at, the server receipt time.
  return { trainService: trainService(), players: [...plazaPresence.values()].map(({ id, chatId, name, look, title, champion, hoguking, x, z, yaw, moving, at, poseAt, carry, act, actN, actAt, actMs, actTarget, seat, ride, platform, space, delinquent, fish, pet }) => ({ id, chatId, name, look, title, champion: Boolean(champion), hoguking: Boolean(hoguking), delinquent: Boolean(delinquent), ride: ride || null, platform: platform || null, space: space || 'island', x, z, yaw, moving, t: poseAt || at, carry: carry || null, act: act || null, actN: actN || 0, actAt, actMs, actTarget, seat: seat || null, fish: fish || null, pet: pet || null })) };
}
function dropPlazaPresence(token) { const session = sessions.get(token); if (session) session.plazaGeneration = (session.plazaGeneration || 0) + 1; if (session && islandEvents.residentBye(`talk:${session.plazaId}`)) broadcastIsland('residents', { list: islandEvents.residents() }); /* (A-6: off the island, the talk ends) */ weedPulls.delete(token); resourcePulls.delete(token); freeSeat(token); trainRiders.delete(token); trainVisitors.delete(token); townhallInside.delete(token); storeInside.delete(token); furnitureInside.delete(token); if (plazaPresence.delete(token)) plazaDirty = true; }
function prunePlazaPresence(now = nowMs()) {
  const liveLobby = new Set([...lobbyStreams].map(stream => stream.sessionToken));
  for (const [token, entry] of plazaPresence) {
    const session = sessions.get(token);
    if (!session || session.currentRoomId || (now - entry.at > PLAZA_STALE_MS && !liveLobby.has(token))) dropPlazaPresence(token);
  }
  for (const token of plazaLastPos.keys()) { const session = sessions.get(token); if (!session || session.currentRoomId) plazaLastPos.delete(token); }
}
const plazaTicker = setInterval(() => {
  prunePlazaPresence();
  if (!plazaDirty) return;
  plazaDirty = false;
  const snapshot = plazaSnapshot();
  for (const entry of [...lobbyStreams]) {
    try { sseWrite(entry.res, 'plaza', snapshot); } catch { lobbyStreams.delete(entry); }
  }
}, PLAZA_TICK_MS);
plazaTicker.unref?.();

// v1.10.11 서버 공용 랜덤 이벤트 (lib/island-events.js): 15 out on the island for everyone. A player hears only of
// the events near them (with each pose answer), so no screen holds the whole island's list; when one is solved every
// screen is told at once to drop it (the lobby stream), and a new one appears elsewhere.
const islandEvents = createIslandEvents({ now: () => nowMs(), occupied:()=>[...plazaPresence.values()].filter(p=>!p.ride&&!p.platform) });
function broadcastIslandRemoved(ids) {
  if (!ids.length) return;
  for (const entry of [...lobbyStreams]) {
    try { sseWrite(entry.res, 'islandEvent', { removed: ids }); } catch { lobbyStreams.delete(entry); }
  }
}
const islandEventTimer = setInterval(() => broadcastIslandRemoved(islandEvents.expire()), 30000);
islandEventTimer.unref?.();

// v1.10.31 잡초 채집 (IDEAS 「잡초 채집」, 사용자 확정 2026-10-05): the island's weeds (lib/island-weeds.js) and their state
// in the store (pulled, grown, kept with the bags). At 00:00 Asia/Seoul the weeds pulled since the last regrowth grow back
// elsewhere -- worked out by whichever comes first after the day changes (this check, a request, the next start after the
// server was off), once per day (the store refuses a second). Pulling takes two steps about a second apart (the
// player's GatherWeed): start says which weed (standing by it), finish pulls it -- once, for one player, then everyone's
// screen drops it.
const IslandWeeds = require('./lib/island-weeds');
function collectionPose(token,pull=null) {
  const p=plazaPresence.get(token); if(!p) return;
  if(pull) Object.assign(p,{x:pull.pos.x,z:pull.pos.z,yaw:Math.atan2(pull.target.x-pull.pos.x,pull.target.z-pull.pos.z),moving:false,act:pull.anim,actN:pull.at,actAt:pull.at,actMs:pull.ms,actTarget:pull.target});
  else if (['gather','pickup','pickFruit'].includes(p.act)) { p.act=null; delete p.actAt; delete p.actMs; delete p.actTarget; }
  plazaDirty=true;
}
const resourcePulls = new Map();
const weedPulls = new Map(); // session token -> { weedId, at, requestId, result }
function broadcastIsland(type, data) { for (const entry of [...lobbyStreams]) { try { sseWrite(entry.res, type, data); } catch { lobbyStreams.delete(entry); } } }
async function weedState(now = nowMs()) {
  let state = await pointStore.islandWeeds();
  const today = kstDate(now);
  if (state.day !== today) {
    // v1.10.90: the day before's pulls set today's total (IslandWeeds.targetFor); short of it grows, over it wilts
    let grown = []; let wilt = [];
    if (state.day !== null) {
      const target = IslandWeeds.targetFor(state.day === kstDate(now - 86400e3) ? state.pulled : 0); /* (a skipped day pulled nothing) */ const out = IslandWeeds.active(state).length; const day = IslandTerrain.seasonDay(now);
      if (out < target) grown = IslandWeeds.grow(day, target - out, state); else if (out > target) wilt = IslandWeeds.wilt(day, out - target, state);
    }
    const before = state.day;
    state = await pointStore.islandWeedRoll({ day: today, grown, wilt });
    if (before !== null && state.day === today) broadcastIsland('islandWeeds', { day: today }); // everyone fetches the new set
  }
  return state;
}
// v1.10.31 (IDEAS: prepared for missions later, not in the mission pool now): life progress -- weeds pulled, weeds
// handed in. Nothing listens yet; a future 「잡초 N개」 mission hooks in here.
// v1.10.37 연계 퀘스트: what the server confirmed on the island moves a story on (a weed pulled, an event solved -- its
// type, a place stood at). Each account's document for the week is kept here too, so standing about costs nothing.
const questWeek = (now = nowMs()) => weekStart(kstDate(now));
const questCache = new Map(); // account -> { week, doc, bag }
async function questState(account) {
  const week = questWeek(); const hit = questCache.get(account);
  if (hit?.week === week) return hit;
  const [{doc:weekly,bag},{doc:fixed}] = await Promise.all([pointStore.questDoc(account,week),pointStore.questDoc(account,'fixed')]);
  const st = { week, doc:{...weekly,...fixed}, bag, bagAt: nowMs() }; questCache.set(account, st); return st;
}
// the bag changes in many places (finds, sales, weeds); a thing to bring is counted from it, read again every few seconds
// ponytail: a timed re-read, not a hook on every bag change; per-change invalidation if the bag paths are ever unified
function questBagFresh(st, account) {
  if (nowMs() - st.bagAt < 2000 || st.reading) return;
  st.reading = true;
  pointStore.questDoc(account, st.week).then(({ bag }) => { st.bag = bag; st.bagAt = nowMs(); }).catch(() => {}).finally(() => { st.reading = false; });
}
let islandFarmAt = 0; let islandFarmView = null; // v1.10.80: asked again at most every 10 s (and at once after a helped round)
async function islandFarm() {
  const week = questWeek();
  if (islandFarmView?.week === week && nowMs() - islandFarmAt < 10000) return islandFarmView.view;
  const ids = await pointStore.questHelpers(week, 'farmer');
  const labels = new Map((await accessStore.list()).map((k) => [`guest:${k.id}`, k.label]));
  const names = ids.map((id) => (id === 'admin' ? '관리자' : labels.get(id))).filter(Boolean);
  islandFarmView = { week, view: { stage: Math.min(3, names.length), names } }; islandFarmAt = nowMs();
  return islandFarmView.view;
}
// v1.10.93 마을 공동 진행도 (IDEAS #future-island-minigames C안): this week's helpers of the painter and the busker change the
// island for everyone -- the mural in four stages (one more per helper), the stage playing once someone helped
let villageAt = 0; let villageView = null;
async function islandVillage() {
  const week = questWeek();
  if (villageView?.week === week && nowMs() - villageAt < 10000) return villageView.view;
  const [painter, busker, electrician, builder, librarian] = await Promise.all(['painter', 'busker', 'electrician', 'builder', 'librarian'].map((id) => pointStore.questHelpers(week, id)));
  // (A2b: the lamps mended one per helper, the stepping stones in four stages, the book cart filled once helped)
  villageView = { week, view: { mural: Math.min(3, painter.length), busk: busker.length > 0, lamps: Math.min(3, electrician.length), stones: Math.min(3, builder.length), books: librarian.length > 0 } }; villageAt = nowMs();
  return villageView.view;
}
// v1.10.69 오늘의 문제: the settlement of an account's first clear of a game, level and day (A2b: has it been solved today?)
const puzzleClaim = (account, game, level, date) => crypto.createHash('sha256').update(`puzzle|${account}|${game}|${level}|${date}`).digest('hex').slice(0, 40);
const puzzleSolved = async (account, game, level) => Boolean(await pointStore.settlementOf(`solo:pz-${puzzleClaim(account, game, level, kstDate(nowMs()))}`));
async function questApply(account, fn, scope = 'week') {
  const st = await questState(account);
  const out = await pointStore.questApply(account, scope==='fixed'?'fixed':st.week, fn);
  if (out?.doc) { st.doc = {...st.doc,...out.doc}; if (out.bag) { st.bag = out.bag.items.map(({ entryId, itemId, qty, meta }) => ({ entryId, itemId, qty, meta })); st.bagAt = nowMs(); } }
  return out;
}
function islandProgress(kind, account, qty, where = null) { // (A2b: a promise -- a talk may wait for it)
  const what = kind === 'weed_pull' ? 'weed' : kind;
  return questState(account).then((st) => {
    if (!IslandQuests.note(st.doc, what, { qty, ...(where || {}) })) return null; // nothing of mine waits on it
    return Promise.all(['week','fixed'].map(scope=>questApply(account, doc=>{
      const next=IslandQuests.note(doc,what,{qty,...(where||{}),scope});
      return next?{doc:next,reward:0}:null;
    },scope)));
  }).catch((error) => console.error('연계 퀘스트 기록 실패:', error.message));
}
// the islanders with a story, for the map and the 「SPACE · 말 걸기」 (always sent: they stand still), and the place the
// step I am on points to
function questEntries(account) {
  const st = questCache.get(account); if (!st || st.week !== questWeek()) { questState(account).catch(() => {}); return { entries: [], track: [] }; }
  questBagFresh(st, account);
  const entries = []; const track = [];
  for (const id of IslandQuests.visibleStories(st.doc,nowMs())) {
    const story=IslandQuests.STORIES[id];
    if (!IslandQuests.isOpen(id, nowMs())) continue; // v1.10.39: the Halloween kid only in October
    const s = st.doc[id] || { step: 0, taken: false, count: 0, done: false };
    entries.push({ id: `quest${id}`, kind: 'quest_npc', x: story.at.x, z: story.at.z, verb: '말 걸기', mark: IslandQuests.markOf(id, s, st.bag), story: id, name: story.name, done: Boolean(s.done), requested: Boolean(s.taken && !s.done) });
    const t = IslandQuests.trackOf(id, s, st.bag);
    if (t) { track.push(t); if (t.to && !t.ready) entries.push({ id: `questspot${id}`, kind: 'quest_spot', x: t.to.x, z: t.to.z, verb: null }); }
  }
  return { entries, track };
}
// v1.10.37 혼자 하는 게임: one game a session at a time, on the server (lib/minesweeper.js); gone with the session
const soloGames = new Map(); // session token -> { id, level, engine }
const reflexRuns = new Map(); // v1.10.68 순발력 게임: round id -> { account, game, level, at } (memory only)
const puzzleStarts = new Map(); // v1.10.69 오늘의 문제: 'account|game|level|date' -> when it was first opened (memory only)
const cardRuns = new Map(); // v1.10.70 카드 게임: round id -> { account, game, level, seed, at } (memory only)
// v1.10.61 두 세계 영웅전: runs started and not yet reported (memory only; a restart just loses runs in progress)
const herosurvRuns = new Map(); // runId -> { account, board, at }
let herosurvLatest = null; // the board the game last started a run on (kept in the world values)
const HEROSURV_RUN_MS = 5 * 60 * 60 * 1000;
function herosurvPlayerId(account) { // stable, and reveals nothing about the account
  const h = crypto.createHash('sha256').update(`herosurv:${account}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
const weedTimer = setInterval(() => { weedState().catch((error) => console.error('잡초 보충 실패:', error.message)); }, 60 * 1000);
weedTimer.unref?.();

// v1.10.9 작명소: what a nickname may be and when two are the same (every space removed). One change at a time on this
// server, so two people can never take the same new name at once.
// ponytail: an in-process lock (one instance, WEB_CONCURRENCY=1); a unique index on the normalized name if it ever scales out
const NICKNAME_MAX = 12;
const NICKNAME_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const RESERVED_NICKNAMES = new Set(['관리자', '게스트']);
const normalizeNickname = (name) => String(name || '').replace(/\s+/g, '');
const nicknameFormatOk = (name) => name.length <= NICKNAME_MAX && /^[가-힣ㄱ-ㅎㅏ-ㅣ0-9 ]+$/.test(name) && normalizeNickname(name).length > 0;
let nicknameQueue = Promise.resolve();
function withNicknameLock(fn) { const run = nicknameQueue.then(fn, fn); nicknameQueue = run.catch(() => {}); return run; }
// The new name everywhere at once: the entry key (stays the same file) and every open session of it -- the island name
// tag, chat and rooms take the session's name from here on.
async function renameGuest(keyId, name) {
  const row = await accessStore.rename(keyId, name);
  if (!row) return null;
  for (const session of sessions.values()) if (session.guestKeyId === keyId) session.label = name;
  return row;
}

// v1.10.7 게임 아일랜드 당일 위치 (IDEAS 「당일 접속 위치 복원」): each account's last island spot today (Asia/Seoul). Kept
// in memory as poses arrive and written to the store only every PLAZA_SPOT_SAVE_MS, when the player leaves the island
// (a room, logout) and when the server stops -- never once per pose. Separate from rooms and their rejoin state.
const PLAZA_SPOT_SAVE_MS = 15000;
const plazaSpots = new Map(); // account -> { day, x, z, dirty }
// Somewhere a character may stand (land, a bridge or the pier; not the sea, a stream, the pond, a cliff edge or the
// fountain). Spots that are not -- the island changed since, or a hand-made request -- move to the nearest one that
// is, and to the plaza when nothing is near.
const plazaStandable = (x, z) => Math.abs(x) <= PLAZA_BOUND && Math.abs(z) <= PLAZA_BOUND && Math.hypot(x, z) > 3.9 && IslandTerrain.walkable(x, z);
function plazaSafeSpot(x, z) {
  if (plazaStandable(x, z)) return { x, z };
  for (let r = 1; r <= 12; r += 1) {
    for (let k = 0; k < 16; k += 1) {
      const a = (k / 16) * Math.PI * 2; const sx = Math.round((x + Math.cos(a) * r) * 100) / 100; const sz = Math.round((z + Math.sin(a) * r) * 100) / 100;
      if (plazaStandable(sx, sz)) return { x: sx, z: sz };
    }
  }
  return null;
}
// v1.10.41 관공서 정문 시장 (IDEAS 2026-10-07, 「접속 동안만」): the mayor at the yard's gate lets a player in for the
// rest of their visit once asked; until then a pose inside the yard is put back out at the gate. Admins pass; in tests
// everyone passes unless a test asks for the real rule (townhallStrict).
const townhallPass = new Set(); const townhallStrict = new Set(); // session tokens
const fishCasts = new Map(); // v1.10.42 낚시: session token -> { id, species, biteAt, at, done }
// v1.10.44 앉기·이모트 (IDEAS ④): who sits where (first come), and the acts a pose may carry
const SEATS = new Map(IslandTerrain.plazaProps().seats.map((s) => [s.id, s]));
const seatTaken = new Map(); // seat id -> session token
const PLAZA_ACTS = new Set(['sit', 'wave', 'cheer', 'nod', 'clap', 'bow']);
// v1.10.89 원격 낚시: a fishing phase, taken only while this player has a cast in the water (a miss also just after);
// the fish shown on a catch is the server's own result, never the page's word
const FISH_ACTS = new Set(['fish:cast', 'fish:wait', 'fish:reel', 'fish:catch', 'fish:miss']);
// v1.10.92 잡화점 놀이 물건: an act `show:<kind>` is taken only just after that good was used from the bag (6 s)
const showUsed = new Map(); // session token -> { kind, until }
function showActOf(token, act) { const u = showUsed.get(token); return u && act === `show:${u.kind}` && nowMs() < u.until ? { act, fish: null } : null; }
function fishActOf(token, act) {
  if (!FISH_ACTS.has(act)) return null;
  const c = fishCasts.get(token);
  if (act === 'fish:miss') return { act, fish: null };
  if (!c) return null;
  if (act === 'fish:catch') return c.done?.species ? { act, fish: c.done.species } : null;
  return { act, fish: null };
}
// v1.10.47 관광열차: who is on which train's seat (session token -> { k, seat, from: the stop they got on at }). The trains
// themselves are the shared timetable (island-train.js) on the server clock; `trainShift` moves that clock in tests only.
const trainVisitors = new Map();
const trainRiders = new Map(); let trainShift = 0; let trainTraffic = IslandTrain.createTraffic(nowMs());
function trainService() { const snapshot = trainTraffic.advance(trainNow()); IslandTrain.setService(snapshot); return snapshot; }
const trainNow = () => nowMs() + trainShift;
const trainDocked = (stopId, id = null, line = null) => { trainService(); const candidates = IslandTrain.TRAINS.map((t) => IslandTrain.trainAt(t.id, trainNow())).filter((st) => st.stop && st.wait > 0.7 && st.wait <= IslandTrain.DWELL - 0.7 && (!stopId || st.stop === stopId) && (id === null || st.id === id) && (!line || st.line === line)); return candidates[0] || null; };
function freeSeat(token) { for (const [id, t] of seatTaken) if (t === token) seatTaken.delete(id); }
const TOWNHALL_GATE_OUT = (() => { const p = IslandTerrain.townhallWorld(0, IslandTerrain.TOWNHALL.yard.z1 + 1.4); return { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 }; })();
const passesGate = (session) => townhallPass.has(session.token) || session.role === 'admin' || (process.env.NODE_ENV === 'test' && !townhallStrict.has(session.token));
function notePlazaSpot(account, x, z, now = nowMs()) {
  if (!account || !plazaStandable(x, z)) return; // only a spot one may stand on is kept
  plazaSpots.set(account, { day: kstDate(now), x, z, dirty: true });
}
let plazaSpotSaving = null;
function savePlazaSpots() {
  if (plazaSpotSaving) return plazaSpotSaving;
  const list = [];
  for (const [userId, spot] of plazaSpots) if (spot.dirty) { spot.dirty = false; list.push({ userId, day: spot.day, x: spot.x, z: spot.z }); }
  if (!list.length) return Promise.resolve();
  plazaSpotSaving = pointStore.savePlazaSpots(list)
    .catch((error) => { console.error('아일랜드 위치 저장 실패:', error.message); for (const s of list) { const cur = plazaSpots.get(s.userId); if (cur && cur.x === s.x && cur.z === s.z) cur.dirty = true; } })
    .finally(() => { plazaSpotSaving = null; });
  return plazaSpotSaving;
}
// Today's spot of an account (memory first, then the store), already moved to somewhere one may stand; null = start at
// the central plaza (a new day, or never on the island).
async function plazaSpotToday(account, now = nowMs()) {
  if (!account) return null;
  const spot = plazaSpots.get(account) || await pointStore.plazaSpot(account).catch(() => null);
  if (!spot || spot.day !== kstDate(now)) return null;
  if (IslandTerrain.inTownhallYard(spot.x, spot.z)) return { ...TOWNHALL_GATE_OUT }; // v1.10.41: a new visit asks the mayor again
  return plazaSafeSpot(spot.x, spot.z);
}
const plazaSpotTimer = setInterval(() => { for (const [account, spot] of plazaSpots) if (!spot.dirty && spot.day !== kstDate()) plazaSpots.delete(account); savePlazaSpots(); }, PLAZA_SPOT_SAVE_MS);
plazaSpotTimer.unref?.();
process.once('SIGTERM', () => { savePlazaSpots().finally(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); });

async function broadcastAnnouncements() {
  const items = await announcementStore.list();
  for (const entry of [...lobbyStreams]) {
    if (!sessions.has(entry.sessionToken)) continue;
    try { sseWrite(entry.res, 'announcements', { items }); }
    catch { lobbyStreams.delete(entry); }
  }
}

function uniqueLiveTokens(roomId) {
  const set = streams.get(roomId);
  return new Set(set ? [...set].map((x) => x.sessionToken) : []);
}

function newParticipant(session, connected = false) {
  return {
    sessionToken: session.token,
    identity: sessionIdentity(session), // stable within the room; sessionToken is not
    label: session.label,
    guestKeyId: session.guestKeyId, // server-only identity for interrupted game reconnection
    role: session.role,
    recordId: session.guestKeyId || `admin:${session.publicId}`,
    rejoinable: false,
    connected,
    joinedAt: nowIso(),
    lastSeen: nowIso(),
    choice: null,
  };
}

function makeRoom(hostSession, requestedGameType = 'omok', visibility = 'private', options = {}) {
  const gameEngine = getGame(requestedGameType);
  if (!gameEngine) return null;
  let code;
  do code = generateRoomCode(); while ([...rooms.values()].some((r) => r.code === code));
  const id = newSecret(12);
  const t = nowIso();
  const room = {
    id,
    code,
    visibility,
    gameType: gameEngine.id,
    title: options.title || '',
    createdAt: t,
    updatedAt: t,
    hostSessionToken: hostSession.token,
    hostIdentity: sessionIdentity(hostSession),
    participants: { [hostSession.token]: newParticipant(hostSession, false) },
    players: gameEngine.id === 'gostop'
      ? Object.fromEntries(GOSTOP_SEATS.map((seat) => [seat, null]))
      : ['oldmaid', 'davinci', 'pandemic'].includes(gameEngine.id)
      ? Object.fromEntries(OLDMAID_SEATS.map((seat) => [seat, null]))
      : gameEngine.id === 'halligalli'
      ? Object.fromEntries(HALLI_SEATS.map((seat) => [seat, null]))
      : ['pictionary', 'liar', 'twentyquestions'].includes(gameEngine.id)
      ? Object.fromEntries(PICTIONARY_SEATS.map((seat) => [seat, null]))
      : ['omok2v2', 'bingo', 'rpg'].includes(gameEngine.id)
        ? { '1': null, '2': null, '3': null, '4': null }
        : { black: null, white: null },
    social: createRoomSocial(),
    game: gameEngine.create(gameEngine.id === 'baseball' ? { digitCount: options.digitCount } : undefined),
  };
  if (gameEngine.id === 'gostop' && options.pointsPerScore) gameEngine.setStake(room.game, options.pointsPerScore);
  appendSystemMessage(room, `${hostSession.label || '방장'}님이 ${room.title || gameEngine.name + ' 방'}을 만들었습니다.`);
  return room;
}

function touchRoom(room) { room.updatedAt = nowIso(); }

// v1.10.72 게임방 AI 자리 (lib/room-ai.js): the AI is a participant with no session (always connected, no point account,
// no record id); it takes the seat across from the person when they choose one. Its move goes through the same game
// engine as a person's, a short moment after the person's turn so it does not feel instant.
// A3 G1-4: the turn seat's clock as everyone may see it -- the same deadline its owner gets (lib/action-timer.js)
function publicTurnTimer(room) {
  const seat = currentTurnSeat(room); if (seat == null || (room.ai && String(seat) === String(room.ai.seat))) return null;
  const t = buildActionTimer(room, seat, nowMs(), AFK_TIMEOUT_MS);
  return t ? { seat: String(seat), deadlineAt: t.deadlineAt, serverNow: t.serverNow } : null;
}
// A4 별똥별: tests may move the stars' clock (so a star falls now); otherwise the server clock
let starShiftMs = 0; const starNow = (ms) => ms + starShiftMs;
// A4 주말 섬 대회 (lib/island-contest.js): the live board in memory -- ponytail: a restart during the 30 minutes loses that
// contest's board (kept in the store only once settled); upgrade path: a contest_scores table if it matters
// A5 공지 예약: every change to the queue goes one after another (adding, cancelling, posting -- Codex review); a due
// notice is taken off only after it is posted (ponytail: a crash between the two posts it again; an id mark if it matters)
let noticeChain = Promise.resolve();
const editNoticeQueue = (fn) => { const run = noticeChain.then(async () => {
  const queue = (await pointStore.worldValue('noticeQueue')) || []; const out = await fn(queue);
  if (out.queue) await pointStore.setWorldValue('noticeQueue', out.queue); return out.value;
}); noticeChain = run.catch(() => {}); return run; };
function postDueNotices() {
  if (!pointStore) return null;
  return editNoticeQueue(async (queue) => {
    const now = nowMs(); const posted = new Set();
    try { for (const e of queue.filter((q) => q.at <= now)) { await announcementStore.create(e.title, e.body, e.pinned); posted.add(e.id); } } catch (error) { console.error('예약 공지 실패:', error.message); } // (the rest wait for the next round)
    if (posted.size) await broadcastAnnouncements().catch(() => {});
    return { queue: posted.size ? queue.filter((e) => !posted.has(e.id)) : null };
  }).catch((error) => console.error('예약 공지 실패:', error.message));
}
setInterval(postDueNotices, 30000).unref?.();
let contestShiftMs = 0; const contestNow = () => nowMs() + contestShiftMs; // (tests may move the contest's clock)
let contestBoard = { id: null, rows: new Map() }; let contestPhase = null;
let contestKindTest = null; // (tests: the week's event held at one kind)
const contestKindHeld = (c) => (c && contestKindTest ? Object.assign(c, { kind: contestKindTest, name: IslandContest.KINDS[contestKindTest].name, how: IslandContest.KINDS[contestKindTest].how, unit: IslandContest.KINDS[contestKindTest].unit }) : c);
async function contestState() { return contestKindHeld(IslandContest.phaseAt(contestNow(), (await pointStore.worldValue('contest'))?.config)); }
async function contestEnded() { return contestKindHeld(IslandContest.lastEnded(contestNow(), (await pointStore.worldValue('contest'))?.config)); }
function contestNote(account, session, kind, value) {
  contestState().then((c) => {
    if (c.phase !== 'live' || c.kind !== kind || !Number.isFinite(value) || value <= 0) return;
    if (contestBoard.id !== c.id) contestBoard = { id: c.id, rows: new Map() };
    const row = contestBoard.rows.get(account) || { account, name: String(session.label || '게스트'), score: 0, at: 0 };
    const score = IslandContest.merge(kind, row.score, value); if (score !== row.score) { row.score = score; row.at = contestNow(); }
    contestBoard.rows.set(account, row);
  }).catch(() => {});
}
const contestTop = (n) => IslandContest.rank([...contestBoard.rows.values()]).slice(0, n).map((r, i) => ({ rank: i + 1, name: r.name, score: r.score }));
// after the end: rewards once (claimEvent ids per contest), the result kept, the winner on the plaza until the next
async function settleContest(c) {
  const done = await pointStore.worldValue('contestResult'); if (done?.id === c.id) return done;
  const rows = contestBoard.id === c.id ? IslandContest.rank([...contestBoard.rows.values()]) : [];
  const rewarded = rows.length >= IslandContest.MIN_ENTRANTS; const paid = [];
  if (rewarded) for (const [i, r] of rows.entries()) {
    const amount = (IslandContest.REWARDS[i + 1] || 0) + IslandContest.REWARDS.join;
    const out = await pointStore.claimEvent({ eventId: `${c.id}_prize`, userId: r.account, amount, title: `${c.name} ${i < 3 ? `${i + 1}위` : '참가'}` });
    if (out.applied) paid.push(r.account);
  }
  if (paid.length) notifyPointsChanged(paid);
  const winner = rewarded && rows[0] ? (() => { const al = avatarLookOf(equippedSkinCache.get(rows[0].account) || {}); return { name: rows[0].name, look: al.look, title: al.title, score: rows[0].score }; })() : null;
  const result = { id: c.id, kind: c.kind, name: c.name, unit: c.unit, top: rows.slice(0, 3).map((r, i) => ({ rank: i + 1, name: r.name, score: r.score })), entrants: rows.length, rewarded, winner };
  await pointStore.setWorldValue('contestResult', result); contestWinnerStatue = winner ? { name: winner.name, look: winner.look, title: winner.title, label: c.name } : contestWinnerStatue;
  if (winner) { for (const entry of lobbyStreams) { try { sseWrite(entry.res, 'statues', statueSnapshot()); } catch { lobbyStreams.delete(entry); } } } // (the winner joins the statues)
  return result;
}
// every 15 s: the latest contest over is settled until it is (settleContest is once per id; a failed one is tried again
// -- Codex review), and the phase turns are told to the island (the notice 10 min before, the start, the end)
setInterval(() => { contestState().then(async (c) => {
  if (contestWinnerStatue === null) { const r = await pointStore.worldValue('contestResult'); contestWinnerStatue = r?.winner ? { name: r.winner.name, look: r.winner.look, title: r.winner.title, label: r.name } : false; } // (after a restart)
  const ended = await contestEnded(); if (ended) await settleContest(ended);
  if (c.phase === contestPhase) return; contestPhase = c.phase; broadcastIsland('contest', { phase: c.phase, id: c.id }); }).catch((error) => console.error('섬 대회 정산 실패:', error.message)); }, 15000).unref?.();
function seatRoomAi(room, level) {
  const token = `ai:${room.id}`;
  room.ai = { level, token, seat: 'white' };
  room.participants[token] = { sessionToken: token, identity: 'ai', label: `AI · ${RoomAi.LEVELS[level]}`, ai: true, role: 'ai', rejoinable: false,
    connected: true, joinedAt: nowIso(), lastSeen: nowIso(), choice: null };
}
function scheduleAiMove(room) {
  const ai = room.ai; const g = room.game;
  if (!ai || ai.thinking || g.status !== 'playing' || g.paused || g.turn !== ai.seat || room.players[ai.seat] !== ai.token) return;
  ai.thinking = true;
  const round = g.round; const moves = g.moves.length; const started = nowMs();
  RoomAi.think(room.gameType, g, ai.seat, ai.level).then(async (move) => {
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, 500 - (nowMs() - started))));
    ai.thinking = false;
    syncGamePause(room, false); // the person may have dropped while the AI thought (Codex review): then the idle tick asks again
    if (rooms.get(room.id) !== room || room.game !== g || g.round !== round || g.moves.length !== moves || g.status !== 'playing' || g.turn !== ai.seat || g.paused) return;
    const verdict = move && (getGame(room.gameType)).applyMove(g, move.x, move.y, ai.seat, nowIso());
    if (!verdict?.legal) { console.error('AI 착수 실패:', room.gameType, JSON.stringify(move)); return; }
    if (verdict.passed) appendSystemMessage(room, `${verdict.passed === 'black' ? '흑' : '백'}은 둘 수 있는 곳이 없어 자동으로 패스했습니다.`);
    touchRoom(room); broadcast(room);
    scheduleAiMove(room); // 오델로: the person may have had to pass
  }).catch((error) => {
    ai.thinking = false;
    console.error('AI 계산 실패:', error.message);
    setTimeout(() => scheduleAiMove(room), 3000).unref?.();
  });
}

function registerParticipant(room, session) {
  const isNew = !room.participants[session.token];
  let reclaimedSeat = null;
  let previousChoice = null;
  if (isNew && session.guestKeyId) {
    for (const [oldToken, old] of Object.entries(room.participants)) {
      if (oldToken === session.token || participantIdentity(old) !== sessionIdentity(session)
        || old.connected || sessions.has(oldToken)) continue;
      const oldSeat = findSeat(room, oldToken);
      const isReconnectingHost = room.hostIdentity === sessionIdentity(session)
        || room.hostSessionToken === oldToken;
      if (!isReconnectingHost && !old.rejoinable) continue;
      if (oldSeat) {
        room.players[oldSeat] = session.token;
        reclaimedSeat = oldSeat;
      }
      previousChoice = old.choice;
      if (isReconnectingHost || room.hostSessionToken === oldToken) room.hostSessionToken = session.token;
      delete room.participants[oldToken];
      break;
    }
  }
  if (isNew) room.participants[session.token] = newParticipant(session, true);
  const p = room.participants[session.token];
  if (reclaimedSeat) p.choice = reclaimedSeat;
  else if (previousChoice) p.choice = previousChoice;
  p.label = session.label;
  p.connected = true;
  p.rejoinable = false;
  p.rejoinOnlyWhilePlaying = false;
  p.droppedMidMatch = false;
  p.lastSeen = nowIso();
  if (room.hostIdentity === sessionIdentity(session)) room.hostSessionToken = session.token;
  if (room.game.status !== 'selecting' && !findSeat(room, session.token)) p.choice = 'spectator';
  if (isNew) appendSystemMessage(room, (session.label || '게스트') + '님이 입장했습니다.');
  return p;
}

// v1.9.10: opening the entry file again is a fresh visit to Game Island, except when the room is still waiting for this
// person: they dropped out of a match in progress, or other players are still connected there (a rematch after the
// last game). An abandoned room is not entered by itself; the seat or host role is still given back on joining it again.
function roomAwaits(room, oldToken, p) {
  return Boolean(p.droppedMidMatch) || Object.entries(room.participants)
    .some(([token, other]) => token !== oldToken && other.connected && sessions.has(token));
}

function findSeat(room, token) {
  if (isNumberedSeatGame(room)) return seatsFor(room).find(seat => room.players[seat] === token) || null;
  if (room.players.black === token) return 'black';
  if (room.players.white === token) return 'white';
  return null;
}

// Shared disconnect/AFK handling. Most games keep the existing room-wide pause behavior.
// Twenty Questions is intentionally different: one missing challenger must not lock everybody.
// Challengers get a 60s turn/reconnect window and are skipped; the drawer gets a 60s reconnect
// or response window because only the drawer can answer/judge the secret. If that expires, the
// current round is voided with no score and the server advances to the next round automatically.
function voidStalledTwentyRound(room, reason) {
  const engine = getGame('twentyquestions');
  const drawerSeat = room.game.drawerSeat;
  const label = room.participants[room.players[drawerSeat]]?.label || `${drawerSeat}번 출제자`;
  const verdict = engine.voidRound(room.game, reason);
  if (!verdict.legal) return { stateChanged: false, gameFinished: false };

  appendSystemMessage(room, reason === 'drawer-disconnected'
    ? `${label}님이 60초 안에 재접속하지 않아 이번 라운드는 점수 없이 무효 처리됩니다.`
    : `${label}님이 60초 동안 응답하지 않아 이번 라운드는 점수 없이 무효 처리됩니다.`);

  room.turnWatch = null;
  room.twentyDrawerDisconnectSince = null;

  if (!verdict.finished) {
    const next = engine.nextRound(room.game);
    if (next.legal) {
      appendSystemMessage(room, `스무고개 ${room.game.roundNumber}/${room.game.totalRounds}라운드 자동 시작 · 카테고리: ${room.game.category}`);
    }
  } else {
    appendSystemMessage(room, '스무고개 종료! 무효 라운드는 점수에 포함하지 않고 최종 점수가 확정됐습니다.');
  }
  return { stateChanged: true, gameFinished: room.game.status === 'finished' };
}

function syncGamePause(room, allowTimeouts = true) {
  // 잿빛 원정 is real time: a missing player's character simply stops (see tickRpgRooms); the run
  // itself only waits while nobody at all is connected.
  if (room.game.status !== 'playing' || isRpg(room)) {
    room.game.paused = false;
    room.game.disconnectedSeats = [];
    room.turnWatch = null;
    room.twentyDrawerDisconnectSince = null;
    return { stateChanged: false, gameFinished: false };
  }

  const disconnected = assignedSeatsFor(room).filter(seat => {
    const token = room.players[seat];
    const person = token && room.participants[token];
    if (person?.ai) return false; // v1.10.72: the AI seat is always there
    return !person?.connected || sessions.get(token)?.currentRoomId !== room.id;
  });

  if (isDavinci(room) || isHalli(room) || isPandemic(room)) {
    room.game.paused = false;
    room.game.disconnectedSeats = disconnected;
    room.turnWatch = null;
    return { stateChanged: false, gameFinished: false };
  }

  if (isTwenty(room)) {
    room.game.paused = false;
    room.game.disconnectedSeats = disconnected;

    const now = Date.now();
    const drawerSeat = room.game.drawerSeat;
    const drawerDisconnected = Boolean(drawerSeat && disconnected.includes(drawerSeat));

    // A disconnected drawer gets a full reconnect grace period even if a challenger currently has
    // the question turn. Reconnecting clears this clock instead of voiding the round.
    if (drawerDisconnected) {
      if (!room.twentyDrawerDisconnectSince) room.twentyDrawerDisconnectSince = now;
      else if (allowTimeouts && now - room.twentyDrawerDisconnectSince >= AFK_TIMEOUT_MS) {
        return voidStalledTwentyRound(room, 'drawer-disconnected');
      }
    } else {
      room.twentyDrawerDisconnectSince = null;
    }

    const turnSeat = currentTurnSeat(room);
    if (!turnSeat) {
      room.turnWatch = null;
      return { stateChanged: false, gameFinished: false };
    }

    // Drawer disconnects use the dedicated reconnect grace clock above; don't also run the generic
    // turn clock or the round could expire twice for the same outage.
    // v1.6.99: a turn player who drops still gets the full reconnect grace, but coming back to
    // the same phase keeps the original deadline instead of a fresh 60 seconds.
    const base = `${room.game.phase}:${turnSeat}`;
    const previous = room.turnWatch;
    const keptTime = previous?.key === `${base}:idle` ? { base, since: previous.since }
      : (previous?.resume?.base === base ? previous.resume : null);
    if (turnSeat === drawerSeat && drawerDisconnected) {
      // No turn clock runs here (the drawer grace above does); only the used time is remembered.
      room.turnWatch = keptTime ? { key: `${base}:drawer-away`, seat: turnSeat, since: null, resume: keptTime } : null;
      return { stateChanged: false, gameFinished: false };
    }

    const turnDisconnected = disconnected.includes(turnSeat);
    const watchKey = `${base}:${turnDisconnected ? 'disconnected' : 'idle'}`;
    if (!room.turnWatch || room.turnWatch.key !== watchKey) {
      const since = !turnDisconnected && previous?.resume?.base === base ? previous.resume.since : now;
      room.turnWatch = { key: watchKey, seat: turnSeat, since, resume: turnDisconnected ? keptTime : null };
      return { stateChanged: false, gameFinished: false };
    }
    if (!allowTimeouts || now - room.turnWatch.since < AFK_TIMEOUT_MS) {
      return { stateChanged: false, gameFinished: false };
    }

    if (['asking', 'final-guesses'].includes(room.game.phase)) {
      const verdict = getGame('twentyquestions').skipTurn(room.game, turnSeat);
      if (!verdict.legal) return { stateChanged: false, gameFinished: false };
      const label = room.participants[room.players[turnSeat]]?.label || `${turnSeat}번`;
      appendSystemMessage(room, verdict.final
        ? `${label}님의 최종 정답 시간이 지나 마지막 기회가 소진됐습니다.`
        : turnDisconnected
          ? `${label}님이 차례 중 60초 안에 재접속하지 않아 다음 도전자로 넘어갑니다.`
          : `${label}님의 입력 시간이 지나 다음 도전자로 넘어갑니다.`);
      room.turnWatch = null;
      return { stateChanged: true, gameFinished: room.game.status === 'finished' };
    }

    if (['secret', 'answering', 'judging'].includes(room.game.phase)) {
      return voidStalledTwentyRound(room, 'drawer-timeout');
    }

    room.turnWatch = null;
    return { stateChanged: false, gameFinished: false };
  }

  // Existing behavior for all other games: a real disconnect immediately pauses the room, while
  // a connected player sitting on their own turn for 60s is folded into the same pause signal.
  if (isPictionary(room) || isLiar(room)) {
    room.turnWatch = null;
  } else if (disconnected.length > 0) {
    // v1.6.99: while the room is paused for someone else's dropped connection (a refresh included)
    // the turn player cannot act, so their clock is frozen and later resumes where it was instead
    // of restarting at 60 seconds. A turn player who dropped themselves keeps their deadline.
    const turnSeat = currentTurnSeat(room);
    if (room.turnWatch && room.turnWatch.seat === turnSeat && !room.turnWatch.pausedAt && !disconnected.includes(turnSeat)) {
      room.turnWatch.pausedAt = Date.now();
    }
    if (room.turnWatch && room.turnWatch.seat === turnSeat && disconnected.includes(turnSeat)) room.turnWatch.away = true;
  } else {
    const turnSeat = currentTurnSeat(room);
    // v1.8.4: a turn player who dropped after their deadline had already run out and then reconnects is back,
    // not still idle: without a fresh clock the stale deadline would flag them again on this very sync and the
    // room would stay paused until the others ended it (counting the returned player as the loser).
    if (room.turnWatch?.away) {
      if (Date.now() - room.turnWatch.since >= AFK_TIMEOUT_MS) room.turnWatch.since = Date.now();
      room.turnWatch.away = false;
    }
    if (room.turnWatch?.pausedAt) {
      room.turnWatch.since += Date.now() - room.turnWatch.pausedAt;
      room.turnWatch.pausedAt = null;
    }
    if (!turnSeat || (room.ai && turnSeat === room.ai.seat)) { // v1.10.72: no idle clock on the AI's own turn
      room.turnWatch = null;
    } else if (!room.turnWatch || room.turnWatch.seat !== turnSeat) {
      room.turnWatch = { seat: turnSeat, since: Date.now() };
    } else if (allowTimeouts && Date.now() - room.turnWatch.since >= AFK_TIMEOUT_MS) {
      disconnected.push(turnSeat);
    }
  }
  room.game.paused = disconnected.length > 0;
  room.game.disconnectedSeats = disconnected;
  return { stateChanged: false, gameFinished: false };
}

// Idle turns don't produce a request on their own, so this tick owns timeout transitions and
// broadcasts them. It also records a Twenty Questions match if a final drawer timeout ends it.
async function tickIdleRooms() {
  for (const room of rooms.values()) {
    if (room.game.status !== 'playing' || isPictionary(room) || isLiar(room) || isDavinci(room) || isHalli(room) || isPandemic(room)) continue;
    const wasPaused = room.game.paused;
    const pauseResult = syncGamePause(room);
    if (room.ai) scheduleAiMove(room); // v1.10.72: e.g. the person came back after a pause on the AI's turn
    if (pauseResult?.gameFinished) {
      try { await recordFinishedMatch(room); }
      catch (error) { console.error('스무고개 시간초과 전적 저장 실패:', error); }
    }
    if ((room.game.paused && !wasPaused) || pauseResult?.stateChanged) {
      touchRoom(room);
      broadcast(room);
    }
  }
}

function publicPlayer(room, color) {
  const token = room.players[color];
  if (!token) return null;
  const p = room.participants[token];
  const player = { label: p?.label || '게스트', connected: Boolean(p?.connected) };
  const family = familyOf(room.gameType);
  const skin = family ? equippedSkin(pointAccountForParticipant(p), family, 'piece') : null;
  if (skin) player.skin = skin; // v1.7.30: every viewer draws this player's pieces with the same skin
  // A3 G1-5 이름표 얼굴: the island look's public summary (skin and hair colours) and a worn title -- nothing else of the account
  const account = pointAccountForParticipant(p); const worn = account ? equippedSkinCache.get(account) : null;
  if (worn) { const al = avatarLookOf(worn); player.face = { skin: al.look.skinColor || null, hair: al.look.hairColor || null }; if (al.title) player.title = al.title; }
  return player;
}

function liveSpectatorCount(room) {
  const live = uniqueLiveTokens(room.id);
  let count = 0;
  for (const token of live) {
    if (findSeat(room, token)) continue;
    count += 1;
  }
  return count;
}

function publicParticipants(room) {
  const live = uniqueLiveTokens(room.id);
  return Object.values(room.participants)
    .filter((p) => p.connected || live.has(p.sessionToken))
    .map((p) => ({
      label: p.label || '게스트',
      playerId: p.recordId || p.guestKeyId || null,
      connected: Boolean(p.connected || live.has(p.sessionToken)),
      seat: findSeat(room, p.sessionToken),
      choice: p.choice || null,
      isHost: (room.hostIdentity && room.hostIdentity === participantIdentity(p))
        || room.hostSessionToken === p.sessionToken,
    }))
    .sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.label.localeCompare(b.label, 'ko'));
}

function publicRoom(room) {
  const live = uniqueLiveTokens(room.id);
  const gameEngine = getGame(room.gameType) || getGame('omok');
  return {
    // v1.7.3: the room's point rule and this game's entry state (no balances, no account ids).
    // v1.10.72: an AI room is free practice (Codex review: it showed the entry rule it does not charge)
    points: { policy: room.ai ? 'practice' : pointPolicy(room.gameType), entryFee: !room.ai && pointPolicy(room.gameType) === 'entry' ? ENTRY_FEE : 0,
      burnPercent: room.ai ? 0 : pointPolicy(room.gameType) === 'entry' ? ENTRY_BURN_PERCENT : pointPolicy(room.gameType) === 'settlement' ? SETTLEMENT_BURN_PERCENT : 0,
      entry: room.entry ? { n: room.entry.n, status: room.entry.status, fee: room.entry.fee, pool: room.entry.pool, players: room.entry.participants.length,
        each: room.entry.each ?? null, winners: room.entry.winnerCount ?? null, burned: room.entry.burned ?? null } : null },
    visibility: room.visibility,
    gameType: gameEngine.id,
    gameName: gameEngine.name,
    title: room.title || null,
    rules: gameEngine.rules,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    connectedCount: live.size,
    spectatorCount: liveSpectatorCount(room),
    participants: publicParticipants(room),
    chat: { messages: publicChatMessages(room) },
    players: isNumberedSeatGame(room) ? Object.fromEntries(seatsFor(room).map(seat => [seat, publicPlayer(room, seat)])) : {
      black: publicPlayer(room, 'black'),
      white: publicPlayer(room, 'white'),
    },
    maxPlayers: isNumberedSeatGame(room) ? seatsFor(room).length : 2,
    game: gameEngine.publicState(room.game),
    ...(familyOf(room.gameType) && equippedSkin(accountOfIdentity(room.hostIdentity), familyOf(room.gameType), 'theme')
      ? { skinTheme: equippedSkin(accountOfIdentity(room.hostIdentity), familyOf(room.gameType), 'theme') } : {}), // the host's room theme
  };
}

// v1.6.84: every room snapshot carries a strictly increasing sequence number. The server is
// single-threaded, so a snapshot built later always reflects at least every mutation an earlier
// one did; the client uses it to drop a stale HTTP response that arrives after a newer SSE push
// (seen live as a spectator's screen freezing on the state from before the players sat down).
// Seeded from the clock so it keeps increasing across restarts.
let roomViewSeq = Date.now() * 1000;

function roomView(room, session) {
  const p = room.participants[session.token] || null;
  const seat = findSeat(room, session.token);
  const isHost = isRoomHost(room, session);
  roomViewSeq += 1;
  const base = publicRoom(room);
  let gameView = isHalli(room) ? { ...getGame('halligalli').publicState(room.game), serverNow: nowMs() }
    : isLiar(room) ? getGame('liar').publicState(room.game, seat)
    : base.game;
  if (isGostop(room) && room.game.status === 'selecting') {
    gameView = {
      ...gameView,
      lobbyPoints: Object.fromEntries(seatsFor(room).filter(seatNumber => room.players[seatNumber]).map((seatNumber) => {
        const userId = pointAccountForSeat(room, seatNumber);
        const balance = userId ? (pointStore?.cachedBalance(userId) ?? null) : null;
        return [seatNumber, { balance, eligible: balance === null ? null : balance > 0 }];
      })),
    };
  }
  return {
    ...base,
    stateSeq: roomViewSeq,
    game: gameView,
    turnTimer: publicTurnTimer(room), // A3 G1-4 차례 시간 고리: whose turn and until when, for every viewer (nothing private)
    me: {
      label: session.label,
      chatId: chatIdFor(session),
      isHost,
      seat,
      choice: p?.choice || null,
      watching: Boolean(p && !seat && p.choice === 'spectator'),
      roomCode: isHost ? room.code : null,
      actionTimer: buildActionTimer(room, seat, nowMs(), AFK_TIMEOUT_MS),
      // A secret is only ever sent back to its owning player, never to other players or spectators.
      mySecret: room.gameType === 'baseball' && seat ? room.game.secrets[seat] : null,
      myBingoBoard: room.gameType === 'bingo' && seat ? getGame('bingo').boardFor(room.game, seat) : null,
      myWord: isPictionary(room) ? getGame('pictionary').wordFor(room.game, seat) : null,
      myTwentySecret: isTwenty(room) ? getGame('twentyquestions').secretFor(room.game, seat) : null,
      myDavinciTiles: isDavinci(room) ? getGame('davinci').tilesFor(room.game, seat) : null,
      myDavinciDrawn: isDavinci(room) ? getGame('davinci').drawnFor(room.game, seat) : null,
      myPandemic: isPandemic(room) && seat ? getGame('pandemic').privateFor(room.game, seat) : null,
      myOldMaidHand: isOldMaid(room) ? getGame('oldmaid').handFor(room.game, seat) : null,
      myOldMaidAbility: isOldMaid(room) && seat ? getGame('oldmaid').abilityFor(room.game, seat) : null,
      // Go-Stop: only this viewer's own hand ever leaves the server (never another player's).
      myGostopHand: isGostop(room) && seat ? getGame('gostop').handFor(room.game, seat) : null,
      pointBalance: pointStore?.cachedBalance(pointAccountForSession(session)) ?? null,
    },
  };
}

function broadcast(room) {
  // Twenty Questions timeout transitions are owned by the periodic tick/action path so a broadcast
  // cannot void or skip twice. Other games retain their existing broadcast-time AFK pause behavior.
  syncGamePause(room, !isTwenty(room));
  const set = streams.get(room.id);
  if (!set) return;
  for (const client of [...set]) {
    const session = sessions.get(client.sessionToken);
    if (!session) {
      try { sseWrite(client.res, 'sessionExpired', { message: '입장 세션이 만료되었습니다.' }); client.res.end(); } catch {}
      set.delete(client);
      continue;
    }
    sseWrite(client.res, 'roomState', roomView(room, session));
  }
  if (set.size === 0) streams.delete(room.id);
  broadcastLobby(); // role selection, game start, spectator and round state affect room cards
}

function maybeStart(room) {
  if (isRpg(room) || isGostop(room) || isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isTwenty(room) || isDavinci(room) || isHalli(room) || isPandemic(room)) return;
  if (isTeam(room)) {
    if (room.game.status !== 'selecting' || !TEAM_SEATS.every(seat => room.players[seat])) return;
    getGame('omok2v2').start(room.game);
    for (const p of Object.values(room.participants)) {
      if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
    }
    syncGamePause(room);
    return;
  }
  if (room.players.black && room.players.white && room.game.status === 'selecting') {
    const gameEngine = getGame(room.gameType) || getGame('omok');
    gameEngine.start(room.game);
    for (const p of Object.values(room.participants)) {
      if (p.sessionToken !== room.players.black && p.sessionToken !== room.players.white) p.choice = 'spectator';
    }
  }
}

function prepareNextRound(room) {
  const gameEngine = getGame(room.gameType) || getGame('omok');
  gameEngine.reset(room.game);
  // A prior round's disconnect-forced ending must not leak into the fresh round (no engine's own
  // reset() knows about these connection-drop fields, so they're cleared here in one place).
  room.game.paused = false;
  room.game.disconnectedSeats = [];
  room.game.endReason = null;
  room.game.resignedSeat = null;
  room.game.disconnectedAtEnd = [];
  if (isRpg(room) || isGostop(room) || isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isTwenty(room) || isDavinci(room) || isHalli(room) || isPandemic(room)) {
    // v1.6.99: a seat whose player left the room (not a dropped connection that may still come
    // back) is freed, so the next round is not blocked by an empty chair. An explicit 접속 종료
    // only held the seat while that match was in progress.
    for (const [seatId, token] of Object.entries(room.players)) {
      const person = token && room.participants[token];
      if (token && (!person || (!person.connected && (!person.rejoinable || person.rejoinOnlyWhilePlaying)))) room.players[seatId] = null;
    }
    for (const p of Object.values(room.participants)) {
      if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
    }
    return;
  }
  room.players = isTeam(room) ? { '1': null, '2': null, '3': null, '4': null } : { black: null, white: null };
  for (const p of Object.values(room.participants)) p.choice = null;
}

// The game engine, never the client, supplies the final result. An individual match
// (including a three-round liar match) has one stable id across retries and reconnects.
// A2c 정자 할아버지: the person who beat the AI (the engine's winner, never the page's word) -- 1 쉬움 · 2 보통 · 3 어려움
function aiWinProgress(room) {
  const seat = room.game?.winner; if (!seat || seat === room.ai.seat) return;
  const person = room.participants[room.players[seat]]; const account = person && !person.ai ? pointAccountForParticipant(person) : null;
  if (account) islandProgress(`minigame:ai_${room.gameType}`, account, { easy: 1, normal: 2, hard: 3 }[room.ai.level] || 1);
}
async function recordFinishedMatch(room) {
  if (room.ai) { aiWinProgress(room); return false; } // v1.10.72: an AI game is practice -- no record, missions, achievements or ranking
  if (isGostop(room)) await settleGostopBonuses(room);
  const result = buildMatchResult(room, nowIso());
  if (!result) return false;
  // v1.7.20: who played each seat, taken now (the room may change before the awaits below finish).
  const seats = matchSeats(room);
  const accounts = seats.map(seat => pointAccountForParticipant(room.participants[room.players[seat]]));
  const resignedSeat = room.game.resignedSeat ?? null;
  await settleGostopIfNeeded(room, result);
  await settleEntryIfNeeded(room);
  room.recordedMatches ||= new Set();
  let recorded = false;
  if (!room.recordedMatches.has(result.id)) {
    await matchStore.recordMatch(result);
    room.recordedMatches.add(result.id);
    recorded = true;
  }
  await awardMissions(room, result, accounts, seats, resignedSeat); // idempotent per match, so a later call retries a failed award
  return recorded;
}

// v1.7.20 daily missions and the first-win bonus, driven only by the match the server just recorded.
// A game ended by a dropped connection is not a normal finish and counts for nobody; a resignation is
// a normal result but not a clean finish for the seat that resigned (`game.resignedSeat`, server-only). Progress and payouts are written
// per account by the point store (keyed by match id / mission id / day), never by the client.
async function awardMissions(room, result, accounts, seats, resignedSeat) {
  room.missionsAwarded ||= new Set();
  if (room.missionsAwarded.has(result.id)) return;
  if (room.game.endReason === 'disconnect') { room.missionsAwarded.add(result.id); return; }
  const sole = result.outcomes.filter(outcome => outcome.result === 'win').length === 1;
  const finishedAt = nowMs(); // v1.9.5: every participant's daily/weekly mission uses this one time (Monday 00:00 KST edge)
  try {
    for (let i = 0; i < result.outcomes.length; i += 1) {
      const account = accounts[i];
      if (!account) continue;
      if (!rewardsEnabled(account)) continue;
      const outcome = result.outcomes[i];
      const done = await pointStore.recordMissionMatch({
        userId: account, matchId: result.id, gameType: result.gameType, result: outcome.result, soleWinner: sole && outcome.result === 'win',
        clean: seats[i] !== resignedSeat, opponents: accounts.filter((other, j) => j !== i && other),
      }, finishedAt);
      // v1.7.20: achievements read the match record just saved; checked even when the mission part was a repeat.
      const earned = await syncAchievements(outcome.id, account);
      const lines = [...(done.applied ? [...toastLines(done), ...weeklyToastLines(done)] : []), ...achievementToasts(earned.granted)];
      if (lines.length) notifyRoomAccount(room, account, 'missionUpdate', { lines, doneCount: done.view.doneCount, total: done.view.total });
      if (done.rewards.length) notifyPointsChanged([account]);
    }
    room.missionsAwarded.add(result.id);
  } catch (error) {
    console.error('미션 진행 기록 실패:', error);
  }
}

function rewardsEnabled(account) { return process.env.NODE_ENV !== 'test' || rewardTestAccounts.has(account); }

// v1.7.20 achievements: read the account's own match record (recordId), pay every met, not-yet-paid
// achievement once (the point store keys each payout by account + achievement id), and return the view.
// Also catches up achievements earned by matches played before this feature existed.
async function syncAchievements(recordId, account) {
  const items = evaluateAchievements(await matchStore.stats(recordId));
  const met = items.filter(item => item.done);
  const paid = new Set(await pointStore.grantedAchievements(account, met.map(item => item.id)));
  let granted = [];
  const fresh = met.filter(item => !paid.has(item.id));
  if (fresh.length && rewardsEnabled(account)) {
    ({ granted } = await pointStore.grantAchievements(account, fresh.map(item => ({ id: item.id, title: item.title, amount: item.reward }))));
    if (granted.length) notifyPointsChanged([account]);
    for (const item of granted) paid.add(item.id);
  }
  return { view: achievementView(items, [...paid]), granted };
}

function notifyRoomAccount(room, account, event, data) {
  for (const client of [...(streams.get(room.id) || [])]) {
    if (pointAccountForSession(sessions.get(client.sessionToken)) !== account) continue;
    try { sseWrite(client.res, event, data); } catch {}
  }
}

async function recordOrError(room, res) {
  try { await recordFinishedMatch(room); return true; }
  catch (error) {
    console.error('전적 영구 저장 실패:', error);
    sendError(res, 503, 'MATCH_RECORD_FAILED', '전적 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    return false;
  }
}

function recordIdentity(session) { return session.guestKeyId || `admin:${session.publicId}`; }
// v1.7.35: legend skins an account owns show as profile badges next to its records (record id -> point account).
async function recordBadges(recordId) {
  try { return badgesOf((await pointStore.skinState(String(recordId).startsWith('admin:') ? 'admin' : `guest:${recordId}`)).owned); }
  catch { return []; }
}

// Points belong to the durable guest key (kept through rename and reissue), never to a session
// token. The operator's admin logins share one account so a re-login does not reset it.
function pointAccountForSession(session) { return session?.guestKeyId ? `guest:${session.guestKeyId}` : 'admin'; }
function pointAccountForParticipant(participant) {
  if (!participant) return null;
  return participant.guestKeyId ? `guest:${participant.guestKeyId}` : participant.role === 'admin' ? 'admin' : null;
}
function pointAccountForSeat(room, seat) {
  const token = room.players[seat];
  return pointAccountForParticipant(token && room.participants[token]);
}

function setGostopTestFixture(room, fixture) {
  if (process.env.NODE_ENV !== 'test' || !isGostop(room) || !['choose-floor', 'go-stop', 'gukjin', 'first-ppeok', 'go-bak'].includes(fixture)) return false;
  const game = getGame('gostop').create();
  const seats = ['first-ppeok', 'go-bak'].includes(fixture) ? ['1', '2', '3'].filter(seat => room.players[seat]) : ['1', '2'];
  const zeros = () => Object.fromEntries(seats.map(seat => [seat, 0]));
  Object.assign(game, {
    status: 'playing', round: Number(room.game.round || 1), mode: 'matgo', nagariStreak: room.game.nagariStreak || 0,
    // Test hands retain the real participants' signature so normal next-round start carries a draw.
    nagariSignature: seats.map(seat => pointAccountForSeat(room, seat)).sort().join('|'),
    pointsPerScore: room.game.pointsPerScore || 100, seatOrder: seats, firstSeat: '1', turn: '1', phase: 'play',
    deck: ['m05-pi1', 'm05-pi2'], hands: { 1: ['m07-pi1'], 2: ['m08-pi1'] }, floor: ['m06-pi1'],
    floorBonus: {}, captured: { 1: [], 2: [] }, goCount: zeros(), lastGoScore: zeros(), shakes: zeros(),
    bombs: zeros(), bombFlips: zeros(), ppeok: zeros(), ppeokOwner: {}, turnsTaken: zeros(),
    firstPpeok: Object.fromEntries(seats.map(seat => [seat, false])), bonusAwards: [],
    gukjin: Object.fromEntries(seats.map(seat => [seat, null])),
    ctx: null, lastEvent: null, eventSeq: 0, moveCount: 0, winner: null, result: null, endReason: null, settlement: null,
  });
  if (fixture === 'choose-floor') {
    game.phase = 'choose-floor';
    game.floor = ['m03-gwang', 'm03-ribbon', 'm06-pi1'];
    game.ctx = {
      seat: '1', month: 3, played: ['m03-pi1'], held: [], placed: false, wasPair: true, captured: [], steal: 0,
      tags: [], revealed: [], bonusFlipped: [], flipped: null, steps: [{ k: 'play', seat: '1', cards: ['m03-pi1'] }],
      turnId: 1, options: ['m03-gwang', 'm03-ribbon'],
    };
    game.moveCount = 1;
  } else if (fixture === 'go-stop') {
    game.phase = 'go-stop';
    game.captured['1'] = ['m01-gwang', 'm03-gwang', 'm08-gwang', 'm11-gwang', 'm12-gwang'];
  } else if (fixture === 'first-ppeok') {
    game.mode = seats.length === 3 ? 'gostop' : 'matgo';
    game.hands = { 1: ['m05-pi1', 'm06-pi1', 'm05-ribbon', 'm04-pi2'], 2: ['m08-pi1', 'm09-pi1'],
      ...(seats.length === 3 ? { 3: ['m10-pi1', 'm11-pi1'] } : {}) };
    game.floor = ['m05-animal', 'm06-animal', 'm01-gwang'];
    game.deck = ['m05-pi2', 'm02-pi1', ...(seats.length === 3 ? ['m03-pi1'] : []), 'm06-pi2', 'm02-pi2', 'm12-animal'];
    game.captured = { 1: [], 2: ['m04-pi1', 'm07-pi1'], ...(seats.length === 3 ? { 3: ['m10-pi2', 'm11-pi2'] } : {}) };
  } else if (fixture === 'go-bak') {
    game.mode = seats.length === 3 ? 'gostop' : 'matgo';
    game.phase = 'go-stop';
    game.hands = { 1: ['m04-pi1'], 2: ['m03-ribbon', 'm05-pi1'], ...(seats.length === 3 ? { 3: ['m06-pi1'] } : {}) };
    game.floor = ['m03-pi1', 'm08-pi1'];
    game.deck = ['m07-pi1'];
    game.captured = { 1: ['m01-gwang', 'm03-gwang', 'm08-gwang', ...(seats.length === 2 ? ['m11-gwang', 'm12-gwang'] : [])],
      2: seats.length === 2 ? ['m01-ribbon', 'm02-ribbon', 'm04-ribbon', 'm05-ribbon', 'm06-ribbon', 'm07-ribbon', 'm09-ribbon', 'm10-ribbon']
        : ['m01-ribbon', 'm02-ribbon'], ...(seats.length === 3 ? { 3: [] } : {}) };
  } else {
    game.phase = 'gukjin';
    game.captured['1'] = ['m09-animal'];
    game.ctx = { seat: '1' };
  }
  room.game = game;
  return true;
}

// Go-Stop settles once per match (idempotent by settlement id) *before* the match record is saved,
// so a stored result can never exist without its point transfers; a failure leaves the match
// unrecorded and every later record attempt retries the very same settlement.
// Final points move once per hand; first/second 뻑 bonuses use separate idempotent event ids.
// The settlement id is claimed inside the store's transaction,
// concurrent finishes in this process share one in-flight promise, and a failed attempt (e.g. a
// database outage) is retried in the background with the same id until it lands.
const SETTLEMENT_RETRY_MS = [2_000, 5_000, 15_000, 60_000, 300_000];

// First/second consecutive 뻑 pay during the hand, even if the hand later ends in 나가리.
// Each event has its own stable id; concurrent requests share the in-flight write and retries
// replay the same settlement. The per-hand final settlement keeps its separate id.
async function settleGostopBonuses(room) {
  if (room.bonusSettling) return room.bonusSettling;
  const game = room.game;
  if (!game.bonusAwards?.some(award => !award.settled)) return;
  const promise = (async () => {
    for (const award of game.bonusAwards) {
      if (award.settled) continue;
      const receiver = pointAccountForSeat(room, award.seat);
      const others = game.seatOrder.filter(seat => seat !== award.seat)
        .map(seat => ({ seat, id: pointAccountForSeat(room, seat) }));
      if (!validUserId(receiver) || others.some(other => !validUserId(other.id) || other.id === receiver)) {
        throw new Error('뻑 보너스의 포인트 계정이 유효하지 않습니다.');
      }
      const amount = (game.mode === 'matgo' ? 7 : 3) * game.pointsPerScore * award.multiplier * 2 ** game.nagariStreak;
      const outcome = await pointStore.settle({
        settlementId: `gostop:${room.id}:${game.round}:ppeok:${award.seat}:${award.turn}`,
        matchId: `${room.id}:${game.round}`, gameType: 'gostop',
        transfers: others.map(other => ({ from: other.id, to: receiver, amount, key: `${other.seat}>${award.seat}` })),
        summary: { kind: 'bonus', mode: game.mode, reason: award.kind, seat: award.seat, pointsPerScore: game.pointsPerScore },
        burnPercent: SETTLEMENT_BURN_PERCENT,
      });
      award.paid = outcome.transfers.reduce((sum, item) => sum + item.paid, 0);
      award.credited = outcome.transfers.reduce((sum, item) => sum + (item.credited ?? item.paid), 0);
      award.settled = true;
    }
  })();
  room.bonusSettling = promise;
  try { await promise; } finally { if (room.bonusSettling === promise) room.bonusSettling = null; }
}

function settleGostopIfNeeded(room, match = null) {
  if (!isGostop(room)) return Promise.resolve();
  const game = room.game;
  if (!['finished', 'draw'].includes(game.status) || game.settlement?.status === 'done') return Promise.resolve();
  const settlementId = `gostop:${room.id}:${game.round}`;
  if (room.settling?.id === settlementId) return room.settling.promise;
  const promise = applyGostopSettlement(room, match || buildMatchResult(room, nowIso())).then(() => {
    clearTimeout(room.settlementRetry); room.settlementRetry = null; room.settlementAttempts = 0;
  }, (error) => {
    if (game.settlement?.status !== 'done') game.settlement = { status: 'pending', kind: game.result?.kind || null, transfers: [] };
    scheduleSettlementRetry(room, settlementId);
    throw error;
  }).finally(() => { if (room.settling?.promise === promise) room.settling = null; });
  room.settling = { id: settlementId, promise };
  return promise;
}

function scheduleSettlementRetry(room, settlementId) {
  if (room.settlementRetry) return;
  const attempt = room.settlementAttempts || 0;
  room.settlementAttempts = attempt + 1;
  const delay = SETTLEMENT_RETRY_MS[Math.min(attempt, SETTLEMENT_RETRY_MS.length - 1)];
  room.settlementRetry = setTimeout(() => {
    room.settlementRetry = null;
    // A new hand cannot start before this one is recorded (next-round records first), so the round
    // only differs if the room was reset some other way. A closed room still settles its last hand.
    if (!isGostop(room) || `gostop:${room.id}:${room.game.round}` !== settlementId) return;
    recordFinishedMatch(room).then(() => { if (rooms.get(room.id) === room) broadcast(room); })
      .catch(error => console.error('포인트 정산 재시도 실패:', error.message));
  }, delay);
  room.settlementRetry.unref?.();
}

async function applyGostopSettlement(room, match) {
  const game = room.game;
  if (game.status === 'draw' || !game.result) {
    game.settlement = { status: 'done', kind: 'nagari', transfers: [] };
    return;
  }
  const seatOf = {};
  for (const seat of game.seatOrder) seatOf[seat] = pointAccountForSeat(room, seat);
  const plan = game.result.kind === 'forfeit'
    ? game.result.payments.map(item => ({ fromSeat: item.from, toSeat: item.to, amount: item.amount }))
    : game.result.losers.map(item => ({ fromSeat: item.seat, toSeat: game.result.winner, amount: item.amount }));
  const usable = plan.filter(item => validUserId(seatOf[item.fromSeat]) && validUserId(seatOf[item.toSeat]) && seatOf[item.fromSeat] !== seatOf[item.toSeat]);
  const outcome = await pointStore.settle({
    settlementId: `gostop:${room.id}:${game.round}`, matchId: match?.id || `${room.id}:${game.round}`, gameType: 'gostop',
    transfers: usable.map(item => ({ from: seatOf[item.fromSeat], to: seatOf[item.toSeat], amount: item.amount, key: `${item.fromSeat}>${item.toSeat}` })),
    summary: { ...game.result, mode: game.mode }, match, burnPercent: SETTLEMENT_BURN_PERCENT,
  });
  game.settlement = {
    status: 'done', kind: game.result.kind, burnPercent: outcome.burnPercent ?? 0,
    transfers: (outcome.transfers || []).map(item => {
      const [fromSeat, toSeat] = String(item.key || '').split('>');
      return { fromSeat, toSeat, requested: item.requested, paid: item.paid, capped: item.capped,
        credited: item.credited ?? item.paid, burned: item.burned ?? 0 };
    }),
    balancesBefore: Object.fromEntries(game.seatOrder.map(seat => [seat, outcome.balancesBefore?.[seatOf[seat]] ?? null])),
    balances: Object.fromEntries(game.seatOrder.map(seat => [seat, outcome.balances?.[seatOf[seat]] ?? pointStore.cachedBalance(seatOf[seat])])),
  };
}

// ---- v1.7.3 common entry fee ----------------------------------------------------------------
// A general game (pointPolicy 'entry') charges ENTRY_FEE from every seated player at the moment it
// leaves the waiting state, all at once or not at all. The pool is paid to the winners when the
// game is recorded (ENTRY_BURN_PERCENT and any uneven remainder burned), or refunded once if the
// system could not finish the game. Every step has its own store id, so retries, duplicate
// finishes and reconnects can never charge, pay or refund twice.
function entrySnapshot(room) {
  if (room.ai || pointPolicy(room.gameType) !== 'entry' || room.game.status !== 'selecting') return null; // v1.10.72: AI rooms take no entry
  return {
    game: structuredClone(room.game),
    choices: Object.fromEntries(Object.entries(room.participants).map(([token, p]) => [token, p.choice])),
    turnWatch: room.turnWatch ? { ...room.turnWatch } : null,
    nextMessageId: room.social?.nextId ?? 1,
  };
}

// The game did not really start: the waiting state comes back (seats someone just took stay).
function restoreEntrySnapshot(room, snap) {
  room.game = snap.game;
  for (const [token, choice] of Object.entries(snap.choices)) {
    if (room.participants[token] && !findSeat(room, token)) room.participants[token].choice = choice;
  }
  room.turnWatch = snap.turnWatch;
  if (room.social) room.social.messages = room.social.messages.filter(message => message.id < snap.nextMessageId);
}

function entryPlayers(room) {
  return matchSeats(room).filter(seat => room.players[seat]).map(seat => ({
    seat, id: pointAccountForSeat(room, seat), label: room.participants[room.players[seat]]?.label || `${seat}`,
  }));
}

async function chargeRoomEntry(room) {
  const players = entryPlayers(room);
  const ids = [...new Set(players.map(player => player.id))];
  if (!players.length || players.some(player => !validUserId(player.id))) throw new Error('참가자의 포인트 계정이 유효하지 않습니다.');
  const n = (room.pointRound || 0) + 1;
  room.pointRound = n;
  const entryId = `game-entry:${room.id}:${n}`;
  // v1.7.6: an error can arrive after the database already committed (a dropped connection at COMMIT),
  // so the id is remembered: it is never treated as an orphan while this call is in flight, and the
  // caller can settle it (refund) before letting the start be retried.
  inflightEntryIds.add(entryId);
  let outcome;
  try {
    outcome = await pointStore.chargeEntry({ entryId, gameType: room.gameType, matchId: `${room.id}:${room.game.round}`, participants: ids, fee: ENTRY_FEE });
  } catch (error) {
    error.entryId = entryId;
    throw error;
  } finally {
    inflightEntryIds.delete(entryId);
  }
  if (outcome.insufficient) {
    const short = new Set(outcome.insufficient);
    return { ok: false, short: players.filter(player => short.has(player.id)).map(player => player.label) };
  }
  room.entry = { id: entryId, n, round: room.game.round, fee: outcome.fee, pool: outcome.pool, participants: outcome.participants, status: 'charged' };
  appendSystemMessage(room, `참가 포인트 ${outcome.fee.toLocaleString('ko-KR')}P씩 · 총 ${outcome.pool.toLocaleString('ko-KR')}P가 걸렸습니다. 승자가 ${100 - ENTRY_BURN_PERCENT}%를 나눠 받고 ${ENTRY_BURN_PERCENT}%는 소각됩니다.`);
  return { ok: true };
}

const ENTRY_RETRY_MS = [2_000, 5_000, 15_000, 60_000, 300_000];

function settleEntryIfNeeded(room) {
  const entry = room.entry;
  if (!entry || entry.status !== 'charged' || entry.round !== room.game.round || !['finished', 'draw'].includes(room.game.status)) return Promise.resolve();
  if (room.entrySettling) return room.entrySettling;
  const winners = winningSeats(room).map(seat => pointAccountForSeat(room, seat)).filter(validUserId);
  const promise = pointStore.settleEntry({ resultId: `game-result:${room.id}:${entry.n}`, entryId: entry.id, winners }).then((outcome) => {
    clearTimeout(room.entryRetry); room.entryRetry = null; room.entryAttempts = 0;
    if (outcome.kind === 'result') {
      Object.assign(entry, { status: 'settled', each: outcome.each, winnerCount: outcome.winners.length, burned: outcome.burned });
      if (outcome.applied) {
        appendSystemMessage(room, outcome.winners.length
          ? `참가 포인트 정산 · 승자 ${outcome.winners.length}명에게 ${outcome.each.toLocaleString('ko-KR')}P씩 지급 · ${outcome.burned.toLocaleString('ko-KR')}P 소각`
          : `참가 포인트 정산 · 승자가 없어 ${outcome.burned.toLocaleString('ko-KR')}P 소각`);
      }
    } else if (outcome.closed) entry.status = String(outcome.closed).startsWith('game-refund:') ? 'refunded' : 'settled';
  }, (error) => {
    scheduleEntryRetry(room, entry.id);
    throw error;
  }).finally(() => { if (room.entrySettling === promise) room.entrySettling = null; });
  room.entrySettling = promise;
  return promise;
}

function scheduleEntryRetry(room, entryId) {
  if (room.entryRetry) return;
  const attempt = room.entryAttempts || 0;
  room.entryAttempts = attempt + 1;
  room.entryRetry = setTimeout(() => {
    room.entryRetry = null;
    if (room.entry?.id !== entryId) return;
    settleEntryIfNeeded(room).then(() => { if (rooms.get(room.id) === room) broadcast(room); })
      .catch(error => console.error('참가 포인트 정산 재시도 실패:', error.message));
  }, ENTRY_RETRY_MS[Math.min(attempt, ENTRY_RETRY_MS.length - 1)]);
  room.entryRetry.unref?.();
}

// The system could not finish this game (the room expired mid-game): every entry fee goes back.
// A failed refund is retried in the background (same ids, so it can only ever apply once).
async function refundRoomEntry(room, reason) {
  const entry = room.entry;
  if (!entry || entry.status !== 'charged') return;
  let outcome;
  try {
    outcome = await pointStore.refundEntry({ refundId: `game-refund:${room.id}:${entry.n}`, entryId: entry.id, reason });
  } catch (error) {
    scheduleRefundRetry(room, entry.id, reason);
    throw error;
  }
  clearTimeout(room.refundRetry); room.refundRetry = null;
  if (outcome.kind === 'refund' || outcome.closed?.startsWith?.('game-refund:')) entry.status = 'refunded';
  else if (outcome.closed) entry.status = 'settled';
  if (outcome.applied) notifyPointsChanged(outcome.participants || entry.participants || []);
}

function scheduleRefundRetry(room, entryId, reason) {
  if (room.refundRetry) return;
  const attempt = room.refundAttempts || 0;
  room.refundAttempts = attempt + 1;
  room.refundRetry = setTimeout(() => {
    room.refundRetry = null;
    if (room.entry?.id !== entryId) return;
    refundRoomEntry(room, reason).catch(error => console.error('참가 포인트 환불 재시도 실패:', error.message));
  }, ENTRY_RETRY_MS[Math.min(attempt, ENTRY_RETRY_MS.length - 1)]);
  room.refundRetry.unref?.();
}

// Entries a live process is still responsible for: the current entry of every room, entries of expired
// rooms whose payout/refund is still being retried, and charges that have not returned yet.
const inflightEntryIds = new Set();
const expiredEntries = new Set();
function liveEntryIds() {
  const ids = new Set(inflightEntryIds);
  for (const room of rooms.values()) if (room.entry?.status === 'charged') ids.add(room.entry.id);
  for (const entry of [...expiredEntries]) {
    if (entry.status === 'charged') ids.add(entry.id);
    else expiredEntries.delete(entry);
  }
  return ids;
}

// Refunds every open entry that no live room owns: games a restart cut off, and a charge whose
// database commit succeeded although the request failed. The ids are shared with the normal refund,
// so a second run (or a late retry) finds it closed and does nothing.
async function refundOrphanEntries(reason = 'server-restart') {
  let refunded = 0;
  for (const entryId of await pointStore.openEntries()) {
    if (liveEntryIds().has(entryId)) continue;
    const outcome = await pointStore.refundEntry({ refundId: entryId.replace(/^game-entry:/, 'game-refund:'), entryId, reason });
    if (outcome.applied) { refunded += 1; notifyPointsChanged(outcome.participants || []); }
  }
  return refunded;
}

// A failed start: settle the (possibly committed) charge right away, best effort. Anything this misses
// is caught by the periodic orphan sweep.
async function reclaimFailedEntry(entryId) {
  if (!entryId) return;
  try {
    const outcome = await pointStore.refundEntry({ refundId: entryId.replace(/^game-entry:/, 'game-refund:'), entryId, reason: 'charge-error' });
    if (outcome.applied) notifyPointsChanged(outcome.participants || []);
  } catch (error) { console.error('참가 포인트 오류 복구 지연(정기 정리에서 처리):', error.message); }
}

// Tell the affected online players their balance changed (lobby SSE event / room broadcast); the
// client re-reads /api/points only on this event, never on every update.
function notifyPointsChanged(userIds) {
  const wanted = new Set(userIds.filter(validUserId));
  if (!wanted.size) return;
  for (const entry of [...lobbyStreams]) {
    const session = sessions.get(entry.sessionToken);
    if (!session || !wanted.has(pointAccountForSession(session))) continue;
    try { sseWrite(entry.res, 'pointsChanged', {}); } catch { lobbyStreams.delete(entry); }
  }
  const roomIds = new Set();
  for (const session of sessions.values()) if (session.currentRoomId && wanted.has(pointAccountForSession(session))) roomIds.add(session.currentRoomId);
  for (const id of roomIds) { const room = rooms.get(id); if (room) broadcast(room); }
}

// v1.7.3: a finished game still pays out; one that never finished is refunded. v1.7.6: the entry stays
// owned by this process (not an orphan) until that succeeds, and both paths retry in the background.
function expireRoom(room) {
  rooms.delete(room.id);
  if (room.entry?.status !== 'charged') return Promise.resolve();
  expiredEntries.add(room.entry);
  return (['finished', 'draw'].includes(room.game.status) ? settleEntryIfNeeded(room) : refundRoomEntry(room, 'room-expired'))
    .catch(error => console.error('참가 포인트 정리 실패:', error.message));
}

async function recordPlayers() {
  const keys = await accessStore.list();
  return [...[...sessions.values()].filter(session => session.role === 'admin').map(session => ({ id: recordIdentity(session), label: session.label })), ...keys.map(key => ({ id: key.id, label: key.label }))];
}

function getCurrentRoom(session) {
  if (!session.currentRoomId) return null;
  const room = rooms.get(session.currentRoomId) || null;
  if (!room) session.currentRoomId = null;
  return room;
}

function findRoomByCode(code) {
  const normalized = normalizeRoomCode(code);
  if (!normalized) return null;
  return [...rooms.values()].find((r) => r.code === normalized) || null;
}

function invalidateGuestSessions(guestKeyId, message = '이 입장 파일의 권한이 취소되었습니다.') {
  for (const [token, session] of [...sessions]) {
    if (session.guestKeyId !== guestKeyId) continue;
    releaseSessionToken(token, { message });
  }
  activeGuestSessions.delete(guestKeyId);
  for (const [ticket, row] of setupTickets) if (row.keyId === guestKeyId) setupTickets.delete(ticket); // v1.10.63: a setup begun with the old file ends too (Codex)
}

function guestPresence(guestKeyId) {
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
  const role = seat ? (isRpg(room) || isGostop(room) || isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isTwenty(room) || isDavinci(room) || isHalli(room) || isPandemic(room) ? `${seat}번`
    : isTeam(room) ? `${teamColor(seat) === 'black' ? '흑' : '백'}팀 ${seat}번`
    : room.gameType === 'baseball' ? (seat === 'black' ? '선공' : '후공')
      : room.gameType === 'connect4' ? (seat === 'black' ? '빨강' : '노랑')
        : ['yut', 'dots'].includes(room.gameType) ? (seat === 'black' ? '파랑' : '빨강')
          : (seat === 'black' ? '흑' : '백')) : '관전자';
  const game = getGame(room.gameType)?.name || '게임';
  const otherSeat = seat === 'black' ? 'white' : 'black';
  const opponentToken = seat ? room.players[otherSeat] : null;
  const opponent = (isRpg(room) || isGostop(room) || isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isTwenty(room) || isDavinci(room) || isHalli(room) || isPandemic(room)) && seat
    ? seatsFor(room).filter(s => s !== seat).map(s => room.participants[room.players[s]]?.label).filter(Boolean).join(', ') || null
    : isTeam(room) && seat
      ? TEAM_SEATS.filter(s => teamColor(s) !== teamColor(seat))
        .map(s => room.participants[room.players[s]]?.label).filter(Boolean).join(', ') || null
      : opponentToken ? (room.participants[opponentToken]?.label || null) : null;
  let status = 'room-waiting';
  if (room.game.status === 'playing') status = room.game.paused ? (seat ? 'paused' : 'spectating') : (seat ? 'playing' : 'spectating');
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

// Server-authoritative round/reveal timers so pictionary always advances even if the drawer disconnects.
async function tickPictionaryRooms() {
  const now = nowMs();
  const engine = getGame('pictionary');
  for (const room of rooms.values()) {
    if (!isPictionary(room) || room.game.status !== 'playing') continue;
    let changed = engine.updateHints(room.game, now);
    if (room.game.phase === 'drawing' && room.game.roundEndsAt && now >= room.game.roundEndsAt) {
      engine.endRound(room.game);
      changed = true;
    } else if (room.game.phase === 'reveal' && room.game.revealEndsAt && now >= room.game.revealEndsAt) {
      const verdict = engine.advance(room.game);
      if (verdict.legal && !verdict.finished) {
        appendSystemMessage(room, `${room.participants[room.players[room.game.drawerSeat]]?.label || '다음 출제자'}님 차례입니다.`);
      }
      changed = true;
    }
    if (changed) {
      if (['finished', 'draw'].includes(room.game.status)) {
        try { await recordFinishedMatch(room); }
        catch (error) { console.error('그림 맞히기 전적 저장 실패:', error); continue; }
      }
      touchRoom(room); broadcast(room);
    }
  }
}


// Server-authoritative phase timers for liar game. Deadlines are stored on the game,
// so reload/reconnect never resets hint, vote, reveal or final-guess time limits.
async function tickLiarRooms() {
  const now = nowMs();
  const engine = getGame('liar');
  for (const room of rooms.values()) {
    if (!isLiar(room) || room.game.status !== 'playing') continue;
    if (!engine.tick(room.game, now)) continue;
    if (['finished', 'draw'].includes(room.game.status)) {
      try { await recordFinishedMatch(room); }
      catch (error) { console.error('라이어게임 전적 저장 실패:', error); continue; }
    }
    touchRoom(room);
    broadcast(room);
  }
}

async function tickDavinciRooms() {
  const now = nowMs();
  const engine = getGame('davinci');
  for (const room of rooms.values()) {
    if (!isDavinci(room)) continue;
    const feedbackExpired = engine.expireFeedback(room.game, now);
    if (room.game.status !== 'playing') {
      if (!feedbackExpired) continue;
      touchRoom(room);
      broadcast(room);
      continue;
    }
    syncGamePause(room, false);
    const seat = room.game.turn;
    const token = room.players[seat];
    const connected = Boolean(room.participants[token]?.connected && sessions.get(token)?.currentRoomId === room.id);
    if (!connected && room.davinciDisconnectedTurn !== seat) {
      room.davinciDisconnectedTurn = seat;
      room.game.deadlineAt = now + 60_000;
    } else if (connected) room.davinciDisconnectedTurn = null;
    const timedOut = engine.tick(room.game, now);
    if (!feedbackExpired && !timedOut) continue;
    room.davinciDisconnectedTurn = null;
    if (timedOut && room.game.status === 'finished') await recordFinishedMatch(room);
    touchRoom(room);
    broadcast(room);
  }
}

async function tickHalliRooms() {
  const now = nowMs();
  const engine = getGame('halligalli');
  for (const room of rooms.values()) {
    if (!isHalli(room) || room.game.status !== 'playing') continue;
    let changed = false;
    for (const seat of room.game.seatOrder) {
      const token = room.players[seat];
      const connected = Boolean(room.participants[token]?.connected && sessions.get(token)?.currentRoomId === room.id);
      const wasDisconnected = Boolean(room.game.disconnectSince[seat]);
      if (connected) engine.reconnect(room.game, seat);
      else engine.disconnect(room.game, seat, now);
      if (Boolean(room.game.disconnectSince[seat]) !== wasDisconnected) changed = true;
    }
    syncGamePause(room, false);
    if (!engine.tick(room.game, now) && !changed) continue;
    if (room.game.status === 'finished') await recordFinishedMatch(room);
    touchRoom(room); broadcast(room);
  }
}

// 잿빛 원정: 20 Hz server simulation. Positions go out as a compact `rpgTick` event on the room's
// existing SSE stream (one serialisation shared by every viewer); the ordinary roomState is only
// re-sent when builds, choices or the phase change (metaVersion).
function tickRpgRooms() {
  const engine = getGame('rpg');
  for (const room of rooms.values()) {
    if (!isRpg(room)) continue;
    // A press handled by the fast input path can end the run (e.g. the boss dies to an instant
    // skill); that change is published here even though the run is no longer ticking.
    if (room.game.status !== 'playing') {
      if (room.rpgBroadcastVersion !== room.game.metaVersion) { room.rpgBroadcastVersion = room.game.metaVersion; touchRoom(room); broadcast(room); }
      continue;
    }
    let anyConnected = false;
    for (const seat of room.game.seatOrder) {
      const token = room.players[seat];
      const connected = Boolean(token && room.participants[token]?.connected && sessions.get(token)?.currentRoomId === room.id);
      if (connected) anyConnected = true; else engine.releaseInput(room.game, seat);
    }
    if (!anyConnected) continue; // nobody at the table: the run waits for them
    engine.tick(room.game);
    if (room.rpgBroadcastVersion !== room.game.metaVersion) { room.rpgBroadcastVersion = room.game.metaVersion; touchRoom(room); broadcast(room); }
    const set = streams.get(room.id);
    if (!set) continue;
    const payload = `event: rpgTick\ndata: ${JSON.stringify(engine.snapshot(room.game))}\n\n`;
    // v1.7.22: a client whose socket buffer is already full is skipped this tick (the next tick is a fresh full
    // snapshot), so a stalled connection cannot make the server queue 20 writes a second.
    for (const client of set) writeUnlessBacklogged(client.res, payload);
  }
}

async function handleRoomAction(req, res, action, session) {
  const room = getCurrentRoom(session);
  if (!room) return sendError(res, 404, 'NO_ROOM', '먼저 방을 만들거나 방 비밀번호를 입력해 주세요.');
  const body = await parseJson(req);
  const participant = room.participants[session.token] || registerParticipant(room, session);
  if (action.startsWith('rpg-')) {
    if (!isRpg(room)) return sendError(res, 400, 'WRONG_GAME', '잿빛 원정 방에서만 사용할 수 있습니다.');
    const engine = getGame('rpg');
    const playerSeat = findSeat(room, session.token);
    if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 조작할 수 없습니다.');
    // Held keys and presses: applied on the next simulation tick; no room broadcast per keystroke.
    if (action === 'rpg-input' || action === 'rpg-act') {
      if (!checkRateLimit(`rpg:${session.token}`, 60, 1000)) return sendError(res, 429, 'RPG_RATE_LIMIT', '입력이 너무 빠릅니다.');
      const verdict = action === 'rpg-input'
        ? engine.input(room.game, playerSeat, { mv: Number(body.mv) || 0, atk: body.atk === true })
        : engine.act(room.game, playerSeat, String(body.a || ''));
      return sendJson(res, 200, { ok: verdict.legal, ...(verdict.legal ? {} : { reason: verdict.reason }) });
    }
    let verdict;
    if (action === 'rpg-class') verdict = engine.setClass(room.game, playerSeat, String(body.cls || ''));
    else if (action === 'rpg-start') {
      if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 원정을 시작할 수 있습니다.');
      verdict = engine.start(room.game, seatsFor(room).filter(seat => room.players[seat]));
      if (verdict.legal) {
        for (const person of Object.values(room.participants)) if (!findSeat(room, person.sessionToken)) person.choice = 'spectator';
        appendSystemMessage(room, `잿빛 원정 시작 · ${room.game.seatOrder.length}명`);
      }
    } else if (action === 'rpg-pick') verdict = engine.chooseLevelUp(room.game, playerSeat, Number(body.index));
    else if (action === 'rpg-stat') verdict = engine.allocateStat(room.game, playerSeat, String(body.stat || ''));
    else if (action === 'rpg-item') verdict = engine.chooseItem(room.game, playerSeat, body.index === 'skip' ? 'skip' : Number(body.index));
    else if (action === 'rpg-ready') verdict = engine.setReady(room.game, playerSeat, body.ready !== false);
    else return sendError(res, 400, 'BAD_RPG_ACTION', '알 수 없는 원정 행동입니다.');
    if (!verdict.legal) return sendError(res, 409, 'INVALID_RPG_ACTION', engine.moveError(verdict.reason));
    room.rpgBroadcastVersion = room.game.metaVersion;
    touchRoom(room);
    broadcast(room);
    return sendJson(res, 200, { ok: true, state: roomView(room, session) });
  }
  // v1.7.3: while a game's entry fee is being charged, other actions on the room wait for it.
  while (room.entryPending) await room.entryPending.catch(() => {});
  const entryBefore = entrySnapshot(room);
  if ((action === 'next-round' || action === 'rematch') && !(await recordOrError(room, res))) return;
  // Only draw-oldmaid ever sets this: the drawn card's identity, for the drawer's own animation --
  // never broadcast (see roomView/broadcast below), so opponents and spectators never see it.
  let drawnOldMaidCard = null;
  let pictionaryClose = false;

  // Twenty Questions integrated: host-only setup, private drawer secret and server-owned adjudication.
  if (action.startsWith('twenty-')) {
    if (!isTwenty(room)) return sendError(res, 400, 'WRONG_GAME', '스무고개 방에서만 사용할 수 있습니다.');
    const engine = getGame('twentyquestions');
    if (['twenty-start', 'twenty-next'].includes(action) && !isRoomHost(room, session)) {
      return sendError(res, 403, 'HOST_ONLY', '방장만 게임 시작과 다음 라운드를 진행할 수 있습니다.');
    }
    if (action === 'twenty-start') {
      const occupied = seatsFor(room).filter(n => room.players[n]);
      if (occupied.length < 2 || occupied.length > 8) return sendError(res, 409, 'INVALID_TWENTY_START', '2~8명이 자리를 선택해야 합니다.');
      const configured = engine.configure(room.game, body.mode, Number(body.totalRounds));
      if (!configured.legal) return sendError(res, 409, 'INVALID_TWENTY_CONFIG', engine.moveError(configured.reason));
      const verdict = engine.beginRound(room.game, occupied);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_TWENTY_START', engine.moveError(verdict.reason));
      for (const person of Object.values(room.participants)) if (!findSeat(room, person.sessionToken)) person.choice = 'spectator';
      appendSystemMessage(room, `스무고개 시작! ${room.game.totalRounds}판 · ${room.game.mode === 'cooperative' ? '협동전' : '개인전'} · 카테고리: ${room.game.category}`);
    } else if (action === 'twenty-next') {
      if (room.game.status !== 'round-ended') return sendError(res, 409, 'INVALID_TWENTY_NEXT', '라운드 결과가 나온 뒤 다음 라운드를 시작할 수 있습니다.');
      const verdict = engine.nextRound(room.game);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_TWENTY_NEXT', engine.moveError(verdict.reason));
      appendSystemMessage(room, `스무고개 ${room.game.roundNumber}/${room.game.totalRounds}라운드 시작 · 카테고리: ${room.game.category}`);
    } else {
      const playerSeat = findSeat(room, session.token);
      if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 질문·출제·판정을 할 수 없습니다.');
      const twentyPauseResult = syncGamePause(room);
      if (twentyPauseResult?.gameFinished) {
        recordFinishedMatch(room).catch(error => console.error('스무고개 시간초과 전적 저장 실패:', error));
      }
      if (twentyPauseResult?.stateChanged) {
        touchRoom(room);
        broadcast(room);
      }
      if (room.game.paused) return sendError(res, 409, 'GAME_PAUSED', '응답이 없는 참가자가 있어 일시정지 중입니다.');
      let verdict;
      if (action === 'twenty-secret') {
        verdict = engine.setSecret(room.game, playerSeat, body.secret);
        if (verdict.legal) appendSystemMessage(room, `${session.label || '출제자'}님이 정답을 설정했습니다. 첫 질문을 시작하세요.`);
      } else if (action === 'twenty-question') {
        verdict = engine.submitQuestion(room.game, playerSeat, body.question);
        if (verdict.legal) appendSystemMessage(room, `${session.label || '도전자'}님이 질문을 제출했습니다.`);
      } else if (action === 'twenty-answer') {
        verdict = engine.answerQuestion(room.game, playerSeat, body.reply);
        if (verdict.legal) appendSystemMessage(room, `출제자가 ${body.reply}(으)로 답했습니다.`);
      } else if (action === 'twenty-guess') {
        verdict = engine.submitGuess(room.game, playerSeat, body.guess);
        if (verdict.legal) appendSystemMessage(room, `${session.label || '도전자'}님이 정답을 제출했습니다. 출제자의 판정을 기다립니다.`);
      } else if (action === 'twenty-judge') {
        verdict = engine.judgeGuess(room.game, playerSeat, body.correct);
        if (verdict.legal) {
          appendSystemMessage(room, body.correct ? '정답입니다! 이번 라운드가 종료됐습니다.' : '오답입니다. 다음 도전자 차례입니다.');
          if (verdict.finished) appendSystemMessage(room, `스무고개 종료! 공동 승자를 포함한 최종 점수가 확정됐습니다.`);
        }
      } else return sendError(res, 400, 'BAD_TWENTY_ACTION', '알 수 없는 스무고개 행동입니다.');
      if (!verdict.legal) return sendError(res, 409, 'INVALID_TWENTY_ACTION', engine.moveError(verdict.reason));
    }
  }

  if (action.startsWith('gostop-') || action === 'set-gostop-stake' || action === 'start-gostop') {
    if (!isGostop(room)) return sendError(res, 400, 'WRONG_GAME', '고스톱·맞고 방에서만 사용할 수 있습니다.');
    const engine = getGame('gostop');
    const playerSeat = findSeat(room, session.token);
    let verdict;
    if (action === 'set-gostop-stake') {
      if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 점당 포인트를 바꿀 수 있습니다.');
      verdict = engine.setStake(room.game, body.pointsPerScore);
    } else if (action === 'start-gostop') {
      if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 시작할 수 있습니다.');
      const seats = seatsFor(room).filter(seatNumber => room.players[seatNumber]);
      if (seats.length < 2 || seats.length > 3) return sendError(res, 409, 'INVALID_GOSTOP_START', engine.moveError('player-count'));
      const accounts = seats.map(seatNumber => pointAccountForSeat(room, seatNumber));
      if (accounts.some(id => !validUserId(id)) || new Set(accounts).size !== accounts.length) {
        return sendError(res, 409, 'SAME_POINT_ACCOUNT', '같은 포인트 계정으로 두 자리에 앉을 수 없습니다.');
      }
      for (const [index, id] of accounts.entries()) {
        const { balance } = await pointStore.ensureAccount(id);
        if (balance <= 0) {
          const label = room.participants[room.players[seats[index]]]?.label || `${seats[index]}번`;
          return sendError(res, 409, 'NO_POINTS', `${label}님의 보유 포인트가 0P라 포인트 대전을 시작할 수 없습니다. 출석체크 후 다시 시도해 주세요.`);
        }
      }
      verdict = engine.start(room.game, seats, { signature: [...accounts].sort().join('|') });
      if (verdict.legal) {
        for (const p of Object.values(room.participants)) if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
        appendSystemMessage(room, `${room.game.mode === 'matgo' ? '맞고' : '고스톱'} 시작 · 점당 ${room.game.pointsPerScore}P${room.game.nagariStreak ? ` · 나가리 ×${2 ** room.game.nagariStreak}` : ''}`);
      }
    } else {
      if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 행동할 수 없습니다.');
      try { await settleGostopBonuses(room); }
      catch (error) { console.error('뻑 보너스 재시도 실패:', error); return sendError(res, 503, 'BONUS_SETTLEMENT_FAILED', '포인트 처리 중입니다. 잠시 후 다시 시도해 주세요.'); }
      syncGamePause(room);
      if (room.game.paused) return sendError(res, 409, 'GAME_PAUSED', '응답이 없는 참가자가 있어 일시정지 중입니다.');
      if (action === 'gostop-play') verdict = engine.play(room.game, playerSeat, String(body.cardId || ''), { shake: body.shake === true, bomb: body.bomb === true, kong: body.kong === true });
      else if (action === 'gostop-choose') verdict = room.game.phase === 'choose-flip' ? engine.chooseFlip(room.game, playerSeat, String(body.cardId || '')) : engine.chooseFloor(room.game, playerSeat, String(body.cardId || ''));
      else if (action === 'gostop-flip') verdict = engine.flipOnly(room.game, playerSeat);
      else if (action === 'gostop-gukjin') verdict = engine.chooseGukjin(room.game, playerSeat, body.asPi === true);
      else if (action === 'gostop-decide') verdict = engine.decide(room.game, playerSeat, String(body.choice || ''));
      else return sendError(res, 400, 'BAD_GOSTOP_ACTION', '알 수 없는 고스톱 행동입니다.');
    }
    if (!verdict.legal) return sendError(res, 409, 'INVALID_GOSTOP_ACTION', engine.moveError(verdict.reason));
    try { await settleGostopBonuses(room); }
    catch (error) {
      console.error('뻑 보너스 정산 실패:', error);
      touchRoom(room); broadcast(room);
      return sendError(res, 503, 'BONUS_SETTLEMENT_FAILED', '포인트 처리 중입니다. 잠시 후 다시 시도해 주세요.');
    }
  }

  if (action === 'choose-role') {
    if (room.game.status !== 'selecting') return sendError(res, 409, 'ROUND_STARTED', '대국이 시작된 뒤에는 역할을 바꿀 수 없습니다.');
    const valid = isNumberedSeatGame(room) ? [...seatsFor(room), 'spectator'] : ['black', 'white', 'spectator'];
    const choice = valid.includes(body.choice) ? body.choice : null;
    if (!choice) return sendError(res, 400, 'BAD_ROLE', isNumberedSeatGame(room) ? `1~${seatsFor(room).length}번 자리 또는 관전을 선택해 주세요.` : '흑, 백, 관전 중에서 선택해 주세요.');
    if (isGostop(room) && choice !== 'spectator') await pointStore.ensureAccount(pointAccountForSession(session));
    // Account creation yields to other requests. Recheck the room after it completes so a
    // competing seat choice (or a started hand) cannot be overwritten by this request.
    if (room.game.status !== 'selecting') return sendError(res, 409, 'ROUND_STARTED', '대국이 시작된 뒤에는 역할을 바꿀 수 없습니다.');
    // v1.10.72 AI 방: one person plays, on either side; the AI moves across (a second person may only watch)
    const aiRoomSeat = Boolean(room.ai && choice !== 'spectator');
    if (aiRoomSeat && Object.values(room.players).some((token) => token && token !== room.ai.token && token !== session.token)) {
      return sendError(res, 409, 'ROLE_TAKEN', 'AI 방에서는 한 사람만 둡니다.');
    }
    if (!aiRoomSeat && choice !== 'spectator' && room.players[choice] && room.players[choice] !== session.token) {
      return sendError(res, 409, 'ROLE_TAKEN', isNumberedSeatGame(room) ? `${choice}번 자리는 이미 선택됐습니다.` : `${choice === 'black' ? '흑' : '백'}은 다른 사람이 이미 선택했습니다.`);
    }
    const oldSeat = findSeat(room, session.token);
    if (oldSeat && oldSeat !== choice) room.players[oldSeat] = null;
    if (choice === 'spectator') participant.choice = 'spectator';
    else {
      if (aiRoomSeat) { const other = choice === 'black' ? 'white' : 'black'; room.players[other] = room.ai.token; room.ai.seat = other; room.participants[room.ai.token].choice = other; }
      room.players[choice] = session.token;
      participant.choice = choice;
    }
    maybeStart(room);
  }



  if (action === 'set-liar-rounds') {
    if (!isLiar(room)) return sendError(res, 400, 'WRONG_GAME', '라이어게임 방에서만 설정할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 판 수를 변경할 수 있습니다.');
    const engine = getGame('liar');
    const verdict = engine.setRounds(room.game, Number(body.totalRounds));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_LIAR_SETTING', engine.moveError(verdict.reason));
  }

  if (action === 'start-liar') {
    if (!isLiar(room)) return sendError(res, 400, 'WRONG_GAME', '라이어게임 방에서만 시작할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 라이어게임을 시작할 수 있습니다.');
    const seats = seatsFor(room).filter(seatNumber => room.players[seatNumber]);
    const engine = getGame('liar');
    const verdict = engine.start(room.game, seats, nowMs());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_LIAR_START', engine.moveError(verdict.reason));
    for (const p of Object.values(room.participants)) if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
    appendSystemMessage(room, `라이어게임 시작! ${room.game.totalRounds}판 모드 · 첫 힌트 발언을 시작합니다.`);
  }

  if (action === 'liar-hint') {
    if (!isLiar(room)) return sendError(res, 400, 'WRONG_GAME', '라이어게임 방에서만 힌트를 제출할 수 있습니다.');
    const playerSeat = findSeat(room, session.token);
    if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 힌트를 제출할 수 없습니다.');
    const engine = getGame('liar');
    const verdict = engine.submitHint(room.game, playerSeat, body.hint, Number(body.expectedPhaseId), nowMs());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_LIAR_HINT', engine.moveError(verdict.reason));
  }

  if (action === 'liar-vote') {
    if (!isLiar(room)) return sendError(res, 400, 'WRONG_GAME', '라이어게임 방에서만 투표할 수 있습니다.');
    const playerSeat = findSeat(room, session.token);
    if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 투표할 수 없습니다.');
    const engine = getGame('liar');
    const verdict = engine.submitVote(room.game, playerSeat, body.target, Number(body.expectedPhaseId), nowMs());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_LIAR_VOTE', engine.moveError(verdict.reason));
  }

  if (action === 'liar-guess') {
    if (!isLiar(room)) return sendError(res, 400, 'WRONG_GAME', '라이어게임 방에서만 최종 추측을 제출할 수 있습니다.');
    const playerSeat = findSeat(room, session.token);
    if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 제시어를 추측할 수 없습니다.');
    const engine = getGame('liar');
    const verdict = engine.submitGuess(room.game, playerSeat, body.guess, Number(body.expectedPhaseId), nowMs());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_LIAR_GUESS', engine.moveError(verdict.reason));
  }

  if (['set-halligalli-time', 'start-halligalli', 'flip-halligalli', 'ring-halligalli'].includes(action)) {
    if (!isHalli(room)) return sendError(res, 400, 'WRONG_GAME', '할리갈리 방에서만 사용할 수 있습니다.');
    const engine = getGame('halligalli');
    const playerSeat = findSeat(room, session.token);
    if (action !== 'start-halligalli' && action !== 'set-halligalli-time' && !playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 행동할 수 없습니다.');
    let verdict;
    if (action === 'start-halligalli' || action === 'set-halligalli-time') {
      if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 설정하거나 시작할 수 있습니다.');
      if (action === 'set-halligalli-time') verdict = engine.setTime(room.game, Number(body.minutes));
      else {
        verdict = engine.start(room.game, seatsFor(room).filter(seat => room.players[seat]), nowMs());
        if (verdict.legal) {
          for (const person of Object.values(room.participants)) if (!findSeat(room, person.sessionToken)) person.choice = 'spectator';
          appendSystemMessage(room, `할리갈리 시작! 제한 시간 ${room.game.durationMinutes}분입니다.`);
        }
      }
    } else if (action === 'flip-halligalli') verdict = engine.flip(room.game, playerSeat, nowMs(), Number(body.expectedRevision));
    else {
      if (!checkRateLimit(`halli-bell:${session.token}`, 20, 10_000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '종을 너무 자주 눌렀습니다.');
      verdict = engine.ring(room.game, playerSeat, Number(body.expectedFlipId), nowMs());
    }
    if (!verdict.legal) return sendError(res, 409, 'INVALID_HALLIGALLI_ACTION', engine.moveError(verdict.reason));
  }

  // v1.8.0 팬데믹: 2~4인 협력. The engine holds every rule; this only checks who may call it. Hands and roles are public,
  // the order of the two card decks never leaves the server (publicState gives counts), a Forecast shows its cards only to its player.
  if (action === 'set-pandemic' || action === 'start-pandemic' || action === 'pandemic-act') {
    if (!isPandemic(room)) return sendError(res, 400, 'WRONG_GAME', '팬데믹 방에서만 사용할 수 있습니다.');
    const engine = getGame('pandemic');
    const playerSeat = findSeat(room, session.token);
    let verdict;
    if (action === 'set-pandemic' || action === 'start-pandemic') {
      if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 설정하고 시작할 수 있습니다.');
      if (action === 'set-pandemic') verdict = engine.setSetup(room.game, { difficulty: String(body.difficulty || '') });
      else {
        if (room.game.status !== 'selecting') return sendError(res, 409, 'INVALID_PANDEMIC_ACTION', engine.moveError('started'));
        verdict = engine.start(room.game, seatsFor(room).filter(seat => room.players[seat]));
        if (verdict.legal) {
          for (const person of Object.values(room.participants)) if (!findSeat(room, person.sessionToken)) person.choice = 'spectator';
          appendSystemMessage(room, '팬데믹이 시작됐습니다. 모두 함께 네 가지 질병의 치료제를 개발하세요.');
        }
      }
    } else {
      if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 행동할 수 없습니다.');
      const act = body.action && typeof body.action === 'object' ? body.action : null;
      if (!act || typeof act.type !== 'string' || JSON.stringify(act).length > 2000) return sendError(res, 400, 'BAD_PANDEMIC_ACTION', engine.moveError('action'));
      if (Number.isInteger(body.expectedRevision) && body.expectedRevision !== room.game.revision) return sendError(res, 409, 'STALE_PANDEMIC_STATE', '화면이 갱신됐습니다. 다시 시도해 주세요.');
      verdict = engine.act(room.game, playerSeat, act);
    }
    if (!verdict.legal) return sendError(res, 409, 'INVALID_PANDEMIC_ACTION', engine.moveError(verdict.reason));
  }

  if (action === 'start-davinci' || action === 'select-davinci' || action === 'guess-davinci' || action === 'stop-davinci' || action === 'reveal-davinci') {
    if (!isDavinci(room)) return sendError(res, 400, 'WRONG_GAME', '다빈치 코드 방에서만 사용할 수 있습니다.');
    const engine = getGame('davinci');
    const playerSeat = findSeat(room, session.token);
    if (action !== 'start-davinci' && !playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 행동할 수 없습니다.');
    let verdict;
    if (action === 'start-davinci') {
      if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 시작할 수 있습니다.');
      verdict = engine.start(room.game, seatsFor(room).filter(seat => room.players[seat]), nowMs());
      if (verdict.legal) {
        for (const person of Object.values(room.participants)) if (!findSeat(room, person.sessionToken)) person.choice = 'spectator';
        appendSystemMessage(room, '다빈치 코드가 시작됐습니다. 타일의 색을 보고 숨겨진 숫자를 추리하세요.');
      }
    } else if (action === 'select-davinci') verdict = engine.select(room.game, playerSeat, String(body.targetSeat), String(body.tileId), Number(body.expectedRevision));
    else if (action === 'guess-davinci') verdict = engine.guess(room.game, playerSeat, String(body.targetSeat), String(body.tileId), Number(body.number), Number(body.expectedRevision), nowMs());
    else if (action === 'stop-davinci') verdict = engine.stop(room.game, playerSeat, Number(body.expectedRevision), nowMs());
    else verdict = engine.reveal(room.game, playerSeat, String(body.tileId), Number(body.expectedRevision), nowMs());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_DAVINCI_ACTION', engine.moveError(verdict.reason));
  }

  if (action === 'set-oldmaid-mode') {
    if (!isOldMaid(room)) return sendError(res, 400, 'WRONG_GAME', '도둑잡기 방에서만 설정할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 모드를 변경할 수 있습니다.');
    const engine = getGame('oldmaid');
    const verdict = engine.setMode(room.game, body.mode);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_MODE', engine.moveError(verdict.reason));
  }

  if (action === 'start-oldmaid') {
    if (!isOldMaid(room)) return sendError(res, 400, 'WRONG_GAME', '도둑잡기 방에서만 시작할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 도둑잡기를 시작할 수 있습니다.');
    const players = seatsFor(room).filter(n => room.players[n]);
    const engine = getGame('oldmaid');
    const verdict = engine.start(room.game, players);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_START', engine.moveError(verdict.reason));
    for (const person of Object.values(room.participants)) if (!findSeat(room, person.sessionToken)) person.choice = 'spectator';
    appendSystemMessage(room, room.game.mode === 'special'
      ? '도둑잡기(특수 능력 모드)가 시작됐습니다. 각자 무작위 능력을 하나씩 받았습니다.'
      : '도둑잡기가 시작됐습니다. 각자 자동으로 짝을 버렸습니다.');
  }

  if (action === 'shuffle-oldmaid' || action === 'draw-oldmaid') {
    if (!isOldMaid(room)) return sendError(res, 400, 'WRONG_GAME', '도둑잡기 방에서만 카드 조작이 가능합니다.');
    const playerSeat = findSeat(room, session.token);
    if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 카드를 조작할 수 없습니다.');
    const engine = getGame('oldmaid');
    if (action === 'shuffle-oldmaid') {
      const verdict = engine.shuffleHand(room.game, playerSeat, body.expectedRevision);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_SHUFFLE', engine.moveError(verdict.reason));
      appendSystemMessage(room, `${session.label || '플레이어'}님이 자신의 카드를 섞었습니다.`);
    } else {
      const verdict = engine.draw(room.game, playerSeat, body.targetSeat, body.index, body.expectedRevision);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_DRAW', engine.moveError(verdict.reason));
      drawnOldMaidCard = verdict.card;
      const targetLabel = room.participants[room.players[body.targetSeat]]?.label || '상대';
      appendSystemMessage(room, `${session.label || '플레이어'}님이 ${targetLabel}님의 카드 1장을 뽑았습니다.`);
      if (verdict.pairs) appendSystemMessage(room, `${session.label || '플레이어'}님이 카드 ${verdict.pairs}쌍을 버렸습니다.`);
      if (room.game.hands[body.targetSeat].length === 0) appendSystemMessage(room, `${targetLabel}님의 카드가 모두 없어졌습니다.`);
      if (room.game.hands[playerSeat].length === 0) appendSystemMessage(room, `${session.label || '플레이어'}님의 카드가 모두 없어졌습니다.`);
      if (verdict.finished) appendSystemMessage(room, `${room.participants[room.players[room.game.loser]]?.label || '마지막 참가자'}님이 조커를 보유하여 패배했습니다.`);
      if (verdict.shieldTriggered) appendSystemMessage(room, `${targetLabel}님의 방어막이 발동해 무작위 카드가 뽑혔습니다.`);
    }
  }

  if (action === 'use-ability-oldmaid') {
    if (!isOldMaid(room)) return sendError(res, 400, 'WRONG_GAME', '도둑잡기 방에서만 능력을 사용할 수 있습니다.');
    const playerSeat = findSeat(room, session.token);
    if (!playerSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 능력을 사용할 수 없습니다.');
    const engine = getGame('oldmaid');
    const type = body.type;
    const rev = body.expectedRevision;
    const label = session.label || '플레이어';
    if (type === 'peek') {
      const verdict = engine.peekCard(room.game, playerSeat, Number(body.index), rev);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_ABILITY', engine.moveError(verdict.reason));
      appendSystemMessage(room, `${label}님이 엿보기 능력을 사용했습니다.`);
    } else if (type === 'redirect') {
      const verdict = engine.redirectTarget(room.game, playerSeat, rev);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_ABILITY', engine.moveError(verdict.reason));
      appendSystemMessage(room, `${label}님이 방향 전환 능력을 사용했습니다.`);
    } else if (type === 'shield') {
      const verdict = engine.armShield(room.game, playerSeat, rev);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_ABILITY', engine.moveError(verdict.reason));
      appendSystemMessage(room, `${label}님이 방어막 능력을 사용했습니다.`);
    } else if (type === 'detect') {
      const verdict = engine.detectJoker(room.game, playerSeat, rev);
      if (!verdict.legal) return sendError(res, 409, 'INVALID_OLDMAID_ABILITY', engine.moveError(verdict.reason));
      appendSystemMessage(room, `${label}님이 조커 탐지 능력을 사용했습니다.`);
    } else {
      return sendError(res, 400, 'BAD_ABILITY', '알 수 없는 능력입니다.');
    }
  }

  if (action === 'set-bingo-target') {
    if (!isBingo(room)) return sendError(res, 400, 'WRONG_GAME', '빙고 방에서만 설정할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 승리 조건을 변경할 수 있습니다.');
    const engine = getGame('bingo');
    const verdict = engine.setTarget(room.game, Number(body.targetLines));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_BINGO_TARGET', engine.moveError(verdict.reason));
  }

  if (action === 'set-bingo-grid') {
    if (!isBingo(room)) return sendError(res, 400, 'WRONG_GAME', '빙고 방에서만 설정할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 판 크기를 변경할 수 있습니다.');
    const engine = getGame('bingo');
    const verdict = engine.setGridSize(room.game, Number(body.gridSize));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_BINGO_GRID', engine.moveError(verdict.reason));
  }

  if (action === 'set-bingo-pool') {
    if (!isBingo(room)) return sendError(res, 400, 'WRONG_GAME', '빙고 방에서만 설정할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 숫자 범위를 변경할 수 있습니다.');
    const engine = getGame('bingo');
    const verdict = engine.setPoolMax(room.game, Number(body.poolMax));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_BINGO_POOL', engine.moveError(verdict.reason));
  }

  if (action === 'start-bingo') {
    if (!isBingo(room)) return sendError(res, 400, 'WRONG_GAME', '빙고 방에서만 시작할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 빙고를 시작할 수 있습니다.');
    const seats = TEAM_SEATS.filter(seat => room.players[seat]);
    const engine = getGame('bingo');
    const verdict = engine.start(room.game, seats);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_BINGO_START', engine.moveError(verdict.reason));
    for (const p of Object.values(room.participants)) if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
    appendSystemMessage(room, `빙고 시작! ${room.game.targetLines}줄을 먼저 완성하면 승리합니다.`);
  }

  if (action === 'select-bingo') {
    if (!isBingo(room)) return sendError(res, 400, 'WRONG_GAME', '빙고 방에서만 숫자를 선택할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 숫자를 선택할 수 없습니다.');
    const engine = getGame('bingo');
    const verdict = engine.selectNumber(room.game, seat, Number(body.number), nowIso(), Number(body.expectedMoveCount));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_BINGO_SELECTION', engine.moveError(verdict.reason));
    appendSystemMessage(room, `${session.label || '플레이어'}님이 ${Number(body.number)}번을 선택했습니다.`);
    if (verdict.finished) appendSystemMessage(room, `${room.participants[room.players[room.game.winner]]?.label || room.game.winner + '번'}님이 빙고 승리 조건을 달성했습니다!`);
  }

  if (action === 'set-pictionary-config') {
    if (!isPictionary(room)) return sendError(res, 400, 'WRONG_GAME', '그림 맞히기 방에서만 설정할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 설정을 변경할 수 있습니다.');
    const engine = getGame('pictionary');
    const verdict = engine.configure(room.game, { mode: body.mode, difficulty: body.difficulty, roundSeconds: body.roundSeconds, showCategory: body.showCategory });
    if (!verdict.legal) return sendError(res, 409, 'INVALID_PICTIONARY_CONFIG', engine.moveError(verdict.reason));
  }

  if (action === 'start-pictionary') {
    if (!isPictionary(room)) return sendError(res, 400, 'WRONG_GAME', '그림 맞히기 방에서만 시작할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 그림 맞히기를 시작할 수 있습니다.');
    // v1.7.7: drawers rotate in the order players joined the room.
    const joinedAt = seat => room.participants[room.players[seat]]?.joinedAt || '';
    const seats = PICTIONARY_SEATS.filter(seat => room.players[seat]).sort((a, b) => joinedAt(a).localeCompare(joinedAt(b)));
    const engine = getGame('pictionary');
    const verdict = engine.start(room.game, seats);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_PICTIONARY_START', engine.moveError(verdict.reason));
    for (const p of Object.values(room.participants)) if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
    appendSystemMessage(room, `그림 맞히기${room.game.mode === 'team' ? '(팀전)' : ''} 시작! ${room.participants[room.players[room.game.drawerSeat]]?.label || '첫 출제자'}님부터 그립니다.`);
  }

  if (action === 'pictionary-stroke') {
    if (!isPictionary(room)) return sendError(res, 400, 'WRONG_GAME', '그림 맞히기 방에서만 사용할 수 있습니다.');
    if (!checkRateLimit(`pictionary-stroke:${session.token}`, 40, 1000)) {
      return sendError(res, 429, 'TOO_MANY_STROKES', '그리기 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
    }
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 그림을 그릴 수 없습니다.');
    const engine = getGame('pictionary');
    const verdict = engine.addStroke(room.game, seat, body.stroke);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_STROKE', engine.moveError(verdict.reason));
  }

  if (action === 'pictionary-clear') {
    if (!isPictionary(room)) return sendError(res, 400, 'WRONG_GAME', '그림 맞히기 방에서만 사용할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 그림판을 지울 수 없습니다.');
    const engine = getGame('pictionary');
    const verdict = engine.clearCanvas(room.game, seat);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_CLEAR', engine.moveError(verdict.reason));
  }

  if (action === 'pictionary-undo') {
    if (!isPictionary(room)) return sendError(res, 400, 'WRONG_GAME', '그림 맞히기 방에서만 사용할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 그림을 되돌릴 수 없습니다.');
    const engine = getGame('pictionary');
    const verdict = engine.undoStroke(room.game, seat);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_UNDO', engine.moveError(verdict.reason));
  }

  if (action === 'pictionary-guess') {
    if (!isPictionary(room)) return sendError(res, 400, 'WRONG_GAME', '그림 맞히기 방에서만 사용할 수 있습니다.');
    if (!checkRateLimit(`pictionary-guess:${session.token}`, 10, 5000)) {
      return sendError(res, 429, 'TOO_MANY_GUESSES', '정답 제출이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
    }
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 정답을 제출할 수 없습니다.');
    const engine = getGame('pictionary');
    const verdict = engine.submitGuess(room.game, seat, body.guess);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_GUESS', engine.moveError(verdict.reason));
    if (verdict.close) pictionaryClose = true;
    if (verdict.correct) {
      appendSystemMessage(room, verdict.first
        ? `${session.label || '참가자'}님이 처음으로 정답을 맞혔습니다! 10초 추가 정답시간이 시작됩니다.`
        : `${session.label || '참가자'}님이 정답을 맞혔습니다!`);
      if (verdict.allGuessed) engine.endRound(room.game);
    }
  }

  if (action === 'set-secret') {
    if (room.gameType !== 'baseball') return sendError(res, 400, 'WRONG_GAME', '숫자야구 방에서만 사용할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 비밀 숫자를 정할 수 없습니다.');
    const engine = getGame('baseball');
    const verdict = engine.setSecret(room.game, seat, body.secret);
    if (!verdict.legal) return sendError(res, verdict.reason === 'invalid-number' ? 400 : 409, 'INVALID_SECRET', engine.moveError(verdict.reason));
    appendSystemMessage(room, `${session.label || '플레이어'}님이 비밀 숫자 준비를 완료했습니다.`);
    if (verdict.ready) appendSystemMessage(room, '양쪽 비밀 숫자 준비 완료! 선공부터 추측하세요.');
  }

  if (action === 'guess') {
    if (room.gameType !== 'baseball') return sendError(res, 400, 'WRONG_GAME', '숫자야구 방에서만 사용할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 숫자를 추측할 수 없습니다.');
    const engine = getGame('baseball');
    const verdict = engine.applyGuess(room.game, body.guess, seat, nowIso());
    if (!verdict.legal) return sendError(res, verdict.reason === 'invalid-number' ? 400 : 409, 'INVALID_GUESS', engine.moveError(verdict.reason));
  }

  if (action === 'throw-yut') {
    if (room.gameType !== 'yut') return sendError(res, 400, 'WRONG_GAME', '윷놀이 방에서만 사용할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 윷을 던질 수 없습니다.');
    const engine = getGame('yut');
    const verdict = engine.throwYut(room.game, seat, nowIso());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_YUT_THROW', engine.moveError(verdict.reason));
    appendSystemMessage(room, `${session.label || '플레이어'}님이 ${verdict.name}을(를) 던졌습니다.`);
  }

  if (action === 'move-yut') {
    if (room.gameType !== 'yut') return sendError(res, 400, 'WRONG_GAME', '윷놀이 방에서만 사용할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 말을 움직일 수 없습니다.');
    const engine = getGame('yut');
    const verdict = engine.applyMove(room.game, String(body.pieceId || ''), seat, nowIso());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_YUT_MOVE', engine.moveError(verdict.reason));
    if (verdict.captured.length) appendSystemMessage(room, `${session.label || '플레이어'}님이 상대 말 ${verdict.captured.length}개를 잡았습니다!`);
  }

  if (action === 'start-city') {
    if (!isCityKing(room)) return sendError(res, 400, 'WRONG_GAME', '랜드킹 방에서만 시작할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 랜드킹을 시작할 수 있습니다.');
    const seats = seatsFor(room).filter(seatNumber => room.players[seatNumber]);
    const engine = getGame('cityking');
    const verdict = engine.start(room.game, seats);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_CITY_START', engine.moveError(verdict.reason));
    for (const p of Object.values(room.participants)) if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
    appendSystemMessage(room, `랜드킹 시작! ${seats.length}명이 참가합니다.`);
  }

  if (action === 'roll-city') {
    if (room.gameType !== 'cityking') return sendError(res, 400, 'WRONG_GAME', '랜드킹 방에서만 주사위를 굴릴 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 주사위를 굴릴 수 없습니다.');
    const engine = getGame('cityking');
    const verdict = engine.rollDice(room.game, seat, nowIso(), undefined,
      body.expectedMoveCount == null ? null : Number(body.expectedMoveCount));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_CITY_ROLL', engine.moveError(verdict.reason));
    appendSystemMessage(room, `${session.label || '플레이어'}님이 주사위를 굴려 ${verdict.total}칸 이동했습니다.${verdict.double && !verdict.finished ? ' 더블! 칸 처리 후 추가 굴림입니다.' : ''}`);
  }

  if (action === 'buy-city' || action === 'skip-city') {
    if (room.gameType !== 'cityking') return sendError(res, 400, 'WRONG_GAME', '랜드킹 방에서만 도시를 매입할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 도시를 매입할 수 없습니다.');
    const engine = getGame('cityking');
    const verdict = action === 'buy-city' ? engine.buyProperty(room.game, seat, nowIso()) : engine.skipProperty(room.game, seat, nowIso());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_CITY_PURCHASE', engine.moveError(verdict.reason));
  }

  if (action === 'build-city' || action === 'skip-build-city') {
    if (room.gameType !== 'cityking') return sendError(res, 400, 'WRONG_GAME', '랜드킹 방에서만 건설할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 건설할 수 없습니다.');
    const engine = getGame('cityking');
    const verdict = action === 'build-city' ? engine.buildProperty(room.game, seat, nowIso()) : engine.skipBuild(room.game, seat, nowIso());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_CITY_BUILD', engine.moveError(verdict.reason));
  }

  if (action === 'sell-property-city' || action === 'sell-building-city') {
    if (room.gameType !== 'cityking') return sendError(res, 400, 'WRONG_GAME', '랜드킹 방에서만 자산을 매각할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 자산을 매각할 수 없습니다.');
    const engine = getGame('cityking');
    const tileIndex = Number(body.tileIndex);
    const verdict = action === 'sell-property-city'
      ? engine.sellProperty(room.game, seat, tileIndex, nowIso())
      : engine.sellBuilding(room.game, seat, tileIndex, nowIso());
    if (!verdict.legal) return sendError(res, 409, 'INVALID_CITY_SALE', engine.moveError(verdict.reason));
    const tileName = engine.TILES[tileIndex]?.name || '도시';
    appendSystemMessage(room, `${session.label || '플레이어'}님이 ${tileName} ${action === 'sell-property-city' ? '도시' : '건물'}을(를) 매각해 ${verdict.refund}을 받았습니다.`);
  }

  if (action === 'move') {
    if (room.gameType === 'baseball') return sendError(res, 400, 'WRONG_GAME', '숫자야구는 숫자 추측 기능을 이용해 주세요.');
    if (room.gameType === 'yut') return sendError(res, 400, 'WRONG_GAME', '윷놀이는 윷 던지기와 말 이동 기능을 이용해 주세요.');
    if (room.gameType === 'cityking') return sendError(res, 400, 'WRONG_GAME', '랜드킹은 주사위·도시 매입·건설 기능을 이용해 주세요.');
    if (room.gameType === 'bingo') return sendError(res, 400, 'WRONG_GAME', '빙고는 자신의 숫자판에서 숫자를 선택해 주세요.');
    if (room.gameType === 'pictionary') return sendError(res, 400, 'WRONG_GAME', '그림 맞히기는 그리기와 정답 제출 기능을 이용해 주세요.');
    if (isTwenty(room)) return sendError(res, 400, 'WRONG_GAME', '스무고개는 질문과 정답 제출 기능을 이용해 주세요.');
    if (room.gameType === 'liar') return sendError(res, 400, 'WRONG_GAME', '라이어게임은 힌트·투표·최종 추측 기능을 이용해 주세요.');
    if (isOldMaid(room)) return sendError(res, 400, 'WRONG_GAME', '도둑잡기는 카드 뽑기를 이용해 주세요.');
    if (isDavinci(room)) return sendError(res, 400, 'WRONG_GAME', '다빈치 코드는 타일 추측 기능을 이용해 주세요.');
    if (isHalli(room)) return sendError(res, 400, 'WRONG_GAME', '할리갈리는 카드 뒤집기와 종 기능을 이용해 주세요.');
    if (isPandemic(room)) return sendError(res, 400, 'WRONG_GAME', '팬데믹은 행동 메뉴를 이용해 주세요.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 돌을 둘 수 없습니다.');
    if (room.game.status !== 'playing') return sendError(res, 409, 'NOT_PLAYING', '현재 착수할 수 없습니다.');
    syncGamePause(room);
    if (room.game.paused) return sendError(res, 409, 'GAME_PAUSED', '상대가 응답하지 않아 일시정지 중입니다. 기다리거나 대국을 종료할 수 있습니다.');
    if (isTeam(room)) {
      if (room.game.nextSeat !== seat) return sendError(res, 409, 'NOT_YOUR_TURN', '현재 차례의 플레이어만 착수할 수 있습니다.');
    } else if (room.game.turn !== seat) return sendError(res, 409, 'NOT_YOUR_TURN', '상대 차례입니다.');
    const gameEngine = getGame(room.gameType) || getGame('omok');
    const verdict = gameEngine.applyMove(room.game, Number(body.x), Number(body.y), seat, nowIso());
    if (!verdict.legal) {
      const extra = verdict.forbidden ? { forbidden: verdict.forbidden } : {};
      return sendError(res, 409, verdict.forbidden ? 'FORBIDDEN_MOVE' : 'ILLEGAL_MOVE', gameEngine.moveError(verdict.reason), extra);
    }
    if (verdict.passed) {
      appendSystemMessage(room, `${verdict.passed === 'black' ? '흑' : '백'}은 둘 수 있는 곳이 없어 자동으로 패스했습니다.`);
    }
  }

  if (action === 'resign' && isRpg(room)) {
    if (!findSeat(room, session.token) || room.game.status !== 'playing') return sendError(res, 409, 'NOT_PLAYING', '포기할 수 있는 원정이 없습니다.');
    getGame('rpg').defeat(room.game, 'abandon');
    appendSystemMessage(room, `${session.label || '참가자'}님이 원정을 포기했습니다.`);
    touchRoom(room); broadcast(room);
    return sendJson(res, 200, { ok: true, state: roomView(room, session) });
  }
  if (action === 'resign') {
    const seat = findSeat(room, session.token);
    if (!seat || (room.game.status !== 'playing' && !(room.gameType === 'baseball' && room.game.status === 'setup'))) return sendError(res, 409, 'NOT_PLAYING', '기권할 수 없는 상태입니다.');
    if (isPandemic(room)) getGame('pandemic').forfeit(room.game);
    else room.game.status = 'finished';
    room.game.resignedSeat = seat; // server-only: lets the mission rules tell a resignation from a clean finish
    // Bingo/pictionary/liar/oldmaid are free-for-all games with no black/white side for a
    // resign to flip. Ending immediately and crediting every other seated player as the winner
    // mirrors exactly what already happens when a required player disconnects and someone calls
    // end-game -- just self-triggered instead of waiting on someone else to notice and act.
    // Bingo/pictionary/liar/oldmaid stay an array (never collapsed to a lone scalar the way
    // end-game's disconnect path does for them): pictionary/liar/oldmaid's own result displays
    // already only ever expect an array (their natural win conditions never produce a scalar), so
    // resign matches that rather than handing them a shape they don't render.
    if (isGostop(room) || isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isTwenty(room) || isDavinci(room) || isHalli(room) || isPandemic(room)) {
      room.game.winner = isPandemic(room) ? [] : assignedSeatsFor(room).filter(s => s !== seat);
      room.game.endReason = 'resign';
      if (isGostop(room)) getGame('gostop').forfeitResult(room.game, [seat], 'resign');
    } else {
      room.game.winner = (isTeam(room) ? teamColor(seat) : seat) === 'black' ? 'white' : 'black';
    }
    room.game.winningLine = null;
    room.game.paused = false;
    room.game.disconnectedSeats = [];
  }

  // Any connected participant may end a game that's paused for a disconnected required player --
  // no host approval or unanimous vote required. The connected side(s) are recorded as the winner,
  // the disconnected side as the loser (team games resolve by whole team, confirmed by the user);
  // this is the one and only server-side resolution (status flips 'playing' -> 'finished' exactly
  // once, guarded by the same status check every other ending path already relies on, so a repeat
  // click, a race between two connected players, or a last-second reconnect can't double-record or
  // overturn the result).
  // v1.8.4: a seat flagged idle (still connected, but sat on its turn past the AFK limit) tells the server it is
  // back on its first real input. The idle clock restarts, so the pause lifts without the others having to vote.
  if (action === 'present') {
    const mine = findSeat(room, session.token);
    if (!mine) return sendError(res, 403, 'SPECTATOR', '관전자입니다.');
    const watch = room.turnWatch;
    if (room.game.status === 'playing' && room.game.paused && watch && watch.seat === mine && !watch.pausedAt) {
      room.turnWatch = { seat: mine, since: Date.now() };
      syncGamePause(room, false);
      touchRoom(room);
      broadcast(room);
    }
    return sendJson(res, 200, { ok: true, state: roomView(room, session) });
  }

  if (action === 'end-game') {
    if (!findSeat(room, session.token)) return sendError(res, 403, 'SPECTATOR', '관전자는 대국을 종료할 수 없습니다.');
    syncGamePause(room);
    if (room.game.status !== 'playing' || !room.game.paused) {
      return sendError(res, 409, 'NOT_PAUSED', '상대가 응답하지 않아 일시정지된 상태에서만 대국을 종료할 수 있습니다.');
    }
    const disconnectedSeats = room.game.disconnectedSeats.slice();
    const connectedSeats = assignedSeatsFor(room).filter(seat => !disconnectedSeats.includes(seat));
    if (!connectedSeats.length) {
      return sendError(res, 409, 'NO_CONNECTED_PLAYERS', '접속 중인 참가자가 없어 종료할 수 없습니다.');
    }
    room.game.status = 'finished';
    // 2-seat games (and anywhere else exactly one seat is left) keep the plain single-value
    // winner every other ending path on that game already uses; only a 3+ seat free-for-all with
    // more than one seat still connected needs the array form. omok2v2 decides it per team colour.
    room.game.winner = isTeam(room)
      ? (teamColor(disconnectedSeats[0]) === 'black' ? 'white' : 'black')
      : connectedSeats.length === 1 ? connectedSeats[0] : connectedSeats;
    room.game.winningLine = null;
    room.game.endReason = 'disconnect';
    room.game.disconnectedAtEnd = disconnectedSeats;
    if (isGostop(room)) {
      room.game.winner = connectedSeats;
      getGame('gostop').forfeitResult(room.game, disconnectedSeats, 'disconnect');
    }
    room.game.paused = false;
    room.game.disconnectedSeats = [];
    appendSystemMessage(room, `${session.label || '참가자'}님이 응답 없는 참가자를 상대로 대국을 종료했습니다. 응답 중인 참가자 승리로 기록됩니다.`);
  }

  if (action === 'next-round' || action === 'rematch') {
    if (!['finished', 'draw'].includes(room.game.status)) {
      return sendError(res, 409, 'NOT_FINISHED', '대국이 끝난 뒤 다음 판을 열 수 있습니다.');
    }
    prepareNextRound(room);
    appendSystemMessage(room, `${session.label || '참가자'}님이 다음 판을 열었습니다. 역할을 다시 선택해 주세요.`);
  }

  // v1.7.3: this action started the game -- charge every seated player's entry fee now, or undo
  // the start (the room goes back to waiting; seats stay) if anyone is short or points fail.
  if (entryBefore && room.game.status !== 'selecting') {
    let charged;
    const pending = chargeRoomEntry(room);
    room.entryPending = pending;
    try { charged = await pending; }
    catch (error) { console.error('참가 포인트 차감 실패:', error); charged = { ok: false, error: true }; await reclaimFailedEntry(error?.entryId); }
    finally { if (room.entryPending === pending) room.entryPending = null; }
    if (!charged.ok) {
      restoreEntrySnapshot(room, entryBefore);
      const message = charged.error ? '포인트 처리 중 오류로 게임을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.'
        : `참가 포인트(${ENTRY_FEE.toLocaleString('ko-KR')}P)가 부족한 참가자가 있어 시작할 수 없습니다: ${charged.short.join(', ')}`;
      appendSystemMessage(room, message);
      touchRoom(room);
      broadcast(room);
      return sendError(res, charged.error ? 503 : 409, charged.error ? 'POINTS_UNAVAILABLE' : 'INSUFFICIENT_POINTS', message);
    }
  }

  if (!(await recordOrError(room, res))) return;
  touchRoom(room);
  broadcast(room);
  if (room.ai) scheduleAiMove(room); // v1.10.72: the AI's turn now (a start with AI first, or after the person's move)
  return sendJson(res, 200, {
    ok: true,
    state: roomView(room, session),
    ...(drawnOldMaidCard ? { drawnOldMaidCard } : {}),
    // Only the guesser who typed a near miss ever hears about it.
    ...(pictionaryClose ? { pictionaryClose } : {}),
  });
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  // World actions keep their existing classic/room entry paths; while on the island, the server checks the door too.
  const placeActions = { '/api/points/attendance': 'attendance', '/api/donation': 'donate', '/api/nickname': 'naming', '/api/climb/start': 'climb', '/api/avatar/surgery': 'faces', '/api/avatar/dye': 'dye' };
  if (req.method === 'POST' && (placeActions[pathname] || pathname === '/api/skins/buy' || pathname === '/api/skins/gift' || (req.headers['x-island-facility'] && ['/api/skins/equip', '/api/skins/title'].includes(pathname)))) {
    const session = requireSession(req, res); if (!session) return;
    const at = plazaPresence.get(session.token);
    if (at) {
      const body = await parseJson(req);
      const skin = body.skinId ? skinById(body.skinId) : null;
      const avatar = skin?.game === 'avatar' || skin?.family === 'avatar' || body.game === 'avatar';
      const slot = skin?.slot || body.slot;
      const shopPlace = ['shop', 'avatar', 'hair', 'accessories', 'transform'].includes(req.headers['x-island-facility']) ? req.headers['x-island-facility'] : null;
      const place = placeActions[pathname] || (!['/api/skins/buy', '/api/skins/gift'].includes(pathname) && shopPlace) || (avatar ? slot === 'transform' ? 'transform' : slot === 'outfit' ? 'avatar' : slot === 'hair' ? 'hair' : 'accessories' : 'shop'); // (v1.10.91 변신 의상실)
      // v1.10.92 백화점: the shops are its sectors -- inside, at that sector's spot
      // (달마루섬 5단계: the 작명소's business at the 민원실's 개명 신청 window too)
      const door = IslandStore.sectorOf(place) ? (storeInside.has(session.token) ? IslandStore.sectorPoint(place) : null) : place === 'naming' && townhallInside.has(session.token) ? IslandTerrain.roomWorld(IslandTerrain.TOWNHALL_ROOM.rename.lx, IslandTerrain.TOWNHALL_ROOM.rename.lz) : IslandTerrain.facilityDoor(place);
      if (!door || trainRiders.has(session.token) || trainVisitors.has(session.token) || Math.hypot(at.x - door.x, at.z - door.z) >= 2.4) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    }
  }

  if (pathname === '/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, version: '1.10.107' });
  }

  // v1.10.14: the worker's rollback check (public/sw.js); 404 on deploys from before the resource cache
  if (pathname === '/asset-cache.json' && req.method === 'GET') {
    return sendJson(res, 200, { enabled: assetCacheEnabled, version: assetCacheEnabled ? assetPackVersion : '' });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/asset-cache' && req.method === 'POST') {
    assetCacheEnabled = (await parseJson(req)).enabled !== false;
    return sendJson(res, 200, { enabled: assetCacheEnabled });
  }

  // --- v1.10.63 아이디·비밀번호 로그인·회원가입·내 계정 ---
  if (pathname === '/api/account/check-id' && req.method === 'POST') {
    if (!checkRateLimit(`account-check:${clientIp(req)}`, 30, 10 * 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '확인이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
    const loginId = normalizeLoginId((await parseJson(req)).loginId);
    if (!loginIdOk(loginId)) return sendError(res, 400, 'BAD_LOGIN_ID', '아이디는 영문 소문자·숫자·밑줄(_) 4~20자입니다.');
    return sendJson(res, 200, { ok: true, loginId, available: !await accessStore.loginTaken(loginId) });
  }
  if (pathname === '/api/account/signup' && req.method === 'POST') {
    if ((await opsSwitches()).signups === false) return sendError(res, 403, 'SIGNUPS_CLOSED', '지금은 가입 신청을 받지 않습니다. 나중에 다시 신청해 주세요.'); // v1.10.90 운영 스위치
    if (!checkRateLimit(`account-signup:${clientIp(req)}`, 5, 60 * 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '가입 신청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const realName = String(body.realName || '').trim().replace(/\s+/g, ' ');
    const loginId = normalizeLoginId(body.loginId);
    const nickname = String(body.nickname || '').trim().replace(/\s+/g, ' ');
    if (!realName || realName.length > 20) return sendError(res, 400, 'BAD_NAME', '이름을 1~20자로 입력해 주세요.');
    if (!loginIdOk(loginId)) return sendError(res, 400, 'BAD_LOGIN_ID', '아이디는 영문 소문자·숫자·밑줄(_) 4~20자입니다.');
    if (!passwordOk(body.password)) return sendError(res, 400, 'BAD_PASSWORD', `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자입니다.`);
    if (!nicknameFormatOk(nickname)) return sendError(res, 400, 'BAD_NICKNAME', `닉네임은 한글·숫자 ${NICKNAME_MAX}자까지입니다.`);
    const wanted = normalizeNickname(nickname);
    if (RESERVED_NICKNAMES.has(wanted) || (await accessStore.list()).some((key) => normalizeNickname(key.label) === wanted)) return sendError(res, 409, 'NAME_TAKEN', '이미 쓰고 있는 닉네임입니다.');
    const row = await accessStore.requestSignup({ realName, loginId, passwordHash: await hashPassword(body.password), label: nickname });
    if (!row) return sendError(res, 409, 'LOGIN_ID_TAKEN', '이미 사용 중인 아이디입니다.'); // checked again at the save itself
    return sendJson(res, 201, { ok: true, pending: true });
  }
  if (pathname === '/api/account/login' && req.method === 'POST') {
    const body = await parseJson(req);
    const loginId = normalizeLoginId(body.loginId);
    if (!checkRateLimit(`account-login:${clientIp(req)}`, 10, 15 * 60 * 1000) || !checkRateLimit(`account-login-id:${loginId}`, 10, 15 * 60 * 1000)) {
      return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.');
    }
    const key = loginIdOk(loginId) ? await accessStore.findLogin(loginId) : null;
    if (!key || !await verifyPassword(String(body.password || ''), key.passwordHash)) return sendError(res, 403, 'BAD_LOGIN', '아이디 또는 비밀번호가 올바르지 않습니다.');
    if (key.pendingAt) return sendError(res, 403, 'PENDING', '관리자 승인 대기 중입니다. 승인 후 로그인할 수 있습니다.');
    if (key.revokedAt) return sendError(res, 403, 'REVOKED', '사용이 중지된 계정입니다. 관리자에게 문의해 주세요.');
    return sendJson(res, 200, { ok: true, accountToken: issueTicket(accountTokens, key.id, ACCOUNT_TTL_MS), account: await accountOut(key) });
  }
  if (pathname === '/api/account/setup' && req.method === 'POST') { // an entry-file account's first id and password
    if (!checkRateLimit(`account-setup:${clientIp(req)}`, 10, 15 * 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const ticket = ticketOf(setupTickets, body.ticket);
    if (!ticket) return sendError(res, 403, 'SETUP_EXPIRED', '설정 시간이 지났습니다. 입장 파일을 다시 열어 주세요.');
    const loginId = normalizeLoginId(body.loginId);
    if (!loginIdOk(loginId)) return sendError(res, 400, 'BAD_LOGIN_ID', '아이디는 영문 소문자·숫자·밑줄(_) 4~20자입니다.');
    if (!passwordOk(body.password)) return sendError(res, 400, 'BAD_PASSWORD', `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자입니다.`);
    const row = await accessStore.setLogin(ticket.keyId, loginId, await hashPassword(body.password));
    if (row === false) return sendError(res, 409, 'LOGIN_ID_TAKEN', '이미 사용 중인 아이디입니다.');
    if (!row) return sendError(res, 409, 'ALREADY_SET', '이미 아이디가 설정된 계정입니다. 로그인해 주세요.');
    setupTickets.delete(String(body.ticket)); setupRequiredKeys.delete(row.id);
    return sendJson(res, 200, { ok: true, accountToken: issueTicket(accountTokens, row.id, ACCOUNT_TTL_MS), account: await accountOut(row) });
  }
  if (pathname.startsWith('/api/account/') && ['me', 'password', 'entry-file', 'logout'].includes(pathname.slice(13))) {
    const acct = accountOf(req);
    const key = acct && await accessStore.get(acct.keyId);
    if (!key || key.revokedAt || key.pendingAt) { if (acct) accountTokens.delete(String(req.headers['x-account-token'])); return sendError(res, 401, 'ACCOUNT_AUTH', '로그인이 필요합니다.'); }
    const action = pathname.slice(13);
    if (action === 'me' && req.method === 'GET') return sendJson(res, 200, { ok: true, account: await accountOut(key) });
    if (action === 'logout' && req.method === 'POST') { accountTokens.delete(String(req.headers['x-account-token'])); return sendJson(res, 200, { ok: true }); }
    if (action === 'password' && req.method === 'POST') {
      if (!checkRateLimit(`account-password:${key.id}`, 10, 15 * 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      const body = await parseJson(req);
      const full = await accessStore.findLogin(key.loginId);
      if (!full || !await verifyPassword(String(body.current || ''), full.passwordHash)) return sendError(res, 403, 'BAD_PASSWORD', '현재 비밀번호가 올바르지 않습니다.');
      if (!passwordOk(body.next)) return sendError(res, 400, 'BAD_PASSWORD', `새 비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자입니다.`);
      await accessStore.setPassword(key.id, await hashPassword(body.next));
      dropAccountTokens(key.id, String(req.headers['x-account-token'])); // other logins of it end
      return sendJson(res, 200, { ok: true });
    }
    if (action === 'entry-file' && req.method === 'POST') { // a new file: the earlier one stops working (the client asked first)
      if (!checkRateLimit(`account-file:${key.id}`, 5, 60 * 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '입장 파일 발급이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
      const token = newSecret(32);
      const row = await accessStore.rotateToken(key.id, token);
      if (!row) return sendError(res, 404, 'KEY_NOT_FOUND', '계정을 찾을 수 없습니다.');
      invalidateGuestSessions(key.id, '새 입장 파일이 발급되어 이 접속은 종료되었습니다.'); // as the administrator's reissue (Codex)
      return sendJson(res, 200, { ok: true, fileName: safeFilename(row.label), html: makeGuestFile({ baseUrl: publicBaseUrl(req), token, label: row.label }) });
    }
    return sendError(res, 405, 'METHOD', '지원하지 않는 요청입니다.');
  }
  // v1.10.78 메신저 (IDEAS #future-messenger): group chat on 내 계정 for the accounts an administrator lets in. Every
  // call checks the login and the permission here (a hidden button is not the check); a room is reached only by its
  // members. The page asks again every few seconds while it is open (no stream on the start page).
  if (pathname === '/api/messenger' || pathname.startsWith('/api/messenger/')) {
    const acct = accountOf(req);
    const key = acct && await accessStore.get(acct.keyId);
    if (!key || key.revokedAt || key.pendingAt) return sendError(res, 401, 'ACCOUNT_AUTH', '로그인이 필요합니다.');
    const allowed = new Set(await messengerStore.allowedIds());
    if (!allowed.has(key.id)) return sendError(res, 403, 'MESSENGER_DENIED', '메신저는 관리자가 허용한 계정만 쓸 수 있습니다.');
    if ((await opsSwitches()).messenger === false) return sendError(res, 403, 'MESSENGER_OFF', '메신저를 잠시 쉬고 있습니다.'); // v1.10.90 운영 스위치
    const keys = (await accessStore.list()).filter((k) => !k.revokedAt && !k.pendingAt);
    const labelOf = new Map(keys.map((k) => [k.id, k.label]));
    const people = keys.filter((k) => allowed.has(k.id) && k.id !== key.id).map((k) => ({ id: k.id, label: k.label }));
    const nameOf = (id) => labelOf.get(id) || '(떠난 계정)';
    // v1.10.88 카카오톡처럼: a 1:1 room is called after the other person (even once they left); `reads` = each member's last
    // read number (the page counts who has not read a line -- `active` only: a revoked or shut-out account is not waited for)
    const view = (room) => ({ id: room.id, kind: room.kind, name: room.kind === 'dm' ? nameOf(room.pair.find((id) => id !== key.id) || key.id) : room.name,
      seq: room.seq, lastAt: room.lastAt, unread: Math.max(0, room.seq - (room.reads[key.id] || 0)), muted: room.muted.includes(key.id), pinned: (room.pinned || []).includes(key.id),
      reads: Object.fromEntries(room.members.map((id) => [id, room.reads[id] || 0])),
      last: room.last && { text: room.last.text || (room.last.system ? '' : '삭제된 메시지입니다'), at: room.last.at, system: Boolean(room.last.system), label: nameOf(room.last.from) },
      members: room.members.map((id) => ({ id, label: nameOf(id), active: allowed.has(id) && labelOf.has(id) })) });
    const say = async (room, text) => { const msg = await messengerStore.post(room.id, key.id, text, true); if (msg) await messengerStore.setRead(room.id, key.id, msg.seq); pokeRoom(room.id); };
    if (pathname === '/api/messenger/stream' && req.method === 'GET') { // A5: held open; 'msg' with a room id when it changes
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(': open\n\n');
      const set = messengerStreams.get(key.id) || new Set(); if (set.size >= 4) { const oldest = set.values().next().value; set.delete(oldest); try { oldest.end(); } catch {} } set.add(res); messengerStreams.set(key.id, set);
      const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
      req.on('close', () => { clearInterval(ping); set.delete(res); if (!set.size) messengerStreams.delete(key.id); });
      return;
    }
    const names = (ids) => ids.map((id) => `${nameOf(id)}님`).join(', ');
    const invitees = (list) => { // other permitted accounts only
      if (!Array.isArray(list) || list.length > MESSENGER_ROOM_MAX) return null;
      const ids = [...new Set(list.map(String))].filter((id) => id !== key.id);
      return ids.every((id) => people.some((p) => p.id === id)) ? ids : null;
    };
    if (pathname === '/api/messenger' && req.method === 'GET') {
      const rooms = (await messengerStore.roomsOf(key.id)).sort((a, b) => Number((b.pinned || []).includes(key.id)) - Number((a.pinned || []).includes(key.id)) || String(b.lastAt).localeCompare(String(a.lastAt))); // v1.10.90: pinned first
      return sendJson(res, 200, { ok: true, me: key.id, rooms: rooms.map(view), people });
    }
    if (pathname === '/api/messenger/rooms' && req.method === 'POST') {
      if (!checkRateLimit('messenger-room:' + key.id, 10, 60 * 60 * 1000)) return sendError(res, 429, 'RATE_LIMIT', '방을 너무 많이 만들고 있습니다. 잠시 뒤 다시 시도해 주세요.');
      const body = await parseJson(req);
      const name = String(body.name || '').trim().replace(/\s+/g, ' ');
      if (!name || name.length > 20) return sendError(res, 400, 'BAD_ROOM_NAME', '방 이름은 1~20자로 입력해 주세요.');
      const members = invitees(body.members);
      if (!members || !members.length || members.length + 1 > MESSENGER_ROOM_MAX) return sendError(res, 400, 'BAD_MEMBERS', `함께할 사람을 1~${MESSENGER_ROOM_MAX - 1}명 골라 주세요.`);
      if ((await messengerStore.roomsOf(key.id)).length >= MESSENGER_ROOMS_MAX) return sendError(res, 409, 'TOO_MANY_ROOMS', `방은 ${MESSENGER_ROOMS_MAX}개까지 들어갈 수 있습니다.`);
      const made = await messengerStore.createRoom(name, key.id, members); pokeRoom(made.id); // (A5: the new room shows on their lists)
      await say(made, `${nameOf(key.id)}님이 ${names(members)}을 초대했습니다.`);
      return sendJson(res, 201, { ok: true, room: view(await messengerStore.room(made.id)) });
    }
    if (pathname === '/api/messenger/dm' && req.method === 'POST') { // v1.10.88 1:1: the same room again, never a second one
      const body = await parseJson(req);
      const other = people.find((p) => p.id === String(body.with || ''));
      if (!other) return sendError(res, 400, 'BAD_MEMBERS', '대화할 사람을 골라 주세요.');
      const mine = await messengerStore.roomsOf(key.id);
      if (!mine.some((r) => r.kind === 'dm' && r.pair.includes(other.id)) && mine.length >= MESSENGER_ROOMS_MAX) return sendError(res, 409, 'TOO_MANY_ROOMS', `방은 ${MESSENGER_ROOMS_MAX}개까지 들어갈 수 있습니다.`);
      const { room: dm, joined } = await messengerStore.dmRoom(key.id, other.id);
      if (joined.length && dm.seq) await say(dm, `${names(joined)}이 들어왔습니다.`); // back in after leaving: the old lines are there
      return sendJson(res, 200, { ok: true, room: view(await messengerStore.room(dm.id)) });
    }
    const m = pathname.match(/^\/api\/messenger\/rooms\/([0-9a-f-]{36})\/(messages|members|leave|name|mute|pin|unsend)$/i);
    const room = m && await messengerStore.room(m[1]);
    if (!room || !room.members.includes(key.id)) return sendError(res, 404, 'ROOM_NOT_FOUND', '대화방을 찾을 수 없습니다.');
    if (m[2] === 'messages' && req.method === 'GET') {
      const after = Math.max(0, Math.floor(Number(url.searchParams.get('after')) || 0));
      const before = Math.max(0, Math.floor(Number(url.searchParams.get('before')) || 0)); // v1.10.87 이전 대화
      const messages = await (before ? messengerStore.older(room.id, before) : messengerStore.messages(room.id, after));
      if (!before) { // v1.10.88 읽음: looking at the room reads it (kept on the server, so every device agrees)
        const upTo = messages.length ? messages.at(-1).seq : room.seq; // only what was handed over (past 100 unread, the rest next time -- Codex review)
        await messengerStore.setRead(room.id, key.id, upTo); room.reads[key.id] = Math.max(room.reads[key.id] || 0, upTo);
      }
      return sendJson(res, 200, { ok: true, room: view(room), messages: messages.map((x) => ({ ...x, label: nameOf(x.from), ...(!x.system && x.text === '' ? { deleted: true } : {}) })) });
    }
    if (m[2] === 'messages' && req.method === 'POST') {
      if (!checkRateLimit('messenger-post:' + key.id, 6, 5 * 1000)) return sendError(res, 429, 'CHAT_RATE_LIMIT', '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 보내 주세요.');
      const body = await parseJson(req);
      const text = String(body.text || '').trim();
      if (!text) return sendError(res, 400, 'EMPTY_CHAT', '메시지를 입력해 주세요.');
      if (text.length > MESSENGER_TEXT_MAX) return sendError(res, 400, 'CHAT_TOO_LONG', `메시지는 ${MESSENGER_TEXT_MAX}자까지 보낼 수 있습니다.`);
      const sent = await messengerStore.post(room.id, key.id, text);
      if (sent) await messengerStore.setRead(room.id, key.id, sent.seq); // my own line is read by me
      pokeRoom(room.id); // (A5: the members' pages take it at once)
      return sendJson(res, 201, { ok: true, message: { ...sent, label: key.label } });
    }
    if (m[2] === 'members' && req.method === 'POST') {
      const body = await parseJson(req);
      if (room.kind === 'dm') return sendError(res, 400, 'DM_ROOM', '1:1 대화방에는 초대할 수 없습니다. 새 대화방을 만들어 주세요.');
      const members = invitees(body.members)?.filter((id) => !room.members.includes(id));
      if (!members || !members.length) return sendError(res, 400, 'BAD_MEMBERS', '초대할 사람을 골라 주세요.');
      const grown = await messengerStore.addMembers(room.id, members, MESSENGER_ROOM_MAX); // the cap checked in the store (two invites at once)
      if (grown === false) return sendError(res, 409, 'ROOM_FULL', `한 방은 ${MESSENGER_ROOM_MAX}명까지입니다.`);
      if (!grown) return sendError(res, 404, 'ROOM_NOT_FOUND', '대화방을 찾을 수 없습니다.');
      await say(grown, `${nameOf(key.id)}님이 ${names(members)}을 초대했습니다.`);
      return sendJson(res, 200, { ok: true, room: view(await messengerStore.room(room.id)) });
    }
    if (m[2] === 'leave' && req.method === 'POST') { // the others are told; the last one out deletes the room
      await messengerStore.leave(room.id, key.id);
      await messengerStore.post(room.id, key.id, `${nameOf(key.id)}님이 나갔습니다.`, true);
      pokeRoom(room.id, [key.id]);
      return sendJson(res, 200, { ok: true });
    }
    if (m[2] === 'name' && req.method === 'POST') { // v1.10.88 단체 방 이름 바꾸기
      if (room.kind === 'dm') return sendError(res, 400, 'DM_ROOM', '1:1 대화방은 이름을 바꿀 수 없습니다.');
      const body = await parseJson(req);
      const name = String(body.name || '').trim().replace(/\s+/g, ' ');
      if (!name || name.length > 20) return sendError(res, 400, 'BAD_ROOM_NAME', '방 이름은 1~20자로 입력해 주세요.');
      if (name !== room.name) { await messengerStore.rename(room.id, name); await say(room, `${nameOf(key.id)}님이 방 이름을 「${name}」(으)로 바꿨습니다.`); }
      return sendJson(res, 200, { ok: true, room: view(await messengerStore.room(room.id)) });
    }
    if (m[2] === 'pin' && req.method === 'POST') { // v1.10.90 대화방 고정 (mine only: my list's top)
      const body = await parseJson(req);
      await messengerStore.setPinned(room.id, key.id, body.on === true);
      return sendJson(res, 200, { ok: true, room: view(await messengerStore.room(room.id)) });
    }
    if (m[2] === 'unsend' && req.method === 'POST') { // v1.10.90 메시지 삭제: my own line, within 5 minutes, for everyone
      const body = await parseJson(req); const seq = Math.floor(Number(body.seq));
      const msg = Number.isSafeInteger(seq) && seq > 0 ? await messengerStore.messageAt(room.id, seq) : null;
      if (!msg || msg.system || msg.from !== key.id) return sendError(res, 404, 'MESSAGE_NOT_FOUND', '지울 수 있는 메시지가 아닙니다.');
      if (Date.now() - Date.parse(msg.at) > 5 * 60 * 1000) return sendError(res, 409, 'TOO_LATE', '보낸 지 5분이 지난 메시지는 지울 수 없습니다.');
      await messengerStore.unsend(room.id, seq);
      pokeRoom(room.id);
      return sendJson(res, 200, { ok: true });
    }
    if (m[2] === 'mute' && req.method === 'POST') { // v1.10.88 방별 알림 끄기 (mine only)
      const body = await parseJson(req);
      await messengerStore.setMuted(room.id, key.id, body.on === true);
      return sendJson(res, 200, { ok: true, room: view(await messengerStore.room(room.id)) });
    }
    return sendError(res, 405, 'METHOD', '지원하지 않는 요청입니다.');
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/tax' && req.method === 'POST') { // v1.10.86: a day's tax now
    const body = await parseJson(req); taxDay = null; await collectTaxes(nowMs(), String(body.day || '')); return sendJson(res, 200, { ok: true });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/account-setup' && req.method === 'POST') {
    const body = await parseJson(req); setupRequiredKeys.add(String(body.keyId || ''));
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/guest-entry' && req.method === 'POST') {
    if (browserBlocked(req)) return sendChromeOnly(res);
    if (!checkRateLimit(`guest-entry:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
      return sendSimpleHtml(res, 429, '입장 제한', '입장 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    }
    const form = await parseForm(req);
    let key;
    if (form.account) { // v1.10.63 「게임 접속」 from the 내 계정 screen
      const acct = ticketOf(accountTokens, form.account);
      key = acct && await accessStore.recordUse(acct.keyId);
      if (!key) return sendSimpleHtml(res, 403, '입장 거부', '로그인이 만료되었습니다. 다시 로그인해 주세요.');
    } else {
      const token = String(form.token || '');
      if (token.length < 30 || token.length > 200) return sendSimpleHtml(res, 403, '입장 거부', '유효하지 않은 입장 파일입니다.');
      key = await accessStore.validateAndRecord(token);
      if (!key) return sendSimpleHtml(res, 403, '입장 거부', '이 입장 파일은 유효하지 않거나 권한이 취소되었습니다.');
      // an account with no login id sets one first (no skipping); the file goes on working after
      if (!key.loginId && (!setupNotRequired || setupRequiredKeys.has(key.id))) return sendIndex(res, { setupTicket: issueTicket(setupTickets, key.id, SETUP_TTL_MS), label: key.label });
    }
    if (guestKeyInUse(key.id)) {
      return sendSimpleHtml(
        res,
        409,
        '이미 사용 중',
        '이 입장 파일은 현재 다른 기기나 브라우저에서 사용 중입니다. 기존 사용자가 나간 뒤 다시 시도해 주세요. 비정상 종료된 경우에는 최대 약 90초 뒤 자동으로 다시 사용할 수 있습니다.'
      );
    }
    const session = createSession({ role: 'guest', label: key.label, guestKeyId: key.id });
    const identity = sessionIdentity(session);
    // A host owns the room by guest-key identity, not by the old browser session token. This
    // also covers the selecting/finished states where a host may not have chosen a seat yet.
    for (const room of rooms.values()) {
      if (room.hostIdentity !== identity) continue;
      const previousHost = Object.entries(room.participants).find(([oldToken, p]) =>
        participantIdentity(p) === identity && oldToken !== session.token
        && !p.connected && !sessions.has(oldToken));
      if (!previousHost || !roomAwaits(room, previousHost[0], previousHost[1])) continue; // an abandoned room: start on the island
      session.currentRoomId = room.id;
      registerParticipant(room, session);
      broadcast(room);
      break;
    }
    if (!session.currentRoomId) {
      // v1.6.99: any room this key was still in when its session ended -- a seat in a waiting,
      // playing or finished game, or a spectator -- most recent first.
      let latest = null;
      for (const room of rooms.values()) {
        for (const [oldToken, p] of Object.entries(room.participants)) {
          if (participantIdentity(p) !== identity || !p.rejoinable || p.connected || sessions.has(oldToken) || !roomAwaits(room, oldToken, p)) continue;
          if (p.rejoinOnlyWhilePlaying && !(room.game.status === 'playing' || (isTwenty(room) && room.game.status === 'round-ended'))) continue;
          if (!latest || String(p.lastSeen || '') > String(latest.lastSeen || '')) latest = { room, lastSeen: p.lastSeen };
        }
      }
      if (latest) {
        session.currentRoomId = latest.room.id;
        registerParticipant(latest.room, session);
        broadcast(latest.room);
      }
    }
    return sendIndex(res, { sessionToken: session.token, role: 'guest', label: session.label });
  }

  if (pathname === '/api/admin/login' && req.method === 'POST') {
    const ip = clientIp(req);
    if (!checkRateLimit(`admin-login:${ip}`, 5, 15 * 60 * 1000)) {
      return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '로그인 시도가 너무 많습니다. 15분 후 다시 시도해 주세요.');
    }
    const body = await parseJson(req);
    if (!safeEqualText(body.password || '', ADMIN_PASSWORD)) return sendError(res, 403, 'BAD_PASSWORD', '관리자 비밀번호가 올바르지 않습니다.');
    const session = createSession({ role: 'admin', label: '관리자' });
    return sendJson(res, 200, { sessionToken: session.token, role: 'admin', label: session.label });
  }

  // Game Center points: read the balance (creating the account with its one-time grant) and claim
  // today's (Asia/Seoul) attendance. The server alone decides both; there is no transfer endpoint.
  if (pathname === '/api/points' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const userId = pointAccountForSession(session);
    const account = await pointStore.getAccount(userId);
    const recentGostopSettlements = await pointStore.recentSettlements(userId, 'gostop', 5);
    return sendJson(res, 200, { ok: true, ...account, attendanceAmount: 50_000, recentGostopSettlements });
  }

  // v1.7.0: the caller's own ledger, read-only. The account always comes from the session; nothing in the
  // query string or body can select another user. Balance and ledger are never written here.
  if (pathname === '/api/points/history' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const userId = pointAccountForSession(session);
    if (!checkRateLimit(`pointhistory:${userId}`, 60, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    let page;
    try {
      page = await pointStore.history(userId, { limit: url.searchParams.get('limit'), before: url.searchParams.get('before') });
    } catch (error) {
      if (error instanceof TypeError) return sendError(res, 400, 'BAD_CURSOR', '조회 위치가 올바르지 않습니다.');
      throw error;
    }
    const balance = pointStore.cachedBalance(userId);
    return sendJson(res, 200, { ok: true, balance, ...page });
  }

  if (pathname === '/api/points/attendance' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (!checkRateLimit(`attendance:${pointAccountForSession(session)}`, 20, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const result = await pointStore.claimAttendance(pointAccountForSession(session));
    const room = getCurrentRoom(session);
    if (room) broadcast(room);
    return sendJson(res, 200, { ok: true, ...result });
  }

  // v1.7.20 common point-reward events. GET lists the events open right now for the caller and whether
  // the caller already claimed each one; POST claims by event id only. The server clock decides whether an
  // event is open and the registered definition decides the reward: nothing in the request can change either.
  if (pathname === '/api/events' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const userId = pointAccountForSession(session);
    if (!checkRateLimit(`events:${userId}`, 60, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const now = Date.now();
    const open = eventsForAccount(userId).filter(event => eventStatus(event, now) === 'open');
    const claimed = new Set(await pointStore.claimedEvents(userId, open.map(event => event.id)));
    // `account` is the caller's own point account: the page keys its per-account "hide today" choice with it.
    return sendJson(res, 200, { ok: true, account: userId, events: open.map(event => publicEvent(event, claimed.has(event.id))) });
  }

  // v1.7.20 today's missions and first-win bonus for the caller (Asia/Seoul day). Read-only apart from
  // dealing today's three missions on first touch; progress and payouts only ever come from recorded matches.
  if (pathname === '/api/missions' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const userId = pointAccountForSession(session);
    if (!checkRateLimit(`missions:${userId}`, 60, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    return sendJson(res, 200, { ok: true, ...(await pointStore.missions(userId)) });
  }

  // v1.7.20 the caller's achievements (one-time lifetime rewards from the existing match record). Reading
  // also pays anything already earned but unpaid, once; nothing in the request can choose an achievement.
  if (pathname === '/api/achievements' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`achievements:${account}`, 60, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const { view, granted } = await syncAchievements(recordIdentity(session), account);
    return sendJson(res, 200, { ok: true, ...view, granted: granted.map(item => ({ id: item.id, title: item.title, amount: item.amount })) });
  }

  // v1.7.30 skins. The catalog, prices and which slot a skin fits come only from lib/skins.js; a request names a
  // skin id and nothing else. Buying pays the whole price from the balance once (ledger `skin_purchase`); equipping
  // needs ownership. Equipped skins are shared with the room by the server, so everyone sees the same thing.
  if (pathname === '/api/skins' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`skins:${account}`, 60, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const state = await pointStore.skinState(account);
    const { balance } = await pointStore.getAccount(account);
    const dexTitles = IslandFishing.titlesFor(IslandFishing.collectionCount(await pointStore.dexOf(account))).map(({ id, name }) => ({ id, name })); // v1.10.42 도감 칭호
    dexTitles.unshift(...heldWeeklyTitles(account)); // v1.10.89 낚시왕 · v1.10.90 제초왕 (this week)
    return sendJson(res, 200, { ok: true, catalog: catalogView(), owned: state.owned, equipped: state.equipped, balance, avatar: lookFor(account, state.equipped), champion: isChampion(account), hoguking: isHoguking(account), delinquent: taxDebt.get(account) > 0, debt: taxDebt.get(account) || 0, dexTitles });
  }

  // v1.10.91 변신 의상실: every transformation on sale, mine or not, the one chosen and each one's body (current/native)
  if (pathname === '/api/transformations' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    const st = await pointStore.skinState(pointAccountForSession(session)); const owned = new Set(st.owned); const avatar = st.equipped.avatar || {};
    const list = SkinCatalog.SKINS.filter((s) => s.slot === 'transform').map((s) => { const c = transformationById(s.transform);
      return { skinId: s.id, character: s.transform, name: s.name, price: s.price, ip: s.ip || null, owned: owned.has(s.id), chosen: avatar.transform === s.id,
        modes: c ? Object.keys(c.variants || {}) : [], mode: avatar[`transformation_${s.transform}`] || c?.defaultVariant || null }; });
    return sendJson(res, 200, { ok: true, list });
  }
  if (pathname === '/api/skins/buy' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`skinbuy:${account}`, 20, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const skin = skinById(body.skinId);
    if (!skin) return sendError(res, 404, 'SKIN_NOT_FOUND', '판매 중인 스킨이 아닙니다.');
    const result = await pointStore.buySkin({ userId: account, skinId: skin.id, price: skin.price, title: `${skin.name} · ${skin.tierLabel}` });
    if (result.reason === 'insufficient') return sendError(res, 409, 'INSUFFICIENT_POINTS', `포인트가 부족합니다. ${skin.price.toLocaleString('ko-KR')}P가 필요합니다.`, { balance: result.balance, price: skin.price });
    if (result.applied) notifyPointsChanged([account]);
    // Already owned is a normal answer (nothing charged), never an error.
    return sendJson(res, 200, { ok: true, skinId: skin.id, purchased: result.applied, owned: true, balance: result.balance });
  }

  // 3-1 스킨 선물 (사용자 2026-10-19 「선물 허용으로」「우체국으로 쪽지 오는걸로」): at the shop, for anyone with an account
  // (the 우체통's list): I pay, it is theirs, and a note says so in their 우체통 (it does not count against my letters)
  if (pathname === '/api/skins/gift/check' && req.method === 'POST') { // (the form, as a recipient is picked: 「이미 가지고 있어요」)
    const session = requireSession(req, res); if (!session) return;
    const body = await parseJson(req); const skin = skinById(body.skinId); const key = await accessStore.get(String(body.to || ''));
    if (!skin || !key || key.revokedAt || key.pendingAt) return sendError(res, 404, 'RECIPIENT_NOT_FOUND', '받는 사람을 찾을 수 없습니다.');
    return sendJson(res, 200, { ok: true, owned: (await pointStore.skinState(`guest:${key.id}`)).owned.includes(skin.id), giftable: !(SkinCatalog.IP_SKIN_IDS.includes(skin.id) || skin.ip) });
  }
  if (pathname === '/api/skins/gift' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`skingift:${account}`, 10, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req); const skin = skinById(body.skinId); const requestId = String(body.requestId || '');
    if (!skin) return sendError(res, 404, 'SKIN_NOT_FOUND', '판매 중인 스킨이 아닙니다.');
    if (SkinCatalog.IP_SKIN_IDS.includes(skin.id) || skin.ip) return sendError(res, 403, 'NOT_GIFTABLE', 'IP 스킨은 선물할 수 없어요.'); // (they may be taken back and refunded later)
    if (!/^[A-Za-z0-9-]{8,64}$/.test(requestId)) return sendError(res, 400, 'BAD_GIFT', '다시 시도해 주세요.');
    const key = await accessStore.get(String(body.to || '')); const to = key ? `guest:${key.id}` : null;
    if (!key || key.revokedAt || key.pendingAt || to === account) return sendError(res, 404, 'RECIPIENT_NOT_FOUND', '받는 사람을 찾을 수 없습니다.');
    // the day's count and this request taken first (two at once cannot both slip under it; the same request is paid once)
    const day = kstDate(nowMs()); const cap = Economy.value('gift:skinPerDay');
    const reserved = await pointStore.questApply(account, 'skinGifts', (d) => {
      const today = d.day === day ? d : { day, n: 0, ids: [] };
      if ((today.ids || []).includes(requestId)) return { doc: today, already: true };
      if (today.n >= cap) return null;
      return { doc: { day, n: today.n + 1, ids: [...(today.ids || []), requestId].slice(-50) } };
    });
    if (!reserved?.doc) return sendError(res, 409, 'GIFT_LIMIT', `스킨 선물은 하루 ${cap}번까지 할 수 있어요.`);
    if (reserved.already) return sendJson(res, 200, { ok: true, skinId: skin.id, to: key.label, already: true });
    const giveBack = () => pointStore.questApply(account, 'skinGifts', (d) => (d.day === day && (d.ids || []).includes(requestId) ? { doc: { ...d, n: Math.max(0, d.n - 1), ids: d.ids.filter((x) => x !== requestId) } } : null)).catch(() => {});
    if ((await pointStore.skinState(to)).owned.includes(skin.id)) { await giveBack(); return sendError(res, 409, 'ALREADY_OWNED', `${key.label}님은 이미 가지고 있어요.`); }
    const note = Together.letterText(body.text || '') || '';
    const result = await pointStore.giftSkin({ userId: account, to, skinId: skin.id, price: skin.price, title: `선물 ${skin.name} → ${key.label}` });
    if (result.reason) await giveBack();
    if (result.reason === 'insufficient') return sendError(res, 409, 'INSUFFICIENT_POINTS', `포인트가 부족합니다. ${skin.price.toLocaleString('ko-KR')}P가 필요합니다.`, { balance: result.balance, price: skin.price });
    if (result.reason === 'owned') return sendError(res, 409, 'ALREADY_OWNED', `${key.label}님은 이미 가지고 있어요.`);
    notifyPointsChanged([account]);
    const now = nowMs(); const fromName = String(session.label || (session.role === 'admin' ? '관리자' : '게스트')).slice(0, 24);
    const letter = { id: requestId, from: session.guestKeyId || 'admin', fromName, text: note || `${skin.name}을(를) 선물했어요!`, itemId: null, skinId: skin.id, skinName: skin.name, at: now, read: false };
    await pointStore.questApply(to, 'mail', (d) => ((d.letters || []).some((l) => l.id === letter.id) ? null : { doc: { ...d, letters: Together.withLetter(d.letters, letter, now) } }));
    notifyAccount(to, 'mail', { from: fromName }); notifyAccount(to, 'skins', {});
    return sendJson(res, 200, { ok: true, skinId: skin.id, to: key.label, balance: result.balance });
  }

  if (pathname === '/api/skins/equip' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`skinequip:${account}`, 60, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    let game; let slot; let skinId = null;
    if (body.skinId !== null && body.skinId !== undefined) {
      const skin = skinById(body.skinId);
      if (!skin) return sendError(res, 404, 'SKIN_NOT_FOUND', '판매 중인 스킨이 아닙니다.');
      ({ family: game, slot, id: skinId } = skin);
    } else { // taking a slot's skin off: name the game and slot
      game = String(body.game || '');
      slot = String(body.slot || '');
      if (!FAMILY_NAMES[game] || !SKIN_SLOTS.includes(slot)) return sendError(res, 400, 'BAD_SKIN_SLOT', '게임과 칸을 확인해 주세요.');
    }
    const result = await pointStore.equipSkin({ userId: account, game, slot, skinId });
    if (!result.ok) return sendError(res, 409, 'SKIN_NOT_OWNED', '먼저 구매해야 장착할 수 있습니다.');
    equippedSkinCache.set(account, result.equipped);
    const room = getCurrentRoom(session);
    if (room) broadcast(room); // the room sees the change at once
    return sendJson(res, 200, { ok: true, equipped: result.equipped, avatar: lookFor(account, result.equipped) });
  }

  // Existing character parts unlock a free body choice; the store checks the owned full set atomically.
  if (pathname === '/api/avatar/transformation' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`transformation:${account}`, 60, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const character = transformationById(body?.characterId);
    if (!character) return sendError(res, 404, 'TRANSFORMATION_NOT_FOUND', '사용할 수 없는 캐릭터입니다.');
    if (!transformationModeAllowed(character, body?.mode)) return sendError(res, 400, 'BAD_TRANSFORMATION_MODE', '사용할 수 없는 체형입니다.');
    const result = await pointStore.setAvatarTransformation({ userId: account, characterId: character.id, mode: body.mode });
    if (!result.ok) return sendError(res, 409, result.reason === 'not-owned' ? 'SKIN_NOT_OWNED' : 'TRANSFORMATION_INCOMPLETE', '변신을 먼저 골라 주세요.'); // v1.10.91: chosen at the 변신 NPC
    equippedSkinCache.set(account, result.equipped);
    await loadEquippedSkins(account);
    const equipped = equippedSkinCache.get(account) || result.equipped;
    const avatar = lookFor(account, equipped);
    for (const entry of plazaPresence.values()) if (entry.account === account) {
      entry.look = avatar.look; entry.title = avatar.title; plazaDirty = true;
    }
    const room = getCurrentRoom(session);
    if (room) broadcast(room);
    return sendJson(res, 200, { ok: true, equipped, avatar });
  }

  // v1.9.2 광장 칭호: the name of an owned legend skin shown under the player's name in the plaza (null takes it off).
  // v1.10.3 첫 접속 성별 선택: once per account; a second, different choice is refused (the first one stays).
  if (pathname === '/api/avatar/gender' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`gender:${account}`, 20, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    if (body.gender !== 'male' && body.gender !== 'female') return sendError(res, 400, 'BAD_GENDER', '남자 또는 여자를 선택해 주세요.');
    const result = await pointStore.setAvatarGender({ userId: account, gender: body.gender });
    equippedSkinCache.set(account, result.equipped);
    if (!result.chosen && result.gender !== body.gender) return sendError(res, 409, 'GENDER_FIXED', '이미 선택한 성별은 바꿀 수 없습니다.');
    return sendJson(res, 200, { ok: true, gender: result.gender, avatar: lookFor(account, result.equipped) });
  }

  // v1.10.30 성형외과·염색사: what can be chosen and what it costs; a paid change of one face part or one item's colour,
  // once per request (a retry returns the first answer), refused without charge when the points are short
  if (pathname === '/api/avatar/look-shop' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    return sendJson(res, 200, { ok: true, surgeryFee: SURGERY_FEE, dyeFee: DYE_FEE, faceParts: Object.fromEntries(Object.entries(FACE_PARTS).map(([part, list]) => [part, { label: FACE_LABELS[part], designs: list.map(([id, name]) => ({ id, name, image: `/assets/shop/faces/${part}_${id}.webp` })) }])),
      palette: DYE_PALETTE, dyeable: [...DYEABLE], bodyDyes: BODY_DYES, skinTones: SKIN_TONES });
  }
  if ((pathname === '/api/avatar/surgery' || pathname === '/api/avatar/dye') && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (!session.guestKeyId) return sendError(res, 403, 'GUEST_ONLY', '관리자는 외형을 바꿀 수 없습니다.');
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`look:${account}`, 30, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId)) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    let plan;
    if (pathname === '/api/avatar/surgery') {
      const design = faceDesign(body.part, body.design);
      if (!design) return sendError(res, 400, 'BAD_FACE', '고를 수 없는 얼굴입니다.');
      plan = { kind: 'surgery', slot: `face_${body.part}`, value: `${body.part}_${design[0]}`, price: SURGERY_FEE, title: `${FACE_LABELS[body.part]} · ${design[1]}` };
    } else if (Object.prototype.hasOwnProperty.call(BODY_DYES, body.itemId)) { // v1.10.35: the base hair, the eyes, the skin
      const color = body.color === null ? null : bodyDyeColor(body.itemId, body.color);
      if (body.color !== null && !color) return sendError(res, 400, 'BAD_COLOR', '고를 수 없는 색입니다.');
      plan = { kind: 'dye', slot: `dye_${body.itemId}`, value: color ? color.id : null, price: color ? DYE_FEE : 0, title: `${BODY_DYES[body.itemId]} · ${color ? color.name : '기본색'}` };
    } else {
      const skin = skinById(body.itemId);
      if (!skin || skin.family !== 'avatar' || !DYEABLE.has(skin.id)) return sendError(res, 400, 'NOT_DYEABLE', '염색할 수 없는 꾸미기입니다.');
      const color = body.color === null ? null : dyeColor(body.color);
      if (body.color !== null && !color) return sendError(res, 400, 'BAD_COLOR', '고를 수 없는 색입니다.');
      const owned = (await pointStore.skinState(account)).owned || [];
      if (!owned.includes(skin.id)) return sendError(res, 409, 'SKIN_NOT_OWNED', '보유한 꾸미기만 염색할 수 있습니다.');
      plan = { kind: 'dye', slot: `dye_${skin.id}`, value: color ? color.id : null, price: color ? DYE_FEE : 0, title: `${skin.name} · ${color ? color.name : '기본색'}` };
    }
    const result = await pointStore.chargeLook({ userId: account, requestId: body.requestId, ...plan });
    if (result.reason === 'insufficient') return sendError(res, 409, 'INSUFFICIENT_POINTS', '보유 포인트가 부족합니다.');
    if (!result.applied && (result.userId !== account || result.slot !== plan.slot)) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    const equipped = result.equipped || (await pointStore.skinState(account)).equipped;
    equippedSkinCache.set(account, equipped);
    if (result.applied) notifyPointsChanged([account]);
    return sendJson(res, 200, { ok: true, balance: result.balance ?? result.balanceAfter, equipped, avatar: lookFor(account, equipped) });
  }

  if (pathname === '/api/skins/title' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`skinequip:${account}`, 60, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    let skinId = null; let free = false;
    const dexTitle = IslandFishing.dexTitle(body.skinId); // v1.10.42: a 도감 title, worn in the same slot once its finds are in
    const weekly = weeklyTitleOf(body.skinId);
    if (weekly) { // v1.10.89 낚시왕 · v1.10.90 제초왕: this week's holder only
      if (!holdsWeekly(weekly[0], account)) return sendError(res, 409, 'SKIN_NOT_OWNED', `이번 주 ${weekly[1].name}만 쓸 수 있는 칭호입니다.`);
      skinId = weekly[1].title; free = true;
    } else if (dexTitle) {
      if (IslandFishing.collectionCount(await pointStore.dexOf(account)) < dexTitle.need) return sendError(res, 409, 'SKIN_NOT_OWNED', '도감을 더 채우면 쓸 수 있는 칭호입니다.');
      skinId = dexTitle.id; free = true;
    } else if (body.skinId !== null && body.skinId !== undefined) {
      const skin = skinById(body.skinId);
      if (!skin || skin.tier !== 'legend' || skin.family === 'avatar') return sendError(res, 404, 'SKIN_NOT_FOUND', '칭호로 쓸 수 있는 전설 스킨이 아닙니다.');
      skinId = skin.id;
    }
    const result = await pointStore.equipSkin({ userId: account, game: 'avatar', slot: 'title', skinId, free });
    if (!result.ok) return sendError(res, 409, 'SKIN_NOT_OWNED', '보유한 전설 스킨만 칭호로 쓸 수 있습니다.');
    equippedSkinCache.set(account, result.equipped);
    return sendJson(res, 200, { ok: true, equipped: result.equipped, avatar: lookFor(account, result.equipped) });
  }

  const eventClaimMatch = pathname.match(/^\/api\/events\/([a-z0-9_]{3,60})\/claim$/);
  if (eventClaimMatch && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const userId = pointAccountForSession(session);
    if (!checkRateLimit(`eventclaim:${userId}`, 20, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const event = eventsForAccount(userId).find(item => item.id === eventClaimMatch[1]);
    if (!event) return sendError(res, 404, 'EVENT_NOT_FOUND', '진행 중인 이벤트가 아닙니다.');
    const status = eventStatus(event, Date.now());
    if (status === 'inactive') return sendError(res, 404, 'EVENT_NOT_FOUND', '진행 중인 이벤트가 아닙니다.');
    if (status === 'upcoming') return sendError(res, 409, 'EVENT_NOT_STARTED', '아직 시작하지 않은 이벤트입니다.');
    if (status === 'ended') return sendError(res, 409, 'EVENT_ENDED', '이미 종료된 이벤트입니다.');
    if (event.notice) return sendError(res, 409, 'EVENT_NOTICE', '받을 포인트가 없는 안내입니다.'); // v1.10.33
    const outcome = await pointStore.claimEvent({ eventId: event.id, userId, amount: event.rewardPoints, title: event.title });
    if (outcome.applied) notifyPointsChanged([userId]);
    const balance = pointStore.cachedBalance(userId);
    // An already-claimed account gets a normal answer (claimed, nothing paid), never an error.
    return sendJson(res, 200, { ok: true, eventId: event.id, claimed: true, granted: outcome.applied, amount: outcome.applied ? outcome.amount : 0,
      balance, title: event.title, successMessage: event.successMessage });
  }

  // Test-only (NODE_ENV=test): deal the caller a chosen set of today's missions.
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/missions' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const account = pointAccountForSession(session);
    try { const view = await pointStore.testSetMissions(account, Array.isArray(body.ids) ? body.ids : []); rewardTestAccounts.add(account); return sendJson(res, 200, { ok: true, ...view }); }
    catch (error) { return sendError(res, 400, 'BAD_MISSIONS', error.message); }
  }

  // Test-only (NODE_ENV=test): set the caller's weekly mission counters (to reach a weekly target quickly).
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/weekly' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    const body = await parseJson(req);
    const view = await pointStore.testSetWeekly(account, body || {});
    rewardTestAccounts.add(account);
    return sendJson(res, 200, { ok: true, ...view });
  }

  // Test-only (NODE_ENV=test): opt the caller's account in to mission/achievement payouts.
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/rewards' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    rewardTestAccounts.add(pointAccountForSession(session));
    return sendJson(res, 200, { ok: true });
  }

  // Test-only (NODE_ENV=test): register an event so tests can exercise open / upcoming / ended / off
  // states; `audience: 'self'` (or `audienceKeyId`, an issued guest key) shows it to one account only, so parallel tests do not see each other's.
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/events' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    let event;
    try { event = validateEvent(body.event); } catch (error) { return sendError(res, 400, 'BAD_EVENT', error.message); }
    if (eventRegistry.some(item => item.id === event.id)) return sendError(res, 409, 'EVENT_EXISTS', '이미 등록된 이벤트입니다.');
    eventRegistry.push(event);
    if (body.audience === 'self') eventAudience.set(event.id, new Set([pointAccountForSession(session)]));
    else if (/^[0-9a-f-]{36}$/i.test(String(body.audienceKeyId))) eventAudience.set(event.id, new Set([`guest:${body.audienceKeyId}`]));
    return sendJson(res, 200, { ok: true, id: event.id });
  }

  // Test-only (NODE_ENV=test): spend a player's points down to a target through the ledger, so the
  // insufficient-entry path can be exercised. Never registered in production.
  // Test-only: credit the caller's own account (same ledger path as the operator grant, without its rate limit), so the
  // skin e2e specs can fund many throwaway accounts in parallel.
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/points-credit' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const result = await pointStore.adminGrant({ grantId: `admin-grant:${crypto.randomUUID()}`, userId: pointAccountForSession(session), amount: Number(body.amount), category: 'event', memo: '' });
    return sendJson(res, 200, { ok: true, applied: result.applied, balanceAfter: result.balanceAfter });
  }

  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/points-spend' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const result = await pointStore.testSpendTo(pointAccountForSession(session), Number(body.balance));
    return sendJson(res, 200, { ok: true, ...result });
  }

  // Test-only fault injection for the v1.7.6 recovery paths: the next `chargeAfterCommit` charges commit and
  // then fail (a dropped connection at COMMIT); the next `refundFail` refunds throw; the next `settleFail` game settlements throw.
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/points-fault' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    if (!pointStore.faults) {
      pointStore.faults = { chargeAfterCommit: 0, refundFail: 0, settleFail: 0 };
      const settle = pointStore.settle.bind(pointStore);
      pointStore.settle = async (raw) => {
        if (pointStore.faults.settleFail > 0) { pointStore.faults.settleFail -= 1; throw new Error('injected: settlement failure'); }
        return settle(raw);
      };
      const charge = pointStore.chargeEntry.bind(pointStore);
      const refund = pointStore.refundEntry.bind(pointStore);
      pointStore.chargeEntry = async (raw) => {
        const result = await charge(raw);
        if (pointStore.faults.chargeAfterCommit > 0 && result.applied) { pointStore.faults.chargeAfterCommit -= 1; throw new Error('injected: connection lost after COMMIT'); }
        return result;
      };
      pointStore.refundEntry = async (raw) => {
        if (pointStore.faults.refundFail > 0) { pointStore.faults.refundFail -= 1; throw new Error('injected: refund failure'); }
        return refund(raw);
      };
    }
    Object.assign(pointStore.faults, { chargeAfterCommit: Number(body.chargeAfterCommit) || 0, refundFail: Number(body.refundFail) || 0, settleFail: Number(body.settleFail) || 0 });
    return sendJson(res, 200, { ok: true, faults: pointStore.faults });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/expire-room' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    if (!room) return sendError(res, 404, 'NO_ROOM', '방이 없습니다.');
    expireRoom(room);
    return sendJson(res, 200, { ok: true });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/points-sweep' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    return sendJson(res, 200, { ok: true, refunded: await refundOrphanEntries('orphan-sweep') });
  }

  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/gostop-fixture' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    if (!room || !isGostop(room)) return sendError(res, 404, 'NO_GOSTOP_ROOM', '고스톱 테스트 방이 아닙니다.');
    if (findSeat(room, session.token) !== '1') return sendError(res, 403, 'TEST_SEAT', '테스트 fixture는 1번 자리에서만 설정합니다.');
    const body = await parseJson(req);
    if (!setGostopTestFixture(room, String(body.fixture || ''))) return sendError(res, 400, 'BAD_GOSTOP_FIXTURE', '알 수 없는 고스톱 테스트 fixture입니다.');
    touchRoom(room);
    broadcast(room);
    return sendJson(res, 200, { ok: true, state: roomView(room, session) });
  }

  if (pathname === '/api/session' && req.method === 'GET') {
    const session = getSession(req);
    if (!session) return sendJson(res, 200, { authenticated: false });
    return sendJson(res, 200, { authenticated: true, role: session.role, label: session.label, hasRoom: Boolean(getCurrentRoom(session)) });
  }

  if (pathname === '/api/session/heartbeat' && req.method === 'POST') {
    const session = getSession(req, { touch: false });
    if (!session) return sendError(res, 401, 'AUTH_REQUIRED', '입장 권한이 없습니다.');
    const body = await parseJson(req).catch(() => ({}));
    if (sessions.get(session.token) !== session) return sendError(res, 401, 'AUTH_REQUIRED', '입장 권한이 없습니다.');
    const page = String(body.page || '').slice(0, 64);
    const sequence = Number.isSafeInteger(body.sequence) && body.sequence > 0 ? body.sequence : 0;
    if ((sequence && sequence < (session.leaseSequence || 0)) || (page && page !== session.leasePage && session.leasePages?.has(page))) return sendError(res, 409, 'PAGE_REPLACED', '새 페이지에서 이어 하고 있습니다.');
    if (page && session.closedLeasePages?.has(page)) return sendError(res, 409, 'PAGE_CLOSED', '닫힌 페이지입니다.');
    session.lastSeen = session.leaseSeenAt = nowMs();
    if (sequence) session.leaseSequence = sequence;
    if (page) { session.leasePage = page; (session.leasePages ||= new Set()).add(page); }
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/session/input' && req.method === 'POST') { // v1.10.35: see INPUT_IDLE_MS
    const session = requireSession(req, res);
    if (!session) return;
    session.lastInput = nowMs();
    return sendJson(res, 200, { ok: true });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/input-idle' && req.method === 'POST') { // as if 30 minutes passed
    const session = requireSession(req, res);
    if (!session) return;
    session.lastInput = nowMs() - INPUT_IDLE_MS - 1000;
    sweepInputIdle();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/session/release' && req.method === 'POST') {
    const body = await parseJson(req);
    const token = String(body.sessionToken || '');
    if (token) requestSessionRelease(token, String(body.page || '').slice(0, 64), Number.isSafeInteger(body.sequence) && body.sequence > 0 ? body.sequence : 0);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const session = getSession(req, { touch: false });
    if (session) releaseSessionToken(session.token, { voluntary: true });
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/lobby/chat' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (getCurrentRoom(session)) return sendError(res, 409, 'IN_ROOM', '게임 방에서는 방 채팅을 이용해 주세요.');
    const key = 'lobby-chat:' + session.token.slice(0, 12);
    if (!checkRateLimit(key, 6, 5 * 1000)) return sendError(res, 429, 'CHAT_RATE_LIMIT', '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 보내 주세요.');
    const body = await parseJson(req);
    const text = String(body.text || '').trim();
    if (!text) return sendError(res, 400, 'EMPTY_CHAT', '메시지를 입력해 주세요.');
    if (text.length > MAX_CHAT_LENGTH) return sendError(res, 400, 'CHAT_TOO_LONG', '채팅은 ' + MAX_CHAT_LENGTH + '자까지 입력할 수 있습니다.');
    Object.assign(appendChatMessage(lobbySocial, session, text, chatIdFor(session)), chatAudience(session)); // v1.10.82
    trimLobbyMessages();
    broadcastLobby();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/lobby/events' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    noteVisit(pointAccountForSession(session)); // (7일 이상 안 들어오면 이자 없음)
    if (getCurrentRoom(session)) return sendError(res, 409, 'IN_ROOM', '현재 게임 방에 참여 중입니다.');
    res.writeHead(200, securityHeaders({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }));
    res.write(': connected\n\n');
    const entry = { res, sessionToken: session.token };
    lobbyStreams.add(entry);
    broadcastLobby();
    sseWrite(res, 'announcements', { items: await announcementStore.list() });
    sseWrite(res, 'plaza', plazaSnapshot()); // who is already in the plaza (v1.9.3)
    sseWrite(res, 'statues', statueSnapshot()); // v1.10.5: the donation statues on show

    const heartbeat = setInterval(() => {
      const current = sessions.get(session.token);
      if (!current || current.currentRoomId) {
        try { res.end(); } catch {}
        clearInterval(heartbeat);
        return;
      }
      current.lastSeen = nowMs(); noteVisit(pointAccountForSession(current)); // (a day on, still here: in today -- Codex review)
      if (current.guestKeyId) current.leaseSeenAt = current.lastSeen;
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      lobbyStreams.delete(entry);
      if (![...lobbyStreams].some(other => other.sessionToken === session.token)) dropPlazaPresence(session.token);
      broadcastLobby();
    });
    return;
  }

  // v1.9.3 광장: my pose in the plaza (only from the lobby). The look and title come from my equipped skins on the
  // server, the name from my session; a request carries numbers only.
  if (pathname === '/api/plaza/state' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (getCurrentRoom(session)) return sendError(res, 409, 'IN_ROOM', '현재 게임 방에 참여 중입니다.');
    if (!checkRateLimit(`plaza:${session.token}`, 900, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const generation = session.plazaGeneration || 0;
    const body = await parseJson(req);
    if (sessions.get(session.token) !== session) return sendError(res, 401, 'AUTH_REQUIRED', '입장 권한이 없습니다.');
    if (getCurrentRoom(session) || generation !== (session.plazaGeneration || 0)) return sendError(res, 409, 'PLAZA_LEFT', '광장을 떠났습니다.');
    const num = (value, limit) => (Number.isFinite(Number(value)) ? Math.max(-limit, Math.min(limit, Number(value))) : 0);
    session.plazaId ||= crypto.randomUUID().slice(0, 8);
    const account = pointAccountForSession(session);
    const { look, title, delinquent } = lookFor(account, equippedSkinCache.get(account));
    const collecting = [resourcePulls.get(session.token), weedPulls.get(session.token)].find(p => p && !p.result && nowMs() - p.at < 15000);
    if (!collecting) { const r=resourcePulls.get(session.token); if(r && nowMs()-r.at>15000) resourcePulls.delete(session.token); const w = weedPulls.get(session.token); if (w && !w.result) weedPulls.delete(session.token); }
    const wanted = { x: Math.round(num(body.x, PLAZA_BOUND) * 100) / 100, z: Math.round(num(body.z, PLAZA_BOUND) * 100) / 100 };
    trainService();
    const ride = trainRiders.get(session.token); // v1.10.47: on the train, I am where its seat is (the clock says), not where I say
    const platform = trainVisitors.get(session.token) || null;
    let spot;
    if (ride) {
      const q = IslandTrain.seatAt(ride.id, ride.seat, trainNow()); spot = { x: Math.round(q.x * 100) / 100, z: Math.round(q.z * 100) / 100 };
      const from = IslandTrain.stationOf(ride.from).spot; plazaLastPos.set(session.token, { x: from.x, z: from.z }); notePlazaSpot(account, from.x, from.z); // a visit cut off mid-ride comes back at that stop
    } else if (furnitureInside.has(session.token)) { // 묶음 2 가구점 (as the 1st floor)
      const here = plazaPresence.get(session.token);
      spot = IslandFurniture.inRoom(Number(body.x), Number(body.z), 2) || !here ? IslandFurniture.clamp(body.x, body.z) : { x: here.x, z: here.z };
      Object.assign(wanted, IslandFurniture.clamp(body.x, body.z));
      plazaLastPos.set(session.token, IslandTerrain.facilityDoor('store'));
    } else if (storeInside.has(session.token)) { // v1.10.92 (as the 민원실 below)
      const here = plazaPresence.get(session.token);
      spot = IslandStore.inStore(Number(body.x), Number(body.z), 2) || !here ? IslandStore.clamp(body.x, body.z) : { x: here.x, z: here.z };
      Object.assign(wanted, IslandStore.clamp(body.x, body.z));
      plazaLastPos.set(session.token, IslandTerrain.facilityDoor('store'));
    } else if (townhallInside.has(session.token)) {
      // a pose from before going in (still on the island) arrives late: where I am stays (it never drags me to a wall)
      const here = plazaPresence.get(session.token);
      spot = IslandTerrain.inRoom(Number(body.x), Number(body.z), 2) || !here ? IslandTerrain.roomClamp(body.x, body.z) : { x: here.x, z: here.z };
      Object.assign(wanted, IslandTerrain.roomClamp(body.x, body.z)); // (the room is past the island's bound: 'corrected' only when it really moved me)
      plazaLastPos.set(session.token, IslandTerrain.facilityDoor('townhall')); // a visit cut off inside comes back at the hall's door
    } else if (platform) {
      spot = IslandTrain.platformClamp(platform.line, platform.station, wanted.x, wanted.z);
      const entry = IslandTrain.stationOf(platform.station).spot; plazaLastPos.set(session.token, entry); notePlazaSpot(account, entry.x, entry.z);
    } else {
      const late = IslandTerrain.inRoom(Number(body.x), Number(body.z), 2) && plazaPresence.get(session.token); // v1.10.84: a pose from the room after going out
      spot = late ? { x: late.x, z: late.z } : collecting ? collecting.pos : plazaSeparate(session.token, wanted.x, wanted.z, plazaPresence.get(session.token) || plazaLastPos.get(session.token));
      if (IslandTerrain.inTownhallYard(spot.x, spot.z) && !passesGate(session)) spot = { ...TOWNHALL_GATE_OUT }; // v1.10.41: not let in yet
      plazaLastPos.set(session.token, spot);
      notePlazaSpot(account, spot.x, spot.z);
    }
    const receivedAt = nowMs();
    const poseAt = poseTime(body.t, plazaPresence.get(session.token)?.poseAt, receivedAt);
    if (!petOf.has(account)) { petOf.set(account, null); pointStore.questDoc(account, 'pet').then(({ doc }) => { if (PET_KINDS.includes(doc.kind)) { petOf.set(account, { kind: doc.kind, name: String(doc.name || '').slice(0, 10) }); plazaDirty = true; } }).catch(() => petOf.delete(account)); }
    plazaPresence.set(session.token, {
      pet: petOf.get(account) || null, id: session.plazaId, chatId: chatIdFor(session), account, champion: isChampion(account), hoguking: isHoguking(account), delinquent: Boolean(delinquent), name: String(session.label || (session.role === 'admin' ? '관리자' : '게스트')).slice(0, 24), look, title,
      x: spot.x, z: spot.z,
      yaw: Math.round(num(body.yaw, 10) * 100) / 100, moving: !collecting && body.moving === true, at: receivedAt, poseAt,
      carry: islandEvents.carryOf(account), // v1.10.32 운반: a lost thing in their hands (the server's own record)
      platform, ride: ride ? { id: ride.id, seat: ride.seat } : null, // v1.10.47
      space: townhallInside.has(session.token) ? 'townhall' : furnitureInside.has(session.token) ? 'furniture' : storeInside.has(session.token) ? 'store' : 'island', // v1.10.84, v1.10.92, 묶음 2
      // v1.10.44: what they are doing (sitting on the seat they hold, a wave or a cheer -- actN tells a new one)
      ...(() => { if (collecting) return { act: collecting.anim, actN: collecting.at, actAt: collecting.at, actMs: collecting.ms, actTarget: collecting.target || null, seat: null };
        const fishing = fishActOf(session.token, body.act) || showActOf(session.token, body.act); if (fishing) return { ...fishing, actN: Number.isSafeInteger(body.actN) ? body.actN : 0, seat: null }; // v1.10.89, v1.10.92 show
        const act = PLAZA_ACTS.has(body.act) ? body.act : null; const seat = act === 'sit' && seatTaken.get(body.seat) === session.token ? body.seat : null;
        // (a seat is let go only by /api/island/stand, another seat or leaving: a pose sent just before the sit may arrive after it)
        return { act: act === 'sit' && !seat ? null : act, actN: Number.isSafeInteger(body.actN) && body.actN >= 0 ? body.actN : 0, seat }; })(),
    });
    plazaDirty = true;
    const corrected = !ride && (spot.x !== wanted.x || spot.z !== wanted.z);
    const quests = questEntries(account); // v1.10.37 연계 퀘스트
    if (quests.track.some((t) => !t.ready && t.to && Math.hypot(t.to.x - spot.x, t.to.z - spot.z) <= 4.5)) islandProgress('at', account, 1, { x: spot.x, z: spot.z });
    return sendJson(res, 200, { ok: true, id: session.plazaId, x: spot.x, z: spot.z, corrected, townhallPass: passesGate(session), ride: ride ? { id: ride.id, seat: ride.seat } : null, platform, trainShift, trainService: trainService(), events: [...islandEvents.nearby(spot.x, spot.z, account), ...quests.entries], residents: islandEvents.residents(), quests: quests.track, now: nowMs() }); // v1.10.11: the events near me; v1.10.12: the server clock (islanders)
  }
  // v1.9.4 상시 등반 도전 ------------------------------------------------------------------------------------
  if (pathname === '/api/climb' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`climbview:${account}`, 60, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const now = nowMs();
    await settleClimbWeeks(now);
    const status = await pointStore.climbStatus(account, now);
    return sendJson(res, 200, { ok: true, ...status, ranking: await climbRankingView(climbWeekOf(now), account), active: climbView(climbs.get(account)),
      champions: { week: championCache.week, names: championCache.names }, champion: isChampion(account, now) });
  }
  if (pathname === '/api/climb/start' && req.method === 'POST') { // start, or resume the climb in progress
    const session = requireSession(req, res);
    if (!session) return;
    if (getCurrentRoom(session)) return sendError(res, 409, 'IN_ROOM', '현재 게임 방에 참여 중입니다.');
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`climbstart:${account}`, 30, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const now = nowMs();
    let climb = climbs.get(account);
    if (!climb || body.restart === true) {
      climb = { id: crypto.randomUUID(), state: ClimbSim.newState(), startedAt: now, credit: CLIMB_BURST_TICKS };
      climbs.set(account, climb);
    }
    Object.assign(climb, { token: session.token, name: String(session.label || (session.role === 'admin' ? '관리자' : '게스트')).slice(0, 24), lastAt: now });
    return sendJson(res, 200, { ok: true, active: climbView(climb) });
  }
  if (pathname === '/api/climb/input' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    const climb = climbs.get(account);
    if (!climb || climb.token !== session.token) return sendError(res, 409, 'CLIMB_NOT_ACTIVE', '진행 중인 등반이 없습니다.');
    if (!checkRateLimit(`climbinput:${session.token}`, 2400, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const now = nowMs();
    // A token bucket of ticks: real time earns 30 a second (up to a 3 second burst), so inputs can never run the
    // climb faster than real time. A batch that does not start at the server's tick is ignored (the client resyncs).
    climb.credit = Math.min(CLIMB_BURST_TICKS, climb.credit + ((now - climb.lastAt) / 1000) * ClimbSim.TICKS_PER_SECOND);
    climb.lastAt = now;
    const inputs = Array.isArray(body.inputs) ? body.inputs : [];
    if (Number(body.tick) === climb.state.tick) {
      const n = Math.min(inputs.length, CLIMB_MAX_BATCH, Math.floor(climb.credit));
      for (let i = 0; i < n; i += 1) ClimbSim.step(climb.state, (Number(inputs[i]) | 0) & 31);
      climb.credit -= n;
    }
    return sendJson(res, 200, { ok: true, state: climb.state, others: climbOthers(account, climb, now) });
  }
  if (pathname === '/api/climb/end' && req.method === 'POST') { // confirm the record: the altitude where I stand now
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    const climb = climbs.get(account);
    if (!climb || climb.token !== session.token) return sendError(res, 409, 'CLIMB_NOT_ACTIVE', '진행 중인 등반이 없습니다.');
    if (!ClimbSim.isSafe(climb.state)) return sendError(res, 409, 'CLIMB_NOT_SAFE', '발판 위에 멈춰 선 뒤에 끝낼 수 있습니다.');
    const now = nowMs(); // one clock reading for this whole finish (day and week of the record)
    const altitude = ClimbSim.altitude(climb.state);
    const outcome = await pointStore.recordClimb({ userId: account, climbId: climb.id, altitude, name: climb.name }, now);
    if (climbs.get(account) === climb) climbs.delete(account);
    if (outcome.delta > 0) notifyPointsChanged([account]);
    return sendJson(res, 200, { ok: true, altitude: outcome.altitude, delta: outcome.delta, best: outcome.best, paid: outcome.paid, weekBest: outcome.weekBest, balance: outcome.balance });
  }
  if (pathname === '/api/climb/abandon' && req.method === 'POST') { // leave without a record
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    const climb = climbs.get(account);
    if (climb && climb.token === session.token) climbs.delete(account);
    return sendJson(res, 200, { ok: true });
  }
  // Test-only (NODE_ENV=test): stand my climber on the static platform nearest below a height (to test records
  // without climbing 3,000 m by hand).
  // Test-only: a record made at a chosen time (as if a climb ended then), and a settlement run at a chosen time.
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/climb/record' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const outcome = await pointStore.recordClimb({ userId: pointAccountForSession(session), climbId: crypto.randomUUID(), altitude: Number(body.altitude), name: session.label || '' }, Number(body.at) || nowMs());
    return sendJson(res, 200, { ok: true, ...outcome });
  }
  // v1.10.10 이벤트 인벤토리: my island bag, and handing its things in at the central town hall or the shop-street
  // trader. The server holds the counts; selling needs me standing at that place (my last island position).
  if (pathname === '/api/island/bag' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    return sendJson(res, 200, { ok: true, ...await pointStore.islandBag(pointAccountForSession(session), islandEvents.activeLost()), dailyCap: IslandItems.DAILY_CAP });
  }
  // v1.10.84 관공서 실내: SPACE at the hall's door (in the yard, past the mayor) goes in; at the room's door, out to the
  // hall's door. The server moves the position itself, so a pose can never put anyone in or out.
  // v1.10.92 잡화점: in at the store's door, out at the room's; the shelves (each good, its price -- seeds and the like
  // shown, not sold yet); a good bought where it stands (in the room, within reach of it), paid and in the bag at once
  if ((pathname === '/api/island/store/enter' || pathname === '/api/island/store/leave') && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const at = plazaPresence.get(session.token); if (!at) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    const entering = pathname.endsWith('/enter'); const R = IslandStore.ROOM;
    if (entering) {
      const door = IslandTerrain.facilityDoor('store');
      if (storeInside.has(session.token) || townhallInside.has(session.token)) return sendError(res, 409, 'ALREADY_INSIDE', '이미 안에 있습니다.');
      if (trainRiders.has(session.token) || trainVisitors.has(session.token) || Math.hypot(at.x - door.x, at.z - door.z) > 2.6) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
      freeSeat(session.token); storeInside.add(session.token);
    } else {
      const exit = IslandStore.world(R.exit.lx, R.exit.lz);
      if (!storeInside.has(session.token) || Math.hypot(at.x - exit.x, at.z - exit.z) > 2.4) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
      storeInside.delete(session.token);
    }
    const spot = entering ? IslandStore.world(R.entry.lx, R.entry.lz) : IslandTerrain.facilityDoor('store');
    plazaPresence.set(session.token, { ...at, x: Math.round(spot.x * 100) / 100, z: Math.round(spot.z * 100) / 100, space: entering ? 'store' : 'island', moving: false, at: nowMs(), act: null, seat: null });
    plazaDirty = true;
    return sendJson(res, 200, { ok: true, space: entering ? 'store' : 'island', x: Math.round(spot.x * 100) / 100, z: Math.round(spot.z * 100) / 100 });
  }
  // 묶음 2 가구점: the lift -- up from in front of the 1st floor's, down from in front of the 2nd floor's
  if ((pathname === '/api/island/furniture/up' || pathname === '/api/island/furniture/down') && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const at = plazaPresence.get(session.token); const up = pathname.endsWith('/up');
    const from = up ? IslandStore.world(...IslandStore.LIFT.stand) : IslandFurniture.world(...IslandFurniture.LIFT.stand);
    if (!at || !storeInside.has(session.token) || furnitureInside.has(session.token) === up || Math.hypot(at.x - from.x, at.z - from.z) > 2.6) return sendError(res, 409, 'TOO_FAR', '승강기 앞에서 다시 시도해 주세요.');
    if (up) furnitureInside.add(session.token); else furnitureInside.delete(session.token);
    const spot = up ? IslandFurniture.world(...IslandFurniture.LIFT.stand) : IslandStore.world(...IslandStore.LIFT.stand);
    plazaPresence.set(session.token, { ...at, x: spot.x, z: spot.z, space: up ? 'furniture' : 'store', moving: false, at: nowMs(), act: null, seat: null });
    plazaDirty = true;
    return sendJson(res, 200, { ok: true, space: up ? 'furniture' : 'store', x: spot.x, z: spot.z });
  }
  // the day's display (and what is sold), the always-on-sale ones, my buys today
  if (pathname === '/api/island/furniture' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    return sendJson(res, 200, { ok: true, ...furnitureView(await furnitureDay(), pointAccountForSession(session)) });
  }
  // a piece bought where it stands (on the 2nd floor, by it): the first one only -- the next hears it was just sold and
  // pays nothing -- three of the display a day each; it goes to my storage (가구 창고) and from every screen at once
  if (pathname === '/api/island/furniture/buy' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const body = await parseJson(req); const at = plazaPresence.get(session.token);
    const place = at && furnitureInside.has(session.token) ? IslandFurniture.placeAt(at.x, at.z) : null;
    if (!place || place.id !== body.slot) return sendError(res, 409, 'TOO_FAR', '가구 가까이 가서 다시 시도해 주세요.');
    const account = pointAccountForSession(session); const base = Boolean(place.good);
    if (base && (typeof body.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId))) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    return worldEdit(async () => {
      const st = await furnitureDay(); const id = base ? place.good : IslandFurniture.displayOf(st.day)[place.id]; const g = IslandFurniture.good(id);
      if (!base && st.sold[place.id]) return sendError(res, 409, 'SOLD', '방금 팔렸어요. 내일 새 가구가 들어와요.');
      if (!base && (st.buys[account] || 0) >= Economy.value('furniture:perDay')) return sendError(res, 429, 'FURNITURE_DAY_LIMIT', `전시 가구는 하루 ${Economy.value('furniture:perDay')}점까지 살 수 있어요.`);
      const owned = (await pointStore.worldValue(`furniture:${account}`)) || [];
      if (owned.length >= 300) return sendError(res, 409, 'STORAGE_FULL', '가구 창고가 가득 찼어요.');
      const price = Economy.value(base ? 'furniture:base' : `furniture:${g.rarity}`);
      const claimId = base ? `furniture:base:${body.requestId}` : `furniture:${st.day}:${place.id}:${account}`;
      let out; try { out = await pointStore.charge({ userId: account, claimId, price, title: `가구점 · ${g.name}` }); } catch { return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.'); }
      if (out.reason === 'insufficient') return sendError(res, 409, 'INSUFFICIENT_POINTS', '포인트가 부족합니다.');
      if (!base) await pointStore.setWorldValue('furniture', { day: st.day, sold: { ...st.sold, [place.id]: account }, buys: { ...st.buys, [account]: (st.buys[account] || 0) + 1 } });
      const piece = { uid: crypto.randomUUID(), id, at: nowMs(), price, claim: claimId };
      if (!owned.some((p) => p.claim === claimId)) await pointStore.setWorldValue(`furniture:${account}`, [...owned, piece]); // (a paid one tried again: kept once)
      if (out.applied) notifyPointsChanged([account]);
      if (!base) broadcastIsland('furniture', { day: st.day, sold: place.id });
      return sendJson(res, 200, { ok: true, piece, name: g.name, balance: out.balance ?? null });
    });
  }
  // my storage: what I bought, newest first
  if (pathname === '/api/island/furniture/mine' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    const owned = (await pointStore.worldValue(`furniture:${pointAccountForSession(session)}`)) || [];
    return sendJson(res, 200, { ok: true, pieces: owned.slice().reverse().map((p) => ({ ...p, ...(() => { const g = IslandFurniture.good(p.id); return g ? { name: g.name, model: g.model, rarity: g.rarity, shape: g.shape } : {}; })() })) });
  }
  if (pathname === '/api/island/store' && req.method === 'GET') {
    if (!requireSession(req, res)) return;
    return sendJson(res, 200, { ok: true, goods: IslandStore.SHELF.map((s) => { const def = IslandItems.ITEMS[s.id]; return { id: s.id, name: def?.name || ({ seed_flower_red: '빨강 꽃씨', seed_flower_yellow: '노랑 꽃씨', seed_flower_white: '흰 꽃씨', seed_flower_pink: '분홍 꽃씨', seed_flower_purple: '보라 꽃씨', sapling: '묘목', fertilizer: '비료' })[s.id] || s.id, price: def?.good && !s.soon ? Economy.value(`good:${s.id}`) : 0, use: def?.use || null }; }) });
  }
  // B 47 생일: mine (set, hidden, how many cheered this year), today's birthdays; my own birthday pays its gift once a year
  if (pathname === '/api/island/birthday' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    const account = pointAccountForSession(session); await refreshBirthdays();
    const doc = (await pointStore.questDoc(account, 'birthday')).doc; const t = Together.seoul(nowMs()); let gift = 0;
    if (!doc.hidden && Together.isBirthday(doc, nowMs()) && !doc.paid?.[t.year]) {
      const out = await pointStore.questApply(account, 'birthday', (d) => (d.paid?.[t.year] ? null : { doc: { ...d, paid: { ...(d.paid || {}), [t.year]: true } }, reward: Together.BIRTHDAY_GIFT, payKey: `birthday:${account}:${t.year}` }));
      if (out?.reward) { gift = out.reward; notifyPointsChanged([account]); }
    }
    return sendJson(res, 200, { ok: true, mine: { month: doc.month || null, day: doc.day || null, hidden: Boolean(doc.hidden), cheers: (doc.cheers?.[t.year] || []).length }, today: [...birthdays.today.entries()].map(([id, name]) => ({ id: id === account ? 'me' : null, name })), gift });
  }
  if (pathname === '/api/island/birthday' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    if (session.role === 'admin') return sendError(res, 400, 'BAD_BIRTHDAY', '관리자 창에서 계정마다 정해 주세요.');
    const body = await parseJson(req); const clear = body.clear === true; const month = Number(body.month); const day = Number(body.day);
    if (!clear && !Together.validDay(month, day)) return sendError(res, 400, 'BAD_BIRTHDAY', '월·일을 확인해 주세요.');
    await pointStore.questApply(pointAccountForSession(session), 'birthday', (d) => ({ doc: clear ? { cheers: d.cheers, paid: d.paid } : { ...d, month, day, hidden: body.hidden === true } }));
    await refreshBirthdays(true); return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/admin/birthday' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req); const name = String(body.label || '').trim(); const key = (await accessStore.list()).find((k) => !k.revokedAt && (k.id === body.keyId || (name && k.label === name))); const month = Number(body.month); const day = Number(body.day);
    if (!key || !Together.validDay(month, day)) return sendError(res, 400, 'BAD_BIRTHDAY', '계정과 월·일을 확인해 주세요.');
    await pointStore.questApply(`guest:${key.id}`, 'birthday', (d) => ({ doc: { ...d, month, day, hidden: body.hidden === true } }));
    await refreshBirthdays(true); return sendJson(res, 200, { ok: true });
  }
  // 축하하기: by someone whose birthday it is, once a day from each person (counted in their year), confetti for everyone
  if (pathname === '/api/island/birthday/cheer' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const body = await parseJson(req); prunePlazaPresence();
    const target = [...sessions.entries()].find(([token, x]) => x.plazaId && x.plazaId === body.plazaId && token !== session.token);
    const me = plazaPresence.get(session.token); const them = target && plazaPresence.get(target[0]);
    if (!me || !them) return sendError(res, 404, 'RECIPIENT_NOT_FOUND', '상대가 섬을 떠났습니다.');
    if ((me.space || 'island') !== (them.space || 'island') || Math.hypot(me.x - them.x, me.z - them.z) > 4) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    const to = pointAccountForSession(target[1]); const from = pointAccountForSession(session);
    if (!birthdays.today.has(to)) return sendError(res, 409, 'NOT_BIRTHDAY', '오늘이 생일인 사람에게만 축하할 수 있어요.');
    const t = Together.seoul(nowMs()); const mark = `${from}@${kstDate(nowMs())}`;
    const out = await pointStore.questApply(to, 'birthday', (d) => { const list = d.cheers?.[t.year] || []; return list.includes(mark) ? null : { doc: { ...d, cheers: { [t.year]: [...list, mark] } } }; });
    if (!out?.doc) return sendError(res, 409, 'ALREADY_CHEERED', '오늘은 이미 축하했어요.');
    broadcastIsland('birthdayCheer', { to: target[1].plazaId, by: session.plazaId });
    notifyAccount(to, 'birthdayCheered', { name: String(session.label || '누군가').slice(0, 24), count: out.doc.cheers[t.year].length });
    return sendJson(res, 200, { ok: true, count: out.doc.cheers[t.year].length });
  }
  // B 47 처음 온 사람 안내: where my guide is (a new account starts it on its first island; tests start it themselves),
  // a step done (only the current one counts) or started again by talking to the guide (사용자 2026-10-18: 첫 접속이면 무조건,
  // 건너뛰기 없음; 끝난 뒤에도 광장 한쪽에서 말 걸면 가르쳐 줌); the last step pays the welcome once
  if (pathname === '/api/island/guide' && (req.method === 'GET' || req.method === 'POST')) {
    const session = requireSession(req, res); if (!session) return;
    const account = pointAccountForSession(session); const body = req.method === 'POST' ? await parseJson(req) : {};
    let doc = (await pointStore.questDoc(account, 'guide')).doc;
    if (req.method === 'GET' && !doc.started && !doc.skipped && session.guestKeyId && process.env.NODE_ENV !== 'test') {
      const key = await accessStore.get(session.guestKeyId);
      if (key && Date.parse(key.createdAt) >= Together.GUIDE_FROM) doc = (await pointStore.questApply(account, 'guide', (d) => (d.started ? null : { doc: { ...d, started: true, step: 0 } })))?.doc || doc;
    }
    let gift = 0;
    if (body.restart === true) doc = (await pointStore.questApply(account, 'guide', (d) => ({ doc: { started: true, step: 0, paid: d.paid } })))?.doc || doc;
    else if (typeof body.done === 'string' && doc.started && !doc.skipped) {
      const out = await pointStore.questApply(account, 'guide', (d) => { const next = Together.guideAfter(d, body.done); if (!next) return null; return next.done && !d.paid ? { doc: { ...next, paid: true }, reward: Together.GUIDE_GIFT, payKey: `guide:${account}` } : { doc: next }; });
      if (out?.doc) doc = out.doc; if (out?.reward) { gift = out.reward; notifyPointsChanged([account]); }
    }
    return sendJson(res, 200, { ok: true, active: Boolean(doc.started && !doc.skipped && !doc.done), step: doc.step || 0, done: Boolean(doc.done), steps: Together.GUIDE_STEPS, gift });
  }
  // B 47 박물관: what is on show (each fish and insect once, the first giver's name) and a gift from my bag at its door
  if (pathname === '/api/island/museum' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    const shown = (await pointStore.worldValue('museum')) || {};
    const kinds = IslandFishing.DEX.filter((d) => d.kind === 'fish' || d.kind === 'insect');
    return sendJson(res, 200, { ok: true, exhibits: kinds.map((d) => ({ id: d.id, name: d.name, kind: d.kind, by: shown[d.id]?.by || null, at: shown[d.id]?.at || null })), shown: kinds.filter((d) => shown[d.id]).length, total: kinds.length });
  }
  if (pathname === '/api/island/museum/donate' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const me = plazaPresence.get(session.token); const door = Together.museumDoor(IslandTerrain.MUSEUM);
    if (!me || (me.space || 'island') !== 'island' || Math.hypot(me.x - door.x, me.z - door.z) > 3.5) return sendError(res, 409, 'TOO_FAR', '박물관 앞에서 기증할 수 있어요.');
    const body = await parseJson(req); const itemId = String(body.itemId || '');
    if (!IslandFishing.DEX.some((d) => d.id === itemId && (d.kind === 'fish' || d.kind === 'insect'))) return sendError(res, 400, 'BAD_DONATION', '물고기나 곤충만 기증할 수 있어요.');
    const out = await museumGive(pointAccountForSession(session), itemId, String(session.label || '게스트').slice(0, 24));
    if (out === 'shown') return sendError(res, 409, 'ALREADY_SHOWN', '이미 전시돼 있어요.');
    if (out === 'missing') return sendError(res, 409, 'NOT_IN_BAG', '가방에 없습니다.');
    broadcastIsland('museum', { id: itemId, by: String(session.label || '게스트').slice(0, 24) });
    return sendJson(res, 200, { ok: true });
  }
  // B 47 반려동물: which of mine walks with me (one bought at the 잡화점, a name of up to 10 characters), or none
  if (pathname === '/api/island/pet' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const account = pointAccountForSession(session); const body = await parseJson(req);
    const kind = body.kind == null ? null : String(body.kind); const name = String(body.name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 10);
    if (kind && !PET_KINDS.includes(kind)) return sendError(res, 400, 'BAD_PET', '반려동물을 확인해 주세요.');
    if (kind && !((await pointStore.islandBag(account)).items || []).some((e) => e.itemId === `pet_${kind}`)) return sendError(res, 409, 'NOT_IN_BAG', '가방에 없습니다.');
    await pointStore.questApply(account, 'pet', () => ({ doc: kind ? { kind, name } : {} }));
    petOf.set(account, kind ? { kind, name } : null);
    for (const [token, e] of plazaPresence) if (e.account === account) { e.pet = petOf.get(account); plazaPresence.set(token, e); }
    plazaDirty = true; return sendJson(res, 200, { ok: true, pet: petOf.get(account) });
  }
  // B 47 우체통: my letters (30 days), whom I can write to (every active account), how many I sent today
  if (pathname === '/api/island/mail' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    const account = pointAccountForSession(session); const now = nowMs();
    const letters = Together.freshLetters((await pointStore.questDoc(account, 'mail')).doc.letters, now);
    const sent = (await pointStore.questDoc(account, 'mailSent')).doc; const t = Together.seoul(now);
    const people = (await accessStore.list()).filter((k) => !k.revokedAt && !k.pendingAt && `guest:${k.id}` !== account).map((k) => ({ id: k.id, label: k.label }));
    return sendJson(res, 200, { ok: true, letters, unread: letters.filter((l) => !l.read).length, people, left: Together.SEND_PER_DAY - (sent.day === `${t.year}-${t.month}-${t.day}` ? sent.n : 0), max: Together.LETTER_MAX });
  }
  if (pathname === '/api/island/mail/send' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    if (!checkRateLimit(`island-mail:${session.token}`, 10, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    if (!nearMailbox(session)) return sendError(res, 409, 'TOO_FAR', '우체통 앞에서 보낼 수 있어요.');
    const body = await parseJson(req); const text = Together.letterText(body.text); const requestId = String(body.requestId || '');
    const key = await accessStore.get(String(body.to || '')); const from = pointAccountForSession(session);
    if (!key || key.revokedAt || key.pendingAt || `guest:${key.id}` === from) return sendError(res, 404, 'RECIPIENT_NOT_FOUND', '받는 사람을 찾을 수 없습니다.');
    if (!text) return sendError(res, 400, 'BAD_LETTER', `편지는 1~${Together.LETTER_MAX}자로 써 주세요.`);
    if (!/^[A-Za-z0-9-]{8,64}$/.test(requestId)) return sendError(res, 400, 'BAD_LETTER', '다시 시도해 주세요.');
    const to = `guest:${key.id}`;
    const sentAt = nowMs(); // (the day's count taken first -- two at once cannot both slip under it, Codex review)
    const reserved = await pointStore.questApply(from, 'mailSent', (d) => { const next = Together.sentAfter(d, sentAt); return next ? { doc: next } : null; });
    if (!reserved?.doc) return sendError(res, 409, 'MAIL_LIMIT', `편지는 하루 ${Together.SEND_PER_DAY}통까지 보낼 수 있어요.`);
    const giveBack = () => pointStore.questApply(from, 'mailSent', (d) => (d.day === reserved.doc.day && d.n > 0 ? { doc: { ...d, n: d.n - 1 } } : null)).catch(() => {});
    const itemId = body.itemId ? String(body.itemId) : null;
    if (itemId) { // the parcel: the gift wrap's rule (one thing, a wrap used), straight into their bag
      let out; try { out = await pointStore.islandGift({ userId: from, to, itemId, requestId }); } catch { await giveBack(); return sendError(res, 400, 'BAD_GIFT', '선물할 수 없는 물건입니다.'); }
      if (out.reason) await giveBack();
      if (out.reason === 'no-wrap') return sendError(res, 409, 'NO_GIFT_WRAP', '소포에는 선물 포장지가 필요합니다. 잡화점에서 살 수 있어요.');
      if (out.reason === 'missing') return sendError(res, 409, 'NOT_IN_BAG', '가방에 없습니다.');
      if (out.reason === 'full') return sendError(res, 409, 'THEIR_BAG_FULL', '상대의 가방이 가득 찼습니다.');
    }
    const now = nowMs(); const letter = { id: requestId, from: session.guestKeyId || 'admin', fromName: String(session.label || (session.role === 'admin' ? '관리자' : '게스트')).slice(0, 24), text, itemId, itemName: itemId ? (IslandItems.ITEMS[itemId]?.name || null) : null, at: now, read: false };
    const put = await pointStore.questApply(to, 'mail', (d) => ((d.letters || []).some((l) => l.id === letter.id) ? null : { doc: { ...d, letters: Together.withLetter(d.letters, letter, now) } }));
    if (!put?.doc) await giveBack(); // (the same letter again: not counted twice)
    notifyAccount(to, 'mail', { from: letter.fromName });
    return sendJson(res, 200, { ok: true, to: key.label });
  }
  if (pathname === '/api/island/mail/read' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const body = await parseJson(req); const id = String(body.id || '');
    await pointStore.questApply(pointAccountForSession(session), 'mail', (d) => ((d.letters || []).some((l) => l.id === id && !l.read) ? { doc: { ...d, letters: d.letters.map((l) => (l.id === id ? { ...l, read: true } : l)) } } : null));
    return sendJson(res, 200, { ok: true });
  }
  // v1.10.92 선물 포장지: one thing from my bag to someone standing by me on the island (a wrap of mine used)
  if (pathname === '/api/island/gift' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    if (!checkRateLimit(`island-gift:${session.token}`, 20, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req); prunePlazaPresence();
    const target = [...sessions.entries()].find(([token, s]) => s.plazaId && s.plazaId === body.plazaId && token !== session.token);
    const me = plazaPresence.get(session.token); const them = target && plazaPresence.get(target[0]);
    if (!me || !them) return sendError(res, 404, 'RECIPIENT_NOT_FOUND', '상대가 섬을 떠났습니다.');
    if ((me.space || 'island') !== (them.space || 'island') || Math.hypot(me.x - them.x, me.z - them.z) > 3) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    const from = pointAccountForSession(session); const to = pointAccountForSession(target[1]);
    let out; try { out = await pointStore.islandGift({ userId: from, to, itemId: String(body.itemId || ''), requestId: String(body.requestId || '') }); } catch { return sendError(res, 400, 'BAD_GIFT', '선물할 수 없는 물건입니다.'); }
    if (out.reason === 'no-wrap') return sendError(res, 409, 'NO_GIFT_WRAP', '선물 포장지가 필요합니다. 잡화점에서 살 수 있어요.');
    if (out.reason === 'missing') return sendError(res, 409, 'NOT_IN_BAG', '가방에 없습니다.');
    if (out.reason === 'full') return sendError(res, 409, 'THEIR_BAG_FULL', '상대의 가방이 가득 찼습니다.');
    return sendJson(res, 200, { ok: true, to: them.name || '상대', bag: out.bag || null });
  }
  if (pathname === '/api/island/goods/use' && req.method === 'POST') { // v1.10.92: a show good from the bag (on the island)
    const session = requireSession(req, res); if (!session) return;
    const body = await parseJson(req); const def = IslandItems.ITEMS[body.itemId];
    if (!def?.good || def.use !== 'show') return sendError(res, 400, 'NOT_USABLE', '여기서 쓸 수 없는 물건입니다.');
    if (!plazaPresence.get(session.token)) return sendError(res, 409, 'NOT_ON_ISLAND', '섬에서 쓸 수 있습니다.');
    const account = pointAccountForSession(session);
    let out; try { out = await pointStore.islandUse({ userId: account, requestId: String(body.requestId || ''), itemId: body.itemId }); } catch { return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.'); }
    if (out.reason === 'missing') return sendError(res, 409, 'NOT_IN_BAG', '가방에 없습니다.');
    showUsed.set(session.token, { kind: body.itemId, until: nowMs() + 10000 }); // (the show is 6 s; a slow page posts it late -- the page ends it itself)
    return sendJson(res, 200, { ok: true, kind: body.itemId, bag: out.bag || null });
  }
  if (pathname === '/api/island/store/buy' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const body = await parseJson(req); const at = plazaPresence.get(session.token);
    const s = at && storeInside.has(session.token) ? IslandStore.goodAt(at.x, at.z) : null;
    if (!s || s.id !== body.itemId) return sendError(res, 409, 'TOO_FAR', '물건 가까이 가서 다시 시도해 주세요.');
    if (s.soon || !IslandItems.ITEMS[s.id]?.good) return sendError(res, 409, 'NOT_ON_SALE', '아직 팔지 않는 물건입니다.');
    const qty = Number(body.qty); if (![1, 5, 10].includes(qty)) return sendError(res, 400, 'BAD_QTY', '수량을 확인해 주세요.');
    const account = pointAccountForSession(session);
    let out; try { out = await pointStore.islandBuy({ userId: account, requestId: String(body.requestId || ''), itemId: s.id, qty, unit: Economy.value(`good:${s.id}`) }); } catch { return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.'); }
    if (out.reason === 'insufficient') return sendError(res, 409, 'INSUFFICIENT_POINTS', '포인트가 부족합니다.');
    if (out.reason === 'full') return sendError(res, 409, 'BAG_FULL', '가방이 가득 찼습니다.');
    if (out.applied) notifyPointsChanged([account]);
    return sendJson(res, 200, { ok: true, itemId: s.id, qty, bag: out.bag, balance: out.balance ?? null });
  }
  if ((pathname === '/api/island/townhall/enter' || pathname === '/api/island/townhall/leave') && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const at = plazaPresence.get(session.token); const R = IslandTerrain.TOWNHALL_ROOM;
    if (!at) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    const entering = pathname.endsWith('/enter');
    if (entering) {
      const door = IslandTerrain.facilityDoor('townhall');
      if (townhallInside.has(session.token) || storeInside.has(session.token)) return sendError(res, 409, 'ALREADY_INSIDE', '이미 안에 있습니다.');
      if (trainRiders.has(session.token) || trainVisitors.has(session.token) || !passesGate(session) || Math.hypot(at.x - door.x, at.z - door.z) > 2.4) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
      freeSeat(session.token); townhallInside.add(session.token);
    } else {
      const exit = IslandTerrain.roomWorld(R.exit.lx, R.exit.lz);
      if (!townhallInside.has(session.token) || Math.hypot(at.x - exit.x, at.z - exit.z) > 2.4) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
      townhallInside.delete(session.token);
    }
    const spot = entering ? IslandTerrain.roomWorld(R.entry.lx, R.entry.lz) : IslandTerrain.facilityDoor('townhall');
    plazaPresence.set(session.token, { ...at, x: Math.round(spot.x * 100) / 100, z: Math.round(spot.z * 100) / 100, space: entering ? 'townhall' : 'island', moving: false, at: nowMs(), act: null, seat: null });
    plazaDirty = true;
    return sendJson(res, 200, { ok: true, space: entering ? 'townhall' : 'island', x: Math.round(spot.x * 100) / 100, z: Math.round(spot.z * 100) / 100 });
  }
  // v1.10.85 관공서 예금 창구 (사용자 2026-10-17): at the 예금 window inside the 민원실 -- the wallet and the deposit (4% a day,
  // lib/point-store.js bankAccrue), and putting in or taking out any amount (once per request id)
  if (pathname === '/api/island/bank' && (req.method === 'GET' || req.method === 'POST')) {
    const session = requireSession(req, res);
    if (!session) return;
    const at = plazaPresence.get(session.token); const R = IslandTerrain.TOWNHALL_ROOM; const w = IslandTerrain.roomWorld(R.bank.lx, R.bank.lz);
    if (!townhallInside.has(session.token) || !at || Math.hypot(at.x - w.x, at.z - w.z) > 1.8) return sendError(res, 409, 'TOO_FAR', '관공서 안 예금 창구에서 이용해 주세요.');
    const account = pointAccountForSession(session);
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, ...(await pointStore.bankView(account, nowMs())) });
    if (!checkRateLimit(`bank:${account}`, 30, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount === 0 || typeof body.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId)) return sendError(res, 400, 'BAD_REQUEST', '금액을 확인해 주세요.');
    const out = await pointStore.bankMove(account, amount, body.requestId, nowMs());
    if (out.reason === 'insufficient') return sendError(res, 409, 'INSUFFICIENT', amount > 0 ? '지갑 포인트가 부족합니다.' : '예금이 부족합니다.', { balance: out.balance, deposit: out.deposit });
    if (out.reason === 'limit') return sendError(res, 409, 'BANK_LIMIT', '더 맡기거나 찾을 수 없는 금액입니다.', { balance: out.balance, deposit: out.deposit });
    if (out.applied) notifyPointsChanged([account]);
    return sendJson(res, 200, { ok: true, ...out });
  }
  // v1.10.86 주민세: what I owe and today's estimate; paying it at the 세금 창구 inside the hall
  if (pathname === '/api/island/tax' && (req.method === 'GET' || req.method === 'POST')) {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (req.method === 'GET') { const v = await pointStore.bankView(account, nowMs()); return sendJson(res, 200, { ok: true, debt: taxDebt.get(account) || 0, rate: PointStore.TAX_RATE, minimum: PointStore.TAX_MIN, max: PointStore.TAX_DEBT_MAX, nextTax: PointStore.taxSplit(v.balance, v.deposit).tax }); }
    const at = plazaPresence.get(session.token); const R = IslandTerrain.TOWNHALL_ROOM; const w = IslandTerrain.roomWorld(R.tax.lx, R.tax.lz);
    if (!townhallInside.has(session.token) || !at || Math.hypot(at.x - w.x, at.z - w.z) > 1.8) return sendError(res, 409, 'TOO_FAR', '관공서 안 세금 창구에서 납부해 주세요.');
    const body = await parseJson(req);
    if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId)) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    const out = await pointStore.taxPay(account, body.requestId, nowMs());
    taxDebt.set(account, out.debt);
    if (out.applied) { notifyPointsChanged([account]); refreshTaxLooks(); }
    return sendJson(res, 200, { ok: true, ...out });
  }
  if (pathname === '/api/island/sell' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (!checkRateLimit(`island-sell:${session.token}`, 30, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const place = ['office', 'merchant', 'fisher'].includes(body.place) ? body.place : null;
    if (!place || typeof body.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId)) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    const spot = place === 'office' ? IslandTerrain.townhallWorld(0, 8.6) : place === 'fisher' ? IslandQuests.STORIES.fisher.at : IslandTerrain.SPOTS.trader || null; // (달마루섬: none -- the 백화점's 노점) v1.10.41: the town hall's door, inside its yard; v1.10.42 the harbour fisherman
    const at = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
    const atCounter = place === 'office' && townhallInside.has(session.token) && at && (() => { const d = IslandTerrain.roomWorld(IslandTerrain.TOWNHALL_ROOM.desk.lx, IslandTerrain.TOWNHALL_ROOM.desk.lz); return Math.hypot(at.x - d.x, at.z - d.z) <= 1.8; })(); // v1.10.84 (v1.10.86: 1.8 m, each window its own)
    const atStall = place === 'merchant' && storeInside.has(session.token) && at && (() => { const d = IslandStore.sectorPoint('mall:stall'); return Math.hypot(at.x - d.x, at.z - d.z) < 2.4; })(); // (달마루섬 5단계: the 백화점's 노점)
    if (!atCounter && !atStall && (!at || !spot || Math.hypot(at.x - spot.x, at.z - spot.z) > 8)) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    if (place === 'office' && !atCounter) return sendError(res, 409, 'TOO_FAR', '관공서 안 민원 창구에서 맡겨 주세요.'); // v1.10.84: the counter is inside now (Codex review)
    const account = pointAccountForSession(session);
    const result = await pointStore.islandSell({ userId: account, requestId: body.requestId, place, activeLost: islandEvents.activeLost() }, nowMs()); // a lost thing whose owner has gone: lost and found
    if (result.reason === 'nothing') return sendError(res, 409, 'NOTHING_TO_SELL', '맡길 물건이 없습니다.');
    if (result.reason === 'cap') return sendError(res, 409, 'DAILY_CAP', '오늘은 더 받을 수 없습니다.');
    if (result.applied) notifyPointsChanged([account]);
    const weeds = (result.sold || []).find((x) => x.itemId === 'weed'); if (result.applied && weeds) islandProgress('weed_submit', account, weeds.qty);
    return sendJson(res, 200, { ok: true, paid: result.paid, sold: result.sold, capped: result.capped, bag: result.bag, balance: result.balance ?? result.balanceAfter });
  }
  // v1.10.31 잡초: every weed out now ([id, x, z]); start / finish pulling one
  // v1.10.37 혼자 하는 게임 — 지뢰찾기 (IDEAS 「솔로 게임」): the board is the server's; a clear pays by level once per game,
  // nothing for a clear faster than a person could (the level's minMs), no daily limit (경제 기준 통합)
  if (pathname === '/api/solo/minesweeper' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const g = soloGames.get(session.token);
    return sendJson(res, 200, { ok: true, levels: Object.entries(Minesweeper.LEVELS).map(([id, l]) => ({ id, label: l.label, w: l.w, h: l.h, mines: l.mines, points: Economy.value(`solo:minesweeper:${id}`) })),
      records: (await pointStore.soloRecords(pointAccountForSession(session))).minesweeper || {}, game: g ? { id: g.id, view: g.engine.view() } : null });
  }
  if ((pathname === '/api/solo/minesweeper/new' || pathname === '/api/solo/minesweeper/act') && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (!checkRateLimit(`solo:${session.token}`, 900, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    if (pathname === '/api/solo/minesweeper/new') {
      if (!Minesweeper.LEVELS[body.level]) return sendError(res, 400, 'BAD_LEVEL', '고를 수 없는 난이도입니다.');
      const g = { id: crypto.randomUUID(), level: body.level, engine: Minesweeper.createGame(body.level, { now: nowMs }) };
      soloGames.set(session.token, g);
      return sendJson(res, 200, { ok: true, id: g.id, view: g.engine.view() });
    }
    const g = soloGames.get(session.token);
    if (!g || g.id !== body.id) return sendError(res, 409, 'NO_GAME', '새 게임을 시작해 주세요.');
    const x = Number(body.x); const y = Number(body.y);
    try { g.engine.act(String(body.action), x, y); } catch { return sendError(res, 400, 'BAD_MOVE', '잘못된 요청입니다.'); }
    const view = g.engine.view();
    let result = null;
    if (view.status === 'won' && !g.paid) {
      g.paid = true;
      const L = Minesweeper.LEVELS[g.level];
      const points = view.ms >= L.minMs ? Economy.value(`solo:minesweeper:${g.level}`) : 0; // (v1.10.91: the administrator's value)
      const account = pointAccountForSession(session);
      const out = await pointStore.soloClear({ userId: account, gameId: g.id, game: 'minesweeper', level: g.level, ms: view.ms, points, title: `지뢰찾기 ${L.label}` });
      result = { points: out.points, best: out.best, clears: out.clears, newBest: out.newBest, balance: out.balance ?? out.balanceAfter };
      if (out.points) notifyPointsChanged([account]);
    }
    return sendJson(res, 200, { ok: true, view, result });
  }
  // v1.10.68 순발력 게임 (lib/reflex.js): the round is played in the browser; the server opens it and judges the score it
  // is sent once (how long the round really took, a score a person can make), paying by level up to the day's cap
  if (pathname === '/api/solo/reflex' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    const records = await pointStore.soloRecords(account);
    return sendJson(res, 200, { ok: true, points: Reflex.POINTS, cap: Reflex.DAILY_CAP, today: await pointStore.soloDailyPaid(account, kstDate(nowMs())),
      records: Object.fromEntries(Object.keys(Reflex.GAMES).map((id) => [id, records[id] || {}])) });
  }
  if ((pathname === '/api/solo/reflex/start' || pathname === '/api/solo/reflex/finish') && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`reflex:${account}`, 60, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const now = nowMs();
    if (pathname === '/api/solo/reflex/start') {
      const level = Reflex.levelOf(body.game, body.level);
      if (!level) return sendError(res, 400, 'BAD_LEVEL', '고를 수 없는 게임입니다.');
      for (const [id, run] of reflexRuns) if (now - run.at > Reflex.RUN_MS) reflexRuns.delete(id);
      const id = crypto.randomUUID();
      reflexRuns.set(id, { account, game: body.game, level, at: now });
      return sendJson(res, 200, { ok: true, id });
    }
    const run = reflexRuns.get(String(body.id || ''));
    if (!run || run.account !== account || now - run.at > Reflex.RUN_MS) return sendError(res, 409, 'NO_GAME', '끝난 판입니다.'); // v1.10.70 also too old
    reflexRuns.delete(body.id); // one report a round
    const score = Number(body.score);
    const verdict = Reflex.judge(run.game, run.level, score, now - run.at);
    if (verdict === 'score') return sendError(res, 400, 'BAD_SCORE', '잘못된 기록입니다.');
    const G = Reflex.GAMES[run.game];
    const out = await pointStore.soloClear({ userId: account, gameId: body.id, game: run.game, level: run.level, ms: score, higher: G.higher,
      points: verdict === 'ok' ? Reflex.POINTS[run.level] : 0, daily: { day: kstDate(now), cap: Reflex.DAILY_CAP },
      title: G.levels ? `${G.name} ${Reflex.LEVELS[run.level]}` : G.name });
    if (out.points) notifyPointsChanged([account]);
    if (verdict === 'ok') islandProgress(`minigame:${run.game}`, account, score); // v1.10.80 농부 부탁: a paid round counts
    if (verdict === 'ok' && run.game === 'whack') contestNote(account, session, 'whack', score); // (A4: a contest round)
    return sendJson(res, 200, { ok: true, verdict, points: out.points, best: out.best, newBest: out.newBest, today: out.today, cap: Reflex.DAILY_CAP, balance: out.balance ?? out.balanceAfter });
  }
  // v1.10.69 오늘의 문제 (lib/puzzle-daily.js): the page says when it opens the day's puzzle (kept from the first time, so a
  // puzzle left and resumed still counts its whole time) and sends the solved board; the first right answer of the game,
  // level and day pays once (the settlement id is made from them), unless it came sooner than a person solves one
  if (pathname === '/api/solo/puzzle' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const records = await pointStore.soloRecords(pointAccountForSession(session));
    // uid (v1.10.70, Codex review): a name for this account's puzzle progress kept in the browser, so two accounts on one
    // browser never share a day's puzzle (says nothing about the account)
    const uid = crypto.createHash('sha256').update(`puzzle-uid|${pointAccountForSession(session)}`).digest('hex').slice(0, 16);
    return sendJson(res, 200, { ok: true, uid, points: PuzzleDaily.POINTS, date: kstDate(nowMs()),
      records: Object.fromEntries(Object.keys(PuzzleDaily.GAMES).map((id) => [id, records[id] || {}])) });
  }
  if ((pathname === '/api/solo/puzzle/start' || pathname === '/api/solo/puzzle/finish') && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`puzzle:${account}`, 30, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const { game, level } = body;
    if (!Object.hasOwn(PuzzleDaily.GAMES, game) || !Object.hasOwn(PuzzleDaily.LEVELS, level)) return sendError(res, 400, 'BAD_LEVEL', '고를 수 없는 게임입니다.');
    const now = nowMs();
    if (pathname === '/api/solo/puzzle/start') {
      for (const [k, at] of puzzleStarts) if (now - at > 2 * 86400e3) puzzleStarts.delete(k);
      const key = `${account}|${game}|${level}|${kstDate(now)}`;
      if (!puzzleStarts.has(key)) puzzleStarts.set(key, now);
      return sendJson(res, 200, { ok: true });
    }
    const proof = body.proof || {}; const score = Number(body.score);
    const date = String(proof.date || '');
    if (date !== kstDate(now) && date !== kstDate(now - 86400e3)) return sendError(res, 400, 'BAD_DATE', '지난 날의 문제입니다.');
    if (!Number.isSafeInteger(score) || score < 0 || score > 864e5) return sendError(res, 400, 'BAD_SCORE', '잘못된 기록입니다.');
    const right = await PuzzleDaily.verify(game, level, proof);
    if (right === null) return sendError(res, 503, 'TRY_LATER', '잠시 후 다시 시도해 주세요.');
    if (!right) return sendError(res, 400, 'WRONG_ANSWER', '정답이 아닙니다.');
    const startedAt = puzzleStarts.get(`${account}|${game}|${level}|${date}`); // unknown after a restart: the time it claims decides
    const fast = score < PuzzleDaily.MIN_MS[level] || (startedAt !== undefined && now - startedAt < PuzzleDaily.MIN_MS[level]);
    const claim = puzzleClaim(account, game, level, date);
    const out = await pointStore.soloClear({ userId: account, gameId: `pz-${claim}`, game, level, ms: score, points: fast ? 0 : PuzzleDaily.POINTS[level],
      title: `${PuzzleDaily.GAMES[game]} ${PuzzleDaily.LEVELS[level]} 오늘의 문제` });
    if (out.applied && out.points) notifyPointsChanged([account]);
    islandProgress(`minigame:${game}`, account, 1); // A2b 마을 주민 부탁: a right answer of the day counts
    return sendJson(res, 200, { ok: true, already: !out.applied, fast, points: out.applied ? out.points : 0, best: out.best, newBest: Boolean(out.applied && out.newBest) });
  }
  // v1.10.70 카드 게임 (lib/cards.js): the server deals (the round's seed) and pays a clear only after playing its action
  // log again with the page's own game code; a time record is the server's own (from the deal to the report -- the page's
  // clock could be sent smaller, Codex review)
  if (pathname === '/api/solo/cards' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    const records = await pointStore.soloRecords(account);
    return sendJson(res, 200, { ok: true, points: Object.fromEntries(Object.entries(Cards.GAMES).map(([id, g]) => [id, g.points])), cap: Cards.DAILY_CAP,
      today: await pointStore.soloDailyPaid(account, `cards:${kstDate(nowMs())}`), records: Object.fromEntries(Object.keys(Cards.GAMES).map((id) => [id, records[id] || {}])) });
  }
  if ((pathname === '/api/solo/cards/start' || pathname === '/api/solo/cards/finish') && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`cards:${account}`, 30, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const now = nowMs();
    if (pathname === '/api/solo/cards/start') {
      const G = Cards.GAMES[body.game];
      if (!G || !Object.hasOwn(G.levels, body.level)) return sendError(res, 400, 'BAD_LEVEL', '고를 수 없는 게임입니다.');
      for (const [id, run] of cardRuns) if (now - run.at > Cards.RUN_MS) cardRuns.delete(id);
      const id = crypto.randomUUID(); const seed = crypto.randomBytes(4).readUInt32LE(0);
      cardRuns.set(id, { account, game: body.game, level: body.level, seed, at: now });
      return sendJson(res, 200, { ok: true, id, seed });
    }
    const run = cardRuns.get(String(body.id || ''));
    if (run && now - run.at > Cards.RUN_MS) cardRuns.delete(body.id); // too old to report, whoever else plays (Codex review)
    if (!run || run.account !== account || now - run.at > Cards.RUN_MS) return sendError(res, 409, 'NO_GAME', '끝난 판입니다.');
    if (typeof body.log !== 'string' || body.log.length > 46000) return sendError(res, 400, 'BAD_LOG', '잘못된 기록입니다.');
    let out;
    try { out = await Cards.replay({ game: run.game, level: run.level, seed: run.seed, log: body.log }); }
    catch { return sendError(res, 503, 'TRY_LATER', '잠시 후 다시 시도해 주세요.'); } // the round stays open: the page may send it again
    cardRuns.delete(body.id); // one report a round
    if (!out.won) return sendError(res, 400, 'NOT_CLEARED', '기록을 확인하지 못했습니다.');
    const G = Cards.GAMES[run.game]; const elapsed = now - run.at;
    const score = G.higher ? out.score : elapsed; // spider: the replay's own score; the others: the server's clock
    if (!Number.isSafeInteger(score) || score < 0) return sendError(res, 400, 'BAD_SCORE', '잘못된 기록입니다.');
    const fast = elapsed < Cards.MIN_MS;
    const paid = await pointStore.soloClear({ userId: account, gameId: body.id, game: run.game, level: run.level, ms: score, higher: G.higher,
      points: fast ? 0 : G.points[run.level], daily: { day: `cards:${kstDate(now)}`, cap: Cards.DAILY_CAP }, title: `${G.name} ${G.levels[run.level]}` });
    if (paid.points) notifyPointsChanged([account]);
    return sendJson(res, 200, { ok: true, fast, score, points: paid.points, best: paid.best, newBest: paid.newBest, today: paid.today, cap: Cards.DAILY_CAP });
  }
  // v1.10.61 두 세계 영웅전 (/herosurv/, a Godot build we host as is): the game's own online leaderboard API, answered
  // here so its 명예의 전당 lists game-center accounts by nickname. The page adds the session header to the game's calls;
  // the game's own guest token and the name it asks for are ignored. Scores are the game's word (no points ride on them).
  if (pathname.startsWith('/api/leaderboards/v1/')) {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    const me = { playerId: herosurvPlayerId(account), displayName: String(session.label || (session.role === 'admin' ? '관리자' : '게스트')) };
    const route = pathname.slice('/api/leaderboards/v1/'.length);
    if (route === 'guests' && req.method === 'POST') return sendJson(res, 201, { ...me, token: me.playerId, expiresInSeconds: 31536000 });
    if (route === 'me' && req.method === 'PUT') return sendJson(res, 200, me);
    let m = /^boards\/(heroes-r\d{1,3})$/.exec(route);
    if (m && req.method === 'GET') {
      const rows = await pointStore.herosurvBoard(m[1]);
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 10));
      const view = (row, i) => ({ playerId: herosurvPlayerId(row.userId), displayName: row.name, score: row.score, achievedAt: row.at.replace('T', ' ').slice(0, 23),
        durationMs: row.durationMs, rank: i + 1, meta: row.meta, mine: row.userId === account });
      const mine = rows.findIndex((row) => row.userId === account);
      return sendJson(res, 200, { namespace: 'production', boardId: m[1], rulesVersion: m[1].slice(7), trust: 'client_reported', total: rows.length,
        entries: rows.slice(0, limit).map(view), myRank: mine < 0 ? { rank: null, score: null, ...me } : { rank: mine + 1, score: rows[mine].score, ...me } });
    }
    m = /^boards\/(heroes-r\d{1,3})\/runs$/.exec(route);
    if (m && req.method === 'POST') {
      if (!checkRateLimit(`herosurv:${account}`, 30, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
      const now = nowMs();
      for (const [id, run] of herosurvRuns) if (now - run.at > HEROSURV_RUN_MS) herosurvRuns.delete(id);
      const runId = crypto.randomUUID();
      herosurvRuns.set(runId, { account, board: m[1], at: now });
      if (herosurvLatest !== m[1]) { herosurvLatest = m[1]; pointStore.setWorldValue('herosurvBoard', m[1]).catch(() => {}); } // (게임별 랭킹 follows the game's board)
      return sendJson(res, 201, { runId, expiresInSeconds: HEROSURV_RUN_MS / 1000, rulesVersion: m[1].slice(7), protocolVersion: 1 });
    }
    m = /^runs\/([0-9a-f-]{36})$/.exec(route);
    if (m && req.method === 'PUT') {
      const run = herosurvRuns.get(m[1]);
      if (!run || run.account !== account || run.saving) return sendError(res, 404, 'NO_RUN', '끝난 판입니다.');
      run.saving = true; // one result per run: used up once saved (or refused), open again if saving failed
      try {
        const body = await parseJson(req);
        const durationMs = Number(body.durationMs);
        if (durationMs > nowMs() - run.at + 60 * 1000) throw new RangeError('longer than the run really was');
        const out = await pointStore.herosurvRun({ userId: account, board: run.board, name: me.displayName, score: Number(body.score), durationMs, meta: body.meta });
        herosurvRuns.delete(m[1]);
        return sendJson(res, 200, { runId: m[1], score: Number(body.score), accepted: true, personalBest: out.personalBest, trust: 'client_reported' });
      } catch (error) {
        if (!(error instanceof TypeError || error instanceof RangeError)) { run.saving = false; throw error; }
        herosurvRuns.delete(m[1]);
        return sendError(res, 400, 'BAD_RUN', '잘못된 기록입니다.');
      }
    }
    return sendError(res, 404, 'NOT_FOUND', '찾을 수 없습니다.');
  }
  // Test-only: where the mines are (and the game made older, as if played longer); a quest step's activity noted
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/solo/peek' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const g = soloGames.get(session.token); const body = await parseJson(req);
    if (!g?.engine.game.mine) return sendError(res, 409, 'NO_GAME', '새 게임을 시작해 주세요.');
    if (Number(body.ageMs) > 0) g.engine.game.startedAt -= Number(body.ageMs);
    return sendJson(res, 200, { ok: true, mines: Array.from(g.engine.game.mine.keys()).filter((i) => g.engine.game.mine[i]) });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/cards/run' && req.method === 'POST') { // a deal fixed, made older
    const body = await parseJson(req); const run = cardRuns.get(String(body.id || ''));
    if (!run) return sendError(res, 409, 'NO_GAME', '끝난 판입니다.');
    if (Number.isSafeInteger(body.seed)) run.seed = body.seed;
    run.at -= Number(body.ageMs) || 0;
    return sendJson(res, 200, { ok: true });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/reflex/age' && req.method === 'POST') { // a round made older
    const body = await parseJson(req); const run = reflexRuns.get(String(body.id || ''));
    if (!run) return sendError(res, 409, 'NO_GAME', '끝난 판입니다.');
    run.at -= Number(body.ageMs) || 0;
    return sendJson(res, 200, { ok: true });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/quest/note' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req); const account = pointAccountForSession(session);
    await questState(account);
    const scope=body.scope==='fixed'?'fixed':'week';
    const out = await questApply(account, (doc) => { const next = IslandQuests.note(doc, String(body.what), { qty: Number(body.qty) || 1,scope }); return next ? { doc: next, reward: 0 } : null; },scope);
    return sendJson(res, 200, { ok: true, doc: out?.doc || null });
  }
  if (pathname === '/api/island/weeds' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const state = await weedState();
    return sendJson(res, 200, { ok: true, day: state.day, weeds: IslandWeeds.active(state).map((w) => [w.id, w.x, w.z]), pullMs: IslandWeeds.PULL_MS });
  }
  if (['/api/island/weed/start', '/api/island/weed/finish', '/api/island/weed/cancel'].includes(pathname) && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (!checkRateLimit(`island-weed:${session.token}`, 120, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    if (pathname.endsWith('/cancel')) { if ((!body.weedId || weedPulls.get(session.token)?.weedId===body.weedId) && !weedPulls.get(session.token)?.result) weedPulls.delete(session.token); collectionPose(session.token); return sendJson(res, 200, { ok: true }); }
    const weedId = typeof body.weedId === 'string' && /^(w\d{1,5}|g\d{4,6}-\d{1,5})$/.test(body.weedId) ? body.weedId : null;
    if (!weedId) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    const now = nowMs();
    const near = (w) => { const at = plazaPresence.get(session.token) || plazaLastPos.get(session.token); return at && Math.hypot(at.x - w.x, at.z - w.z) <= IslandWeeds.REACH; };
    if (pathname === '/api/island/weed/start') {
      const weed = IslandWeeds.find(await weedState(now), weedId);
      if (!weed) return sendError(res, 409, 'WEED_GONE', '이미 사라졌습니다.');
      if (!near(weed)) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
      if (resourcePulls.get(session.token) && !resourcePulls.get(session.token).result) return sendError(res, 409, 'COLLECT_BUSY', '채집 중입니다.');
      const pos = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
      weedPulls.set(session.token, { weedId, at: now, ms: IslandWeeds.PULL_MS, anim: 'gather', pos: { x: pos.x, z: pos.z }, target: { x: weed.x, z: weed.z } });
      collectionPose(session.token,weedPulls.get(session.token));
      return sendJson(res, 200, { ok: true, pullMs: IslandWeeds.PULL_MS });
    }
    if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId)) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    const pull = weedPulls.get(session.token);
    if (pull?.result && pull.requestId === body.requestId) return sendJson(res, 200, pull.result); // the same finish again (a lost answer)
    if (!pull || pull.weedId !== weedId || pull.result) return sendError(res, 409, 'WEED_NOT_STARTED', '다시 시도해 주세요.');
    if (now - pull.at < IslandWeeds.PULL_MS) return sendError(res, 409, 'WEED_TOO_SOON', '다시 시도해 주세요.');
    const weed = IslandWeeds.find(await weedState(now), weedId);
    if (weed && !near(weed)) { weedPulls.delete(session.token); return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.'); }
    const account = pointAccountForSession(session);
    const outcome = await pointStore.islandPullWeed({ userId: account, requestId: body.requestId, weedId }, now);
    if (outcome.reason === 'full') { weedPulls.delete(session.token); return sendError(res, 409, 'BAG_FULL', '가방이 가득 찼습니다.'); }
    if (outcome.reason === 'gone' || !weed) { weedPulls.delete(session.token); broadcastIsland('islandWeed', { gone: [weedId] }); return sendError(res, 409, 'WEED_GONE', '이미 사라졌습니다.'); }
    const result = { ok: true, weedId, bag: outcome.bag, bonus: outcome.bonus || 0, balance: outcome.balance ?? null };
    weedPulls.set(session.token, { ...pull, requestId: body.requestId, result }); collectionPose(session.token);
    if (outcome.applied) {
      broadcastIsland('islandWeed', { gone: [weedId] });
      islandProgress('weed_pull', account, 1); contestNote(account, session, 'weed', 1); // (A4: a contest pull)
      if (outcome.bonus) notifyPointsChanged([account]);
    }
    return sendJson(res, 200, result);
  }
  // v1.10.11 공용 이벤트: solving one (standing at it). Taking it is decided at once (two players can never both get
  // it); the bag or the points follow, and if they cannot (a full bag, today's limit) the event stays for anyone.
  // v1.10.42 낚시 (IDEAS ①): a cast where one may fish -- the server picks the fish and when it bites; pulling in within
  // the bite puts it in the bag (once per cast: a retry gets the same answer) and in the 도감; early or late, nothing lost
  if (pathname === '/api/island/fish/start' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (!checkRateLimit(`island-fish:${session.token}`, 30, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const at = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
    if (!at || !IslandFishing.canFish(at.x, at.z)) return sendError(res, 409, 'NOT_FISHING_SPOT', '물가에서 낚시할 수 있습니다.');
    const now = nowMs(); const water = IslandFishing.waterAt(at.x, at.z); const held = (await pointStore.worldValue('season'))?.day; const season = (Number.isInteger(held) ? IslandTerrain.zoneSeason(IslandTerrain.seasonZoneAt(at.x, at.z), held) : IslandTerrain.seasonAt(at.x, at.z, now)) || 'summer'; // (A5: a held arrangement) // v1.10.90: the river or the sea, and that spot's season today
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    // v1.10.92 잡화점 미끼: a bait in the bag goes on this cast by itself (the better one first)
    const account = pointAccountForSession(session); const bag = (await pointStore.islandBag(account)).items || [];
    if (!bag.some((e) => e.itemId === 'fishing_rod')) return sendError(res, 409, 'NO_ROD', '낚싯대가 필요해요. 잡화점에서 살 수 있어요.'); // (사용자 2026-10-18)
    let bait = ['bait_premium', 'bait'].find((b) => bag.some((e) => e.itemId === b)) || null;
    if (bait && !(await pointStore.islandUse({ userId: account, requestId: `bait-${id}`, itemId: bait })).applied) bait = null;
    const rain = IslandWeather.weatherAt(now, (await pointStore.worldValue('weather'))?.mode).kind === 'rain'; // (A4: rain helps the catch)
    const c = IslandFishing.cast(now, Math.random, { water, season, bait, rain });
    fishCasts.set(session.token, { id, ...c, at: { x: at.x, z: at.z }, done: null });
    return sendJson(res, 200, { ok: true, fishId: id, biteIn: c.biteAt - now, window: IslandFishing.BITE_MS, bait: bait ? IslandItems.ITEMS[bait].name : null });
  }
  if (pathname === '/api/island/fish/finish' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const c = fishCasts.get(session.token);
    if (!c || c.id !== body.fishId) return sendError(res, 409, 'FISH_GONE', '놓쳤습니다.');
    if (c.done) return sendJson(res, 200, c.done); // the same cast asked again (a lost answer)
    const verdict = IslandFishing.judge(c, nowMs());
    if (verdict !== 'ok') { fishCasts.delete(session.token); return sendError(res, 409, verdict === 'early' ? 'FISH_EARLY' : 'FISH_LATE', verdict === 'early' ? '아직 입질이 없었어요.' : '놓쳤습니다.'); }
    const at = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
    if (!at || Math.hypot(at.x - c.at.x, at.z - c.at.z) > IslandFishing.MOVE_R) { fishCasts.delete(session.token); return sendError(res, 409, 'FISH_GONE', '놓쳤습니다.'); }
    const account = pointAccountForSession(session);
    const itemId = `fish_${c.species}`;
    const outcome = await pointStore.islandGive({ userId: account, claimId: `fish:${c.id}`, itemId, qty: 1, meta: null, dexEntry: itemId }, nowMs());
    if (outcome.reason === 'full') { fishCasts.delete(session.token); return sendError(res, 409, 'BAG_FULL', '가방이 가득 찼습니다.'); }
    const dex = outcome.dex;
    const f = IslandFishing.SPECIES[c.species];
    c.done = { ok: true, species: c.species, name: f.name, grade: f.grade, price: f.price, firstTime: dex.first, bag: outcome.bag };
    if (outcome.applied) { islandProgress('fish', account, 1); contestNote(account, session, 'fish', f.price); } // (A4: a contest catch)
    return sendJson(res, 200, c.done);
  }
  // B 47 곤충 채집: a 잠자리채 in the bag, on the island's grass (not the plaza); the server picks what comes and when
  if (pathname === '/api/island/bug/start' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    if (!checkRateLimit(`island-bug:${session.token}`, 30, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const account = pointAccountForSession(session); const bag = (await pointStore.islandBag(account)).items || [];
    if (!bag.some((e) => e.itemId === 'bugnet')) return sendError(res, 409, 'NO_BUGNET', '잠자리채가 필요해요. 잡화점에서 살 수 있어요.');
    const at = plazaPresence.get(session.token);
    if (!at || (at.space || 'island') !== 'island' || Math.hypot(at.x, at.z) < IslandTerrain.PLAZA_R + 2 || !IslandTerrain.walkable(at.x, at.z) || IslandTerrain.walkDist(at.x, at.z) < 2) return sendError(res, 409, 'NOT_BUG_SPOT', '광장과 길 밖, 풀밭에서 채집할 수 있어요.');
    const now = nowMs(); const held = (await pointStore.worldValue('season'))?.day; const zone = IslandTerrain.seasonZoneAt(at.x, at.z);
    const season = Number.isInteger(held) ? IslandTerrain.zoneSeason(zone, held) : IslandTerrain.seasonAt(at.x, at.z, now);
    const mode = (await pointStore.worldValue('time'))?.mode || 'auto'; const hour = new Date(now + 9 * 3600000).getUTCHours();
    const night = mode === 'night' || (mode === 'auto' && (hour >= 20 || hour < 6));
    const rain = IslandWeather.weatherAt(now, (await pointStore.worldValue('weather'))?.mode).kind === 'rain';
    const c = IslandInsects.swing(now, Math.random, { season: season || 'summer', night, rain });
    if (!c) return sendError(res, 409, 'NO_BUGS', season === 'winter' ? '겨울 구역에는 곤충이 없어요.' : '지금 여기에는 곤충이 없어요.');
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    bugSwings.set(session.token, { id, ...c, at: { x: at.x, z: at.z }, done: null });
    const b = IslandInsects.SPECIES[c.species];
    return sendJson(res, 200, { ok: true, bugId: id, species: c.species, name: b.name, comeIn: c.comeAt - now, window: IslandInsects.CATCH_MS });
  }
  if (pathname === '/api/island/bug/finish' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const body = await parseJson(req); const c = bugSwings.get(session.token);
    if (!c || c.id !== body.bugId) return sendError(res, 409, 'BUG_GONE', '놓쳤어요.');
    if (c.done) return sendJson(res, 200, c.done);
    const verdict = IslandInsects.judge(c, nowMs()); const at = plazaPresence.get(session.token);
    if (verdict !== 'ok' || !at || Math.hypot(at.x - c.at.x, at.z - c.at.z) > IslandInsects.MOVE_R) { bugSwings.delete(session.token); return sendError(res, 409, verdict === 'early' ? 'BUG_EARLY' : 'BUG_GONE', verdict === 'early' ? '아직 오지 않았어요.' : '놓쳤어요.'); }
    const account = pointAccountForSession(session); const itemId = `insect_${c.species}`;
    const outcome = await pointStore.islandGive({ userId: account, claimId: `bug:${c.id}`, itemId, qty: 1, meta: null, dexEntry: itemId }, nowMs());
    if (outcome.reason === 'full') { bugSwings.delete(session.token); return sendError(res, 409, 'BAG_FULL', '가방이 가득 찼습니다.'); }
    const b = IslandInsects.SPECIES[c.species];
    c.done = { ok: true, species: c.species, name: b.name, grade: b.grade, price: b.price, firstTime: outcome.dex?.first || false, bag: outcome.bag };
    return sendJson(res, 200, c.done);
  }
  if (pathname === '/api/island/bug/cancel' && req.method === 'POST') { const session = requireSession(req, res); if (!session) return; bugSwings.delete(session.token); return sendJson(res, 200, { ok: true }); }
  if (pathname === '/api/island/fish/cancel' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    fishCasts.delete(session.token);
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/island/photo' && req.method === 'POST') { // v1.10.43 기념사진: taken near a photo spot -> kept (spot and day only)
    const session = requireSession(req, res);
    if (!session) return;
    if (!checkRateLimit(`island-photo:${session.token}`, 20, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const at = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
    const spot = at && IslandFishing.photoSpotAt(at.x, at.z);
    if (!spot) return sendJson(res, 200, { ok: true, spot: null });
    const dex = await pointStore.dexNote({ userId: pointAccountForSession(session), entry: spot.id });
    return sendJson(res, 200, { ok: true, spot: { id: spot.id, name: spot.name }, first: dex.first });
  }
  if (pathname === '/api/island/dex' && req.method === 'GET') { // v1.10.42 도감: what I have found (silhouettes for the rest)
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    const mine = await pointStore.dexOf(account);
    const found = IslandFishing.collectionCount(mine);
    return sendJson(res, 200, { ok: true, entries: [...IslandFishing.DEX,...IslandFishing.MEMORIES].map((d) => ({ ...d, count: mine[d.id]?.count || 0, first: mine[d.id]?.first || null })), found, total: IslandFishing.DEX.length,
      titles: IslandFishing.DEX_TITLES.map((t) => ({ ...t, open: found >= t.need })) });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/fish/bite' && req.method === 'POST') { // tests: the bite now
    const session = requireSession(req, res);
    if (!session) return;
    const c = fishCasts.get(session.token); const body = await parseJson(req);
    if (c) { c.biteAt = nowMs(); if (typeof body.species === 'string' && IslandFishing.SPECIES[body.species]) c.species = body.species; }
    return sendJson(res, 200, { ok: Boolean(c) });
  }
  // v1.10.44 앉기: a free seat right by me is mine until I stand (or leave the island)
  // v1.10.47 관광열차: get on the train standing at the stop I am at (a free seat of its four), and off at whichever stop
  // it stands at (onto that stop's boarding spot)
  if (pathname === '/api/island/train/platform' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const body = await parseJson(req); const station = IslandTrain.stationOf(String(body.stop || '')); const line = String(body.line || '');
    if (!station || (line !== 'ground' && !IslandTrain.LINES[line]?.order.includes(station.id))) return sendError(res, 400, 'BAD_REQUEST', '잘못된 승강장입니다.');
    if (trainRiders.has(session.token)) return sendError(res, 409, 'ALREADY_RIDING', '정류장에서 먼저 내려 주세요.');
    const prev = trainVisitors.get(session.token); const pos = plazaPresence.get(session.token);
    if (!pos || (prev ? prev.station !== station.id : Math.hypot(pos.x - station.spot.x, pos.z - station.spot.z) > 3.5)) return sendError(res, 409, 'TOO_FAR', '역 가까이 가서 다시 시도해 주세요.');
    let platform = null; let spot = station.spot;
    if (line !== 'ground') {
      const taken = new Set([...trainVisitors].filter(([token, v]) => token !== session.token && v.station === station.id && v.line === line).map(([, v]) => v.slot));
      const slot = Array.from({ length: 12 }, (_, i) => i).find((i) => !taken.has(i));
      if (slot === undefined) return sendError(res, 409, 'PLATFORM_FULL', '승강장이 가득 찼습니다.');
      platform = { station: station.id, line, slot }; spot = IslandTrain.platformSpot(line, station.id, slot); trainVisitors.set(session.token, platform);
    } else trainVisitors.delete(session.token);
    freeSeat(session.token); fishCasts.delete(session.token);
    Object.assign(pos, { x: spot.x, z: spot.z, platform, moving: false }); plazaDirty = true;
    plazaLastPos.set(session.token, station.spot); notePlazaSpot(pointAccountForSession(session), station.spot.x, station.spot.z);
    return sendJson(res, 200, { ok: true, ...spot, platform });
  }
  if (pathname === '/api/island/train/board' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const stop = IslandTrain.stationOf(String(body.stop || ''));
    if (!stop) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    if (trainRiders.has(session.token)) return sendError(res, 409, 'ALREADY_RIDING', '이미 열차에 타고 있습니다.');
    const visitor = trainVisitors.get(session.token);
    if (!visitor || visitor.station !== stop.id) return sendError(res, 409, 'TOO_FAR', '정류장 가까이 가서 다시 시도해 주세요.');
    const line = body.line == null ? visitor.line : String(body.line);
    if (line !== visitor.line || !IslandTrain.LINES[line]?.order.includes(stop.id)) return sendError(res, 400, 'BAD_REQUEST', '잘못된 노선입니다.');
    const docked = trainDocked(stop.id, null, line);
    if (!docked) return sendError(res, 409, 'NO_TRAIN', '열차가 아직 오지 않았습니다.');
    const taken = new Set([...trainRiders.values()].filter((r) => r.id === docked.id).map((r) => r.seat));
    const seat = IslandTrain.SEATS.findIndex((_, i) => !taken.has(i));
    if (seat < 0) return sendError(res, 409, 'TRAIN_FULL', '열차가 가득 찼습니다. 다음 열차를 기다려 주세요.');
    freeSeat(session.token); fishCasts.delete(session.token);
    trainVisitors.delete(session.token);
    trainRiders.set(session.token, { id: docked.id, seat, from: stop.id });
    return sendJson(res, 200, { ok: true, train: docked.id, seat, stop: stop.id });
  }
  if (pathname === '/api/island/train/alight' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const ride = trainRiders.get(session.token);
    if (!ride) return sendError(res, 409, 'NOT_RIDING', '열차에 타고 있지 않습니다.');
    const docked = trainDocked(null, ride.id);
    if (!docked) return sendError(res, 409, 'MOVING', '열차가 정류장에 서면 내릴 수 있습니다.');
    const taken = new Set([...trainVisitors.values()].filter((v) => v.station === docked.stop && v.line === docked.line).map((v) => v.slot));
    const slot = Array.from({ length: 12 }, (_, i) => i).find((i) => !taken.has(i));
    const platform = slot === undefined ? null : { station: docked.stop, line: docked.line, slot };
    const spot = platform ? IslandTrain.platformSpot(platform.line, platform.station, slot) : IslandTrain.stationOf(docked.stop).spot;
    if (platform) trainVisitors.set(session.token, platform);
    trainRiders.delete(session.token);
    const ground = IslandTrain.stationOf(docked.stop).spot; plazaLastPos.set(session.token, ground); notePlazaSpot(pointAccountForSession(session), ground.x, ground.z);
    const entry = plazaPresence.get(session.token); if (entry) { entry.x = spot.x; entry.z = spot.z; entry.ride = null; entry.platform = platform; plazaDirty = true; }
    return sendJson(res, 200, { ok: true, ...spot, platform, stop: docked.stop });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/train-shift' && req.method === 'POST') { // tests: the trains' clock moved on (ms)
    const body = await parseJson(req); trainShift = Number.isFinite(Number(body.ms)) ? Number(body.ms) : 0;
    trainTraffic = IslandTrain.createTraffic(trainNow());
    return sendJson(res, 200, { ok: true, trainShift, trainService: trainService() });
  }
  if (pathname === '/api/island/sit' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const seat = SEATS.get(String(body.seat || ''));
    if (!seat) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    const at = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
    if (!at || Math.hypot(at.x - seat.x, at.z - seat.z) > 2.8) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    const holder = seatTaken.get(seat.id);
    if (holder && holder !== session.token && plazaPresence.has(holder)) return sendError(res, 409, 'SEAT_TAKEN', '다른 사람이 앉아 있습니다.');
    freeSeat(session.token); seatTaken.set(seat.id, session.token);
    return sendJson(res, 200, { ok: true, seat: seat.id });
  }
  if (pathname === '/api/island/stand' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    freeSeat(session.token);
    return sendJson(res, 200, { ok: true });
  }
  // v1.10.44 게임 초대: from the island -- the room I have just made, to the player I asked (their island id)
  if (pathname === '/api/island/invite/prepare' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    prunePlazaPresence();
    const body = await parseJson(req);
    const target = [...sessions.entries()].find(([token, s]) => token !== session.token && s.plazaId === body.plazaId && !s.currentRoomId);
    const from = plazaPresence.get(session.token); const to = target && plazaPresence.get(target[0]);
    if (!from || !to || session.currentRoomId) return sendError(res, 404, 'RECIPIENT_NOT_FOUND', '상대가 섬을 떠났습니다.');
    if (Math.hypot(from.x - to.x, from.z - to.z) >= 2.2) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    for (const [token, intent] of islandInviteIntents) if (nowMs() - intent.at > 5 * 60 * 1000 || !sessions.has(token)) islandInviteIntents.delete(token);
    islandInviteIntents.set(session.token, { target: target[0], at: nowMs() });
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/island/invite' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    if (!room || !isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 초대할 수 있습니다.');
    if (!checkRateLimit('room-invite:' + session.token.slice(0, 12), 12, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_INVITES', '초대를 너무 많이 보냈습니다. 잠시 뒤 다시 시도해 주세요.');
    const body = await parseJson(req);
    const target = [...sessions.entries()].find(([token, s]) => s.plazaId && s.plazaId === body.plazaId && token !== session.token);
    const intent = islandInviteIntents.get(session.token);
    islandInviteIntents.delete(session.token);
    prunePlazaPresence();
    if (!target || target[1].currentRoomId || !plazaPresence.has(target[0])) return sendError(res, 404, 'RECIPIENT_NOT_FOUND', '상대가 섬을 떠났습니다.');
    if (!intent || intent.target !== target[0] || nowMs() - intent.at > 5 * 60 * 1000) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    pruneInvitations();
    const pending = [...invitations.values()].filter((invite) => invite.toToken === target[0]);
    if (pending.some((invite) => invite.roomId === room.id)) return sendError(res, 409, 'ALREADY_INVITED', '이미 초대를 보냈습니다.');
    if (pending.length >= 5) return sendError(res, 409, 'INVITE_INBOX_FULL', '상대가 받은 초대가 많습니다. 잠시 뒤 다시 시도해 주세요.');
    const inviteId = newSecret(16);
    invitations.set(inviteId, { fromToken: session.token, toToken: target[0], roomId: room.id, createdAt: nowMs() });
    broadcastLobby();
    return sendJson(res, 201, { ok: true, id: inviteId, to: String(target[1].label || '') });
  }
  if (pathname === '/api/island/mayor' && req.method === 'POST') { // v1.10.41: asking the mayor at the gate -- in for this visit
    const session = requireSession(req, res);
    if (!session) return;
    if (!checkRateLimit(`island-mayor:${session.token}`, 20, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const at = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
    if (!at || Math.hypot(at.x - TOWNHALL_GATE_OUT.x, at.z - TOWNHALL_GATE_OUT.z) > 3.5) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    townhallPass.add(session.token);
    return sendJson(res, 200, { ok: true, townhallPass: true });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/townhall-strict' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    townhallStrict.add(session.token); townhallPass.delete(session.token);
    return sendJson(res, 200, { ok: true });
  }
  if (['/api/island/event', '/api/island/resource/start', '/api/island/resource/finish', '/api/island/resource/cancel'].includes(pathname) && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (!checkRateLimit(`island-event:${session.token}`, pathname === '/api/island/event' ? 60 : 120, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    if (pathname.endsWith('/cancel')) { if ((!body.id || resourcePulls.get(session.token)?.id===body.id) && !resourcePulls.get(session.token)?.result) resourcePulls.delete(session.token); collectionPose(session.token); return sendJson(res, 200, { ok: true }); }
    const id = typeof body.id === 'string' && /^[a-z0-9]{2,24}$/.test(body.id) ? body.id : null;
    if (!id) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    const account = pointAccountForSession(session);
    const resource = islandEvents.events.get(id);
    const isResource = resource && !resource.npc;
    let pull = resourcePulls.get(session.token);
    if (pathname.endsWith('/start')) {
      if (getCurrentRoom(session) || trainRiders.has(session.token) || trainVisitors.has(session.token)) return sendError(res, 409, 'COLLECT_BUSY', '지상에서 다시 시도해 주세요.');
      if (!isResource || resource.state !== 'open' || resource.busy) return sendError(res, 409, 'EVENT_GONE', '이미 사라졌습니다.');
      const pos = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
      if (!pos || Math.hypot(pos.x-resource.x,pos.z-resource.z)> (resource.tree ? 1.7 : 2.5)) return sendError(res,409,'TOO_FAR','가까이 가서 다시 시도해 주세요.');
      if ([pull,weedPulls.get(session.token)].some(p => p && !p.result && nowMs()-p.at < 15000)) return sendError(res,409,'COLLECT_BUSY','채집 중입니다.');
      const ms = resource.tree ? 1800 : 1000; const anim = resource.tree ? 'pickFruit' : 'pickup';
      const stand = resource.tree ? {x:resource.x,z:resource.z} : {x:pos.x,z:pos.z};
      if (resource.tree && [...plazaPresence].some(([token,p]) => token !== session.token && Math.hypot(p.x-stand.x,p.z-stand.z)<0.9)) return sendError(res,409,'COLLECT_BUSY','자리가 비면 다시 시도해 주세요.');
      pull = { id, generation:resource.generation, at:nowMs(), ms, anim, pos:stand, target:resource.tree || {x:resource.x,z:resource.z} };
      resourcePulls.set(session.token,pull); collectionPose(session.token,pull);
      return sendJson(res,200,{ok:true,id,ms,anim,target:pull.target,pos:stand});
    }
    if (pathname.endsWith('/finish')) {
      if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId)) return sendError(res,400,'BAD_REQUEST','잘못된 요청입니다.');
      if (pull?.result && pull.requestId === body.requestId && pull.id === id) return sendJson(res,200,pull.result);
      if (!pull || pull.result || pull.id !== id || nowMs()-pull.at > 15000) return sendError(res,409,'COLLECT_NOT_STARTED','다시 시도해 주세요.');
      if (nowMs()-pull.at < pull.ms) return sendError(res,409,'COLLECT_TOO_SOON','다시 시도해 주세요.');
      if (!isResource || resource.state !== 'open' || resource.generation !== pull.generation) { resourcePulls.delete(session.token); return sendError(res,409,'EVENT_GONE','이미 사라졌습니다.'); }
    } else if (isResource) return sendError(res,409,'COLLECT_NOT_STARTED','채집을 시작해 주세요.');
    if (id.startsWith('quest') && IslandQuests.isOpen(id.slice(5), nowMs())) { // v1.10.37 연계 퀘스트: talking to the islander
      const story = id.slice(5); const pos = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
      const week = IslandQuests.scopeOf(story)==='fixed'?'fixed':questWeek();
      const st=await questState(account);
      if(!IslandQuests.visibleStories(st.doc,nowMs()).includes(story)) return sendError(res,409,'QUEST_BUSY','지금은 받을 수 없는 부탁입니다.');
      // A2b: a puzzle step is today's 오늘의 문제 -- already solved today (in the game hall), it counts at once
      const puzzleDone = async () => { const d = (await questState(account)).doc[story]; const s = IslandQuests.STORIES[story].steps[d?.step]; if (!d?.taken || d.done || !s?.puzzle || d.count >= 1 || !(await puzzleSolved(account, s.game, s.level))) return false; await islandProgress(`minigame:${s.game}`, account, 1); return true; };
      await puzzleDone();
      const out = await questApply(account, (doc, bag) => { const r = IslandQuests.talk(doc, story, bag, pos); return r.error ? r : { ...r, payKey: `quest:${week}:${account}:${story}:${r.step}` }; },IslandQuests.scopeOf(story));
      if (out?.error === 'TOO_FAR') return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
      if (out?.error) return sendError(res, 409, 'QUEST_BUSY', '잠시 후 다시 말을 걸어 주세요.');
      const r = out || IslandQuests.talk((await questState(account)).doc, story, (await questState(account)).bag, pos); // nothing changed: what they say now
      if (r.reward) notifyPointsChanged([account]);
      const solvedToday = await puzzleDone(); // (a step just taken)
      const keeperN = IslandCast.keeperN(story); let keeperLevel = 1; // v1.10.91 호감도: a talk a day, a story step
      if (keeperN != null) { keeperLevel = IslandCast.levelOf((await pointStore.affinityOf(account))[keeperN] || 0); await pointStore.affinityAdd(account, kstDate(nowMs()), [{ n: keeperN, delta: IslandCast.GAIN.talk, daily: true }, ...(r.paid ? [{ n: keeperN, delta: IslandCast.GAIN.story }] : [])]); }
      if (story === 'farmer' && r.paid) islandFarmAt = 0; // the field may grow at once
      if (['painter', 'busker', 'electrician', 'builder', 'librarian'].includes(story) && r.paid) villageAt = 0; // (v1.10.93: the mural, the stage, the lamps, the stones, the cart)
      const quests = questEntries(account);
      // v1.10.80: a game step now under way -- which round to open ([도와줄게요] in the talk)
      const cur = (await questState(account)).doc[story]; const stepNow = IslandQuests.STORIES[story].steps[cur?.step];
      const minigame = cur?.taken && !cur.done && stepNow?.kind === 'minigame' && !(cur.count >= 1) ? { game: stepNow.game, level: stepNow.level, ...(stepNow.puzzle ? { goal: null, puzzle: true } : stepNow.ai ? { goal: null, ai: true } : { goal: stepNow.need }) } : null;
      return sendJson(res, 200, { ok: true, action: 'quest', story, minigame, fixed:Boolean(IslandQuests.STORIES[story].fixed), name: IslandQuests.STORIES[story].name, say: solvedToday ? `${r.say} …어? 오늘 문제는 벌써 풀었네요! 다시 말을 걸어 주세요.` : r.done && !r.reward && Math.random() < 0.7 ? IslandCast.keeperLine(story, Math.random, keeperLevel, String(session.label || '')) || r.say : r.say /* v1.10.91: their own words (by 호감도) once the story is done */, reward: r.reward || 0, done: Boolean(r.done), waiting: Boolean(r.waiting),
        balance: out?.balance ?? null, track: quests.track, events: pos ? [...islandEvents.nearby(pos.x, pos.z, account), ...quests.entries] : quests.entries });
    }
    const claimed = islandEvents.claim(id, account, plazaPresence.get(session.token) || plazaLastPos.get(session.token), { owner: body.owner === true });
    if (claimed.error === 'TOO_FAR') return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    if (claimed.error) { resourcePulls.delete(session.token); return sendError(res, 409, 'EVENT_GONE', '이미 사라졌습니다.'); }
    if (claimed.action === 'talk') { // v1.10.34: the owner's request -- where the thing lies, for my map; nothing paid
      const at = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
      return sendJson(res, 200, { ok: true, action: 'talk', points: claimed.points, at: { x: claimed.event.x, z: claimed.event.z }, residents: islandEvents.residents(), events: at ? islandEvents.nearby(at.x, at.z, account) : [] });
    }
    let outcome;
    try {
      if (claimed.action === 'item' || claimed.action === 'pickup') outcome = await pointStore.islandGive({ userId: account, claimId: isResource ? `event:${id}:${pull.generation}` : `event:${id}`, itemId: claimed.item, qty: claimed.qty, meta: claimed.meta || null, dexEntry: IslandFishing.DEX_IDS.has(claimed.item) ? claimed.item : null }, nowMs());
      else outcome = await pointStore.islandReward({ userId: account, claimId: claimed.action === 'return' ? `event-return:${id}` : isResource ? `event:${id}:${pull.generation}` : `event:${id}`, amount: claimed.points, title: claimed.title, takeEventId: claimed.action === 'return' ? id : null }, nowMs());
    } catch (error) { islandEvents.settle(claimed, false, account); throw error; }
    if (outcome.reason) {
      resourcePulls.delete(session.token);
      islandEvents.settle(claimed, false, account);
      if (outcome.reason === 'full') return sendError(res, 409, 'BAG_FULL', '가방이 가득 찼습니다.');
      if (outcome.reason === 'cap') return sendError(res, 409, 'DAILY_CAP', '오늘은 더 받을 수 없습니다.');
      return sendError(res, 409, 'EVENT_GONE', '이미 사라졌습니다.');
    }
    const done = islandEvents.settle(claimed, true, account);
    if (done?.removed) broadcastIslandRemoved([done.removed]);
    if (outcome.applied && claimed.event?.type) islandProgress(claimed.event.type, account, 1); // v1.10.37 연계 퀘스트 (e.g. beach_trash)
    if (claimed.points || outcome.bonus) notifyPointsChanged([account]); // v1.10.31: or the week's life bonus
    const at = plazaPresence.get(session.token) || plazaLastPos.get(session.token);
    const result = { ok: true, action: claimed.action, item: claimed.item ? IslandItems.itemDef(claimed.item) && { id: claimed.item, name: IslandItems.itemDef(claimed.item).name, icon: IslandItems.itemDef(claimed.item).icon, qty: claimed.qty } : null,
      points: claimed.points || 0, bonus: outcome.bonus || 0, balance: outcome.balance ?? null, residents: islandEvents.residents(), events: at ? islandEvents.nearby(at.x, at.z, account) : [] };
    if (isResource) { resourcePulls.set(session.token,{...pull,requestId:body.requestId,result}); collectionPose(session.token); }
    return sendJson(res,200,result);
  }
  // Test-only: every event (tests walk to one), and a fresh set.
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/island/events' && req.method === 'POST') {
    const body=await parseJson(req); const e=islandEvents.events.get(body.grow);
    if(e?.state === 'growing') e.readyAt=nowMs();
    broadcastIslandRemoved(islandEvents.expire()); return sendJson(res,200,{ok:true});
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/island/events' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, events: [...islandEvents.events.values()].map(({ id, type, x, z, npc, state, carrier }) => ({ id, type, x, z, npc: npc || null, state, carrier })) });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/island/star-now' && req.method === 'POST') { // a star falling now
    const t = nowMs(); let slot = Math.floor(t / IslandStars.SLOT_MS) + 1; while (!IslandStars.starOf(slot)) slot += 1;
    const body = await parseJson(req); if (body.reset) { starShiftMs = 0; return sendJson(res, 200, { ok: true }); }
    starShiftMs = IslandStars.starOf(slot).at + 500 - t + (Number(body.plusMs) || 0); return sendJson(res, 200, { ok: true, id: IslandStars.starOf(slot).id });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/notices/due' && req.method === 'POST') { await postDueNotices(); return sendJson(res, 200, { ok: true }); } // (tests: not waiting 30 s)
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/contest/clock' && req.method === 'POST') { // move the contest's clock: 'live' (1 min in), 'end' (just after), 'reset'
    const body = await parseJson(req); const cfg = (await pointStore.worldValue('contest'))?.config; const k = IslandContest.weekContest(nowMs(), cfg);
    contestShiftMs = body.to === 'live' ? k.start + 60000 - nowMs() : body.to === 'end' ? k.end + 1000 - nowMs() : 0;
    if (body.to === 'live' && (await pointStore.worldValue('contestResult'))?.id === k.id) { await pointStore.setWorldValue('contestResult', null); contestBoard = { id: null, rows: new Map() }; } // (the real clock may have closed this week's contest already, empty)
    contestKindTest = body.to === 'reset' ? null : IslandContest.KINDS[body.kind] ? body.kind : contestKindTest;
    const c = await contestState(); if (c.phase === 'done') await settleContest(c); contestPhase = c.phase; broadcastIsland('contest', { phase: c.phase, id: c.id });
    return sendJson(res, 200, { ok: true, phase: c.phase, kind: c.kind, id: c.id });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/island/free-residents' && req.method === 'POST') {
    broadcastIslandRemoved(islandEvents.freeResidents()); return sendJson(res, 200, { ok: true });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/island/lost' && req.method === 'POST') {
    const e = islandEvents.spawnLost();
    return sendJson(res, 200, { ok: Boolean(e), event: e && { id: e.id, x: e.x, z: e.z, npc: e.npc } });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/island/give' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const result = await pointStore.islandGive({ userId: pointAccountForSession(session), claimId: crypto.randomUUID(), itemId: String(body.itemId), qty: Number(body.qty) || 1, meta: body.meta || null }, nowMs());
    return sendJson(res, 200, { ok: true, ...result });
  }

  // v1.10.9 작명소: my nickname, the price and when I may change it again.
  if (pathname === '/api/nickname' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const state = session.guestKeyId ? await pointStore.nicknameState(pointAccountForSession(session)) : null;
    const until = state && Date.parse(state.until) > nowMs() ? state.until : null;
    return sendJson(res, 200, { ok: true, name: session.label || '', fee: NICKNAME_FEE, until, allowed: Boolean(session.guestKeyId), balance: pointStore.cachedBalance?.(pointAccountForSession(session)) ?? null });
  }
  // A paid change (IDEAS 「작명소」, 사용자 확정 2026-10-04): Korean letters, digits and spaces only (spaces kept as
  // typed), unique in the whole game center comparing names with every space removed, 100,000P, then 24 hours before
  // the next change. Nothing is taken for a bad name, a taken name, the wait, too few points or a failure here; the
  // same request sent again is answered without a second charge.
  if (pathname === '/api/nickname' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (!session.guestKeyId) return sendError(res, 403, 'NICKNAME_GUEST_ONLY', '관리자 이름은 바꿀 수 없습니다.');
    if (getCurrentRoom(session)) return sendError(res, 409, 'IN_ROOM', '현재 게임 방에 참여 중입니다.');
    if (!checkRateLimit(`nickname:${session.guestKeyId}`, 20, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const name = typeof body.name === 'string' ? body.name : '';
    if (!nicknameFormatOk(name)) return sendError(res, 400, 'BAD_NAME', `한글·숫자·공백으로 ${NICKNAME_MAX}자까지 입력해 주세요.`);
    if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId)) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    const account = pointAccountForSession(session);
    return withNicknameLock(async () => {
      const done = await pointStore.nicknameRequest(body.requestId);
      if (done) { // the same request again (its answer was lost): already changed
        if (done.userId !== account) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
        await renameGuest(session.guestKeyId, done.name);
        await pointStore.completeNickname({ userId: account, requestId: body.requestId, name: done.name });
        return sendJson(res, 200, { ok: true, name: done.name, until: new Date(Date.parse(done.changedAt) + NICKNAME_COOLDOWN_MS).toISOString(), balance: done.balanceAfter });
      }
      const keys = await accessStore.list();
      const mine = keys.find((key) => key.id === session.guestKeyId && !key.revokedAt);
      if (!mine) return sendError(res, 404, 'ACTIVE_KEY_NOT_FOUND', '사용 가능한 계정을 찾을 수 없습니다.');
      const wanted = normalizeNickname(name);
      if (normalizeNickname(mine.label) === wanted) return sendError(res, 409, 'SAME_NAME', '지금 쓰는 이름과 같습니다.');
      if (RESERVED_NICKNAMES.has(wanted) || keys.some((key) => key.id !== mine.id && normalizeNickname(key.label) === wanted)) return sendError(res, 409, 'NAME_TAKEN', '이미 쓰고 있는 이름입니다.');
      const now = nowMs();
      const result = await pointStore.chargeNickname({ userId: account, requestId: body.requestId, name }, now);
      if (result.reason === 'request') return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
      if (result.reason === 'cooldown') return sendJson(res, 409, { error: 'NICKNAME_COOLDOWN', message: '이름을 바꾼 지 24시간이 지나야 다시 바꿀 수 있습니다.', until: result.until });
      if (result.reason === 'insufficient') return sendError(res, 409, 'INSUFFICIENT_POINTS', '보유 포인트가 부족합니다.');
      try {
        if (!await renameGuest(mine.id, name)) throw new Error('입장키를 찾을 수 없습니다.');
      } catch (error) { // the name was not saved: the points and the previous wait come back
        console.error('작명소 이름 저장 실패:', error.message);
        await pointStore.refundNickname({ userId: account, requestId: body.requestId, name });
        notifyPointsChanged([account]);
        return sendError(res, 500, 'NICKNAME_FAILED', '이름을 바꾸지 못했습니다. 포인트는 차감되지 않았습니다.');
      }
      await pointStore.completeNickname({ userId: account, requestId: body.requestId, name });
      notifyPointsChanged([account]);
      return sendJson(res, 200, { ok: true, name, until: new Date(now + NICKNAME_COOLDOWN_MS).toISOString(), balance: result.balance ?? result.balanceAfter });
    });
  }
  // v1.10.5 기부: this week's ranking and my total, the statues on show, this week's 호구왕; giving burns the points.
  if (pathname === '/api/donation' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const now = nowMs(); const account = pointAccountForSession(session);
    await settleDonationWeeks(now);
    const week = climbWeekOf(now);
    const ranking = donationRanking(await pointStore.donationWeekRows(week));
    const mine = ranking.find((row) => row.userId === account);
    const hogukingName = (await pointStore.donationWeekResult(previousWeek(week)))?.ranking?.[0]?.name || null;
    return sendJson(res, 200, { ok: true, week, myTotal: mine?.total || 0, myRank: mine?.rank || null,
      ranking: ranking.slice(0, 5).map(({ name, total, rank, userId }) => ({ name, total, rank, me: userId === account })),
      statues: donationCache.statues, statuesWeek: donationCache.statuesWeek, hoguking: hogukingName, isHoguking: isHoguking(account, now),
      balance: pointStore.cachedBalance(account) });
  }
  if (pathname === '/api/donation' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const account = pointAccountForSession(session);
    if (!checkRateLimit(`donation:${account}`, 20, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > DONATION_MAX) return sendError(res, 400, 'BAD_AMOUNT', '기부할 포인트를 입력해 주세요.');
    if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(body.requestId)) return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.');
    const now = nowMs();
    const result = await pointStore.donate({ userId: account, requestId: body.requestId, amount, name: String(session.label || (session.role === 'admin' ? '관리자' : '게스트')) }, now);
    if (result.reason === 'insufficient') return sendError(res, 409, 'INSUFFICIENT_POINTS', '보유 포인트가 부족합니다.');
    notifyPointsChanged([account]);
    return sendJson(res, 200, { ok: true, total: result.total, amount: result.amount, balance: result.balance ?? result.balanceAfter });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/donation/record' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const result = await pointStore.donate({ userId: pointAccountForSession(session), requestId: crypto.randomUUID(), amount: Number(body.amount), name: String(session.label || '게스트') }, Number(body.at) || nowMs());
    return sendJson(res, 200, { ok: true, result });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/donation/settle' && req.method === 'POST') {
    const body = await parseJson(req);
    const now = Number(body.now) || nowMs();
    if (body.reopen === true) await pointStore.testReopenDonationWeek(previousWeek(climbWeekOf(now)));
    donationCache = { week: null, hoguking: null, statues: [], statuesWeek: null };
    await settleDonationWeeks(now);
    return sendJson(res, 200, { ok: true, donation: donationCache });
  }
  // v1.10.89 칭호 명예의 전당 (IDEAS #future-title-history): each server-given title's holders, 1대 from the first week
  // recorded -- a week's champions (ties together) and its 호구왕 hold the title the week after it closed. Names as they
  // were that week; the account ids stay here (`mine` only marks my own rows)
  if (pathname === '/api/island/titles' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const me = pointAccountForSession(session); const now = nowMs(); const current = previousWeek(climbWeekOf(now));
    const weeks = await pointStore.titleWeeks();
    const titles = [['champion', '챔피언', '등반 도전 주간 1위'], ['hoguking', '호구왕', '기부 주간 1위'], ...Object.entries(WEEKLY_TITLES).map(([id, d]) => [id, d.name, d.about])].map(([id, name, about]) => {
      const list = weeks.filter((w) => w.title === id && w.holders.length);
      return { id, name, about, kind: '주간', since: list[0]?.at?.slice(0, 10) || null,
        entries: list.map((w, i) => ({ n: i + 1, names: w.holders.map((h) => h.name), mine: w.holders.some((h) => h.id === me), week: w.week,
          start: nextWeekOf(w.week), end: new Date(Date.parse(`${nextWeekOf(nextWeekOf(w.week))}T00:00:00Z`) - 86400000).toISOString().slice(0, 10), current: w.week === current })) };
    });
    return sendJson(res, 200, { ok: true, titles });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/fishking/settle' && req.method === 'POST') { // v1.10.89
    const body = await parseJson(req); const now = Number(body.now) || nowMs();
    await settleWeeklyTitles(now);
    if (body.asCurrent) { for (const id of Object.keys(WEEKLY_TITLES)) { const r = await pointStore.settlementOf(`${id}_week:${previousWeek(climbWeekOf(now))}`); weeklyCache[id] = { week: previousWeek(climbWeekOf(nowMs())), holder: r?.holder || null }; } refreshTaxLooks(); } // (tests: that week as if it had just closed)
    return sendJson(res, 200, { ok: true, fishking: weeklyCache.fishking, weedking: weeklyCache.weedking });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/climb/settle' && req.method === 'POST') {
    const body = await parseJson(req);
    const now = Number(body.now) || nowMs();
    if (body.reopen === true && pointStore.testReopenClimbWeek) await pointStore.testReopenClimbWeek(previousWeek(climbWeekOf(now)));
    await settleClimbWeeks(now);
    return sendJson(res, 200, { ok: true, champions: championCache, championOf: Object.fromEntries([...championCache.ids].map((id) => [id, isChampion(id, now)])) });
  }
  if (process.env.NODE_ENV === 'test' && pathname === '/api/test/climb/place' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const climb = climbs.get(pointAccountForSession(session));
    if (!climb) return sendError(res, 409, 'CLIMB_NOT_ACTIVE', '진행 중인 등반이 없습니다.');
    const body = await parseJson(req);
    const target = Number(body.y) || 0;
    let index = 0;
    ClimbSim.COURSE.platforms.forEach((p, i) => { if (!p.move && p.y <= target && p.y >= ClimbSim.COURSE.platforms[index].y) index = i; });
    const p = ClimbSim.COURSE.platforms[index];
    Object.assign(climb.state, { x: Number.isFinite(Number(body.x)) ? Math.min(p.x1, Math.max(p.x0, Number(body.x))) : (p.x0 + p.x1) / 2, y: body.air ? p.y + 1 : p.y, vx: 0, vy: 0, grounded: !body.air, plat: body.air ? -1 : index, climb: -1, stun: 0 });
    return sendJson(res, 200, { ok: true, state: climb.state });
  }

  if (pathname === '/api/plaza/leave' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    dropPlazaPresence(session.token);
    plazaLastPos.delete(session.token); // the next entry may start anywhere (it is a new arrival)
    await savePlazaSpots(); // v1.10.7: leaving the island (a room, logout) keeps today's spot right away
    return sendJson(res, 200, { ok: true });
  }
  // v1.10.23: a screen whose island could not start (Mac Chrome report) says why, once, into the server log -- the
  // reason code, the browser's platform and GPU name, a short message; nothing personal, a few per session at most
  if (pathname === '/api/plaza/diag' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (!checkRateLimit(`plazadiag:${session.token.slice(0, 12)}`, 5, 10 * 60 * 1000)) return sendJson(res, 200, { ok: true });
    const body = await parseJson(req);
    const clip = (value, n) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, n);
    const code = ['webgl-unavailable', 'webgl-context', 'module', 'init'].includes(body.code) ? body.code : 'other';
    console.warn(`게임 아일랜드 시작 실패: code=${code} platform=${clip(body.platform, 40)} gpu=${clip(body.gpu, 120)} ua=${clip(req.headers['sec-ch-ua-platform'] || '', 30)} detail=${clip(body.detail, 200)}`);
    return sendJson(res, 200, { ok: true });
  }
  // v1.10.7 당일 위치: where my island starts -- today's last spot (checked and moved to standable ground), or null for
  // the central plaza (a new day, or the first visit).
  // v1.10.80 농부 밭 (IDEAS #future-island-minigames C안): the field everyone sees -- its stage from how many helped this
  // week (0 holes, 1 filled, 2 sprouts, 3 grown), and their names for the sign. A new week starts at 0 by itself.
  // v1.10.89 밭 수확 (IDEAS #future-island-minigames: 「늦게 온 사람도 자기 수확은 각자」): when this week's field is grown
  // (stage 3), each account takes one 밭 채소 a week, standing in the field (once per week: the claim)
  if (pathname === '/api/island/farm/harvest' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (!checkRateLimit(`island-harvest:${session.token}`, 20, 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '잠시 후 다시 시도해 주세요.');
    const at = plazaPresence.get(session.token) || plazaLastPos.get(session.token); const F = IslandTerrain.FARM;
    if (!at || townhallInside.has(session.token) || Math.abs(at.x - F.x) > F.w / 2 + 1.5 || Math.abs(at.z - F.z) > F.d / 2 + 1.5) return sendError(res, 409, 'TOO_FAR', '밭 안에서 수확할 수 있습니다.');
    const week = questWeek(); const farm = await islandFarm();
    if (islandFarmView?.week !== week) return sendError(res, 409, 'TRY_AGAIN', '다시 시도해 주세요.'); // the week turned meanwhile: the field and the claim must be the same week (Codex review)
    if (farm.stage < 3) return sendError(res, 409, 'FARM_NOT_GROWN', '아직 수확할 때가 아니에요. 농부를 도와 밭을 키워 주세요.');
    const account = pointAccountForSession(session);
    const out = await pointStore.islandGive({ userId: account, claimId: `harvest:${week}:${account}`, itemId: 'harvest', qty: 1, meta: null }, nowMs());
    if (out.reason === 'full') return sendError(res, 409, 'BAG_FULL', '가방이 가득 찼습니다.');
    if (!out.applied) return sendError(res, 409, 'HARVESTED', '이번 주 수확은 이미 했어요. 다음 주에 다시 와 주세요.');
    return sendJson(res, 200, { ok: true, bag: out.bag });
  }
  // v1.10.90 잡초 게시판 (IDEAS #future-weed-board): by the town hall's gate -- today's pulls and hand-ins (top 10 and mine,
  // the island's totals), yesterday's island pull count and today's weeds, yesterday's two best hand-ins (named as they
  // were when the day closed, kept once), this week's hand-ins and last week's 제초왕. Names only, never an account id.
  // v1.10.90 섬 시간대 (IDEAS #future-admin-console ①): 'auto' (Seoul's clock) or one held by the administrator; everyone's
  // island follows at once (SSE islandTime)
  // v1.10.91 주민 대화·심부름 (사용자 2026-10-18): any walking islander talks (their own words, or the day's errand for me);
  // the server checks I stand by them where they are now (the same seeded rounds as the browser)
  if (pathname === '/api/island/errands' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    return sendJson(res, 200, { ok: true, ...(await errandView(pointAccountForSession(session))) });
  }
  // A-6 주민 대화 (docs/residents-talk-hills-20261018.md 1·2): anyone walking by, held for the talk on every screen while its
  // window is open (keep: the window's renewal, bye: closed; a walk-off past TALK_FAR lets go), then the choices --
  // topic 'how' (their story), 'rumor' (the island today), 'errand' (the day's errand). The first talk of the day +1.
  const TALK_FAR = 6;
  const talkKey = (session) => `talk:${session.plazaId}`;
  const residentsChanged = () => broadcastIsland('residents', { list: islandEvents.residents() });
  if ((pathname === '/api/island/resident/keep' || pathname === '/api/island/resident/bye') && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const n = Number((await parseJson(req)).n); const who = talkKey(session);
    const mine = islandEvents.residentTalking(who) === n; // (Codex review: a late bye or keep of an earlier talk leaves a newer one alone)
    if (pathname.endsWith('/bye')) { if (mine && islandEvents.residentBye(who)) residentsChanged(); return sendJson(res, 200, { ok: true, residents: islandEvents.residents() }); }
    const pos = plazaPresence.get(session.token); const hold = islandEvents.residents()[n]?.hold;
    if (!pos || !hold || hold.eventId !== who || Math.hypot(pos.x - hold.x, pos.z - hold.z) > TALK_FAR || !islandEvents.residentKeep(n, who)) {
      if (mine && islandEvents.residentBye(who)) residentsChanged();
      return sendError(res, 409, 'TALK_OVER', '대화가 끝났어요.');
    }
    return sendJson(res, 200, { ok: true });
  }
  if (pathname === '/api/island/resident/talk' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const body = await parseJson(req); const n = Number(body.n); const topic = body.topic == null ? null : String(body.topic);
    if (!Number.isInteger(n) || !IslandCast.WALKERS[n] || (topic !== null && !['how', 'rumor', 'errand'].includes(topic))) return sendError(res, 400, 'BAD_RESIDENT', '잘못된 요청입니다.');
    const pos = plazaPresence.get(session.token); // (Codex review: on the island now -- one who left holds no one)
    const state = islandEvents.residents()[n]; const who = talkKey(session);
    if (state?.hold && state.hold.eventId !== who) {
      const other = state.hold.eventId.startsWith('talk:') ? [...plazaPresence.values()].find((p) => `talk:${p.id}` === state.hold.eventId) : null;
      return sendError(res, 409, 'RESIDENT_BUSY', other ? `지금은 ${other.name || '다른 분'}님과 이야기 중이에요.` : '지금은 다른 일로 바빠 보여요.');
    }
    if (topic && !state?.hold) return sendError(res, 409, 'TALK_OVER', '대화가 끝났어요.'); // (a choice only inside a talk still held)
    const at = IslandNpcs.residentAt(n, nowMs(), state);
    // (a slow screen draws a walker a few steps behind its round: one by where it was in the last few seconds is by it too)
    const reach = (p) => pos && Math.hypot(pos.x - p.x, pos.z - p.z) <= (state?.hold ? TALK_FAR : 4);
    if (!pos || ![0, 1500, 3000, 4500].some((back) => reach(IslandNpcs.residentAt(n, nowMs() - back, state)))) return sendError(res, 409, 'TOO_FAR', '가까이 가서 다시 시도해 주세요.');
    if (!state?.hold) { islandEvents.residentTalk(n, who, Math.atan2(pos.x - at.x, pos.z - at.z)); residentsChanged(); }
    const account = pointAccountForSession(session); const day = kstDate(nowMs());
    const c = IslandCast.WALKERS[n]; const level = IslandCast.levelOf((await pointStore.affinityOf(account))[n] || 0); // (the words go by the level before this talk)
    const now = nowMs(); const phase = islandPhase((await pointStore.worldValue('time'))?.mode, now);
    const weather = IslandWeather.weatherAt(now, (await pointStore.worldValue('weather'))?.mode || 'auto').kind;
    const contest = await contestState(); const star = IslandStars.around(starNow(now)).next;
    const decor = (await pointStore.worldValue('decor'))?.mode || 'auto';
    const winter = decor === 'winter' || (decor === 'auto' && IslandTerrain.isWinterFest(now)); const halloween = decor === 'halloween' || (decor === 'auto' && IslandTerrain.isHalloween(now));
    const starSoon = Boolean(star) && star.at - starNow(now) < 6 * 3600000;
    const moods = [weather === 'rain' && 'rain', weather === 'rainbow' && 'rainbow', phase === 'night' && starSoon && 'stars', ['live', 'soon'].includes(contest.phase) && 'contest', winter && 'winter'].filter(Boolean);
    const affinityView = (points) => ({ points, level: IslandCast.levelOf(points), name: IslandCast.LEVELS[IslandCast.levelOf(points)].name });
    if (topic === 'how' || topic === 'rumor') {
      let say;
      if (topic === 'how') say = [IslandCast.walkerLine(n, Math.random, 'day', level, String(session.label || ''))];
      else {
        const errands = IslandErrands.errandsOf(day); const stages = errandStages.get(`${day}|${account}`) || {};
        const mine = errands.find((e) => stages[e.id] === 1 && e.kind !== 'buy' && e.to !== n) || errands.find((e) => stages[e.id] === 2 && e.from !== n);
        const other = mine ? (stages[mine.id] === 2 ? mine.from : mine.to) : (n + 1 + Math.floor(Math.random() * (IslandCast.WALKERS.length - 1))) % IslandCast.WALKERS.length;
        say = [IslandCast.rumor({ weather, night: phase === 'night', starSoon, contest: { phase: contest.phase, name: contest.name, soonDays: (contest.start - now) / 86400000 >= 0 ? (contest.start - now) / 86400000 : null },
          plants: (await pointStore.islandPlants()).length, winter, halloween, hint: { n: other, where: IslandNpcs.hangout(other), errand: Boolean(mine) } })];
      }
      return sendJson(res, 200, { ok: true, n, name: c.name, role: c.role, say, reward: 0, errand: false, choices: true, affinity: affinityView((await pointStore.affinityOf(account))[n] || 0) });
    }
    const errands = IslandErrands.errandsOf(day); const key = `${day}|${account}`;
    const done = new Set(await pointStore.claimedEvents(account, errands.map((e) => e.id)));
    const goods = new Set(((await pointStore.islandBag(account)).items || []).map((e) => e.itemId)); // v1.10.92: what I carry, for a 'buy' errand
    // (Codex review: the bought thing is handed over before the reward is kept -- a thing already handed over for an
    // unpaid errand counts as carried, so the next talk pays it; its hand-over id is the same, so it is never taken twice)
    const useId = (id) => `errand-${id}-${account.slice(-12)}`.replace(/[^A-Za-z0-9-]/g, '-').slice(0, 64);
    for (const e of errands) if (e.kind === 'buy' && !done.has(e.id) && await pointStore.settlementOf(`island_use:${useId(e.id)}`)) goods.add(e.good);
    let r = IslandErrands.talk(errands, errandStages.get(key) || {}, done, n, goods);
    if (r?.take) { const used = await pointStore.islandUse({ userId: account, requestId: useId(r.pay.id), itemId: r.take }); if (!used.applied && !used.already) r = null; } // (gone meanwhile)
    let reward = 0; const gains = [{ n, delta: IslandCast.GAIN.talk, daily: true }]; // v1.10.91 호감도
    if (r) {
      errandStages.set(key, r.stages);
      if (r.pay) { const out = await pointStore.claimEvent({ eventId: r.pay.id, userId: account, amount: Economy.value(`errand:${r.pay.kind}`) + Economy.value('errand:far') * (r.pay.far || 0) + (r.pay.kind === 'buy' ? Economy.value(`good:${r.pay.good}`) : 0), title: `주민 심부름 · ${IslandErrands.title(r.pay)}` }); if (out.applied) { reward = out.amount; notifyPointsChanged([account]); gains.push({ n: r.pay.from, delta: IslandCast.GAIN.errandFrom }, ...(r.pay.to !== r.pay.from ? [{ n: r.pay.to, delta: IslandCast.GAIN.errandTo }] : [])); } }
    }
    const say = r ? r.say : topic === 'errand' ? ['오늘은 괜찮아요. 마음만 받을게요!'] : [IslandCast.walkerLine(n, Math.random, phase, level, String(session.label || ''), moods)];
    const points = (await pointStore.affinityAdd(account, day, gains))[n] || 0; // (daily: the first talk of the day only, whatever is chosen)
    return sendJson(res, 200, { ok: true, n, name: c.name, role: c.role, say, reward, errand: Boolean(r), choices: true, affinity: affinityView(points), ...(await errandView(account)) });
  }
  // A4 날씨: the island's weather now (the same for everyone) and when it changes; the administrator may hold it
  if (pathname === '/api/island/weather' && req.method === 'GET') {
    if (!requireSession(req, res)) return;
    const mode = (await pointStore.worldValue('weather'))?.mode || 'auto';
    return sendJson(res, 200, { ok: true, mode, ...IslandWeather.weatherAt(nowMs(), mode), serverNow: nowMs() });
  }
  if (pathname === '/api/admin/island/weather' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req);
    if (!['auto', ...IslandWeather.KINDS].includes(body.mode)) return sendError(res, 400, 'BAD_MODE', '날씨를 골라 주세요.');
    await pointStore.setWorldValue('weather', { mode: body.mode, at: nowMs() });
    broadcastIsland('islandWeather', { mode: body.mode, ...IslandWeather.weatherAt(nowMs(), body.mode) });
    return sendJson(res, 200, { ok: true, mode: body.mode });
  }
  // A4 밤하늘 별똥별 (lib/island-stars.js): the star falling now and the next one (the same for everyone); on a look, the
  // gifts for the wishes of the Seoul day before are paid once (until the 우체통). Wishes live in the account's 'stars' doc.
  if (pathname === '/api/island/stars' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    const account = pointAccountForSession(session); const now = starNow(nowMs()); let gift = 0;
    for (const st of IslandStars.wishesDue((await pointStore.questDoc(account, 'stars')).doc.wished || [], now)) { // (every day before, not only yesterday -- Codex review)
      const out = await pointStore.claimEvent({ eventId: `star_gift_${IslandStars.slotOfId(st.id)}`, userId: account, amount: IslandStars.GIFT, title: '별똥별 소원 선물' });
      if (out.applied) gift += out.amount;
    }
    if (gift) notifyPointsChanged([account]);
    return sendJson(res, 200, { ok: true, ...IslandStars.around(now), serverNow: now, gift, wishMs: IslandStars.WISH_MS });
  }
  if (pathname === '/api/island/stars/wish' && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    if (!plazaPresence.get(session.token)) return sendError(res, 409, 'NOT_ON_ISLAND', '섬에서 빌 수 있어요.');
    const body = await parseJson(req); const now = IslandStars.around(starNow(nowMs())).now;
    if ((await pointStore.questDoc(pointAccountForSession(session), 'stars')).doc.wished?.includes(String(body.id))) return sendJson(res, 200, { ok: true, already: true }); // (wished already: so even once it has gone by)
    if (!now || now.id !== body.id) return sendError(res, 409, 'STAR_GONE', '별똥별이 이미 지나갔어요.');
    const out = await pointStore.questApply(pointAccountForSession(session), 'stars', (doc) => (doc.wished || []).includes(now.id) ? null : { doc: { ...doc, wished: [...(doc.wished || []), now.id].slice(-120) }, reward: 0 });
    return sendJson(res, 200, { ok: true, already: !out?.doc });
  }
  // A4 주말 섬 대회: where the week's contest is (soon / live / done), the live top 5 and my record, the last result
  if (pathname === '/api/island/contest' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    const c = await contestState(); const account = pointAccountForSession(session);
    const live = contestBoard.id === c.id; const mine = live ? contestBoard.rows.get(account) : null;
    return sendJson(res, 200, { ok: true, contest: { id: c.id, kind: c.kind, name: c.name, how: c.how, unit: c.unit, phase: c.phase, start: c.start, end: c.end }, serverNow: contestNow(),
      top: live ? contestTop(5) : [], mine: mine ? { score: mine.score, rank: IslandContest.rank([...contestBoard.rows.values()]).indexOf(mine) + 1 } : null, entrants: live ? contestBoard.rows.size : 0,
      last: await pointStore.worldValue('contestResult') });
  }
  if (pathname === '/api/admin/contest' && req.method === 'GET') { if (!requireAdmin(req, res)) return; return sendJson(res, 200, { ok: true, config: IslandContest.config((await pointStore.worldValue('contest'))?.config) }); }
  if (pathname === '/api/admin/contest' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req); const cfg = IslandContest.config({ day: Number(body.day), hour: Number(body.hour), minute: Number(body.minute), minutes: Number(body.minutes), enabled: body.enabled !== false });
    if (cfg.day !== Number(body.day) || cfg.hour !== Number(body.hour) || cfg.minutes !== Number(body.minutes)) return sendError(res, 400, 'BAD_CONTEST', '요일·시각·길이(10~120분)를 확인해 주세요.');
    await pointStore.setWorldValue('contest', { config: cfg, at: nowMs() }); contestPhase = null;
    return sendJson(res, 200, { ok: true, config: cfg });
  }
  // B 45 꽃·나무 심기: every plant on the island (its stage by the server clock, mine marked), a seed or sapling of mine into
  // the ground where I stand (the server's own spot of me), fertilizer onto a plant by me -- everyone is told to look again
  if (pathname === '/api/island/plants' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return; const me = pointAccountForSession(session); const now = nowMs();
    return sendJson(res, 200, { ok: true, plants: (await pointStore.islandPlants()).map((p) => ({ id: p.id, kind: p.kind, color: p.color, x: p.x, z: p.z, stage: IslandPlants.stageOf(p, now), fertilized: Boolean(p.fertilizedAt), mine: p.owner === me })) });
  }
  if ((pathname === '/api/island/plant' || pathname === '/api/island/fertilize') && req.method === 'POST') {
    const session = requireSession(req, res); if (!session) return;
    const at = plazaPresence.get(session.token); if (!at || townhallInside.has(session.token) || storeInside.has(session.token)) return sendError(res, 409, 'NOT_ON_ISLAND', '섬 땅 위에서 할 수 있어요.');
    const body = await parseJson(req); const account = pointAccountForSession(session);
    const SAY = { full: '섬에 꽃·나무가 가득 찼어요.', mine: `한 사람이 ${IslandPlants.PER_ACCOUNT}그루까지 심을 수 있어요.`, missing: '가방에 없어요.', gone: '이미 없어진 꽃·나무예요.', done: '이미 비료를 준 꽃·나무예요.' };
    let out;
    try {
      if (pathname === '/api/island/plant') {
        const k = IslandPlants.KINDS[body.itemId]; if (!k) return sendError(res, 400, 'NOT_A_SEED', '심을 수 있는 물건이 아니에요.');
        const why = IslandPlants.refuse(k.kind, at.x, at.z, await pointStore.islandPlants()); if (why) return sendError(res, 409, 'BAD_SPOT', why);
        out = await pointStore.islandPlant({ userId: account, requestId: String(body.requestId || ''), itemId: body.itemId, x: at.x, z: at.z, at: nowMs() });
      } else {
        const plant = (await pointStore.islandPlants()).find((p) => p.id === body.plantId); if (!plant || Math.hypot(plant.x - at.x, plant.z - at.z) > 2) return sendError(res, 409, 'TOO_FAR', '꽃·나무 가까이에서 줄 수 있어요.');
        out = await pointStore.islandFertilize({ userId: account, requestId: String(body.requestId || ''), plantId: plant.id, at: nowMs() });
      }
    } catch { return sendError(res, 400, 'BAD_REQUEST', '잘못된 요청입니다.'); }
    if (out.reason) return sendError(res, 409, out.reason === 'spot' ? 'BAD_SPOT' : 'NOT_DONE', out.reason === 'spot' ? '바로 옆에 이미 심겨 있어요.' : SAY[out.reason] || '할 수 없어요.');
    if (out.applied) broadcastIsland('plants', {});
    return sendJson(res, 200, { ok: true, already: Boolean(out.already), plant: out.plant ? { id: out.plant.id, stage: IslandPlants.stageOf(out.plant, nowMs()) } : null, bag: out.bag || null });
  }
  if (pathname === '/api/island/time' && req.method === 'GET') {
    if (!requireSession(req, res)) return;
    // (A5: with the season arrangement -- the day it is held at, or null to turn -- and the event decorations' mode)
    return sendJson(res, 200, { ok: true, mode: (await pointStore.worldValue('time'))?.mode || 'auto', seasonHold: (await pointStore.worldValue('season'))?.day ?? null, decor: (await pointStore.worldValue('decor'))?.mode || 'auto' });
  }
  // v1.10.90 에셋 점검실 (IDEAS #future-admin-console ③): the drawn pictures the game uses, and the administrator's notes on
  // assets (status, memo, a small JPEG of the view, the view itself), kept on the server
  if (pathname === '/api/admin/assets/pictures' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const files = [];
    for (const dir of ['assets/gamehall/cards', 'assets/items', 'assets/dex']) for (const f of await fsp.readdir(path.join(PUBLIC_DIR, dir)).catch(() => [])) if (/\.(svg|png)$/i.test(f)) files.push(`/${dir}/${f}`);
    return sendJson(res, 200, { ok: true, files });
  }
  // 관리자 「문제 기록」 (사용자 2026-10-18, docs/admin-issue-log-20261018.md): what an administrator saw go wrong, written where
  // it happened -- the words, a kind, what the page knew (screen, place, device, frame rate, recent errors) and a small
  // picture; newest first, open / doing / done, up to 500. GET gives the pictures only with ?shots=1 (Claude reads the rest).
  const addIssue = async (res, body, by) => worldEdit(async () => {
    const list = (await pointStore.worldValue('issueLog')) || [];
    const text = String(body.text ?? '').replace(/\u0000/g, '').trim();
    if (!text || [...text].length > 1000 || !ISSUE_KINDS.includes(body.kind)) return sendError(res, 400, 'BAD_ISSUE', '내용(1,000자까지)과 종류를 확인해 주세요.');
    if (list.length >= ISSUE_MAX) return sendError(res, 409, 'TOO_MANY_ISSUES', `문제 기록은 ${ISSUE_MAX}개까지입니다. 해결된 오래된 것을 지워 주세요.`);
    if (by.id !== 'admin' && list.filter((i) => i.by?.id === by.id && kstDate(i.at) === kstDate(nowMs())).length >= ISSUE_DAY_MAX) return sendError(res, 429, 'ISSUE_DAY_LIMIT', `문제 기록은 하루 ${ISSUE_DAY_MAX}개까지 쓸 수 있어요.`);
    const shot = typeof body.shot === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.shot) && body.shot.length <= 60000 ? body.shot : null;
    let ctx = body.ctx && typeof body.ctx === 'object' ? body.ctx : {}; if (JSON.stringify(ctx).length > 6000) ctx = { ...ctx, errors: [] }; if (JSON.stringify(ctx).length > 6000) ctx = {};
    const issue = { id: crypto.randomUUID(), at: nowMs(), version: SERVER_VERSION, kind: body.kind, status: 'open', text, ctx, shot, by };
    await pointStore.setWorldValue('issueLog', [issue, ...list]);
    return sendJson(res, 201, { ok: true, id: issue.id });
  });
  // (2026-10-20) an allowed account: may I write, and its own records -- read and written here, never anyone else's
  if (pathname === '/api/issues/me' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    return sendJson(res, 200, { ok: true, allowed: await canWriteIssues(session) });
  }
  if (pathname === '/api/issues' && (req.method === 'GET' || req.method === 'POST')) {
    const session = requireSession(req, res); if (!session) return;
    if (!await canWriteIssues(session)) return sendError(res, 403, 'ISSUES_DENIED', '문제 기록은 관리자가 허용한 계정만 쓸 수 있습니다.');
    const mine = session.role === 'admin' ? 'admin' : session.guestKeyId;
    if (req.method === 'GET') { const list = (await pointStore.worldValue('issueLog')) || []; return sendJson(res, 200, { ok: true, issues: list.filter((i) => (i.by?.id || 'admin') === mine).map((i) => ({ ...i, shot: undefined, hasShot: Boolean(i.shot) })) }); }
    const body = await parseJson(req); if (body.action !== 'add') return sendError(res, 400, 'BAD_ISSUE', '잘못된 요청입니다.');
    const label = session.role === 'admin' ? '관리자' : String((await accessStore.get(session.guestKeyId))?.label || '').slice(0, 24);
    return addIssue(res, body, { id: mine, label });
  }
  if (pathname === '/api/admin/issues' && (req.method === 'GET' || req.method === 'POST')) {
    if (!requireAdmin(req, res)) return;
    if (req.method === 'GET') {
      const shots = url.searchParams.get('shots') === '1'; const list = (await pointStore.worldValue('issueLog')) || [];
      return sendJson(res, 200, { ok: true, max: ISSUE_MAX, issues: list.map((i) => (shots ? i : { ...i, shot: undefined, hasShot: Boolean(i.shot) })) });
    }
    const body = await parseJson(req);
    if (body.action === 'add') return addIssue(res, body, { id: 'admin', label: '관리자' });
    return worldEdit(async () => {
      const list = (await pointStore.worldValue('issueLog')) || [];
      const i = list.findIndex((x) => x.id === body.id); if (i < 0) return sendError(res, 404, 'ISSUE_NOT_FOUND', '기록을 찾을 수 없습니다.');
      if (body.action === 'status' && ISSUE_STATUS.includes(body.status)) list[i] = { ...list[i], status: body.status, changedAt: nowMs() };
      else if (body.action === 'delete') list.splice(i, 1);
      else return sendError(res, 400, 'BAD_ISSUE', '잘못된 요청입니다.');
      await pointStore.setWorldValue('issueLog', list);
      return sendJson(res, 200, { ok: true });
    });
  }
  if (pathname === '/api/admin/asset-notes' && (req.method === 'GET' || req.method === 'POST')) {
    if (!requireAdmin(req, res)) return;
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, notes: (await pointStore.worldValue('assetNotes')) || {} });
    const body = await parseJson(req);
    return worldEdit(async () => {
    const notes = (await pointStore.worldValue('assetNotes')) || {};
    const id = String(body.id || ''); const status = ['', 'check', 'fix', 'ok'].includes(body.status) ? body.status : null;
    if (!/^[\w.:/-]{2,160}$/.test(id) || status === null) return sendError(res, 400, 'BAD_NOTE', '잘못된 메모입니다.');
    const shot = typeof body.shot === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.shot) && body.shot.length <= 60000 ? body.shot : null;
    const v = body.view || {}; const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
    if (!status && !String(body.memo || '').trim()) delete notes[id];
    else {
      if (!notes[id] && Object.keys(notes).length >= 300) return sendError(res, 409, 'TOO_MANY_NOTES', '메모가 너무 많습니다. 확인 완료된 것을 지워 주세요.');
      notes[id] = { status, memo: String(body.memo || '').slice(0, 1000), shot, view: { yaw: num(v.yaw), pitch: num(v.pitch), dist: num(v.dist), frame: num(v.frame), low: v.low === true, season: ['spring', 'summer', 'autumn', 'winter'].includes(v.season) ? v.season : null }, at: nowMs() };
    }
    await pointStore.setWorldValue('assetNotes', notes);
    return sendJson(res, 200, { ok: true, notes });
    });
  }
  // v1.10.91 경제 값 관리 (IDEAS #future-admin-console ②): the table, a change (checked against each value's range, kept with
  // who/when/before), and putting one back (a change to the value it had before)
  if (pathname === '/api/admin/economy' && (req.method === 'GET' || req.method === 'POST')) {
    if (!requireAdmin(req, res)) return;
    if (req.method === 'POST') {
      const body = await parseJson(req);
      const out = await worldEdit(async () => { const r = Economy.change(await pointStore.worldValue('economy'), body.changes, '관리자', nowMs()); if (r.error) return r; await pointStore.setWorldValue('economy', r.saved); Economy.load(r.saved); return r; });
      if (out.error) return sendError(res, 400, 'BAD_ECONOMY', out.error === 'RANGE' ? '허용 범위를 벗어난 값입니다.' : '바꿀 값이 없습니다.');
    }
    return sendJson(res, 200, { ok: true, ...Economy.view(await pointStore.worldValue('economy')) });
  }
  // 달마루섬 개편 (docs/dalmaru-implementation-20261019.md): which island a page shows -- the new one only for an
  // administrator while the preview switch is on (that page walks it on its own: it sends no positions); everyone else
  // the island they have
  if (pathname === '/api/island/map' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return;
    if (IslandTerrain.MAP === 'dalmaru') return sendJson(res, 200, { ok: true, map: 'dalmaru', live: true }); // (5단계: the server's own island, everyone's)
    return sendJson(res, 200, { ok: true, map: session.role === 'admin' && (await opsSwitches()).dalmaruPreview === true ? 'dalmaru' : 'classic' });
  }
  if (pathname === '/api/admin/switches' && (req.method === 'GET' || req.method === 'POST')) { // v1.10.90 운영 스위치
    if (!requireAdmin(req, res)) return;
    if (req.method === 'POST') {
      const body = await parseJson(req);
      await worldEdit(async () => { const next = { ...(await opsSwitches()) };
        for (const k of Object.keys(OPS_DEFAULTS)) if (typeof body[k] === 'boolean') next[k] = body[k];
        await pointStore.setWorldValue('switches', next); opsCache = next; });
    }
    return sendJson(res, 200, { ok: true, switches: await opsSwitches() });
  }
  // A5 관리자: 계절 고정 (hold today's arrangement of the four season zones, or let it turn by the day) and 이벤트 장식 수동
  // (the event decorations on or off by hand, or by the date) -- both told to the island at once (the 'islandTime' push)
  if (pathname === '/api/admin/island/season' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req); if (!['auto', 'hold'].includes(body.mode)) return sendError(res, 400, 'BAD_MODE', '계절 회전을 골라 주세요.');
    const day = body.mode === 'hold' ? IslandTerrain.seasonDay(nowMs()) : null;
    await pointStore.setWorldValue('season', { day, at: nowMs() }); broadcastIsland('islandTime', { mode: (await pointStore.worldValue('time'))?.mode || 'auto' });
    return sendJson(res, 200, { ok: true, seasonHold: day });
  }
  if (pathname === '/api/admin/island/decor' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req); if (!['auto', 'halloween', 'winter', 'off'].includes(body.mode)) return sendError(res, 400, 'BAD_MODE', '장식 설정을 골라 주세요.'); // (B 46: the winter festival too)
    await pointStore.setWorldValue('decor', { mode: body.mode, at: nowMs() }); broadcastIsland('islandTime', { mode: (await pointStore.worldValue('time'))?.mode || 'auto' });
    return sendJson(res, 200, { ok: true, decor: body.mode });
  }
  if (pathname === '/api/admin/island/time' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req);
    if (!['auto', 'morning', 'day', 'evening', 'night'].includes(body.mode)) return sendError(res, 400, 'BAD_MODE', '시간대를 골라 주세요.');
    await pointStore.setWorldValue('time', { mode: body.mode, at: nowMs() });
    broadcastIsland('islandTime', { mode: body.mode });
    return sendJson(res, 200, { ok: true, mode: body.mode });
  }
  if (pathname === '/api/island/weeds/board' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const me = pointAccountForSession(session); const now = nowMs(); const today = kstDate(now); const dayMs = Date.parse(`${today}T00:00:00+09:00`); const iso = (ms) => new Date(ms).toISOString();
    const labels = new Map((await accessStore.list()).map((k) => [`guest:${k.id}`, k.label])); const nameOf = (id) => labels.get(id) || (id === 'admin' ? '관리자' : '게스트');
    const order = (rows) => rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total || String(a.lastAt).localeCompare(String(b.lastAt)) || a.userId.localeCompare(b.userId));
    const board = (rows) => { const all = order(rows).map((r, i) => ({ rank: i + 1, name: nameOf(r.userId), total: r.total, mine: r.userId === me })); return { top: all.slice(0, 10), me: all.find((r) => r.mine) || null, total: all.reduce((t, r) => t + r.total, 0) }; };
    const [todayStats, weekStats, state] = await Promise.all([pointStore.weedStats(iso(dayMs), iso(dayMs + 86400000)), pointStore.weedStats(iso(weekStartMs(climbWeekOf(now))), iso(now + 1)), weedState(now)]);
    const yesterday = kstDate(dayMs - 1); const yKey = `weedday:${yesterday}`;
    let y = await pointStore.settlementOf(yKey);
    if (!y) { const ys = await pointStore.weedStats(iso(dayMs - 86400000), iso(dayMs)); y = await pointStore.settleTitleWeek(yKey, { kind: 'weed_day', day: yesterday, merit: order(ys.submits).slice(0, 2).map((r, i) => ({ rank: i + 1, name: nameOf(r.userId), total: r.total })) }); }
    const lastWeek = await pointStore.settlementOf(`weedking_week:${previousWeek(climbWeekOf(now))}`);
    return sendJson(res, 200, { ok: true, today: { pulls: board(todayStats.pulls), submits: board(todayStats.submits) }, island: { yesterdayPulled: state.last?.day === yesterday ? state.last.pulled : null, weeds: IslandWeeds.active(state).length },
      merit: y.merit || [], week: board(weekStats.submits), lastWeekKing: lastWeek?.holder ? (lastWeek.ranking || []).find((r) => r.userId === lastWeek.holder)?.name || nameOf(lastWeek.holder) : null });
  }
  if (pathname === '/api/island/farm' && req.method === 'GET') {
    const session = requireSession(req, res); if (!session) return; const account = pointAccountForSession(session);
    return sendJson(res, 200, { ok: true, ...(await islandFarm()), village: await islandVillage(), harvested: Boolean(await pointStore.settlementOf(`island_give:harvest:${questWeek()}:${account}`)) }); // v1.10.89; v1.10.93 village
  }
  if (pathname === '/api/plaza/spot' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    return sendJson(res, 200, { ok: true, spot: await plazaSpotToday(pointAccountForSession(session)) });
  }

  // Public to authenticated members; only administrators may modify notices.
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
    const publishAt = body.publishAt ? Date.parse(body.publishAt) : NaN; // A5 공지 예약: a later time queues it
    if (Number.isFinite(publishAt) && publishAt > nowMs() + 30000) {
      if (publishAt > nowMs() + 60 * 86400000) return sendError(res, 400, 'BAD_ANNOUNCEMENT', '예약은 60일 안으로 해 주세요.');
      const entry = { id: crypto.randomUUID(), title, body: content, pinned: body.pinned === true, at: publishAt };
      const added = await editNoticeQueue(async (queue) => (queue.length >= 20 ? { value: false } : { queue: [...queue, entry].sort((a, b) => a.at - b.at), value: true }));
      if (!added) return sendError(res, 409, 'QUEUE_FULL', '예약 공지는 20개까지입니다.');
      return sendJson(res, 201, { ok: true, scheduled: entry });
    }
    const item = await announcementStore.create(title, content, body.pinned === true);
    await broadcastAnnouncements();
    return sendJson(res, 201, { ok: true, item });
  }

  if (pathname === '/api/admin/notice-queue' && req.method === 'GET') { if (!requireAdmin(req, res)) return; return sendJson(res, 200, { ok: true, queue: (await pointStore.worldValue('noticeQueue')) || [] }); }
  const queuedMatch = pathname.match(/^\/api\/admin\/notice-queue\/([0-9a-f-]{36})$/i);
  if (queuedMatch && req.method === 'DELETE') { if (!requireAdmin(req, res)) return; await editNoticeQueue(async (queue) => ({ queue: queue.filter((e) => e.id !== queuedMatch[1]) })); return sendJson(res, 200, { ok: true }); }
  const announcementMatch = pathname.match(/^\/api\/announcements\/([0-9a-f-]{36})$/i);
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
    const item = await announcementStore.update(announcementMatch[1], title, content, body.pinned === true);
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

  if (pathname === '/api/admin/presence' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return sendJson(res, 200, await adminPresenceSnapshot());
  }

  if (pathname === '/api/admin/keys' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    const messenger = new Set(await messengerStore.allowedIds());
    const writers = new Set(await issueWriters()); // (2026-10-20 문제 기록 허용)
    const keys = (await accessStore.list()).map((key) => ({ ...key, presence: guestPresence(key.id), messenger: messenger.has(key.id), issues: writers.has(key.id) }));
    return sendJson(res, 200, { keys, persistence: DATABASE_URL ? 'database' : 'ephemeral-file' });
  }

  // v1.10.63 가입 신청: waiting sign-ups, approved (the account is made: its file comes later from 내 계정) or rejected
  if (pathname === '/api/admin/signups' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return;
    return sendJson(res, 200, { signups: (await accessStore.listPending()).map(({ id, label, loginId, realName, pendingAt }) => ({ id, nickname: label, loginId, realName, pendingAt })) });
  }
  const signupMatch = pathname.match(/^\/api\/admin\/signups\/([0-9a-f-]{36})\/(approve|reject)$/i);
  if (signupMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    // approving: the nickname is checked again under the 작명소 lock -- two sign-ups may have asked for one name, or
    // someone may have taken it since (Codex)
    const row = signupMatch[2] === 'reject' ? await accessStore.rejectPending(signupMatch[1]) : await withNicknameLock(async () => {
      const wanted = (await accessStore.listPending()).find((s) => s.id === signupMatch[1]);
      if (wanted && (await accessStore.list()).some((key) => normalizeNickname(key.label) === normalizeNickname(wanted.label))) return 'taken';
      return accessStore.approve(signupMatch[1]);
    });
    if (row === 'taken') return sendError(res, 409, 'NAME_TAKEN', '그 닉네임은 이미 다른 계정이 쓰고 있습니다. 거절하고 다른 닉네임으로 다시 신청하게 해 주세요.');
    if (!row) return sendError(res, 404, 'SIGNUP_NOT_FOUND', '가입 신청을 찾을 수 없습니다.');
    if (signupMatch[2] === 'approve') await pointStore.ensureAccount(`guest:${row.id}`);
    return sendJson(res, 200, { ok: true });
  }
  // a forgotten password: the administrator sets a temporary one and tells it to the player (shown once)
  const resetMatch = pathname.match(/^\/api\/admin\/keys\/([0-9a-f-]{36})\/password-reset$/i);
  if (resetMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const temporary = crypto.randomBytes(9).toString('base64url').slice(0, 10);
    const row = await accessStore.setPassword(resetMatch[1], await hashPassword(temporary));
    if (!row) return sendError(res, 404, 'NO_LOGIN', '아이디가 설정된 계정만 초기화할 수 있습니다.');
    dropAccountTokens(row.id);
    return sendJson(res, 200, { ok: true, loginId: row.loginId, password: temporary });
  }

  if (pathname === '/api/admin/keys' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req);
    const label = sanitizeLabel(body.label);
    if (!label) return sendError(res, 400, 'BAD_LABEL', '파일을 구분할 이름을 입력해 주세요. 예: 우성_PC');
    const token = newSecret(32);
    const row = await accessStore.create(label, token);
    const fileName = safeFilename(label);
    const html = makeGuestFile({ baseUrl: publicBaseUrl(req), token, label });
    return sendJson(res, 201, { key: row, fileName, html });
  }

  const messengerMatch = pathname.match(/^\/api\/admin\/keys\/([0-9a-f-]{36})\/messenger$/i); // v1.10.78 메신저 허용
  if (messengerMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req);
    if (!await accessStore.get(messengerMatch[1])) return sendError(res, 404, 'KEY_NOT_FOUND', '입장 파일을 찾을 수 없습니다.');
    await messengerStore.setAllowed(messengerMatch[1], body.allowed === true);
    return sendJson(res, 200, { ok: true, messenger: body.allowed === true });
  }

  const issuesMatch = pathname.match(/^\/api\/admin\/keys\/([0-9a-f-]{36})\/issues$/i); // (2026-10-20) 문제 기록 허용
  if (issuesMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req);
    if (!await accessStore.get(issuesMatch[1])) return sendError(res, 404, 'KEY_NOT_FOUND', '입장 파일을 찾을 수 없습니다.');
    return worldEdit(async () => {
      const ids = new Set(await issueWriters()); if (body.allowed === true) ids.add(issuesMatch[1]); else ids.delete(issuesMatch[1]);
      await pointStore.setWorldValue('issueWriters', [...ids]);
      return sendJson(res, 200, { ok: true, issues: body.allowed === true });
    });
  }

  const noteMatch = pathname.match(/^\/api\/admin\/keys\/([0-9a-f-]{36})\/note$/i);
  if (noteMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req);
    if (typeof body.note !== 'string') return sendError(res, 400, 'BAD_NOTE', '메모는 문자로 입력해 주세요.');
    const note = body.note.trim().replace(/\s+/g, ' ');
    if (note.length > 200) return sendError(res, 400, 'NOTE_TOO_LONG', '메모는 200자까지 입력할 수 있습니다.');
    const key = await accessStore.setNote(noteMatch[1], note);
    if (!key) return sendError(res, 404, 'KEY_NOT_FOUND', '입장 파일을 찾을 수 없습니다.');
    return sendJson(res, 200, { ok: true, key });
  }

  // Rename and reissue must be atomic: the old file must not authenticate with an outdated name.
  const renameMatch = pathname.match(/^\/api\/admin\/keys\/([0-9a-f-]{36})\/rename$/i);
  if (renameMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    if (!checkRateLimit('rename:' + renameMatch[1], 5, 60 * 1000)) {
      return sendError(res, 429, 'RENAME_RATE_LIMIT', '닉네임 변경이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
    }
    const body = await parseJson(req);
    if (typeof body.label !== 'string' || body.label.trim().length > 40) {
      return sendError(res, 400, 'BAD_LABEL', '새 닉네임은 1~40자 이내로 입력해 주세요.');
    }
    const label = sanitizeLabel(body.label);
    if (!label) return sendError(res, 400, 'BAD_LABEL', '새 닉네임은 1~40자 이내로 입력해 주세요.');
    const token = newSecret(32);
    const row = await accessStore.renameAndRotateToken(renameMatch[1], label, token);
    if (!row) return sendError(res, 404, 'ACTIVE_KEY_NOT_FOUND', '사용 가능한 입장파일을 찾을 수 없습니다. 취소된 파일은 먼저 권한을 복구해 주세요.');
    invalidateGuestSessions(row.id, '닉네임 변경으로 기존 접속이 종료됐습니다. 새 입장파일로 접속해 주세요.');
    const fileName = safeFilename(row.label);
    const html = makeGuestFile({ baseUrl: publicBaseUrl(req), token, label: row.label });
    return sendJson(res, 200, { ok: true, key: row, fileName, html });
  }

  // v1.7.3: operator point grant to one account, identified by its stable key id (never a nickname).
  // Whole amount (no burn), 10,000P units, a reason category, recorded in the point ledger. The
  // client sends one request id per confirmation, so a double click or retry grants only once.
  const grantMatch = pathname.match(/^\/api\/admin\/keys\/([0-9a-f-]{36})\/points$/i);
  if (grantMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = await parseJson(req);
    const requestId = String(body.requestId || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return sendError(res, 400, 'BAD_REQUEST_ID', '지급 요청을 다시 열어 주세요.');
    const amount = Number(body.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount % ADMIN_GRANT_UNIT !== 0) return sendError(res, 400, 'BAD_AMOUNT', `지급액은 ${ADMIN_GRANT_UNIT.toLocaleString('ko-KR')}P 단위의 양수만 가능합니다.`);
    if (amount > ADMIN_GRANT_MAX) return sendError(res, 400, 'AMOUNT_TOO_LARGE', `한 번에 ${ADMIN_GRANT_MAX.toLocaleString('ko-KR')}P까지 지급할 수 있습니다.`);
    if (!ADMIN_GRANT_CATEGORIES.includes(body.category)) return sendError(res, 400, 'BAD_CATEGORY', '지급 사유를 선택해 주세요.');
    const key = (await accessStore.list()).find(item => item.id === grantMatch[1] && !item.revokedAt);
    if (!key) return sendError(res, 404, 'ACTIVE_KEY_NOT_FOUND', '사용 가능한 계정을 찾을 수 없습니다.');
    // Only well-formed grants count toward the limit (a typo does not lock the operator out).
    if (!checkRateLimit('grant:all', 20, 60 * 1000)) { // one bucket for the whole operation, not per target account
      return sendError(res, 429, 'GRANT_RATE_LIMIT', '포인트 지급이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
    }
    const outcome = await pointStore.adminGrant({ grantId: `admin-grant:${requestId}`, userId: `guest:${key.id}`, amount, category: body.category, memo: body.category === 'other' ? body.memo : '' });
    if (outcome.userId && outcome.userId !== `guest:${key.id}`) return sendError(res, 409, 'GRANT_ID_REUSED', '이미 다른 지급에 사용된 요청입니다. 다시 열어 주세요.');
    if (outcome.applied) notifyPointsChanged([`guest:${key.id}`]);
    return sendJson(res, 200, { ok: true, applied: outcome.applied, label: key.label, amount: outcome.amount,
      balanceBefore: outcome.balanceBefore, balanceAfter: outcome.balanceAfter, category: outcome.summary?.category || body.category });
  }

  // Reissue rotates the credential on its existing row. The old HTML file and
  // any session authenticated by it cease working immediately after persistence.
  const reissueMatch = pathname.match(/^\/api\/admin\/keys\/([0-9a-f-]{36})\/reissue$/i);
  if (reissueMatch && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    if (!checkRateLimit('reissue:' + reissueMatch[1], 5, 60 * 1000)) {
      return sendError(res, 429, 'REISSUE_RATE_LIMIT', '재발급이 너무 잦습니다. 잠시 후 다시 시도해 주세요.');
    }
    const token = newSecret(32);
    const row = await accessStore.rotateToken(reissueMatch[1], token);
    if (!row) return sendError(res, 404, 'ACTIVE_KEY_NOT_FOUND', '사용 가능한 입장파일을 찾을 수 없습니다. 취소된 파일은 먼저 권한을 복구해 주세요.');
    invalidateGuestSessions(row.id, '입장파일이 재발급되어 기존 접속이 종료됐습니다. 새 입장파일로 접속해 주세요.');
    const fileName = safeFilename(row.label);
    const html = makeGuestFile({ baseUrl: publicBaseUrl(req), token, label: row.label });
    return sendJson(res, 200, { ok: true, key: row, fileName, html });
  }

  let match = pathname.match(/^\/api\/admin\/keys\/([0-9a-f-]{36})\/revoke$/i);
  if (match && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const row = await accessStore.revoke(match[1]);
    if (!row) return sendError(res, 404, 'KEY_NOT_FOUND', '입장 파일을 찾을 수 없습니다.');
    invalidateGuestSessions(row.id);
    return sendJson(res, 200, { ok: true, key: row });
  }

  match = pathname.match(/^\/api\/admin\/keys\/([0-9a-f-]{36})\/restore$/i);
  if (match && req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const row = await accessStore.restore(match[1]);
    if (!row) return sendError(res, 404, 'KEY_NOT_FOUND', '취소된 입장 파일을 찾을 수 없습니다.');
    return sendJson(res, 200, { ok: true, key: row });
  }

  match = pathname.match(/^\/api\/admin\/keys\/([0-9a-f-]{36})$/i);
  if (match && req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    const row = await accessStore.remove(match[1]);
    if (!row) return sendError(res, 404, 'KEY_NOT_FOUND', '입장 파일을 찾을 수 없습니다.');
    invalidateGuestSessions(row.id);
    return sendJson(res, 200, { ok: true, key: row });
  }

  // Authenticated read models expose only player labels and aggregated outcomes.
  if (pathname === '/api/records/me' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const id = recordIdentity(session);
      const stats = await matchStore.stats(id);
      return sendJson(res, 200, { player: { id, label: session.label }, ...stats, badges: await recordBadges(id) });
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
  const recordLookup = pathname.match(/^\/api\/records\/(admin:[A-Za-z0-9_-]{10,40}|[0-9a-f-]{36})$/i);
  if (recordLookup && req.method === 'GET') {
    if (!requireSession(req, res)) return;
    try {
      const player = (await recordPlayers()).find(person => person.id === recordLookup[1]);
      if (!player) return sendError(res, 404, 'PLAYER_NOT_FOUND', '해당 플레이어를 찾을 수 없습니다.');
      const stats = await matchStore.stats(player.id);
      return sendJson(res, 200, { player, ...stats, badges: await recordBadges(player.id) });
    } catch (error) {
      console.error('플레이어 전적 조회 실패:', error);
      return sendError(res, 503, 'RECORDS_UNAVAILABLE', '전적을 불러오지 못했습니다.');
    }
  }

  // v1.10.71 게임별 랭킹 (lib/game-ranking.js): this week's (Seoul Monday) or all-time board of one game, top 20 and me
  if (pathname === '/api/records/ranking' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const game = String(url.searchParams.get('game') || '');
    if (game === 'herosurv') { // (사용자 2026-10-19) 두 세계 영웅전: each account's best on the game's board -- its word, no points
      const board = herosurvLatest || (herosurvLatest = (await pointStore.worldValue('herosurvBoard')) || 'heroes-r14');
      const rows = await pointStore.herosurvBoard(board); const account = pointAccountForSession(session);
      const view = (row, i) => ({ rank: i + 1, label: row.name, score: row.score, hero: row.meta?.hero || null, stage: row.meta?.stage ?? row.meta?.wave ?? row.meta?.level ?? null, me: row.userId === account });
      const mine = rows.findIndex((row) => row.userId === account);
      return sendJson(res, 200, { ok: true, game, kind: 'score', board, top: rows.slice(0, 20).map(view), me: mine < 0 ? null : view(rows[mine], mine) });
    }
    if (!/^[a-z0-9]{2,20}$/.test(game)) return sendError(res, 400, 'BAD_GAME', '고를 수 없는 게임입니다.');
    const all = url.searchParams.get('week') === 'all';
    try {
      const rows = GameRanking.board(await matchStore.matchesOf(game, all ? '1970-01-01T00:00:00.000Z' : new Date(GameRanking.weekStart(nowMs())).toISOString()));
      const names = new Map((await recordPlayers()).map((p) => [p.id, p.label]));
      const me = recordIdentity(session);
      const view = (r) => ({ rank: r.rank, label: names.get(r.id) || '(떠난 플레이어)', w: r.w, d: r.d, l: r.l, n: r.n, me: r.id === me });
      const mine = rows.find((r) => r.id === me);
      return sendJson(res, 200, { ok: true, game, week: all ? 'all' : 'this', min: GameRanking.MIN_GAMES, top: rows.slice(0, 20).map(view), me: mine ? view(mine) : null });
    } catch (error) {
      console.error('랭킹 조회 실패:', error);
      return sendError(res, 503, 'RECORDS_UNAVAILABLE', '랭킹을 불러오지 못했습니다.');
    }
  }
  // Head-to-head only ever looks at matches with exactly two outcomes (see lib/match-records.js),
  // so multiplayer games and 2v2 team matches are excluded without any extra bookkeeping here.
  const headToHeadLookup = pathname.match(/^\/api\/records\/(admin:[A-Za-z0-9_-]{10,40}|[0-9a-f-]{36})\/versus-me$/i);
  if (headToHeadLookup && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    try {
      const myId = recordIdentity(session);
      const player = (await recordPlayers()).find(person => person.id === headToHeadLookup[1]);
      if (!player) return sendError(res, 404, 'PLAYER_NOT_FOUND', '해당 플레이어를 찾을 수 없습니다.');
      if (player.id === myId) return sendError(res, 400, 'SAME_PLAYER', '자기 자신과의 상대 전적은 조회할 수 없습니다.');
      const stats = await matchStore.headToHead(myId, player.id);
      return sendJson(res, 200, { player, ...stats });
    } catch (error) {
      console.error('상대 전적 조회 실패:', error);
      return sendError(res, 503, 'RECORDS_UNAVAILABLE', '상대 전적을 불러오지 못했습니다.');
    }
  }

  if (pathname === '/api/rooms/public' && req.method === 'GET') {
    if (!requireSession(req, res)) return;
    return sendJson(res, 200, { rooms: listPublicRooms() });
  }

  if (pathname === '/api/lobby/players' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    if (!room || !isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 초대할 수 있습니다.');
    if (room.game.status !== 'selecting') return sendError(res, 409, 'ROUND_STARTED', '역할 선택 중에만 초대할 수 있습니다.');
    const players = lobbyPeers().filter(peer => peer.token !== session.token)
      .map(peer => ({ id: peer.publicId, label: peer.label }));
    return sendJson(res, 200, { players });
  }

  if (pathname === '/api/rooms/invite' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    if (!room || !isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 초대할 수 있습니다.');
    if (room.game.status !== 'selecting') return sendError(res, 409, 'ROUND_STARTED', '대국 시작 전까지만 초대할 수 있습니다.');
    if (!checkRateLimit('room-invite:' + session.token.slice(0, 12), 12, 60 * 1000)) {
      return sendError(res, 429, 'TOO_MANY_INVITES', '초대를 너무 많이 보냈습니다. 잠시 뒤 다시 시도해 주세요.');
    }
    const body = await parseJson(req);
    const id = typeof body.targetId === 'string' ? body.targetId : '';
    const recipient = lobbyPeers().find(peer => peer.publicId === id && peer.token !== session.token);
    if (!recipient) return sendError(res, 404, 'RECIPIENT_NOT_FOUND', '상대가 로비를 떠났습니다. 목록을 갱신해 주세요.');
    pruneInvitations();
    const pending = [...invitations.values()].filter(invite => invite.toToken === recipient.token);
    if (pending.some(invite => invite.roomId === room.id)) return sendError(res, 409, 'ALREADY_INVITED', '이미 초대를 보냈습니다.');
    if (pending.length >= 5) return sendError(res, 409, 'INVITE_INBOX_FULL', '상대가 받은 초대가 많습니다. 잠시 뒤 다시 시도해 주세요.');
    const inviteId = newSecret(16);
    invitations.set(inviteId, { fromToken: session.token, toToken: recipient.token, roomId: room.id, createdAt: nowMs() });
    broadcastLobby();
    return sendJson(res, 201, { ok: true, id: inviteId });
  }

  if (pathname === '/api/invitations' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    return sendJson(res, 200, { items: invitationsFor(session) });
  }

  const inviteReply = pathname.match(/^\/api\/invitations\/([A-Za-z0-9_-]{10,128})\/respond$/);
  if (inviteReply && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    if (typeof body.accept !== 'boolean') return sendError(res, 400, 'BAD_REPLY', '수락 또는 거절을 선택해 주세요.');
    pruneInvitations();
    const invite = invitations.get(inviteReply[1]);
    if (!invite) return sendError(res, 404, 'INVITE_NOT_FOUND', '초대가 만료되었거나 취소되었습니다.');
    if (invite.toToken !== session.token) return sendError(res, 403, 'NOT_RECIPIENT', '초대를 받은 사람만 응답할 수 있습니다.');
    if (!body.accept) {
      invitations.delete(inviteReply[1]);
      broadcastLobby();
      return sendJson(res, 200, { ok: true, accepted: false });
    }
    if (getCurrentRoom(session)) return sendError(res, 409, 'IN_ROOM', '이미 게임방에 참여 중입니다.');
    const room = rooms.get(invite.roomId);
    const host = sessions.get(invite.fromToken);
    if (!room || !host || !isRoomHost(room, host) || host.currentRoomId !== room.id
      || room.game.status !== 'selecting') {
      invitations.delete(inviteReply[1]);
      broadcastLobby();
      return sendError(res, 409, 'INVITE_EXPIRED', '방이 종료되었거나 대국이 시작됐습니다.');
    }
    invitations.delete(inviteReply[1]);
    session.currentRoomId = room.id;
    registerParticipant(room, session);
    appendSystemMessage(room, session.label + '님이 초대를 수락했습니다.');
    touchRoom(room);
    broadcast(room);
    return sendJson(res, 200, { ok: true, accepted: true, state: roomView(room, session) });
  }

  if (pathname === '/api/rooms/public/join' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    if (getCurrentRoom(session)) return sendError(res, 409, 'IN_ROOM', '먼저 현재 게임방에서 나와 주세요.');
    const body = await parseJson(req);
    const room = typeof body.roomId === 'string' ? rooms.get(body.roomId) : null;
    if (!room || !publicRoomSummary(room)) return sendError(res, 404, 'ROOM_NOT_FOUND', '공개방을 찾을 수 없습니다.');
    session.currentRoomId = room.id;
    registerParticipant(room, session);
    touchRoom(room);
    broadcast(room);
    return sendJson(res, 200, { state: roomView(room, session) });
  }

  if (pathname === '/api/rooms' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const gameType = String(body.gameType || 'omok').toLowerCase();
    if (!hasGame(gameType)) return sendError(res, 400, 'BAD_GAME_TYPE', '지원하지 않는 게임입니다.');
    const visibility = body.visibility === undefined ? 'private' : body.visibility;
    if (visibility !== 'public' && visibility !== 'private') {
      return sendError(res, 400, 'BAD_VISIBILITY', '공개방 또는 비공개방을 선택해 주세요.');
    }
    if (body.title !== undefined && typeof body.title !== 'string') {
      return sendError(res, 400, 'BAD_ROOM_TITLE', '방 제목은 문자로 입력해 주세요.');
    }
    const title = String(body.title || '').trim().replace(/\s+/g, ' ');
    if (title.length > 40) return sendError(res, 400, 'ROOM_TITLE_TOO_LONG', '방 제목은 40자까지 입력할 수 있습니다.');
    let digitCount = 3;
    if (gameType === 'baseball') {
      digitCount = Number(body.digitCount === undefined ? 3 : body.digitCount);
      if (![3, 4].includes(digitCount)) {
        return sendError(res, 400, 'BAD_DIGIT_COUNT', '숫자야구는 3자리 또는 4자리로 선택해 주세요.');
      }
    }
    const previous = getCurrentRoom(session);
    if (previous && previous.participants[session.token]) {
      previous.participants[session.token].connected = false;
      appendSystemMessage(previous, session.label + '님이 새 방을 만들었습니다.');
      broadcast(previous);
    }
    let pointsPerScore = 100;
    if (gameType === 'gostop' && body.pointsPerScore !== undefined) {
      pointsPerScore = Number(body.pointsPerScore);
      if (!getGame('gostop').STAKES.includes(pointsPerScore)) return sendError(res, 400, 'BAD_STAKE', '점당 포인트는 10P, 50P, 100P 중에서 선택해 주세요.');
    }
    // v1.10.72 게임방 AI 자리: 오목·사목·오델로 with the server playing the other seat (a private practice room)
    const aiLevel = body.ai == null || body.ai === '' ? null : String(body.ai);
    if (aiLevel && (!RoomAi.GAMES.has(gameType) || !Object.hasOwn(RoomAi.LEVELS, aiLevel))) return sendError(res, 400, 'BAD_AI', 'AI와 둘 수 없는 게임입니다.');
    const room = makeRoom(session, gameType, aiLevel ? 'private' : visibility, { title, digitCount, pointsPerScore });
    if (aiLevel) seatRoomAi(room, aiLevel);
    rooms.set(room.id, room);
    session.currentRoomId = room.id;
    registerParticipant(room, session);
    touchRoom(room);
    broadcastLobby();
    return sendJson(res, 201, { state: roomView(room, session) });
  }

  if (pathname === '/api/rooms/join' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const key = `room-join:${clientIp(req)}:${session.token.slice(0, 10)}`;
    if (!checkRateLimit(key, 12, 5 * 60 * 1000)) return sendError(res, 429, 'TOO_MANY_ATTEMPTS', '방 비밀번호 입력 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    const body = await parseJson(req);
    const room = findRoomByCode(body.code);
    if (!room) return sendError(res, 404, 'ROOM_NOT_FOUND', '방 비밀번호가 올바르지 않거나 종료된 방입니다.');
    session.currentRoomId = room.id;
    registerParticipant(room, session);
    touchRoom(room);
    broadcast(room);
    return sendJson(res, 200, { state: roomView(room, session) });
  }

  if (pathname === '/api/room' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    if (!room) return sendJson(res, 200, { state: null });
    registerParticipant(room, session);
    // v1.7.32: opening the room still tries to record a finished match (a retry), but a failure no longer hides the
    // room. The player sees the finished board with "정산 처리 중"; starting the next round stays blocked until it is
    // recorded (next-round/rematch keep recordOrError), and the settlement retry broadcasts once it succeeds.
    const round = room.game.round;
    require('./lib/room-record-retry').queueRoomRecord(room, {
      record: recordFinishedMatch,
      isCurrent: () => rooms.get(room.id) === room && room.game.round === round,
      onSaved: () => broadcast(room),
      onError: error => console.error('전적 영구 저장 실패(방 조회는 계속):', error.message),
    });
    return sendJson(res, 200, { state: roomView(room, session) });
  }

  if (pathname === '/api/room/leave' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    session.currentRoomId = null;
    if (room?.participants[session.token]) {
      const leftSeat = findSeat(room, session.token);
      if (leftSeat && room.game.status === 'selecting') {
        room.players[leftSeat] = null;
        room.participants[session.token].choice = null;
      }
      room.participants[session.token].rejoinable = false;
      room.participants[session.token].connected = false;
      room.participants[session.token].lastSeen = nowIso();
      appendSystemMessage(room, (session.label || '게스트') + '님이 방에서 나갔습니다.');
      touchRoom(room);
      broadcast(room);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/room/chat' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    if (!room) return sendError(res, 404, 'NO_ROOM', '현재 입장한 방이 없습니다.');
    // v1.6.42: liar-game hints must stay unseen by everyone but the speaker until they're actually
    // spoken in turn -- room chat would let players trade the word or accuse each other mid-hint,
    // so it's locked for the duration of the hint phases only (voting/guessing/reveal are unaffected).
    if (isLiar(room) && room.game.status === 'playing' && ['hint1', 'hint2', 'extraHint'].includes(room.game.phase)) {
      return sendError(res, 409, 'LIAR_HINT_CHAT_LOCKED', '힌트 진행 중에는 채팅할 수 없습니다.');
    }
    if (isTwenty(room) && room.game.status === 'playing' && findSeat(room, session.token) === room.game.drawerSeat) {
      return sendError(res, 409, 'TWENTY_DRAWER_CHAT_LOCKED', '출제자는 스무고개 진행 중 채팅할 수 없습니다.');
    }
    const key = 'room-chat:' + session.token.slice(0, 12);
    if (!checkRateLimit(key, 6, 5 * 1000)) return sendError(res, 429, 'CHAT_RATE_LIMIT', '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 보내 주세요.');
    const body = await parseJson(req);
    const text = String(body.text || '').trim();
    if (!text) return sendError(res, 400, 'EMPTY_CHAT', '메시지를 입력해 주세요.');
    if (text.length > MAX_CHAT_LENGTH) return sendError(res, 400, 'CHAT_TOO_LONG', '채팅은 ' + MAX_CHAT_LENGTH + '자까지 입력할 수 있습니다.');
    appendChatMessage(room, session, text, chatIdFor(session));
    touchRoom(room);
    broadcast(room);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/room/events' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    if (!room) return sendError(res, 404, 'NO_ROOM', '현재 입장한 방이 없습니다.');
    registerParticipant(room, session);
    res.writeHead(200, securityHeaders({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    }));
    res.write(': connected\n\n');
    if (!streams.has(room.id)) streams.set(room.id, new Set());
    const entry = { res, sessionToken: session.token };
    streams.get(room.id).add(entry);
    broadcast(room);

    const heartbeat = setInterval(() => {
      const current = sessions.get(session.token);
      if (!current) {
        try { sseWrite(res, 'sessionExpired', { message: '입장 세션이 만료되었습니다.' }); res.end(); } catch {}
        return clearInterval(heartbeat);
      }
      current.lastSeen = nowMs(); noteVisit(pointAccountForSession(current)); // (a day on, still here: in today -- Codex review)
      if (current.guestKeyId) current.leaseSeenAt = current.lastSeen;
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      const set = streams.get(room.id);
      set?.delete(entry);
      if (set && set.size === 0) streams.delete(room.id);
      if (!uniqueLiveTokens(room.id).has(session.token) && room.participants[session.token]) {
        room.participants[session.token].connected = false;
        room.participants[session.token].lastSeen = nowIso();
        syncGamePause(room);
        touchRoom(room);
        broadcast(room);
      }
    });
    return;
  }

  match = pathname.match(/^\/api\/room\/(rpg-input|rpg-act|rpg-class|rpg-start|rpg-pick|rpg-stat|rpg-item|rpg-ready|choose-role|set-gostop-stake|start-gostop|gostop-play|gostop-choose|gostop-flip|gostop-gukjin|gostop-decide|twenty-start|twenty-next|twenty-secret|twenty-question|twenty-answer|twenty-guess|twenty-judge|set-halligalli-time|start-halligalli|flip-halligalli|ring-halligalli|start-davinci|select-davinci|guess-davinci|stop-davinci|reveal-davinci|set-pandemic|start-pandemic|pandemic-act|set-oldmaid-mode|start-oldmaid|shuffle-oldmaid|draw-oldmaid|use-ability-oldmaid|set-liar-rounds|start-liar|liar-hint|liar-vote|liar-guess|set-bingo-target|set-bingo-grid|set-bingo-pool|start-bingo|select-bingo|set-pictionary-config|start-pictionary|pictionary-stroke|pictionary-clear|pictionary-undo|pictionary-guess|set-secret|guess|throw-yut|move-yut|start-city|roll-city|buy-city|skip-city|build-city|skip-build-city|sell-property-city|sell-building-city|move|resign|present|end-game|next-round|rematch)$/);
  if (match && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    return handleRoomAction(req, res, match[1], session);
  }

  if (req.method === 'GET') {
    if (pathname === '/') return browserBlocked(req) ? sendChromeOnly(res) : sendIndex(res, {});
    if (pathname === '/herosurv') { res.writeHead(301, securityHeaders({ Location: '/herosurv/' })); return res.end(); }
    if (pathname === '/herosurv/') return browserBlocked(req) ? sendChromeOnly(res) : sendHerosurv(res);
    // 달마루섬 5단계: the server's own island, told before the island's scripts load (island-map.js) -- a page on it never
    // loads twice to learn the map; on 지금 섬 nothing (the administrator's preview keeps its own way)
    if (pathname === '/plaza/island-live.js') { res.writeHead(200, securityHeaders({ 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' })); return res.end(IslandTerrain.MAP === 'dalmaru' ? "self.GC_ISLAND_MAP = 'dalmaru'; self.GC_ISLAND_LIVE = true;\n" : '\n'); }
    if (await serveVendor(req, res, pathname)) return;
    if (await serveStatic(res, pathname, req)) return;
  }

  return sendError(res, 404, 'NOT_FOUND', '찾을 수 없습니다.');
}

async function main() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  codeRevs = buildCodeManifest(PUBLIC_DIR, VENDOR_FILES);
  ({ html: indexTemplate, csp: importMapCsp } = prepareIndex(await fsp.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8'), codeRevs));
  herosurvTemplate = (await fsp.readFile(path.join(PUBLIC_DIR, 'herosurv', 'index.html'), 'utf8'))
    .replace(/(src|href)="(\/[^"?#]+\.(?:js|css))"/g, (_, attr, url) => `${attr}="${hashedUrl(codeRevs, url)}"`)
    .replace('__HEROSURV_ASSETS__', escapeAttr(HEROSURV_ASSETS));
  const pack = buildAssetManifest(PUBLIC_DIR, ext => Boolean(MIME[ext]));
  assetPackVersion = pack.version;
  assetManifestJson.on = JSON.stringify({ enabled: true, ...pack, assetsOff: islandAssetsOff }).replace(/</g, '\\u003c');
  accessStore = await createAccessStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });
  announcementStore = await createAnnouncementStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });
  messengerStore = await createMessengerStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });
  matchStore = await createMatchStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });
  // v1.10.35: new accounts start at 0P; the test server keeps an opening 100,000P so its shop tests can buy
  pointStore = await createPointStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL, initialGrant: process.env.NODE_ENV === 'test' ? 100_000 : undefined });
  await require('./lib/nickname-recovery').recoverNicknamePayments(pointStore, accessStore);
  for (const [account, debt] of Object.entries(await pointStore.taxDebts())) taxDebt.set(account, debt); // v1.10.86
  settleClimbWeeks(); // v1.9.5: weeks that ended while the server was down are settled right away
  await dalmaruMoveIn().catch((error) => console.error('달마루섬 이사 실패:', error.message)); // 5단계: once, the first start on the new island
  weedState().catch((error) => console.error('잡초 보충 실패:', error.message)); // v1.10.31: and the weeds of the days it missed grow back
  settleDonationWeeks(); // v1.10.5: the same for donation weeks (statues, 호구왕)
  Economy.load(await pointStore.worldValue('economy')); // v1.10.91 경제 값 관리: the administrator's values
  // v1.10.91 변신 따로 판매 A안: the set owners get their transformation (idempotent; new owners of a whole set after this buy it)
  if (!(await pointStore.worldValue('transformGrant'))) {
    const sets = SkinCatalog.SKINS.filter((s) => s.slot === 'transform').map((s) => ({ tf: s.id, items: require('./public/plaza/character-transformations.js').find(s.transform).items }));
    const out = await pointStore.grantTransformations(sets).catch((error) => { console.error('변신 지급 실패:', error.message); return null; });
    if (out) { await pointStore.setWorldValue('transformGrant', { at: nowMs(), granted: out.granted.length }); console.log(`변신 지급(A안): ${out.granted.length}건`); }
  }
  if (!SkinCatalog.IP_ON) { // v1.10.90 IP 스킨 정리: switched off -> what was paid for them goes back, once
    const out = await pointStore.refundSkins(SkinCatalog.IP_SKIN_IDS).catch((error) => { console.error('IP 스킨 환불 실패:', error.message); return null; });
    if (out?.refunded.length) { console.log(`IP 스킨 정리 환불: ${out.refunded.length}건`); notifyPointsChanged([...new Set(out.refunded.map((r) => r.userId))]); }
  }
  settleWeeklyTitles(); // v1.10.89 낚시왕 · v1.10.90 제초왕
  // Existing guests get their one-time account on first sight; this backfill is idempotent.
  try {
    let created = 0;
    for (const key of await accessStore.list()) if ((await pointStore.ensureAccount(`guest:${key.id}`)).created) created += 1;
    console.log(`포인트 저장소: ${DATABASE_URL ? 'PostgreSQL' : '로컬 JSON'} · 신규 계정 ${created}개`);
    // v1.10.9 작명소: names that are already the same once spaces are removed are left as they are (counted only)
    const byName = new Map();
    for (const key of await accessStore.list()) byName.set(normalizeNickname(key.label), (byName.get(normalizeNickname(key.label)) || 0) + 1);
    console.log(`닉네임 중복(공백 무시): 기존 ${[...byName.values()].filter((n) => n > 1).length}묶음`);
    const refunded = await refundOrphanEntries();
    if (refunded) console.log(`참가 포인트 환불: 재시작으로 끝나지 못한 게임 ${refunded}판`);
  } catch (error) {
    console.error('포인트 계정 초기화 실패:', error);
  }
  if (process.env.NODE_ENV !== 'test') {
    await announcementStore.seedReleases(releaseAnnouncements);
    const notices = await announcementStore.list();
    const nicknamePinned = notices.some(item => item.pinned && /닉네임.*변경.*안내/.test(item.title));
    console.log(`공지사항 동기화: ${notices.length}개 · 닉네임 변경안내 고정 ${nicknamePinned ? '확인' : '미확인'}`);
  }

  const server = http.createServer((req, res) => {
    requestHandler(req, res).catch((err) => {
      console.error(err);
      if (!res.headersSent) sendError(res, err.status || 500, 'SERVER_ERROR', err.status === 400 ? '요청 형식이 올바르지 않습니다.' : '서버 오류가 발생했습니다.');
      else res.end();
    });
  });

  setInterval(() => {
    const now = nowMs();
    for (const [token, session] of sessions) {
      if (now - session.lastSeen > SESSION_IDLE_MS || now - session.createdAt > SESSION_MAX_MS) releaseSessionToken(token);
    }
    for (const [id, room] of rooms) {
      const age = now - new Date(room.updatedAt).getTime();
      if (age > ROOM_TTL_MS && !streams.has(id)) {
        expireRoom(room);
      }
    }
    for (const [key, row] of rateLimits) {
      if (now - row.startedAt > 60 * 60 * 1000) rateLimits.delete(key);
    }
  }, 10 * 60 * 1000).unref();

  setInterval(() => { if (invitations.size) broadcastLobby(); }, 15000).unref();
  setInterval(sweepInputIdle, 60 * 1000).unref(); // v1.10.35
  setInterval(() => refundOrphanEntries('orphan-sweep').catch(error => console.error('참가 포인트 정기 정리 실패:', error.message)), 60_000).unref();
  setInterval(() => tickPictionaryRooms().catch(error => console.error('그림 맞히기 전적 처리 오류:', error)), 1000).unref();
  setInterval(() => tickHalliRooms().catch(error => console.error('할리갈리 전적 처리 오류:', error)), 100).unref();
  setInterval(() => { try { tickRpgRooms(); } catch (error) { console.error('잿빛 원정 진행 오류:', error); } }, 50).unref();
  setInterval(() => tickDavinciRooms().catch(error => console.error('다빈치 코드 전적 처리 오류:', error)), 1000).unref();
  setInterval(() => tickLiarRooms().catch(error => console.error('라이어 전적 처리 오류:', error)), 1000).unref();
  setInterval(() => tickIdleRooms().catch(error => console.error('자리비움 감지 처리 오류:', error)), AFK_TICK_MS).unref();
  server.listen(PORT, HOST, () => console.log(`게임 서버 v1.10.107 실행: http://${HOST}:${PORT}`));
  // v1.10.86 주민세: the day's tax once the day has begun (checked every few minutes; a server asleep through a day
  // takes that day's when it wakes). Tests run it themselves (/api/test/tax).
  if (process.env.NODE_ENV !== 'test') { collectTaxes(); setInterval(() => collectTaxes(), 5 * 60 * 1000).unref?.(); }
}

main().catch((err) => {
  console.error('서버 시작 실패:', err);
  process.exit(1);
});
