const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const {
  inBounds,
  evaluateMove,
  isBoardFull,
  makeInitialGame,
  resetForNextRound,
} = require('./lib/game');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'games.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const MAX_BODY = 32 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

fs.mkdirSync(DATA_DIR, { recursive: true });
let rooms = {};
let saveQueue = Promise.resolve();
const streams = new Map(); // roomId -> Set<{ res, clientId }>

function nowIso() { return new Date().toISOString(); }
function newClientId() { return crypto.randomBytes(18).toString('base64url'); }
function validClientId(value) { return CLIENT_ID_RE.test(String(value || '')); }

function loadRooms() {
  try {
    rooms = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('게임 데이터 로드 실패:', err);
    rooms = {};
  }
}

function newParticipant(clientId, connected = false) {
  const t = nowIso();
  return { clientId, joinedAt: t, lastSeen: t, connected, choice: null };
}

function normalizeGame(game) {
  if (!game || !Array.isArray(game.board)) return makeInitialGame();
  game.size ||= 15;
  game.turn ||= 'black';
  if (game.status === 'waiting') game.status = 'selecting';
  if (!['selecting', 'playing', 'finished', 'draw'].includes(game.status)) game.status = 'selecting';
  game.winner ??= null;
  game.winningLine ??= null;
  game.moves ||= [];
  game.rematchRequests ||= { black: false, white: false };
  game.round ||= 1;
  return game;
}

function migrateRoom(room) {
  room.participants ||= {};
  const legacyIds = [
    room.hostClientId,
    room.guestClientId,
    room.players?.black?.clientId,
    room.players?.white?.clientId,
    typeof room.players?.black === 'string' ? room.players.black : null,
    typeof room.players?.white === 'string' ? room.players.white : null,
  ].filter(validClientId);

  for (const id of legacyIds) {
    if (!room.participants[id]) room.participants[id] = newParticipant(id, false);
  }

  room.game = normalizeGame(room.game);
  const blackId = typeof room.players?.black === 'string' ? room.players.black : room.players?.black?.clientId || null;
  const whiteId = typeof room.players?.white === 'string' ? room.players.white : room.players?.white?.clientId || null;
  room.players = {
    black: validClientId(blackId) ? blackId : null,
    white: validClientId(whiteId) ? whiteId : null,
  };

  if (room.players.black && room.participants[room.players.black]) room.participants[room.players.black].choice = 'black';
  if (room.players.white && room.participants[room.players.white]) room.participants[room.players.white].choice = 'white';

  if (!validClientId(room.hostClientId)) room.hostClientId = legacyIds[0] || null;
  delete room.guestClientId;

  // 대국 중/종료 상태에서 기존 좌석이 없는 참가자는 관전으로 정리한다.
  if (room.game.status !== 'selecting') {
    for (const p of Object.values(room.participants)) {
      if (p.clientId !== room.players.black && p.clientId !== room.players.white) p.choice = 'spectator';
    }
  }
}

function persistRooms() {
  const snapshot = JSON.stringify(rooms, null, 2);
  saveQueue = saveQueue.then(async () => {
    const temp = `${DATA_FILE}.tmp`;
    await fsp.writeFile(temp, snapshot, 'utf8');
    await fsp.rename(temp, DATA_FILE);
  }).catch((err) => console.error('게임 데이터 저장 실패:', err));
  return saveQueue;
}

function newRoomId() {
  let id;
  do id = crypto.randomBytes(9).toString('base64url'); while (rooms[id]);
  return id;
}

function newRoom(hostClientId) {
  const t = nowIso();
  return {
    id: newRoomId(),
    createdAt: t,
    updatedAt: t,
    hostClientId,
    participants: { [hostClientId]: newParticipant(hostClientId, false) },
    players: { black: null, white: null },
    game: makeInitialGame(),
  };
}

function touch(room) { room.updatedAt = nowIso(); }

