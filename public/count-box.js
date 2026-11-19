// 1.10.370 개수 칸 (사용자 「무조건 최대계수로 들어가고 거기서 내리는 구조인데, 개수 딱 내가 몇개인지 쓸 수 있는 칸 추가해.」): one control
// wherever a stack's count is chosen -- − [n] + (and what the place adds, 전부) -- the box typed into (the number keypad on a
// phone, 16px so it never zooms the page), set on Enter or on leaving it: kept in 1..max, 0 or empty takes the row away.
// `parse` alone is the rule (test/count-box.test.js); `make` builds it for app.js.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CountBox = api;
}(typeof self !== 'undefined' ? self : this, () => {
  // what was typed -> the count: 0 to take it away, else 1..max; `was` kept for what is not a number
  function parse(text, max, was = 1) {
    const s = String(text ?? '').replace(/[\s,]/g, '').replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0));
    const top = Math.max(1, Math.floor(Number(max) || 1));
    if (s === '' || /^0+$/.test(s)) return 0;
    if (!/^\d+$/.test(s)) return Math.max(1, Math.min(top, Math.floor(Number(was) || 1)));
    return Math.max(1, Math.min(top, Number(s)));
  }
  // − [n] + : onSet(count) with the new count (0: take away); `zero` false keeps 1 at least (a buy)
  function make({ value = 1, max = 1, label = '개수', onSet, zero = true, step = 1 } = {}) {
    const doc = globalThis.document; const wrap = doc.createElement('span'); wrap.className = 'countBox';
    let cur = value; /* (left unchanged: nothing redrawn -- a click on − or + right after still lands) */
    const set = (n) => { const v = zero ? n : Math.max(1, n); input.value = String(v || ''); if (v === cur) return; cur = v; onSet?.(v); };
    /* (1.10.374 Codex 봇 #521: a number typed, then − or + pressed -- the box's leaving set it and drew the row anew, the press lost. The buttons
       never take the focus now (the box is not left), and they count from what is typed) */
    const btn = (text, aria, d) => { const b = doc.createElement('button'); b.type = 'button'; b.className = 'ghost tiny'; b.textContent = text; b.setAttribute('aria-label', aria); b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', () => { done = true; set(Math.max(zero ? 0 : 1, Math.min(max, (parse(input.value, max, cur) || 0) + d))); }); return b; };
    const input = doc.createElement('input'); input.type = 'text'; input.inputMode = 'numeric'; input.pattern = '[0-9]*'; input.autocomplete = 'off'; input.enterKeyHint = 'done';
    input.className = 'countBoxInput'; input.value = String(value); input.setAttribute('aria-label', `${label} (1~${max})`); input.size = String(max).length + 1;
    let done = false; const commit = () => { if (done) return; done = true; set(parse(input.value, max, cur)); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); input.blur(); } e.stopPropagation(); }); /* (the island's keys -- I, M, 1~5 -- not while typing) */
    input.addEventListener('focus', () => { done = false; input.select(); });
    input.addEventListener('blur', commit);
    wrap.append(btn('−', `${label} 하나 덜`, -step), input, btn('+', `${label} 하나 더`, step));
    wrap.count = () => parse(input.value, max, cur) || cur; /* (what it shows now -- typed and not yet left, too) */
    wrap.setCount = (n) => set(Math.max(zero ? 0 : 1, Math.min(max, Math.floor(Number(n) || 0))));
    return wrap;
  }
  return { parse, make };
}));
