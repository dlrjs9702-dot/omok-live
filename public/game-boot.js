(() => {
  'use strict';

  // v1.10.14 game boot. GameBoot.ready resolves once the game may start:
  //  1. Browser: only the browsers the server lists in body[data-browsers] (production: Google Chrome) get past this;
  //     the rest see one line asking for Chrome and the game never starts.
  //  2. Resources: the pack manifest the server put in this page (#assetManifest, built from the same deploy as the
  //     code) is made complete in Cache Storage. Entries are keyed `<url>?rev=<content hash>`, so only new or changed
  //     files are downloaded, each is stored only after its hash checked out, and nothing in use is ever overwritten:
  //     a failed or interrupted update leaves the previous entries intact and just shows "retry". Entries the manifest
  //     no longer lists are deleted after a complete pass. public/sw.js answers asset requests from these entries.
  // Without Service Worker / Cache Storage / crypto.subtle, or when storage is full, the game starts uncached
  // (assets come from the network as before) -- the cache is an optimisation, never a reason not to play.
  const CACHE = 'gc-assets-v1';
  const PARALLEL = 6;
  const view = document.getElementById('bootView');
  const title = document.getElementById('bootTitle');
  const percent = document.getElementById('bootPercent');
  const bar = document.getElementById('bootBar');
  const fill = document.getElementById('bootBarFill');
  const retry = document.getElementById('bootRetry');

  let manifest = { version: '', assets: [] };
  const manifestEl = document.getElementById('assetManifest');
  try { manifest = JSON.parse(manifestEl?.textContent || '') || manifest; } catch {}
  manifestEl?.remove(); // read once; the page markup stays free of file lists (spectator checks scan it for card names)
  const revs = new Map(manifest.assets.map(asset => [asset.url, asset.rev]));
  const keyOf = asset => `${asset.url}?rev=${asset.rev}`;
  // The URL the game should use for a pack asset; unknown paths are returned unchanged.
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

  const cacheSupported = () => window.isSecureContext && 'serviceWorker' in navigator && 'caches' in window && Boolean(crypto?.subtle);

  async function sha16(buffer) {
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    return Array.from(bytes.slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
  }

  // Network and content failures are `retryable` (the retry button); anything else means the cache is unusable here.
  async function download(cache, asset) {
    const key = keyOf(asset);
    let body, type;
    try {
      const response = await fetch(key, { cache: 'no-cache', credentials: 'same-origin' });
      if (!response.ok) throw new Error(`${asset.url} ${response.status}`);
      body = await response.arrayBuffer();
      type = response.headers.get('Content-Type') || 'application/octet-stream';
      if (await sha16(body) !== asset.rev) throw new Error(`${asset.url} revision mismatch`);
    } catch (error) { throw Object.assign(error, { retryable: true }); }
    await cache.put(key, new Response(body, { headers: { 'Content-Type': type } }));
  }

  // Makes every manifest entry present; resolves with how many files were downloaded.
  async function syncPack() {
    const cache = await caches.open(CACHE);
    const have = new Set((await cache.keys()).map(request => { const url = new URL(request.url); return url.pathname + url.search; }));
    const missing = manifest.assets.filter(asset => !have.has(keyOf(asset)));
    if (missing.length) {
      const needed = missing.reduce((sum, asset) => sum + asset.size, 0);
      const estimate = await navigator.storage?.estimate?.().catch(() => null);
      if (estimate?.quota && estimate.quota - (estimate.usage || 0) < needed) throw Object.assign(new Error('storage full'), { name: 'QuotaExceededError' });
      let done = 0;
      let failed = false;
      const progress = () => show('게임 리소스 준비 중', { progress: needed ? done / needed : 1 });
      const timer = setTimeout(progress, 250); // a small update finishes before anything is shown
      try {
        const queue = [...missing];
        await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
          while (queue.length && !failed) {
            const asset = queue.shift();
            try { await download(cache, asset); } catch (error) { failed = true; throw error; }
            done += asset.size;
            if (!failed && !view.classList.contains('hidden')) progress();
          }
        }));
      } finally { clearTimeout(timer); }
    }
    // Only after a complete pass: drop revisions and files the manifest no longer lists, and older cache generations.
    const wanted = new Set(manifest.assets.map(keyOf));
    for (const request of await cache.keys()) { const url = new URL(request.url); if (!wanted.has(url.pathname + url.search)) await cache.delete(request); }
    for (const name of await caches.keys()) if (name.startsWith('gc-assets-') && name !== CACHE) await caches.delete(name);
    return missing.length;
  }

  async function prepare() {
    if (!cacheSupported() || !manifest.assets.length) return;
    navigator.serviceWorker.register('/sw.js').catch(error => console.warn('리소스 캐시 워커 등록 실패:', error));
    navigator.storage?.persisted?.().then(on => on || navigator.storage.persist()).catch(() => {}); // best effort only
    for (;;) {
      try { await syncPack(); return; }
      catch (error) {
        if (!error?.retryable) { console.warn('리소스 캐시 없이 시작합니다:', error); return; } // e.g. storage full
        console.warn('게임 리소스 준비 실패:', error);
        show('게임 리소스 준비 실패', { canRetry: true });
        await new Promise(resolve => retry.addEventListener('click', resolve, { once: true }));
        show('게임 리소스 준비 중', { progress: 0 });
      }
    }
  }

  const ready = browserAllowed()
    ? prepare().catch(error => console.warn('리소스 캐시를 사용할 수 없습니다:', error)).then(() => view.classList.add('hidden'))
    : (show('Google Chrome으로 접속해 주세요'), new Promise(() => {}));

  window.GameBoot = { ready, assetUrl, manifest };
})();
