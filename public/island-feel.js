'use strict';
// 1.10.355 섬 미니게임 타격감 (gamecenter-notes docs/island-expansion-20261115.md 「캐기 미니게임 다듬기」, docs/fishing-minigames-
// 20261104.md 「낚시 미니게임 타격감」): what the mining and fishing games share on the page -- a word that pops and rises (쨍! 완벽!
// 툭 찰싹! 첨벙 찰방! a combo's number), a short shake of a panel or the picture, a buzz where a phone can, the sounds (room-sound's
// synth: the 효과음 setting), the catch flying into the bag, the screen's edge going red under strain. The 3D bits (stone chips,
// sparks, dust, splashes, a rare ore's light) are the scene's (plaza-scene feel*). 「동작 줄이기」 (gc.lessMotion, or the system's
// reduced motion on 'auto'): no shake, no buzz, the words without their rise; the sounds stay (their own setting).
(() => {
  const lessMotion = () => { let v = 'auto'; try { v = localStorage.getItem('gc.lessMotion') || 'auto'; } catch {} return v === 'on' || (v !== 'off' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)); };
  const sound = (kind, arg) => { try { return Boolean(window.RoomSound?.play(kind, arg)); } catch { return false; } };
  const vibrate = (ms) => { if (lessMotion()) return false; try { return Boolean(navigator.vibrate?.(ms)); } catch { return false; } };
  // a panel (or the 3D picture) jolted for a moment -- restarted if asked again before it ends
  function shake(el, hard = false) {
    if (!el || lessMotion()) return false;
    el.classList.remove('feelShake', 'feelShakeHard'); void el.offsetWidth; el.classList.add(hard ? 'feelShakeHard' : 'feelShake');
    clearTimeout(el.feelShakeTimer); el.feelShakeTimer = setTimeout(() => el.classList.remove('feelShake', 'feelShakeHard'), hard ? 260 : 160); return true;
  }
  // a word at a point of the page (client px): kind hit | perfect | miss | splash | combo | info -- a few divs kept and used again
  const words = []; let wordAt = 0; const shown = []; // (shown: the last few, for the tests)
  function word(text, x, y, kind = 'hit') {
    let w = words[wordAt % 6]; wordAt += 1;
    if (!w) { w = document.createElement('div'); w.setAttribute('aria-hidden', 'true'); words.push(w); }
    if (!w.isConnected) document.body.append(w);
    w.className = `feelWord feel-${kind}${lessMotion() ? ' still' : ''}`; w.textContent = text; w.style.left = `${Math.round(x)}px`; w.style.top = `${Math.round(y)}px`;
    void w.offsetWidth; w.classList.add('go'); clearTimeout(w.feelTimer); w.feelTimer = setTimeout(() => w.classList.remove('go'), 760);
    shown.push({ text, kind, at: Date.now() }); if (shown.length > 12) shown.shift(); return w;
  }
  // the caught thing (an emoji or a picture) from a point of the page into the bag's tab; the tab bumps when it lands
  function flyToBag(icon, x, y) {
    const bag = document.getElementById('islandBagTab'); const r = bag?.getBoundingClientRect?.();
    const to = r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth - 40, y: window.innerHeight - 40 };
    const el = document.createElement('div'); el.className = 'feelFly'; el.setAttribute('aria-hidden', 'true');
    if (/^\/|\.(png|svg|webp)$/.test(String(icon))) { const img = document.createElement('img'); img.src = icon; img.alt = ''; el.append(img); } else el.textContent = icon || '✨';
    el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`; document.body.append(el); sound('whoosh');
    const land = () => { el.remove(); if (bag) { bag.classList.remove('feelBump'); void bag.offsetWidth; bag.classList.add('feelBump'); setTimeout(() => bag.classList.remove('feelBump'), 300); } };
    if (lessMotion()) { setTimeout(land, 250); return el; }
    requestAnimationFrame(() => { el.style.transform = `translate(${Math.round(to.x - x)}px, ${Math.round(to.y - y)}px) scale(.55)`; el.style.opacity = '.85'; });
    setTimeout(land, 620); return el;
  }
  // the screen's edge red under a line's strain: 0 none .. 1 full
  let edgeEl = null;
  function edge(level) {
    const v = Math.max(0, Math.min(1, Number(level) || 0));
    if (!edgeEl) { if (!v) return; edgeEl = document.createElement('div'); edgeEl.className = 'feelEdge'; edgeEl.setAttribute('aria-hidden', 'true'); document.body.append(edgeEl); }
    edgeEl.style.opacity = String(lessMotion() ? Math.min(v, 0.5) : v); edgeEl.classList.toggle('beat', v >= 0.8 && !lessMotion());
  }
  window.IslandFeel = { lessMotion, sound, vibrate, shake, word, flyToBag, edge, shown: () => shown.slice() };
})();
