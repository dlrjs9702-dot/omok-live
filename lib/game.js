const SIZE = 15;
const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

function createBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function inBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function getLine(board, x, y, dx, dy, color) {
  if (!inBounds(x, y) || board[y][x] !== color) return [];
  const stones = [[x, y]];

  let cx = x - dx;
  let cy = y - dy;
  while (inBounds(cx, cy) && board[cy][cx] === color) {
    stones.unshift([cx, cy]);
    cx -= dx;
    cy -= dy;
  }

  cx = x + dx;
  cy = y + dy;
  while (inBounds(cx, cy) && board[cy][cx] === color) {
    stones.push([cx, cy]);
    cx += dx;
    cy += dy;
  }

  return stones;
}

function exactFiveLine(board, x, y, color) {
  for (const [dx, dy] of DIRECTIONS) {
    const line = getLine(board, x, y, dx, dy, color);
    if (line.length === 5) return line;
  }
  return null;
}

function fiveOrMoreLine(board, x, y, color) {
  for (const [dx, dy] of DIRECTIONS) {
    const line = getLine(board, x, y, dx, dy, color);
    if (line.length >= 5) return line;
  }
  return null;
}

function hasOverline(board, x, y, color = 'black') {
  return DIRECTIONS.some(([dx, dy]) => getLine(board, x, y, dx, dy, color).length >= 6);
}

function isBoardFull(board) {
  return board.every((row) => row.every(Boolean));
}

function lineCoordinatesThrough(x, y, dx, dy) {
  let sx = x;
  let sy = y;
  while (inBounds(sx - dx, sy - dy)) {
    sx -= dx;
    sy -= dy;
  }
  const out = [];
  while (inBounds(sx, sy)) {
    out.push([sx, sy]);
    sx += dx;
    sy += dy;
  }
  return out;
}

function coordKey(coords) {
  return coords
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join('|');
}

function boardKey(board, x, y) {
  let s = `${x},${y}|`;
  for (let yy = 0; yy < SIZE; yy++) {
    for (let xx = 0; xx < SIZE; xx++) {
      const v = board[yy][xx];
      s += v === 'black' ? 'b' : v === 'white' ? 'w' : '.';
    }
  }
  return s;
}

function exactFiveInDirection(board, x, y, dx, dy) {
  return getLine(board, x, y, dx, dy, 'black').length === 5;
}

function isLegalWinningPoint(board, x, y, dx, dy) {
  if (!inBounds(x, y) || board[y][x]) return false;
  board[y][x] = 'black';
  const ok = !hasOverline(board, x, y, 'black') && exactFiveInDirection(board, x, y, dx, dy);
  board[y][x] = null;
  return ok;
}

// 현재 놓인 흑돌(origin)을 포함하는 'four'의 개수.
// 열린 4(.BBBB.)는 양 끝 승리점이 2개여도 같은 네 돌이므로 하나의 four로 센다.
function countFourPatterns(board, originX, originY) {
  const patterns = new Set();

  for (const [dx, dy] of DIRECTIONS) {
    const line = lineCoordinatesThrough(originX, originY, dx, dy);
    for (let start = 0; start <= line.length - 5; start++) {
      const window = line.slice(start, start + 5);
      if (!window.some(([x, y]) => x === originX && y === originY)) continue;

      const blacks = [];
      const empties = [];
      let blocked = false;
      for (const [x, y] of window) {
        if (board[y][x] === 'black') blacks.push([x, y]);
        else if (board[y][x] === null) empties.push([x, y]);
        else { blocked = true; break; }
      }
      if (blocked || blacks.length !== 4 || empties.length !== 1) continue;

      const [ex, ey] = empties[0];
      if (!isLegalWinningPoint(board, ex, ey, dx, dy)) continue;
      patterns.add(coordKey(blacks));
    }
  }

  return patterns.size;
}

function straightFourGroups(board, originX, originY, addedX, addedY, dx, dy) {
  const line = lineCoordinatesThrough(originX, originY, dx, dy);
  const groups = [];

  for (let start = 0; start <= line.length - 4; start++) {
    const group = line.slice(start, start + 4);
    if (!group.every(([x, y]) => board[y][x] === 'black')) continue;
    if (!group.some(([x, y]) => x === originX && y === originY)) continue;
    if (!group.some(([x, y]) => x === addedX && y === addedY)) continue;

    const before = start - 1 >= 0 ? line[start - 1] : null;
    const after = start + 4 < line.length ? line[start + 4] : null;
    if (!before || !after) continue;
    if (board[before[1]][before[0]] !== null || board[after[1]][after[0]] !== null) continue;
    if (!isLegalWinningPoint(board, before[0], before[1], dx, dy)) continue;
    if (!isLegalWinningPoint(board, after[0], after[1], dx, dy)) continue;

    groups.push(group);
  }

  return groups;
}

