'use strict';

const Npcs = require('../public/plaza/island-npcs');

// Event ownership is server-wide, but movement still uses the same seeded rounds as the browser.
// Delaying the resident's round by the actual pause preserves its position when a request ends.
// A-6 주민 대화 (사용자 2026-10-19 「대화할 동안은 멈춰 있어야 해」): a talk holds its resident too, as 'talk:<plazaId>',
// while the talk window is open -- the browser renews it (TALK_LEASE); a window closed, a walk away or a dropped connection
// lets it go, and it never holds past TALK_MAX.
const TALK_LEASE = 12000; const TALK_MAX = 180000; const TALK_BACK_MAX = 5000;
// (v1.10.215 근무표 C1: `working(n)` -- at a counter today, never held for an event)
function createIslandResidents({ now = Date.now, random = Math.random, isSafe = () => true, working = () => false } = {}) {
  const delays = Array(Npcs.COUNT).fill(0);
  const held = new Map();
  function flush() {
    const t = now();
    for (const [n, h] of held) {
      if (h.releaseAt === null && h.lease != null && h.lease <= t) h.releaseAt = h.lease;
      if (h.releaseAt !== null && h.releaseAt <= t) {
        delays[n] += Math.max(0, h.releaseAt - h.startedAt);
        held.delete(n);
      }
    }
  }
  const copy = (h) => h ? { eventId: h.eventId, x: h.x, z: h.z, yaw: h.yaw, returning: h.releaseAt !== null, ...(h.arriveAt ? { arriveAt: h.arriveAt } : {}) } : null;
  function snapshot() {
    flush();
    return delays.map((delay, n) => ({ n, delay, hold: copy(held.get(n)) }));
  }
  // (v1.10.274 사진 부탁: `to(from, n)` -- a place to walk to from where they are, { x, z, yaw, arriveAt } or null; the screens
  // walk them there on the route grid. `skip(n)`: not this one, e.g. asked already today)
  function reserve(eventId, away = null, { to = null, skip = null } = {}) {
    if (typeof eventId !== 'string' || !eventId) throw new TypeError('Invalid resident event');
    flush();
    for (const [n, h] of held) if (h.eventId === eventId) return { n, ...copy(h) };
    const t = now();
    const first = Math.floor(random() * Npcs.COUNT) % Npcs.COUNT;
    for (let k = 0; k < Npcs.COUNT; k += 1) {
      const n = (first + k) % Npcs.COUNT;
      if (held.has(n) || working(n) || skip?.(n)) continue;
      const from = Npcs.at(n, t - delays[n]); const p = to ? to(from, n) : from; if (!p) continue;
      if (!to && !isSafe(p.x, p.z, away)) continue;
      if ([...held.values()].some(h => Math.hypot(p.x-h.x,p.z-h.z) < Npcs.WALKER.SEP)) continue;
      const h = { eventId, startedAt: t, releaseAt: null, x: p.x, z: p.z, yaw: p.yaw, ...(p.arriveAt ? { arriveAt: p.arriveAt, path: p.path || null } : {}) };
      held.set(n, h);
      return { n, ...copy(h) };
    }
    return null; // wait for a safe resident; never spawn an extra character or teleport one.
  }
  function release(eventId, handoverMs = 0) {
    flush();
    for (const h of held.values()) if (h.eventId === eventId) {
      if (h.releaseAt === null) h.releaseAt = now() + Math.max(0, handoverMs);
      flush();
      return true;
    }
    return false;
  }
  // who ('talk:<plazaId>') talks to n, facing yaw: held (or renewed) -> { ok: true }; another's -> { busy: their eventId }.
  // backMs: the talker reached them where they were that long ago (a slow screen draws a walker behind its round) -- held
  // there, the pause counted from then (CI 2026-10-27: held where they were now, up to 5 m on, the talker was past the keep's
  // reach and the window shut at the first renewal)
  function talk(n, who, yaw, backMs = 0) {
    flush();
    const t = now(); const h = held.get(n);
    if (h && h.eventId !== who) return { busy: h.eventId };
    if (h) { h.releaseAt = null; h.lease = Math.min(t + TALK_LEASE, h.startedAt + TALK_MAX); return { ok: true }; }
    release(who); // one talk at a time
    const from = t - Math.max(0, Math.min(Number(backMs) || 0, TALK_BACK_MAX)); const p = Npcs.at(n, from - delays[n]);
    held.set(n, { eventId: who, startedAt: from, releaseAt: null, lease: t + TALK_LEASE, x: p.x, z: p.z, yaw: Number.isFinite(yaw) ? yaw : p.yaw });
    return { ok: true };
  }
  // the open window's renewal: only a hold still mine (one let go -- closed, too long -- is not taken again by it)
  function keep(n, who) { flush(); const h = held.get(n); if (!h || h.eventId !== who || h.releaseAt !== null) return false; h.lease = Math.min(now() + TALK_LEASE, h.startedAt + TALK_MAX); return true; }
  const talkOf = (who) => { flush(); for (const [n, h] of held) if (h.eventId === who && h.releaseAt === null) return n; return null; };
  // (v1.10.274 총괄: one walking to a photo spot talks on the way without stopping -- where they are on that walk now, as the
  // screens walk them (at most a jog along the same grid's way); null when n is not on such a walk)
  function walkAt(n, ms) {
    flush(); const h = held.get(n); if (!h?.path || !(h.arriveAt > ms) || h.releaseAt !== null) return null;
    let left = Math.max(0, ms - h.startedAt) / 1000 * Npcs.WALKER.TOP;
    for (let i = 1; i < h.path.length; i += 1) { const a = h.path[i - 1]; const b = h.path[i]; const len = Math.hypot(b.x - a.x, b.z - a.z); if (left <= len) { const k = len ? left / len : 0; return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: Math.atan2(b.x - a.x, b.z - a.z) }; } left -= len; }
    return { x: h.x, z: h.z, yaw: h.yaw };
  }
  return { reserve, release, snapshot, talk, keep, talkOf, walkAt };
}

module.exports = { createIslandResidents, TALK_LEASE, TALK_MAX };
