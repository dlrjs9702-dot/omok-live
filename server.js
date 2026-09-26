const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const { getGame, hasGame, listGames } = require('./lib/games');
const { buildActionTimer, currentTurnSeat } = require('./lib/action-timer');
const TEAM_SEATS = ['1', '2', '3', '4'];
const PICTIONARY_SEATS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const OLDMAID_SEATS = ['1', '2', '3', '4'];
const MARATHON_SEATS = ['1', '2', '3', '4', '5', '6'];
const isTeam = (room) => room.gameType === 'omok2v2';
const isBingo = (room) => room.gameType === 'bingo';
const isPictionary = (room) => room.gameType === 'pictionary';
const isTwenty = (room) => room.gameType === 'twentyquestions';
const isDavinci = (room) => room.gameType === 'davinci';
const isHalli = (room) => room.gameType === 'halligalli';
const isLiar = (room) => room.gameType === 'liar';
const isOldMaid = (room) => room.gameType === 'oldmaid';
const isCityKing = (room) => room.gameType === 'cityking';
const isMarathon = (room) => room.gameType === 'marathon';
const isNumberedSeatGame = (room) => isTeam(room) || isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isMarathon(room) || isTwenty(room) || isDavinci(room) || isHalli(room);
// Marathon's own selectable seat count depends on its pre-start team layout (2v2 needs exactly 4
// seats; individual/3v3/2v2v2 use all 6), so its own room state decides how many seat buttons show.
function marathonSeatSlots(room) {
  const g = room.game;
  if (g?.mode === 'team' && g?.teamLayout === '2v2') return MARATHON_SEATS.slice(0, 4);
  return MARATHON_SEATS;
}
const seatsFor = (room) => isHalli(room) ? MARATHON_SEATS : isDavinci(room) ? OLDMAID_SEATS : isOldMaid(room) ? OLDMAID_SEATS : (isPictionary(room) || isLiar(room) || isTwenty(room)) ? PICTIONARY_SEATS : isMarathon(room) ? marathonSeatSlots(room) : TEAM_SEATS;
const teamColor = (seat) => TEAM_SEATS.includes(String(seat)) ? (Number(seat) % 2 ? 'black' : 'white') : null;
// Seats actually holding a player, for any room type -- the generic set connection-drop handling
// (pause detection, disconnect-forced ending) operates over.
const assignedSeatsFor = (room) => isNumberedSeatGame(room)
  ? seatsFor(room).filter(seat => room.players[seat])
  : ['black', 'white'].filter(color => room.players[color]);
const { createAccessStore } = require('./lib/access-store');
const { createAnnouncementStore } = require('./lib/announcement-store');
const { createMatchStore } = require('./lib/match-records');
const { buildMatchResult } = require('./lib/match-result');
const releaseAnnouncements = require('./lib/release-announcements');
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
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? '' : 'dev-admin');
const MAX_BODY = 48 * 1024;
const SESSION_IDLE_MS = Math.max(10, Number(process.env.SESSION_IDLE_MINUTES || 60)) * 60 * 1000;
const SESSION_MAX_MS = Math.max(1, Number(process.env.SESSION_MAX_HOURS || 8)) * 60 * 60 * 1000;
const ROOM_TTL_MS = Math.max(2, Number(process.env.ROOM_TTL_HOURS || 12)) * 60 * 60 * 1000;
const GUEST_LOCK_TTL_MS = Math.max(30, Number(process.env.GUEST_LOCK_TTL_SECONDS || 90)) * 1000;
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
const INVITE_TTL_MS = 2 * 60 * 1000;
let accessStore;
let announcementStore;
let matchStore;
let indexTemplate = '';

function nowIso() { return new Date().toISOString(); }
function nowMs() { return Date.now(); }
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function publicBaseUrl(req) {
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
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
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
    .replace('__SESSION_LABEL__', escapeAttr(bootstrap.label || ''));
  res.writeHead(200, securityHeaders({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
  }));
  res.end(html);
}