// 열린 3 판정: 한 수를 더 두어 양쪽으로 5목을 만들 수 있는 straight four가 되어야 한다.
// 그 확장 수가 장목 또는 4-4를 만들면 유효한 3으로 세지 않는다.
// (실전에서 흔히 사용하는 렌주식 금수 판정이며, 복잡한 연쇄 3-3 재귀 예외까지는 두지 않는다.)
function countOpenThreePatterns(board, originX, originY) {
  const patterns = new Set();

  for (const [dx, dy] of DIRECTIONS) {
    const line = lineCoordinatesThrough(originX, originY, dx, dy);
    for (const [ax, ay] of line) {
      if (board[ay][ax] !== null) continue;

      const distance = Math.max(Math.abs(ax - originX), Math.abs(ay - originY));
      if (distance > 4) continue;

      board[ay][ax] = 'black';
      const makesFive = Boolean(exactFiveLine(board, ax, ay, 'black'));
      const overline = hasOverline(board, ax, ay, 'black');
      const doubleFour = !makesFive && !overline && countFourPatterns(board, ax, ay) >= 2;

      if (!makesFive && !overline && !doubleFour) {
        const groups = straightFourGroups(board, originX, originY, ax, ay, dx, dy);
        for (const group of groups) {
          const originalThree = group.filter(([x, y]) => !(x === ax && y === ay));
          if (originalThree.length === 3 && originalThree.some(([x, y]) => x === originX && y === originY)) {
            patterns.add(coordKey(originalThree));
          }
        }
      }

      board[ay][ax] = null;
    }
  }

  return patterns.size;
}

function classifyPlacedBlack(board, x, y) {
  if (hasOverline(board, x, y, 'black')) {
    return { legal: false, win: false, forbidden: 'overline', winningLine: null };
  }

  const five = exactFiveLine(board, x, y, 'black');
  if (five) {
    return { legal: true, win: true, forbidden: null, winningLine: five };
  }

  const fours = countFourPatterns(board, x, y);
  if (fours >= 2) {
    return { legal: false, win: false, forbidden: 'double-four', winningLine: null };
  }

  const threes = countOpenThreePatterns(board, x, y);
  if (threes >= 2) {
    return { legal: false, win: false, forbidden: 'double-three', winningLine: null };
  }

  return { legal: true, win: false, forbidden: null, winningLine: null };
}

function evaluateMove(board, x, y, color) {
  if (!inBounds(x, y)) return { legal: false, reason: 'out-of-bounds', win: false, winningLine: null };
  if (board[y][x]) return { legal: false, reason: 'occupied', win: false, winningLine: null };

  board[y][x] = color;
  let result;
  if (color === 'black') {
    const checked = classifyPlacedBlack(board, x, y);
    result = {
      legal: checked.legal,
      reason: checked.forbidden,
      win: checked.win,
      winningLine: checked.winningLine,
    };
  } else {
    const line = fiveOrMoreLine(board, x, y, 'white');
    result = { legal: true, reason: null, win: Boolean(line), winningLine: line };
  }
  board[y][x] = null;
  return result;
}

function makeInitialGame() {
  return {
    size: SIZE,
    board: createBoard(),
    turn: 'black',
    status: 'selecting',
    winner: null,
    winningLine: null,
    moves: [],
    rematchRequests: { black: false, white: false },
    round: 1,
  };
}

function resetForNextRound(game) {
  const nextRound = Number(game.round || 1) + 1;
  const fresh = makeInitialGame();
  fresh.round = nextRound;
  Object.assign(game, fresh);
}

module.exports = {
  SIZE,
  DIRECTIONS,
  createBoard,
  inBounds,
  getLine,
  exactFiveLine,
  fiveOrMoreLine,
  hasOverline,
  countFourPatterns,
  countOpenThreePatterns,
  evaluateMove,
  isBoardFull,
  makeInitialGame,
  resetForNextRound,
};
