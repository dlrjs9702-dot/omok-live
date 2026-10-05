(() => {
  'use strict';

  // v1.6.99: the guest session lives in this tab's sessionStorage, so a refresh (which lands on
  // "/" without the entry form) resumes the same session and room instead of the gate. The server
  // defers the pagehide release briefly; a closed tab still frees the key a few seconds later.
  const STORAGE_KEY = 'gameCenterGuestSession';
  let token = document.body.dataset.session || '';
  let role = document.body.dataset.role || '';
  try {
    if (token && role === 'guest') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, label: document.body.dataset.label || '' }));
    } else if (!token) {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.token) {
        token = saved.token;
        role = 'guest';
        document.body.dataset.session = token;
        document.body.dataset.role = role;
        document.body.dataset.label = saved.label || '';
      }
    }
  } catch {}
  if (!token || role !== 'guest') return;

  let stopped = false;
  let timer = null;
  // v1.10.29: this page's id, so the server can tell a late release from the page before a reload (ignored once this
  // page has sent its heartbeat) from this page's own (server.js requestSessionRelease)
  const page = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`).slice(0, 64);

  async function heartbeat() {
    if (stopped) return;
    try {
      const res = await fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { 'X-Session-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ page }),
        cache: 'no-store',
        keepalive: true,
      });
      if (res.status === 401) { stop(); try { sessionStorage.removeItem(STORAGE_KEY); } catch {} }
    } catch {}
  }

  function stop() {
    stopped = true;
    clearInterval(timer);
    timer = null;
  }

  function release() {
    if (stopped) return;
    stop();
    try {
      const payload = new Blob([JSON.stringify({ sessionToken: token, page })], { type: 'application/json' });
      navigator.sendBeacon('/api/session/release', payload);
    } catch {}
  }

  heartbeat();
  timer = setInterval(heartbeat, 25000);
  window.addEventListener('pagehide', release, { once: true });
})();
