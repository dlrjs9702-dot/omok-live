// A plain greedy player for 1장 넘기기 클론다이크 (test only): plays the page's own game objects and writes the page's
// action log — including the game's own moves up at the end (its update() 마무리), noted as 'a' as the page notes them.
import { GAMES, E, startGame } from '../lib/card-worker.mjs';

export function playKlondike(seed) {
  const g = GAMES.klondike; const log = [];
  startGame(g, { level: 'easy', opts: { seed } });
  const T = g._T; const tabs = () => T.piles.filter((p) => p.kind === 'tab'); const founds = () => T.piles.filter((p) => p.kind === 'found');
  let idle = 0;
  for (let step = 0; step < 3000 && E.state === 'play'; step += 1) {
    if (g._s.auto) { // as update(): the smallest card that can go up, one at a time
      let pick = null;
      for (const p of tabs()) { const top = p.cards[p.cards.length - 1]; if (!top) continue; const f = founds().find((q) => g.canDrop([top], q)); if (f && (!pick || top.r < pick.cd.r)) pick = { p, f, cd: top }; }
      if (!pick) break;
      log.push(`a,${pick.p.id},${pick.p.cards.length - 1},${pick.f.id}`);
      T.move(pick.p, pick.p.cards.length - 1, pick.f); g._s.moves++;
      if (founds().every((f) => f.cards.length === 13)) g.win();
      continue;
    }
    let move = null;
    const srcs = [T.get('waste'), ...tabs()];
    for (const p of srcs) { const top = p.cards[p.cards.length - 1]; if (!top) continue; const f = founds().find((q) => g.canDrop([top], q)); if (f) { move = [p, p.cards.length - 1, f]; break; } }
    if (!move) for (const p of tabs()) { // a run that uncovers a face-down card or empties a column for a K
      const i0 = p.cards.findIndex((c) => c.up); if (i0 < 0) continue;
      if (i0 === 0 && p.cards[0].r === 13) continue;
      const q = tabs().find((t) => t !== p && g.canDrop(p.cards.slice(i0), t) && (t.cards.length || p.cards[i0].r === 13));
      if (q) { move = [p, i0, q]; break; }
    }
    if (!move) { const w = T.get('waste'); const top = w.cards[w.cards.length - 1]; const q = top && tabs().find((t) => g.canDrop([top], t)); if (q) move = [w, w.cards.length - 1, q]; }
    if (move) { log.push(`m,${move[0].id},${move[1]},${move[2].id}`); g.doMove(...move); idle = 0; continue; }
    if (++idle > 60) break; // turned the whole stock over and over without a move
    log.push('f'); g.flip();
  }
  return { won: E.state === 'ending', log: log.join(';') };
}
