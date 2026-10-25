'use strict';
const path = require('node:path');
const { Worker } = require('node:worker_threads');

// v1.10.69 오늘의 문제 (한판마당 자료 server/pzdaily.js, IDEAS 「자료 적용 결정」 ③): everyone gets the same puzzle per
// Seoul date and level. The page sends the solved board; the server makes that day's answer again (lib/puzzle-worker.mjs,
// the page's own generator) and keeps the first clear of each game, level and day once (G-포인트: no points). A new
// puzzle (연습) is not sent.
const GAMES = Object.freeze({ sudoku: '스도쿠', nonogram: '네모로직', hashi: '다리 잇기', circuit: '회로 연결' });
const LEVELS = Object.freeze({ easy: '쉬움', normal: '보통', hard: '어려움' });
const MIN_MS = Object.freeze({ easy: 15000, normal: 30000, hard: 45000 }); // nobody solves faster: below it is told `fast`
const VERSION = 1; // the generator rules the page and this server share (pz-util.js PZ_VERSIONS)

const cache = new Map(); // 'game|lv|date' -> Promise<answer>
const waiting = new Map();
let worker = null; let reqId = 0;
function getWorker() {
  if (worker) return worker;
  worker = new Worker(path.join(__dirname, 'puzzle-worker.mjs'));
  worker.on('message', ({ id, sol, error }) => { const w = waiting.get(id); if (!w) return; waiting.delete(id); clearTimeout(w.t); if (error) w.reject(new Error(error)); else w.resolve(sol); });
  const fail = (e) => { for (const w of waiting.values()) { clearTimeout(w.t); w.reject(e instanceof Error ? e : new Error('worker exit')); } waiting.clear(); worker = null; };
  worker.on('error', fail);
  worker.on('exit', (code) => { if (code) fail(new Error(`worker exit ${code}`)); else worker = null; });
  worker.unref(); // after the listeners: attaching one holds the process again
  return worker;
}
function ask(game, lv, date) {
  return new Promise((resolve, reject) => {
    if (waiting.size >= 6) return reject(new Error('busy'));
    const id = ++reqId; const t = setTimeout(() => { waiting.delete(id); reject(new Error('timeout')); }, 30000);
    waiting.set(id, { resolve, reject, t });
    getWorker().postMessage({ id, game, lv, date });
  });
}
function answer(game, lv, date) {
  const key = `${game}|${lv}|${date}`;
  if (!cache.has(key)) {
    const p = ask(game, lv, date);
    p.catch(() => cache.delete(key)); // made again next time
    cache.set(key, p);
    if (cache.size > 120) cache.delete(cache.keys().next().value);
  }
  return cache.get(key);
}

// true / false; null when the server could not make the answer just now (the page may send it again)
async function verify(game, lv, proof) {
  if (!Object.hasOwn(GAMES, game) || !Object.hasOwn(LEVELS, lv) || !proof || typeof proof !== 'object') return false;
  const sol = proof.sol;
  if ((proof.v ?? 1) !== VERSION || !/^\d{4}-\d{2}-\d{2}$/.test(String(proof.date))) return false;
  if (!Array.isArray(sol) || sol.length > 400 || !sol.every(Number.isInteger)) return false;
  let want;
  try { want = await answer(game, lv, proof.date); } catch { return null; }
  return Array.isArray(want) && want.length === sol.length && want.every((v, i) => v === sol[i]);
}

module.exports = { GAMES, LEVELS, MIN_MS, verify, answer };
