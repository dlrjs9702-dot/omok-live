(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AssetPipeline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  // v1.10.15 고품질 에셋 파이프라인: the parts of the island's optional 3D-asset layer that need no Three.js -- which
  // registered asset a target uses, loading each file once, the Idle/Walk/Run choice, LOD distances per quality tier,
  // and the lazy front the scene talks to. The scene's procedural models stay the default: a target shows an external
  // model only when one is registered, enabled and loaded; anything else keeps the procedural visual. The Three.js
  // side (GLTFLoader, cloning, AnimationMixer, LOD objects) is public/plaza/asset-loader.js, loaded only when needed.

  // A registry entry (public/plaza/island-assets.js), all optional but a `url` or `seasons`:
  //   { url, seasons: { spring, summer, autumn, winter }, enabled, scale, rotationY, offset: [x, y, z], shadows,
  //     lod: [{ url, distance }], near, low: { seasons, url }, animations: { idle: 'Idle', walk: 'Walk', run: 'Run', ... },
  //     speeds: { walk, run } }
  // v1.10.17: `seasons` gives a file per season; the current season's file is used, then `url`, and without either
  // the target stays procedural. `near` (nature batches): within this of the player a copy shows the full model, beyond
  // it the entry's `low` file (v1.10.28; without one the full model at every distance).
  // `off` lists ids switched off at run time (server ISLAND_ASSETS_OFF; '*' = all).
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  function entryOf(registry, id, off = [], season = null) {
    const entry = registry && Object.prototype.hasOwnProperty.call(registry, id) ? registry[id] : null;
    if (!entry || entry.enabled === false || off.includes('*') || off.includes(id)) return null;
    const url = (season && typeof entry.seasons?.[season] === 'string' && entry.seasons[season]) || entry.url;
    if (typeof url !== 'string' || !url) return null;
    // v1.10.28 `low`: { seasons, url } of the same design simplified, for far copies (resolved like the main file)
    const low = entry.low;
    const lowUrl = (season && typeof low?.seasons?.[season] === 'string' && low.seasons[season]) || (typeof low?.url === 'string' && low.url) || null;
    return { ...entry, url, lowUrl };
  }
  // v1.10.28 High/Low hysteresis: a copy turns High inside `near` and back to Low only past near x HIGH_BAND, so standing
  // or walking at the edge never flickers between the two
  const HIGH_BAND = 1.1;
  const highState = (wasHigh, distance, near) => distance < (wasHigh ? near * HIGH_BAND : near);
  // The first usable entry among `ids`, most specific first (e.g. ['cottage.3', 'cottage']).
  function pick(registry, ids, off = [], season = null) {
    for (const id of [].concat(ids)) { const entry = entryOf(registry, id, off, season); if (entry) return { id, entry }; }
    return null;
  }
  // v1.10.27 게임 아일랜드 4계절 동시 존재·일일 회전: the season is no longer the whole island's (the v1.10.19 monthly
  // rule is gone) but each thing's -- the zone its place is in and the day (island-terrain.js seasonZoneAt / seasonDay /
  // zoneSeason). The neutral central plaza has no season of its own; its seasonal props show NEUTRAL_LOOK, the plain
  // green summer files, until neutral models exist.
  const NEUTRAL_LOOK = 'summer';
  // ids that could show a model in some season (so the loader is worth fetching)
  const enabledIds = (registry, off = []) => Object.keys(registry || {}).filter((id) => [null, ...SEASONS].some((season) => entryOf(registry, id, off, season)));

  // Every URL is fetched and parsed once; all targets asking for it share that one promise. A failure (404, a broken
  // file, a decoder error...) is reported once and resolves to null: the caller keeps its procedural visual.
  function createLoadCache(load, onError) {
    const byUrl = new Map(); const state = new Map(); // url -> 'loading' | 'loaded' | 'failed: <reason>'
    return {
      get(url) {
        if (!byUrl.has(url)) {
          state.set(url, 'loading');
          byUrl.set(url, Promise.resolve().then(() => load(url)).then((value) => {
            if (!value) throw new Error('empty asset');
            state.set(url, 'loaded'); return value;
          }).catch((error) => {
            state.set(url, `failed: ${error?.message || error}`);
            try { onError?.(url, error); } catch {}
            return null;
          }));
        }
        return byUrl.get(url);
      },
      status: () => Object.fromEntries(state),
      // frees what was loaded (the caller says how); later `get`s load again
      clear(free) { for (const p of byUrl.values()) p.then((value) => { if (value) free?.(value); }); byUrl.clear(); state.clear(); },
    };
  }

  // Idle / Walk / Run from how fast the character is drawn moving (for other people that is the follower's speed,
  // public/plaza/remote-motion.js). Two thresholds each way so a speed hovering at a boundary does not flicker.
  // Same bands as the procedural gait (plaza-scene `animate`): moving from 0.4, a run past 1.3x the walking speed.
  const GAIT = { walkOn: 0.4, walkOff: 0.25, runOn: 1.3, runOff: 1.15 };
  function nextGait(current, speed, walkSpeed) {
    const ratio = walkSpeed > 0 ? speed / walkSpeed : 0;
    if (current === 'run' && ratio >= GAIT.runOff) return 'run';
    if (ratio > GAIT.runOn) return 'run';
    if (current === 'idle' || !current) return speed > GAIT.walkOn ? 'walk' : 'idle';
    return speed < GAIT.walkOff ? 'idle' : 'walk';
  }

  // Plays a rigged model's clips through one AnimationMixer: the gait state picks the clip and changes cross-fade.
  // `names` maps states to clip names (more states -- wave, interact, emotes -- can be added and started with play());
  // a missing clip falls back run -> walk -> idle. `speeds` are the ground speeds the walk/run clips were made for, so
  // the stride matches the ground. THREE is passed in (the page's module, or `three` in tests).
  function createAnimator(THREE, rootObject, clips, names = {}, { walkSpeed = 1, speeds = {}, fade = 0.25 } = {}) {
    const mixer = new THREE.AnimationMixer(rootObject);
    const byName = new Map((clips || []).map((clip) => [clip.name, clip]));
    const actions = {};
    for (const [state, clipName] of Object.entries(names)) { const clip = byName.get(clipName); if (clip) actions[state] = mixer.clipAction(clip); }
    const actionFor = (state) => actions[state] || (state === 'run' ? actions.walk || actions.idle : actions.idle) || null;
    const groundSpeed = { walk: speeds.walk || walkSpeed, run: speeds.run || walkSpeed * 1.6 };
    let state = 'idle'; let current = actionFor('idle'); current?.play();
    let once = null; // a one-off clip (play) holds until it has finished
    function fadeTo(action) {
      if (!action || action === current) return;
      action.reset(); action.setEffectiveWeight(1); action.play();
      if (current) action.crossFadeFrom(current, fade, false);
      current = action;
    }
    return {
      get state() { return state; },
      get clip() { return current?.getClip().name || null; },
      weights: () => Object.fromEntries(Object.entries(actions).map(([name, action]) => [name, action.isRunning() ? action.getEffectiveWeight() : 0])),
      update(dt, speed) {
        speed = Math.max(0, speed || 0);
        if (once && !once.isRunning()) { once = null; state = 'idle'; fadeTo(actionFor('idle')); }
        if (!once) {
          const next = nextGait(state, speed, walkSpeed);
          if (next !== state) { state = next; fadeTo(actionFor(next)); }
          const moving = current === actions.run ? 'run' : 'walk';
          if (current) current.timeScale = state === 'idle' ? 1 : Math.min(2, Math.max(0.5, speed / groundSpeed[moving]));
        }
        mixer.update(dt);
      },
      // a named extra clip played once (e.g. 'wave'), then back to the gait; false when the model has no such clip
      play(name) {
        const action = actions[name]; if (!action) return false;
        action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = false; action.timeScale = 1;
        state = name; once = action; fadeTo(action); return true;
      },
      dispose() { mixer.stopAllAction(); mixer.uncacheRoot(rootObject); },
    };
  }

  // Quality tiers are plaza-scene's adaptive quality: 2 high (pixel ratio up to 1.5, shadows), 1 medium (pixel ratio 1),
  // 0 low (no shadows). An LOD level's switch distance shrinks on lower tiers, so a slower PC uses the coarser model
  // nearer the camera; tier 2 keeps the distances as registered.
  const LOD_SCALE = [0.5, 0.75, 1];
  const lodDistance = (base, tier) => base * (LOD_SCALE[tier] ?? 1);

  // v1.10.32 캐릭터 조합 맞춤: what each worn part must give way to, worked out from the parts themselves in the common
  // rig's rest space (y up, the front -z, metres; every part file shares it) -- so a new skin needs no hand-placed
  // numbers, only its slot (and a hat its brim line). `parts`: [{ id, fit: { slot, cover, hideWith }, pos: [x,y,z,...]
  // (the High file's vertices) }] -> { [id]: { ops: [...], hide: [material names] } }. The ops, applied by applyFit:
  //  - cover   a hat's crown hides the hair faces above its brim line (a bun, curls or spikes never poke through);
  //  - shift   a necklace's pendant comes forward over whatever the clothes have on the chest (a bib, a plate, a tie);
  //            a cape hangs behind the clothes' back, band by band from the shoulders down (a hood, a skirt, a coat
  //            push it out, and lower bands never come in again: it drapes);
  //  - slab    a tail's faces caught inside the cape's cloth come out behind it (no flicker of two surfaces in one place);
  //  - hide    a part's own built-in piece gives way to a worn one (the 왕실 망토 outfit's cape when a cape is worn).
  // Faces and vertices only move or go (per character combination; the files stay as they are).
  const FIT = { band: 0.06, gap: 0.015, chest: { x: 0.16, y0: 0.86, y1: 1.06 }, pendantZ: -0.2, capeZ: 0.15, back: 0.36, tailX: 0.45 };
  function fitWardrobe(parts) {
    const out = Object.fromEntries(parts.map((p) => [p.id, { ops: [], hide: [] }]));
    const of = (slots) => parts.filter((p) => slots.includes(p.fit?.slot));
    const each = (list, fn) => { for (const p of list) for (let i = 0; i < p.pos.length; i += 3) fn(p.pos[i], p.pos[i + 1], p.pos[i + 2]); };
    const slots = new Set(parts.map((p) => p.fit?.slot));
    for (const p of parts) for (const [slot, mats] of Object.entries(p.fit?.hideWith || {})) if (slots.has(slot)) out[p.id].hide.push(...mats);
    const cover = Math.min(...of(['hat']).map((p) => p.fit?.cover ?? Infinity));
    if (Number.isFinite(cover)) for (const p of of(['hair'])) out[p.id].ops.push({ kind: 'cover', above: cover });
    const clothes = of(['outfit', 'top', 'bottom']);
    for (const neck of of(['necklace'])) {
      let front = Infinity; let back = -Infinity;
      each(clothes.filter((p) => p.fit.slot !== 'bottom'), (x, y, z) => { if (Math.abs(x) < FIT.chest.x && y > FIT.chest.y0 && y < FIT.chest.y1) front = Math.min(front, z); });
      each([neck], (x, y, z) => { if (z < FIT.pendantZ && y < FIT.chest.y1) back = Math.max(back, z); });
      const dz = front - FIT.gap - back;
      if (Number.isFinite(dz) && dz < 0) out[neck.id].ops.push({ kind: 'shift', zMax: FIT.pendantZ, yMax: FIT.chest.y1, curve: [[0, dz]] });
    }
    const bandOf = (y) => Math.round(y / FIT.band);
    for (const cape of of(['cape'])) {
      const back = new Map(); const inner = new Map();
      each(clothes, (x, y, z) => { if (Math.abs(x) < FIT.back) { const b = bandOf(y); back.set(b, Math.max(back.get(b) ?? -Infinity, z)); } });
      each([cape], (x, y, z) => { if (z > FIT.capeZ) { const b = bandOf(y); inner.set(b, Math.min(inner.get(b) ?? Infinity, z)); } });
      const bands = [...inner.keys()].sort((a, b) => b - a); // from the shoulders down
      let need = 0; const curve = [];
      for (const b of bands) { if (back.has(b)) need = Math.max(need, back.get(b) + FIT.gap - inner.get(b)); curve.push([b * FIT.band, need]); }
      if (curve.some(([, dz]) => dz > 0)) out[cape.id].ops.push({ kind: 'shift', zMin: FIT.capeZ, curve });
      // the cape's cloth where it now hangs, for the tail
      const shifted = { pos: applyFit(cape.pos, null, out[cape.id].ops).pos || cape.pos };
      const lo = new Map(); const hi = new Map();
      each([shifted], (x, y, z) => { if (z > FIT.capeZ && Math.abs(x) < FIT.tailX) { const b = bandOf(y); lo.set(b, Math.min(lo.get(b) ?? Infinity, z)); hi.set(b, Math.max(hi.get(b) ?? -Infinity, z)); } });
      const slab = [...lo.keys()].map((b) => [b * FIT.band, lo.get(b) - 0.01, hi.get(b) + FIT.gap]);
      for (const tail of of(['tail'])) out[tail.id].ops.push({ kind: 'slab', xAbs: FIT.tailX, bands: slab });
    }
    return out;
  }
  // The ops on one geometry: rest-space positions (flat array) and its triangle list (null: unindexed) ->
  // { pos: new positions or null (unchanged), index: new triangle list or null (unchanged) }
  function applyFit(pos, index, ops) {
    let P = null; let I = null;
    const curveAt = (curve, y) => {
      if (curve.length === 1) return curve[0][1];
      for (let k = 0; k < curve.length - 1; k += 1) { const [y0, a] = curve[k]; const [y1, b] = curve[k + 1]; if (y <= y0 && y >= y1) return a + ((y0 - y) / (y0 - y1 || 1)) * (b - a); }
      return y > curve[0][0] ? curve[0][1] : curve[curve.length - 1][1];
    };
    for (const op of ops) {
      if (op.kind === 'cover') {
        const src = I || index || Array.from({ length: pos.length / 3 }, (_, i) => i);
        const keep = [];
        for (let t = 0; t < src.length; t += 3) { const cy = ((P || pos)[src[t] * 3 + 1] + (P || pos)[src[t + 1] * 3 + 1] + (P || pos)[src[t + 2] * 3 + 1]) / 3; if (cy <= op.above) keep.push(src[t], src[t + 1], src[t + 2]); }
        if (keep.length !== src.length) I = keep;
      } else if (op.kind === 'shift') {
        P ||= Float32Array.from(pos);
        for (let i = 0; i < P.length; i += 3) {
          const y = P[i + 1]; const z = P[i + 2];
          if ((op.zMin !== undefined && z <= op.zMin) || (op.zMax !== undefined && z >= op.zMax) || (op.yMax !== undefined && y >= op.yMax)) continue;
          P[i + 2] = z + curveAt(op.curve, y);
        }
      } else if (op.kind === 'slab') {
        P ||= Float32Array.from(pos);
        for (let i = 0; i < P.length; i += 3) {
          if (Math.abs(P[i]) > op.xAbs) continue;
          const band = op.bands.find(([y]) => Math.abs(y - P[i + 1]) <= FIT.band / 2); if (!band) continue;
          if (P[i + 2] >= band[1] && P[i + 2] < band[2]) P[i + 2] = band[2];
        }
      }
    }
    return { pos: P, index: I };
  }

  // What the scene calls. With nothing registered (the default) every call is a no-op and the loader module is never
  // fetched; otherwise the loader is imported once and the calls made meanwhile are replayed on it. A loader that
  // cannot load leaves every target procedural.
  function createLazyAssets({ registry, off = [], importLoader, options = {}, onError = (what, error) => console.warn('3D 에셋을 쓰지 않습니다:', what, error) }) {
    const ids = enabledIds(registry, off);
    let day = options.day ?? null; // the season day (island-terrain seasonDay)
    let impl = null; let failed = false; let disposed = false; const queue = [];
    const call = (name, args) => { if (disposed || failed) return; if (impl) impl[name](...args); else if (ids.length) queue.push([name, args]); };
    if (ids.length) {
      Promise.resolve().then(importLoader).then((mod) => {
        if (disposed) return;
        impl = mod.createIslandAssets({ ...options, day, registry, off, onError });
        for (const [name, args] of queue.splice(0)) impl[name](...args);
      }).catch((error) => { failed = true; queue.length = 0; onError('loader', error); });
    }
    return {
      // a structure: `holder` keeps position, collision and interaction; `procedural` is hidden only once the model is in
      attach: (targetIds, holder, procedural, onSwap) => call('attach', [targetIds, holder, procedural, onSwap]),
      // a character (plaza-scene makeCharacter): the model goes under c.root, the procedural body is hidden
      dress: (targetIds, character) => call('dress', [targetIds, character]),
      // v1.10.30: a common-rig character put together from wardrobe parts (island-assets wardrobeOf)
      wear: (character, plan) => call('wear', [character, plan]),
      // v1.10.17 nature and props placed many times: does any of `targetIds` have a model to load? (synchronous, so the
      // scene can keep those copies apart from the rest when it bakes), then hand over the placed copies square by
      // square (see asset-loader.js `batch`)
      wants: (targetIds) => Boolean([null, ...SEASONS].some((s) => pick(registry, targetIds, off, s))),
      batch: (targetIds, cells) => call('batch', [targetIds, cells]),
      // v1.10.31: a square of a batch drawn again after a copy changed; a batch taken away; a model held for a moment
      refill: (cell) => call('refill', [cell]),
      unbatch: (cells) => call('unbatch', [cells]),
      hold: (character, targetIds, ms, options) => call('hold', [character, targetIds, ms, options]),
      // v1.10.32 운반: a kept thing let go, or handed to another character's hand (a lost thing given back)
      letGo: (character, key) => call('letGo', [character, key]),
      handOver: (from, to, key) => call('handOver', [from, to, key]),
      // each frame: where the player is (near squares show models, far ones their procedural copies)
      update: (x, z) => { if (impl) impl.update(x, z); },
      // v1.10.27: a new day (00:00 KST): every season moves one zone clockwise
      setDay: (next) => { day = next; if (impl) impl.setDay(next); },
      setQuality: (tier) => call('setQuality', [tier]),
      // v1.10.29: a model playing its clip once (a whale breaching), the seasonal falling flakes, and their per-frame step
      once: (targetIds, where, options) => call('once', [targetIds, where, options]),
      ambient: (parent) => call('ambient', [parent]),
      tick: (dt, x, z) => { if (impl) impl.tick(dt, x, z); },
      release: (character) => { if (impl) impl.release(character); },
      dispose() { disposed = true; queue.length = 0; impl?.dispose(); },
      debug: () => ({ registered: ids, loader: impl ? 'ready' : failed ? 'failed' : ids.length ? 'loading' : 'none', day, ...(impl?.debug() || {}) }),
    };
  }

  return { SEASONS, NEUTRAL_LOOK, entryOf, pick, enabledIds, createLoadCache, GAIT, nextGait, createAnimator, LOD_SCALE, lodDistance, HIGH_BAND, highState, FIT, fitWardrobe, applyFit, createLazyAssets };
});
