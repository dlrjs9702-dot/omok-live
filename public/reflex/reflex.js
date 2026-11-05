// v1.10.68 순발력 게임 (한판마당 자료 02 + 공통 엔진 00, js/ 아래는 원본 그대로): the game list, a game's levels and
// how-to, a round on the engine's canvas and its result. The server opens each round and judges the score once it ends
// (server.js /api/solo/reflex, lib/reflex.js); my best by level (G-포인트: no points -- they come from the island). Esc: a round → the game, the game →
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
// v1.10.73 게임관 개편 (IDEAS #future-gamehall-renewal): the game hall opens one game directly (its card), and 「‹ 게임관」
// goes back there -- the lists above are no longer shown from the island. `play` is the 게임 실행 규약 the game hall and
// later the island's quests share: play(game, { level, goal, place: 'gamehall' | 'quest' }) -> { game, level, score, done,
// run } once the round ends (done: the goal reached; run: the server's round id, for a reflex or card round, to check it).
// A quest round starts at once at its level; leaving it gives { done: false }.
// v1.10.238 섬 대회 천막 (문제 기록 1103 7): place 'contest' -- opened by the tent's keeper, the round starts at once at the
// contest's level and is sent as a contest round (the server checks the tent and the event); 「다시 하기」 stays one, a tag
// 「🏆 대회 · 남은 m:ss」 over the round, the result line my contest record and rank.
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
import stairs from './js/games/stairs.js';
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
import mines from './js/games/mines.js';

