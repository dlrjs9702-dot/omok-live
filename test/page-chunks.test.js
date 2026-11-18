'use strict';
// 1.10.363 메모리: the entry page in shared pieces gives the same bytes as the eight .replace() calls did
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { split, fill } = require('../lib/page-chunks');

const KEYS = ['__SESSION_TOKEN__', '__SESSION_ROLE__', '__SESSION_LABEL__', '__SETUP_TICKET__', '__ACCOUNT_TOKEN__', '__ENTRY_NOTICE__', '__BROWSERS__', '__ASSET_MANIFEST__'];
const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const old = (t, b, manifest) => t.replace('__SESSION_TOKEN__', esc(b.sessionToken)).replace('__SESSION_ROLE__', esc(b.role)).replace('__SESSION_LABEL__', esc(b.label))
  .replace('__SETUP_TICKET__', esc(b.setupTicket)).replace('__ACCOUNT_TOKEN__', esc(b.accountToken)).replace('__ENTRY_NOTICE__', esc(b.entryNotice))
  .replace('__BROWSERS__', esc(b.browsers)).replace('__ASSET_MANIFEST__', () => manifest);

test('실제 index.html: 조각으로 만든 쪽 = 예전 replace 여덟 번 (한글·빈 값·특수 문자)', () => {
  const t = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  for (const k of KEYS) assert.equal(t.split(k).length, 2, `${k} 한 번`);
  const manifest = JSON.stringify({ enabled: true, version: 'v1', assets: [{ path: '/a<b>.glb', rev: 'x' }] }).replace(/</g, '\\u003c');
  const parts = split(t, KEYS, { __ASSET_MANIFEST__: manifest });
  assert.equal(parts.filter((p) => typeof p === 'string').length, 7, '세션 값 일곱 자리만 남음');
  for (const b of [{}, { sessionToken: 'tok', role: 'guest', label: '김<철>수 & "친구"', setupTicket: '', accountToken: 'acc', entryNotice: '안내', browsers: 'chrome safari' }]) {
    const { chunks, length } = fill(parts, { __SESSION_TOKEN__: b.sessionToken, __SESSION_ROLE__: b.role, __SESSION_LABEL__: b.label, __SETUP_TICKET__: b.setupTicket, __ACCOUNT_TOKEN__: b.accountToken, __ENTRY_NOTICE__: b.entryNotice, __BROWSERS__: b.browsers }, esc);
    const got = Buffer.concat(chunks); const want = Buffer.from(old(t, b, manifest), 'utf8');
    assert.equal(length, want.length); assert.ok(got.equals(want));
  }
});

test('같은 조각을 다시 써도 바뀌지 않고, 값 안의 $& 나 다른 자리 이름은 그대로 글자', () => {
  const parts = split('<a>__A__|__B__|__C__</a>', ['__C__', '__A__', '__B__'], { __C__: 'fixed' });
  assert.deepEqual(parts.map((p) => (typeof p === 'string' ? p : p.toString())), ['<a>', '__A__', '|', '__B__', '|fixed</a>']);
  const a = Buffer.concat(fill(parts, { __A__: '$&', __B__: '__A__' }).chunks).toString();
  assert.equal(a, '<a>$&|__A__|fixed</a>');
  assert.equal(Buffer.concat(fill(parts, {}).chunks).toString(), '<a>||fixed</a>', '처음 조각은 그대로');
});
