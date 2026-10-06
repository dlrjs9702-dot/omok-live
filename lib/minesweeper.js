'use strict';

// v1.10.37 혼자 하는 게임 — 지뢰찾기 (IDEAS 「솔로 게임」, 사용자 확정 2026-10-06): the standard boards, played on the server.
// The mines are placed at the first opened cell (it and its neighbours are never mines) and stay on the server; the
// player sees only what was opened and their flags. Open, flag, and open around a satisfied number (chord). No fee,
// no penalty; a clear pays by difficulty (the server decides it, see server.js).
const LEVELS = Object.freeze({
  beginner: Object.freeze({ label: '초급', w: 9, h: 9, mines: 10, points: 2000, minMs: 4000 }),
  intermediate: Object.freeze({ label: '중급', w: 16, h: 16, mines: 40, points: 4000, minMs: 15000 }),
  expert: Object.freeze({ label: '고급', w: 30, h: 16, mines: 99, points: 8000, minMs: 35000 }),
});

function createGame(level, { random = Math.random, now = Date.now } = {}) {
  const L = LEVELS[level];
  if (!L) throw new RangeError('Invalid level');
  const n = L.w * L.h;
  const g = { level, w: L.w, h: L.h, mines: L.mines, mine: null, open: new Uint8Array(n), flag: new Uint8Array(n), status: 'ready', startedAt: null, endedAt: null, opened: 0 };
  const at = (x, y) => (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < L.w && y < L.h ? y * L.w + x : -1);
  const around = (i) => { const x = i % L.w; const y = (i - x) / L.w; const out = []; for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) { const j = at(x + dx, y + dy); if (j >= 0 && j !== i) out.push(j); } return out; };
  const count = (i) => around(i).reduce((s, j) => s + g.mine[j], 0);
  function lay(first) { // the first cell and its neighbours stay clear
    const safe = new Set([first, ...around(first)]);
    const spots = []; for (let i = 0; i < n; i += 1) if (!safe.has(i)) spots.push(i);
    for (let k = spots.length - 1; k > 0; k -= 1) { const j = Math.floor(random() * (k + 1)); [spots[k], spots[j]] = [spots[j], spots[k]]; }
    g.mine = new Uint8Array(n); for (const i of spots.slice(0, L.mines)) g.mine[i] = 1;
    g.status = 'playing'; g.startedAt = now();
  }
  function finish(status) { g.status = status; g.endedAt = now(); }
  function flood(start) {
    const stack = [start];
    while (stack.length) {
      const i = stack.pop(); if (g.open[i] || g.flag[i]) continue;
      g.open[i] = 1; g.opened += 1;
      if (count(i) === 0) for (const j of around(i)) if (!g.open[j] && !g.mine[j]) stack.push(j);
    }
  }
  function openCell(i) {
    if (g.open[i] || g.flag[i]) return;
    if (g.mine[i]) { g.open[i] = 1; finish('lost'); return; }
    flood(i);
    if (g.opened === n - L.mines) finish('won');
  }
  return {
    game: g,
    act(action, x, y) {
      const i = at(x, y);
      if (i < 0 || !['open', 'flag', 'chord'].includes(action)) throw new RangeError('Invalid move');
      if (g.status === 'won' || g.status === 'lost') return false;
      if (action === 'flag') { if (g.open[i] || g.status === 'ready') return false; g.flag[i] ^= 1; return true; }
      if (g.status === 'ready') { if (action !== 'open') return false; lay(i); }
      if (action === 'open') { openCell(i); return true; }
      // chord: an opened number with as many flags around opens the rest around it
      if (!g.open[i] || g.mine[i]) return false;
      const near = around(i);
      if (near.filter((j) => g.flag[j]).length !== count(i)) return false;
      for (const j of near) if (g.status === 'playing') openCell(j);
      return true;
    },
    // what the player may see: -1 hidden, -2 flagged, 0..8 an opened count; mines only once it is over
    view() {
      const cells = new Array(n);
      for (let i = 0; i < n; i += 1) cells[i] = g.open[i] && !g.mine?.[i] ? count(i) : g.flag[i] ? -2 : -1;
      const over = g.status === 'won' || g.status === 'lost';
      const out = { level, w: L.w, h: L.h, mines: L.mines, flags: g.flag.reduce((s, f) => s + f, 0), status: g.status, cells,
        ms: g.startedAt === null ? 0 : (g.endedAt ?? now()) - g.startedAt };
      if (over) out.mineAt = Array.from(g.mine.keys()).filter((i) => g.mine[i]);
      if (g.status === 'lost') out.boom = Array.from(g.open.keys()).find((i) => g.open[i] && g.mine[i]);
      return out;
    },
  };
}

module.exports = { LEVELS, createGame };
