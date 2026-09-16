from pathlib import Path
import json

ROOT = Path.cwd()


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding='utf-8')


def replace_once(content, old, new, label):
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly 1 match, found {count}')
    return content.replace(old, new, 1)


write('lib/games/omok.js', r'''\'use strict\';

const {
  inBounds,
  evaluateMove,
  isBoardFull,
  makeInitialGame,
  resetForNextRound,
} = require('../game');

const metadata = {
  id: 'omok',
  name: '오목',
  size: 15,
  rules: '15×15, 흑 선공. 흑은 정확히 5목 승리, 3-3·4-4·6목 이상 장목 금수. 백은 5목 이상이면 승리하며 같은 금수 제한이 없습니다. 흑 4-3은 허용합니다.',
};

function create() {
  return makeInitialGame();
}

function start(game) {
  game.status = 'playing';
  game.turn = 'black';
}

function reset(game) {
  resetForNextRound(game);
}

function moveError(reason) {
  if (reason === 'double-three') return '금수입니다: 흑은 3-3에 둘 수 없습니다.';
  if (reason === 'double-four') return '금수입니다: 흑은 4-4에 둘 수 없습니다.';
  if (reason === 'overline') return '금수입니다: 흑은 6목 이상 장목에 둘 수 없습니다.';
  if (reason === 'occupied') return '이미 돌이 놓인 자리입니다.';
  if (reason === 'out-of-bounds') return '착수 위치가 올바르지 않습니다.';
  return '둘 수 없는 자리입니다.';
}

function applyMove(game, x, y, color, at) {
  if (!inBounds(x, y)) return { legal: false, reason: 'out-of-bounds' };
  if (game.board[y][x]) return { legal: false, reason: 'occupied' };
  const verdict = evaluateMove(game.board, x, y, color);
  if (!verdict.legal) return { legal: false, reason: verdict.reason, forbidden: verdict.reason };

  game.board[y][x] = color;
  game.moves.push({ x, y, color, at });
  game.rematchRequests = { black: false, white: false };
  if (verdict.win) {
    game.status = 'finished';
    game.winner = color;
    game.winningLine = verdict.winningLine;
  } else if (isBoardFull(game.board)) {
    game.status = 'draw';
    game.winner = null;
    game.winningLine = null;
  } else {
    game.turn = color === 'black' ? 'white' : 'black';
  }
  return { legal: true };
}

function publicState(game) {
  return {
    size: game.size,
    board: game.board,
    turn: game.turn,
    status: game.status,
    winner: game.winner,
    winningLine: game.winningLine,
    moveCount: game.moves.length,
    lastMove: game.moves.at(-1) || null,
    round: game.round,
    legalMoves: [],
    scores: null,
    lastPass: null,
  };
}

module.exports = { ...metadata, create, start, reset, applyMove, publicState, moveError };
'''.replace("\\'use strict\\';", "'use strict';"))

