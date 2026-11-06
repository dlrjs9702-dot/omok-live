'use strict';

// v1.10.256 주소 옮기기 (gamecenter-notes docs/messenger-speed-photo-20261103.md 14·15절): the old service, MOVED_TO set,
// never opens the database (the new one has it -- two servers on one database would each think they alone write it) and
// answers only this: a page asking for the island or the messenger gets 「옮겼어요」 and the new address (3 s, then on);
// an API call 410 with the new address; an entry file's POST /guest-entry 307 to the same path there (body and all, so
// files handed out before still open); /health its version and where it went.
const http = require('node:http');
const { version } = require('../package.json');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** where a request on the old address should go on the new one, and what to say */
function movedTarget(to, pathname) {
  const base = String(to).replace(/\/$/, '');
  if (pathname === '/messenger' || pathname === '/messenger.html') return { url: `${base}/messenger`, what: '메신저', auto: false }; // (an installed old messenger app: no jump out of it)
  return { url: `${base}/island/`, what: '아일랜드', auto: true };
}

function movedPage(to, pathname) {
  const t = movedTarget(to, pathname);
  const shown = t.url.replace(/^https?:\/\//, '');
  const note = t.what === '메신저'
    ? '새 주소에서 메신저 앱을 다시 설치하고, 알림을 한 번 다시 허용해 주세요. 이 옛 메신저 앱은 지워도 돼요.'
    : '앱을 새로 설치하고 한 번 다시 로그인해 주세요. 계정·기록·집·포인트는 그대로예요. 3초 뒤 새 주소로 가요.';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">${t.auto ? `<meta http-equiv="refresh" content="3;url=${esc(t.url)}">` : ''}<title>${t.what}가 새 주소로 옮겼어요</title><style>body{font-family:system-ui,sans-serif;background:#0b1220;color:#f8fafc;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box}.box{max-width:460px;padding:30px 24px;background:#172033;border-radius:20px;text-align:center}h1{font-size:1.35rem;margin:0 0 12px}p{color:#cbd5e1;line-height:1.6;margin:0 0 18px}code{color:#fde68a;word-break:break-all}a.go{display:inline-block;padding:14px 22px;border-radius:14px;background:#2563eb;color:#fff;font-weight:800;text-decoration:none}</style></head><body><main class="box"><h1>${t.what}가 새 주소로 옮겼어요</h1><p><code>${esc(shown)}</code></p><p>${note}</p><a class="go" href="${esc(t.url)}">새 주소로 가기</a></main></body></html>`;
}

function movedHandler(to) {
  const base = String(to).replace(/\/$/, '');
  return (req, res) => {
    const { pathname, search } = new URL(req.url, 'http://x');
    const head = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
    if (pathname === '/health') { const body = JSON.stringify({ ok: true, version, moved: base }); res.writeHead(200, { ...head, 'Content-Type': 'application/json; charset=utf-8' }); return res.end(body); }
    if (pathname === '/guest-entry') { res.writeHead(307, { ...head, Location: `${base}/guest-entry${search}` }); return res.end(); } // (307: the POST and its token go along)
    if (pathname.startsWith('/api/')) { const body = JSON.stringify({ error: 'MOVED', message: `새 주소로 옮겼어요: ${base}`, to: base }); res.writeHead(410, { ...head, 'Content-Type': 'application/json; charset=utf-8' }); return res.end(body); }
    const html = movedPage(base, pathname);
    res.writeHead(200, { ...head, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" });
    return res.end(html);
  };
}

function startMoved({ to, port, host }) {
  const server = http.createServer(movedHandler(to));
  server.listen(port, host, () => console.log(`[moved] v${version} 옛 주소 안내 → ${to} (DB 연결 없음) http://${host}:${port}`));
  return server;
}

module.exports = { movedTarget, movedPage, movedHandler, startMoved };
