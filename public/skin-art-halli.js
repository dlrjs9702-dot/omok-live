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

  // ---- room themes ----
  function fruitMarket(ctx, w, h) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff0c4'); g.addColorStop(1, '#ffd8a0'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 44) { ctx.fillStyle = x % 88 ? '#e0453f' : '#ffffff'; ctx.fillRect(x, 0, 44, 26); } const R = rng(55); ctx.globalAlpha = .4; for (let i = 0; i < 26; i += 1) { ctx.fillStyle = ['#e0453f', '#f2c14e', '#7bc043', '#8e44ad'][i % 4]; ctx.beginPath(); ctx.arc(R() * w, 60 + R() * (h - 70), 8 + R() * 10, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
  function picnic(ctx, w, h) { ctx.fillStyle = '#7bc96f'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(255,255,255,.55)'; for (let y = 0; y < h; y += 40) for (let x = (y / 40) % 2 ? 0 : 40; x < w; x += 80) ctx.fillRect(x, y, 40, 40); ctx.fillStyle = '#ffe566'; ctx.beginPath(); ctx.arc(w - 50, 46, 26, 0, TAU); ctx.fill(); }

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
  });
}());