write('lib/games/othello.js', r'''\'use strict\';

const SIZE = 8;
const DIRECTIONS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
];

const metadata = {
  id: 'othello',
  name: '오셀로',
  size: SIZE,
  rules: '8×8, 흑 선공. 상대 돌을 양쪽에서 감싸는 위치에 두면 사이의 돌을 뒤집습니다. 둘 수 있는 곳이 없으면 자동으로 패스하며, 양쪽 모두 둘 수 없으면 종료됩니다. 마지막에 돌이 더 많은 쪽이 승리합니다.',
};

function inBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function opponent(color) {
  return color === 'black' ? 'white' : 'black';
}

function createBoard() {
  const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  board[3][3] = 'white';
  board[3][4] = 'black';
  board[4][3] = 'black';
  board[4][4] = 'white';
  return board;
}

function flipsForMove(board, x, y, color) {
  if (!inBounds(x, y) || board[y][x]) return [];
  const other = opponent(color);
  const all = [];
  for (const [dx, dy] of DIRECTIONS) {
    const line = [];
    let cx = x + dx;
    let cy = y + dy;
    while (inBounds(cx, cy) && board[cy][cx] === other) {
      line.push([cx, cy]);
      cx += dx;
      cy += dy;
    }
    if (line.length && inBounds(cx, cy) && board[cy][cx] === color) all.push(...line);
  }
  return all;
}

function legalMoves(board, color) {
  const moves = [];
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (!board[y][x] && flipsForMove(board, x, y, color).length) moves.push({ x, y });
    }
  }
  return moves;
}

function scores(board) {
  let black = 0;
  let white = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell === 'black') black += 1;
      else if (cell === 'white') white += 1;
    }
  }
  return { black, white };
}

function create() {
  return {
    size: SIZE,
    board: createBoard(),
    turn: 'black',
    status: 'selecting',
    winner: null,
    winningLine: null,
    moves: [],
    round: 1,
    lastPass: null,
  };
}

function start(game) {
  game.status = 'playing';
  game.turn = 'black';
  game.lastPass = null;
}

function reset(game) {
  const nextRound = Number(game.round || 1) + 1;
  const fresh = create();
  fresh.round = nextRound;
  Object.assign(game, fresh);
}

function finish(game) {
  const count = scores(game.board);
  if (count.black === count.white) {
    game.status = 'draw';
    game.winner = null;
  } else {
    game.status = 'finished';
    game.winner = count.black > count.white ? 'black' : 'white';
  }
  game.turn = null;
  game.lastPass = null;
  return count;
}

function moveError(reason) {
  if (reason === 'occupied') return '이미 돌이 놓인 칸입니다.';
  if (reason === 'out-of-bounds') return '착수 위치가 올바르지 않습니다.';
  if (reason === 'no-capture') return '상대 돌을 뒤집을 수 있는 칸에만 둘 수 있습니다.';
  return '둘 수 없는 자리입니다.';
}

function applyMove(game, x, y, color, at) {
  if (!inBounds(x, y)) return { legal: false, reason: 'out-of-bounds' };
  if (game.board[y][x]) return { legal: false, reason: 'occupied' };
  const flips = flipsForMove(game.board, x, y, color);
  if (!flips.length) return { legal: false, reason: 'no-capture' };

  game.board[y][x] = color;
  for (const [fx, fy] of flips) game.board[fy][fx] = color;
  game.moves.push({ x, y, color, flipped: flips.length, at });

  const other = opponent(color);
  const otherMoves = legalMoves(game.board, other);
  const ownMoves = legalMoves(game.board, color);
  game.lastPass = null;

  if (otherMoves.length) {
    game.turn = other;
  } else if (ownMoves.length) {
    game.turn = color;
    game.lastPass = other;
  } else {
    finish(game);
  }

  return { legal: true, passed: game.lastPass, finished: ['finished', 'draw'].includes(game.status) };
}

function publicState(game) {
  return {
    size: SIZE,
    board: game.board,
    turn: game.turn,
    status: game.status,
    winner: game.winner,
    winningLine: null,
    moveCount: game.moves.length,
    lastMove: game.moves.at(-1) || null,
    round: game.round,
    legalMoves: game.status === 'playing' && game.turn ? legalMoves(game.board, game.turn) : [],
    scores: scores(game.board),
    lastPass: game.lastPass,
  };
}

module.exports = {
  ...metadata,
  create,
  start,
  reset,
  applyMove,
  publicState,
  moveError,
  inBounds,
  flipsForMove,
  legalMoves,
  scores,
};
'''.replace("\\'use strict\\';", "'use strict';"))

write('lib/games/index.js', r'''\'use strict\';

const omok = require('./omok');
const othello = require('./othello');

const GAMES = new Map([
  [omok.id, omok],
  [othello.id, othello],
]);

function hasGame(id) {
  return GAMES.has(String(id || '').toLowerCase());
}

function getGame(id = 'omok') {
  return GAMES.get(String(id || 'omok').toLowerCase()) || null;
}

function listGames() {
  return [...GAMES.values()].map(({ id, name, size, rules }) => ({ id, name, size, rules }));
}

module.exports = { getGame, hasGame, listGames };
'''.replace("\\'use strict\\';", "'use strict';"))

