// A plain greedy player for one-suit 스파이더 (test only): plays the page's own game objects (lib/card-worker.mjs) and
// writes the same action log the page sends, so a test has a real won round to replay (test/cards-server.test.js).
import { GAMES, E, startGame } from '../lib/card-worker.mjs';

export function playSpider(seed, level = 'easy') {
  const g = GAMES.spider; const log = []; const seen = new Set();
  startGame(g, { level, opts: { seed } });
  const T = g._T; const tabs = () => T.piles.filter((p) => p.kind === 'tab');
  const key = () => tabs().map((p) => p.cards.map((c) => `${c.r}${c.up ? '' : '?'}`).join('.')).join('|');
  seen.add(key());
  for (let step = 0; step < 3000 && E.state === 'play'; step += 1) {
    let best = null;
    for (const p of tabs()) for (let i = 0; i < p.cards.length; i += 1) {
      if (!g.run(p, i)) continue;
      const cd = p.cards[i]; const par = p.cards[i - 1];
      const parentOk = par && par.up && par.r === cd.r + 1; const parentSame = parentOk && par.s === cd.s; const reveals = par && !par.up;
      for (const q of tabs()) {
        if (q === p) continue;
        const top = q.cards[q.cards.length - 1]; let sc = 0;
        if (!top) sc = i > 0 && !parentOk ? 1 + (reveals ? 2 : 0) : 0;
        else if (top.up && top.r === cd.r + 1) { const same = top.s === cd.s; if (parentSame || (parentOk && !same)) continue; sc = (same ? 5 : 2) + (reveals ? 3 : 0) + (i === 0 ? 1 : 0); }
        if (sc > 0 && (!best || sc > best.sc)) best = { sc, p, i, q };
      }
    }
    if (best) {
      log.push(`m,${best.p.id},${best.i},${best.q.id}`); g.doMove(best.p, best.i, best.q);
      const k = key();
      if (seen.has(k)) { log.push('u'); g.undo(); best = null; } else { seen.add(k); continue; }
    }
    if (!T.get('stock').cards.length || tabs().some((p) => !p.cards.length)) break;
    log.push('d'); g.deal(); seen.add(key());
  }
  return { won: E.state === 'ending', score: E._result?.score, log: log.join(';') };
}
