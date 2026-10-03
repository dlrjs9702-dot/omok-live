// 고스톱·맞고 skins (v1.7.42). The 48 hwatu faces are shared and never redrawn. A skin changes: the card BACK (opponents'
// hands and the deck), the seat frame, the captured-cards area, the tray under my hand, the throw effect, the special /
// go / win effects, and the room theme. Backs always stay dark enough to read as backs next to the light faces.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, starPath } = S.h;
  const BW = 46; const BH = 68;
  const art = (key, draw) => S.h.img(`gs:${key}`, BW * 2, BH * 2, (c) => { c.scale(2, 2); draw(c, BW, BH); });
  const bg = (c, w, h, a, b) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, w, h); };
  const rim = (c, w, h, col, k = 3) => { c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(k, k, w - 2 * k, h - 2 * k); };

  // ---- commons: card backs ----
  const dokkaebi = (c, w, h) => { bg(c, w, h, '#1d2a5a', '#0a1030'); rim(c, w, h, '#f0c14e'); c.fillStyle = '#ffd86b'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2 + s * 6, h / 2 - 14); c.lineTo(w / 2 + s * 10, h / 2 - 26); c.lineTo(w / 2 + s * 14, h / 2 - 12); c.fill(); } c.fillStyle = '#c2332a'; c.beginPath(); c.arc(w / 2, h / 2, 14, 0, TAU); c.fill(); c.fillStyle = '#fff'; for (const s of [-1, 1]) { c.beginPath(); c.arc(w / 2 + s * 6, h / 2 - 3, 3, 0, TAU); c.fill(); } c.beginPath(); c.moveTo(w / 2 - 8, h / 2 + 4); c.quadraticCurveTo(w / 2, h / 2 + 14, w / 2 + 8, h / 2 + 4); c.fill(); };
  const seal = (c, w, h) => { bg(c, w, h, '#5a1414', '#2a0808'); rim(c, w, h, '#e0b254'); c.strokeStyle = '#e0b254'; c.lineWidth = 3; c.strokeRect(w / 2 - 13, h / 2 - 13, 26, 26); c.fillStyle = '#e0b254'; c.fillRect(w / 2 - 8, h / 2 - 8, 6, 16); c.fillRect(w / 2 - 2, h / 2 - 8, 10, 5); c.fillRect(w / 2 - 2, h / 2 + 3, 10, 5); };
  const tiger = (c, w, h) => { bg(c, w, h, '#3a2a10', '#1a1206'); rim(c, w, h, '#d9a23a'); c.fillStyle = '#e8a23a'; c.beginPath(); c.arc(w / 2, h / 2, 14, 0, TAU); c.fill(); c.strokeStyle = '#2a1a06'; c.lineWidth = 2.5; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2 + s * 14, h / 2 - 4); c.lineTo(w / 2 + s * 8, h / 2 - 2); c.moveTo(w / 2 + s * 14, h / 2 + 5); c.lineTo(w / 2 + s * 8, h / 2 + 4); c.stroke(); } c.fillStyle = '#2a1a06'; for (const s of [-1, 1]) { c.beginPath(); c.arc(w / 2 + s * 5, h / 2 - 3, 2.2, 0, TAU); c.fill(); } };
  const pouch = (c, w, h) => { bg(c, w, h, '#4a1438', '#20081a'); rim(c, w, h, '#f0c14e'); c.fillStyle = '#e0453f'; c.beginPath(); c.moveTo(w / 2 - 10, h / 2 - 8); c.quadraticCurveTo(w / 2 - 18, h / 2 + 16, w / 2, h / 2 + 16); c.quadraticCurveTo(w / 2 + 18, h / 2 + 16, w / 2 + 10, h / 2 - 8); c.closePath(); c.fill(); c.fillStyle = '#ffd86b'; c.fillRect(w / 2 - 12, h / 2 - 12, 24, 5); c.strokeStyle = '#ffd86b'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2 - 8, h / 2 - 12); c.lineTo(w / 2 - 12, h / 2 - 20); c.moveTo(w / 2 + 8, h / 2 - 12); c.lineTo(w / 2 + 12, h / 2 - 20); c.stroke(); };
  const magpie = (c, w, h) => { bg(c, w, h, '#0e1a3a', '#050a1c'); rim(c, w, h, '#b8c8ff'); c.fillStyle = '#f4f1e8'; c.beginPath(); c.arc(w / 2, h / 2 - 12, 9, 0, TAU); c.fill(); c.fillStyle = '#111a30'; c.beginPath(); c.ellipse(w / 2, h / 2 + 4, 13, 9, 0, 0, TAU); c.fill(); c.fillStyle = '#ffd86b'; c.beginPath(); c.moveTo(w / 2 + 8, h / 2 - 13); c.lineTo(w / 2 + 16, h / 2 - 11); c.lineTo(w / 2 + 8, h / 2 - 9); c.fill(); c.fillStyle = '#eaf0ff'; c.beginPath(); c.arc(w / 2 - 10, h / 2 - 20, 4, 0, TAU); c.fill(); };

  // ---- premiums ----
  const mother = (c, w, h) => { bg(c, w, h, '#16121e', '#08060c'); rim(c, w, h, '#9fd8e8'); for (let i = 0; i < 6; i += 1) { c.fillStyle = ['#9fd8e8', '#e8b8e8', '#f8f0b0', '#a8e8c8'][i % 4]; c.globalAlpha = .7; c.beginPath(); c.moveTo(6 + i * 7, h - 8); c.quadraticCurveTo(10 + i * 7, h / 2, 6 + (i % 3) * 14 + 8, 8); c.lineTo(10 + i * 7, h - 8); c.fill(); } c.globalAlpha = 1; };
  const inkDokkaebi = (c, w, h) => { bg(c, w, h, '#0c0c10', '#050507'); rim(c, w, h, '#d8d8e0'); c.strokeStyle = '#e8e8ee'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.arc(w / 2, h / 2, 14, .4, TAU - .4); c.stroke(); c.beginPath(); c.moveTo(w / 2 - 9, h / 2 - 12); c.lineTo(w / 2 - 14, h / 2 - 24); c.moveTo(w / 2 + 9, h / 2 - 12); c.lineTo(w / 2 + 14, h / 2 - 24); c.stroke(); c.fillStyle = '#e8e8ee'; for (const s of [-1, 1]) { c.beginPath(); c.arc(w / 2 + s * 5, h / 2 - 2, 2.4, 0, TAU); c.fill(); } c.strokeStyle = '#c2332a'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2 - 6, h / 2 + 6); c.lineTo(w / 2 + 6, h / 2 + 6); c.stroke(); };
  const goldRoyal = (c, w, h) => { bg(c, w, h, '#3a2a06', '#170f02'); rim(c, w, h, '#ffd86b'); c.strokeStyle = 'rgba(255,216,107,.6)'; c.lineWidth = 1.4; c.strokeRect(9, 9, w - 18, h - 18); c.fillStyle = '#ffd86b'; starPath(c, w / 2, h / 2, 13, 5, 6); c.fill(); };
  const burst = (col) => (ctx, w, h, t) => { for (let k = 0; k < 2; k += 1) { const u = clamp01(t * 1.3 - k * .2); if (u <= 0 || u >= 1) continue; ctx.strokeStyle = `rgba(${col},${1 - u})`; ctx.lineWidth = 4 * (1 - u) + 1; ctx.beginPath(); ctx.arc(w / 2, h / 2, 10 + u * Math.min(w, h) * .45, 0, TAU); ctx.stroke(); } };
  const brush = (col) => (ctx, w, h, t) => { ctx.strokeStyle = `rgba(${col},${(1 - t) * .9})`; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(w * .15, h * .7); ctx.quadraticCurveTo(w * .4, h * (.3 + .2 * t), w * (.15 + .7 * clamp01(t * 1.4)), h * .5); ctx.stroke(); };

  // ---- legend: 왕실 화투 ----
  const royal = (c, w, h) => { bg(c, w, h, '#4a0f14', '#1a0406'); rim(c, w, h, '#ffd86b'); c.strokeStyle = 'rgba(255,216,107,.55)'; c.lineWidth = 1.4; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#ffd86b'; c.beginPath(); c.arc(w / 2, h / 2, 10, 0, TAU); c.fill(); c.fillStyle = '#4a0f14'; c.beginPath(); c.arc(w / 2, h / 2, 6, 0, TAU); c.fill(); c.fillStyle = '#ffd86b'; for (let i = 0; i < 8; i += 1) { const a = i * TAU / 8; c.beginPath(); c.arc(w / 2 + Math.cos(a) * 15, h / 2 + Math.sin(a) * 15, 2, 0, TAU); c.fill(); } };
  const royalFx = (ctx, w, h, t) => { brush('255,216,107')(ctx, w, h, t); const R = rng(6); for (let i = 0; i < 8; i += 1) { ctx.fillStyle = `rgba(255,${200 + (R() * 50 | 0)},90,${1 - t})`; ctx.fillRect(w * R(), h * R() - t * 10, 4, 3); } };
  const royalWin = (ctx, w, h, t) => { const k = clamp01(t * 1.3); ctx.strokeStyle = `rgba(200,30,30,${Math.sin(k * Math.PI)})`; ctx.lineWidth = 8; ctx.strokeRect(w * .35, h * .3, w * .3, h * .4); ctx.fillStyle = `rgba(200,30,30,${Math.sin(k * Math.PI) * .7})`; ctx.fillRect(w * .4, h * .36, w * .2, h * .28); const R = rng(2); for (let i = 0; i < 26; i += 1) { ctx.fillStyle = `rgba(255,216,107,${(1 - t) * clamp01(k * 2 - R())})`; starPath(ctx, w * R(), h * R(), 3 + R() * 5, 1, 4); ctx.fill(); } };
  const royalSpecial = (ctx, w, h, t) => { ctx.strokeStyle = `rgba(255,216,107,${(1 - t) * .9})`; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12); burst('255,216,107')(ctx, w, h, t); };

  // ---- legend 2 (v1.9.2): 월광 화투 ↔ 달빛 정자 -- a moonlit back; specials ripple a moon on water, a win raises it ----
  const moonlit = (c, w, h) => {
    bg(c, w, h, '#0e1a44', '#040818'); rim(c, w, h, '#c8d4ff');
    c.strokeStyle = 'rgba(200,212,255,.45)'; c.lineWidth = 1; c.strokeRect(7, 7, w - 14, h - 14);
    const g = c.createRadialGradient(w / 2, h * .36, 2, w / 2, h * .36, 14); g.addColorStop(0, '#fffbe8'); g.addColorStop(1, '#d8dcff'); c.fillStyle = g; c.beginPath(); c.arc(w / 2, h * .36, 10, 0, TAU); c.fill();
    c.fillStyle = '#02040e'; c.beginPath(); c.moveTo(w * .2, h * .74); c.lineTo(w / 2, h * .6); c.lineTo(w * .8, h * .74); c.lineTo(w * .74, h * .77); c.lineTo(w * .26, h * .77); c.fill(); c.fillRect(w * .3, h * .77, 2.5, h * .12); c.fillRect(w * .68, h * .77, 2.5, h * .12);
    c.fillStyle = 'rgba(255,190,210,.8)'; for (const [x, y] of [[.2, .2], [.8, .26], [.26, .5]]) { c.beginPath(); c.arc(w * x, h * y, 1.6, 0, TAU); c.fill(); }
  };
  const moonFx = (ctx, w, h, t) => { // a silver ripple and two plum petals drift where the card lands
    for (let k = 0; k < 2; k += 1) { const u = clamp01(t * 1.3 - k * .22); if (u <= 0 || u >= 1) continue; ctx.strokeStyle = `rgba(200,212,255,${1 - u})`; ctx.lineWidth = 3 * (1 - u) + 1; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 14 + u * 40, (14 + u * 40) * .5, 0, 0, TAU); ctx.stroke(); }
    for (let i = 0; i < 3; i += 1) { ctx.fillStyle = `rgba(255,190,210,${1 - t})`; ctx.beginPath(); ctx.ellipse(w / 2 + (i - 1) * 18 + t * 12, h / 2 - 10 + t * 26, 4, 2.4, t * 3 + i, 0, TAU); ctx.fill(); }
  };
  const moonSpecial = (ctx, w, h, t) => { // a full moon is reflected on the floor and the reflection ripples apart
    const cx = w / 2; const cy = h / 2; const R = Math.min(w, h) * .2; const a = Math.sin(clamp01(t) * Math.PI);
    ctx.save(); ctx.globalAlpha = a; const g = ctx.createRadialGradient(cx, cy, R * .2, cx, cy, R * 1.6); g.addColorStop(0, 'rgba(255,251,232,.85)'); g.addColorStop(.6, 'rgba(200,212,255,.35)'); g.addColorStop(1, 'rgba(200,212,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.6, R * .9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,236,255,.85)'; ctx.lineWidth = 2; for (let k = 0; k < 5; k += 1) { const y = cy - R * .5 + k * R * .25; const off = Math.sin(t * 10 + k) * R * .25 * t; ctx.beginPath(); ctx.moveTo(cx - R * .7 + off, y); ctx.lineTo(cx + R * .7 + off, y); ctx.stroke(); }
    ctx.restore();
  };
  const moonWin = (ctx, w, h, t) => { // the moon rises over the pavilion and plum petals fall across the table
    const rise = clamp01(t / .5); const R = Math.min(w, h) * .16; const cx = w * .72; const cy = h * (.75 - .5 * rise); const P = rng(8);
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    ctx.fillStyle = 'rgba(4,8,24,.35)'; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(cx, cy, R * .3, cx, cy, R * 2.4); g.addColorStop(0, 'rgba(255,251,232,.95)'); g.addColorStop(.4, 'rgba(255,251,232,.9)'); g.addColorStop(.42, 'rgba(200,212,255,.35)'); g.addColorStop(1, 'rgba(200,212,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 2.4, 0, TAU); ctx.fill();
    for (let i = 0; i < 26; i += 1) { const x = (P() * w + t * 60) % w; const y = -10 + ((P() * h + t * h * 1.1) % (h + 20)); ctx.fillStyle = 'rgba(255,190,210,.85)'; ctx.beginPath(); ctx.ellipse(x, y, 5, 3, t * 4 + i, 0, TAU); ctx.fill(); }
    ctx.restore();
  };

  // ---- room themes ----
  function sarang(ctx, w, h) { // 조선 사랑방: hanji walls, a window lattice and a warm lamp
    ctx.fillStyle = '#3a2412'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#e9dcc0'; ctx.fillRect(w * .1, h * .12, w * .8, h * .55); ctx.strokeStyle = '#6a4a26'; ctx.lineWidth = 3; for (let x = w * .1; x <= w * .9; x += w * .8 / 8) { ctx.beginPath(); ctx.moveTo(x, h * .12); ctx.lineTo(x, h * .67); ctx.stroke(); } for (let y = h * .12; y <= h * .67; y += h * .55 / 4) { ctx.beginPath(); ctx.moveTo(w * .1, y); ctx.lineTo(w * .9, y); ctx.stroke(); }
    const g = ctx.createRadialGradient(w * .5, h * .4, 10, w * .5, h * .4, w * .5); g.addColorStop(0, 'rgba(255,200,120,.35)'); g.addColorStop(1, 'rgba(255,200,120,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function moonPavilion(ctx, w, h) { // 달빛 정자
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a1438'); g.addColorStop(1, '#1a2a52'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#f4f1e0'; ctx.beginPath(); ctx.arc(w * .8, h * .22, 28, 0, TAU); ctx.fill();
    ctx.fillStyle = '#05091c'; ctx.beginPath(); ctx.moveTo(w * .2, h * .55); ctx.lineTo(w * .5, h * .38); ctx.lineTo(w * .8, h * .55); ctx.lineTo(w * .74, h * .58); ctx.lineTo(w * .26, h * .58); ctx.fill(); ctx.fillRect(w * .3, h * .58, 6, h * .22); ctx.fillRect(w * .66, h * .58, 6, h * .22);
  }

  function previewBacks(ctx, w, h, skinId) {
    const d = S.def(skinId); ctx.fillStyle = '#0a5a30'; ctx.fillRect(0, 0, w, h); const ch = h * .78; const cw = ch * BW / BH;
    [.2, .4, .6].forEach((fx, i) => { ctx.save(); ctx.translate(w * fx - cw / 2, (h - ch) / 2 + i * 2); ctx.scale(cw / BW, ch / BH); d.art(ctx, BW, BH); ctx.restore(); });
    ctx.fillStyle = '#fbf6e6'; ctx.beginPath(); ctx.roundRect(w * .8 - cw / 2, (h - ch) / 2, cw, ch, 5); ctx.fill(); ctx.fillStyle = '#c2332a'; ctx.font = `900 ${ch * .3}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('光', w * .8, h / 2);
    if (d.fx) { ctx.save(); d.fx(ctx, w, h, .42); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) { S.def(skinId).panel(ctx, w, h); ctx.fillStyle = '#fbf6e6'; for (let i = 0; i < 4; i += 1) { ctx.beginPath(); ctx.roundRect(w * (.2 + i * .15), h * .62, w * .11, h * .26, 4); ctx.fill(); } }
  const back = (key, drawFn, accent, fx, extra = {}) => ({ art: drawFn, back: { backgroundImage: art(key, drawFn), backgroundSize: '100% 100%', borderColor: accent },
    seat: { borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}` }, pile: { borderColor: accent }, tray: { borderColor: accent, boxShadow: `inset 0 0 0 2px ${accent}66` }, fx, preview: previewBacks, ...extra });
  const theme = (panel, frame) => ({ panel, frame, preview: previewTheme });
  S.define({
    gostop_c1: back('c1', dokkaebi, '#f0c14e', burst('240,193,78')), gostop_c2: back('c2', seal, '#e0b254', burst('224,178,84')), gostop_c3: back('c3', tiger, '#d9a23a', burst('217,162,58')),
    gostop_c4: back('c4', pouch, '#f0c14e', burst('240,193,78')), gostop_c5: back('c5', magpie, '#b8c8ff', burst('184,200,255')),
    gostop_p1: back('p1', mother, '#9fd8e8', burst('159,216,232'), { special: burst('232,184,232') }), gostop_p2: back('p2', inkDokkaebi, '#d8d8e0', brush('232,232,238'), { special: brush('194,51,42') }),
    gostop_p3: back('p3', goldRoyal, '#ffd86b', burst('255,216,107'), { special: burst('255,216,107') }),
    gostop_t1: theme(sarang, { borderColor: '#c9a24a', boxShadow: 'inset 0 0 0 3px #3a2412, 0 0 0 2px #c9a24a' }),
    gostop_t2: theme(moonPavilion, { borderColor: '#9fb4ff', boxShadow: 'inset 0 0 0 3px #0a1438, 0 0 14px rgba(159,180,255,.4)' }),
    gostop_l1: back('l1', royal, '#ffd86b', royalFx, { special: royalSpecial, win: royalWin, legend: true }),
    gostop_l2: back('l2', moonlit, '#c8d4ff', moonFx, { special: moonSpecial, win: moonWin, legend: true }),
  });
}());
