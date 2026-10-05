// 잿빛 원정 client: mounts the 3D scene + HUD into the room page, turns arrow keys / Space / QWER /
// Shift / 1-4 / Tab into intents for the server, predicts only the local character's movement, and
// interpolates everything else between server ticks. mount() returns a controller; unmount()
// stops the frame loop and releases the scene, listeners and timers.
import { createScene } from './rpg-scene.js';
import { createHud } from './rpg-hud.js';

const MOVE_KEYS = { ArrowUp: 1, ArrowDown: 2, ArrowLeft: 4, ArrowRight: 8 };
const PRESS_KEYS = { KeyQ: 'q', KeyW: 'w', KeyE: 'e', KeyR: 'r', ShiftLeft: 'dash', ShiftRight: 'dash', Tab: 'tab', Digit1: 'item1', Digit2: 'item2', Digit3: 'item3', Digit4: 'item4' };
const INTERP_DELAY = 110; // ms behind the newest server tick for remote entities

export function mount(container, api) {
  container.replaceChildren();
  const stage = document.createElement('div'); stage.className = 'rpgStageInner';
  const hudRoot = document.createElement('div'); hudRoot.className = 'rpgHud';
  container.append(stage, hudRoot);
  const scene = createScene(stage);
  const hud = createHud(hudRoot, {
    onClass: cls => api.post('rpg-class', { cls }),
    onStart: () => api.post('rpg-start', {}),
    onPick: index => api.post('rpg-pick', { index }),
    onStat: stat => api.post('rpg-stat', { stat }),
    onItem: index => api.post('rpg-item', { index }),
    onReady: ready => api.post('rpg-ready', { ready }),
    onNextRound: () => api.post('next-round', {}),
  });
  if (!scene) hud.banner('이 브라우저에서 3D(WebGL)를 사용할 수 없습니다.', 'warn');

  let meta = null; // latest room state (roomState)
  const snaps = []; // [{at, snap}] newest last
  let running = true;
  let frame = null;
  let lastFrame = performance.now();
  let held = 0; let attack = false; let sentHeld = -1; let sentAttack = null; let sendTimer = null; let lastSend = 0;
  const local = { x: 0, z: 0, ready: false, dashUntil: 0, dvx: 0, dvz: 0, facing: 0, room: -1 };
  const stats = { frames: 0, ticks: 0 };

  // ---- input ------------------------------------------------------------------------------

  const typing = (target) => Boolean(target?.closest?.('input, textarea, select, [contenteditable="true"], dialog[open]') || target?.isContentEditable || document.querySelector('dialog[open]'));
  const playable = () => Boolean(meta && meta.gameType === 'rpg' && meta.me?.seat && meta.game.status === 'playing');

  function flush(force = false) {
    if (!playable()) return;
    if (!force && held === sentHeld && attack === sentAttack) return;
    const now = performance.now();
    if (!force && now - lastSend < 45) { clearTimeout(sendTimer); sendTimer = setTimeout(() => flush(), 50); return; }
    lastSend = now; sentHeld = held; sentAttack = attack;
    api.fast('rpg-input', { mv: held, atk: attack });
  }

  function onKeyDown(event) {
    if (!playable() || typing(event.target)) return;
    if (event.code === 'Escape') { if (hud.escape()) event.preventDefault(); return; }
    const move = MOVE_KEYS[event.code];
    if (move) { event.preventDefault(); if (!(held & move)) { held |= move; flush(); } return; }
    if (event.code === 'Space') { event.preventDefault(); if (!attack) { attack = true; flush(); } return; }
    const press = PRESS_KEYS[event.code];
    if (press) {
      event.preventDefault();
      if (event.repeat) return;
      if (press === 'dash') predictDash();
      api.fast('rpg-act', { a: press }).then((res) => { if (res && res.ok === false && res.reason === 'no-skill') hud.showError('비어 있는 스킬 칸입니다 · 레벨업으로 배우세요'); });
    }
  }

  function onKeyUp(event) {
    const move = MOVE_KEYS[event.code];
    if (move) { if (held & move) { held &= ~move; flush(); } if (playable()) event.preventDefault(); return; }
    if (event.code === 'Space') { if (attack) { attack = false; flush(); } if (playable()) event.preventDefault(); }
  }

  // Focus loss must not leave a key "stuck down".
  function releaseAll() { if (held || attack) { held = 0; attack = false; flush(true); } }
  function onVisibility() { if (document.visibilityState === 'hidden') releaseAll(); }
  function onFocusIn(event) { if (typing(event.target)) releaseAll(); }

  window.addEventListener('keydown', onKeyDown, { capture: true });
  window.addEventListener('keyup', onKeyUp, { capture: true });
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('focusin', onFocusIn);

  // ---- local movement prediction -----------------------------------------------------------

  function collide(e, radius) {
    const room = meta?.game.room;
    if (!room) return;
    const b = room.bounds;
    if (b.type === 'rect') { e.x = Math.max(-b.w / 2 + radius, Math.min(b.w / 2 - radius, e.x)); e.z = Math.max(-b.h / 2 + radius, Math.min(b.h / 2 - radius, e.z)); }
    else { const l = Math.hypot(e.x, e.z); const max = b.r - radius; if (l > max) { e.x = e.x / l * max; e.z = e.z / l * max; } }
    for (const o of room.obstacles) {
      if (o.type === 'circle') { const dx = e.x - o.x; const dz = e.z - o.z; const l = Math.hypot(dx, dz); const min = o.r + radius; if (l < min && l > 1e-6) { e.x = o.x + dx / l * min; e.z = o.z + dz / l * min; } }
      else {
        const cx = Math.max(o.x - o.w / 2, Math.min(o.x + o.w / 2, e.x)); const cz = Math.max(o.z - o.d / 2, Math.min(o.z + o.d / 2, e.z));
        const dx = e.x - cx; const dz = e.z - cz; const l = Math.hypot(dx, dz);
        if (l < radius && l > 1e-6) { e.x = cx + dx / l * radius; e.z = cz + dz / l * radius; }
      }
    }
  }

  function myInfo() { return meta?.game.players?.[meta.me?.seat] || null; }
  function moveVector() {
    const x = ((held & 8) ? 1 : 0) - ((held & 4) ? 1 : 0);
    const z = ((held & 2) ? 1 : 0) - ((held & 1) ? 1 : 0);
    const l = Math.hypot(x, z);
    return l ? { x: x / l, z: z / l } : null;
  }

  function predictDash() {
    const mine = latestMine();
    if (!mine || mine.st !== 'ok' || mine.cd.d > 0.05 || !meta?.game.dash) return;
    const dir = moveVector() || { x: Math.sin(local.facing), z: -Math.cos(local.facing) };
    const speed = meta.game.dash.distance / meta.game.dash.duration;
    local.dvx = dir.x * speed; local.dvz = dir.z * speed; local.dashUntil = performance.now() + meta.game.dash.duration * 1000;
  }

  function latestMine() { const last = snaps[snaps.length - 1]?.snap; return last?.p.find(p => p.s === meta?.me?.seat) || null; }

  function stepLocal(dt) {
    const mine = latestMine();
    const info = myInfo();
    if (!mine || !info) { local.ready = false; return null; }
    const radius = meta.game.classInfo[info.cls].radius;
    const last = snaps[snaps.length - 1].snap;
    if (!local.ready || local.room !== last.ri || mine.st !== 'ok') { local.x = mine.x; local.z = mine.z; local.ready = true; local.room = last.ri; local.facing = mine.a; return { ...mine }; }
    const now = performance.now();
    if (now < local.dashUntil) { local.x += local.dvx * dt; local.z += local.dvz * dt; }
    else if (mine.d) { local.x += (mine.x - local.x) * 0.35; local.z += (mine.z - local.z) * 0.35; } // server-driven charge
    else {
      const v = moveVector();
      if (v) { local.x += v.x * info.derived.speed * dt; local.z += v.z * info.derived.speed * dt; local.facing = Math.atan2(v.x, -v.z); }
    }
    collide(local, radius);
    // Reconcile with the authoritative position: snap on large error, drift gently otherwise.
    const ex = mine.x - local.x; const ez = mine.z - local.z; const err = Math.hypot(ex, ez);
    if (err > 2.4) { local.x = mine.x; local.z = mine.z; }
    else { const k = moveVector() ? 0.04 : 0.18; local.x += ex * k; local.z += ez * k; }
    return { ...mine, x: local.x, z: local.z, a: moveVector() ? local.facing : mine.a };
  }

  // ---- interpolation ------------------------------------------------------------------------

  function interpolated() {
    if (!snaps.length) return null;
    const renderAt = performance.now() - INTERP_DELAY;
    let a = snaps[0]; let b = snaps[snaps.length - 1];
    for (let i = snaps.length - 1; i > 0; i -= 1) { if (snaps[i - 1].at <= renderAt) { a = snaps[i - 1]; b = snaps[i]; break; } }
    const span = Math.max(1, b.at - a.at);
    const k = Math.max(0, Math.min(1, (renderAt - a.at) / span));
    const lerpList = (listA, listB, key) => {
      const byId = new Map(listA.map(item => [item[key], item]));
      return listB.map((item) => {
        const prev = byId.get(item[key]);
        if (!prev) return item;
        let da = item.a - prev.a; if (da > Math.PI) da -= 2 * Math.PI; if (da < -Math.PI) da += 2 * Math.PI;
        return { ...item, x: prev.x + (item.x - prev.x) * k, z: prev.z + (item.z - prev.z) * k, a: prev.a + da * k };
      });
    };
    const latest = snaps[snaps.length - 1].snap;
    return {
      players: lerpList(a.snap.p, b.snap.p, 's'),
      mobs: lerpList(a.snap.m, b.snap.m, 'i'),
      projectiles: lerpList(a.snap.pr, b.snap.pr, 'i'),
      hazards: latest.hz, spawns: latest.sp, latest,
    };
  }

  // ---- frame loop ---------------------------------------------------------------------------

  function loop(now) {
    if (!running) return;
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    stats.frames += 1;
    const view = interpolated();
    if (!view || !meta?.game.room || !scene) return;
    const me = stepLocal(dt);
    const players = view.players.map(p => (me && p.s === me.s ? me : p));
    scene.update({ room: { ...meta.game.room, index: meta.game.roomIndex, chestOpen: meta.game.phase === 'intermission' }, players, mobs: view.mobs, projectiles: view.projectiles, hazards: view.hazards, spawns: view.spawns, me: meta.me?.seat, classes: meta.game.classes }, dt);
    scene.render();
  }

  function resize() {
    if (!scene) return;
    const rect = stage.getBoundingClientRect();
    scene.resize(Math.max(320, rect.width), Math.max(240, rect.height));
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(stage);
  resize();
  frame = requestAnimationFrame(loop);

  // ---- server data ----------------------------------------------------------------------------

  function positionOf(seat) {
    const last = snaps[snaps.length - 1]?.snap;
    if (seat === meta?.me?.seat && local.ready) return { x: local.x, z: local.z };
    return last?.p.find(p => p.s === seat) || null;
  }

  function tick(snap) {
    if (!running) return;
    stats.ticks += 1;
    snaps.push({ at: performance.now(), snap });
    while (snaps.length > 8) snaps.shift();
    hud.setTick(snap);
    for (const event of snap.fx || []) {
      scene?.onFx(event, positionOf);
      if (!scene) continue;
      if (event.k === 'dmg') { const s = scene.project(event.x, 1.9, event.z); hud.float(s.x, s.y, String(event.v), `${event.c ? 'crit' : ''} ${event.s === meta?.me?.seat ? 'mine' : ''} el-${event.el || 'phys'}`); }
      else if (event.k === 'hurt') { const p = positionOf(event.s); if (p) { const s = scene.project(p.x, 2.2, p.z); hud.float(s.x, s.y, `-${event.v}`, `hurt ${event.s === meta?.me?.seat ? 'me' : ''}`); } }
      else if (event.k === 'heal') { const s = scene.project(event.x, 2.2, event.z); hud.float(s.x, s.y, `+${event.v}`, 'heal'); }
      else if (event.k === 'level') { const p = positionOf(event.s); if (p) { const s = scene.project(p.x, 2.8, p.z); hud.float(s.x, s.y, 'LEVEL UP', 'level'); } if (event.s === meta?.me?.seat) hud.banner(`LEVEL UP! Lv.${event.lv} · 방을 비우면 성장 선택`, 'level'); }
      else if (event.k === 'item') { const p = positionOf(event.s); if (p) { const s = scene.project(p.x, 2.8, p.z); hud.float(s.x, s.y, event.name, `item rarity-${event.rarity}`); } }
      else if (event.k === 'clear') hud.banner('방 클리어! 출구가 열렸습니다', 'clear');
      else if (event.k === 'boss') hud.banner('잿불 군주 이그라 등장', 'boss');
      else if (event.k === 'phase') hud.banner(`보스가 격해집니다 (${event.ph + 1}단계)`, 'boss');
      else if (event.k === 'down' && event.s === meta?.me?.seat) hud.banner('쓰러졌습니다', 'warn');
      else if (event.k === 'victory') hud.banner('원정 성공!', 'clear');
    }
  }

  function update(state) {
    if (!running) return;
    const prevRoom = meta?.game.roomIndex;
    meta = state;
    hud.setMeta(state);
    if (state.game.roomIndex !== prevRoom) { local.ready = false; }
    if (state.game.status !== 'playing') releaseAll();
  }

  function unmount() {
    if (!running) return;
    releaseAll();
    running = false;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    clearTimeout(sendTimer);
    observer?.disconnect();
    window.removeEventListener('keydown', onKeyDown, { capture: true });
    window.removeEventListener('keyup', onKeyUp, { capture: true });
    window.removeEventListener('blur', releaseAll);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('focusin', onFocusIn);
    scene?.dispose();
    hud.dispose();
    container.replaceChildren();
    snaps.length = 0;
  }

  // debug(): read-only view for browser tests (public game data only).
  return { update, tick, unmount, debug: () => ({ running, frames: stats.frames, ticks: stats.ticks, held, attack, local: { ...local }, scene: scene?.stats() || null, snap: snaps[snaps.length - 1]?.snap || null }) };
}