const SETS = {
  reflex: { title: '순발력 게임', games: [whack, reaction, colorfind, numbers, rhythm, stairs], info: '/api/solo/reflex' },
  puzzle: { title: '퍼즐', games: [sudoku, nonogram, hashi, circuit], info: '/api/solo/puzzle' },
  cards: { title: '카드 게임', games: [klondike, freecell, spider], info: '/api/solo/cards' },
  ai: { title: 'AI 대전', games: [gomoku, connect4, reversi], info: null }, // practice: no server
  // v1.10.249 G4: 지뢰찾기 -- its board on the server (/api/solo/minesweeper), which keeps the record when it is cleared
  mines: { title: '지뢰찾기', games: [mines], info: '/api/solo/minesweeper', records: (got) => ({ ...got, records: { mines: got.records || {} } }) },
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

export function mount({ api, onBack, pieceSkin = null }) {
  const view = document.getElementById('reflexView');
  const frame = view.querySelector('.reflexFrame');
  const menu = document.getElementById('reflexMenu');
  const result = document.getElementById('reflexResult');
  let set = SETS.reflex; let info = null; let game = null; let runId = null; let shown = 'list'; let startSeq = 0;
  let direct = false; let questMode = false; let launch = null; // launch: { place, goal, level, resolve } of a play() call
  let runLevel = null; // the level the round was started at (kept for its result: Codex review)
  let contestPlay = null; // (v1.10.238: { level, end, offset } while the tent's contest game is open)
  const contestTag = document.createElement('div'); contestTag.className = 'reflexContestTag hidden'; frame.append(contestTag); let contestTimer = null;
  function paintContest() {
    clearInterval(contestTimer); contestTag.classList.toggle('hidden', !contestPlay); if (!contestPlay) return;
    const draw = () => { const s = Math.max(0, Math.ceil((contestPlay.end - (Date.now() + contestPlay.offset)) / 1000)); contestTag.textContent = s > 0 ? `🏆 대회 · 남은 ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '🏆 대회 끝'; };
    draw(); contestTimer = setInterval(draw, 1000);
  }
  const levels = {}; // game id -> the level last played
  try { Object.assign(levels, JSON.parse(localStorage.getItem('gc.reflexLevels') || '{}')); } catch {}

  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const button = (cls, text, onClick) => { const b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  const levelOf = (g) => (contestPlay ? contestPlay.level : launch?.level && launch.place === 'quest' ? launch.level : g.levels || g.mode === 'versus' ? levels[g.id] || g.defaultLevel || 'normal' : 'normal');
  const optionOf = (g, o) => (o.items.some(([v]) => v === levels[`${g.id}.${o.id}`]) ? levels[`${g.id}.${o.id}`] : o.def);
  const optionsOf = (g) => Object.fromEntries((g.options || []).map((o) => [o.id, optionOf(g, o)]));
  const modeOf = (g) => (launch?.place === 'quest' && optionsOf(g).mode ? 'daily' : optionsOf(g).mode ?? null); // the puzzles: 오늘의 문제 (daily) or 새 문제 (A2b: a quest's round is always the daily)
  const remember = (key, value) => { levels[key] = value; try { localStorage.setItem('gc.reflexLevels', JSON.stringify(levels)); } catch {} };
  const bestOf = (g) => info?.records?.[g.id]?.[levelOf(g)]?.best ?? null;

  function head(title, back) {
    const top = el('div', 'reflexHead');
    top.append(direct ? button('ghost tiny', questMode ? '‹ 섬으로' : '‹ 게임관', goBack) : button('ghost tiny', back ? '‹ 목록' : '‹ 뒤로', back ? showList : goBack), el('strong', null, contestPlay ? `🏆 대회 · ${title}` : title));
    const sound = button('ghost tiny reflexSound', '', () => { Settings.toggle('sound'); paintSound(); });
    const paintSound = () => { const on = Settings.get('sound'); sound.textContent = on ? '🔊 효과음' : '🔇 효과음'; sound.setAttribute('aria-pressed', String(on)); };
    paintSound();
    top.append(sound);
    return top;
  }
  function todayLine() { // (G-포인트: no points a round -- my best is kept)
    return el('p', 'reflexToday', set === SETS.ai ? '연습 · 기록 없음' : set === SETS.puzzle ? '오늘의 문제는 처음 푼 기록이 남아요' : '내 최고 기록이 남아요');
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

  // v1.10.243 U1: a game's choices as the game hall's sheet shows them -- the level (or the AI's) and each option, the one
  // chosen marked; key 'level' or the option's id
  function choicesOf(g) {
    const out = [];
    if (g.levels || g.mode === 'versus') out.push({ key: 'level', title: g.mode === 'versus' ? 'AI 난이도' : g.levelTitle || '난이도', value: levelOf(g), items: (g.levelIds || ['easy', 'normal', 'hard']).map((id) => [id, g.levelNames?.[id] || (g.mode === 'versus' ? `AI ${LEVEL_NAMES[id]}` : LEVEL_NAMES[id])]) });
    for (const o of (g.levels || g.mode === 'versus') ? g.options || [] : []) out.push({ key: o.id, title: o.title, value: optionOf(g, o), items: o.items });
    return out;
  }
  const gameById = (id) => Object.values(SETS).flatMap((s) => s.games).find((g) => g.id === id) || null;
  const setOf = (g) => Object.values(SETS).find((s) => s.games.includes(g));
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
        const b = button('reflexLevel', g.levelNames?.[id] || label, () => { remember(g.id, id); showGame(g); });
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
    }
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
    let id = null; let seed = null; let board = null;
    const skin = set === SETS.ai ? await pieceSkin?.(g.id) : null; // (A3 G3-2)
    try {
      const contest = contestPlay ? { contest: true } : {}; // (v1.10.238: the tent's round)
      if (set === SETS.reflex) id = (await api('/api/solo/reflex/start', { method: 'POST', body: JSON.stringify({ game: g.id, level, ...contest }) })).id;
      else if (set === SETS.cards) ({ id, seed } = await api('/api/solo/cards/start', { method: 'POST', body: JSON.stringify({ game: g.id, level, ...contest }) }));
      else if (set === SETS.mines) { const n = await api('/api/solo/minesweeper/new', { method: 'POST', body: JSON.stringify({ level }) }); board = { minesId: n.id, minesView: n.view, api }; }
      else if (mode === 'daily') await api('/api/solo/puzzle/start', { method: 'POST', body: JSON.stringify({ game: g.id, level }) });
    } catch (error) { if (seq === startSeq) { status.textContent = error.message; menu.classList.remove('hidden'); } return; } /* (U1: started from the sheet -- the menu shows why) */
    if (seq !== startSeq || view.classList.contains('hidden')) return;
    runId = id; runLevel = level; shown = 'play'; game = g;
    frame.classList.toggle('wideFrame', set === SETS.cards || set === SETS.puzzle || set === SETS.mines || g.id === 'stairs'); // A3 G4: the card games and puzzles use a PC's width (game.css); R7 하늘 계단 its sky too (PC·휴대폰 같게)
    menu.classList.add('hidden'); result.classList.add('hidden'); frame.classList.add('playing');
    E.onEnd = (r) => finish(g, r);
    if (set === SETS.cards) { noteActions(g); cardLog = []; } else cardLog = null;
    startGame(g, { best: bestOf(g), level, opts: { ...optionsOf(g), ...(mode ? { mode } : {}), ...(seed != null ? { seed } : {}), ...(skin ? { pieceSkin: skin } : {}), ...board } });
  }

  async function finish(g, r) {
    frame.classList.remove('playing');
    shown = 'result';
    const id = runId; runId = null;
    const log = cardLog; cardLog = null;
    const score = r.score == null ? null : Math.round(r.score); // a practice puzzle has none
    // the 게임 실행 규약's answer: an AI game is done when won; otherwise the goal reached (a time: at most the goal)
    const level = runLevel ?? levelOf(g);
    settle({ game: g.id, level, score, outcome: r.outcome, run: id,
      done: g.mode === 'versus' ? r.outcome === 'win' : launch?.goal == null || (score != null && (g.lowerBetter ? score <= launch.goal : score >= launch.goal)) });
    const box = el('div', 'hpPanel reflexBox'); // (v1.10.245 U3: the one result panel -- its pill, the title, the big figure)
    box.style.setProperty('--c1', g.color);
    const pill = r.outcome === 'win' ? ['win', '승리'] : r.outcome === 'loss' || (set === SETS.mines && score == null) ? ['loss', '패배'] : r.outcome === 'draw' ? ['draw', '무승부'] : ['done', '완성'];
    box.append(el('span', `hpPanelPill ${pill[0]}`, pill[1]), el('h2', null, r.title || g.name));
    if (score != null) box.append(el('p', 'reflexScore', fmtScore(score, g.unit)));
    const line = el('p', 'reflexPaid', (set === SETS.reflex || set === SETS.cards || r.proof) ? '기록 확인 중…' : '');
    box.append(line);
    if (r.stats?.length) {
      const stats = el('div', 'reflexStats');
      for (const [k, v] of r.stats) { const s = el('div', 'reflexStat'); s.append(el('b', null, String(v)), el('span', null, k)); stats.append(s); }
      box.append(stats);
    }
    const again = button('hpBtn go', '다시 하기', () => start(g, line));
    box.append(el('div', 'reflexActions'));
    box.lastChild.append(again, button('hpBtn', direct ? (questMode ? '섬으로' : '게임관으로') : '다른 게임', () => { if (direct) { goBack(); return; } stopGame(); showList(); menu.classList.remove('hidden'); result.classList.add('hidden'); }));
    result.replaceChildren(box); result.classList.remove('hidden');
    again.focus();
    if (set === SETS.puzzle) return r.proof && sendPuzzle(g, level, score, r.proof, line, r.rec);
    if (set === SETS.cards) return sendCards(g, level, id, log, line);
    if (set === SETS.ai) return; // practice: not sent
    if (set === SETS.mines) { // (G4: the server kept it with the clearing press -- its answer)
      const out = score == null ? null : g.result;
      if (out && info) (info.records[g.id] ||= {})[level] = { best: out.best };
      if (out?.newBest) sfx.best();
      line.textContent = out ? (out.newBest ? '최고 기록!' : `최고 ${fmtScore(out.best, g.unit)}`) + weekLine(out) : '';
      return;
    }
    try {
      const out = await api('/api/solo/reflex/finish', { method: 'POST', body: JSON.stringify({ id, score }) });
      if (info) (info.records[g.id] ||= {})[level] = { best: out.best };
      if (out.newBest) sfx.best();
      line.textContent = (contestPlay ? contestSaid(out, g) : out.newBest ? '최고 기록!' : `최고 ${fmtScore(out.best, g.unit)}`) + weekLine(out);
    } catch (error) { line.textContent = error.message; }
  }
  const weekLine = (out) => (out?.weekRank ? ` · 이번 주 ${out.weekRank}위` : ''); // (v1.10.250 기록의 탑)

  // v1.10.70 (Codex review): puzzle-kit writes a solved 오늘의 문제 into this account's 보낼 기록함 (js/outbox.js) before it
  // marks the day done; it leaves the box once the server has answered for good, so a failed send goes again next time
  const settled = (error) => error.status && error.status < 500 && error.status !== 429;
  async function sendPuzzle(g, level, score, proof, line, rec) { // 오늘의 문제, solved for the first time on this device
    try {
      const out = await api('/api/solo/puzzle/finish', { method: 'POST', body: JSON.stringify({ game: g.id, level, score, proof }) });
      if (rec) dropRecord(Stats.uid, rec.rid);
      if (info && out.best != null) (info.records[g.id] ||= {})[level] = { best: out.best };
      if (out.newBest) sfx.best();
      line.textContent = (out.newBest ? '최고 기록!' : out.already ? '오늘의 문제는 이미 기록했어요' : '기록했어요') + weekLine(out);
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

  const contestSaid = (out, g) => (out.contest ? `대회 기록 ${fmtScore(out.contest.score, g.unit)} · 지금 ${out.contest.rank}위` : '이 판은 대회 기록이 되지 않았어요');
  async function sendCards(g, level, id, log, line) { // a cleared deal: the server plays it again before it keeps it
    if (log.length > LOG_MAX) { line.textContent = '너무 긴 판이라 기록하지 못했어요'; return; }
    try {
      const out = await api('/api/solo/cards/finish', { method: 'POST', body: JSON.stringify({ id, log: log.join(';') }) });
      if (info) (info.records[g.id] ||= {})[level] = { best: out.best };
      if (out.newBest) sfx.best();
      line.textContent = (contestPlay ? contestSaid(out, g) : out.newBest ? '최고 기록!' : '기록했어요') + weekLine(out);
    } catch (error) { line.textContent = error.message; }
  }

  function quit() { // a round left before its end: not reported, so not paid
    if (direct) { goBack(); return; } // v1.10.80: a quest's round left -- straight back to the island (v1.10.243 U1: the hall's too, to its sheet's hall)
    stopGame(); runId = null; frame.classList.remove('playing');
    result.classList.add('hidden'); menu.classList.remove('hidden');
    showGame(game);
  }
  function goBack() { stop(); contestPlay = null; paintContest(); settle({ game: game?.id ?? null, done: false }); onBack(); } // to choosing a game
  function settle(out) { const l = launch; if (!l) return; launch = null; l.resolve(out); }
  function stop() { stopGame(); runId = null; cardLog = null; startSeq += 1; frame.classList.remove('playing', 'wideFrame'); }

  document.getElementById('reflexQuitBtn').addEventListener('click', quit);
  document.addEventListener('keydown', (event) => {
    if (view.classList.contains('hidden') || event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    if (shown === 'play' && set === SETS.puzzle) return; // a puzzle's own Esc closes its hint (✕ leaves it)
    event.preventDefault();
    if (shown === 'play') quit();
    else if (shown === 'result' && direct) goBack();
    else if (shown === 'result') { stopGame(); result.classList.add('hidden'); menu.classList.remove('hidden'); showGame(game); }
    else if (shown === 'game') { if (direct) goBack(); else showList(); }
    else goBack();
  });

  return {
    async open(which = 'reflex', gameId = null) {
      stop(); result.classList.add('hidden'); menu.classList.remove('hidden');
      set = SETS[which] || SETS.reflex; info = null;
      const one = set.games.find((g) => g.id === gameId); direct = Boolean(one);
      if (one) showGame(one); else showList();
      // a play() on one game starts at once once the info is in -- a quest's or the tent's at its own level, the hall's at what its
      // sheet chose (v1.10.243 U1: the sheet the one start screen; this menu stays for the classic lobby's lists)
      const quest = Boolean(one && launch);
      contestPlay = quest && launch.place === 'contest' ? { level: launch.level, end: launch.contest?.end ?? 0, offset: launch.contest?.offset ?? 0 } : null; paintContest();
      questMode = quest && (launch.place === 'quest' || launch.place === 'contest'); if (quest) { showGame(one); menu.classList.add('hidden'); } // (v1.10.80: its way back says 섬으로)
      const go = () => start(one, menu.querySelector('.reflexStatus'));
      try { // the list is usable meanwhile: redraw only what still shows (Codex review)
        if (!set.info) { if (quest) go(); return; }
        const want = set; const got = await api(set.info);
        if (want !== set) return; // opened the other set meanwhile
        info = set.records ? set.records(got) : got;
        if (set === SETS.puzzle) { Stats.load(info.uid); resendPuzzles(); } // this account's own progress (Codex review)
        if (quest) { go(); return; }
        if (shown === 'list') showList(); else if (shown === 'game') showGame(game);
      } catch (error) { menu.append(el('p', 'reflexStatus', error.message)); if (quest) settle({ game: one.id, done: false }); }
    },
    stop,
    // (U1) the sheet's: a game's choices, one picked, my best at the chosen level (null: none, or not a recorded game)
    choices(gameId) { const g = gameById(gameId); return g ? choicesOf(g) : null; },
    choose(gameId, key, value) { remember(key === 'level' ? gameId : `${gameId}.${key}`, value); },
    async best(gameId) {
      const g = gameById(gameId); const s = g && setOf(g); if (!s?.info) return null;
      const got = await api(s.info); const b = (s.records ? s.records(got) : got)?.records?.[g.id]?.[levelOf(g)]?.best;
      return b == null ? '아직 기록 없음' : `내 최고 ${fmtScore(b, g.unit)}`;
    },
    // the 게임 실행 규약 (above): which set holds the game, opened on it; the answer comes when its round ends
    play(gameId, { level = null, goal = null, place = 'gamehall', contest = null } = {}) {
      const which = Object.keys(SETS).find((k) => SETS[k].games.some((g) => g.id === gameId));
      if (!which) return Promise.reject(new Error(`unknown game ${gameId}`));
      settle({ game: gameId, done: false }); // a play still waiting is over
      return new Promise((resolve) => { launch = { place, goal, level, contest, resolve }; this.open(which, gameId); });
    },
  };
}
