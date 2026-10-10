'use strict';

const Npcs = require('../public/plaza/island-npcs');

// Event ownership is server-wide, but movement still uses the same seeded rounds as the browser.
// Delaying the resident's round by the actual pause preserves its position when a request ends.
function createIslandResidents({ now = Date.now, random = Math.random, isSafe = () => true } = {}) {
  const delays = Array(Npcs.COUNT).fill(0);
  const held = new Map();
  function flush() {
    const t = now();
    for (const [n, h] of held) {
      if (h.releaseAt !== null && h.releaseAt <= t) {
        delays[n] += Math.max(0, h.releaseAt - h.startedAt);
        held.delete(n);
      }
    }
  }
  const copy = (h) => h ? { eventId: h.eventId, x: h.x, z: h.z, yaw: h.yaw, returning: h.releaseAt !== null } : null;
  function snapshot() {
    flush();
    return delays.map((delay, n) => ({ n, delay, hold: copy(held.get(n)) }));
  }
  function reserve(eventId, away = null) {
    if (typeof eventId !== 'string' || !eventId) throw new TypeError('Invalid resident event');
    flush();
    for (const [n, h] of held) if (h.eventId === eventId) return { n, ...copy(h) };
    const t = now();
    const first = Math.floor(random() * Npcs.COUNT) % Npcs.COUNT;
    for (let k = 0; k < Npcs.COUNT; k += 1) {
      const n = (first + k) % Npcs.COUNT;
      if (held.has(n)) continue;
      const p = Npcs.at(n, t - delays[n]);
      if (!isSafe(p.x, p.z, away)) continue;
      if ([...held.values()].some(h => Math.hypot(p.x-h.x,p.z-h.z) < Npcs.WALKER.SEP)) continue;
      const h = { eventId, startedAt: t, releaseAt: null, x: p.x, z: p.z, yaw: p.yaw };
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
  return { reserve, release, snapshot };
}

module.exports = { createIslandResidents };
