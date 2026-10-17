// 할리갈리 skins (v1.7.41): the frame of each player's card plot (by that player's skin), the bell's shock wave and
// the gold fruit of a right bell (legend), and the room theme. The fruit face plate, its count and the player's name
// keep their place and stay at least as legible as before (text contrast 4.5:1 on the frame, tested); a skin never
// redraws the fruit itself.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, starPath } = S.h;
  const tile = (key, w, h, draw) => S.h.img(`hg:${key}`, w, h, draw);

  // frame(bg, image, border, textColor, extra): the card's container; text = name and counts colour
  const frame = (bg, image, border, text, shadow = 'none', extra = {}) => ({ card: { backgroundColor: bg, backgroundImage: image, backgroundSize: 'auto', border: `3px solid ${border}`, boxShadow: shadow, ...extra }, text: { color: text, bg, border } });

  // ---- commons ----
  const comic = frame('#fff2a8', tile('comic', 14, 14, (c) => { c.fillStyle = 'rgba(220,60,60,.22)'; c.beginPath(); c.arc(4, 4, 2.2, 0, TAU); c.fill(); c.beginPath(); c.arc(11, 11, 2.2, 0, TAU); c.fill(); }), '#111111', '#1a1200', '5px 5px 0 #111111');
  const crate = frame('#b8894f', tile('crate', 40, 14, (c, w, h) => { c.strokeStyle = 'rgba(70,40,10,.4)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, h - .5); c.lineTo(w, h - .5); c.stroke(); c.strokeStyle = 'rgba(255,230,180,.18)'; c.beginPath(); c.moveTo(0, 2); c.lineTo(w, 2); c.stroke(); }), '#6b4422', '#1f1204', 'inset 0 0 0 3px #d9b07a');
  const pixel = frame('#16203f', tile('pixel', 12, 12, (c) => { c.fillStyle = 'rgba(120,160,255,.14)'; c.fillRect(0, 0, 6, 6); c.fillRect(6, 6, 6, 6); }), '#7cf0ff', '#eaf6ff', '0 0 0 3px #16203f, 0 0 0 6px #7cf0ff');
  const sticker = frame('#ffeaf4', tile('sticker', 50, 50, (c) => { const cols = ['#ff8fb8', '#8fd0ff', '#ffd86b', '#9be3b0']; for (let i = 0; i < 4; i += 1) { c.fillStyle = cols[i]; c.globalAlpha = .45; starPath(c, 10 + (i % 2) * 28, 10 + (i >> 1) * 28, 7, 3, 5); c.fill(); } c.globalAlpha = 1; }), '#ff8fb8', '#3a1428', '0 4px 10px rgba(255,143,184,.4)', { borderStyle: 'dashed' });
  const lab = frame('#183a2c', tile('lab', 24, 24, (c, w, h) => { c.strokeStyle = 'rgba(120,255,170,.18)'; c.strokeRect(.5, .5, w - 1, h - 1); }), '#7be07b', '#eafff0', '0 0 10px rgba(123,224,123,.4)');

  // ---- premiums ----
  const glass = frame('rgba(30,70,110,.85)', tile('glass', 30, 30, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(.4, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), '#9fdcff', '#eef9ff', '0 0 14px rgba(159,220,255,.5), inset 0 0 14px rgba(159,220,255,.25)');
  const neon = frame('#140a2a', tile('neon', 16, 16, (c) => { c.fillStyle = 'rgba(255,79,216,.12)'; c.fillRect(0, 0, 16, 1); }), '#ff4fd8', '#fff0fb', '0 0 12px #ff4fd8, 0 0 0 2px #3cf0ff');
  const pop = frame('#ffd24a', tile('pop', 16, 16, (c) => { c.fillStyle = 'rgba(230,50,50,.3)'; c.beginPath(); c.arc(8, 8, 3.4, 0, TAU); c.fill(); }), '#e63232', '#2a0606', '6px 6px 0 #1a1a1a');
  const shock = (col) => (ctx, w, h, t) => { for (let k = 0; k < 2; k += 1) { const u = clamp01(t * 1.3 - k * .22); if (u <= 0 || u >= 1) continue; ctx.strokeStyle = `rgba(${col},${1 - u})`; ctx.lineWidth = 5 * (1 - u) + 1; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 20 + u * w * .45, 14 + u * h * .45, 0, 0, TAU); ctx.stroke(); } };
  const burst = (col) => (ctx, w, h, t) => { const R = rng(4); for (let i = 0; i < 12; i += 1) { const a = i * TAU / 12 + R(); const d = 10 + 60 * t; ctx.fillStyle = `rgba(${col},${1 - t})`; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d, 4 * (1 - t) + 1, 0, TAU); ctx.fill(); } };

  // ---- legend: 황금 종 축제 ----
  const golden = frame('#3a2608', tile('golden', 26, 26, (c, w, h) => { c.strokeStyle = 'rgba(255,214,102,.22)'; c.strokeRect(1.5, 1.5, w - 3, h - 3); c.fillStyle = 'rgba(255,214,102,.3)'; starPath(c, w / 2, h / 2, 4, 1.6, 4); c.fill(); }), '#f0c14e', '#fff1c8', '0 0 14px rgba(240,193,78,.55), inset 0 0 0 2px #7a520f');
  golden.fx = (ctx, w, h, t) => { shock('255,214,102')(ctx, w, h, t); const R = rng(9); for (let i = 0; i < 10; i += 1) { const a = R() * TAU; const d = 20 + 70 * t * (.5 + R()); ctx.save(); ctx.translate(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d + 16 * t * t); ctx.rotate(a + t * 5); ctx.fillStyle = `rgba(255,${190 + (R() * 50 | 0)},40,${1 - t})`; ctx.fillRect(-4, -3, 8, 6); ctx.restore(); } };

  // v1.9.2 legend standard: `special(ctx, w, h, t)` over the owner's card plot when a right bell takes five or more cards,
  // `win(ctx, w, h, t)` over the panel when the owner is among the winners.
  golden.legend = true;
  golden.special = (ctx, w, h, t) => { // a great golden bell swings over the plot and rings out gold notes
    const cx = w / 2; const cy = h * .42; const swing = Math.sin(t * Math.PI * 4) * .35 * (1 - t); const s = Math.min(w, h) * .2;
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .8) / .2); ctx.translate(cx, cy - s); ctx.rotate(swing);
    ctx.fillStyle = '#f0c14e'; ctx.strokeStyle = '#7a5208'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-s * .2, 0); ctx.quadraticCurveTo(-s * .25, s * .2, -s * .5, s * 1.1); ctx.lineTo(s * .5, s * 1.1); ctx.quadraticCurveTo(s * .25, s * .2, s * .2, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, s * 1.2, s * .12, 0, TAU); ctx.fill(); ctx.restore();
    const R = rng(11); ctx.fillStyle = `rgba(255,214,102,${1 - t})`; ctx.font = `900 ${Math.round(s * .5)}px serif`;
    for (let i = 0; i < 6; i += 1) { const a = -Math.PI / 2 + (R() - .5) * 2.4; const d = s * (1 + 2 * t); ctx.fillText(i % 2 ? '♪' : '♫', cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
  };
  golden.win = (ctx, w, h, t) => { // gold fruit rains over the panel around a golden bell
    const R = rng(21); ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    for (let i = 0; i < 30; i += 1) { const x = R() * w; const y = -20 + ((R() * h + t * h * 1.4) % (h + 40)); ctx.fillStyle = ['#ffd86b', '#f0c14e', '#fff0a8'][i % 3]; ctx.beginPath(); ctx.arc(x, y, 7 + R() * 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#5a8a2a'; ctx.fillRect(x - 1, y - 12, 2, 5); }
    golden.special(ctx, w, h, Math.min(.79, t)); ctx.restore();
  };

  // ---- legend 2 (v1.9.2): 한여름 수박 축제 ↔ 한여름 피크닉 -- a watermelon rind frame; a big catch cracks a melon open ----
  const melon = frame('#fff1ec', tile('melon', 40, 40, (c, w, h) => { c.fillStyle = 'rgba(40,20,20,.28)'; for (const [x, y] of [[8, 10], [26, 6], [18, 24], [32, 30], [6, 32]]) { c.beginPath(); c.ellipse(x, y, 1.8, 3, .5, 0, TAU); c.fill(); } }),
    '#2f8f3a', '#3a1010', 'inset 0 0 0 4px #b8eaa8, 0 0 0 3px #1d6a28', { borderStyle: 'solid', borderWidth: '5px' });
  melon.legend = true;
  melon.fx = (ctx, w, h, t) => { // a juicy splash: red drops and a few seeds pop out of the plot
    const R = rng(14); for (let i = 0; i < 14; i += 1) { const a = R() * TAU; const d = 16 + 60 * t * (.5 + R() * .6); const x = w / 2 + Math.cos(a) * d; const y = h / 2 + Math.sin(a) * d + 30 * t * t;
      if (i % 4) { ctx.fillStyle = `rgba(232,60,70,${1 - t})`; ctx.beginPath(); ctx.arc(x, y, 4 * (1 - t) + 1.5, 0, TAU); ctx.fill(); } else { ctx.fillStyle = `rgba(30,20,20,${1 - t})`; ctx.beginPath(); ctx.ellipse(x, y, 2, 3.4, a, 0, TAU); ctx.fill(); } }
  };
  melon.special = (ctx, w, h, t) => { // a whole watermelon drops in and cracks into slices
    const cx = w / 2; const cy = h / 2; const s = Math.min(w, h) * .22; const crack = clamp01((t - .25) / .3); const drop = clamp01(t / .25);
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    if (crack <= 0) { ctx.fillStyle = '#2f8f3a'; ctx.beginPath(); ctx.ellipse(cx, cy - (1 - drop) * h * .5, s * 1.2, s, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#1d6a28'; ctx.lineWidth = 4; for (let k = -2; k <= 2; k += 1) { ctx.beginPath(); ctx.ellipse(cx + k * s * .35, cy - (1 - drop) * h * .5, s * .12, s * .95, 0, 0, TAU); ctx.stroke(); } }
    else for (let i = 0; i < 5; i += 1) { const a = -Math.PI / 2 + (i - 2) * .55; const d = crack * s * 1.4; ctx.save(); ctx.translate(cx + Math.cos(a) * d, cy + Math.sin(a) * d * .5); ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#2f8f3a'; ctx.beginPath(); ctx.arc(0, 0, s * .6, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#b8eaa8'; ctx.beginPath(); ctx.arc(0, 0, s * .52, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#e83c46'; ctx.beginPath(); ctx.arc(0, 0, s * .46, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#1e1414'; for (const [x, y] of [[-.2, .15], [0, .25], [.2, .15]]) { ctx.beginPath(); ctx.ellipse(x * s, y * s, 2, 3.5, 0, 0, TAU); ctx.fill(); } ctx.restore(); }
    ctx.restore();
  };
  melon.win = (ctx, w, h, t) => { // a picnic sun rises and melon slices rain onto a checked mat
    const R = rng(33); ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    const sun = clamp01(t / .4); const sg = ctx.createRadialGradient(w * .5, h * (.5 - .3 * sun), 10, w * .5, h * (.5 - .3 * sun), w * .4); sg.addColorStop(0, 'rgba(255,236,140,.6)'); sg.addColorStop(1, 'rgba(255,236,140,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 18; i += 1) { const x = R() * w; const y = -30 + ((R() * h + t * h * 1.3) % (h + 60)); ctx.save(); ctx.translate(x, y); ctx.rotate(R() * TAU + t * 3); ctx.fillStyle = '#2f8f3a'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#e83c46'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI); ctx.fill(); ctx.restore(); }
    ctx.restore();
  };

  // ---- room themes ----
  function fruitMarket(ctx, w, h) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff0c4'); g.addColorStop(1, '#ffd8a0'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 44) { ctx.fillStyle = x % 88 ? '#e0453f' : '#ffffff'; ctx.fillRect(x, 0, 44, 26); } const R = rng(55); ctx.globalAlpha = .4; for (let i = 0; i < 26; i += 1) { ctx.fillStyle = ['#e0453f', '#f2c14e', '#7bc043', '#8e44ad'][i % 4]; ctx.beginPath(); ctx.arc(R() * w, 60 + R() * (h - 70), 8 + R() * 10, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
  function picnic(ctx, w, h) { ctx.fillStyle = '#7bc96f'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let y = 0; y < h; y += 40) for (let x = (y / 40) % 2 ? 0 : 40; x < w; x += 80) ctx.fillRect(x, y, 40, 40); ctx.fillStyle = '#ffe566'; ctx.beginPath(); ctx.arc(w - 50, 46, 26, 0, TAU); ctx.fill(); }

  // ---- v1.10.90 스킨 2배 (IDEAS #future-skins-double): five frames, three premiums, a legend and its room (딸기 축제 ↔
  // 딸기 농장). Name and counts keep 4.5:1 on every frame.
  const storybook = frame('#fbf3df', tile('storybook', 40, 40, (c, w, h) => { c.strokeStyle = 'rgba(60,110,190,.18)'; c.lineWidth = 1.4; c.strokeRect(4.5, 4.5, w - 9, h - 9); }), '#3a6ab8', '#16264a');
  const lemonade = frame('#fff3a0', tile('lemonade', 16, 16, (c) => { c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(0, 0, 8, 16); }), '#e0b020', '#3a2a00');
  const forest = frame('#1f3d26', tile('forest', 30, 30, (c) => { c.fillStyle = 'rgba(140,220,120,.16)'; c.beginPath(); c.ellipse(8, 8, 6, 3, .6, 0, TAU); c.ellipse(22, 22, 6, 3, -.6, 0, TAU); c.fill(); }), '#8ad07a', '#effff0');
  const jelly = frame('#ffd6ea', tile('jelly', 20, 20, (c) => { c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(6, 6, 3, 1.6, -.6, 0, TAU); c.fill(); }), '#e85aa0', '#3a0a24', '0 4px 0 #c03a80');
  const arcadeTicket = frame('#ffb04a', tile('ticket', 14, 30, (c, w, h) => { c.fillStyle = 'rgba(120,40,0,.18)'; c.beginPath(); c.arc(0, h / 2, 4, 0, TAU); c.fill(); }), '#c84a10', '#2a0e00', '0 0 0 2px #fff3e0 inset');
  const iceCandy = frame('#163a5a', tile('icecandy', 24, 24, (c) => { c.strokeStyle = 'rgba(180,230,255,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(12, 2); c.lineTo(12, 22); c.moveTo(2, 12); c.lineTo(22, 12); c.stroke(); }), '#9fe0ff', '#f0faff', '0 0 12px rgba(159,224,255,.5)');
  const rainbowCard = frame('#ffffff', tile('rainbow', 60, 12, (c, w) => { ['#ff6b6b', '#ffb84a', '#ffe94a', '#5fd07a', '#5fa8ff', '#a98bff'].forEach((col, i) => { c.fillStyle = col; c.globalAlpha = .28; c.fillRect(i * w / 6, 0, w / 6, 12); }); }), '#a98bff', '#1a1430', '0 0 0 3px #ffe94a');
  const starlight = frame('#141c44', tile('starlight', 36, 36, (c) => { c.fillStyle = 'rgba(255,230,140,.35)'; starPath(c, 10, 10, 3, 1.2, 4); c.fill(); starPath(c, 26, 24, 2, .8, 4); c.fill(); }), '#ffd86b', '#fff6dc', '0 0 12px rgba(255,216,107,.45)');
  // 딸기 축제 (legend) ↔ 딸기 농장 (room)
  const strawberry = (ctx, x, y, s) => { ctx.fillStyle = '#e8253e'; ctx.beginPath(); ctx.moveTo(x, y + s); ctx.bezierCurveTo(x - s * 1.1, y + s * .2, x - s * .8, y - s * .6, x, y - s * .5); ctx.bezierCurveTo(x + s * .8, y - s * .6, x + s * 1.1, y + s * .2, x, y + s); ctx.fill(); ctx.fillStyle = '#ffe9a0'; for (const [dx, dy] of [[-.3, 0], [.3, 0], [0, .35], [-.2, -.25], [.2, -.25]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, s * .06, 0, TAU); ctx.fill(); } ctx.fillStyle = '#3a9a3a'; for (let k = -2; k <= 2; k += 1) { ctx.beginPath(); ctx.ellipse(x + k * s * .16, y - s * .55, s * .12, s * .26, k * .5, 0, TAU); ctx.fill(); } };
  const berry = frame('#fff0f2', tile('berry', 30, 30, (c) => { c.fillStyle = 'rgba(232,37,62,.16)'; c.beginPath(); c.arc(8, 8, 3, 0, TAU); c.arc(22, 22, 3, 0, TAU); c.fill(); }), '#e8253e', '#4a0a14', '0 0 0 3px #3a9a3a, 0 0 12px rgba(232,37,62,.35)');
  berry.legend = true;
  berry.fx = (ctx, w, h, t) => { shock('232,37,62')(ctx, w, h, t); const R = rng(14); for (let i = 0; i < 8; i += 1) { const a = R() * TAU; const d = 20 + 60 * t * (.5 + R()); ctx.save(); ctx.globalAlpha = 1 - t; strawberry(ctx, w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d + 14 * t * t, 7); ctx.restore(); } };
  berry.special = (ctx, w, h, t) => { // five or more taken: a giant strawberry bounces onto the plot and bursts into small ones
    const k = clamp01(t / .4); const s = Math.min(w, h) * .2; const y = h * .5 - Math.abs(Math.sin(k * Math.PI * 2)) * h * .2 * (1 - k);
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .8) / .2);
    if (t < .55) strawberry(ctx, w / 2, y, s); else { const R = rng(3); const u = clamp01((t - .55) / .3); for (let i = 0; i < 12; i += 1) { const a = i * TAU / 12; strawberry(ctx, w / 2 + Math.cos(a) * s * 2 * u, h / 2 + Math.sin(a) * s * 2 * u, s * .3); } }
    ctx.restore();
  };
  berry.win = (ctx, w, h, t) => { // a strawberry cake rises in the middle and berries rain round it
    const k = clamp01(t / .45); const cx = w / 2; const cy = h * .6; const s = Math.min(w, h) * .18 * k;
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    const R = rng(21); for (let i = 0; i < 24; i += 1) strawberry(ctx, R() * w, ((R() * h) + t * h * 1.2) % h, 8);
    ctx.fillStyle = '#fff6e8'; ctx.fillRect(cx - s * 1.4, cy - s * .6, s * 2.8, s * 1.2); ctx.fillStyle = '#ffd0d8'; ctx.fillRect(cx - s * 1.4, cy - s * .1, s * 2.8, s * .2);
    ctx.fillStyle = '#fffaf2'; ctx.beginPath(); ctx.ellipse(cx, cy - s * .6, s * 1.4, s * .3, 0, 0, TAU); ctx.fill();
    for (const dx of [-.8, 0, .8]) strawberry(ctx, cx + dx * s, cy - s * .8, s * .3);
    ctx.restore();
  };
  function strawberryFarm(ctx, w, h) { // 딸기 농장: green rows of strawberry plants under a pale sky
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#dff3ff'); g.addColorStop(.35, '#bfe6a8'); g.addColorStop(1, '#6aa84a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let y = h * .4; y < h; y += 40) { ctx.fillStyle = 'rgba(120,80,40,.45)'; ctx.fillRect(0, y + 18, w, 8); const R = rng(Math.round(y)); for (let x = 10; x < w; x += 34) { ctx.fillStyle = '#3a8a3a'; ctx.beginPath(); ctx.ellipse(x, y + 10, 12, 8, 0, 0, TAU); ctx.fill(); if (R() > .4) strawberry(ctx, x + 6, y + 16, 5); } }
    ctx.strokeStyle = '#e8253e'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, w - 8, h - 8);
  }

  function previewCard(ctx, w, h, skinId) {
    const d = S.def(skinId); ctx.fillStyle = '#0b1324'; ctx.fillRect(0, 0, w, h); const cw = w * .4; const ch = h * .74;
    [w * .27, w * .73].forEach((cx, i) => { const x = cx - cw / 2; const y = (h - ch) / 2; ctx.fillStyle = d.card.backgroundColor.startsWith('rgba') ? '#1e466e' : d.card.backgroundColor; ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 10); ctx.fill(); ctx.strokeStyle = d.card.border.split(' ').pop(); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#fbf6e6'; ctx.beginPath(); ctx.roundRect(x + 8, y + ch * .3, cw - 16, ch * .48, 6); ctx.fill(); ctx.fillStyle = i ? '#e0453f' : '#7bc043'; ctx.beginPath(); ctx.arc(x + cw / 2 - 10, y + ch * .54, 9, 0, TAU); ctx.arc(x + cw / 2 + 10, y + ch * .54, 9, 0, TAU); ctx.fill();
      ctx.fillStyle = d.text.color; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(i ? '지은' : '민수', x + cw / 2, y + ch * .14); ctx.font = '700 10px sans-serif'; ctx.fillText('뒷면 12장 · 앞면 2장', x + cw / 2, y + ch * .9); });
    if (d.fx) { ctx.save(); d.fx(ctx, w, h, .42); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) { S.def(skinId).panel(ctx, w, h); ctx.fillStyle = 'rgba(255,255,255,.88)'; for (const x of [.15, .55]) { ctx.beginPath(); ctx.roundRect(w * x, h * .3, w * .3, h * .45, 8); ctx.fill(); } }
  const piece = (def, fx) => ({ ...def, fx: def.fx || fx, preview: previewCard });
  const theme = (panel, frameCss) => ({ panel, frame: frameCss, preview: previewTheme });
  S.define({
    halligalli_c1: piece(comic), halligalli_c2: piece(crate), halligalli_c3: piece(pixel), halligalli_c4: piece(sticker), halligalli_c5: piece(lab),
    halligalli_p1: piece(glass, shock('159,220,255')), halligalli_p2: piece(neon, shock('255,79,216')), halligalli_p3: piece(pop, burst('230,50,50')),
    halligalli_t1: theme(fruitMarket, { borderColor: '#e0453f', boxShadow: 'inset 0 0 0 3px #fff0c4, 0 0 0 2px #e0453f' }),
    halligalli_t2: theme(picnic, { borderColor: '#3f8f3a', boxShadow: 'inset 0 0 0 3px #7bc96f, 0 0 0 2px #3f8f3a' }),
    halligalli_l1: piece(golden),
    halligalli_l2: piece(melon),
    // v1.10.90 스킨 2배
halligalli_c6: piece(storybook), halligalli_c7: piece(lemonade), halligalli_c8: piece(forest), halligalli_c9: piece(jelly), halligalli_c10: piece(arcadeTicket),
    halligalli_p4: piece(iceCandy, shock('159,224,255')), halligalli_p5: piece(rainbowCard, burst('169,139,255')), halligalli_p6: piece(starlight, shock('255,216,107')),
    halligalli_t3: theme(strawberryFarm, { borderColor: '#e8253e', boxShadow: 'inset 0 0 0 3px #fff0f2, 0 0 0 2px #3a9a3a' }),
    halligalli_l3: piece(berry), // 딸기 축제 ↔ 딸기 농장
  });
}());