write('test/othello.test.js', r'''const test = require('node:test');
const assert = require('node:assert/strict');
const othello = require('../lib/games/othello');
const { getGame, hasGame } = require('../lib/games');

test('game registry exposes omok and othello independently', () => {
  assert.equal(hasGame('omok'), true);
  assert.equal(hasGame('othello'), true);
  assert.equal(getGame('omok').name, '오목');
  assert.equal(getGame('othello').name, '오셀로');
});

test('othello starts with four stones and four legal black moves', () => {
  const game = othello.create();
  const count = othello.scores(game.board);
  assert.deepEqual(count, { black: 2, white: 2 });
  assert.deepEqual(
    othello.legalMoves(game.board, 'black').map(({ x, y }) => `${x},${y}`).sort(),
    ['2,3', '3,2', '4,5', '5,4']
  );
});

test('othello move flips captured stones and hands turn to white', () => {
  const game = othello.create();
  othello.start(game);
  const result = othello.applyMove(game, 2, 3, 'black', 'now');
  assert.equal(result.legal, true);
  assert.equal(game.board[3][2], 'black');
  assert.equal(game.board[3][3], 'black');
  assert.equal(game.turn, 'white');
  assert.deepEqual(othello.scores(game.board), { black: 4, white: 1 });
});

test('othello rejects a move that captures nothing', () => {
  const game = othello.create();
  othello.start(game);
  const result = othello.applyMove(game, 0, 0, 'black', 'now');
  assert.equal(result.legal, false);
  assert.equal(result.reason, 'no-capture');
});
''')

server = read('server.js')
server = replace_once(server, r'''const {
  inBounds,
  evaluateMove,
  isBoardFull,
  makeInitialGame,
  resetForNextRound,
} = require('./lib/game');
''', r'''const { getGame, hasGame, listGames } = require('./lib/games');
''', 'server game import')

server = replace_once(server, r'''function makeRoom(hostSession) {
  let code;
  do code = generateRoomCode(); while ([...rooms.values()].some((r) => r.code === code));
  const id = newSecret(12);
  const t = nowIso();
  const room = {
    id,
    code,
    gameType: 'omok',
    createdAt: t,
    updatedAt: t,
    hostSessionToken: hostSession.token,
    participants: { [hostSession.token]: newParticipant(hostSession, false) },
    players: { black: null, white: null },
    social: createRoomSocial(),
    game: makeInitialGame(),
  };
  appendSystemMessage(room, (hostSession.label || '방장') + '님이 방을 만들었습니다.');
  return room;
}
''', r'''function makeRoom(hostSession, requestedGameType = 'omok') {
  const gameEngine = getGame(requestedGameType);
  if (!gameEngine) return null;
  let code;
  do code = generateRoomCode(); while ([...rooms.values()].some((r) => r.code === code));
  const id = newSecret(12);
  const t = nowIso();
  const room = {
    id,
    code,
    gameType: gameEngine.id,
    createdAt: t,
    updatedAt: t,
    hostSessionToken: hostSession.token,
    participants: { [hostSession.token]: newParticipant(hostSession, false) },
    players: { black: null, white: null },
    social: createRoomSocial(),
    game: gameEngine.create(),
  };
  appendSystemMessage(room, `${hostSession.label || '방장'}님이 ${gameEngine.name} 방을 만들었습니다.`);
  return room;
}
''', 'server makeRoom')

