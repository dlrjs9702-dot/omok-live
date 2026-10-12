// v1.10.68 순발력 게임 (한판마당 자료 02 + 공통 엔진 00, js/ 아래는 원본 그대로): the game list, a game's levels and
// how-to, a round on the engine's canvas and its result. The server opens each round and judges the score once it ends
// (server.js /api/solo/reflex, lib/reflex.js); points by level up to the day's cap. Esc: a round → the game, the game →
// the list, the list → the island. Sound is on unless turned off here (kept on this device, js/store.js).
// v1.10.69 퍼즐 (한판마당 자료 01): the same screens for the four logic puzzles. 오늘의 문제 (the same puzzle for everyone
// per Seoul date and level) sends its solved board, and the server pays the day's first right answer once
// (/api/solo/puzzle, lib/puzzle-daily.js); 새 문제 is practice and is not sent.
// v1.10.70 카드 게임 (한판마당 자료 06): the server deals (the round's seed) and, once cleared, plays the round's actions
// again with the same game code (/api/solo/cards, lib/card-worker.mjs). The actions are noted here as they happen: the
// game's own moves, a turn of the stock, a dealt row, an undo, and the moves up the game makes by itself.
// The list's 「‹ 뒤로」 goes back to choosing a game (사용자 2026-10-12: 나가기 alone went straight to the island).
// v1.10.71 AI 대전 (한판마당 자료 04, 사용자 2026-10-12 「연습으로」): 오목·사목·오델로 against the material's AI in the
// browser, 쉬움·보통·어려움 — practice only: nothing goes to the server, no points, no records. A game's own settings
// (오목 규칙, 먼저 두기, 퍼즐 문제) show as choices from its `options`.
import { E, startGame, stopGame } from './js/engine.js';
import { Settings, Stats } from './js/store.js';
import { readQueue, dropRecord } from './js/outbox.js';
import { unlockAudio, sfx } from './js/audio.js';
import { art } from './js/icons.js';
import { fmtScore } from './js/util.js';
import whack from './js/games/whack.js';
import reaction from './js/games/reaction.js';
import colorfind from './js/games/colorfind.js';
import numbers from './js/games/numbers.js';
import rhythm from './js/games/rhythm.js';
import sudoku from './js/games/sudoku.js';
import nonogram from './js/games/nonogram.js';
import hashi from './js/games/hashi.js';
import circuit from './js/games/circuit.js';
import klondike from './js/games/klondike.js';
import freecell from './js/games/freecell.js';
import spider from './js/games/spider.js';
import { Table } from './js/games/cards.js';
import gomoku from './js/games/gomoku.js';
import connect4 from './js/games/connect4.js';
import reversi from './js/games/reversi.js';

const SETS = {
  reflex: { title: '순발력 게임', games: [whack, reaction, colorfind, numbers, rhythm], info: '/api/solo/reflex' },
  puzzle: { title: '퍼즐', games: [sudoku, nonogram, hashi, circuit], info: '/api/solo/puzzle' },
  cards: { title: '카드 게임', games: [klondike, freecell, spider], info: '/api/solo/cards' },
  ai: { title: 'AI 대전', games: [gomoku, connect4, reversi], info: null }, // practice: no server
};
const LOG_MAX = 5000; // actions in a round the server takes (a longer round is played, not paid)
let cardLog = null; let inMove = false;
const tableMove = Table.prototype.move;
Table.prototype.move = function (from, idx, to) { // a move not made through the game's doMove is the game's own move up
  if (cardLog && !inMove) cardLog.push(`a,${from.id},${idx},${to.id}`);
  return tableMove.call(this, from, idx, to);
};
function noteActions(g) {
  if (g.noted) return;
  g.noted = true;
  const wrap = (name, line) => {
    const f = g[name];
    if (!f) return;
    g[name] = function (...args) {
      if (cardLog) cardLog.push(line(...args));
      inMove = name === 'doMove';
      try { return f.apply(this, args); } finally { inMove = false; }
    };
  };
  wrap('doMove', (from, idx, to) => `m,${from.id},${idx},${to.id}`);
  wrap('flip', () => 'f'); wrap('deal', () => 'd'); wrap('undo', () => 'u');
}
const LEVEL_NAMES = { easy: '쉬움', normal: '보통', hard: '어려움' };
const KEYS = { reaction: 'Space · Enter', rhythm: 'D F J K' }; // the games' own keys on a PC
const won = (n) => `${Number(n).toLocaleString('ko-KR')}P`;

