// v1.10.61 두 세계 영웅전: the game's two big files from the R2 bucket gamecenter-games, for the game center page only.
// Names are the files' sha256 (a new build is a new name), so a response never changes: immutable for a year, kept by
// Workers Cache (wrangler.jsonc) and the browser. The wasm is stored brotli-compressed (8 MB, 39 MB raw) and sent as is;
// the game center is Chrome-only, and Chrome always accepts br. The pck is already compressed inside.
const ORIGINS = ['https://omok-live.onrender.com', 'http://127.0.0.1:3000', 'http://localhost:3000'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const cors = ORIGINS.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET' } });
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    const m = /^\/(herosurv\/[0-9a-f]{64})\.(wasm|pck)$/.exec(new URL(request.url).pathname);
    if (!m) return new Response('Not found', { status: 404 });
    const wasm = m[2] === 'wasm';
    const object = await env.BUCKET.get(`${m[1]}.${m[2]}${wasm ? '.br' : ''}`);
    if (!object) return new Response('Not found', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : object.body, {
      encodeBody: wasm ? 'manual' : 'automatic',
      headers: {
        ...cors,
        'Content-Type': wasm ? 'application/wasm' : 'application/octet-stream',
        ...(wasm ? { 'Content-Encoding': 'br' } : {}),
        'Content-Length': String(object.size),
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: object.httpEtag,
      },
    });
  },
};
