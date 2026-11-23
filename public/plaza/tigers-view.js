import * as THREE from '/vendor/three/three.module.js';

// 1.10.376 N2a-2 별마루섬 호랑이 (notes island-expansion 「별마루섬 호랑이」; assets 152e; lib/island-tigers.js moves them on the server): the two
// tigers as every screen sees them -- 우레 and 안개 at 1.6x (assets.creature: their own rig and ten clips), loaded only once I come near
// 별마루섬 (their pictures with them), each pose eased toward the server's and its clip played at its pace (a run's no-slide speed), a
// pounce's leap drawn from the same curve the server moves it by (the clip's own forward root motion taken out); 우레 napping on his rock.
// Near one that is awake: its warning -- 우레 from 25 m 「어흥!」 loud, 안개 only from 12 m a low 「그르릉」 -- a sound (the game's sound
// on) and the screen's edges going red. `debug()` for the tests and photos.
const DEFS = {
  ure: { name: '우레', model: 'byeolmaru.tiger', size: 1 /* (383: its paws' spread; 안개 0.82 -- paw 1.73 vs 2.1) */, speed: 13 /* (382 결정 16 A) */, walk: 2.5, run: 10.92, stalk: 0.89, warn: 25, say: '어흥!' }, /* (377: the clips' no-slide paces at 2.4x; 379 speed: the server's run -- the Run played at speed/run) */
  angae: { name: '안개', model: 'byeolmaru.tiger_angae', size: 0.82, speed: 12 /* (382) */, walk: 1.99, run: 8.74, stalk: 0.7, warn: 12, say: '그르릉…' },
};
const PAW_S = 0.84; const RESTING = new Set(['Nap', 'Doze']);
const leapAt = (s, len) => (s <= 0 ? 0 : s >= PAW_S ? len : (len * s) / PAW_S); /* (377: on from the run, as lib/island-tigers.js) */
/* (382 assets 159: the attacks -- once each, into them in 0.1 s; the lunge moved on its curve and the turning swipes turned by theirs, as the server
   (lib/island-tigers.js ATTACKS, turnAt, lungeAt)) */
