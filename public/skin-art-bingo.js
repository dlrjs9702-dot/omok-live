// 빙고 skins (v1.7.38): the mark a chosen number leaves on a player's own board (the board is private, so the mark
// uses the viewer's own skin), a short effect when it lands, and the room theme (panel + board + cells). The number
// on every cell stays readable: marks are open in the middle or keep a light centre.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, starPath } = S.h;

  // ---- commons: marks (drawn on an s x s canvas) ----
  function pawStamp(ctx, s) {
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(-.25); ctx.fillStyle = 'rgba(232,82,128,.92)'; const r = s * .4;
    ctx.beginPath(); ctx.ellipse(0, r * .3, r * .56, r * .48, 0, 0, TAU); ctx.fill();
    for (const [x, y] of [[-.66, -.12], [-.22, -.62], [.22, -.62], [.66, -.12]]) { ctx.beginPath(); ctx.ellipse(x * r, y * r, r * .2, r * .27, x * .4, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function waxSeal(ctx, s) {
    const R = rng(3); ctx.save(); ctx.translate(s / 2, s / 2); ctx.beginPath();
    for (let i = 0; i < 18; i += 1) { const a = i * TAU / 18; const rad = s * (.36 + R() * .07); if (i) ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); else ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    ctx.closePath(); const g = ctx.createRadialGradient(-s * .1, -s * .12, s * .04, 0, 0, s * .45); g.addColorStop(0, '#e0453f'); g.addColorStop(1, '#8c1712'); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(255,200,190,.5)'; ctx.lineWidth = s * .03; ctx.beginPath(); ctx.arc(0, 0, s * .28, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function scope(ctx, s) {
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.strokeStyle = 'rgba(22,120,70,.95)'; ctx.lineWidth = s * .05; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, s * .36, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, s * .2, 0, TAU); ctx.stroke();
    for (const [a, b, c2, d] of [[0, -.46, 0, -.28], [0, .46, 0, .28], [-.46, 0, -.28, 0], [.46, 0, .28, 0]]) { ctx.beginPath(); ctx.moveTo(a * s, b * s); ctx.lineTo(c2 * s, d * s); ctx.stroke(); }
    ctx.fillStyle = 'rgba(220,38,38,.9)'; ctx.beginPath(); ctx.arc(0, 0, s * .03, 0, TAU); ctx.fill(); ctx.restore();
  }
  function pokerChip(ctx, s) {
    ctx.save(); ctx.translate(s / 2, s / 2); const r = s * .42;
    ctx.fillStyle = '#b3201f'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = s * .09; ctx.setLineDash([s * .1, s * .1]); ctx.beginPath(); ctx.arc(0, 0, r * .86, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,.93)'; ctx.beginPath(); ctx.arc(0, 0, r * .56, 0, TAU); ctx.fill(); ctx.strokeStyle = '#b3201f'; ctx.lineWidth = s * .03; ctx.stroke(); ctx.restore();
  }
  function flowerStamp(ctx, s) {
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.fillStyle = 'rgba(244,114,160,.9)';
    for (let i = 0; i < 5; i += 1) { ctx.save(); ctx.rotate(i * TAU / 5); ctx.beginPath(); ctx.ellipse(0, -s * .22, s * .13, s * .2, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = 'rgba(255,233,140,.95)'; ctx.beginPath(); ctx.arc(0, 0, s * .15, 0, TAU); ctx.fill(); ctx.restore();
  }

  // ---- premiums ----
  function laserMark(ctx, s) {
    ctx.save(); ctx.translate(s / 2, s / 2); const g = ctx.createRadialGradient(0, 0, s * .1, 0, 0, s * .45); g.addColorStop(0, 'rgba(255,60,60,0)'); g.addColorStop(.6, 'rgba(255,60,60,.5)'); g.addColorStop(1, 'rgba(255,60,60,0)');
    ctx.fillStyle = g; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = s * .05; ctx.beginPath(); ctx.arc(0, 0, s * .3, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = s * .02; ctx.beginPath(); ctx.arc(0, 0, s * .3, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = s * .03; for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * s * .34, Math.sin(a) * s * .34); ctx.lineTo(Math.cos(a) * s * .46, Math.sin(a) * s * .46); ctx.stroke(); } ctx.restore();
  }
  function laserFx(ctx, w, h, t) { const cx = w / 2; const cy = h / 2; for (let i = 0; i < 8; i += 1) { const a = i * TAU / 8 + t; const r0 = 12 + t * 14; const r1 = r0 + 26 * (1 - t) + 10; ctx.strokeStyle = `rgba(255,70,70,${1 - t})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.stroke(); } }
  function fireSeal(ctx, s) {
    ctx.save(); ctx.translate(s / 2, s / 2);
    for (let i = 0; i < 9; i += 1) { const a = i * TAU / 9; ctx.save(); ctx.rotate(a); const g = ctx.createLinearGradient(0, -s * .15, 0, -s * .46); g.addColorStop(0, '#ff5a1a'); g.addColorStop(1, '#ffd24a'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-s * .07, -s * .16); ctx.quadraticCurveTo(0, -s * .58, s * .07, -s * .16); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = '#c2410c'; ctx.lineWidth = s * .05; ctx.beginPath(); ctx.arc(0, 0, s * .2, 0, TAU); ctx.stroke(); ctx.restore();
  }
  function fireFx(ctx, w, h, t) { const R = rng(6); for (let i = 0; i < 10; i += 1) { const x = w / 2 + (R() - .5) * 40; const y = h / 2 - 8 - t * 50 * (.5 + R()); ctx.fillStyle = `rgba(255,${130 + (R() * 100 | 0)},30,${1 - t})`; ctx.beginPath(); ctx.arc(x, y, 3.4 * (1 - t) + .8, 0, TAU); ctx.fill(); } }
  function holoMark(ctx, s) {
    ctx.save(); ctx.translate(s / 2, s / 2); const g = ctx.createLinearGradient(-s * .4, -s * .4, s * .4, s * .4); ['#ff6b9a', '#ffd86b', '#6bffb0', '#6bc8ff', '#b06bff'].forEach((c, i) => g.addColorStop(i / 4, c));
    ctx.strokeStyle = g; ctx.lineWidth = s * .1; ctx.beginPath(); ctx.arc(0, 0, s * .32, 0, TAU); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.85)'; starPath(ctx, s * .26, -s * .26, s * .09, s * .03, 4); ctx.fill(); ctx.restore();
  }
  function holoFx(ctx, w, h, t) { const x = w * (.2 + .6 * t); const g = ctx.createLinearGradient(x - 22, 0, x + 22, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${(1 - t) * .8})`); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(w * .2, h * .3, w * .6, h * .4); }

  // ---- legend: 잭팟 빙고 ----
  function jackpotMark(ctx, s) {
    ctx.save(); ctx.translate(s / 2, s / 2); const g = ctx.createRadialGradient(-s * .08, -s * .1, s * .03, 0, 0, s * .36); g.addColorStop(0, '#fff6b0'); g.addColorStop(.6, '#f5b82e'); g.addColorStop(1, '#a8740a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * .36, 0, TAU); ctx.fill(); ctx.strokeStyle = '#7a5208'; ctx.lineWidth = s * .03; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.arc(0, 0, s * .22, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d99a14'; ctx.lineWidth = s * .055; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(-s * .1, 0); ctx.lineTo(-s * .02, s * .08); ctx.lineTo(s * .12, -s * .09); ctx.stroke(); ctx.restore();
  }
  function jackpotFx(ctx, w, h, t) { const R = rng(12); for (let i = 0; i < 12; i += 1) { const a = R() * TAU; const d = 10 + 44 * t * (.5 + R() * .7); ctx.save(); ctx.translate(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d + 18 * t * t); ctx.rotate(a + t * 6); ctx.fillStyle = `rgba(255,${190 + (R() * 50 | 0)},40,${1 - t})`; ctx.fillRect(-3, -2, 6, 4); ctx.restore(); } }
  function jackpotWin(ctx, w, h, t) { // glitter across the whole board when a line is completed
    const R = rng(20); for (let i = 0; i < 46; i += 1) { const x = R() * w; const y = R() * h; const k = clamp01(t * 1.6 - R() * .6); if (k <= 0 || k >= 1) continue; ctx.fillStyle = `rgba(255,228,110,${Math.sin(k * Math.PI)})`; starPath(ctx, x, y, 3 + 9 * k, 1.6, 4); ctx.fill(); }
    ctx.strokeStyle = `rgba(255,222,100,${(1 - t) * .8})`; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12);
  }

  // ---- room themes ----
  function festival(ctx, w, h) { // 학교 축제
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffd6e7'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const R = rng(41); for (let i = 0; i < 60; i += 1) { ctx.fillStyle = ['#ff6b9a', '#6bc8ff', '#ffd86b', '#7be0a0', '#b692ff'][i % 5]; ctx.save(); ctx.translate(R() * w, R() * h); ctx.rotate(R() * TAU); ctx.globalAlpha = .55; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
    ctx.globalAlpha = 1; for (let x = 0; x < w; x += 46) { ctx.fillStyle = ['#ff6b9a', '#6bc8ff', '#ffd86b', '#7be0a0'][(x / 46 | 0) % 4]; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 40, 0); ctx.lineTo(x + 20, 26); ctx.fill(); }
  }
  function casino(ctx, w, h) { // 카지노 쇼홀
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * .7); g.addColorStop(0, '#0f7a4a'); g.addColorStop(1, '#03271a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e3b84a'; ctx.lineWidth = 4; ctx.strokeRect(6, 6, w - 12, h - 12); ctx.strokeStyle = 'rgba(227,184,74,.45)'; ctx.lineWidth = 1.5; ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = 'rgba(227,184,74,.12)'; for (let y = 30; y < h; y += 60) for (let x = 30; x < w; x += 60) { starPath(ctx, x, y, 7, 3, 4); ctx.fill(); }
  }

  function previewMark(ctx, w, h, skinId) {
    const d = S.def(skinId); ctx.fillStyle = '#fdf6e3'; ctx.fillRect(0, 0, w, h); const cell = h * .62;
    [[w * .3, '7'], [w * .7, '23']].forEach(([cx, n], i) => { const x = cx - cell / 2; const y = (h - cell) / 2; ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#cbb98d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, cell, cell, 12); ctx.fill(); ctx.stroke();
      if (i === 1) { ctx.save(); ctx.translate(x, y); d.mark(ctx, cell); ctx.restore(); } ctx.fillStyle = d.text?.color && i === 1 ? d.text.color : '#1f2937'; ctx.font = `900 ${cell * .36}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, cx, h / 2 + 2); });
    if (d.fx) { ctx.save(); ctx.translate(w * .7 - 50, h / 2 - 50); d.fx(ctx, 100, 100, .42); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) {
    const d = S.def(skinId); d.panel(ctx, w, h); const cs = h * .22;
    for (let r = 0; r < 3; r += 1) for (let c = 0; c < 5; c += 1) { const x = w * .1 + c * (w * .8 / 5); const y = h * .16 + r * (h * .28); Object.assign(ctx, { fillStyle: d.cell.backgroundColor, strokeStyle: d.cell.borderColor }); ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, cs * 1.3, cs, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = d.cell.color; ctx.font = `900 ${cs * .5}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(r * 5 + c + 1), x + cs * .65, y + cs / 2); }
  }
  const mark = (fn, text, fx, extra = {}) => ({ mark: fn, text, fx, preview: previewMark, ...extra });
  const theme = (panel, cell, boardStyle) => ({ panel, cell, boardStyle, preview: previewTheme });
  const WHITE = { color: '#ffffff', shadow: '0 1px 2px rgba(60,0,20,.7)' }; const DARK = { color: '#1f2937', shadow: '0 1px 1px rgba(255,255,255,.9)' };
  S.define({
    bingo_c1: mark(pawStamp, DARK), bingo_c2: mark(waxSeal, WHITE), bingo_c3: mark(scope, DARK), bingo_c4: mark(pokerChip, DARK), bingo_c5: mark(flowerStamp, { color: '#5a2b00', shadow: '0 1px 1px rgba(255,255,255,.9)' }),
    bingo_p1: mark(laserMark, DARK, laserFx), bingo_p2: mark(fireSeal, DARK, fireFx), bingo_p3: mark(holoMark, DARK, holoFx),
    bingo_t1: theme(festival, { backgroundColor: '#fffaf0', borderColor: '#ff9fbf', color: '#3a2a4a' }, { boxShadow: 'inset 0 0 0 2px #ffb6cf,0 10px 24px rgba(0,0,0,.3)' }),
    bingo_t2: theme(casino, { backgroundColor: '#0c4d31', borderColor: '#e3b84a', color: '#f5d77a' }, { boxShadow: 'inset 0 0 0 2px #e3b84a,0 10px 24px rgba(0,0,0,.5)' }),
    bingo_l1: mark(jackpotMark, DARK, jackpotFx, { win: jackpotWin }),
  });
}());
