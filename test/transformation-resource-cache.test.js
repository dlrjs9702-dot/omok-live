'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto, createHash } = require('node:crypto');
const transformations = require('../public/plaza/character-transformations');

function worker(body) {
  const listeners = {}, files = new Map(); let downloads = 0, refuseWrites = false;
  const cache = {
    match: async key => files.get(key)?.clone() || null,
    put: async (key, response) => { if (refuseWrites) throw Error('storage full'); files.set(key, response.clone()); },
  };
  const context = {
    self: { location: { origin: 'https://island.test' }, addEventListener: (name, callback) => { listeners[name] = callback; } },
    URL, Response, crypto: webcrypto,
    caches: { match: async () => new Response(JSON.stringify({ cache: 'gc-res:files' })), has: async () => true, open: async () => cache },
    fetch: async () => { downloads++; const response = new Response(body, { headers: { 'Content-Type': 'model/gltf-binary' } }); Object.defineProperty(response, 'type', { value: 'basic' }); return response; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8'), context);
  return {
    files, downloads: () => downloads, refuseWrites: () => { refuseWrites = true; },
    async request(url, options = {}) {
      let response; const pending = [];
      listeners.fetch({ request: new Request(new URL(url, 'https://island.test'), options),
        respondWith: promise => { response = promise; }, waitUntil: promise => pending.push(promise) });
      if (!response) return null;
      const result = await response; await Promise.all(pending); return result;
    },
  };
}

test('변신 GLB 캐시: 착용 시만 실제 파일을 검증·저장하고 다음 요청은 같은 revision 재사용', async () => {
  const url = transformations.find('kuromi').variants.current.lowUrl;
  const body = fs.readFileSync(path.join(__dirname, '../public', url));
  const rev = createHash('sha256').update(body).digest('hex').slice(0, 16), runtime = worker(body);
  assert.equal(runtime.files.size, 0, 'no complete body is downloaded by the worker before use');
  const key = `${url}?rev=${rev}`, response = await runtime.request(key);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), body);
  assert.equal(runtime.downloads(), 1); assert.deepEqual([...runtime.files.keys()], [key]);
  assert.deepEqual(Buffer.from(await (await runtime.request(key)).arrayBuffer()), body);
  assert.equal(runtime.downloads(), 1, 'same model revision needs no network');
  await assert.rejects(runtime.request(`${url}?rev=0000000000000000`), /Resource revision mismatch/);
  assert.equal(runtime.files.size, 1, 'new bytes never stored under an old revision');
  runtime.refuseWrites();
  const second = transformations.find('kuromi').variants.native.lowUrl;
  assert.deepEqual(Buffer.from(await (await runtime.request(`${second}?rev=${rev}`)).arrayBuffer()), body, 'storage refusal still delivers hash verified public data');
  assert.equal(runtime.files.size, 1);
});

test('변신 선택·로그인·개인 정보·HTML·JS는 revision을 붙여도 리소스 캐시에서 다루지 않는다', async () => {
  const runtime = worker(Buffer.from('private'));
  for (const url of ['/api/state?rev=1111111111111111', '/api/avatar/transformation?rev=1111111111111111', '/?rev=1111111111111111',
    '/assets/code.js?rev=1111111111111111', '/assets/view.html?rev=1111111111111111', '/assets/style.css?rev=1111111111111111',
    'https://other.test/assets/private.glb?rev=1111111111111111', '/assets/island/characters/native/animal-cat.glb']) {
    assert.equal(await runtime.request(url), null, url);
  }
  assert.equal(await runtime.request('/assets/island/characters/native/animal-cat.glb?rev=1111111111111111', { method: 'POST' }), null);
  assert.equal(runtime.downloads(), 0); assert.equal(runtime.files.size, 0);
});