function registerParticipant(room, clientId) {
  if (!room.participants[clientId]) {
    const participant = newParticipant(clientId, true);
    if (room.game.status !== 'selecting') participant.choice = 'spectator';
    room.participants[clientId] = participant;
  }
  const p = room.participants[clientId];
  p.connected = true;
  p.lastSeen = nowIso();
  if (!room.hostClientId) room.hostClientId = clientId;
  return p;
}

function findSeat(room, clientId) {
  if (room.players.black === clientId) return 'black';
  if (room.players.white === clientId) return 'white';
  return null;
}

function currentChoice(room, clientId) {
  return room.participants[clientId]?.choice || null;
}

function connectedClientIds(roomId) {
  const set = streams.get(roomId);
  if (!set) return new Set();
  return new Set([...set].map((entry) => entry.clientId));
}

function roomHasLiveClient(roomId, clientId) {
  return connectedClientIds(roomId).has(clientId);
}

function publicPlayer(room, color) {
  const clientId = room.players[color];
  if (!clientId) return null;
  const p = room.participants[clientId];
  return { connected: Boolean(p?.connected) };
}

function liveSpectatorCount(room) {
  const live = connectedClientIds(room.id);
  let count = 0;
  for (const id of live) {
    if (room.players.black === id || room.players.white === id) continue;
    count += 1;
  }
  return count;
}

function publicRoom(room) {
  const lastMove = room.game.moves.at(-1) || null;
  const live = connectedClientIds(room.id);
  return {
    id: room.id,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    connectedCount: live.size,
    spectatorCount: liveSpectatorCount(room),
    players: {
      black: publicPlayer(room, 'black'),
      white: publicPlayer(room, 'white'),
    },
    game: {
      size: room.game.size,
      board: room.game.board,
      turn: room.game.turn,
      status: room.game.status,
      winner: room.game.winner,
      winningLine: room.game.winningLine,
      moveCount: room.game.moves.length,
      lastMove,
      rematchRequests: room.game.rematchRequests,
      round: room.game.round,
    },
  };
}

function roomView(room, clientId) {
  const p = room.participants[clientId] || null;
  const seat = findSeat(room, clientId);
  return {
    ...publicRoom(room),
    me: {
      isHost: room.hostClientId === clientId,
      seat,
      choice: p?.choice || null,
      watching: Boolean(p && !seat && p.choice === 'spectator'),
    },
  };
}

function maybeStart(room) {
  if (room.players.black && room.players.white && room.game.status === 'selecting') {
    room.game.status = 'playing';
    room.game.turn = 'black';
    for (const p of Object.values(room.participants)) {
      if (p.clientId !== room.players.black && p.clientId !== room.players.white) p.choice = 'spectator';
    }
  }
}

function prepareNextRound(room) {
  resetForNextRound(room.game);
  room.players = { black: null, white: null };
  for (const p of Object.values(room.participants)) p.choice = null;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendError(res, status, code, message, extra = {}) {
  sendJson(res, status, { error: code, message, ...extra });
}

function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcast(room) {
  const set = streams.get(room.id);
  if (!set) return;
  for (const client of set) sseWrite(client.res, 'roomState', roomView(room, client.clientId));
}

async function parseJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
}

async function serveFile(res, filePath) {
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) throw Object.assign(new Error('not file'), { code: 'ENOENT' });
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': ['.html', '.css', '.js'].includes(ext) ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
  return true;
}

function forbiddenMessage(reason) {
  if (reason === 'double-three') return '금수입니다: 흑은 3-3에 둘 수 없습니다.';
  if (reason === 'double-four') return '금수입니다: 흑은 4-4에 둘 수 없습니다.';
  if (reason === 'overline') return '금수입니다: 흑은 6목 이상 장목에 둘 수 없습니다.';
  return '금수 자리에는 둘 수 없습니다.';
}

