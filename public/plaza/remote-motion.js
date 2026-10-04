// v1.10.8 타인 캐릭터 이동 자연화: how someone else's character moves on my screen. Their poses arrive about every
// 150 ms, stamped with the server time each pose was taken (`t`). A track keeps the last second of them and draws the
// character a little in the past (DELAY), between two real poses, so the path and its speed stay even however the
// updates bunch up on the way. Past the newest pose it keeps walking the same way for a moment (a short gap in the
// updates) and then stops. A follower turns that into what is drawn: a new pose that changes the path is blended in
// -- slowly when the difference is small, quickly when it is larger, at once for a warp -- and the drawn speed picks
// the walk. Shared by the browser (plaza-scene.js) and, later, people walking about the island; no Three.js here.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RemoteMotion = api;
}(typeof self !== 'undefined' ? self : this, () => {
  // How far behind the newest pose to draw: the spread of the delivery delays seen lately (the server's 150 ms ticks
  // against the 125 ms poses, plus the network), and a little more -- between MIN_DELAY and MAX_DELAY.
  const MIN_DELAY = 120; const MAX_DELAY = 360; const DELAY = 240;
  const COAST = 220; // ms of walking on at the same pace past the newest pose (a late update) ...
  const EXTRAPOLATE = 400; // ... then slowing to a stop by this many ms past it
  const KEEP = 1500; // ms of poses kept
  const WARP = 6; // a step this long between two poses is a warp (a reconnect, a server move), never a glide
  const SMALL = 0.3; const LARGE = 2.5; // follower: below SMALL drift in slowly, up to LARGE quickly, beyond that at once

  function createTrack() {
    const poses = []; // { t, x, z, yaw, moving }, oldest first
    let offset = null; // my clock minus the server's, the smallest seen (the quickest delivery)
    let spread = DELAY - 40; // how much later than the quickest a delivery has come lately (ms)
    let want = DELAY; let behind = null; let lastAt = null; // how far behind the server clock I draw; eased, never a jump
    function push(pose, localNow) {
      if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return false;
      const t = Number.isFinite(pose.t) ? pose.t : localNow - (offset ?? 0);
      const last = poses[poses.length - 1];
      if (last && t <= last.t) return false; // the same pose again (a snapshot about someone else), or an old one
      offset = offset == null ? localNow - t : Math.min(offset, localNow - t);
      const late = localNow - t - offset;
      spread = late > spread ? late : spread + (late - spread) * 0.004; // up at once, down slowly (over many seconds)
      want = Math.max(MIN_DELAY, Math.min(MAX_DELAY, spread + 60));
      poses.push({ t, x: pose.x, z: pose.z, yaw: Number(pose.yaw) || 0, moving: Boolean(pose.moving) });
      while (poses.length > 2 && poses[1].t < t - KEEP) poses.shift();
      return true;
    }
    // Where the character is at my time `localNow`: { x, z, yaw, moving }.
    function at(localNow) {
      if (!poses.length) return null;
      const passed = lastAt == null ? 0 : Math.max(0, localNow - lastAt); lastAt = localNow;
      const goal = (offset ?? 0) + want;
      if (behind == null) behind = goal;
      const room = passed * 0.12; // the drawn clock runs at most 12% slower or faster while it settles
      behind += Math.max(-room, Math.min(room, goal - behind));
      const rt = localNow - behind;
      const first = poses[0]; const last = poses[poses.length - 1];
      if (rt <= first.t) return { ...first };
      if (rt >= last.t) {
        const prev = poses[poses.length - 2];
        if (!last.moving || !prev || last.t - prev.t <= 0 || last.t - prev.t > 600) return { ...last };
        const dx = last.x - prev.x; const dz = last.z - prev.z;
        if (Math.hypot(dx, dz) > WARP) return { ...last };
        const span = last.t - prev.t; const over = rt - last.t; const R = EXTRAPOLATE - COAST;
        const o = Math.min(Math.max(0, over - COAST), R);
        const k = (Math.min(over, COAST) + o - (o * o) / (2 * R)) / span; // the same pace, then easing to a stop
        return { x: last.x + dx * k, z: last.z + dz * k, yaw: last.yaw, moving: true };
      }
      let i = poses.length - 2;
      while (i > 0 && poses[i].t > rt) i -= 1;
      const a = poses[i]; const b = poses[i + 1];
      if (Math.hypot(b.x - a.x, b.z - a.z) > WARP) return { ...b };
      const k = (rt - a.t) / (b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: b.yaw, moving: a.moving || b.moving };
    }
    // The newest pose and the speed it was walking at (units/s), for collision look-ahead.
    function latest() {
      const last = poses[poses.length - 1]; const prev = poses[poses.length - 2];
      if (!last) return null;
      const span = prev ? (last.t - prev.t) / 1000 : 0;
      const vel = last.moving && span > 0.02 && span < 1 ? { x: (last.x - prev.x) / span, z: (last.z - prev.z) / span } : { x: 0, z: 0 };
      return { ...last, vel };
    }
    return { push, at, latest, size: () => poses.length, delay: () => (behind ?? 0) - (offset ?? 0) };
  }

  // What is drawn: the track's point, plus an error that fades out. While the track moves at walking pace the drawing
  // is exactly on it (no lag); when it jumps further than anyone walks in a frame (a new pose changed the path), the
  // extra becomes the error -- absorbed slowly when small, quickly when larger, dropped at once beyond LARGE (a warp).
  function createFollower({ maxSpeed = 8 } = {}) {
    const f = { x: 0, z: 0, ex: 0, ez: 0, speed: 0, heading: null, ready: false, tx: 0, tz: 0 };
    f.step = (target, dt) => {
      if (!target) return f;
      const px = f.x; const pz = f.z;
      if (!f.ready) { f.ready = true; f.tx = target.x; f.tz = target.z; f.x = target.x; f.z = target.z; return f; }
      const dx = target.x - f.tx; const dz = target.z - f.tz; const d = Math.hypot(dx, dz);
      f.tx = target.x; f.tz = target.z;
      if (d > WARP) { f.ex = 0; f.ez = 0; f.x = target.x; f.z = target.z; f.speed = 0; return f; }
      const step = maxSpeed * dt + 0.01;
      if (d > step) { const extra = 1 - step / d; f.ex -= dx * extra; f.ez -= dz * extra; } // the jump beyond a walk
      let err = Math.hypot(f.ex, f.ez);
      if (err > LARGE) { f.ex = 0; f.ez = 0; err = 0; }
      if (err > 0) { const keep = Math.exp(-(err < SMALL ? 4 : 12) * dt); f.ex *= keep; f.ez *= keep; if (err * keep < 1e-3) { f.ex = 0; f.ez = 0; } }
      f.x = target.x + f.ex; f.z = target.z + f.ez;
      const moved = Math.hypot(f.x - px, f.z - pz);
      const v = dt > 0 ? moved / dt : 0;
      f.speed += (v - f.speed) * Math.min(1, dt * 10); // the drawn speed, smoothed: it picks idle / walk / run
      if (moved > dt * 0.3) f.heading = Math.atan2(f.x - px, f.z - pz);
      return f;
    };
    // A nudge from outside (kept out of my character): the error takes it, so the next frames do not undo it at once.
    f.nudge = (nx, nz) => { f.ex += nx - f.x; f.ez += nz - f.z; f.x = nx; f.z = nz; };
    return f;
  }

  return { DELAY, MIN_DELAY, MAX_DELAY, COAST, EXTRAPOLATE, WARP, SMALL, LARGE, createTrack, createFollower };
}));
