'use strict';
// 1.10.324 스스로 알려 주는 섬 (gamecenter-notes docs/direction-ideas-20261110.md ②, 사용자 7A): the screens' own errors and how
// fast they draw, sent by the page without anyone writing a 문제 기록, summed here and logged once a day as `[client]` (Render's
// log, as [economy]). Never an account, a name, a place or a chat: an error's first line (addresses, ids and long tokens
// blanked), the device kind (pc or phone), the frame rate and the screen tier. Bounded: 200 kinds of error, 5,000 frame samples.
const MAX_TEXT = 200; const MAX_KINDS = 200; const MAX_PERF = 5000; const TOP = 20;
function clean(text) {
  return String(text ?? '').split('\n')[0]
    .replace(/https?:\/\/[^\s)'"]+/g, (u) => u.replace(/^https?:\/\/[^/]+/, '').replace(/[?#].*$/, '')) // (the address's path only)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/[A-Za-z0-9_-]{24,}/g, '<id>') // (a session token, a long key)
    .replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}
function createReports() {
  let errors = new Map(); let perf = { pc: [], phone: [] }; let reports = 0;
  function add(r) {
    const device = r?.device === 'phone' ? 'phone' : 'pc';
    if (r?.kind === 'error') {
      const text = clean(r.text); if (!text) return false;
      let e = errors.get(text); if (!e) { if (errors.size >= MAX_KINDS) return false; e = { n: 0, pc: 0, phone: 0 }; errors.set(text, e); }
      e.n += 1; e[device] += 1; reports += 1; return true;
    }
    if (r?.kind === 'perf') {
      const fps = Number(r.fps); if (!(fps > 0 && fps < 1000) || perf[device].length >= MAX_PERF) return false;
      const tier = [0, 1, 2].includes(r.tier) ? r.tier : null; const scale = Number.isFinite(Number(r.scale)) ? Math.max(10, Math.min(200, Math.round(Number(r.scale)))) : null;
      perf[device].push({ fps: Math.round(fps * 10) / 10, tier, scale }); reports += 1; return true;
    }
    return false;
  }
  const at = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : null);
  function stats(list) {
    const f = list.map((x) => x.fps).sort((a, b) => a - b); const tiers = { 0: 0, 1: 0, 2: 0 }; for (const x of list) if (x.tier !== null) tiers[x.tier] += 1;
    return { n: list.length, p10: at(f, 10), p50: at(f, 50), p90: at(f, 90), slow: list.length ? Math.round((list.filter((x) => x.fps < 20).length / list.length) * 100) : 0, tiers };
  }
  function summary(day, version = '') {
    const top = [...errors.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, TOP).map(([text, e]) => ({ text, n: e.n, pc: e.pc, phone: e.phone }));
    return { day, version, reports, kinds: errors.size, errors: top, perf: { pc: stats(perf.pc), phone: stats(perf.phone) } };
  }
  function reset() { errors = new Map(); perf = { pc: [], phone: [] }; reports = 0; }
  // (1.10.352: kept over a restart -- what was summed, as plain data; taken up again only as far as the limits allow)
  const state = () => ({ errors: [...errors.entries()], perf, reports });
  function restore(s) { reset(); if (!s || typeof s !== 'object') return; for (const [text, e] of Array.isArray(s.errors) ? s.errors.slice(0, MAX_KINDS) : []) { const t = clean(text); if (t && e && Number.isFinite(e.n)) errors.set(t, { n: e.n | 0, pc: e.pc | 0, phone: e.phone | 0 }); } for (const d of ['pc', 'phone']) perf[d] = (Array.isArray(s.perf?.[d]) ? s.perf[d] : []).slice(0, MAX_PERF).filter((x) => Number(x?.fps) > 0); reports = Number(s.reports) | 0; }
  return { add, summary, reset, state, restore, count: () => reports, line: (day, version) => `[client] ${JSON.stringify(summary(day, version))}` };
}
module.exports = { createReports, clean, MAX_TEXT };
