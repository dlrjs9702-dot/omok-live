// 다빈치 코드 skins (v1.7.40): a skin decorates the tiles of its owner's rack and the rack itself. A tile keeps its
// colour (black/white) and its number: the decoration lives on the edges and corners and leaves the centre clear, so
// the digit, the colour and the revealed/hidden state read exactly as before.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, starPath } = S.h;
  const W = 88; const H = 120; // the picture a tile is decorated with (scaled to the tile)
  const edge = (c, color, fn) => { const dark = color === 'black'; fn(c, dark); };
  const ink = (dark, a = .35) => (dark ? `rgba(255,255,255,${a})` : `rgba(20,30,50,${a})`);

  // each skin: deco(ctx, dark, revealed) paints on a W x H transparent picture; hand = style of the rack
  const tileStyle = (key, deco) => (color, revealed) => ({ backgroundImage: S.h.img(`dv:${key}:${color}:${revealed ? 1 : 0}`, W, H, (c) => edge(c, color, (ctx, dark) => deco(ctx, dark, revealed))), backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat' });

  // ---- commons ----
  const pips = (ctx, x, y, dark, n = 3) => { ctx.fillStyle = ink(dark, .55); for (let i = 0; i < n; i += 1) { ctx.beginPath(); ctx.arc(x + (i % 2) * 8, y + i * 6, 2.2, 0, TAU); ctx.fill(); } };
  const domino = (ctx, dark) => { pips(ctx, 10, 10, dark, 3); pips(ctx, W - 18, H - 28, dark, 3); ctx.strokeStyle = ink(dark, .25); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(8, 22); ctx.lineTo(W - 8, 22); ctx.moveTo(8, H - 22); ctx.lineTo(W - 8, H - 22); ctx.stroke(); };
  const lock = (ctx, dark) => { ctx.fillStyle = ink(dark, .5); for (const [x, y] of [[8, 8], [W - 8, 8], [8, H - 8], [W - 8, H - 8]]) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); } ctx.beginPath(); ctx.arc(W / 2, H - 14, 4, 0, TAU); ctx.fill(); ctx.fillRect(W / 2 - 1.5, H - 14, 3, 8); };
  const runes = (ctx, dark) => { ctx.strokeStyle = ink(dark, .5); ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let i = 0; i < 3; i += 1) { const x = 20 + i * 24; ctx.beginPath(); ctx.moveTo(x, 8); ctx.lineTo(x + 6, 20); ctx.lineTo(x, 26); ctx.moveTo(x, H - 26); ctx.lineTo(x + 6, H - 14); ctx.lineTo(x, H - 8); ctx.stroke(); } };
  const plaque = (ctx, dark) => { ctx.strokeStyle = dark ? 'rgba(240,193,78,.7)' : 'rgba(150,110,20,.7)'; ctx.lineWidth = 3; ctx.strokeRect(5, 5, W - 10, H - 10); ctx.fillStyle = ctx.strokeStyle; starPath(ctx, 14, 16, 5, 2, 4); ctx.fill(); starPath(ctx, W - 14, H - 16, 5, 2, 4); ctx.fill(); };
  const file = (ctx, dark) => { ctx.fillStyle = dark ? 'rgba(220,60,60,.6)' : 'rgba(190,40,40,.55)'; ctx.fillRect(W - 30, 4, 26, 10); ctx.fillStyle = ink(dark, .3); for (let i = 0; i < 3; i += 1) ctx.fillRect(10, H - 22 + i * 5, 26, 1.5); };

  // ---- premiums ----
  const gears = (ctx, dark) => { ctx.strokeStyle = dark ? 'rgba(240,193,78,.7)' : 'rgba(150,110,20,.7)'; ctx.lineWidth = 2; for (const [x, y, r] of [[12, 12, 7], [W - 12, H - 12, 7]]) { ctx.beginPath(); for (let i = 0; i < 16; i += 1) { const a = i * TAU / 16; const rr = i % 2 ? r : r + 3; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.stroke(); } };
  const glass = (ctx, dark) => { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(.3, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * .3); ctx.strokeStyle = dark ? 'rgba(150,220,255,.6)' : 'rgba(60,120,170,.55)'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, W - 4, H - 4); };
  const holoKey = (ctx, dark) => { ctx.fillStyle = 'rgba(110,220,255,.18)'; for (let y = 0; y < H; y += 6) { if (y > H * .3 && y < H * .7) continue; ctx.fillRect(0, y, W, 2); } ctx.strokeStyle = dark ? 'rgba(110,220,255,.85)' : 'rgba(30,140,190,.8)'; ctx.lineWidth = 3; ctx.strokeRect(2, 2, W - 4, H - 4); };
  const burst = (col) => (ctx, w, h, t) => { const R = rng(3); for (let i = 0; i < 10; i += 1) { const a = i * TAU / 10 + R(); const d = 6 + 30 * t; ctx.fillStyle = `rgba(${col},${1 - t})`; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 2.6 * (1 - t) + .6, 0, TAU); ctx.fill(); } ctx.strokeStyle = `rgba(${col},${(1 - t) * .9})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2, h / 2, 10 + t * 26, 0, TAU); ctx.stroke(); };

  // ---- legend: 금단의 암호 -- hidden tiles carry a gold seal, a right guess breaks it ----
  const sealed = (ctx, dark, revealed) => {
    ctx.strokeStyle = dark ? 'rgba(240,193,78,.85)' : 'rgba(150,110,20,.85)'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, W - 8, H - 8);
    if (revealed) { ctx.fillStyle = ctx.strokeStyle; starPath(ctx, W / 2, 12, 6, 2, 4); ctx.fill(); return; }
    for (const [x, y] of [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]]) { ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke(); }
  };
  const sealFx = (ctx, w, h, t) => { const R = rng(9); for (let i = 0; i < 14; i += 1) { const a = R() * TAU; const d = 8 + 40 * t * (.5 + R()); ctx.save(); ctx.translate(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d); ctx.rotate(a + t * 5); ctx.fillStyle = `rgba(255,214,102,${1 - t})`; ctx.fillRect(-3, -2, 6, 4); ctx.restore(); } ctx.strokeStyle = `rgba(255,226,140,${(1 - t) * .9})`; ctx.lineWidth = 3; ctx.strokeRect(w * .25 - t * 8, h * .2 - t * 8, w * .5 + t * 16, h * .6 + t * 16); };

  // ---- room themes ----
  function library(ctx, w, h) { // 르네상스 서재
    ctx.fillStyle = '#3b2412'; ctx.fillRect(0, 0, w, h); const R = rng(31);
    for (let y = 10; y < h; y += 70) { ctx.fillStyle = '#2a190b'; ctx.fillRect(0, y + 52, w, 8); let x = 6; while (x < w - 10) { const bw = 10 + R() * 14; ctx.fillStyle = ['#7a2a2a', '#2a4a7a', '#3a6a3a', '#8a6a2a', '#5a2a6a'][(R() * 5) | 0]; ctx.fillRect(x, y + 8 + R() * 10, bw, 44); x += bw + 2; } }
    const g = ctx.createRadialGradient(w / 2, h, 10, w / 2, h, w * .7); g.addColorStop(0, 'rgba(255,200,120,.25)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function vaultRoom(ctx, w, h) { // 거대 금고실
    ctx.fillStyle = '#2b323c'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < w; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(200,210,225,.35)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * .42, 0, TAU); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * .3, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(200,210,225,.4)'; for (let i = 0; i < 12; i += 1) { const a = i * TAU / 12; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * Math.min(w, h) * .42, h / 2 + Math.sin(a) * Math.min(w, h) * .42, 6, 0, TAU); ctx.fill(); }
  }

  function previewTile(ctx, w, h, skinId) {
    const d = S.def(skinId); ctx.fillStyle = '#0b1324'; ctx.fillRect(0, 0, w, h); const th = h * .78; const tw = th * .72;
    [[w * .3, 'black', '7', true], [w * .55, 'white', '3', true], [w * .8, 'black', '?', false]].forEach(([cx, color, n, rev]) => {
      const x = cx - tw / 2; const y = (h - th) / 2;
      ctx.fillStyle = color === 'black' ? '#151b2a' : '#f4f1e8'; ctx.beginPath(); ctx.roundRect(x, y, tw, th, 8); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, tw, th, 8); ctx.clip(); ctx.translate(x, y); ctx.scale(tw / W, th / H); d.deco(ctx, color, rev); ctx.restore();
      ctx.fillStyle = color === 'black' ? '#f8fafc' : '#111827'; ctx.font = `900 ${th * .36}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, cx, h / 2 + 2);
    });
    if (d.fx) { ctx.save(); ctx.translate(w * .55 - 44, h / 2 - 60); d.fx(ctx, 88, 120, .45); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) { S.def(skinId).panel(ctx, w, h); }
  const piece = (deco, key, fx) => ({ tile: tileStyle(key, deco), deco: (ctx, color, revealed) => edge(ctx, color, (c, dark) => deco(c, dark, revealed)), fx, preview: previewTile });
  const theme = (panel, frame) => ({ panel, frame, preview: previewTheme });
  S.define({
    davinci_c1: piece(domino, 'c1'), davinci_c2: piece(lock, 'c2'), davinci_c3: piece(runes, 'c3'), davinci_c4: piece(plaque, 'c4'), davinci_c5: piece(file, 'c5'),
    davinci_p1: piece(gears, 'p1', burst('240,193,78')), davinci_p2: piece(glass, 'p2', burst('150,220,255')), davinci_p3: piece(holoKey, 'p3', burst('110,220,255')),
    davinci_t1: theme(library, { borderColor: '#c9a24a', boxShadow: 'inset 0 0 0 3px #3b2412, 0 0 0 2px #c9a24a' }),
    davinci_t2: theme(vaultRoom, { borderColor: '#c8d2e1', boxShadow: 'inset 0 0 0 3px #2b323c, 0 0 14px rgba(200,210,225,.3)' }),
    davinci_l1: piece(sealed, 'l1', sealFx),
  });
}());
