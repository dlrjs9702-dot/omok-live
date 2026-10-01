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
  // pal = the tile colours of this skin: { black: [top, bottom, text, border], white: [...] }. The dark tile and the light
  // tile always stay far apart (tested: 7:1 between the two bodies, 4.5:1 for each digit on its own tile).
  const tileStyle = (key, deco, pal) => (color, revealed) => {
    const [a, b, text, border] = pal[color];
    return { backgroundImage: `${S.h.img(`dv:${key}:${color}:${revealed ? 1 : 0}`, W, H, (c) => edge(c, color, (ctx, dark) => deco(ctx, dark, revealed)))}, linear-gradient(145deg,${a},${b})`, backgroundSize: '100% 100%, 100% 100%', backgroundRepeat: 'no-repeat', color: text, borderColor: border };
  };

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
      const pp = d.pal[color]; const grd = ctx.createLinearGradient(x, y, x + tw, y + th); grd.addColorStop(0, pp[0]); grd.addColorStop(1, pp[1]); ctx.fillStyle = grd; ctx.beginPath(); ctx.roundRect(x, y, tw, th, 8); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, tw, th, 8); ctx.clip(); ctx.translate(x, y); ctx.scale(tw / W, th / H); d.deco(ctx, color, rev); ctx.restore();
      ctx.fillStyle = d.pal[color][2]; ctx.font = `900 ${th * .36}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, cx, h / 2 + 2);
    });
    if (d.fx) { ctx.save(); ctx.translate(w * .55 - 44, h / 2 - 60); d.fx(ctx, 88, 120, .45); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) { S.def(skinId).panel(ctx, w, h); }
  const piece = (deco, key, fx, pal) => ({ pal, tile: tileStyle(key, deco, pal), deco: (ctx, color, revealed) => edge(ctx, color, (c, dark) => deco(c, dark, revealed)), fx, preview: previewTile });
  const theme = (panel, frame) => ({ panel, frame, preview: previewTheme });
  const P = (d1, d2, dt, db, l1, l2, lt, lb) => ({ black: [d1, d2, dt, db], white: [l1, l2, lt, lb] });
  S.define({
    davinci_c1: piece(domino, 'c1', null, P('#2e2e38', '#15151b', '#ffffff', '#8a8a9a', '#f9f3de', '#e7ddbe', '#1f1a10', '#c2b58a')),
    davinci_c2: piece(lock, 'c2', null, P('#313a47', '#161a21', '#ffffff', '#9aa8ba', '#f4ecd2', '#e8dba8', '#2a2008', '#b39a52')),
    davinci_c3: piece(runes, 'c3', null, P('#2f3a54', '#141a2c', '#ffffff', '#8fa0c8', '#eceff2', '#d2d9e0', '#1c2430', '#9aa8b8')),
    davinci_c4: piece(plaque, 'c4', null, P('#0f4d30', '#06281a', '#ffffff', '#c9a24a', '#fcf7e8', '#ece1ba', '#221a06', '#c9a24a')),
    davinci_c5: piece(file, 'c5', null, P('#3b2b1d', '#1b120a', '#ffffff', '#a88a66', '#f5e4b4', '#e2c986', '#2a1a06', '#b8955a')),
    davinci_p1: piece(gears, 'p1', burst('240,193,78'), P('#4a3416', '#221608', '#fff3cf', '#e0b23e', '#f8eecb', '#e6d290', '#2a1c04', '#b8902a')),
    davinci_p2: piece(glass, 'p2', burst('150,220,255'), P('#1d3557', '#0a1424', '#ffffff', '#78c4ee', '#f0f8ff', '#d2e5f4', '#0f2236', '#6aa8d0')),
    davinci_p3: piece(holoKey, 'p3', burst('110,220,255'), P('#0f3b46', '#04181d', '#e6fdff', '#4fd0ff', '#ebfcff', '#c6eef7', '#053040', '#3aa8cc')),
    davinci_t1: theme(library, { borderColor: '#c9a24a', boxShadow: 'inset 0 0 0 3px #3b2412, 0 0 0 2px #c9a24a' }),
    davinci_t2: theme(vaultRoom, { borderColor: '#c8d2e1', boxShadow: 'inset 0 0 0 3px #2b323c, 0 0 14px rgba(200,210,225,.3)' }),
    davinci_l1: piece(sealed, 'l1', sealFx, P('#2b1f5e', '#0f0a2c', '#ffeaa8', '#f0c14e', '#fff8df', '#f1dca2', '#3a2a00', '#c9a24a')),
  });
}());
