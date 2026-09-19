'use strict';

const DOTS = 5;
const BOXES = DOTS - 1;
const HORIZONTAL_COUNT = DOTS * BOXES;
const EDGE_COUNT = HORIZONTAL_COUNT * 2;

const metadata = {
  id: 'dots',
  name: '점과 상자',
  size: DOTS,
  rules: '5×5 점을 잇는 2인 게임. 차례마다 인접한 두 점 사이에 선 하나를 긋습니다. 네 변을 완성해 상자를 만든 플레이어가 그 상자를 차지하고 한 번 더 선을 긋습니다. 모든 선을 그었을 때 상자를 더 많이 차지한 쪽이 승리합니다.',
};

function create() {
  return {
    status: 'selecting', turn: 'black', winner: null, winningLine: null,
    round: 1, moves: [],
    edges: {
      h: Array.from({ length: DOTS }, () => Array(BOXES).fill(null)),
      v: Array.from({ length: BOXES }, () => Array(DOTS).fill(null)),
    },
    boxes: Array.from({ length: BOXES }, () => Array(BOXES).fill(null)),
  };
}

function start(game) {
  game.status = 'playing';
  game.turn = 'black';
}

function reset(game) {
  const round = Number(game.round || 1) + 1;
  Object.assign(game, create(), { round });
}

function decodeEdge(edgeId) {
  if (!Number.isInteger(edgeId) || edgeId < 0 || edgeId >= EDGE_COUNT) return null;
  if (edgeId < HORIZONTAL_COUNT) return { orientation: 'h', row: Math.floor(edgeId / BOXES), col: edgeId % BOXES };
  const index = edgeId - HORIZONTAL_COUNT;
  return { orientation: 'v', row: Math.floor(index / DOTS), col: index % DOTS };
}

function edgeId(orientation, row, col) {
  return orientation === 'h' ? row * BOXES + col : HORIZONTAL_COUNT + row * DOTS + col;
}

function boxComplete(game, row, col) {
  return Boolean(game.edges.h[row][col] && game.edges.h[row + 1][col]
    && game.edges.v[row][col] && game.edges.v[row][col + 1]);
}

function adjacentBoxes(edge) {
  const boxes = [];
  if (edge.orientation === 'h') {
    if (edge.row > 0) boxes.push([edge.row - 1, edge.col]);
    if (edge.row < BOXES) boxes.push([edge.row, edge.col]);
  } else {
    if (edge.col > 0) boxes.push([edge.row, edge.col - 1]);
    if (edge.col < BOXES) boxes.push([edge.row, edge.col]);
  }
  return boxes;
}

function scores(game) {
  let black = 0;
  let white = 0;
  for (const row of game.boxes) for (const box of row) {
    if (box === 'black') black += 1;
    else if (box === 'white') white += 1;
  }
  return { black, white };
}

function legalEdges(game) {
  if (game.status !== 'playing') return [];
  const result = [];
  for (let id = 0; id < EDGE_COUNT; id += 1) {
    const edge = decodeEdge(id);
    if (!game.edges[edge.orientation][edge.row][edge.col]) result.push(id);
  }
  return result;
}

function applyMove(game, rawEdgeId, _unused, color, at) {
  const id = Number(rawEdgeId);
  const edge = decodeEdge(id);
  if (!edge) return { legal: false, reason: 'bad-edge' };
  if (game.edges[edge.orientation][edge.row][edge.col]) return { legal: false, reason: 'occupied' };
  game.edges[edge.orientation][edge.row][edge.col] = color;
  const claimed = [];
  for (const [row, col] of adjacentBoxes(edge)) {
    if (!game.boxes[row][col] && boxComplete(game, row, col)) {
      game.boxes[row][col] = color;
      claimed.push([row, col]);
    }
  }
  game.moves.push({ edgeId: id, ...edge, color, claimed, at });
  if (game.moves.length === EDGE_COUNT) {
    const count = scores(game);
    game.turn = null;
    if (count.black === count.white) {
      game.status = 'draw';
      game.winner = null;
    } else {
      game.status = 'finished';
      game.winner = count.black > count.white ? 'black' : 'white';
    }
  } else if (!claimed.length) {
    game.turn = color === 'black' ? 'white' : 'black';
  }
  return { legal: true, claimed, extraTurn: claimed.length > 0, finished: game.status !== 'playing' };
}

function moveError(reason) {
  if (reason === 'occupied') return '이미 그어진 선입니다.';
  if (reason === 'bad-edge') return '인접한 두 점 사이의 빈 선을 선택해 주세요.';
  return '이 선은 그을 수 없습니다.';
}

function publicState(game) {
  const available = legalEdges(game);
  return {
    size: DOTS, board: [], edges: game.edges, boxes: game.boxes,
    turn: game.turn, status: game.status, winner: game.winner, winningLine: null,
    moveCount: game.moves.length, lastMove: game.moves.at(-1) || null,
    round: game.round, legalEdges: available,
    legalMoves: available.map(x => ({ x, y: 0 })), scores: scores(game), lastPass: null,
    paused: Boolean(game.paused), disconnectedSeats: game.disconnectedSeats || [],
    endReason: game.endReason || null, disconnectedAtEnd: game.disconnectedAtEnd || [],
  };
}

module.exports = { ...metadata, DOTS, BOXES, EDGE_COUNT, create, start, reset, decodeEdge, edgeId, boxComplete, legalEdges, scores, applyMove, publicState, moveError };
