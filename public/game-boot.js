(() => {
  'use strict';

  // v1.10.14 game boot. GameBoot.ready resolves once the game may start:
  //  1. Browser: only the browsers the server lists in body[data-browsers] (production: Google Chrome) get past this;
  //     the rest see one line asking for Chrome and the game never starts.
  //  2. Resources: the server puts the pack manifest in this page (#assetManifest: on/off, pack version, every file with
  //     a content-hash revision). The page itself is never cached, so the switch and the list are always the server's
  //     latest and always match the code. Each pack version lives in its own cache: a new version is built in a fresh
  //     staging cache (unchanged files copied from the active pack, new or changed ones downloaded and hash-checked),
  //     checked complete, and only then made active by one write of the pointer in the meta cache; older pack caches
  //     are deleted after that. A failure deletes the staging cache and leaves the active pack exactly as it was.
  //  3. Pre-flight before any download (preflight): storage may be capped or refused (e.g. company PCs), so a build
  //     only starts when the browser's features, its quota with a safety margin and a real test write all allow it.
  //  Any failure: the game does not start, one short line + a retry button; nothing retries by itself.
  //  4. Off switch (server ASSET_CACHE=off): this page unregisters the worker, deletes only the `gc-res:*` caches and
  //     the game loads its assets from the server as before v1.10.14.
  // public/sw.js answers `?rev=` requests from the active pack only. Code before v1.10.14 never asks for such URLs, so
  // a worker left behind by a rollback is inert, and it removes itself once the server no longer knows /asset-cache.json.
  const PREFIX = 'gc-res:';
  const META = `${PREFIX}meta`;
  const PACK = `${PREFIX}pack:`;
  const PROBE = `${PREFIX}probe`;
  const PARALLEL = 6;
  // Peak storage of a build: the staging pack (copied + downloaded files) exists next to the active pack until the
  // switch, so the margin covers all of it + the PARALLEL largest downloads in flight while being written + per-entry
  // bookkeeping + a reserve that keeps the site off its quota edge (other site data, browser index files): a tenth of
  // the build, at least RESERVE_MIN.
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
    && Boolean(crypto?.subtle) && typeof navigator.storage?.estimate === 'function';
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

  // Every pack cache except `keep` goes (leftovers of an interrupted build, superseded versions); nothing else is touched.
  async function dropPacks(keep) {
    for (const name of await caches.keys()) if (name.startsWith(PACK) && name !== keep) await caches.delete(name);
  }

  async function syncPack() {
    if (!cacheSupported()) throw storageError('Service Worker / Cache Storage / storage estimate unavailable');
    let active = null;
    let activeCache = null;
    const have = new Set();
    try {
      const pointer = await caches.match('/active', { cacheName: META });
      active = pointer ? await pointer.json() : null;
      if (active?.cache && await caches.has(active.cache)) {
        activeCache = await caches.open(active.cache);
        for (const request of await activeCache.keys()) have.add(pathOf(request));
      } else active = null;
    } catch (error) { throw storageError(`open: ${error?.message || error}`); }

    const wanted = manifest.assets.map(keyOf);
    if (active?.version === manifest.version && wanted.every(key => have.has(key))) { await dropPacks(active.cache); return; }

    const copy = manifest.assets.filter(asset => have.has(keyOf(asset)));
    const fetchList = manifest.assets.filter(asset => !have.has(keyOf(asset)));
    await dropPacks(active?.cache);
    await preflight(copy, fetchList);
    const stagingName = `${PACK}${manifest.version}:${Date.now().toString(36)}`;
    const total = [...copy, ...fetchList].reduce((sum, asset) => sum + asset.size, 0);
    let done = 0;
    const progress = () => show('게임 리소스 준비 중', { progress: total ? done / total : 1 });
    const timer = setTimeout(progress, 250); // a small update finishes before anything is shown
    try {
      const staging = await caches.open(stagingName);
      for (const asset of copy) { // local, from the active pack: unchanged files are never downloaded again
        const hit = await activeCache.match(keyOf(asset));
        if (hit) { await store(staging, keyOf(asset), hit); done += asset.size; } else fetchList.push(asset);
      }
      let failed = false;
      const abort = new AbortController(); // the first failure stops the downloads still in flight
      const queue = [...fetchList];
      await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
        while (queue.length && !failed) {
          const asset = queue.shift();
          try { await download(staging, asset, abort.signal); } catch (error) { if (!failed) { failed = true; abort.abort(); } throw error; }
          done += asset.size;
          if (!failed && !view.classList.contains('hidden')) progress();
        }
      }));
      const got = new Set((await staging.keys()).map(pathOf));
      if (!wanted.every(key => got.has(key))) throw new Error('staging pack incomplete');
      await store(await caches.open(META), '/active', new Response(JSON.stringify({ version: manifest.version, cache: stagingName })));
    } catch (error) {
      await caches.delete(stagingName).catch(() => {});
      throw error;
    } finally { clearTimeout(timer); }
    await dropPacks(stagingName);
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
    navigator.serviceWorker?.register('/sw.js').catch(error => console.warn('리소스 캐시 워커 등록 실패:', error));
    for (;;) {
      try { await syncPack(); return; }
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
