'use strict';
// 1.10.363 메모리 (운영 OOM 2026-11-18 13:18Z, Render 512 MiB): a [mem] line every 5 minutes -- rss, heapUsed, external,
// arrayBuffers, the share of the limit and the biggest of the server's Maps/Sets by entry count -- and one more the moment rss
// crosses 80 % of the limit going up (again only after it has fallen under 75 %), so the next climb shows what grew.
const MB = 1048576;

function memLine(mem, limitMb, sizes = {}, tag = '') {
  const mb = (n) => Math.round((Number(n) || 0) / MB);
  const top = Object.entries(sizes).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}=${n}`).join(' ');
  return `[mem]${tag ? ` ${tag}` : ''} rss ${mb(mem.rss)} heapUsed ${mb(mem.heapUsed)} heapTotal ${mb(mem.heapTotal)} external ${mb(mem.external)} arrayBuffers ${mb(mem.arrayBuffers)} MB · ${Math.round((mem.rss / MB / limitMb) * 100)}% of ${limitMb}${top ? ` · ${top}` : ''}`;
}

// read(): process.memoryUsage-like; sizes(): { name: count }; log(line). Returns { tick(), check(), stop() } -- the timers call them.
function createMemWatch({ limitMb = 512, everyMs = 5 * 60 * 1000, checkMs = 15 * 1000, read = () => process.memoryUsage(), sizes = () => ({}), log = console.log, timers = true } = {}) {
  let high = false;
  const safeSizes = () => { try { return sizes(); } catch { return {}; } };
  const tick = () => { const line = memLine(read(), limitMb, safeSizes()); log(line); return line; };
  const check = () => {
    const m = read(); const share = m.rss / MB / limitMb;
    if (!high && share >= 0.8) { high = true; const line = memLine(m, limitMb, safeSizes(), 'over 80%'); log(line); return line; }
    if (high && share < 0.75) high = false;
    return null;
  };
  const handles = timers ? [setInterval(tick, everyMs), setInterval(check, checkMs)] : [];
  for (const h of handles) h.unref?.();
  return { tick, check, stop: () => handles.forEach(clearInterval) };
}

module.exports = { memLine, createMemWatch };
