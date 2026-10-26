'use strict';
const path = require('node:path');
const { Worker } = require('node:worker_threads');

// v1.10.70 카드 게임 (한판마당 자료 06, IDEAS 「자료 적용 결정」 ①): 클론다이크·프리셀·스파이더. The server deals (a seed per
// round), and keeps a cleared round's record only after playing its action log again with the page's own game code
// (lib/card-worker.mjs) and reaching the win (G-포인트: no points).
const GAMES = Object.freeze({
  klondike: Object.freeze({ name: '카드놀이', levels: { easy: '1장 넘기기', hard: '3장 넘기기' }, higher: false }),
  freecell: Object.freeze({ name: '프리셀', levels: { easy: '빈칸 4개', hard: '빈칸 3개' }, higher: false }),
  spider: Object.freeze({ name: '스파이더', levels: { easy: '1벌', normal: '2벌', hard: '4벌' }, higher: true }),
});
const MIN_MS = 60000; // nobody clears one faster: below it the clear is told `fast`
const RUN_MS = 3 * 60 * 60 * 1000;

const waiting = new Map();
let worker = null; let reqId = 0;
function getWorker() {
  if (worker) return worker;
  worker = new Worker(path.join(__dirname, 'card-worker.mjs'));
  worker.on('message', ({ id, ...out }) => { const w = waiting.get(id); if (!w) return; waiting.delete(id); clearTimeout(w.t); w.resolve(out); });
  const fail = (e) => { for (const w of waiting.values()) { clearTimeout(w.t); w.reject(e instanceof Error ? e : new Error('worker exit')); } waiting.clear(); worker = null; };
  worker.on('error', fail);
  worker.on('exit', (code) => { if (code) fail(new Error(`worker exit ${code}`)); else worker = null; });
  worker.unref(); // after the listeners (see lib/puzzle-daily.js)
  return worker;
}
// { won, score } | { error } — rejects only when the worker could not answer (busy, gone)
function replay(job) {
  return new Promise((resolve, reject) => {
    if (waiting.size >= 6) return reject(new Error('busy'));
    const id = ++reqId; const t = setTimeout(() => { waiting.delete(id); reject(new Error('timeout')); }, 30000);
    waiting.set(id, { resolve, reject, t });
    getWorker().postMessage({ id, job });
  });
}

module.exports = { GAMES, MIN_MS, RUN_MS, replay };
