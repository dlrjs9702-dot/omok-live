'use strict';
// 366 로딩 팁 (사용자 「관리 화면에서 게임 팁 한줄을 내 맘대로 추가하게」): the defaults in code (총괄's 60, notes content-20261118
// loading-tips.json -- each shown only once what it tells of is in the game: `needs`), an admin's own lines kept on the server
// (worldValue loadingTips, live without a deploy) -- added, changed, removed, switched on and off -- and the defaults switched
// off one by one. 60 characters a line at most.
const crypto = require('node:crypto');
const DEFAULTS = Object.freeze(require('./loading-tips.json').map((t, i) => Object.freeze({ id: `d${i}`, text: t.text, topic: t.topic || null, needs: t.needs || null })));
const TEXT_MAX = 60; const MAX_OWN = 200;
// what the game has now (a default whose `needs` is not here waits)
const LIVE = new Set(['events', 'unstuck363', 'stars', 'gems']); /* (366: 광석 개편 2) */

const clean = (doc) => ({ off: Array.isArray(doc?.off) ? doc.off.filter((id) => typeof id === 'string') : [], own: Array.isArray(doc?.own) ? doc.own.filter((t) => t && typeof t.id === 'string' && typeof t.text === 'string') : [] });
// the lines the loading screen may show
function shown(doc) { const d = clean(doc); const off = new Set(d.off); return [...DEFAULTS.filter((t) => (!t.needs || LIVE.has(t.needs)) && !off.has(t.id)).map((t) => t.text), ...d.own.filter((t) => t.on !== false).map((t) => t.text)]; }
// the admin's list: every default (on, off, or waiting for its feature) and every own line
function adminView(doc) { const d = clean(doc); const off = new Set(d.off); return { defaults: DEFAULTS.map((t) => ({ ...t, on: !off.has(t.id), waiting: Boolean(t.needs && !LIVE.has(t.needs)) })), own: d.own.map((t) => ({ ...t, on: t.on !== false })), max: TEXT_MAX }; }
// one change -> { doc } or { error }: { add: text } | { id, text } | { id, on } | { id, remove: true }
function change(doc, body) {
  const d = clean(doc); const text = typeof body?.text === 'string' ? body.text.trim() : null;
  if (text !== null && (!text || [...text].length > TEXT_MAX)) return { error: 'TEXT' };
  if (body?.add != null) { const t = String(body.add).trim(); if (!t || [...t].length > TEXT_MAX) return { error: 'TEXT' }; if (d.own.length >= MAX_OWN) return { error: 'FULL' }; d.own.push({ id: `o${crypto.randomBytes(4).toString('hex')}`, text: t, on: true }); return { doc: d }; }
  const id = String(body?.id || ''); const isDefault = DEFAULTS.some((t) => t.id === id); const own = d.own.find((t) => t.id === id);
  if (!isDefault && !own) return { error: 'NO_TIP' };
  if (body.remove === true) { if (!own) return { error: 'DEFAULT' }; d.own = d.own.filter((t) => t.id !== id); return { doc: d }; }
  if (text !== null) { if (!own) return { error: 'DEFAULT' }; own.text = text; return { doc: d }; }
  if (typeof body.on === 'boolean') { if (own) own.on = body.on; else d.off = body.on ? d.off.filter((x) => x !== id) : [...new Set([...d.off, id])]; return { doc: d }; }
  return { error: 'NOTHING' };
}
module.exports = { DEFAULTS, TEXT_MAX, LIVE, shown, adminView, change };
