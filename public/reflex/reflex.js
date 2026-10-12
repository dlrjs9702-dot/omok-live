// v1.10.68 순발력 게임 (한판마당 자료 02 + 공통 엔진 00, js/ 아래는 원본 그대로): the game list, a game's levels and
// how-to, a round on the engine's canvas and its result. The server opens each round and judges the score once it ends
// (server.js /api/solo/reflex, lib/reflex.js); points by level up to the day's cap. Esc: a round → the game, the game →
// the list, the list → the island. Sound is on unless turned off here (kept on this device, js/store.js).
// v1.10.69 퍼즐 (한판마당 자료 01): the same screens for the four logic puzzles. 오늘의 문제 (the same puzzle for everyone
// per Seoul date and level) sends its solved board, and the server pays the day's first right answer once
// (/api/solo/puzzle, lib/puzzle-daily.js); 새 문제 is practice and is not sent.
import { E, startGame, stopGame } from './js/engine.js';
import { Settings } from './js/store.js';
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

const SETS = {
  reflex: { title: '순발력 게임', games: [whack, reaction, colorfind, numbers, rhythm], info: '/api/solo/reflex' },
  puzzle: { title: '퍼즐', games: [sudoku, nonogram, hashi, circuit], info: '/api/solo/puzzle' },
};
const MODES = [['daily', '오늘의 문제'], ['random', '새 문제 (연습)']];
const LEVELS = [['easy', '쉬움'], ['normal', '보통'], ['hard', '어려움']];
const KEYS = { reaction: 'Space · Enter', rhythm: 'D F J K' }; // the games' own keys on a PC
const won = (n) => `${Number(n).toLocaleString('ko-KR')}P`;

