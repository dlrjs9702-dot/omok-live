'use strict';
// 1.10.363 메모리 (운영 OOM 11-18): the page each entry gets (index.html with the asset manifest inside, ~550 KB) was made
// by eight .replace() calls over the whole page -- ~2.3 MB of strings and bytes for every page load, all at once when
// everyone comes back after a restart. Now the page is cut once into fixed byte pieces (the manifest already in) and the
// few per-session values are the only bytes made per load; the pieces are shared, never changed.
//
// split(template, keys, fixed): `keys` the placeholders (each once in the template, first one taken, as .replace did);
// `fixed` { key: text } filled in now (the rest stay as their names). Returns [Buffer | key, ...], neighbouring bytes joined.
function split(template, keys, fixed = {}) {
  const at = keys.map((key) => [template.indexOf(key), key]).filter(([i]) => i >= 0).sort((a, b) => a[0] - b[0]);
  const parts = []; let text = ''; let from = 0;
  const flush = () => { if (text) parts.push(Buffer.from(text, 'utf8')); text = ''; };
  for (const [i, key] of at) {
    text += template.slice(from, i); from = i + key.length;
    if (Object.prototype.hasOwnProperty.call(fixed, key)) text += fixed[key];
    else { flush(); parts.push(key); }
  }
  text += template.slice(from); flush();
  return parts;
}

// fill(parts, values, escape): the pieces to send -- the shared bytes as they are, each key's value escaped and encoded
function fill(parts, values = {}, escape = (s) => s) {
  const chunks = parts.map((p) => (typeof p === 'string' ? Buffer.from(escape(values[p] ?? ''), 'utf8') : p));
  let length = 0; for (const c of chunks) length += c.length;
  return { chunks, length };
}

module.exports = { split, fill };
