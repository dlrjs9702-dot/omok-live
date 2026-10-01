// 도둑잡기 skins (v1.7.41): the card BACK (what you pick from), the seat frame, the tray under my own hand and the
// room theme. Card faces are never redrawn (rank, suit and the joker stay exactly as they are); a back always reads as a
// dark back next to the light faces, so the two can never be confused (tested).
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, starPath } = S.h;
  const CW = 57; const CH = 77; // a card back is drawn at the card's CSS size and scaled with it
  const img = (key, draw) => S.h.img(`om:${key}`, CW * 2, CH * 2, (c) => { c.scale(2, 2); draw(c, CW, CH); });
  const frame = (c, w, h, col) => { c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(3, 3, w - 6, h - 6); };
  const bgFill = (c, w, h, a, b) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, w, h); };

  // ---- commons: back art ----
  const catThief = (c, w, h) => { bgFill(c, w, h, '#1d2a5a', '#0c1433'); frame(c, w, h, '#f0c14e'); c.fillStyle = '#f4f1e8'; c.beginPath(); c.arc(w / 2, h / 2, 14, 0, TAU); c.fill(); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(w / 2 + s * 14, h / 2 - 8); c.lineTo(w / 2 + s * 10, h / 2 - 24); c.lineTo(w / 2 + s * 2, h / 2 - 12); c.fill(); } c.fillStyle = '#10142e'; c.fillRect(w / 2 - 14, h / 2 - 5, 28, 8); c.fillStyle = '#ffd86b'; for (const s of [-1, 1]) { c.beginPath(); c.arc(w / 2 + s * 6, h / 2 - 1, 2.2, 0, TAU); c.fill(); } };
  const toyBox = (c, w, h) => { bgFill(c, w, h, '#20304f', '#10182c'); const cols = ['#e0453f', '#3b82f6', '#f2c14e', '#3fbf7f']; for (let y = 0; y < 5; y += 1) for (let x = 0; x < 4; x += 1) { c.fillStyle = cols[(x + y) % 4]; c.globalAlpha = .42; c.fillRect(6 + x * 11, 8 + y * 12, 9, 10); } c.globalAlpha = 1; frame(c, w, h, '#a9b3cc'); c.fillStyle = '#b8902f'; c.fillRect(w / 2 - 3, 3, 6, h - 6); };
  const wanted = (c, w, h) => { bgFill(c, w, h, '#4a3a22', '#241a0e'); frame(c, w, h, '#d8c08a'); c.fillStyle = '#d8c08a'; c.fillRect(9, 9, w - 18, 7); c.fillRect(14, h - 16, w - 28, 4); c.fillStyle = '#2a2014'; c.beginPath(); c.arc(w / 2, h / 2 + 2, 13, 0, TAU); c.fill(); c.strokeStyle = '#d8c08a'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#d8c08a'; c.beginPath(); c.arc(w / 2, h / 2 - 2, 5, 0, TAU); c.fill(); c.fillRect(w / 2 - 8, h / 2 + 4, 16, 6); };
  const monster = (c, w, h) => { bgFill(c, w, h, '#1f4a2a', '#0b2012'); frame(c, w, h, '#7be07b'); c.fillStyle = '#b9ccb0'; c.beginPath(); c.ellipse(w / 2, h / 2 - 2, 12, 10, 0, 0, TAU); c.fill(); c.fillStyle = '#b02a4a'; c.beginPath(); c.arc(w / 2, h / 2 - 2, 6, 0, TAU); c.fill(); c.fillStyle = '#0a0a0a'; c.beginPath(); c.arc(w / 2, h / 2 - 2, 3, 0, TAU); c.fill(); c.fillStyle = '#b9ccb0'; for (let i = 0; i < 5; i += 1) { c.beginPath(); c.moveTo(12 + i * 8, h - 18); c.lineTo(16 + i * 8, h - 9); c.lineTo(20 + i * 8, h - 18); c.fill(); } };
  const casino = (c, w, h) => { bgFill(c, w, h, '#7a1420', '#3c0810'); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; for (let i = -h; i < w + h; i += 9) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); } frame(c, w, h, '#f0c14e'); c.fillStyle = '#f0c14e'; starPath(c, w / 2, h / 2, 10, 4, 4); c.fill(); };

  // ---- premiums ----
  const dossier = (c, w, h) => { bgFill(c, w, h, '#5a4622', '#2a200c'); c.fillStyle = '#c8a45a'; c.fillRect(0, 0, w / 2, 9); frame(c, w, h, '#d9b86a'); c.strokeStyle = '#d9b86a'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2 - 2, h / 2, 11, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(w / 2 + 6, h / 2 + 8); c.lineTo(w / 2 + 16, h / 2 + 18); c.stroke(); };
  const moonlight = (c, w, h) => { bgFill(c, w, h, '#0e1a4a', '#050a22'); frame(c, w, h, '#b8c8ff'); c.fillStyle = '#eaf0ff'; c.beginPath(); c.arc(w / 2 - 2, h / 2 - 6, 13, 0, TAU); c.fill(); c.fillStyle = '#0a1438'; c.beginPath(); c.arc(w / 2 + 4, h / 2 - 9, 11, 0, TAU); c.fill(); const g = c.createLinearGradient(0, h / 2, 0, h); g.addColorStop(0, 'rgba(190,210,255,.35)'); g.addColorStop(1, 'rgba(190,210,255,0)'); c.fillStyle = g; c.fillRect(w / 2 - 12, h / 2 + 6, 24, h / 2 - 8); };
  const glow = (c, w, h) => { c.fillStyle = '#080812'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3cf0ff'; c.lineWidth = 2; c.strokeRect(3, 3, w - 6, h - 6); c.strokeStyle = '#ff4fd8'; c.lineWidth = 1.5; c.strokeRect(8, 8, w - 16, h - 16); c.fillStyle = '#ffe14f'; starPath(c, w / 2, h / 2, 11, 4, 5); c.fill(); c.strokeStyle = 'rgba(60,240,255,.6)'; c.lineWidth = 1; c.beginPath(); c.arc(w / 2, h / 2, 17, 0, TAU); c.stroke(); };
  const pulse = (col) => (ctx, w, h, t) => { ctx.strokeStyle = `rgba(${col},${(1 - t) * .9})`; ctx.lineWidth = 3; ctx.strokeRect(20 - t * 8, 20 - t * 8, w - 40 + t * 16, h - 40 + t * 16); };

  // ---- legend: 괴도와 탐정 -- half thief mask, half magnifier; a shadow hand reaches in; the last thief card is lit ----
  const duo = (c, w, h) => { bgFill(c, w, h, '#241a3a', '#0c0818'); frame(c, w, h, '#f0c14e'); c.fillStyle = '#f4f1e8'; c.beginPath(); c.moveTo(6, h / 2); c.lineTo(w / 2, 10); c.lineTo(w / 2, h - 10); c.lineTo(6, h / 2); c.fill(); c.fillStyle = '#10142e'; c.fillRect(10, h / 2 - 4, w / 2 - 12, 7); c.strokeStyle = '#ffd86b'; c.lineWidth = 3; c.beginPath(); c.arc(w / 2 + 10, h / 2 - 4, 9, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(w / 2 + 16, h / 2 + 3); c.lineTo(w - 8, h / 2 + 14); c.stroke(); };
  const shadowHand = (ctx, w, h, t) => { const y = h * (.85 - .5 * Math.sin(clamp01(t * 1.2) * Math.PI)); ctx.fillStyle = `rgba(10,6,20,${.85 * (1 - t * .4)})`; ctx.beginPath(); ctx.ellipse(w / 2, y, 16, 10, 0, 0, TAU); ctx.fill(); for (let i = -2; i <= 2; i += 1) { ctx.beginPath(); ctx.ellipse(w / 2 + i * 7, y - 12, 2.6, 8, i * .15, 0, TAU); ctx.fill(); } };
  const spotlight = (ctx, w, h, t) => { const g = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, Math.max(w, h) * .7); g.addColorStop(0, `rgba(255,236,170,${Math.sin(clamp01(t * 1.2) * Math.PI) * .75})`); g.addColorStop(1, 'rgba(255,236,170,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); };

  // ---- room themes ----
  function mansion(ctx, w, h) { ctx.fillStyle = '#2b1a12'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; for (let x = 0; x < w; x += 70) ctx.strokeRect(x + 6, 14, 58, h - 28); const g = ctx.createRadialGradient(w / 2, 0, 10, w / 2, 0, w * .6); g.addColorStop(0, 'rgba(255,214,140,.35)'); g.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  function nightTrain(ctx, w, h) { ctx.fillStyle = '#0b1230'; ctx.fillRect(0, 0, w, h); const R = rng(19); for (let i = 0; i < 40; i += 1) { ctx.fillStyle = `rgba(255,${200 + (R() * 50 | 0)},120,${.3 + R() * .5})`; ctx.fillRect(R() * w, R() * h * .7, 18 + R() * 40, 1.6); } ctx.fillStyle = '#1a2246'; ctx.fillRect(0, h * .72, w, h * .28); ctx.fillStyle = 'rgba(255,220,150,.5)'; for (let x = 10; x < w; x += 90) ctx.fillRect(x, h * .78, 60, 40); }

  function previewCards(ctx, w, h, skinId) {
    const d = S.def(skinId); ctx.fillStyle = '#0b1324'; ctx.fillRect(0, 0, w, h); const ch = h * .8; const cw = ch * CW / CH;
    [[w * .22, true], [w * .44, true], [w * .66, true]].forEach(([cx], i) => { const x = cx - cw / 2 + (i === 2 ? 4 : 0); const y = (h - ch) / 2; ctx.save(); ctx.translate(x, y); ctx.scale(cw / CW, ch / CH); d.art(ctx, CW, CH); ctx.restore(); });
    ctx.fillStyle = '#f8fafc'; const fx = w * .86 - cw / 2; ctx.beginPath(); ctx.roundRect(fx, (h - ch) / 2, cw, ch, 6); ctx.fill(); ctx.fillStyle = '#dc2626'; ctx.font = `900 ${ch * .3}px Georgia,serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('K♥', fx + cw / 2, h / 2);
    if (d.fx) { ctx.save(); ctx.translate(w * .44 - 40, h / 2 - 60); d.fx(ctx, 80, 120, .45); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) { S.def(skinId).panel(ctx, w, h); const ch = h * .6; const cw = ch * CW / CH; [.3, .5, .7].forEach((fx, i) => { ctx.save(); ctx.translate(w * fx - cw / 2, (h - ch) / 2 + i * 2); ctx.scale(cw / CW, ch / CH); S.def('oldmaid_c5').art(ctx, CW, CH); ctx.restore(); }); }
  const back = (key, art, accent, extra = {}) => ({ art, back: { backgroundImage: img(key, art), backgroundSize: '100% 100%' }, seat: { borderColor: accent, boxShadow: `inset 0 0 0 1px ${accent}` }, tray: { borderColor: accent, boxShadow: `inset 0 0 0 2px ${accent}55` }, preview: previewCards, ...extra });
  const theme = (panel, frame) => ({ panel, frame, preview: previewTheme });
  S.define({
    oldmaid_c1: back('c1', catThief, '#f0c14e'), oldmaid_c2: back('c2', toyBox, '#f4f1e8'), oldmaid_c3: back('c3', wanted, '#d8c08a'), oldmaid_c4: back('c4', monster, '#7be07b'), oldmaid_c5: back('c5', casino, '#f0c14e'),
    oldmaid_p1: back('p1', dossier, '#d9b86a', { fx: pulse('217,184,106') }), oldmaid_p2: back('p2', moonlight, '#b8c8ff', { fx: pulse('184,200,255') }), oldmaid_p3: back('p3', glow, '#3cf0ff', { fx: pulse('60,240,255') }),
    oldmaid_t1: theme(mansion, { borderColor: '#c9a24a', boxShadow: 'inset 0 0 0 3px #2b1a12, 0 0 0 2px #c9a24a' }),
    oldmaid_t2: theme(nightTrain, { borderColor: '#7aa0ff', boxShadow: 'inset 0 0 0 3px #0b1230, 0 0 14px rgba(122,160,255,.4)' }),
    oldmaid_l1: back('l1', duo, '#f0c14e', { fx: shadowHand, win: spotlight }),
  });
}());