server = replace_once(server, r'''function publicRoom(room) {
  const live = uniqueLiveTokens(room.id);
  return {
    gameType: room.gameType || 'omok',
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    connectedCount: live.size,
    spectatorCount: liveSpectatorCount(room),
    participants: publicParticipants(room),
    chat: { messages: publicChatMessages(room) },
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
      lastMove: room.game.moves.at(-1) || null,
      rematchRequests: room.game.rematchRequests,
      round: room.game.round,
    },
  };
}
''', r'''function publicRoom(room) {
  const live = uniqueLiveTokens(room.id);
  const gameEngine = getGame(room.gameType) || getGame('omok');
  return {
    gameType: gameEngine.id,
    gameName: gameEngine.name,
    rules: gameEngine.rules,
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    connectedCount: live.size,
    spectatorCount: liveSpectatorCount(room),
    participants: publicParticipants(room),
    chat: { messages: publicChatMessages(room) },
    players: {
      black: publicPlayer(room, 'black'),
      white: publicPlayer(room, 'white'),
    },
    game: gameEngine.publicState(room.game),
  };
}
''', 'server publicRoom')

server = replace_once(server, r'''function maybeStart(room) {
  if (room.players.black && room.players.white && room.game.status === 'selecting') {
    room.game.status = 'playing';
    room.game.turn = 'black';
    for (const p of Object.values(room.participants)) {
      if (p.sessionToken !== room.players.black && p.sessionToken !== room.players.white) p.choice = 'spectator';
    }
  }
}

function prepareNextRound(room) {
  resetForNextRound(room.game);
  room.players = { black: null, white: null };
  for (const p of Object.values(room.participants)) p.choice = null;
}

function forbiddenMessage(reason) {
  if (reason === 'double-three') return '금수입니다: 흑은 3-3에 둘 수 없습니다.';
  if (reason === 'double-four') return '금수입니다: 흑은 4-4에 둘 수 없습니다.';
  if (reason === 'overline') return '금수입니다: 흑은 6목 이상 장목에 둘 수 없습니다.';
  return '금수 자리에는 둘 수 없습니다.';
}
''', r'''function maybeStart(room) {
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
  room.players = { black: null, white: null };
  for (const p of Object.values(room.participants)) p.choice = null;
}
''', 'server round engine')

old_move = r'''  if (action === 'move') {
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 돌을 둘 수 없습니다.');
    if (room.game.status !== 'playing') return sendError(res, 409, 'NOT_PLAYING', '현재 착수할 수 없습니다.');
    if (room.game.turn !== seat) return sendError(res, 409, 'NOT_YOUR_TURN', '상대 차례입니다.');
    const x = Number(body.x);
    const y = Number(body.y);
    if (!inBounds(x, y)) return sendError(res, 400, 'BAD_POSITION', '착수 위치가 올바르지 않습니다.');
    if (room.game.board[y][x]) return sendError(res, 409, 'OCCUPIED', '이미 돌이 놓인 자리입니다.');
    const verdict = evaluateMove(room.game.board, x, y, seat);
    if (!verdict.legal) {
      if (['double-three', 'double-four', 'overline'].includes(verdict.reason)) {
        return sendError(res, 409, 'FORBIDDEN_MOVE', forbiddenMessage(verdict.reason), { forbidden: verdict.reason });
      }
      return sendError(res, 409, 'ILLEGAL_MOVE', '둘 수 없는 자리입니다.');
    }
    room.game.board[y][x] = seat;
    room.game.moves.push({ x, y, color: seat, at: nowIso() });
    room.game.rematchRequests = { black: false, white: false };
    if (verdict.win) {
      room.game.status = 'finished';
      room.game.winner = seat;
      room.game.winningLine = verdict.winningLine;
    } else if (isBoardFull(room.game.board)) {
      room.game.status = 'draw';
      room.game.winner = null;
      room.game.winningLine = null;
    } else room.game.turn = seat === 'black' ? 'white' : 'black';
  }
'''
new_move = r'''  if (action === 'move') {
    const seat = findSeat(room, session.token);
    if (!seat) return sendError(res, 403, 'SPECTATOR', '관전자는 돌을 둘 수 없습니다.');
    if (room.game.status !== 'playing') return sendError(res, 409, 'NOT_PLAYING', '현재 착수할 수 없습니다.');
    if (room.game.turn !== seat) return sendError(res, 409, 'NOT_YOUR_TURN', '상대 차례입니다.');
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
'''
server = replace_once(server, old_move, new_move, 'server generic move')