export function mount({ api, onBack }) {
  const view = document.getElementById('reflexView');
  const frame = view.querySelector('.reflexFrame');
  const menu = document.getElementById('reflexMenu');
  const result = document.getElementById('reflexResult');
  let set = SETS.reflex; let info = null; let game = null; let runId = null; let shown = 'list'; let startSeq = 0;
  const levels = {}; // game id -> the level last played
  try { Object.assign(levels, JSON.parse(localStorage.getItem('gc.reflexLevels') || '{}')); } catch {}

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (cls, text, onClick) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  const levelOf = (g) => (g.levels || g.mode === 'versus' ? levels[g.id] || g.defaultLevel || 'normal' : 'normal');
  const optionOf = (g, o) => (o.items.some(([v]) => v === levels[`${g.id}.${o.id}`]) ? levels[`${g.id}.${o.id}`] : o.def);
  const optionsOf = (g) => Object.fromEntries((g.options || []).map((o) => [o.id, optionOf(g, o)]));
  const modeOf = (g) => optionsOf(g).mode ?? null; // the puzzles: 오늘의 문제 (daily) or 새 문제
  const remember = (key, value) => { levels[key] = value; try { localStorage.setItem('gc.reflexLevels', JSON.stringify(levels)); } catch {} };
  const bestOf = (g) => info?.records?.[g.id]?.[levelOf(g)]?.best ?? null;
  const pointsOf = (g, level) => (set === SETS.cards ? info?.points?.[g.id]?.[level] : info?.points?.[level]) ?? 0;

  function head(title, back) {
    const top = el('div', 'reflexHead');
    top.append(button('ghost tiny', back ? '‹ 목록' : '‹ 뒤로', back ? showList : goBack), el('strong', null, title));
    const sound = button('ghost tiny reflexSound', '', () => { Settings.toggle('sound'); paintSound(); });
    const paintSound = () => { const on = Settings.get('sound'); sound.textContent = on ? '🔊 효과음' : '🔇 효과음'; sound.setAttribute('aria-pressed', String(on)); };
    paintSound();
    top.append(sound);
    return top;
  }
  function todayLine() {
    if (set === SETS.puzzle) return el('p', 'reflexToday', '오늘의 문제는 처음 푼 한 번만 포인트');
    if ((set === SETS.cards && !info) || set === SETS.ai) return el('p', 'reflexToday', set === SETS.ai ? '연습 · 포인트 없음' : '');
    return el('p', 'reflexToday', info ? `오늘 받은 포인트 ${won(info.today)} / ${won(info.cap)}` : '');
  }

  function showList() {
    shown = 'list'; game = null; startSeq += 1;
    const list = el('div', 'reflexList');
    for (const g of set.games) {
      const b = button('reflexCard', '', () => showGame(g));
      b.style.setProperty('--c1', g.color); b.style.setProperty('--c2', g.c2); b.style.setProperty('--c3', g.c3);
      const pic = el('span', 'reflexArt'); pic.innerHTML = art(g.id); // the material's own drawn icons (no outside data)
      const words = el('span', 'reflexWords'); words.append(el('strong', null, g.name), el('small', null, g.tagline));
      b.append(pic, words);
      list.append(b);
    }
    menu.replaceChildren(head(set.title, false), todayLine(), list);
    menu.querySelector('.reflexCard')?.focus();
  }

  function showGame(g) {
    shown = 'game'; game = g; startSeq += 1;
    const box = el('div', 'reflexGame');
    box.style.setProperty('--c1', g.color);
    const how = el('ul', 'reflexHow');
    for (const [, line] of g.howto) how.append(el('li', null, line));
    if (KEYS[g.id]) how.append(el('li', 'reflexKeys', `키보드: ${KEYS[g.id]}`));
    box.append(el('p', 'reflexTagline', g.tagline), how);
    if (g.levels || g.mode === 'versus') {
      const pick = el('div', 'reflexLevels'); pick.setAttribute('role', 'radiogroup'); pick.setAttribute('aria-label', g.mode === 'versus' ? 'AI 난이도' : g.levelTitle || '난이도');
      for (const id of g.levelIds || ['easy', 'normal', 'hard']) {
        const label = g.mode === 'versus' ? `AI ${LEVEL_NAMES[id]}` : LEVEL_NAMES[id];
        const paid = set !== SETS.ai && (set !== SETS.puzzle || modeOf(g) === 'daily'); // practice pays nothing
        const b = button('reflexLevel', paid ? `${g.levelNames?.[id] || label} · ${won(pointsOf(g, id))}` : g.levelNames?.[id] || label, () => { remember(g.id, id); showGame(g); });
        b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(levelOf(g) === id));
        pick.append(b);
      }
      for (const o of g.options || []) {
        const modes = el('div', 'reflexLevels reflexModes'); modes.setAttribute('role', 'radiogroup'); modes.setAttribute('aria-label', o.title);
        for (const [id, label] of o.items) {
          const b = button('reflexLevel', label, () => { remember(`${g.id}.${o.id}`, id); showGame(g); });
          b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(optionOf(g, o) === id));
          modes.append(b);
        }
        box.append(modes);
      }
      box.append(pick);
    } else box.append(el('p', 'reflexPoints', `완주 ${won(info?.points?.normal ?? 0)}`));
    const best = bestOf(g);
    if (set !== SETS.ai) box.append(el('p', 'reflexBest', best == null ? '아직 기록 없음' : `내 최고 ${fmtScore(best, g.unit)}`));
    const status = el('p', 'reflexStatus'); status.setAttribute('role', 'alert');
    const go = button('primary reflexGo', '시작', () => start(g, status));
    box.append(go, status);
    menu.replaceChildren(head(g.name, true), todayLine(), box);
    go.focus();
  }

  async function start(g, status) {
    unlockAudio(); // the first press opens the sound (phones need a touch first)
    if (set === SETS.puzzle && !info) { status.textContent = '불러오는 중이에요. 잠시 후 다시 눌러 주세요.'; return; } // whose progress, first
    const seq = ++startSeq; const level = levelOf(g); // a screen change or a later press makes this answer stale (Codex review)
    const mode = modeOf(g);
    let id = null; let seed = null;
    try {
      if (set === SETS.reflex) id = (await api('/api/solo/reflex/start', { method: 'POST', body: JSON.stringify({ game: g.id, level }) })).id;
      else if (set === SETS.cards) ({ id, seed } = await api('/api/solo/cards/start', { method: 'POST', body: JSON.stringify({ game: g.id, level }) }));
      else if (mode === 'daily') await api('/api/solo/puzzle/start', { method: 'POST', body: JSON.stringify({ game: g.id, level }) });
    } catch (error) { if (seq === startSeq) status.textContent = error.message; return; }
    if (seq !== startSeq || view.classList.contains('hidden')) return;
    runId = id; shown = 'play'; game = g;
    menu.classList.add('hidden'); result.classList.add('hidden'); frame.classList.add('playing');
    E.onEnd = (r) => finish(g, r);
    if (set === SETS.cards) { noteActions(g); cardLog = []; } else cardLog = null;
    startGame(g, { best: bestOf(g), level, opts: { ...optionsOf(g), ...(seed != null ? { seed } : {}) } });
  }

  async function finish(g, r) {
    frame.classList.remove('playing');
    shown = 'result';
    const id = runId; runId = null;
    const log = cardLog; cardLog = null;
    const score = r.score == null ? null : Math.round(r.score); // a practice puzzle has none
    const box = el('div', 'reflexPanel');
    box.style.setProperty('--c1', g.color);
    box.append(el('h2', null, r.title || g.name));
    if (score != null) box.append(el('p', 'reflexScore', fmtScore(score, g.unit)));
    const line = el('p', 'reflexPaid', (set === SETS.reflex || set === SETS.cards || r.proof) ? '기록 확인 중…' : '');
    box.append(line);
    if (r.stats?.length) {
      const stats = el('div', 'reflexStats');
      for (const [k, v] of r.stats) { const s = el('div', 'reflexStat'); s.append(el('b', null, String(v)), el('span', null, k)); stats.append(s); }
      box.append(stats);
    }
    const again = button('primary', '다시 하기', () => start(g, line));
    box.append(el('div', 'reflexActions'));
    box.lastChild.append(again, button('ghost', '다른 게임', () => { stopGame(); showList(); menu.classList.remove('hidden'); result.classList.add('hidden'); }));
    result.replaceChildren(box); result.classList.remove('hidden');
    again.focus();
    if (set === SETS.puzzle) return r.proof && sendPuzzle(g, score, r.proof, line, r.rec);
    if (set === SETS.cards) return sendCards(g, id, log, line);
    if (set === SETS.ai) return; // practice: not sent
    try {
      const out = await api('/api/solo/reflex/finish', { method: 'POST', body: JSON.stringify({ id, score }) });
      if (info) { (info.records[g.id] ||= {})[levelOf(g)] = { best: out.best }; info.today = out.today ?? info.today; }
      const parts = [];
      if (out.newBest) { parts.push('최고 기록!'); sfx.best(); }
      if (out.points) parts.push(`+${won(out.points)}`);
      else if (out.verdict === 'ok') parts.push('오늘 받을 포인트를 다 받았어요');
      else if (out.verdict === 'low') parts.push('포인트는 기록이 조금 더 좋아야 받아요');
      line.textContent = parts.join(' · ') || `최고 ${fmtScore(out.best, g.unit)}`;
    } catch (error) { line.textContent = error.message; }
  }

  // v1.10.70 (Codex review): puzzle-kit writes a solved 오늘의 문제 into this account's 보낼 기록함 (js/outbox.js) before it
  // marks the day done; it leaves the box once the server has answered for good, so a failed send goes again next time
  const settled = (error) => error.status && error.status < 500 && error.status !== 429;
  async function sendPuzzle(g, score, proof, line, rec) { // 오늘의 문제, solved for the first time on this device
    try {
      const out = await api('/api/solo/puzzle/finish', { method: 'POST', body: JSON.stringify({ game: g.id, level: levelOf(g), score, proof }) });
      if (rec) dropRecord(Stats.uid, rec.rid);
      if (info && out.best != null) (info.records[g.id] ||= {})[levelOf(g)] = { best: out.best };
      const parts = [];
      if (out.newBest) { parts.push('최고 기록!'); sfx.best(); }
      if (out.points) parts.push(`+${won(out.points)}`);
      else if (out.already) parts.push('오늘의 문제는 이미 기록했어요');
      else parts.push('이번 기록은 포인트가 없어요');
      line.textContent = parts.join(' · ');
    } catch (error) {
      if (rec && settled(error)) dropRecord(Stats.uid, rec.rid);
      line.textContent = settled(error) ? error.message : '기록을 보내지 못했어요 · 퍼즐을 다시 열면 다시 보내요';
    }
  }
  async function resendPuzzles() { // what an earlier send left in the box
    for (const r of readQueue(Stats.uid)) {
      try { await api('/api/solo/puzzle/finish', { method: 'POST', body: JSON.stringify({ game: r.game, level: r.lv, score: r.score, proof: r.pz }) }); dropRecord(Stats.uid, r.rid); }
      catch (error) { if (settled(error)) dropRecord(Stats.uid, r.rid); else return; }
    }
  }

  async function sendCards(g, id, log, line) { // a cleared deal: the server plays it again before it pays
    if (log.length > LOG_MAX) { line.textContent = '너무 긴 판이라 기록하지 못했어요'; return; }
    try {
      const out = await api('/api/solo/cards/finish', { method: 'POST', body: JSON.stringify({ id, log: log.join(';') }) });
      if (info) { (info.records[g.id] ||= {})[levelOf(g)] = { best: out.best }; info.today = out.today ?? info.today; }
      const parts = [];
      if (out.newBest) { parts.push('최고 기록!'); sfx.best(); }
      if (out.points) parts.push(`+${won(out.points)}`);
      else parts.push(out.fast ? '이번 판은 포인트가 없어요' : '오늘 받을 포인트를 다 받았어요');
      line.textContent = parts.join(' · ');
    } catch (error) { line.textContent = error.message; }
  }

  function quit() { // a round left before its end: not reported, so not paid
    stopGame(); runId = null; frame.classList.remove('playing');
    result.classList.add('hidden'); menu.classList.remove('hidden');
    showGame(game);
  }
  function goBack() { stop(); onBack(); } // to choosing a game
  function stop() { stopGame(); runId = null; cardLog = null; startSeq += 1; frame.classList.remove('playing'); }

  document.getElementById('reflexQuitBtn').addEventListener('click', quit);
  document.addEventListener('keydown', (event) => {
    if (view.classList.contains('hidden') || event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (shown === 'play' && set === SETS.puzzle) return; // a puzzle's own Esc closes its hint (✕ leaves it)
    event.preventDefault();
    if (shown === 'play') quit();
    else if (shown === 'result') { stopGame(); result.classList.add('hidden'); menu.classList.remove('hidden'); showGame(game); }
    else if (shown === 'game') showList();
    else goBack();
  });

  return {
    async open(which = 'reflex') {
      stop(); result.classList.add('hidden'); menu.classList.remove('hidden');
      set = SETS[which] || SETS.reflex; info = null;
      showList();
      try { // the list is usable meanwhile: redraw only what still shows (Codex review)
        if (!set.info) return;
        const want = set; const got = await api(set.info);
        if (want !== set) return; // opened the other set meanwhile
        info = got;
        if (set === SETS.puzzle) { Stats.load(info.uid); resendPuzzles(); } // this account's own progress (Codex review)
        if (shown === 'list') showList(); else if (shown === 'game') showGame(game);
      } catch (error) { menu.append(el('p', 'reflexStatus', error.message)); }
    },
    stop,
  };
}
