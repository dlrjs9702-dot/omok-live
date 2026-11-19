import * as THREE from '/vendor/three/three.module.js';

// 1.10.376 N2a-2 별마루섬 호랑이 (notes island-expansion 「별마루섬 호랑이」; assets 152e; lib/island-tigers.js moves them on the server): the two
// tigers as every screen sees them -- 우레 and 안개 at 1.6x (assets.creature: their own rig and ten clips), loaded only once I come near
// 별마루섬 (their pictures with them), each pose eased toward the server's and its clip played at its pace (a run's no-slide speed), a
// pounce's leap drawn from the same curve the server moves it by (the clip's own forward root motion taken out); 우레 napping on his rock.
// Near one that is awake: its warning -- 우레 from 25 m 「어흥!」 loud, 안개 only from 12 m a low 「그르릉」 -- a sound (the game's sound
// on) and the screen's edges going red. `debug()` for the tests and photos.
const DEFS = {
  ure: { name: '우레', model: 'byeolmaru.tiger', walk: 1.66, run: 7.28, stalk: 0.59, warn: 25, say: '어흥!' },
  angae: { name: '안개', model: 'byeolmaru.tiger_angae', walk: 1.33, run: 5.82, stalk: 0.46, warn: 12, say: '그르릉…' },
};
const LEAP_FROM = 0.42; const PAW_S = 0.84; const RESTING = new Set(['Nap', 'Doze']);
const leapAt = (s, len) => { if (s <= LEAP_FROM) return 0; if (s >= PAW_S) return len; const u = (s - LEAP_FROM) / (PAW_S - LEAP_FROM); return len * u * u * (3 - 2 * u); };
const angleTo = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

export function createTigerView({ scene, assets, heightAt, serverNow, lowFiles = () => false, T = globalThis.IslandTerrain }) {
  const shown = new Map(); /* id -> { c, s (server state), x, z, yaw } */ let list = []; let warnState = null; let sharedNormal = false;
  const I = T?.dalmaru?.NEW_ISLE; const camp = I?.camp; const peak = I?.peak;
  const safeAt = (x, z) => Boolean(I) && (Math.hypot(x - camp.x, z - camp.z) < camp.r + 2 || Math.hypot(x - peak.x, z - peak.z) < 14);
  const near = (me) => Boolean(I) && Math.hypot(me.x - I.x, me.z - I.z) < I.r + 120;
  function holder(id) {
    const def = DEFS[id]; const c = { root: new THREE.Group(), mixer: null, actions: {}, want: 'Idle', now: null, gone: false, low: lowFiles(),
      play(name) { c.want = name; if (!c.mixer) return; inPlace(c); if (c.now === name) return; const next = c.actions[name] || c.actions.Idle; if (!next) return; const once = name === 'Pounce'; next.reset(); next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = once; next.fadeIn(name === 'Run' && c.now === 'Stalk' ? 0.35 : 0.2).play(); c.actions[c.now]?.fadeOut(0.2); c.now = name; } };
    scene.add(c.root); assets.creature([def.model], c); return c;
  }
  // the Pounce clip's forward root motion out (the server's leap moves the tiger) -- once a clip
  function inPlace(c) {
    const clip = c.actions.Pounce?.getClip(); if (!clip || clip.userData?.inPlace) return;
    for (const tr of clip.tracks) if (/(^|\.)Root\.position$/.test(tr.name)) for (let k = 2; k < tr.values.length; k += 3) tr.values[k] = 0;
    clip.userData = { ...(clip.userData || {}), inPlace: true };
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
    if (!want) { for (const [, h] of shown) h.c.root.visible = false; warnState = null; warnUi(null); return; }
    const tNow = serverNow();
    for (const s of list) {
      let h = shown.get(s.id); if (!h) { h = { c: holder(s.id), s, at: performance.now(), x: s.x, z: s.z, yaw: s.yaw }; shown.set(s.id, h); }
      h.c.root.visible = true; const def = DEFS[s.id]; const st = h.s;
      if (st.leap) { const along = leapAt((tNow - st.leap.at) / 1000, st.leap.len); h.x = st.leap.x + Math.sin(st.leap.yaw) * along; h.z = st.leap.z + Math.cos(st.leap.yaw) * along; h.yaw = st.leap.yaw; }
      else {
        const ahead = Math.min(0.3, (performance.now() - h.at) / 1000) * (st.sp || 0); const tx = st.x + Math.sin(st.yaw) * ahead; const tz = st.z + Math.cos(st.yaw) * ahead;
        if (Math.hypot(tx - h.x, tz - h.z) > 10) { h.x = tx; h.z = tz; } else { const k = 1 - Math.exp(-dt * 8); h.x += (tx - h.x) * k; h.z += (tz - h.z) * k; }
        h.yaw += angleTo(h.yaw, st.yaw) * (1 - Math.exp(-dt * 10));
      }
      h.c.root.position.set(h.x, heightAt(h.x, h.z) + (st.lift || 0), h.z); h.c.root.rotation.y = h.yaw;
      h.c.play(st.clip);
      const a = h.c.actions[st.clip]; if (a) a.timeScale = st.clip === 'Run' ? Math.max(0.7, Math.min(1.4, (st.sp || def.run) / def.run)) : st.clip === 'Walk' ? Math.max(0.6, Math.min(1.5, (st.sp || def.walk) / def.walk)) : st.clip === 'Stalk' ? Math.max(0.6, Math.min(1.6, (st.sp || def.stalk) / def.stalk)) : 1;
    }
    for (const [id, h] of shown) if (!list.some((s) => s.id === id)) h.c.root.visible = false;
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
