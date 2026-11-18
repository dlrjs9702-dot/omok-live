'use strict';
// 364 「막혔을 때」 (user A, 총괄 2026-11-18; notes next-bundle): the nearest free spot round where I am -- at least MIN_R off (where
// I am is where I stuck), out to NEAR_R -- before 대청마당's arrival place as before. `ok(x, z)` says a spot is free (the
// server: standable ground and a free cell of the islanders' walk grid, which keeps off trees, rocks, props, buildings and lots).
const COOLDOWN_MS = 10 * 60 * 1000; // (was 20 s)
const MIN_R = 1.5; const NEAR_R = 15; const STEP = 0.5; const ANGLES = 24;

function nearestFree({ x, z, ok, minR = MIN_R, maxR = NEAR_R, step = STEP, angles = ANGLES }) {
  for (let r = minR; r <= maxR + 1e-9; r += step) {
    for (let k = 0; k < angles; k += 1) {
      const a = (k / angles) * Math.PI * 2; const sx = Math.round((x + Math.cos(a) * r) * 100) / 100; const sz = Math.round((z + Math.sin(a) * r) * 100) / 100;
      if (ok(sx, sz)) return { x: sx, z: sz };
    }
  }
  return null;
}

// minutes still to wait (0: may use it now)
const waitMinutes = (last, now, cooldown = COOLDOWN_MS) => (last && now - last < cooldown ? Math.max(1, Math.ceil((cooldown - (now - last)) / 60000)) : 0);

module.exports = { COOLDOWN_MS, MIN_R, NEAR_R, nearestFree, waitMinutes };