const ONCE = new Set(['Pounce', 'Swipe', 'TurnSwipe', 'TurnSwipeL', 'Lunge']);
const s01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const TURN = { TurnSwipe: -1, TurnSwipeL: 1 }; const LUNGE = { ure: 1.21, angae: 0.97 };
const turnAt = (kind, s) => (TURN[kind] || 0) * (Math.PI / 2) * s01(0.06, 0.5, s);
const lungeAt = (id, s) => (LUNGE[id] || 0) * s01(0.14, 0.52, s);
const angleTo = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export function createTigerView({ scene, assets, heightAt, serverNow, lowFiles = () => false, T = globalThis.IslandTerrain }) {
  const shown = new Map(); /* id -> { c, s (server state), x, z, yaw } */ let list = []; let warnState = null; let sharedNormal = false;
  const I = T?.dalmaru?.NEW_ISLE; const camp = I?.camp; const peak = I?.peak;
  const inYard = (x, z) => { const P = I?.yard; if (!P) return false; let a = false; for (let i = 0, j = P.length - 1; i < P.length; j = i, i += 1) { const [xi, zi] = P[i]; const [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) a = !a; } return a; }; /* (결정 86: the taxi terminal's fenced yard, as the server's inPoly) */
  const safeAt = (x, z) => Boolean(I) && (Math.hypot(x - camp.x, z - camp.z) < (camp.safe ?? camp.r + 2) || Math.hypot(x - peak.x, z - peak.z) < (peak.safe ?? 14) || inYard(x, z)); /* (1.10.413 S1: the island's `safe`, as the server) */
  const near = (me) => Boolean(I) && Math.hypot(me.x - I.x, me.z - I.z) < I.r + 120;
  function holder(id) {
    const def = DEFS[id]; const c = { root: new THREE.Group(), mixer: null, actions: {}, want: 'Idle', now: null, gone: false, low: lowFiles(), pauseHidden: true /* (383 Codex #18: no mixer work while hidden) */,
      play(name, again = false) { c.want = name; if (!c.mixer) return; inPlace(c); if (c.now === name && !again) return; const next = c.actions[name] || c.actions.Idle; if (!next) return; const once = ONCE.has(name);
        if (c.now === name) { next.stop(); next.reset(); next.setEffectiveWeight(1); next.play(); return; } /* (tiger review #7: the same attack again from its start at full weight -- no 0.1 s of the bind pose between) */
        next.reset(); next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = once; next.fadeIn(name === 'Run' && c.now === 'Stalk' ? 0.35 : once ? 0.1 : 0.2).play(); /* (379 assets 158: into the Pounce in 0.1 s; 382 the attacks too) */ if (c.now !== name) c.actions[c.now]?.fadeOut(0.2); c.now = name; } };
    scene.add(c.root); assets.creature([def.model], c); return c;
  }
  // the Pounce's and the Lunge's forward root motion out (the server's leap and lunge move the tiger); 382 the turning swipes' root turn out (the
  // tiger itself turned by the same curve, so the Idle after never turns it back) -- once a clip
  function inPlace(c) {
    for (const name of ['Pounce', 'Lunge', 'TurnSwipe', 'TurnSwipeL']) {
      const clip = c.actions[name]?.getClip(); if (!clip || clip.userData?.inPlace) continue;
      for (const tr of clip.tracks) {
        if ((name === 'Pounce' || name === 'Lunge') && /(^|\.)Root\.position$/.test(tr.name)) for (let k = 2; k < tr.values.length; k += 3) tr.values[k] = 0;
        if (TURN[name] && /(^|\.)Root\.quaternion$/.test(tr.name)) for (let k = 0; k < tr.values.length; k += 4) { tr.values[k] = 0; tr.values[k + 1] = 0; tr.values[k + 2] = 0; tr.values[k + 3] = 1; }
      }
      clip.userData = { ...(clip.userData || {}), inPlace: true };
    }
  }
  // 152e README 2: 안개's normal map is 우레's (the same bytes) -- one on the graphics card
  function shareNormal() {
    if (sharedNormal) return; const a = shown.get('ure')?.c; const b = shown.get('angae')?.c; if (!a?.mixer || !b?.mixer) return;
    let src = null; a.root.traverse((o) => { if (o.isMesh && o.material?.normalMap && !src) src = o.material.normalMap; }); if (!src) return;
    b.root.traverse((o) => { if (o.isMesh && o.material?.normalMap && o.material.normalMap !== src) { const old = o.material.normalMap; o.material.normalMap = src; o.material.needsUpdate = true; old.dispose(); } });
    sharedNormal = true;
  }
  function set(next) { list = Array.isArray(next) ? next.filter((s) => s && DEFS[s.id] && Number.isFinite(s.x) && Number.isFinite(s.z)) : []; for (const s of list) { const h = shown.get(s.id); if (h) { h.s = s; h.at = performance.now(); } } }
  function step(dt, me, on) {
    const want = on && near(me);
    if (!want) { for (const [, h] of shown) { h.c.root.visible = false; h.runAt = null; /* (383 #18: its Run lined up with the server again when seen) */ } warnState = null; warnUi(null); return; }
    const tNow = serverNow();
    for (const s of list) {
      let h = shown.get(s.id); if (!h) { h = { c: holder(s.id), s, at: performance.now(), x: s.x, z: s.z, yaw: s.yaw }; shown.set(s.id, h); }
      h.c.root.visible = true; const def = DEFS[s.id]; const st = h.s;
      if (st.leap) { const along = leapAt((tNow - st.leap.at) / 1000, st.leap.len); h.x = st.leap.x + Math.sin(st.leap.yaw) * along; h.z = st.leap.z + Math.cos(st.leap.yaw) * along; h.yaw = st.leap.yaw; }
      else if (st.attack) { const a = st.attack; const sec = Math.max(0, (tNow - a.at) / 1000); const along = a.kind === 'Lunge' ? lungeAt(s.id, sec) : 0; h.x = a.x + Math.sin(a.yaw) * along; h.z = a.z + Math.cos(a.yaw) * along; h.yaw = a.yaw + turnAt(a.kind, sec); } /* (382: where the attack began, its own move and turn) */
      else {
        const ahead = Math.min(0.3, (performance.now() - h.at) / 1000) * (st.sp || 0); const tx = st.x + Math.sin(st.yaw) * ahead; const tz = st.z + Math.cos(st.yaw) * ahead;
        if (Math.hypot(tx - h.x, tz - h.z) > 10) { h.x = tx; h.z = tz; } else { const k = 1 - Math.exp(-dt * 8); h.x += (tx - h.x) * k; h.z += (tz - h.z) * k; }
        h.yaw += angleTo(h.yaw, st.yaw) * (1 - Math.exp(-dt * 10));
      }
      { /* (383 사용자 「호랑이들이 비탈에서 너무 허공에 떠있는 티가 나는데」: the ground under its four paws -- the body tilted along the slope (pitch), a
           little across it (roll, at most 8°), eased over a few frames, and set so no paw is in the air; a leap's and a lunge's flight and the nap on
           the rock as they were) */
        const air = Boolean(st.leap) || st.attack?.kind === 'Lunge' || (st.lift || 0) > 0 || RESTING.has(st.clip);
        let y = heightAt(h.x, h.z) + (st.lift || 0); let tp = 0; let tr = 0; const S = def.size || 1; const F = 1.2 * S; const B = 1.15 * S; const W = 0.32 * S;
        const fx = Math.sin(h.yaw); const fz = Math.cos(h.yaw); const lx = Math.cos(h.yaw); const lz = -Math.sin(h.yaw); /* (forward; its left, three's +x) */
        const g = (u, v) => heightAt(h.x + fx * u + lx * v, h.z + fz * u + lz * v); let paws = null;
        if (!air) { paws = [[F, W, g(F, W)], [F, -W, g(F, -W)], [-B, W, g(-B, W)], [-B, -W, g(-B, -W)]]; const front = (paws[0][2] + paws[1][2]) / 2; const back = (paws[2][2] + paws[3][2]) / 2; const left = (paws[0][2] + paws[2][2]) / 2; const right = (paws[1][2] + paws[3][2]) / 2;
          tp = Math.atan2(front - back, F + B); tr = Math.max(-0.14, Math.min(0.14, Math.atan2(left - right, 2 * W))); y = (front * B + back * F) / (F + B); }
        const k = 1 - Math.exp(-dt * 9); h.pitch = (h.pitch || 0) + (tp - (h.pitch || 0)) * k; h.roll = (h.roll || 0) + (tr - (h.roll || 0)) * k;
        if (paws) { const tp2 = Math.tan(h.pitch); const tr2 = Math.tan(h.roll); const gap = Math.min(...paws.map(([u, v, gy]) => y + u * tp2 + v * tr2 - gy)); if (gap > 0) y -= gap; } /* (the lowest paw on the ground, never floating) */
        h.c.root.rotation.order = 'YXZ'; h.c.root.position.set(h.x, y, h.z); h.c.root.rotation.set(-h.pitch, h.yaw, h.roll);
      }
      const again = Boolean(st.attack) && h.attackAt !== st.attack.at; if (st.attack) h.attackAt = st.attack.at; /* (382: a new attack of the same kind plays from its start) */
      h.c.play(st.clip, again);
      const a = h.c.actions[st.clip];
      if (a && again && st.attack) a.time = Math.max(0, Math.min(a.getClip().duration, (tNow - st.attack.at) / 1000)); /* (in step with the server's start) */
      /* (379: the Run at the server's pace from the server's start -- its stride where the server reads it, so a pounce leaves it at 0.40~0.55 s) */
      if (a && st.clip === 'Run' && h.runAt !== st.at) { h.runAt = st.at; const d = a.getClip().duration || 0.6; a.time = ((((tNow - st.at) / 1000) * (def.speed / def.run)) % d + d) % d; }
      if (a) a.timeScale = st.clip === 'Run' ? def.speed / def.run : st.clip === 'Walk' ? Math.max(0.6, Math.min(1.5, (st.sp || def.walk) / def.walk)) : st.clip === 'Stalk' ? Math.max(0.6, Math.min(1.6, (st.sp || def.stalk) / def.stalk)) : 1;
    }
    for (const [id, h] of shown) if (!list.some((s) => s.id === id)) { h.c.root.visible = false; h.runAt = null; }
    shareNormal();
    // the warning: the nearest awake tiger within its own distance, unless I stand where they never come
    warnState = null;
    if (!safeAt(me.x, me.z)) for (const [id, h] of shown) { if (!h.c.root.visible || RESTING.has(h.s.clip)) continue; const d = Math.hypot(h.x - me.x, h.z - me.z); const def = DEFS[id]; if (d < def.warn && (!warnState || d / def.warn < warnState.k)) warnState = { id, name: def.name, say: def.say, d: Math.round(d * 10) / 10, k: d / def.warn }; }
    warnUi(warnState);
  }
  // ---- the warning on the screen and in the ears
  let edge = null; let lastSay = { id: null, at: 0 }; let audio = null;
  function warnUi(w) {
    if (!edge && w) { edge = document.createElement('div'); edge.id = 'tigerWarn'; edge.setAttribute('aria-live', 'polite'); edge.innerHTML = '<span></span>'; document.body.appendChild(edge); }
    if (!edge) return;
    edge.classList.toggle('on', Boolean(w)); edge.style.setProperty('--tiger-k', w ? String(Math.max(0.25, 1 - w.k)) : '0');
    if (!w) return; const now = performance.now();
    if (lastSay.id !== w.id || now - lastSay.at > 6000) { lastSay = { id: w.id, at: now }; edge.querySelector('span').textContent = `${w.name}: ${w.say}`; edge.classList.remove('say'); void edge.offsetWidth; edge.classList.add('say'); sound(w.id); }
  }
  function sound(id) {
    if (document.hidden || window.RoomSound?.isOn?.() === false) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; if (!audio) { try { audio = new AC(); } catch { return; } }
    const a = audio; if (a.state !== 'running') a.resume().catch(() => {}); const t = a.currentTime + 0.02; const loud = id === 'ure';
    const len = loud ? 1.3 : 1.6; const buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate); const d = buf.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i += 1) { last = last * 0.96 + (Math.random() * 2 - 1) * 0.04; d[i] = last * 8; }
    const src = a.createBufferSource(); src.buffer = buf; const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(loud ? 900 : 380, t); lp.frequency.exponentialRampToValueAtTime(loud ? 240 : 160, t + len);
    const o = a.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(loud ? 110 : 62, t); o.frequency.exponentialRampToValueAtTime(loud ? 70 : 48, t + len); const og = a.createGain(); og.gain.value = loud ? 0.35 : 0.22;
    const tremolo = a.createOscillator(); tremolo.frequency.value = loud ? 9 : 22; const tg = a.createGain(); tg.gain.value = loud ? 0.25 : 0.4; const g = a.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(loud ? 0.55 : 0.28, t + (loud ? 0.12 : 0.35)); g.gain.setTargetAtTime(0, t + len * 0.6, len * 0.18);
    tremolo.connect(tg); tg.connect(g.gain); src.connect(lp); o.connect(og); og.connect(lp); lp.connect(g); g.connect(a.destination);
    src.start(t); o.start(t); tremolo.start(t); src.stop(t + len); o.stop(t + len); tremolo.stop(t + len);
  }
  function dispose() { for (const [, h] of shown) { h.c.gone = true; h.c.root.removeFromParent(); } shown.clear(); edge?.remove(); edge = null; audio?.close?.().catch?.(() => {}); audio = null; }
  return { set, step, dispose, warn: () => warnState,
    debug: () => ({ list: list.map((s) => ({ id: s.id, clip: s.clip, x: s.x, z: s.z })), shown: [...shown].map(([id, h]) => ({ id, visible: h.c.root.visible, loaded: Boolean(h.c.mixer), clip: h.c.now, low: h.c.low, x: Math.round(h.x * 100) / 100, z: Math.round(h.z * 100) / 100, y: Math.round(h.c.root.position.y * 100) / 100 })), sharedNormal, warn: warnState }) };
}
