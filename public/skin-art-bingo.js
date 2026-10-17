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

  // v1.9.1 legend standard: `special(ctx, w, h, t, cells)` over the board when one more line is completed (cells: that
  // line's cell rects inside the board, padded like playFx), `win(ctx, w, h, t)` over the board when I win the game.
  function jackpotSpecial(ctx, w, h, t, cells) { // gold coins roll along the new line, each cell flashes gold
    const R = rng(31);
    cells.forEach((c, i) => {
      const on = clamp01(t * 1.6 - i * .12); if (on <= 0 || on >= 1) return;
      ctx.strokeStyle = `rgba(255,214,90,${Math.sin(on * Math.PI)})`; ctx.lineWidth = 5; ctx.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
      for (let k = 0; k < 3; k += 1) { const x = c.x + c.w / 2 + (R() - .5) * c.w; const y = c.y + c.h / 2 - on * c.h * (.4 + R() * .5); ctx.fillStyle = `rgba(255,${200 + (R() * 40 | 0)},60,${1 - on})`; ctx.beginPath(); ctx.ellipse(x, y, 5, 3.4, on * 6, 0, TAU); ctx.fill(); }
    });
  }

  // ---- legend 2 (v1.9.1): 축제 응원단 ↔ 학교 축제 -- a pennant flag; a new line strings bunting, a win starts a cheer ----
  function pennant(ctx, s) {
    ctx.save(); ctx.translate(s / 2, s / 2);
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = s * .05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-s * .3, -s * .38); ctx.lineTo(-s * .3, s * .4); ctx.stroke(); // the stick
    ctx.beginPath(); ctx.moveTo(-s * .28, -s * .36); ctx.lineTo(s * .42, -s * .12); ctx.lineTo(-s * .28, s * .12); ctx.closePath();
    const g = ctx.createLinearGradient(0, -s * .36, 0, s * .12); g.addColorStop(0, '#ff6b9a'); g.addColorStop(.5, '#ff6b9a'); g.addColorStop(.5, '#4fa8ff'); g.addColorStop(1, '#4fa8ff');
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = s * .025; ctx.stroke();
    ctx.fillStyle = '#ffd23f'; starPath(ctx, s * .02, -s * .12, s * .09, s * .04, 5); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(-s * .3, -s * .4, s * .045, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function pennantFx(ctx, w, h, t) { // the flag is waved: confetti flicks up from the cell
    const R = rng(17); for (let i = 0; i < 14; i += 1) { const a = -Math.PI / 2 + (R() - .5) * 1.8; const d = 12 + 46 * t * (.5 + R() * .6); ctx.save(); ctx.translate(w / 2 + Math.cos(a) * d, h / 2 + Math.sin(a) * d + 30 * t * t); ctx.rotate(R() * TAU + t * 8); ctx.fillStyle = ['#ff6b9a', '#4fa8ff', '#ffd23f', '#7be0a0'][i % 4]; ctx.globalAlpha = 1 - t; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); }
  }
  function buntingSpecial(ctx, w, h, t, cells) { // a string of little flags is pulled across the new line and flaps
    if (!cells.length) return; const first = cells[0]; const last = cells[cells.length - 1];
    const ax = first.x + first.w / 2; const ay = first.y + first.h * .22; const bx = last.x + last.w / 2; const by = last.y + last.h * .22;
    const p = clamp01(t * 2); const ex = ax + (bx - ax) * p; const ey = ay + (by - ay) * p; const fade = 1 - clamp01((t - .8) / .2);
    ctx.save(); ctx.globalAlpha = fade; ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + ex) / 2, (ay + ey) / 2 + 14, ex, ey); ctx.stroke();
    const n = Math.max(2, cells.length * 2); const cols = ['#ff6b9a', '#4fa8ff', '#ffd23f', '#7be0a0'];
    for (let i = 0; i <= n * p; i += 1) { const u = i / n; const x = ax + (bx - ax) * u; const y = ay + (by - ay) * u + Math.sin(u * Math.PI) * 14 * (1 - Math.abs(.5 - u)); const flap = Math.sin(t * 20 + i) * 3;
      ctx.fillStyle = cols[i % 4]; ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.lineTo(x + flap, y + 18); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  function cheerWin(ctx, w, h, t) { // pom-poms burst at the corners, confetti rains and a BINGO banner swings in
    const R = rng(23); ctx.save();
    for (const [cx, cy] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) { const k = clamp01(t * 2.5); for (let i = 0; i < 16; i += 1) { const a = i * TAU / 16; ctx.strokeStyle = i % 2 ? '#ff6b9a' : '#ffd23f'; ctx.lineWidth = 4; ctx.globalAlpha = 1 - clamp01((t - .6) / .4); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 40 * k, cy + Math.sin(a) * 40 * k); ctx.stroke(); } }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 60; i += 1) { const x = R() * w; const y = (R() * h * .3 + t * h * 1.2) % h; ctx.save(); ctx.translate(x, y); ctx.rotate(t * 10 + i); ctx.fillStyle = ['#ff6b9a', '#4fa8ff', '#ffd23f', '#7be0a0'][i % 4]; ctx.globalAlpha = 1 - clamp01((t - .8) / .2); ctx.fillRect(-5, -2.5, 10, 5); ctx.restore(); }
    const swing = clamp01((t - .15) / .3); if (swing > 0) { const y = h * .5; ctx.save(); ctx.translate(w / 2, y); ctx.rotate(Math.sin((1 - swing) * 6) * .2 * (1 - swing)); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
      ctx.fillStyle = '#ff6b9a'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.roundRect(-w * .32, -34, w * .64, 68, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = `900 ${Math.round(w * .09)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('BINGO!', 0, 3); ctx.restore(); }
    ctx.restore();
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

  // ---- v1.10.90 스킨 2배 (IDEAS #future-skins-double): five marks, three premiums, a legend and its room (회전목마 ↔
  // 놀이공원). Every mark keeps the number readable: open in the middle.
  function heartSticker(ctx, s) { // 하트 스티커: a ring of little hearts
    const heart = (x, y, k, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + k * .5); ctx.bezierCurveTo(x - k, y - k * .1, x - k * .5, y - k * .9, x, y - k * .35); ctx.bezierCurveTo(x + k * .5, y - k * .9, x + k, y - k * .1, x, y + k * .5); ctx.fill(); };
    for (let i = 0; i < 10; i += 1) { const a = i * TAU / 10; heart(s / 2 + Math.cos(a) * s * .36, s / 2 + Math.sin(a) * s * .36, s * .1, i % 2 ? '#ff6b9a' : '#ff9fbf'); }
  }
  function starStamp(ctx, s) { // 별 도장: a star outline stamped in ink
    ctx.save(); ctx.strokeStyle = 'rgba(37,99,235,.6)'; ctx.lineWidth = s * .05; ctx.lineJoin = 'round'; starPath(ctx, s / 2, s / 2 + s * .03, s * .5, s * .27, 5); ctx.stroke(); ctx.restore();
  }
  function crayonCircle(ctx, s) { // 크레용 동그라미: a quick crayon loop round the number
    ctx.save(); ctx.strokeStyle = 'rgba(234,88,12,.85)'; ctx.lineWidth = s * .06; ctx.lineCap = 'round'; ctx.beginPath();
    for (let a = 0; a <= TAU * 1.12; a += .12) { const k = s * (.38 + Math.sin(a * 3) * .02 + a * .006); const x = s / 2 + Math.cos(a - .6) * k; const y = s / 2 + Math.sin(a - .6) * k * .9; if (a) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.stroke(); ctx.restore();
  }
  function checkMark(ctx, s) { // 체크 표시: a fat green tick in the corner
    ctx.save(); ctx.strokeStyle = 'rgba(22,163,74,.9)'; ctx.lineWidth = s * .09; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(s * .58, s * .74); ctx.lineTo(s * .7, s * .86); ctx.lineTo(s * .92, s * .58); ctx.stroke();
    ctx.strokeStyle = 'rgba(22,163,74,.35)'; ctx.lineWidth = s * .03; ctx.strokeRect(s * .06, s * .06, s * .88, s * .88); ctx.restore();
  }
  function donutMark(ctx, s) { // 도넛 마커: a glazed ring with sprinkles
    ctx.save(); ctx.lineWidth = s * .14; ctx.strokeStyle = 'rgba(214,140,90,.85)'; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * .37, 0, TAU); ctx.stroke();
    ctx.lineWidth = s * .09; ctx.strokeStyle = 'rgba(255,150,190,.9)'; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * .37, 0, TAU); ctx.stroke();
    const R = rng(4); ctx.lineWidth = s * .025; for (let i = 0; i < 14; i += 1) { const a = R() * TAU; const x = s / 2 + Math.cos(a) * s * .37; const y = s / 2 + Math.sin(a) * s * .37; ctx.strokeStyle = ['#ffd84a', '#5fd0ff', '#ffffff'][i % 3]; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y + 2); ctx.stroke(); }
    ctx.restore();
  }
  function splash(ctx, s) { // 물감 튀김: a splash ring of paint
    const R = rng(8); ctx.save(); ctx.fillStyle = 'rgba(124,58,237,.82)';
    for (let i = 0; i < 18; i += 1) { const a = i * TAU / 18 + R() * .2; const k = s * (.34 + R() * .1); ctx.beginPath(); ctx.arc(s / 2 + Math.cos(a) * k, s / 2 + Math.sin(a) * k, s * (.04 + R() * .05), 0, TAU); ctx.fill(); }
    ctx.lineWidth = s * .07; ctx.strokeStyle = 'rgba(124,58,237,.75)'; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * .36, 0, TAU); ctx.stroke(); ctx.restore();
  }
  function splashFx(ctx, w, h, t) { const R = rng(13); for (let i = 0; i < 12; i += 1) { const a = R() * TAU; const k = 20 + t * 40 * (.5 + R()); ctx.fillStyle = ['rgba(124,58,237,', 'rgba(236,72,153,', 'rgba(14,165,233,'][i % 3] + (1 - t) + ')'; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * k, h / 2 + Math.sin(a) * k, 4 * (1 - t) + 1, 0, TAU); ctx.fill(); } }
  function clover(ctx, s) { // 네잎클로버: a four-leaf clover in each corner
    ctx.save(); ctx.fillStyle = 'rgba(34,139,60,.88)';
    for (const [cx, cy] of [[.17, .17], [.83, .17], [.17, .83], [.83, .83]]) for (let k = 0; k < 4; k += 1) { const a = k * Math.PI / 2 + Math.PI / 4; ctx.beginPath(); ctx.arc(s * cx + Math.cos(a) * s * .05, s * cy + Math.sin(a) * s * .05, s * .055, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(34,139,60,.5)'; ctx.lineWidth = s * .03; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * .4, 0, TAU); ctx.stroke(); ctx.restore();
  }
  function cloverFx(ctx, w, h, t) { for (let i = 0; i < 6; i += 1) { const a = i * TAU / 6 + t * 2; const k = 18 + t * 36; ctx.save(); ctx.translate(w / 2 + Math.cos(a) * k, h / 2 + Math.sin(a) * k - t * 20); ctx.rotate(a); ctx.fillStyle = `rgba(74,190,100,${1 - t})`; ctx.beginPath(); ctx.ellipse(0, 0, 6, 3.4, 0, 0, TAU); ctx.fill(); ctx.restore(); } }
  function crownMark(ctx, s) { // 반짝 왕관: a little crown on top and a golden frame
    ctx.save(); ctx.strokeStyle = 'rgba(217,165,32,.9)'; ctx.lineWidth = s * .05; ctx.beginPath(); ctx.roundRect(s * .08, s * .14, s * .84, s * .78, s * .12); ctx.stroke();
    ctx.fillStyle = '#f2c230'; ctx.beginPath(); ctx.moveTo(s * .32, s * .2); ctx.lineTo(s * .3, s * .02); ctx.lineTo(s * .41, s * .1); ctx.lineTo(s * .5, -s * .01); ctx.lineTo(s * .59, s * .1); ctx.lineTo(s * .7, s * .02); ctx.lineTo(s * .68, s * .2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e2405a'; ctx.beginPath(); ctx.arc(s * .5, s * .12, s * .03, 0, TAU); ctx.fill(); ctx.restore();
  }
  function crownFx(ctx, w, h, t) { for (let i = 0; i < 6; i += 1) { const a = i * TAU / 6 - Math.PI / 2; const k = 22 + t * 30; ctx.fillStyle = `rgba(255,224,110,${1 - t})`; starPath(ctx, w / 2 + Math.cos(a) * k, h / 2 + Math.sin(a) * k, 7 * (1 - t) + 2, 2, 4); ctx.fill(); } }
  // 회전목마 (legend) ↔ 놀이공원 (room): a ring of marquee bulbs with a pennant, the lights chase on every line
  function carousel(ctx, s) {
    ctx.save(); ctx.strokeStyle = 'rgba(214,40,90,.85)'; ctx.lineWidth = s * .06; ctx.beginPath(); ctx.arc(s / 2, s / 2, s * .4, 0, TAU); ctx.stroke();
    for (let i = 0; i < 12; i += 1) { const a = i * TAU / 12; const x = s / 2 + Math.cos(a) * s * .4; const y = s / 2 + Math.sin(a) * s * .4; const g = ctx.createRadialGradient(x, y, 0, x, y, s * .06); g.addColorStop(0, '#fffbe0'); g.addColorStop(1, i % 2 ? '#ffd23f' : '#ff8a3d'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * .05, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#e2405a'; ctx.beginPath(); ctx.moveTo(s * .5, s * .02); ctx.lineTo(s * .64, s * .07); ctx.lineTo(s * .5, s * .12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  function carouselFx(ctx, w, h, t) { for (let i = 0; i < 12; i += 1) { const a = i * TAU / 12 + t * 3; const on = (i + Math.floor(t * 12)) % 3 === 0; ctx.fillStyle = on ? `rgba(255,240,150,${1 - t})` : `rgba(255,140,60,${(1 - t) * .5})`; ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * (30 + t * 10), h / 2 + Math.sin(a) * (30 + t * 10), on ? 4 : 2.6, 0, TAU); ctx.fill(); } }
  function carouselSpecial(ctx, w, h, t, cells) { // a new line: a run of lights chases along its cells
    cells.forEach((c, i) => {
      const on = clamp01(t * 1.5 - i * .1); if (on <= 0 || on >= 1) return; const a = Math.sin(on * Math.PI);
      ctx.strokeStyle = `rgba(255,210,63,${a})`; ctx.lineWidth = 4; ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 60; ctx.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6); ctx.setLineDash([]);
    });
  }
  function carouselWin(ctx, w, h, t) { // fireworks over the park
    const R = rng(44);
    for (let b = 0; b < 4; b += 1) {
      const start = b * .18; const k = clamp01((t - start) / .5); if (k <= 0 || k >= 1) continue;
      const cx = w * (.2 + R() * .6); const cy = h * (.2 + R() * .4); const col = ['255,107,154', '255,216,74', '107,200,255', '182,146,255'][b];
      for (let i = 0; i < 14; i += 1) { const a = i * TAU / 14; const d = 10 + 60 * Math.sqrt(k); ctx.fillStyle = `rgba(${col},${1 - k})`; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d + k * k * 20, 3.4, 0, TAU); ctx.fill(); }
    }
  }
  function themePark(ctx, w, h) { // 놀이공원: a sunset sky over a Ferris wheel, a carousel roof and bunting
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffb36b'); g.addColorStop(.6, '#ff7aa2'); g.addColorStop(1, '#7a4ab8'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(60,30,90,.55)'; ctx.lineWidth = 3; const cx = w * .82; const cy = h * .5; const R0 = Math.min(w, h) * .38;
    ctx.beginPath(); ctx.arc(cx, cy, R0, 0, TAU); ctx.stroke(); for (let i = 0; i < 12; i += 1) { const a = i * TAU / 12; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R0, cy + Math.sin(a) * R0); ctx.stroke(); ctx.fillStyle = ['#ffd23f', '#6bc8ff', '#ff6b9a'][i % 3]; ctx.fillRect(cx + Math.cos(a) * R0 - 6, cy + Math.sin(a) * R0, 12, 10); }
    ctx.fillStyle = 'rgba(60,30,90,.6)'; ctx.beginPath(); ctx.moveTo(w * .02, h); ctx.lineTo(w * .02, h * .72); ctx.lineTo(w * .14, h * .56); ctx.lineTo(w * .26, h * .72); ctx.lineTo(w * .26, h); ctx.fill();
    for (let x = 0; x < w; x += 40) { ctx.fillStyle = ['#ff6b9a', '#ffd23f', '#6bc8ff', '#7be0a0'][(x / 40 | 0) % 4]; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 34, 0); ctx.lineTo(x + 17, 22); ctx.fill(); }
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
    bingo_l1: mark(jackpotMark, DARK, jackpotFx, { legend: true, special: jackpotSpecial, win: jackpotWin }),
    bingo_l2: mark(pennant, DARK, pennantFx, { legend: true, special: buntingSpecial, win: cheerWin }),
    // v1.10.90 스킨 2배
bingo_c6: mark(heartSticker, DARK), bingo_c7: mark(starStamp, DARK), bingo_c8: mark(crayonCircle, DARK), bingo_c9: mark(checkMark, DARK), bingo_c10: mark(donutMark, DARK),
    bingo_p4: mark(splash, DARK, splashFx), bingo_p5: mark(clover, DARK, cloverFx), bingo_p6: mark(crownMark, DARK, crownFx),
    bingo_t3: theme(themePark, { backgroundColor: '#fff7fb', borderColor: '#ff7aa2', color: '#4a2a5a' }, { boxShadow: 'inset 0 0 0 2px #ffb36b,0 10px 24px rgba(0,0,0,.35)' }),
    bingo_l3: mark(carousel, DARK, carouselFx, { legend: true, special: carouselSpecial, win: carouselWin }), // 회전목마 ↔ 놀이공원
  });
}());