server = replace_once(server, "return sendJson(res, 200, { ok: true, rooms: rooms.size, sessions: sessions.size, version: '1.5.1', time: nowIso() });", "return sendJson(res, 200, { ok: true, rooms: rooms.size, sessions: sessions.size, games: listGames().map((g) => g.id), version: '1.6.0', time: nowIso() });", 'server health')

server = replace_once(server, r'''  if (pathname === '/api/rooms' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const room = makeRoom(session);
    rooms.set(room.id, room);
    session.currentRoomId = room.id;
    registerParticipant(room, session);
    touchRoom(room);
    return sendJson(res, 201, { state: roomView(room, session) });
  }
''', r'''  if (pathname === '/api/rooms' && req.method === 'POST') {
    const session = requireSession(req, res);
    if (!session) return;
    const body = await parseJson(req);
    const gameType = String(body.gameType || 'omok').toLowerCase();
    if (!hasGame(gameType)) return sendError(res, 400, 'BAD_GAME_TYPE', '지원하지 않는 게임입니다.');
    const room = makeRoom(session, gameType);
    rooms.set(room.id, room);
    session.currentRoomId = room.id;
    registerParticipant(room, session);
    touchRoom(room);
    return sendJson(res, 201, { state: roomView(room, session) });
  }
''', 'server create room type')

server = server.replace('게임 서버 v1.5.1 실행', '게임 서버 v1.6.0 실행')
write('server.js', server)

index = read('public/index.html')
index = index.replace('v=1.5.1', 'v=1.6.0')
index = index.replace('<title>오목</title>', '<title>게임센터</title>')
index = replace_once(index, '''      <p class="eyebrow">PRIVATE OMOK</p>
      <h1>오목</h1>''', '''      <p class="eyebrow">PRIVATE BOARD GAMES</p>
      <h1>게임센터</h1>''', 'index gate title')
index = replace_once(index, '<span class="logo">오목</span>\n          <small id="identityLabel"', '<span class="logo">게임센터</span>\n          <small id="identityLabel"', 'index lobby logo')
index = replace_once(index, '''        <article class="card lobbyCard">
          <p class="eyebrow">ROOM</p>
          <h2>대국 시작</h2>
          <p class="muted">방을 만들면 8자리 방 비밀번호가 생성됩니다. 같이 둘 사람에게 비밀번호만 알려주세요.</p>
          <button id="createRoomBtn" class="primary big">방 만들기</button>
          <div class="divider"><span>또는</span></div>
          <form id="joinRoomForm" class="joinForm">
            <label for="roomPasswordInput">방 비밀번호</label>
            <input id="roomPasswordInput" inputmode="text" autocomplete="off" maxlength="9" placeholder="ABCD-EFGH" required />
            <button class="secondary" type="submit">방 입장</button>
          </form>
        </article>''', '''        <article class="card lobbyCard">
          <p class="eyebrow">GAME</p>
          <h2>게임 선택</h2>
          <p class="muted">방을 만들 게임을 먼저 선택하세요. 방 비밀번호로 참가할 때는 해당 방의 게임이 자동으로 열립니다.</p>
          <div class="gamePicker" id="gamePicker">
            <button type="button" class="gameChoice selected" data-game="omok">
              <strong>오목</strong><small>15×15 · 흑 선공 · 금수 적용</small>
            </button>
            <button type="button" class="gameChoice" data-game="othello">
              <strong>오셀로</strong><small>8×8 · 돌 뒤집기 · 자동 패스</small>
            </button>
          </div>
          <p id="selectedGameText" class="selectedGameText">오목 방을 만듭니다.</p>
          <button id="createRoomBtn" class="primary big">방 만들기</button>
          <div class="divider"><span>또는 방 참가</span></div>
          <form id="joinRoomForm" class="joinForm">
            <label for="roomPasswordInput">방 비밀번호</label>
            <input id="roomPasswordInput" inputmode="text" autocomplete="off" maxlength="9" placeholder="ABCD-EFGH" required />
            <button class="secondary" type="submit">방 입장</button>
          </form>
        </article>''', 'index game picker')
