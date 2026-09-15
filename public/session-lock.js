(() => {
  'use strict';

  const token = document.body.dataset.session || '';
  const role = document.body.dataset.role || '';
  if (!token || role !== 'guest') return;

  let stopped = false;
  let timer = null;

  async function heartbeat() {
    if (stopped) return;
    try {
      const res = await fetch('/api/session/heartbeat', {
        method: 'POST',
        headers: { 'X-Session-Token': token, 'Content-Type': 'application/json' },
        body: '{}',
        cache: 'no-store',
        keepalive: true,
      });
      if (res.status === 401) stop();
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
      const payload = new Blob([JSON.stringify({ sessionToken: token })], { type: 'application/json' });
      navigator.sendBeacon('/api/session/release', payload);
    } catch {}
  }

  heartbeat();
  timer = setInterval(heartbeat, 25000);
  window.addEventListener('pagehide', release, { once: true });
})();