function sendSimpleHtml(res, status, title, message) {
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${escapeAttr(title)}</title><style>body{font-family:system-ui,sans-serif;background:#111827;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}.box{max-width:460px;padding:30px;background:#1f2937;border-radius:20px;text-align:center}p{color:#d1d5db;line-height:1.6}</style></head><body><div class="box"><h1>${escapeAttr(title)}</h1><p>${escapeAttr(message)}</p></div></body></html>`;
  res.writeHead(status, securityHeaders({
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
  }));
  res.end(html);
}

async function serveStatic(res, pathname) {
  const relative = pathname.replace(/^\//, '');
  if (!relative || relative.includes('..')) return false;
  const filePath = path.join(PUBLIC_DIR, relative);
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return false;
    const ext = path.extname(filePath).toLowerCase();
    if (!MIME[ext]) return false;
    res.writeHead(200, securityHeaders({
      'Content-Type': MIME[ext],
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
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
  const raw = await readBody(req);
  if (!raw) return {};
  try { return JSON.parse(raw); }
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
    currentRoomId: null,
  };
  sessions.set(token, session);
  if (guestKeyId) activeGuestSessions.set(guestKeyId, token);
  return session;
}

// Session tokens are intentionally short-lived and browser-specific. Guest keys are the
// durable identity that must survive a refresh, reconnect, or a browser handoff, while an
// admin session is only durable for the lifetime of that login.
function sessionIdentity(session) {
  if (!session) return null;
  return session.guestKeyId ? `guest:${session.guestKeyId}` : `admin:${session.publicId}`;
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

function releaseSessionToken(token, { message = null } = {}) {
  const session = sessions.get(token);
  if (!session) return false;
  sessions.delete(token);
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
    p.rejoinable = Boolean(findSeat(room, token) && (room.game.status === 'playing' || (isTwenty(room) && room.game.status === 'round-ended')));
    syncGamePause(room);
    broadcast(room);
  }
  if (lobbyChanged || session.currentRoomId || cancelledInvitation) broadcastLobby();
  return true;
}

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

function publicLobbyState(session = null) {
  return {
    connectedCount: lobbyPeers().length,
    messages: publicChatMessages(lobbySocial).slice(-LOBBY_CHAT_MESSAGES),
    rooms: listPublicRooms(),
    invitations: invitationsFor(session),
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
    players: ['oldmaid', 'marathon', 'davinci'].includes(gameEngine.id)
      ? Object.fromEntries(OLDMAID_SEATS.map((seat) => [seat, null]))
      : gameEngine.id === 'halligalli'
      ? Object.fromEntries(MARATHON_SEATS.map((seat) => [seat, null]))
      : ['pictionary', 'liar', 'twentyquestions'].includes(gameEngine.id)
      ? Object.fromEntries(PICTIONARY_SEATS.map((seat) => [seat, null]))
      : ['omok2v2', 'bingo'].includes(gameEngine.id)
        ? { '1': null, '2': null, '3': null, '4': null }
        : { black: null, white: null },
    social: createRoomSocial(),
    game: gameEngine.create(gameEngine.id === 'baseball' ? { digitCount: options.digitCount } : undefined),
  };
  appendSystemMessage(room, `${hostSession.label || '방장'}님이 ${room.title || gameEngine.name + ' 방'}을 만들었습니다.`);
  return room;
}

function touchRoom(room) { room.updatedAt = nowIso(); }

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
      if (!isReconnectingHost && (!oldSeat || !old.rejoinable)) continue;
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
  p.lastSeen = nowIso();
  if (room.hostIdentity === sessionIdentity(session)) room.hostSessionToken = session.token;
  if (room.game.status !== 'selecting' && !findSeat(room, session.token)) p.choice = 'spectator';
  if (isNew) appendSystemMessage(room, (session.label || '게스트') + '님이 입장했습니다.');
  return p;
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
  if (room.game.status !== 'playing') {
    room.game.paused = false;
    room.game.disconnectedSeats = [];
    room.turnWatch = null;
    room.twentyDrawerDisconnectSince = null;
    return { stateChanged: false, gameFinished: false };
  }

  const disconnected = assignedSeatsFor(room).filter(seat => {
    const token = room.players[seat];
    const person = token && room.participants[token];
    return !person?.connected || sessions.get(token)?.currentRoomId !== room.id;
  });

  if (isDavinci(room) || isHalli(room)) {
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
    if (turnSeat === drawerSeat && drawerDisconnected) {
      room.turnWatch = null;
      return { stateChanged: false, gameFinished: false };
    }

    const turnDisconnected = disconnected.includes(turnSeat);
    const watchKey = `${room.game.phase}:${turnSeat}:${turnDisconnected ? 'disconnected' : 'idle'}`;
    if (!room.turnWatch || room.turnWatch.key !== watchKey) {
      room.turnWatch = { key: watchKey, seat: turnSeat, since: now };
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
  if (isPictionary(room) || isLiar(room) || isMarathon(room) || disconnected.length > 0) {
    room.turnWatch = null;
  } else {
    const turnSeat = currentTurnSeat(room);
    if (!turnSeat) {
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
    if (room.game.status !== 'playing' || isPictionary(room) || isLiar(room) || isMarathon(room) || isDavinci(room) || isHalli(room)) continue;
    const wasPaused = room.game.paused;
    const pauseResult = syncGamePause(room);
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
  return { label: p?.label || '게스트', connected: Boolean(p?.connected) };
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
  };
}

function roomView(room, session) {
  const p = room.participants[session.token] || null;
  const seat = findSeat(room, session.token);
  const isHost = isRoomHost(room, session);
  return {
    ...publicRoom(room),
    game: isHalli(room) ? { ...getGame('halligalli').publicState(room.game), serverNow: nowMs() }
      : isLiar(room) ? getGame('liar').publicState(room.game, seat)
      : isMarathon(room) ? getGame('marathon').publicState(room.game, seat)
      : publicRoom(room).game,
    me: {
      label: session.label,
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
      myOldMaidHand: isOldMaid(room) ? getGame('oldmaid').handFor(room.game, seat) : null,
      myOldMaidAbility: isOldMaid(room) && seat ? getGame('oldmaid').abilityFor(room.game, seat) : null,
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
  if (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isMarathon(room) || isTwenty(room) || isDavinci(room) || isHalli(room)) return;
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
  room.game.disconnectedAtEnd = [];
  if (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isMarathon(room) || isTwenty(room) || isDavinci(room) || isHalli(room)) {
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
async function recordFinishedMatch(room) {
  const result = buildMatchResult(room, nowIso());
  if (!result) return false;
  room.recordedMatches ||= new Set();
  if (room.recordedMatches.has(result.id)) return false;
  await matchStore.recordMatch(result);
  room.recordedMatches.add(result.id);
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

function recordIdentity(session) { return session.guestKeyId || `admin:${session.publicId}`; }

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
  const role = seat ? (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isTwenty(room) || isDavinci(room) || isHalli(room) ? `${seat}번`
    : isTeam(room) ? `${teamColor(seat) === 'black' ? '흑' : '백'}팀 ${seat}번`
    : room.gameType === 'baseball' ? (seat === 'black' ? '선공' : '후공')
      : room.gameType === 'connect4' ? (seat === 'black' ? '빨강' : '노랑')
        : ['yut', 'dots'].includes(room.gameType) ? (seat === 'black' ? '파랑' : '빨강')
          : (seat === 'black' ? '흑' : '백')) : '관전자';
  const game = getGame(room.gameType)?.name || '게임';
  const otherSeat = seat === 'black' ? 'white' : 'black';
  const opponentToken = seat ? room.players[otherSeat] : null;
  const opponent = (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isCityKing(room) || isTwenty(room) || isDavinci(room) || isHalli(room)) && seat
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
    let changed = false;
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


// Server-authoritative mission-deadline timer for marathon. A mission that nobody answers in
// time must still fail (penalty + chained re-draw) without any client request arriving, exactly
// like liar's hint/vote/guess deadlines below.
async function tickMarathonRooms() {
  const now = nowMs();
  const engine = getGame('marathon');
  for (const room of rooms.values()) {
    if (!isMarathon(room) || room.game.status !== 'playing') continue;
    if (!engine.tick(room.game, now)) continue;
    if (['finished', 'draw'].includes(room.game.status)) {
      try { await recordFinishedMatch(room); }
      catch (error) { console.error('마라톤 전적 저장 실패:', error); continue; }
    }
    touchRoom(room);
    broadcast(room);
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

async function handleRoomAction(req, res, action, session) {
  const room = getCurrentRoom(session);
  if (!room) return sendError(res, 404, 'NO_ROOM', '먼저 방을 만들거나 방 비밀번호를 입력해 주세요.');
  const body = await parseJson(req);
  const participant = room.participants[session.token] || registerParticipant(room, session);
  if ((action === 'next-round' || action === 'rematch') && !(await recordOrError(room, res))) return;
  // Only draw-oldmaid ever sets this: the drawn card's identity, for the drawer's own animation --
  // never broadcast (see roomView/broadcast below), so opponents and spectators never see it.
  let drawnOldMaidCard = null;

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

  if (action === 'choose-role') {
    if (room.game.status !== 'selecting') return sendError(res, 409, 'ROUND_STARTED', '대국이 시작된 뒤에는 역할을 바꿀 수 없습니다.');
    const valid = isNumberedSeatGame(room) ? [...seatsFor(room), 'spectator'] : ['black', 'white', 'spectator'];
    const choice = valid.includes(body.choice) ? body.choice : null;
    if (!choice) return sendError(res, 400, 'BAD_ROLE', isNumberedSeatGame(room) ? `1~${seatsFor(room).length}번 자리 또는 관전을 선택해 주세요.` : '흑, 백, 관전 중에서 선택해 주세요.');
    if (choice !== 'spectator' && room.players[choice] && room.players[choice] !== session.token) {
      return sendError(res, 409, 'ROLE_TAKEN', isNumberedSeatGame(room) ? `${choice}번 자리는 이미 선택됐습니다.` : `${choice === 'black' ? '흑' : '백'}은 다른 사람이 이미 선택했습니다.`);
    }
    const oldSeat = findSeat(room, session.token);
    if (oldSeat && oldSeat !== choice) room.players[oldSeat] = null;
    if (choice === 'spectator') participant.choice = 'spectator';
    else {
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

  if (action === 'set-marathon-config') {
    if (!isMarathon(room)) return sendError(res, 400, 'WRONG_GAME', '마라톤 방에서만 설정할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 설정을 변경할 수 있습니다.');
    const engine = getGame('marathon');
    const verdict = engine.configure(room.game, { mode: body.mode, teamLayout: body.teamLayout, difficulty: body.difficulty });
    if (!verdict.legal) return sendError(res, 409, 'INVALID_MARATHON_CONFIG', engine.moveError(verdict.reason));
  }

  if (action === 'start-marathon') {
    if (!isMarathon(room)) return sendError(res, 400, 'WRONG_GAME', '마라톤 방에서만 시작할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 마라톤을 시작할 수 있습니다.');
    const seats = seatsFor(room).filter(n => room.players[n]);
    const engine = getGame('marathon');
    const verdict = engine.start(room.game, seats);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_MARATHON_START', engine.moveError(verdict.reason));
    for (const p of Object.values(room.participants)) if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
    appendSystemMessage(room, room.game.mode === 'team'
      ? `마라톤(팀전 · ${room.game.teamLayout}) 시작! 30칸을 먼저 통과한 팀이 승리합니다.`
      : '마라톤(개인전) 시작! 30칸을 먼저 통과한 참가자가 승리합니다.');
  }

  if (action === 'roll-marathon') {
    if (!isMarathon(room)) return sendError(res, 400, 'WRONG_GAME', '마라톤 방에서만 주사위를 굴릴 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 주사위를 굴릴 수 없습니다.');
    const engine = getGame('marathon');
    const verdict = engine.rollDice(room.game, seat, Number(body.expectedPhaseId));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_MARATHON_ROLL', engine.moveError(verdict.reason));
    appendSystemMessage(room, `${session.label || '플레이어'}님이 주사위를 굴려 ${verdict.roll}칸 전진했습니다 (현재 ${verdict.position}칸).`);
    if (verdict.finished) appendSystemMessage(room, `${session.label || '참가자'}님이 결승선을 통과했습니다!`);
  }

  if (action === 'answer-marathon') {
    if (!isMarathon(room)) return sendError(res, 400, 'WRONG_GAME', '마라톤 방에서만 미션에 답할 수 있습니다.');
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 미션에 답할 수 없습니다.');
    const engine = getGame('marathon');
    const verdict = engine.submitAnswer(room.game, seat, body.answer, Number(body.expectedPhaseId));
    if (!verdict.legal) return sendError(res, 409, 'INVALID_MARATHON_ANSWER', engine.moveError(verdict.reason));
    if (verdict.correct) appendSystemMessage(room, `${session.label || '플레이어'}님이 미션에 성공했습니다!`);
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

  if (action === 'start-pictionary') {
    if (!isPictionary(room)) return sendError(res, 400, 'WRONG_GAME', '그림 맞히기 방에서만 시작할 수 있습니다.');
    if (!isRoomHost(room, session)) return sendError(res, 403, 'HOST_ONLY', '방장만 그림 맞히기를 시작할 수 있습니다.');
    const seats = PICTIONARY_SEATS.filter(seat => room.players[seat]);
    const engine = getGame('pictionary');
    const verdict = engine.start(room.game, seats);
    if (!verdict.legal) return sendError(res, 409, 'INVALID_PICTIONARY_START', engine.moveError(verdict.reason));
    for (const p of Object.values(room.participants)) if (!findSeat(room, p.sessionToken)) p.choice = 'spectator';
    appendSystemMessage(room, `그림 맞히기 시작! ${room.participants[room.players[room.game.drawerSeat]]?.label || '첫 출제자'}님부터 그립니다.`);
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
    if (verdict.correct) {
      appendSystemMessage(room, `${session.label || '참가자'}님이 정답을 맞혔습니다!`);
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

  if (action === 'resign') {
    const seat = findSeat(room, session.token);
    if (!seat || (room.game.status !== 'playing' && !(room.gameType === 'baseball' && room.game.status === 'setup'))) return sendError(res, 409, 'NOT_PLAYING', '기권할 수 없는 상태입니다.');
    room.game.status = 'finished';
    // Bingo/pictionary/liar/oldmaid/marathon are free-for-all games with no black/white side for a
    // resign to flip. Ending immediately and crediting every other seated player as the winner
    // mirrors exactly what already happens when a required player disconnects and someone calls
    // end-game -- just self-triggered instead of waiting on someone else to notice and act.
    // Marathon's team modes share one piece per team, so the whole team loses together here too,
    // matching the same rule already used for a disconnected teammate (confirmed by the user) --
    // including collapsing to a lone scalar group id when exactly one team remains, since
    // marathon's own natural win condition (game.winner = group) and its disconnect/end-game path
    // both always hand the client a single group id in that case, never a 1-item array.
    // Bingo/pictionary/liar/oldmaid stay an array (never collapsed to a lone scalar the way
    // end-game's disconnect path does for them): pictionary/liar/oldmaid's own result displays
    // already only ever expect an array (their natural win conditions never produce a scalar), so
    // resign matches that rather than handing them a shape they don't render.
    if (isMarathon(room) && room.game.mode === 'team') {
      const winningGroups = room.game.groupOrder.filter(g => !room.game.groups[g].includes(seat));
      room.game.winner = winningGroups.length === 1 ? winningGroups[0] : winningGroups;
      room.game.endReason = 'resign';
    } else if (isBingo(room) || isPictionary(room) || isLiar(room) || isOldMaid(room) || isMarathon(room) || isTwenty(room) || isDavinci(room) || isHalli(room)) {
      room.game.winner = assignedSeatsFor(room).filter(s => s !== seat);
      room.game.endReason = 'resign';
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
    // more than one seat still connected needs the array form. Marathon's team modes (2v2, 3v3,
    // 2v2v2) share one piece per team rather than per seat, so -- like omok2v2 -- the win/loss is
    // decided per TEAM, not per individual disconnected seat: every group with no disconnected
    // member wins (this also naturally covers 2v2v2's three-way case, where more than one team
    // can still be fully connected).
    room.game.winner = isTeam(room)
      ? (teamColor(disconnectedSeats[0]) === 'black' ? 'white' : 'black')
      : (isMarathon(room) && room.game.mode === 'team')
        ? (() => {
            const winningGroups = room.game.groupOrder.filter(g => !room.game.groups[g].some(seat => disconnectedSeats.includes(seat)));
            return winningGroups.length === 1 ? winningGroups[0] : winningGroups;
          })()
        : connectedSeats.length === 1 ? connectedSeats[0] : connectedSeats;
    room.game.winningLine = null;
    room.game.endReason = 'disconnect';
    room.game.disconnectedAtEnd = disconnectedSeats;
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

  if (!(await recordOrError(room, res))) return;
  touchRoom(room);
  broadcast(room);
  return sendJson(res, 200, {
    ok: true,
    state: roomView(room, session),
    ...(drawnOldMaidCard ? { drawnOldMaidCard } : {}),
  });
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/health' && req.method === 'GET') {
    return sendJson(res, 200, { ok: true, rooms: rooms.size, sessions: sessions.size, games: listGames().map((g) => g.id), version: '1.6.82', time: nowIso() });
  }

  if (pathname === '/guest-entry' && req.method === 'POST') {
    if (!checkRateLimit(`guest-entry:${clientIp(req)}`, 20, 10 * 60 * 1000)) {
      return sendSimpleHtml(res, 429, '입장 제한', '입장 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    }
    const form = await parseForm(req);
    const token = String(form.token || '');
    if (token.length < 30 || token.length > 200) return sendSimpleHtml(res, 403, '입장 거부', '유효하지 않은 입장 파일입니다.');
    const key = await accessStore.validateAndRecord(token);
    if (!key) return sendSimpleHtml(res, 403, '입장 거부', '이 입장 파일은 유효하지 않거나 권한이 취소되었습니다.');
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
      if (!previousHost && sessions.has(room.hostSessionToken)) continue;
      session.currentRoomId = room.id;
      registerParticipant(room, session);
      broadcast(room);
      break;
    }
    if (!session.currentRoomId) {
      for (const room of rooms.values()) {
        if (!(room.game.status === 'playing' || (isTwenty(room) && room.game.status === 'round-ended'))) continue;
        const previous = Object.entries(room.participants).find(([oldToken, p]) =>
          participantIdentity(p) === identity && p.rejoinable && !p.connected && !sessions.has(oldToken) && findSeat(room, oldToken));
        if (!previous) continue;
        session.currentRoomId = room.id;
        registerParticipant(room, session);
        broadcast(room);
        break;
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

  if (pathname === '/api/session' && req.method === 'GET') {
    const session = getSession(req);
    if (!session) return sendJson(res, 200, { authenticated: false });
    return sendJson(res, 200, { authenticated: true, role: session.role, label: session.label, hasRoom: Boolean(getCurrentRoom(session)) });
  }

  if (pathname === '/api/session/heartbeat' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    session.leaseSeenAt = nowMs();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/session/release' && req.method === 'POST') {
    const body = await parseJson(req);
    const token = String(body.sessionToken || '');
    if (token) releaseSessionToken(token);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const session = getSession(req, { touch: false });
    if (session) releaseSessionToken(session.token);
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
    appendChatMessage(lobbySocial, session, text);
    trimLobbyMessages();
    broadcastLobby();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/lobby/events' && req.method === 'GET') {
    const session = requireSession(req, res);
    if (!session) return;
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

    const heartbeat = setInterval(() => {
      const current = sessions.get(session.token);
      if (!current || current.currentRoomId) {
        try { res.end(); } catch {}
        clearInterval(heartbeat);
        return;
      }
      current.lastSeen = nowMs();
      if (current.guestKeyId) current.leaseSeenAt = current.lastSeen;
      res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      lobbyStreams.delete(entry);
      broadcastLobby();
    });
    return;
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
    const item = await announcementStore.create(title, content, body.pinned === true);
    await broadcastAnnouncements();
    return sendJson(res, 201, { ok: true, item });
  }

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
    const keys = (await accessStore.list()).map((key) => ({ ...key, presence: guestPresence(key.id) }));
    return sendJson(res, 200, { keys, persistence: DATABASE_URL ? 'database' : 'ephemeral-file' });
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
  const recordLookup = pathname.match(/^\/api\/records\/(admin:[A-Za-z0-9_-]{10,40}|[0-9a-f-]{36})$/i);
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
    const room = makeRoom(session, gameType, visibility, { title, digitCount });
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
    if (!(await recordOrError(room, res))) return;
    return sendJson(res, 200, { state: roomView(room, session) });
  }

  if (pathname === '/api/room/leave' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = getCurrentRoom(session);
    session.currentRoomId = null;
    if (room?.participants[session.token]) {
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
    appendChatMessage(room, session, text);
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
      current.lastSeen = nowMs();
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

  match = pathname.match(/^\/api\/room\/(choose-role|twenty-start|twenty-next|twenty-secret|twenty-question|twenty-answer|twenty-guess|twenty-judge|set-halligalli-time|start-halligalli|flip-halligalli|ring-halligalli|start-davinci|select-davinci|guess-davinci|stop-davinci|reveal-davinci|set-oldmaid-mode|start-oldmaid|shuffle-oldmaid|draw-oldmaid|use-ability-oldmaid|set-liar-rounds|start-liar|liar-hint|liar-vote|liar-guess|set-bingo-target|set-bingo-grid|set-bingo-pool|start-bingo|select-bingo|start-pictionary|pictionary-stroke|pictionary-clear|pictionary-guess|set-secret|guess|throw-yut|move-yut|start-city|roll-city|buy-city|skip-city|build-city|skip-build-city|sell-property-city|sell-building-city|set-marathon-config|start-marathon|roll-marathon|answer-marathon|move|resign|end-game|next-round|rematch)$/);
  if (match && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    return handleRoomAction(req, res, match[1], session);
  }

  if (req.method === 'GET') {
    if (pathname === '/') return sendIndex(res, {});
    if (await serveStatic(res, pathname)) return;
  }

  return sendError(res, 404, 'NOT_FOUND', '찾을 수 없습니다.');
}

async function main() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  indexTemplate = await fsp.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
  accessStore = await createAccessStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });
  announcementStore = await createAnnouncementStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });
  matchStore = await createMatchStore({ dataDir: DATA_DIR, databaseUrl: DATABASE_URL });
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
      if (age > ROOM_TTL_MS && !streams.has(id)) rooms.delete(id);
    }
    for (const [key, row] of rateLimits) {
      if (now - row.startedAt > 60 * 60 * 1000) rateLimits.delete(key);
    }
  }, 10 * 60 * 1000).unref();

  setInterval(() => { if (invitations.size) broadcastLobby(); }, 15000).unref();
  setInterval(() => tickPictionaryRooms().catch(error => console.error('그림 맞히기 전적 처리 오류:', error)), 1000).unref();
  setInterval(() => tickHalliRooms().catch(error => console.error('할리갈리 전적 처리 오류:', error)), 100).unref();
  setInterval(() => tickDavinciRooms().catch(error => console.error('다빈치 코드 전적 처리 오류:', error)), 1000).unref();
  setInterval(() => tickLiarRooms().catch(error => console.error('라이어 전적 처리 오류:', error)), 1000).unref();
  setInterval(() => tickMarathonRooms().catch(error => console.error('마라톤 전적 처리 오류:', error)), 1000).unref();
  setInterval(() => tickIdleRooms().catch(error => console.error('자리비움 감지 처리 오류:', error)), AFK_TICK_MS).unref();
  server.listen(PORT, HOST, () => console.log(`게임 서버 v1.6.82 실행: http://${HOST}:${PORT}`));
}

main().catch((err) => {
  console.error('서버 시작 실패:', err);
  process.exit(1);
});
