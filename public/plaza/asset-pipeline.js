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
  //     lod: [{ url, distance }], near, animations: { idle: 'Idle', walk: 'Walk', run: 'Run', ... }, speeds: { walk, run } }
  // v1.10.17: `seasons` gives a file per season; the current season's file is used, then `url`, and without either
  // the target stays procedural. `near` (nature batches): how close a square of the island must be to show the model.
  // `off` lists ids switched off at run time (server ISLAND_ASSETS_OFF; '*' = all).
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  function entryOf(registry, id, off = [], season = null) {
    const entry = registry && Object.prototype.hasOwnProperty.call(registry, id) ? registry[id] : null;
    if (!entry || entry.enabled === false || off.includes('*') || off.includes(id)) return null;
    const url = (season && typeof entry.seasons?.[season] === 'string' && entry.seasons[season]) || entry.url;
    if (typeof url !== 'string' || !url) return null;
    return url === entry.url ? entry : { ...entry, url };
  }
  // The first usable entry among `ids`, most specific first (e.g. ['cottage.3', 'cottage']).
  function pick(registry, ids, off = [], season = null) {
    for (const id of [].concat(ids)) { const entry = entryOf(registry, id, off, season); if (entry) return { id, entry }; }
    return null;
  }
  // v1.10.19 게임 아일랜드 계절 (IDEAS, 2026-10-05): by the day of the month in Asia/Seoul -- 1-7 spring, 8-14 summer,
  // 15-21 autumn, 22 to the month's end winter (29-31 too), back to spring on the 1st at 00:00. Korea keeps no summer
  // time, so Seoul is always UTC+9. `ms` is the server clock (every screen the same island), like the other KST rules.
  const SEOUL = 9 * 3600 * 1000;
  function seasonOf(ms) {
    const day = new Date(ms + SEOUL).getUTCDate();
    return day <= 7 ? 'spring' : day <= 14 ? 'summer' : day <= 21 ? 'autumn' : 'winter';
  }
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

  // What the scene calls. With nothing registered (the default) every call is a no-op and the loader module is never
  // fetched; otherwise the loader is imported once and the calls made meanwhile are replayed on it. A loader that
  // cannot load leaves every target procedural.
  function createLazyAssets({ registry, off = [], importLoader, options = {}, onError = (what, error) => console.warn('3D 에셋을 쓰지 않습니다:', what, error) }) {
    const ids = enabledIds(registry, off);
    let season = options.season || null;
    let impl = null; let failed = false; let disposed = false; const queue = [];
    const call = (name, args) => { if (disposed || failed) return; if (impl) impl[name](...args); else if (ids.length) queue.push([name, args]); };
    if (ids.length) {
      Promise.resolve().then(importLoader).then((mod) => {
        if (disposed) return;
        impl = mod.createIslandAssets({ ...options, season, registry, off, onError });
        for (const [name, args] of queue.splice(0)) impl[name](...args);
      }).catch((error) => { failed = true; queue.length = 0; onError('loader', error); });
    }
    return {
      // a structure: `holder` keeps position, collision and interaction; `procedural` is hidden only once the model is in
      attach: (targetIds, holder, procedural) => call('attach', [targetIds, holder, procedural]),
      // a character (plaza-scene makeCharacter): the model goes under c.root, the procedural body is hidden
      dress: (targetIds, character) => call('dress', [targetIds, character]),
      // v1.10.17 nature and props placed many times: does any of `targetIds` have a model to load? (synchronous, so the
      // scene can keep those copies apart from the rest when it bakes), then hand over the placed copies square by
      // square (see asset-loader.js `batch`)
      wants: (targetIds) => Boolean([null, ...SEASONS].some((s) => pick(registry, targetIds, off, s))),
      batch: (targetIds, cells) => call('batch', [targetIds, cells]),
      // each frame: where the player is (near squares show models, far ones their procedural copies)
      update: (x, z) => { if (impl) impl.update(x, z); },
      setSeason: (next) => { season = next; if (impl) impl.setSeason(next); },
      setQuality: (tier) => call('setQuality', [tier]),
      release: (character) => { if (impl) impl.release(character); },
      dispose() { disposed = true; queue.length = 0; impl?.dispose(); },
      debug: () => ({ registered: ids, loader: impl ? 'ready' : failed ? 'failed' : ids.length ? 'loading' : 'none', season, ...(impl?.debug() || {}) }),
    };
  }

  return { SEASONS, seasonOf, entryOf, pick, enabledIds, createLoadCache, GAIT, nextGait, createAnimator, LOD_SCALE, lodDistance, createLazyAssets };
});
