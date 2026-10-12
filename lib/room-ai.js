'use strict';
const path = require('node:path');
const { Worker } = require('node:worker_threads');

// v1.10.72 게임방 AI 자리 (사용자 2026-10-12): 오목·사목·오델로 rooms can seat an AI opponent the server plays for
// (lib/room-ai-worker.mjs, the 한판마당 AI). One move at a time in one worker, so a busy evening slows only the AI's
// answers, never the island; AI games are practice: no entry points, no match record, no missions or ranking.
const GAMES = new Set(['omok', 'connect4', 'othello']);
const LEVELS = Object.freeze({ easy: '쉬움', normal: '보통', hard: '어려움' });

const waiting = new Map();
let worker = null; let reqId = 0;
function getWorker() {
  if (worker) return worker;
  worker = new Worker(path.join(__dirname, 'room-ai-worker.mjs'));
  worker.on('message', ({ id, move, error }) => { const w = waiting.get(id); if (!w) return; waiting.delete(id); clearTimeout(w.t); if (error) w.reject(new Error(error)); else w.resolve(move); });
  const fail = (e) => { for (const w of waiting.values()) { clearTimeout(w.t); w.reject(e instanceof Error ? e : new Error('worker exit')); } waiting.clear(); worker = null; };
  worker.on('error', fail);
  worker.on('exit', (code) => { if (code) fail(new Error(`worker exit ${code}`)); else worker = null; });
  worker.unref(); // after the listeners (see lib/puzzle-daily.js)
  return worker;
}

// our board ([y][x] of 'black' | 'white' | null) → the AI's flat board; the AI plays `seat`
function think(gameType, game, seat, level) {
  const flat = game.board.flat().map((v) => (v === 'black' ? 1 : v === 'white' ? 2 : 0));
  const job = { game: gameType, board: flat, color: seat === 'black' ? 1 : 2, level };
  return new Promise((resolve, reject) => {
    if (waiting.size >= 20) return reject(new Error('busy'));
    const id = ++reqId; const t = setTimeout(() => { waiting.delete(id); reject(new Error('timeout')); }, 30000);
    waiting.set(id, { resolve, reject, t });
    getWorker().postMessage({ id, job });
  }).then((move) => {
    if (move == null) return null;
    const width = game.board[0].length;
    return gameType === 'connect4' ? { x: move, y: 0 } : { x: move % width, y: Math.floor(move / width) };
  });
}

module.exports = { GAMES, LEVELS, think };