index = replace_once(index, '<span class="logo">오목</span>\n          <small id="roomIdentityLabel"', '<span id="roomGameLogo" class="logo">오목</span>\n          <small id="roomIdentityLabel"', 'index room logo')
index = replace_once(index, '''            <div><dt>관전자</dt><dd id="spectatorCount">0명</dd></div>
          </dl>''', '''            <div><dt>관전자</dt><dd id="spectatorCount">0명</dd></div>
            <div id="gameScoreRow" class="hidden"><dt>돌 개수</dt><dd id="gameScoreText">-</dd></div>
          </dl>''', 'index score row')
index = replace_once(index, '''          <div class="rules">
            <strong>현재 규칙</strong>
            <p>15×15, 흑 선공. 흑은 정확히 5목 승리, 3-3·4-4·6목 이상 장목 금수. 백은 5목 이상이면 승리하며 같은 금수 제한이 없습니다. 흑 4-3은 허용합니다.</p>
          </div>''', '''          <div class="rules">
            <strong>현재 규칙</strong>
            <p id="rulesText">게임 규칙을 불러오는 중입니다.</p>
          </div>''', 'index dynamic rules')
write('public/index.html', index)

app = read('public/app.js')
app = replace_once(app, '''  const createRoomBtn = document.getElementById('createRoomBtn');
  const newRoomBtn = document.getElementById('newRoomBtn');''', '''  const createRoomBtn = document.getElementById('createRoomBtn');
  const newRoomBtn = document.getElementById('newRoomBtn');
  const gameChoiceButtons = [...document.querySelectorAll('.gameChoice')];
  const selectedGameText = document.getElementById('selectedGameText');
  const roomGameLogo = document.getElementById('roomGameLogo');''', 'app game refs')
app = replace_once(app, '''  const spectatorCount = document.getElementById('spectatorCount');
  const participantList = document.getElementById('participantList');''', '''  const spectatorCount = document.getElementById('spectatorCount');
  const gameScoreRow = document.getElementById('gameScoreRow');
  const gameScoreText = document.getElementById('gameScoreText');
  const rulesText = document.getElementById('rulesText');
  const participantList = document.getElementById('participantList');''', 'app score refs')
app = replace_once(app, '''  let sessionToken = document.body.dataset.session || '';
  let sessionRole = document.body.dataset.role || '';
  let sessionLabel = document.body.dataset.label || '';
  let state = null;''', '''  let sessionToken = document.body.dataset.session || '';
  let sessionRole = document.body.dataset.role || '';
  let sessionLabel = document.body.dataset.label || '';
  let selectedGameType = 'omok';
  let state = null;''', 'app selected type')
app = replace_once(app, '''  async function createRoom() {
    try {
      const data = await api('/api/rooms', { method: 'POST', body: '{}' });''', '''  function gameName(type) {
    return type === 'othello' ? '오셀로' : '오목';
  }

  function selectGame(type) {
    selectedGameType = type === 'othello' ? 'othello' : 'omok';
    for (const button of gameChoiceButtons) button.classList.toggle('selected', button.dataset.game === selectedGameType);
    selectedGameText.textContent = `${gameName(selectedGameType)} 방을 만듭니다.`;
  }

  async function createRoom() {
    try {
      const data = await api('/api/rooms', { method: 'POST', body: JSON.stringify({ gameType: selectedGameType }) });''', 'app create room type')

app = replace_once(app, '''    roomIdentityLabel.textContent = identityText();
    newRoomBtn.classList.toggle('hidden', !isHost);''', '''    roomIdentityLabel.textContent = identityText();
    roomGameLogo.textContent = state.gameName || gameName(state.gameType);
    rulesText.textContent = state.rules || '';
    document.title = `${state.gameName || gameName(state.gameType)} · 게임센터`;
    newRoomBtn.classList.toggle('hidden', !isHost);''', 'app room game title')
