// v1.10.259 대어 줄다리기 (gamecenter-notes docs/fishing-minigames-20261104.md 3절): after the bite's game a big one pulls --
// hold to reel in (the line shortens, the tension climbs), let go to ease it (the tension falls, the fish takes a little line);
// while it fights (the server's plan: when, how long, how hard) holding drives the tension up several times faster. 100 m of
// line to 0: caught; the tension at 100: the line snaps; 25 s: it got away. The page and the server run this same code --
// the page to draw it, the server to judge the holds it was sent (from its own clock: the 「대어다!」 it told).
// Works in the browser (window.FishTug) and in node (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FishTug = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const DIST = 100; const LIMIT_MS = 25000; const STEP_MS = 50; const LATE_MS = 700;
  const REEL = 10; const PULL = 3; const SLACK = 1.5; const UP = 6; const DOWN = 40; // (per second; REEL less, the rest more, the stronger the fish)
  // the eleven big ones' strength (heavier, stronger): 왕메기·대왕오징어 the strongest, 황금 잉어 the weakest (the unit test's
  // simulation holds a standard player to 10~20 s)
  const STRENGTH = Object.freeze({ golden_carp: 0.85, snakehead: 0.9, salmon: 0.92, sunfish: 0.95, taimen: 1.0, dotdom: 1.02, sturgeon: 1.05, giant_octopus: 1.07, giant_tuna: 1.1, king_catfish: 1.12, giant_squid: 1.12 });
  const strengthOf = (species) => STRENGTH[species] || 1;
  // the fish's fights: from 0.8 s, every 1~2.6 s after the last one ends, 0.6~1.4 s long, 5~7 times the tension
  function plan(species, random = Math.random) {
    const fights = []; let at = 800;
    while (at < LIMIT_MS) { const len = 600 + Math.floor(random() * 800); fights.push({ at, len, force: Math.round((5 + random() * 2) * 100) / 100 }); at += len + 1000 + Math.floor(random() * 1600); }
    return { species, s: strengthOf(species), fights };
  }
  const fightAt = (p, ms) => p.fights.find((f) => ms >= f.at && ms < f.at + f.len) || null;
  // holds: [[down, up], ...] ms from the 「대어다!」, in order, not overlapping (up null: still held); true if held at ms
  const heldAt = (holds, ms) => holds.some(([d, u]) => ms >= d && (u == null || ms < u));
  function valid(holds) {
    if (!Array.isArray(holds) || holds.length > 400) return false; let last = -1;
    for (const h of holds) { if (!Array.isArray(h) || h.length !== 2) return false; const [d, u] = h; if (!Number.isFinite(d) || d < last || d > LIMIT_MS || (u != null && (!Number.isFinite(u) || u < d))) return false; last = u ?? Infinity; }
    return true;
  }
  // one step of dt ms: { dist, tension }
  function step(p, st, held, ms, dt) {
    const f = fightAt(p, ms); const s = p.s; const k = dt / 1000;
    if (held) { st.dist -= (REEL / s) * k; st.tension += UP * s * (f ? f.force : 1) * k; }
    else { st.dist += (f ? PULL * s : SLACK * s) * k; st.tension -= DOWN * k; }
    st.dist = Math.min(DIST, st.dist); st.tension = Math.max(0, st.tension);
    return st;
  }
  // from the start to `until` ms (or the end): 'caught' | 'snap' | 'escaped' | 'on' (still going), when, and where it stands
  function run(p, holds, until = LIMIT_MS) {
    const st = { dist: DIST, tension: 0 };
    for (let ms = 0; ms < Math.min(until, LIMIT_MS); ms += STEP_MS) {
      step(p, st, heldAt(holds, ms), ms, STEP_MS);
      if (st.dist <= 0) return { end: 'caught', t: ms + STEP_MS, ...st, dist: 0 };
      if (st.tension >= 100) return { end: 'snap', t: ms + STEP_MS, ...st, tension: 100 };
    }
    return until >= LIMIT_MS ? { end: 'escaped', t: LIMIT_MS, ...st } : { end: 'on', t: until, ...st };
  }
  // the server's verdict on the holds sent: arrivedMs -- the request's arrival from the 「대어다!」 on its clock. A catch claimed
  // later than the request came (less the network's share) is a made-up one; holds out of order or past the limit too
  function judge(p, holds, arrivedMs) {
    if (!valid(holds)) return { end: 'bad' };
    const r = run(p, holds);
    if (r.end !== 'escaped' && r.t > arrivedMs + LATE_MS) return { end: 'bad', t: r.t };
    return r;
  }
  const fastestMs = (p) => Math.ceil((DIST / (REEL / p.s)) * 1000); // (always reeling: the least a catch takes)
  // v1.10.259 타이밍 막대 (fishing-minigames 2절, the bite's other game, half the casts): a needle runs left to right and back
  // (one period), a green zone on the bar -- pressed while the needle is in it, a hit (±40 ms at its edges); every hit moves
  // the zone to the server's next place, a miss starts it over. Done when the grade's hits are in, within hits x period x 2
  // + 1.5 s -- and never sooner than hits x period / 2 (a made-up row: 서버 확인 1)
  const TIMING = Object.freeze({ common: { hits: 2, zone: 0.24, period: 1400 }, normal: { hits: 3, zone: 0.2, period: 1200 }, rare: { hits: 4, zone: 0.16, period: 1000 }, big: { hits: 5, zone: 0.14, period: 900 } });
  const EDGE_MS = 40;
  const timingMs = (t) => t.hits * t.period * 2 + 1500;
  const timingFloor = (t) => (t.hits * t.period) / 2;
  const needleAt = (period, ms) => { const f = (Math.max(0, ms) / period) % 1; return f < 0.5 ? f * 2 : 2 - f * 2; }; // (0 -> 1 -> 0)
  const inZone = (t, at, ms) => [ms - EDGE_MS, ms, ms + EDGE_MS].some((m) => { const x = needleAt(t.period, m); return x >= at && x <= at + t.zone; });
  // presses: [{ t }] ms from the bar's showing, every one, a miss too -> 'ok' | 'late' | 'wrong'
  function judgeTiming(t, presses, slack = 0) {
    if (!t || !Array.isArray(presses) || presses.length > 100) return 'wrong';
    let hit = 0; let last = -1;
    for (const p of presses) {
      const ms = Number(p?.t); if (!Number.isFinite(ms) || ms < last) return 'wrong'; last = ms;
      if (!inZone(t, t.zones[hit], ms)) { hit = 0; continue; }
      if ((hit += 1) === t.hits) { if (ms < timingFloor(t)) { hit -= 1; continue; } return ms <= timingMs(t) + slack ? 'ok' : 'late'; } // (the last one too soon: not yet -- the next pass; the page the same)
    }
    return 'wrong';
  }
  return { DIST, LIMIT_MS, STEP_MS, LATE_MS, STRENGTH, strengthOf, plan, fightAt, heldAt, valid, step, run, judge, fastestMs, TIMING, EDGE_MS, timingMs, timingFloor, needleAt, inZone, judgeTiming };
});
