// 사목(4목) skins (v1.7.36): chips for the plastic frame. The first player's chip (`black`) is always the dark, warm
// one and the second player's (`white`) the light one, so the two sides stay apart at a glance.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, sphere, gloss, starPath } = S.h;
  const dk = (c) => c === 'black';
  const base = (ctx, r, c, dark, light) => { ctx.fillStyle = sphere(ctx, r, dk(c) ? dark : light, .45); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); };
  const RED = ['#a83a4e', '#5e0c24', '#1c020a']; const GOLD = ['#ffffff', '#ffeb80', '#f0c030'];

  // ---- commons ----
  function rocket(ctx, r, c) { // 로켓칩
    base(ctx, r, c, RED, GOLD);
    ctx.fillStyle = dk(c) ? '#d9a0ac' : '#d9a020';
    ctx.beginPath(); ctx.moveTo(0, -r * .66); ctx.quadraticCurveTo(r * .3, -r * .28, r * .24, r * .2); ctx.lineTo(-r * .24, r * .2); ctx.quadraticCurveTo(-r * .3, -r * .28, 0, -r * .66); ctx.fill();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * .24, r * .02); ctx.lineTo(s * r * .5, r * .38); ctx.lineTo(s * r * .24, r * .26); ctx.fill(); }
    ctx.fillStyle = dk(c) ? '#8c1530' : '#f2c62e'; ctx.beginPath(); ctx.arc(0, -r * .22, r * .1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8a1f'; ctx.beginPath(); ctx.moveTo(-r * .14, r * .22); ctx.lineTo(0, r * .7); ctx.lineTo(r * .14, r * .22); ctx.fill();
  }
  function gearChip(ctx, r, c) { // 기어칩
    const n = 10; ctx.beginPath();
    for (let k = 0; k < n; k += 1) { const a = k * TAU / n; for (const [o, rad] of [[-.3, .82], [-.15, 1.02], [.15, 1.02], [.3, .82]]) { const x = Math.cos(a + o * TAU / n * 1.6) * r * rad; const y = Math.sin(a + o * TAU / n * 1.6) * r * rad; if (k === 0 && o === -.3) ctx.moveTo(x, y); else ctx.lineTo(x, y); } }
    ctx.closePath(); ctx.fillStyle = sphere(ctx, r, dk(c) ? RED : GOLD, .5); ctx.fill();
    ctx.strokeStyle = dk(c) ? 'rgba(255,200,210,.5)' : 'rgba(110,70,0,.5)'; ctx.lineWidth = r * .07; ctx.beginPath(); ctx.arc(0, 0, r * .52, 0, TAU); ctx.stroke();
    ctx.fillStyle = dk(c) ? '#3b0614' : '#7a5410'; ctx.beginPath(); ctx.arc(0, 0, r * .2, 0, TAU); ctx.fill();
  }
  function eyeball(ctx, r, c) { // 눈알몬스터칩
    base(ctx, r, c, ['#8b3aa0', '#4a1660', '#1a0524'], ['#f3ffb5', '#cfe869', '#8aa62a']);
    ctx.fillStyle = dk(c) ? '#85709a' : '#ffffff'; ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(200,40,60,.5)'; ctx.lineWidth = r * .03;
    for (let i = 0; i < 7; i += 1) { const a = i * TAU / 7 + .3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .66, Math.sin(a) * r * .66); ctx.lineTo(Math.cos(a) * r * .4, Math.sin(a) * r * .4); ctx.stroke(); }
    ctx.fillStyle = dk(c) ? '#ffcf33' : '#c2185b'; ctx.beginPath(); ctx.arc(r * .06, r * .02, r * .33, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0c0c10'; ctx.beginPath(); ctx.arc(r * .06, r * .02, r * .16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * .04, -r * .1, r * .07, 0, TAU); ctx.fill();
  }
  function starCoin(ctx, r, c) { // 별코인
    base(ctx, r, c, ['#e0566c', '#9e1a38', '#3b0614'], ['#fff3b0', '#eab92c', '#9a6a12']);
    ctx.strokeStyle = dk(c) ? 'rgba(255,215,220,.3)' : 'rgba(255,255,255,.7)'; ctx.lineWidth = r * .09; ctx.setLineDash([r * .12, r * .1]);
    ctx.beginPath(); ctx.arc(0, 0, r * .88, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = dk(c) ? '#7a5a22' : '#e0a82a'; starPath(ctx, 0, r * .02, r * .55, r * .24, 5); ctx.fill();
  }
  function token(ctx, r, c) { // 아케이드 토큰
    base(ctx, r, c, ['#c23a66', '#7a1240', '#30061a'], ['#fff6c0', '#f0d04c', '#a9811a']);
    ctx.strokeStyle = dk(c) ? 'rgba(255,200,220,.35)' : 'rgba(200,150,20,.6)'; ctx.lineWidth = r * .08;
    ctx.beginPath(); ctx.arc(0, 0, r * .8, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * .56, 0, TAU); ctx.stroke();
    ctx.fillStyle = dk(c) ? '#2a0413' : '#6b4f08'; ctx.beginPath(); ctx.roundRect(-r * .09, -r * .4, r * .18, r * .8, r * .09); ctx.fill();
    ctx.fillStyle = dk(c) ? '#b98a3a' : '#d9a020'; ctx.fillRect(-r * .34, -r * .05, r * .68, r * .1);
  }

  // ---- premiums ----
  function plasma(ctx, r, c) { // 플라즈마 코어
    base(ctx, r, c, ['#3c2a7a', '#170a3c', '#04020f'], ['#ffffff', '#dff8ff', '#9fd5e6']);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * .7);
    g.addColorStop(0, dk(c) ? 'rgba(255,120,240,.95)' : 'rgba(60,200,255,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * .7, 0, TAU); ctx.fill();
    ctx.strokeStyle = dk(c) ? 'rgba(120,230,255,.8)' : 'rgba(255,90,200,.8)'; ctx.lineWidth = r * .07;
    for (let i = 0; i < 3; i += 1) { ctx.beginPath(); ctx.arc(0, 0, r * (.3 + i * .18), i * 2, i * 2 + 3.2); ctx.stroke(); }
  }
  function plasmaFx(ctx, r, t) {
    for (let k = 0; k < 2; k += 1) { const tt = clamp01(t * 1.3 - k * .25); if (tt <= 0 || tt >= 1) continue; ctx.strokeStyle = `${k ? 'rgba(255,90,220,' : 'rgba(90,220,255,'}${(1 - tt) * .9})`; ctx.lineWidth = r * .12 * (1 - tt) + 1; ctx.beginPath(); ctx.arc(0, 0, r * (1 + 1.5 * tt), 0, TAU); ctx.stroke(); }
  }
  function holo(ctx, r, c) { // 홀로 디스크
    base(ctx, r, c, ['#4a4f8a', '#1a1d44', '#05060f'], ['#ffffff', '#eef2fb', '#b9c3dc']);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    const g = ctx.createLinearGradient(-r, -r, r, r);
    ['#ff6b9a', '#ffd86b', '#6bffb0', '#6bc8ff', '#b06bff'].forEach((col, i) => g.addColorStop(i / 4, col));
    ctx.globalAlpha = dk(c) ? .28 : .2; ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = r * .05; for (const k of [.35, .62, .88]) { ctx.beginPath(); ctx.arc(0, 0, r * k, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function holoFx(ctx, r, t) {
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * 1.05, 0, TAU); ctx.clip();
    const x = -r * 1.4 + t * r * 2.8; const g = ctx.createLinearGradient(x - r * .3, 0, x + r * .3, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, `rgba(255,255,255,${(1 - t) * .85})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4); ctx.restore();
  }
  function meteor(ctx, r, c) { // 운석 코어
    const R = rng(dk(c) ? 5 : 6); ctx.beginPath();
    for (let i = 0; i < 12; i += 1) { const a = i * TAU / 12; const rad = r * (.86 + R() * .16); if (i) ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); else ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad); }
    ctx.closePath(); ctx.fillStyle = sphere(ctx, r, dk(c) ? ['#7a4a3a', '#3a1d18', '#0e0504'] : ['#f3ede2', '#c9bfae', '#8a8070'], .5); ctx.fill();
    ctx.strokeStyle = 'rgba(255,120,30,.75)'; ctx.lineWidth = r * .07; ctx.stroke();
    ctx.fillStyle = dk(c) ? 'rgba(0,0,0,.35)' : 'rgba(90,80,65,.35)';
    for (const [x, y, k] of [[-.3, -.2, .22], [.32, .18, .18], [-.05, .4, .13]]) { ctx.beginPath(); ctx.arc(x * r, y * r, k * r, 0, TAU); ctx.fill(); }
  }
  function meteorFx(ctx, r, t) {
    const R = rng(9);
    for (let i = 0; i < 10; i += 1) { const a = i * TAU / 10 + R(); const d = r * (.9 + 1.6 * t * (.6 + R() * .5)); ctx.fillStyle = `rgba(255,${120 + (R() * 90 | 0)},30,${(1 - t)})`; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * .1 * (1 - t) + .6, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = `rgba(255,120,30,${(1 - t) * .7})`; ctx.lineWidth = r * .1 * (1 - t) + 1; ctx.beginPath(); ctx.arc(0, 0, r * (1 + .9 * t), 0, TAU); ctx.stroke();
  }

  // ---- legend ----
  function galaxy(ctx, r, c) { // 코스믹 커넥트
    base(ctx, r, c, ['#6a3fb0', '#2a1466', '#07031c'], ['#ffffff', '#f2ecff', '#b9a8e6']);
    ctx.strokeStyle = dk(c) ? 'rgba(255,215,120,.85)' : 'rgba(190,120,20,.85)'; ctx.lineWidth = r * .08; ctx.lineCap = 'round';
    for (let arm = 0; arm < 2; arm += 1) { ctx.beginPath(); for (let i = 0; i <= 24; i += 1) { const a = arm * Math.PI + i * .23; const rad = r * (.1 + i * .032); const x = Math.cos(a) * rad; const y = Math.sin(a) * rad; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); }
    ctx.fillStyle = dk(c) ? '#fff6c8' : '#d29a1f'; const R = rng(2);
    for (let i = 0; i < 8; i += 1) { const a = R() * TAU; const d = r * (.25 + R() * .6); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * .035, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r * .09, 0, TAU); ctx.fill();
  }
  function galaxyFx(ctx, r, t) {
    for (let k = 0; k < 2; k += 1) { const tt = clamp01(t * 1.25 - k * .22); if (tt <= 0 || tt >= 1) continue; ctx.strokeStyle = `rgba(200,170,255,${(1 - tt) * .9})`; ctx.lineWidth = r * .12 * (1 - tt) + 1; ctx.beginPath(); ctx.arc(0, 0, r * (1.05 + 2 * tt), 0, TAU); ctx.stroke(); }
  }
  function galaxyWin(ctx, pts, r, t) { // a beam of light runs through the four chips, then a burst
    if (pts.length < 2) return;
    const p = clamp01(t * 1.5); ctx.save(); ctx.lineCap = 'round';
    const a = pts[0]; const b = pts[pts.length - 1]; const ex = a.x + (b.x - a.x) * p; const ey = a.y + (b.y - a.y) * p;
    for (const [w, col] of [[r * .7, 'rgba(160,120,255,.22)'], [r * .26, 'rgba(255,236,170,.75)'], [r * .1, '#ffffff']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(ex, ey); ctx.stroke(); }
    const burst = clamp01((t - .4) / .6);
    if (burst > 0 && burst < 1) for (const pt of pts) { ctx.strokeStyle = `rgba(255,236,170,${(1 - burst) * .9})`; ctx.lineWidth = r * .12; ctx.beginPath(); ctx.arc(pt.x, pt.y, r * (1 + 1.6 * burst), 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function galaxySpecial(ctx, pts, r, t) { // three in a row: a faint constellation joins them, each chip twinkles
    const a = Math.sin(clamp01(t) * Math.PI); ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(200,180,255,${a * .7})`; ctx.lineWidth = r * .08; ctx.setLineDash([r * .16, r * .14]);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.setLineDash([]);
    pts.forEach((p, i) => { const tw = Math.sin(clamp01(t * 1.4 - i * .15) * Math.PI); ctx.fillStyle = `rgba(255,246,200,${tw * .95})`; starPath(ctx, p.x, p.y - r * .95, r * .3 * tw + .1, r * .1, 4); ctx.fill(); });
    ctx.restore();
  }

  // ---- legend 2 (v1.9.0): 픽셀 챔피언 ↔ 80년대 오락실 -- an 8-bit coin made of square pixels ----
  const PIX = 9; // pixels across the chip
  function pixelDisc(ctx, r, fill) { // the stepped, pixel-cut silhouette
    const s = (r * 2) / PIX;
    for (let j = 0; j < PIX; j += 1) for (let i = 0; i < PIX; i += 1) {
      const x = -r + i * s; const y = -r + j * s; const cx = x + s / 2; const cy = y + s / 2;
      if (cx * cx + cy * cy > r * r * .98) continue;
      const col = fill(i, j, Math.hypot(cx, cy) / r); if (!col) continue;
      ctx.fillStyle = col; ctx.fillRect(x, y, s + .5, s + .5);
    }
  }
  const HEART = ['.........', '.........', '..XX.XX..', '.XXXXXXX.', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....', '.........'];
  const STAR = ['.........', '....X....', '....X....', '.XXXXXXX.', '..XXXXX..', '..XX.XX..', '.XX...XX.', '.........', '.........'];
  function pixelChip(ctx, r, c) {
    const dark = dk(c); const icon = dark ? HEART : STAR;
    pixelDisc(ctx, r, (i, j, d) => {
      if (d > .8) return dark ? ((i + j) % 3 ? '#5c0b3e' : '#ff3ea5') : '#ffd23f'; // a dotted neon rim / a gold rim
      if (icon[j][i] === 'X') return dark ? '#d42a86' : '#ff9a2e';
      return dark ? ((i + j) % 2 ? '#3a1062' : '#451470') : ((i + j) % 2 ? '#fff27a' : '#fff7a8');
    });
  }
  function pixelChipFx(ctx, r, t) { // eight pixels jump out in steps, like an old sprite
    const step = Math.floor(clamp01(t) * 6) / 6; const s = r * .22;
    for (let k = 0; k < 8; k += 1) {
      const a = k * TAU / 8; const d = r * (1 + 1.6 * step);
      ctx.fillStyle = k % 2 ? `rgba(255,62,165,${1 - step})` : `rgba(80,240,255,${1 - step})`;
      ctx.fillRect(Math.cos(a) * d - s / 2, Math.sin(a) * d - s / 2, s, s);
    }
  }
  function pixelChipSpecial(ctx, pts, r, t) { // three in a row: a blinking pixel frame chases along the line
    const s = r * .2; const blink = Math.floor(t * 10) % 2 === 0;
    pts.forEach((p, i) => {
      const on = clamp01(t * 2.2 - i * .3); if (on <= 0) return;
      ctx.strokeStyle = blink ? '#50f0ff' : '#ff3ea5'; ctx.lineWidth = s * .7;
      ctx.strokeRect(p.x - r * 1.05, p.y - r * 1.05, r * 2.1, r * 2.1);
      ctx.fillStyle = '#ffe94a'; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(p.x + dx * r * 1.05 - s / 2, p.y + dy * r * 1.05 - s / 2, s, s);
    });
  }
  function pixelChipWin(ctx, pts, r, t) { // a neon scan sweeps the four chips, then pixel fireworks pop over each
    if (pts.length < 2) return;
    ctx.save();
    const p = clamp01(t * 1.6); const a = pts[0]; const b = pts[pts.length - 1];
    const ex = a.x + (b.x - a.x) * p; const ey = a.y + (b.y - a.y) * p; const s = r * .26;
    const n = Math.max(2, Math.round(Math.hypot(ex - a.x, ey - a.y) / s));
    for (let k = 0; k <= n; k += 1) { // the line itself is laid in pixels
      const x = a.x + (ex - a.x) * k / n; const y = a.y + (ey - a.y) * k / n;
      ctx.fillStyle = k % 2 ? '#ff3ea5' : '#50f0ff'; ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    const pop = clamp01((t - .45) / .55);
    if (pop > 0 && pop < 1) pts.forEach((pt, i) => {
      const q = Math.floor(clamp01(pop * 1.2 - i * .06) * 7) / 7;
      for (let k = 0; k < 12; k += 1) {
        const ang = k * TAU / 12; const d = r * (.4 + 2.2 * q);
        ctx.fillStyle = ['#ffe94a', '#ff3ea5', '#50f0ff'][k % 3]; ctx.globalAlpha = 1 - q;
        ctx.fillRect(pt.x + Math.cos(ang) * d - s / 2, pt.y + Math.sin(ang) * d - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  // ---- room themes: surface behind the frame, frame colours, extra decoration over the frame ----
  function arcadeSurface(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#1a0638'); g.addColorStop(.6, '#2a0a52'); g.addColorStop(1, '#0a0220'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,62,165,.55)'; ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i += 1) { ctx.beginPath(); ctx.moveTo(w / 2 + i * 26, h * .72); ctx.lineTo(w / 2 + i * 140, h); ctx.stroke(); }
    for (let k = 0; k < 6; k += 1) { const y = h * .72 + (h * .28) * (k / 6) ** 1.6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    const sun = ctx.createLinearGradient(0, h * .5, 0, h * .72); sun.addColorStop(0, '#ffd23f'); sun.addColorStop(1, '#ff3ea5');
    ctx.fillStyle = sun; ctx.beginPath(); ctx.arc(w / 2, h * .72, w * .16, Math.PI, TAU); ctx.fill();
  }
  function stationSurface(ctx, w, h) {
    ctx.fillStyle = '#04070f'; ctx.fillRect(0, 0, w, h); const R = rng(41);
    for (let i = 0; i < 120; i += 1) { ctx.fillStyle = `rgba(255,255,255,${.2 + R() * .7})`; ctx.beginPath(); ctx.arc(R() * w, R() * h, .5 + R() * 1.2, 0, TAU); ctx.fill(); }
    const pg = ctx.createRadialGradient(w * .85, h * .15, 4, w * .85, h * .15, w * .2); pg.addColorStop(0, '#6fb5ff'); pg.addColorStop(.7, '#1d4f9a'); pg.addColorStop(1, '#06142e');
    ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(w * .85, h * .15, w * .2, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(150,170,200,.35)'; ctx.lineWidth = 2; ctx.strokeRect(10, 10, w - 20, h - 20);
    for (let x = 40; x < w; x += 120) { ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x, 34); ctx.stroke(); }
  }
  const arcadeOverlay = (ctx, f) => { ctx.save(); ctx.strokeStyle = 'rgba(255,140,220,.9)'; ctx.lineWidth = 3; ctx.shadowColor = '#ff3ea5'; ctx.shadowBlur = 14; ctx.strokeRect(f.left - 14, f.top - 14, f.gridW + 28, f.gridH + 28); ctx.restore(); };
  const stationOverlay = (ctx, f) => { ctx.fillStyle = '#e2e8f0'; for (const [x, y] of [[f.left - 8, f.top - 8], [f.left + f.gridW + 8, f.top - 8], [f.left - 8, f.top + f.gridH + 8], [f.left + f.gridW + 8, f.top + f.gridH + 8]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); } };

  // ---- v1.10.90 스킨 2배 (IDEAS #future-skins-double): five commons, three premiums, a legend and its room (오로라
  // 크리스탈 ↔ 오로라 설원). The first player's chip stays the dark warm one, the second's the light one.
  function donut(ctx, r, c) { // 도넛칩: chocolate glaze (dark) / vanilla glaze (light), sprinkles
    const d = dk(c);
    ctx.fillStyle = sphere(ctx, r, ['#e9b57a', '#c4823e', '#7a4515'], .5); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.fillStyle = d ? '#4a1d10' : '#fff3f6';
    ctx.beginPath(); for (let i = 0; i <= 24; i += 1) { const a = i * TAU / 24; const k = r * (.86 + (i % 2) * .06); if (i) ctx.lineTo(Math.cos(a) * k, Math.sin(a) * k); else ctx.moveTo(Math.cos(a) * k, Math.sin(a) * k); } ctx.fill();
    const R = rng(5); const cols = ['#ff5f8a', '#ffd84a', '#5fd0ff', '#8be07a'];
    ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, r * .08);
    for (let i = 0; i < 16; i += 1) { const a = R() * TAU; const k = r * (.42 + R() * .38); const x = Math.cos(a) * k; const y = Math.sin(a) * k; const o = R() * TAU; ctx.strokeStyle = cols[i % 4]; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(o) * r * .14, y + Math.sin(o) * r * .14); ctx.stroke(); }
    ctx.fillStyle = '#1b0d06'; ctx.beginPath(); ctx.arc(0, 0, r * .28, 0, TAU); ctx.fill(); // the hole
    gloss(ctx, r, .18);
  }
  function cookie(ctx, r, c) { // 쿠키칩: a double-chocolate cookie (dark) / a butter cookie (light)
    const d = dk(c); const R = rng(9);
    ctx.fillStyle = sphere(ctx, r, d ? ['#7a4a2a', '#4a2510', '#1c0a02'] : ['#fff2d6', '#f0cf93', '#c79a52'], .5);
    ctx.beginPath(); for (let i = 0; i <= 20; i += 1) { const a = i * TAU / 20; const k = r * (.94 + R() * .07); if (i) ctx.lineTo(Math.cos(a) * k, Math.sin(a) * k); else ctx.moveTo(Math.cos(a) * k, Math.sin(a) * k); } ctx.fill();
    ctx.fillStyle = d ? '#1a0904' : '#5a2e12';
    for (let i = 0; i < 8; i += 1) { const a = R() * TAU; const k = r * R() * .7; ctx.beginPath(); ctx.ellipse(Math.cos(a) * k, Math.sin(a) * k, r * .1, r * .08, R() * 3, 0, TAU); ctx.fill(); }
    if (!d) { ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 10; i += 1) { const a = R() * TAU; const k = r * R() * .8; ctx.fillRect(Math.cos(a) * k, Math.sin(a) * k, r * .05, r * .05); } }
  }
  function vinyl(ctx, r, c) { // 레코드판: black vinyl with a red label / white vinyl with a sky-blue label
    const d = dk(c);
    ctx.fillStyle = sphere(ctx, r, d ? ['#3a3036', '#16101a', '#050306'] : ['#ffffff', '#f2f2f5', '#c8c8d2'], .5); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = d ? 'rgba(255,255,255,.08)' : 'rgba(0,0,40,.1)'; ctx.lineWidth = 1;
    for (let k = .45; k < .96; k += .07) { ctx.beginPath(); ctx.arc(0, 0, r * k, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = d ? '#c0303e' : '#5aa9e6'; ctx.beginPath(); ctx.arc(0, 0, r * .36, 0, TAU); ctx.fill();
    ctx.fillStyle = d ? '#ffe9b0' : '#ffffff'; ctx.font = `bold ${Math.round(r * .2)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('♪', 0, -r * .14);
    ctx.fillStyle = '#0a0608'; ctx.beginPath(); ctx.arc(0, 0, r * .06, 0, TAU); ctx.fill();
    ctx.strokeStyle = d ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.7)'; ctx.lineWidth = r * .12; ctx.beginPath(); ctx.arc(0, 0, r * .7, -2.4, -1.6); ctx.stroke();
  }
  function ladybug(ctx, r, c) { // 무당벌레칩: a deep-red ladybug (dark) / a cream one with honey spots (light)
    const d = dk(c);
    ctx.fillStyle = d ? '#1a0a0a' : '#4a3a2a'; ctx.beginPath(); ctx.arc(0, -r * .62, r * .36, 0, TAU); ctx.fill(); // head
    ctx.fillStyle = sphere(ctx, r, d ? ['#c8343a', '#7a0c14', '#2a0204'] : ['#ffffff', '#fff3d6', '#e2c48a'], .45); ctx.beginPath(); ctx.arc(0, r * .08, r * .9, 0, TAU); ctx.fill();
    ctx.strokeStyle = d ? '#140404' : '#7a5a2a'; ctx.lineWidth = Math.max(1, r * .07); ctx.beginPath(); ctx.moveTo(0, -r * .8); ctx.lineTo(0, r * .98); ctx.stroke();
    ctx.fillStyle = d ? '#140404' : '#d99a2a';
    for (const [x, y, k] of [[-.42, -.18, .16], [.42, -.18, .16], [-.5, .32, .13], [.5, .32, .13], [-.22, .62, .11], [.22, .62, .11]]) { ctx.beginPath(); ctx.arc(x * r, y * r, k * r, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * .13, -r * .7, r * .06, 0, TAU); ctx.fill(); }
    gloss(ctx, r, .2);
  }
  function dice(ctx, r, c) { // 주사위칩: a ruby die (dark) / an ivory die (light), its five face up
    const d = dk(c); const s = r * .78;
    ctx.fillStyle = sphere(ctx, r, d ? ['#b8384a', '#6a0f22', '#22040a'] : ['#ffffff', '#fbf6ec', '#d6ccb8'], .45);
    ctx.beginPath(); ctx.moveTo(-s + r * .2, -s); ctx.arcTo(s, -s, s, s, r * .26); ctx.arcTo(s, s, -s, s, r * .26); ctx.arcTo(-s, s, -s, -s, r * .26); ctx.arcTo(-s, -s, s, -s, r * .26); ctx.closePath(); ctx.fill();
    ctx.fillStyle = d ? '#fff1d6' : '#c0303e';
    for (const [x, y] of [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(x * s * .5, y * s * .5, r * .13, 0, TAU); ctx.fill(); }
    gloss(ctx, r, .2);
  }
  function neonRing(ctx, r, c) { // 네온 링: a dark chip ringed with glowing tubes
    const d = dk(c);
    ctx.fillStyle = sphere(ctx, r, d ? ['#4a1830', '#22081a', '#0a0208'] : ['#ffffff', '#f4f0ff', '#cbc2e6'], .5); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.save(); ctx.shadowBlur = r * .4;
    for (const [k, col] of [[.78, d ? '#ff3ea5' : '#a63ad9'], [.48, d ? '#ffd23f' : '#2a8fd6']]) { ctx.shadowColor = col; ctx.strokeStyle = col; ctx.lineWidth = r * .12; ctx.beginPath(); ctx.arc(0, 0, r * k, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function neonRingFx(ctx, r, t) {
    ctx.save(); ctx.shadowColor = '#ff3ea5'; ctx.shadowBlur = 10;
    for (let k = 0; k < 2; k += 1) { const tt = clamp01(t * 1.3 - k * .2); if (tt <= 0 || tt >= 1) continue; ctx.strokeStyle = `rgba(255,${k ? 210 : 62},${k ? 63 : 165},${1 - tt})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, r * (1.1 + 1.8 * tt), 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  function jelly(ctx, r, c) { // 버블 젤리: a wobbly gummy chip with bubbles inside
    const d = dk(c);
    ctx.fillStyle = sphere(ctx, r, d ? ['#e2546a', '#9a1630', '#3a0610'] : ['#ffffff', '#e8fff2', '#9fe0bf'], .5);
    ctx.beginPath(); for (let i = 0; i <= 32; i += 1) { const a = i * TAU / 32; const k = r * (1 + Math.sin(a * 5) * .035); if (i) ctx.lineTo(Math.cos(a) * k, Math.sin(a) * k); else ctx.moveTo(Math.cos(a) * k, Math.sin(a) * k); } ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2;
    for (const [x, y, k] of [[-.3, .2, .14], [.25, .35, .1], [.32, -.12, .08], [-.05, .5, .07]]) { ctx.beginPath(); ctx.arc(x * r, y * r, k * r, 0, TAU); ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-r * .3, -r * .42, r * .3, r * .14, -.5, 0, TAU); ctx.fill();
  }
  function jellyFx(ctx, r, t) { // a jelly splash: small drops flung round
    ctx.save(); ctx.fillStyle = `rgba(255,140,170,${1 - t})`;
    for (let i = 0; i < 10; i += 1) { const a = i * TAU / 10; const k = r * (1 + 1.6 * t); ctx.beginPath(); ctx.ellipse(Math.cos(a) * k, Math.sin(a) * k + t * t * r * .8, r * .14 * (1 - t) + 1, r * .1 * (1 - t) + 1, a, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function magnet(ctx, r, c) { // 자석 코어: a horseshoe magnet on a steel chip
    const d = dk(c);
    ctx.fillStyle = sphere(ctx, r, d ? ['#5a5f6e', '#262a34', '#0a0b10'] : ['#ffffff', '#eef1f6', '#c2c9d6'], .5); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.lineCap = 'butt'; ctx.lineWidth = r * .26;
    ctx.strokeStyle = d ? '#d8343a' : '#e0454a'; ctx.beginPath(); ctx.arc(0, -r * .05, r * .42, Math.PI, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * .42, -r * .05); ctx.lineTo(-r * .42, r * .28); ctx.moveTo(r * .42, -r * .05); ctx.lineTo(r * .42, r * .28); ctx.stroke();
    ctx.fillStyle = '#e8eef6'; ctx.fillRect(-r * .55, r * .28, r * .26, r * .2); ctx.fillRect(r * .29, r * .28, r * .26, r * .2);
    gloss(ctx, r, .2);
  }
  function magnetFx(ctx, r, t) { // field lines bending out and back
    ctx.save(); ctx.strokeStyle = `rgba(150,190,255,${(1 - t) * .9})`; ctx.lineWidth = 1.6;
    for (let k = 1; k <= 3; k += 1) { const s = r * (1 + k * .5 * (.4 + t)); ctx.beginPath(); ctx.ellipse(-s * .5, 0, s * .5, s * .32, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(s * .5, 0, s * .5, s * .32, 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  }
  // 오로라 크리스탈 (legend) ↔ 오로라 설원 (room)
  function auroraCrystal(ctx, r, c) {
    const d = dk(c);
    ctx.save(); ctx.shadowColor = d ? 'rgba(80,255,190,.5)' : 'rgba(150,220,255,.8)'; ctx.shadowBlur = r * .35;
    ctx.beginPath(); for (let i = 0; i < 8; i += 1) { const a = i * TAU / 8 - Math.PI / 8; const k = r * (i % 2 ? .92 : 1.04); if (i) ctx.lineTo(Math.cos(a) * k, Math.sin(a) * k); else ctx.moveTo(Math.cos(a) * k, Math.sin(a) * k); } ctx.closePath();
    const g = ctx.createLinearGradient(-r, -r, r, r);
    if (d) { g.addColorStop(0, '#1d5a6a'); g.addColorStop(.5, '#0f2a44'); g.addColorStop(1, '#2a0f3a'); } else { g.addColorStop(0, '#ffffff'); g.addColorStop(.5, '#e6fbff'); g.addColorStop(1, '#f2e6ff'); }
    ctx.fillStyle = g; ctx.fill(); ctx.restore();
    ctx.save(); ctx.clip();
    const band = ctx.createLinearGradient(-r, 0, r, 0); band.addColorStop(0, 'rgba(80,255,170,0)'); band.addColorStop(.3, d ? 'rgba(80,255,170,.55)' : 'rgba(60,200,150,.4)'); band.addColorStop(.7, d ? 'rgba(170,110,255,.5)' : 'rgba(150,100,230,.35)'); band.addColorStop(1, 'rgba(170,110,255,0)');
    ctx.strokeStyle = band; ctx.lineWidth = r * .22; ctx.beginPath(); ctx.moveTo(-r * .8, r * .1); ctx.bezierCurveTo(-r * .3, -r * .5, r * .3, r * .4, r * .8, -r * .2); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = d ? '#9ff0d8' : '#8ab8e0'; ctx.lineWidth = Math.max(1.2, r * .06);
    ctx.beginPath(); for (let i = 0; i < 8; i += 1) { const a = i * TAU / 8 - Math.PI / 8; const k = r * (i % 2 ? .92 : 1.04); if (i) ctx.lineTo(Math.cos(a) * k, Math.sin(a) * k); else ctx.moveTo(Math.cos(a) * k, Math.sin(a) * k); } ctx.closePath(); ctx.stroke();
    gloss(ctx, r, .3);
  }
  function auroraCrystalFx(ctx, r, t) { // ribbons of light unfurling over the drop
    ctx.save(); ctx.lineCap = 'round';
    for (let k = 0; k < 3; k += 1) { ctx.strokeStyle = [`rgba(90,255,180,${1 - t})`, `rgba(120,200,255,${1 - t})`, `rgba(190,120,255,${1 - t})`][k]; ctx.lineWidth = r * .14 * (1 - t) + 1; const y = -r * (1.2 + t * 1.6) - k * r * .25; ctx.beginPath(); ctx.moveTo(-r * 1.6, y); ctx.bezierCurveTo(-r * .5, y - r * .5 * Math.sin(t * 6 + k), r * .5, y + r * .5, r * 1.6, y - r * .2); ctx.stroke(); }
    ctx.restore();
  }
  function auroraSpecial(ctx, pts, r, t) { // three in a row: a ribbon of aurora waves along them
    if (pts.length < 2) return;
    const fade = t < .8 ? 1 : (1 - t) / .2;
    ctx.save(); ctx.lineCap = 'round';
    for (let k = 0; k < 3; k += 1) {
      ctx.strokeStyle = [`rgba(90,255,180,${.6 * fade})`, `rgba(120,200,255,${.5 * fade})`, `rgba(190,120,255,${.45 * fade})`][k]; ctx.lineWidth = r * .22;
      ctx.beginPath(); pts.forEach((p, i) => { const y = p.y - r * 1.1 - k * r * .25 + Math.sin(t * 8 + i + k) * r * .2; if (i) ctx.lineTo(p.x, y); else ctx.moveTo(p.x, y); }); ctx.stroke();
    }
    ctx.restore();
  }
  function auroraWin(ctx, pts, r, t) { // the four light up one by one, a curtain of aurora falls over the board
    if (pts.length < 2) return;
    ctx.save();
    const link = clamp01(t / .35) * (pts.length - 1);
    pts.forEach((p, i) => { if (link < i) return; const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.6); glow.addColorStop(0, 'rgba(160,255,220,.75)'); glow.addColorStop(1, 'rgba(160,255,220,0)'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.6, 0, TAU); ctx.fill(); });
    const curtain = clamp01((t - .3) / .5);
    if (curtain > 0) {
      const a = t > .85 ? (1 - t) / .15 : 1; const x0 = Math.min(...pts.map((p) => p.x)) - r * 2; const x1 = Math.max(...pts.map((p) => p.x)) + r * 2; const top = Math.min(...pts.map((p) => p.y)) - r * 4;
      for (let k = 0; k < 3; k += 1) {
        const g = ctx.createLinearGradient(0, top, 0, top + r * 4 * curtain); g.addColorStop(0, ['rgba(90,255,180,', 'rgba(120,200,255,', 'rgba(190,120,255,'][k] + (.45 * a) + ')'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0, top); for (let x = x0; x <= x1; x += r * .5) ctx.lineTo(x, top + r * (1.5 + k * .6) * curtain + Math.sin(x / r + t * 6 + k) * r * .4); ctx.lineTo(x1, top); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
  function auroraSurface(ctx, w, h) { // 오로라 설원: a polar night, aurora over snowy hills
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, '#071430'); sky.addColorStop(.7, '#123058'); sky.addColorStop(1, '#2a4a70'); ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const R = rng(88); for (let i = 0; i < 90; i += 1) { ctx.fillStyle = `rgba(255,255,255,${.2 + R() * .6})`; ctx.beginPath(); ctx.arc(R() * w, R() * h * .6, .5 + R(), 0, TAU); ctx.fill(); }
    for (let k = 0; k < 3; k += 1) {
      const g = ctx.createLinearGradient(0, h * (.08 + k * .07), 0, h * (.42 + k * .05)); g.addColorStop(0, ['rgba(90,255,180,.5)', 'rgba(120,200,255,.4)', 'rgba(190,120,255,.35)'][k]); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, h * (.1 + k * .07)); for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * (.1 + k * .07) + Math.sin(x / 90 + k) * h * .05); ctx.lineTo(w, h * .5); ctx.lineTo(0, h * .5); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#e8f2ff'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * .82); for (let x = 0; x <= w; x += 30) ctx.lineTo(x, h * .82 - Math.sin(x / 140) * h * .05 - Math.sin(x / 53) * h * .015); ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  }
  const auroraOverlay = (ctx, f) => { // snow resting on the frame's top
    ctx.save(); ctx.fillStyle = '#f4f9ff'; ctx.beginPath(); ctx.moveTo(f.left - 14, f.top - 12);
    for (let x = f.left - 14; x <= f.left + f.gridW + 14; x += 12) ctx.lineTo(x, f.top - 16 - Math.abs(Math.sin(x / 17)) * 7);
    ctx.lineTo(f.left + f.gridW + 14, f.top - 8); ctx.lineTo(f.left - 14, f.top - 8); ctx.closePath(); ctx.fill(); ctx.restore();
  };

  // ---- shop pictures ----
  function holeRow(ctx, w, h, skinId, themed) {
    const r = Math.min(w, h) * .3;
    for (const [cx, color] of [[w * .28, 'black'], [w * .72, 'white']]) {
      ctx.save(); ctx.translate(cx, h / 2); S.paintStone(ctx, r, skinId, color); ctx.restore();
      ctx.strokeStyle = themed || '#2f66e6'; ctx.lineWidth = r * .34; ctx.beginPath(); ctx.arc(cx, h / 2, r * 1.16, 0, TAU); ctx.stroke();
    }
  }
  function previewPiece(ctx, w, h, skinId) {
    ctx.fillStyle = '#16264a'; ctx.fillRect(0, 0, w, h); holeRow(ctx, w, h, skinId);
    const fx = S.def(skinId).fx; if (fx) { ctx.save(); ctx.translate(w * .72, h / 2); fx(ctx, Math.min(w, h) * .3, .4, 'white'); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) {
    const b = S.def(skinId).board; b.paint(ctx, w, h);
    const pad = 14; const cw = (w - pad * 2) / 7; const ch = (h - pad * 2) / 3;
    const g = ctx.createLinearGradient(pad, pad, w - pad, h - pad); g.addColorStop(0, b.plastic[0]); g.addColorStop(.5, b.plastic[1]); g.addColorStop(1, b.plastic[2]);
    ctx.save(); ctx.beginPath(); ctx.rect(pad - 6, pad - 6, w - pad * 2 + 12, h - pad * 2 + 12);
    for (let y = 0; y < 3; y += 1) for (let x = 0; x < 7; x += 1) { ctx.moveTo(pad + (x + .5) * cw + cw * .36, pad + (y + .5) * ch); ctx.arc(pad + (x + .5) * cw, pad + (y + .5) * ch, cw * .36, 0, TAU); }
    ctx.fillStyle = g; ctx.fill('evenodd'); ctx.restore();
  }
  const piece = (stone, fx, win) => ({ stone, fx, win, preview: previewPiece });
  // A legend (v1.9.0, the v1.8.7 omok standard): own silhouette, drop effect, `special` (exactly three in a row), win.
  const legend = (stone, fx, special, win) => ({ stone, fx, special, win, legend: true, preview: previewPiece });
  const theme = (paint, plastic, slot, feet, overlay) => ({ board: { paint, plastic, slot, feet, overlay }, preview: previewTheme });
  S.define({
    connect4_c1: piece(rocket), connect4_c2: piece(gearChip), connect4_c3: piece(eyeball), connect4_c4: piece(starCoin), connect4_c5: piece(token),
    connect4_p1: piece(plasma, plasmaFx), connect4_p2: piece(holo, holoFx), connect4_p3: piece(meteor, meteorFx),
    connect4_t1: theme(arcadeSurface, ['#ff3ea5', '#b5179e', '#5a0a6e'], '#12002a', '#5a0a6e', arcadeOverlay),
    connect4_t2: theme(stationSurface, ['#cbd5e1', '#8b97a8', '#4b5563'], '#05080f', '#4b5563', stationOverlay),
    connect4_l1: legend(galaxy, galaxyFx, galaxySpecial, galaxyWin),
    connect4_l2: legend(pixelChip, pixelChipFx, pixelChipSpecial, pixelChipWin),
    // v1.10.90 스킨 2배
connect4_c6: piece(donut), connect4_c7: piece(cookie), connect4_c8: piece(vinyl), connect4_c9: piece(ladybug), connect4_c10: piece(dice),
    connect4_p4: piece(neonRing, neonRingFx), connect4_p5: piece(jelly, jellyFx), connect4_p6: piece(magnet, magnetFx),
    connect4_t3: theme(auroraSurface, ['#dbeafe', '#93c5fd', '#3b6ea8'], '#071430', '#3b6ea8', auroraOverlay),
    connect4_l3: legend(auroraCrystal, auroraCrystalFx, auroraSpecial, auroraWin), // 오로라 크리스탈 ↔ 오로라 설원
  });
}());