app = replace_once(app, '''    connectedCount.textContent = `${state.connectedCount || 0}명`;
    spectatorCount.textContent = `${state.spectatorCount || 0}명`;
    seatLabel.textContent''', '''    connectedCount.textContent = `${state.connectedCount || 0}명`;
    spectatorCount.textContent = `${state.spectatorCount || 0}명`;
    const scores = g.scores;
    gameScoreRow.classList.toggle('hidden', !scores);
    gameScoreText.textContent = scores ? `흑 ${scores.black} · 백 ${scores.white}` : '-';
    seatLabel.textContent''', 'app scores')
app = replace_once(app, '''    if (g.status === 'selecting') statusText.textContent = '역할 선택 중';
    else if (g.status === 'playing') statusText.textContent = `${seatKo(g.turn)} 차례`;
    else if (g.status === 'finished') statusText.textContent = `${seatKo(g.winner)} 승리`;
    else statusText.textContent = '무승부';''', '''    if (g.status === 'selecting') statusText.textContent = '역할 선택 중';
    else if (g.status === 'playing') {
      statusText.textContent = `${seatKo(g.turn)} 차례${g.lastPass ? ` · ${seatKo(g.lastPass)} 자동 패스` : ''}`;
    } else if (g.status === 'finished') statusText.textContent = `${seatKo(g.winner)} 승리`;
    else statusText.textContent = '무승부';''', 'app pass status')

start = app.index('  function drawBoard() {')
end = app.index('  function drawStone(', start)
old_draw = app[start:end]
new_draw = r'''  function drawBoard() {
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

'''
app = app[:start] + new_draw + app[end:]

old_canvas = r'''  function canvasPoint(ev) {
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
'''
new_canvas = r'''  function canvasPoint(ev) {
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
    if (!state || !seat || state.game.status !== 'playing' || state.game.turn !== seat) return false;
    if (state.gameType === 'othello') {
      return (state.game.legalMoves || []).some((move) => move.x === x && move.y === y);
    }
    return Boolean(state.game.board?.[y] && !state.game.board[y][x]);
  }
'''
app = replace_once(app, old_canvas, new_canvas, 'app canvas mapping')

app = replace_once(app, '''  createRoomBtn.addEventListener('click', createRoom);
  newRoomBtn.addEventListener('click', createRoom);''', '''  createRoomBtn.addEventListener('click', createRoom);
  newRoomBtn.addEventListener('click', createRoom);
  for (const button of gameChoiceButtons) button.addEventListener('click', () => selectGame(button.dataset.game));''', 'app picker listeners')
app = replace_once(app, '''  drawBoard();
  loadSession();''', '''  selectGame('omok');
  drawBoard();
  loadSession();''', 'app picker init')
write('public/app.js', app)

styles = read('public/styles.css')
styles += r'''
.gamePicker{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0 10px}.gameChoice{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;background:#0f172a;color:#e2e8f0;border:1px solid #334155;padding:16px}.gameChoice strong{font-size:1.05rem}.gameChoice small{color:#94a3b8;font-size:.76rem;line-height:1.4}.gameChoice.selected{border-color:#60a5fa;box-shadow:0 0 0 2px rgba(96,165,250,.2);background:#172554}.selectedGameText{margin:10px 0 14px;color:#bfdbfe;font-size:.86rem;font-weight:800}@media(max-width:520px){.gamePicker{grid-template-columns:1fr}}
'''
write('public/styles.css', styles)

pkg = json.loads(read('package.json'))
pkg['version'] = '1.6.0'
pkg['description'] = '입장 파일 + 공용 방/채팅 + 오목/오셀로 기반 실시간 보드게임 서버'
write('package.json', json.dumps(pkg, ensure_ascii=False, indent=2) + '\n')

print('Applied multi-game architecture and Othello v1.6.0')