export function mount({ api, onExit }) {
  const view = document.getElementById('reflexView');
  const frame = view.querySelector('.reflexFrame');
  const menu = document.getElementById('reflexMenu');
  const result = document.getElementById('reflexResult');
  let set = SETS.reflex; let info = null; let game = null; let runId = null; let shown = 'list'; let startSeq = 0;
  const levels = {}; // game id -> the level last played
  try { Object.assign(levels, JSON.parse(localStorage.getItem('gc.reflexLevels') || '{}')); } catch {}

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (cls, text, onClick) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  const levelOf = (g) => (g.levels ? levels[g.id] || g.defaultLevel || 'normal' : 'normal');
  const modeOf = (g) => (g.options ? levels[`${g.id}.mode`] || 'daily' : null); // the puzzles: 오늘의 문제 or 새 문제
  const remember = (key, value) => { levels[key] = value; try { localStorage.setItem('gc.reflexLevels', JSON.stringify(levels)); } catch {} };
  const bestOf = (g) => info?.records?.[g.id]?.[levelOf(g)]?.best ?? null;

  function head(title, back) {
    const top = el('div', 'reflexHead');
    top.append(button('ghost tiny', back ? '‹ 목록' : '나가기', back ? showList : exit), el('strong', null, title));
    const sound = button('ghost tiny reflexSound', '', () => { Settings.toggle('sound'); paintSound(); });
    const paintSound = () => { const on = Settings.get('sound'); sound.textContent = on ? '🔊 효과음' : '🔇 효과음'; sound.setAttribute('aria-pressed', String(on)); };
    paintSound();
    top.append(sound);
    return top;
  }
  function todayLine() {
    if (set === SETS.puzzle) return el('p', 'reflexToday', '오늘의 문제는 처음 푼 한 번만 포인트');
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
    if (g.levels) {
      const pick = el('div', 'reflexLevels'); pick.setAttribute('role', 'radiogroup'); pick.setAttribute('aria-label', g.levelTitle || '난이도');
      for (const [id, label] of LEVELS) {
        const paid = !g.options || modeOf(g) === 'daily'; // practice puzzles pay nothing
        const b = button('reflexLevel', paid ? `${g.levelNames?.[id] || label} · ${won(info?.points?.[id] ?? 0)}` : g.levelNames?.[id] || label, () => { remember(g.id, id); showGame(g); });
        b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(levelOf(g) === id));
        pick.append(b);
      }
      if (g.options) {
        const modes = el('div', 'reflexLevels reflexModes'); modes.setAttribute('role', 'radiogroup'); modes.setAttribute('aria-label', '문제');
        for (const [id, label] of MODES) {
          const b = button('reflexLevel', label, () => { remember(`${g.id}.mode`, id); showGame(g); });
          b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(modeOf(g) === id));
          modes.append(b);
        }
        box.append(modes);
      }
      box.append(pick);
    } else box.append(el('p', 'reflexPoints', `완주 ${won(info?.points?.normal ?? 0)}`));
    const best = bestOf(g);
    box.append(el('p', 'reflexBest', best == null ? '아직 기록 없음' : `내 최고 ${fmtScore(best, g.unit)}`));
    const status = el('p', 'reflexStatus'); status.setAttribute('role', 'alert');
    const go = button('primary reflexGo', '시작', () => start(g, status));
    box.append(go, status);
    menu.replaceChildren(head(g.name, true), todayLine(), box);
    go.focus();
  }

  async function start(g, status) {
    unlockAudio(); // the first press opens the sound (phones need a touch first)
    const seq = ++startSeq; const level = levelOf(g); // a screen change or a later press makes this answer stale (Codex review)
    const mode = modeOf(g);
    let id = null;
    try {
      if (set === SETS.reflex) id = (await api('/api/solo/reflex/start', { method: 'POST', body: JSON.stringify({ game: g.id, level }) })).id;
      else if (mode === 'daily') await api('/api/solo/puzzle/start', { method: 'POST', body: JSON.stringify({ game: g.id, level }) });
    } catch (error) { if (seq === startSeq) status.textContent = error.message; return; }
    if (seq !== startSeq || view.classList.contains('hidden')) return;
    runId = id; shown = 'play'; game = g;
    menu.classList.add('hidden'); result.classList.add('hidden'); frame.classList.add('playing');
    E.onEnd = (r) => finish(g, r);
    startGame(g, { best: bestOf(g), level, opts: mode ? { mode } : {} });
  }

  async function finish(g, r) {
    frame.classList.remove('playing');
    shown = 'result';
    const id = runId; runId = null;
    const score = r.score == null ? null : Math.round(r.score); // a practice puzzle has none
    const box = el('div', 'reflexPanel');
    box.style.setProperty('--c1', g.color);
    box.append(el('h2', null, r.title || g.name));
    if (score != null) box.append(el('p', 'reflexScore', fmtScore(score, g.unit)));
    const line = el('p', 'reflexPaid', set === SETS.reflex || r.proof ? '기록 확인 중…' : '');
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
    if (set === SETS.puzzle) return r.proof && sendPuzzle(g, score, r.proof, line);
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

  async function sendPuzzle(g, score, proof, line) { // 오늘의 문제, solved for the first time on this device
    try {
      const out = await api('/api/solo/puzzle/finish', { method: 'POST', body: JSON.stringify({ game: g.id, level: levelOf(g), score, proof }) });
      if (info && out.best != null) (info.records[g.id] ||= {})[levelOf(g)] = { best: out.best };
      const parts = [];
      if (out.newBest) { parts.push('최고 기록!'); sfx.best(); }
      if (out.points) parts.push(`+${won(out.points)}`);
      else if (out.already) parts.push('오늘의 문제는 이미 기록했어요');
      else parts.push('이번 기록은 포인트가 없어요');
      line.textContent = parts.join(' · ');
    } catch (error) { line.textContent = error.message; }
  }

  function quit() { // a round left before its end: not reported, so not paid
    stopGame(); runId = null; frame.classList.remove('playing');
    result.classList.add('hidden'); menu.classList.remove('hidden');
    showGame(game);
  }
  function exit() { stop(); onExit(); }
  function stop() { stopGame(); runId = null; startSeq += 1; frame.classList.remove('playing'); }

  document.getElementById('reflexQuitBtn').addEventListener('click', quit);
  document.addEventListener('keydown', (event) => {
    if (view.classList.contains('hidden') || event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (shown === 'play' && set === SETS.puzzle) return; // a puzzle's own Esc closes its hint (✕ leaves it)
    event.preventDefault();
    if (shown === 'play') quit();
    else if (shown === 'result') { stopGame(); result.classList.add('hidden'); menu.classList.remove('hidden'); showGame(game); }
    else if (shown === 'game') showList();
    else exit();
  });

  return {
    async open(which = 'reflex') {
      stop(); result.classList.add('hidden'); menu.classList.remove('hidden');
      set = SETS[which] || SETS.reflex; info = null;
      showList();
      try { // the list is usable meanwhile: redraw only what still shows (Codex review)
        const want = set; const got = await api(set.info);
        if (want !== set) return; // opened the other set meanwhile
        info = got;
        if (shown === 'list') showList(); else if (shown === 'game') showGame(game);
      } catch (error) { menu.append(el('p', 'reflexStatus', error.message)); }
    },
    stop,
  };
}
