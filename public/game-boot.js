(() => {
  'use strict';

  // v1.10.14 game boot. GameBoot.ready resolves once the game may start:
  //  1. Browser: only the browsers the server lists in body[data-browsers] (production: Google Chrome) get past this;
  //     the rest see one line asking for Chrome and the game never starts.
  //  2. Resources: the server puts the pack manifest in this page (#assetManifest: on/off, pack version, every file with
  //     a content-hash revision). The page itself is never cached, so the switch and the list are always the server's
  //     latest and always match the code.
  //     v1.10.22 캐시 구조 v2: every file lives in ONE cache, `gc-res:files`, keyed `url?rev=<content hash>`. A key's
  //     content never changes, so an update only downloads the new or changed files into it (hash-checked before they
  //     are stored) -- nothing is copied, and storage needs the new files, not a second copy of the pack. Once every
  //     file of this manifest is there, the pointer in the meta cache (`/active`, the same shape as v1.10.14, so a
  //     worker of that version still finds the files) names this version, and only then are keys no manifest file
  //     uses deleted. A failed update leaves what was there plus any complete new files -- the pointer and every key
  //     the previous version used stay. Preparing and cleaning up run under one Web Lock, so tabs of the same profile
  //     take turns (the second finds the files the first stored). A pack cache of v1.10.14-21 (`gc-res:pack:*`) is
  //     moved over once, locally, and deleted.
  //  3. Pre-flight before any download (preflight): storage may be capped or refused (e.g. company PCs), so a build
  //     only starts when the browser's features, its quota with a safety margin and a real test write all allow it.
  //  4. The worker must be in control of this page (v1.10.22): a registered worker is not enough -- until the page is
  //     controlled, `?rev=` requests would quietly go to the server. If that does not happen within CONTROL_TIMEOUT the
  //     game does not start. There is no per-file server fallback; ASSET_CACHE=off is the only way back to it.
  //  Any failure: the game does not start, one short line + a retry button; nothing retries by itself.
  //  5. Off switch (server ASSET_CACHE=off): this page unregisters the worker, deletes only the `gc-res:*` caches and
  //     the game loads its assets from the server as before v1.10.14.
  // public/sw.js answers `?rev=` requests from the cache the pointer names. Code before v1.10.14 never asks for such
  // URLs, so a worker left behind by a rollback is inert, and it removes itself once the server no longer knows
  // /asset-cache.json.
  const PREFIX = 'gc-res:';
  const META = `${PREFIX}meta`;
  const FILES = `${PREFIX}files`;
  const LEGACY_PACK = `${PREFIX}pack:`;
  const PROBE = `${PREFIX}probe`;
  const LOCK = `${PREFIX}prepare`;
  const PARALLEL = 6;
  const CONTROL_TIMEOUT = 10000;
  // Peak storage of an update: the files to download (and, once, a legacy pack's files moved over) + the PARALLEL
  // largest downloads in flight while being written + per-entry bookkeeping + a reserve that keeps the site off its
  // quota edge (other site data, browser index files): a tenth of the new data, at least RESERVE_MIN.
  const ENTRY_OVERHEAD = 8 * 1024;
  const RESERVE_MIN = 16 * 1024 * 1024;
  const STORAGE_FAILED = '게임 리소스를 저장할 수 없습니다';
  const view = document.getElementById('bootView');
  const title = document.getElementById('bootTitle');
  const percent = document.getElementById('bootPercent');
  const bar = document.getElementById('bootBar');
  const fill = document.getElementById('bootBarFill');
  const retry = document.getElementById('bootRetry');

  let manifest = { enabled: false, version: '', assets: [] };
  const manifestEl = document.getElementById('assetManifest');
  try { manifest = { ...manifest, ...JSON.parse(manifestEl?.textContent || '') }; } catch {}
  manifestEl?.remove(); // read once; the page markup stays free of file lists (spectator checks scan it for card names)
  const revs = new Map(manifest.enabled ? manifest.assets.map(asset => [asset.url, asset.rev]) : []);
  const keyOf = asset => `${asset.url}?rev=${asset.rev}`;
  const pathOf = request => { const url = new URL(request.url); return url.pathname + url.search; };
  // The URL the game should use for a pack asset; unknown paths, and every path while the cache is off, are unchanged.
  const assetUrl = path => (revs.has(path) ? `${path}?rev=${revs.get(path)}` : path);

  function show(text, { progress = null, canRetry = false } = {}) {
    view.classList.remove('hidden');
    title.textContent = text;
    percent.classList.toggle('hidden', progress === null);
    bar.classList.toggle('hidden', progress === null);
    if (progress !== null) { percent.textContent = `${Math.floor(progress * 100)}%`; fill.style.width = `${progress * 100}%`; }
    retry.classList.toggle('hidden', !canRetry);
  }

  function browserAllowed() {
    const allowed = String(document.body.dataset.browsers || 'chrome').split(/\s+/);
    const kind = window.BrowserGate.classifyBrowser({ brands: navigator.userAgentData?.brands, ua: navigator.userAgent, vendor: navigator.vendor });
    return allowed.includes(kind);
  }

  const cacheSupported = () => window.isSecureContext && 'serviceWorker' in navigator && 'caches' in window
    && Boolean(crypto?.subtle) && typeof navigator.storage?.estimate === 'function' && typeof navigator.locks?.request === 'function';
  const storageError = message => Object.assign(new Error(message), { storage: true });

  function requiredBytes(copy, download) {
    const sizes = download.map(asset => asset.size).sort((a, b) => b - a);
    const build = [...copy, ...download].reduce((sum, asset) => sum + asset.size, 0);
    const inFlight = sizes.slice(0, PARALLEL).reduce((sum, n) => sum + n, 0);
    return build + inFlight + (copy.length + download.length) * ENTRY_OVERHEAD + Math.max(RESERVE_MIN, build / 10);
  }

  // Quota with the safety margin, a best-effort persist() (a refusal is fine), then a real write -> read -> delete of
  // a small block in its own cache, so storage that exists but refuses data fails here and not mid-download.
  async function preflight(copy, download) {
    const { quota = 0, usage = 0 } = await navigator.storage.estimate();
    const required = requiredBytes(copy, download);
    if (quota - usage < required) throw storageError(`free ${quota - usage} < required ${required}`);
    try { if (!(await navigator.storage.persisted?.())) await navigator.storage.persist?.(); } catch {}
    const block = new Uint8Array(64 * 1024).map((_, i) => i % 251);
    try {
      const cache = await caches.open(PROBE);
      await cache.put('/__storage-probe', new Response(block));
      const back = new Uint8Array(await (await cache.match('/__storage-probe')).arrayBuffer());
      if (back.length !== block.length || back.some((v, i) => v !== block[i])) throw new Error('read back differs');
    } catch (error) { throw storageError(`write test: ${error?.message || error}`); }
    finally { await caches.delete(PROBE).catch(() => {}); }
  }

  async function sha16(buffer) {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    return Array.from(bytes.slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
  }

  // Network and content failures are plain errors; a refused write (quota, policy) is a storage error.
  async function download(cache, asset, signal) {
    const key = keyOf(asset);
    const response = await fetch(key, { cache: 'no-cache', credentials: 'same-origin', signal });
    if (!response.ok) throw new Error(`${asset.url} ${response.status}`);
    const body = await response.arrayBuffer();
    const type = response.headers.get('Content-Type') || 'application/octet-stream';
    if (await sha16(body) !== asset.rev) throw new Error(`${asset.url} revision mismatch`);
    await store(cache, key, new Response(body, { headers: { 'Content-Type': type } }));
  }
  async function store(cache, key, response) {
    try { await cache.put(key, response); } catch (error) { throw storageError(`write ${key}: ${error?.message || error}`); }
  }

  async function legacyPacks() { return (await caches.keys()).filter(name => name.startsWith(LEGACY_PACK)); }

  // One tab at a time (Web Lock): bring gc-res:files up to this manifest, then point at it, then drop unused keys.
  async function syncFiles() {
    if (!cacheSupported()) throw storageError('Service Worker / Cache Storage / storage estimate / Web Locks unavailable');
    return navigator.locks.request(LOCK, async () => {
      let files; let pointer = null; const have = new Set(); let legacy = [];
      try {
        files = await caches.open(FILES);
        for (const request of await files.keys()) have.add(pathOf(request));
        const hit = await caches.match('/active', { cacheName: META });
        pointer = hit ? await hit.json() : null;
        legacy = await legacyPacks();
      } catch (error) { throw storageError(`open: ${error?.message || error}`); }

      const wanted = manifest.assets.map(keyOf);
      const missing = manifest.assets.filter(asset => !have.has(keyOf(asset)));
      if (missing.length) {
        // a v1.10.14-21 pack: its files are the same keys, so they are moved over locally instead of downloaded again
        const move = []; const sources = new Map();
        for (const name of legacy) {
          const pack = await caches.open(name);
          for (const request of await pack.keys()) sources.set(pathOf(request), pack);
        }
        const fetchList = [];
        for (const asset of missing) (sources.has(keyOf(asset)) ? move : fetchList).push(asset);
        await preflight(move, fetchList);
        const total = [...move, ...fetchList].reduce((sum, asset) => sum + asset.size, 0);
        let done = 0;
        const progress = () => show('게임 리소스 준비 중', { progress: total ? done / total : 1 });
        const timer = setTimeout(progress, 250); // a small update finishes before anything is shown
        try {
          for (const asset of move) {
            const hit = await sources.get(keyOf(asset)).match(keyOf(asset));
            if (hit) { await store(files, keyOf(asset), hit); done += asset.size; } else fetchList.push(asset);
          }
          let failed = false;
          const abort = new AbortController(); // the first failure stops the downloads still in flight
          const queue = [...fetchList];
          await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
            while (queue.length && !failed) {
              const asset = queue.shift();
              try { await download(files, asset, abort.signal); } catch (error) { if (!failed) { failed = true; abort.abort(); } throw error; }
              done += asset.size;
              if (!failed && !view.classList.contains('hidden')) progress();
            }
          }));
        } finally { clearTimeout(timer); }
        const got = new Set((await files.keys()).map(pathOf));
        if (!wanted.every(key => got.has(key))) throw new Error('files incomplete');
      }
      if (pointer?.version !== manifest.version || pointer?.cache !== FILES) {
        await store(await caches.open(META), '/active', new Response(JSON.stringify({ version: manifest.version, cache: FILES })));
      }
      // only now, with this version complete and pointed at: keys no file of it uses, and the old pack caches
      const keep = new Set(wanted);
      for (const request of await files.keys()) if (!keep.has(pathOf(request))) await files.delete(request);
      for (const name of legacy) await caches.delete(name);
    });
  }

  // The page must be controlled by our worker. A first visit gets there by the worker's clients.claim() on activation;
  // a page loaded past the worker (a hard reload) asks the active worker to claim it.
  async function controlled() {
    if (navigator.serviceWorker.controller) return;
    const changed = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Service Worker not in control')), CONTROL_TIMEOUT); });
    try {
      await Promise.race([(async () => {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) registration.active?.postMessage('claim');
        if (!navigator.serviceWorker.controller) await changed;
      })(), timeout]);
    } finally { clearTimeout(timer); }
  }

  // The server has the cache off: back to plain server loading. Only this feature's worker and caches are removed.
  async function disable() {
    try {
      for (const registration of await navigator.serviceWorker.getRegistrations()) {
        const script = (registration.active || registration.waiting || registration.installing)?.scriptURL;
        if (script && new URL(script).pathname === '/sw.js') await registration.unregister();
      }
    } catch {}
    try { for (const name of await caches.keys()) if (name.startsWith(PREFIX)) await caches.delete(name); } catch {}
  }

  async function prepare() {
    if (!manifest.enabled) return disable();
    if (!manifest.assets.length) return;
    navigator.serviceWorker?.register('/sw.js').catch(() => {}); // early; controlled() waits for it and reports a failure
    for (;;) {
      try { await syncFiles(); await controlled(); return; }
      catch (error) {
        console.warn('게임 리소스 준비 실패:', error);
        show(error?.storage ? STORAGE_FAILED : '게임 리소스 준비 실패', { canRetry: true });
        await new Promise(resolve => retry.addEventListener('click', resolve, { once: true }));
        show('게임 리소스 준비 중', { progress: 0 });
      }
    }
  }

  const ready = browserAllowed()
    ? prepare().then(() => view.classList.add('hidden'))
    : (show('Google Chrome으로 접속해 주세요'), new Promise(() => {}));

  window.GameBoot = { ready, assetUrl, manifest };
})();
