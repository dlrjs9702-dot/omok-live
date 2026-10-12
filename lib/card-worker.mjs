// v1.10.70 카드 게임 재생 확인 (한판마당 자료 06): the server runs the page's own game code (public/reflex/js — engine,
// cards.js, klondike/freecell/spider) on the same deal (the seed it gave) and plays the round's actions again. A move the
// game would not allow, or a log that does not end in the game's own win, is refused. The browser pieces the engine
// touches (canvas, HUD, window events) are stand-ins that take and return anything; nothing is drawn.
import { isMainThread, parentPort } from 'node:worker_threads';

const any = new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : any), set: () => true, apply: () => any });
Object.assign(globalThis, { document: any, getComputedStyle: () => any, addEventListener() {}, requestAnimationFrame() {}, innerWidth: 420, innerHeight: 800, devicePixelRatio: 1 });
globalThis.window = globalThis;
if (!globalThis.navigator) globalThis.navigator = any; // Node 20 (CI) has none; native.js reads it on load

const { E, startGame } = await import('../public/reflex/js/engine.js');
const GAMES = {
  klondike: (await import('../public/reflex/js/games/klondike.js')).default,
  freecell: (await import('../public/reflex/js/games/freecell.js')).default,
  spider: (await import('../public/reflex/js/games/spider.js')).default,
};

// log: 'm,from,idx,to' (a move the player made) · 'a,from,idx,to' (the game's own move to a foundation) · 'f' (turn the
// stock, 클론다이크) · 'd' (deal a row, 스파이더) · 'u' (undo), joined by ';'. → { won, score } or { error }
export function replayCards({ game, level, seed, log }) {
  const g = GAMES[game];
  if (!g || typeof log !== 'string') return { error: 'bad' };
  startGame(g, { level, opts: { seed } });
  const T = g._T;
  for (const step of log ? log.split(';') : []) {
    if (E.state !== 'play') return { error: 'after the end' };
    const [k, f, i, t] = step.split(',');
    if (k === 'f' && game === 'klondike') g.flip();
    else if (k === 'd' && game === 'spider') g.deal();
    else if (k === 'u') g.undo();
    else if (k === 'm' || k === 'a') {
      const from = T.get(f); const to = T.get(t); const idx = Number(i);
      if (!from || !to || from === to || !Number.isInteger(idx) || idx < 0 || idx >= from.cards.length) return { error: `bad move ${step}` };
      const cards = from.cards.slice(idx);
      const picked = game === 'spider' ? from.kind === 'tab' && g.run(from, idx) : g.canPick(from, idx);
      if (!picked || !g.canDrop(cards, to)) return { error: `illegal move ${step}` };
      if (k === 'm') g.doMove(from, idx, to);
      else { // the game's own move up (클론다이크 마무리 · 프리셀 자동 올리기), exactly as its update() does it
        if (to.kind !== 'found' || cards.length !== 1 || game === 'spider') return { error: `bad auto ${step}` };
        T.move(from, idx, to);
        if (game === 'klondike') { g._s.moves++; if (T.piles.filter((p) => p.kind === 'found').every((p) => p.cards.length === 13)) g.win(); }
        else g.check();
      }
    } else return { error: `bad step ${step}` };
  }
  return E.state === 'ending' ? { won: true, score: E._result?.score ?? null } : { won: false };
}

export { GAMES, E, startGame }; // tests play with them (test/cards-server.test.js)

if (!isMainThread) {
  parentPort.on('message', ({ id, job }) => {
    let out;
    try { out = replayCards(job); } catch (e) { out = { error: String(e) }; }
    parentPort.postMessage({ id, ...out });
  });
}