loadRooms();
for (const room of Object.values(rooms)) {
  migrateRoom(room);
  for (const p of Object.values(room.participants)) p.connected = false;
}
persistRooms();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/health' && req.method === 'GET') {
      return sendJson(res, 200, { ok: true, rooms: Object.keys(rooms).length, time: nowIso(), version: '1.3.0' });
    }

    if (pathname === '/api/rooms' && req.method === 'POST') {
      const body = await parseJson(req);
      const requestedClientId = String(body.clientId || '');
      const clientId = validClientId(requestedClientId) ? requestedClientId : newClientId();
      const room = newRoom(clientId);
      rooms[room.id] = room;
      await persistRooms();
      return sendJson(res, 201, { roomId: room.id, path: `/room/${room.id}`, clientId });
    }

    let m = pathname.match(/^\/api\/rooms\/([A-Za-z0-9_-]{8,32})$/);
    if (m && req.method === 'GET') {
      const room = rooms[m[1]];
      if (!room) return sendError(res, 404, 'ROOM_NOT_FOUND', '존재하지 않는 방입니다.');
      const clientId = String(url.searchParams.get('clientId') || '');
      return sendJson(res, 200, validClientId(clientId) ? roomView(room, clientId) : publicRoom(room));
    }

    m = pathname.match(/^\/api\/rooms\/([A-Za-z0-9_-]{8,32})\/events$/);
    if (m && req.method === 'GET') {
      const room = rooms[m[1]];
      const clientId = url.searchParams.get('clientId') || '';
      if (!room) return sendError(res, 404, 'ROOM_NOT_FOUND', '존재하지 않는 방입니다.');
      if (!validClientId(clientId)) return sendError(res, 400, 'BAD_CLIENT', '접속 정보가 올바르지 않습니다.');

      registerParticipant(room, clientId);
      touch(room);

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(': connected\n\n');

      if (!streams.has(room.id)) streams.set(room.id, new Set());
      const entry = { res, clientId };
      streams.get(room.id).add(entry);
      await persistRooms();
      broadcast(room);

      const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
      req.on('close', async () => {
        clearInterval(heartbeat);
        const set = streams.get(room.id);
        set?.delete(entry);
        if (set && set.size === 0) streams.delete(room.id);

        if (!roomHasLiveClient(room.id, clientId) && room.participants[clientId]) {
          room.participants[clientId].connected = false;
          room.participants[clientId].lastSeen = nowIso();
          touch(room);
          broadcast(room);
          await persistRooms();
        }
      });
      return;
    }

    m = pathname.match(/^\/api\/rooms\/([A-Za-z0-9_-]{8,32})\/(choose-role|move|resign|rematch)$/);
    if (m && req.method === 'POST') {
      const room = rooms[m[1]];
      const action = m[2];
      if (!room) return sendError(res, 404, 'ROOM_NOT_FOUND', '존재하지 않는 방입니다.');
      const body = await parseJson(req);
      const clientId = String(body.clientId || '');
      if (!validClientId(clientId)) return sendError(res, 400, 'BAD_CLIENT', '접속 정보가 올바르지 않습니다.');
      const participant = room.participants[clientId] || registerParticipant(room, clientId);
      const seat = findSeat(room, clientId);

      if (action === 'choose-role') {
        if (room.game.status !== 'selecting') {
          return sendError(res, 409, 'ROUND_STARTED', '대국이 시작된 뒤에는 역할을 바꿀 수 없습니다.');
        }
        const choice = ['black', 'white', 'spectator'].includes(body.choice) ? body.choice : null;
        if (!choice) return sendError(res, 400, 'BAD_ROLE', '흑, 백, 관전 중에서 선택해 주세요.');

        if ((choice === 'black' || choice === 'white') && room.players[choice] && room.players[choice] !== clientId) {
          return sendError(res, 409, 'ROLE_TAKEN', `${choice === 'black' ? '흑' : '백'}은 다른 사람이 이미 선택했습니다.`);
        }

        const oldSeat = findSeat(room, clientId);
        if (oldSeat && oldSeat !== choice) room.players[oldSeat] = null;

        if (choice === 'spectator') {
          participant.choice = 'spectator';
        } else {
          room.players[choice] = clientId;
          participant.choice = choice;
        }
        maybeStart(room);
      }

      if (action === 'move') {
        const currentSeat = findSeat(room, clientId);
        if (!currentSeat) return sendError(res, 403, 'SPECTATOR', '관전자는 돌을 둘 수 없습니다.');
        if (room.game.status !== 'playing') return sendError(res, 409, 'NOT_PLAYING', '현재 착수할 수 없습니다.');
        if (room.game.turn !== currentSeat) return sendError(res, 409, 'NOT_YOUR_TURN', '상대 차례입니다.');
        const x = Number(body.x);
        const y = Number(body.y);
        if (!inBounds(x, y)) return sendError(res, 400, 'BAD_POSITION', '착수 위치가 올바르지 않습니다.');
        if (room.game.board[y][x]) return sendError(res, 409, 'OCCUPIED', '이미 돌이 놓인 자리입니다.');

        const verdict = evaluateMove(room.game.board, x, y, currentSeat);
        if (!verdict.legal) {
          if (['double-three', 'double-four', 'overline'].includes(verdict.reason)) {
            return sendError(res, 409, 'FORBIDDEN_MOVE', forbiddenMessage(verdict.reason), { forbidden: verdict.reason });
          }
          return sendError(res, 409, 'ILLEGAL_MOVE', '둘 수 없는 자리입니다.');
        }

        room.game.board[y][x] = currentSeat;
        room.game.moves.push({ x, y, color: currentSeat, at: nowIso() });
        room.game.rematchRequests = { black: false, white: false };

        if (verdict.win) {
          room.game.status = 'finished';
          room.game.winner = currentSeat;
          room.game.winningLine = verdict.winningLine;
        } else if (isBoardFull(room.game.board)) {
          room.game.status = 'draw';
          room.game.winner = null;
          room.game.winningLine = null;
        } else {
          room.game.turn = currentSeat === 'black' ? 'white' : 'black';
        }
      }

      if (action === 'resign') {
        const currentSeat = findSeat(room, clientId);
        if (!currentSeat || room.game.status !== 'playing') return sendError(res, 409, 'NOT_PLAYING', '기권할 수 없는 상태입니다.');
        room.game.status = 'finished';
        room.game.winner = currentSeat === 'black' ? 'white' : 'black';
        room.game.winningLine = null;
      }

      if (action === 'rematch') {
        const currentSeat = findSeat(room, clientId);
        if (!currentSeat) return sendError(res, 403, 'SPECTATOR', '이번 대국의 흑·백만 다음 대국을 신청할 수 있습니다.');
        if (!['finished', 'draw'].includes(room.game.status)) return sendError(res, 409, 'NOT_FINISHED', '대국이 끝난 뒤 신청할 수 있습니다.');
        room.game.rematchRequests[currentSeat] = true;
        if (room.game.rematchRequests.black && room.game.rematchRequests.white) prepareNextRound(room);
      }

      touch(room);
      broadcast(room);
      await persistRooms();
      return sendJson(res, 200, { ok: true, state: roomView(room, clientId) });
    }

    m = pathname.match(/^\/room\/([A-Za-z0-9_-]{8,32})$/);
    if (m && req.method === 'GET') return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));

    if (req.method === 'GET') {
      const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
      if (relative.includes('..')) return sendError(res, 400, 'BAD_PATH', '잘못된 경로입니다.');
      const served = await serveFile(res, path.join(PUBLIC_DIR, relative));
      if (served) return;
      if (!path.extname(relative)) return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
    }

    sendError(res, 404, 'NOT_FOUND', '찾을 수 없습니다.');
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendError(res, err.status || 500, 'SERVER_ERROR', err.status === 400 ? '요청 형식이 올바르지 않습니다.' : '서버 오류가 발생했습니다.');
    else res.end();
  }
});

server.listen(PORT, HOST, () => console.log(`오목 서버 실행: http://localhost:${PORT}`));
