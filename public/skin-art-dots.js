// 점과 상자 skins (v1.7.37): how a drawn line looks (and what a claimed box looks like for the legend). The two sides stay
// blue (first player, `black`) and red (second, `white`) in every skin, and the owner's letter on a box is kept.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, starPath } = S.h;
  const PAL = {
    black: { main: '#1e40af', mid: '#2563eb', light: '#93c5fd', deep: '#0f1f5a', neon: '#38bdf8' },
    white: { main: '#b91c1c', mid: '#ef4444', light: '#fca5a5', deep: '#450a0a', neon: '#fb7185' },
  };
  const pal = (c) => PAL[c === 'white' ? 'white' : 'black'];
  const geom = (x1, y1, x2, y2) => { const dx = x2 - x1; const dy = y2 - y1; const len = Math.hypot(dx, dy) || 1; return { dx, dy, len, ux: dx / len, uy: dy / len, nx: -dy / len, ny: dx / len, ang: Math.atan2(dy, dx) }; };
  const stroke = (ctx, x1, y1, x2, y2, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  const along = (x1, y1, x2, y2, step, fn) => { const g = geom(x1, y1, x2, y2); for (let d = step / 2, i = 0; d < g.len; d += step, i += 1) fn(x1 + g.ux * d, y1 + g.uy * d, g, i); };

  // ---- commons (the line itself) ----
  function bamboo(ctx, x1, y1, x2, y2, c) {
    const P = pal(c); const tone = c === 'white' ? ['#b8603a', '#d98a5a'] : ['#2f8fa8', '#7fd0e0'];
    stroke(ctx, x1, y1, x2, y2, 14, tone[0]); stroke(ctx, x1 - 1, y1 - 2, x2 - 1, y2 - 2, 4, tone[1]);
    along(x1, y1, x2, y2, 34, (x, y, g) => { stroke(ctx, x - g.nx * 7, y - g.ny * 7, x + g.nx * 7, y + g.ny * 7, 3, P.deep); });
  }
  function rope(ctx, x1, y1, x2, y2, c) {
    const P = pal(c); stroke(ctx, x1, y1, x2, y2, 13, P.main);
    along(x1, y1, x2, y2, 7, (x, y, g) => { stroke(ctx, x - g.nx * 6 - g.ux * 3, y - g.ny * 6 - g.uy * 3, x + g.nx * 6 + g.ux * 3, y + g.ny * 6 + g.uy * 3, 3, P.light); });
  }
  function rail(ctx, x1, y1, x2, y2, c) {
    const P = pal(c);
    along(x1, y1, x2, y2, 11, (x, y, g) => { stroke(ctx, x - g.nx * 9, y - g.ny * 9, x + g.nx * 9, y + g.ny * 9, 4, '#6b4a2a'); });
    const g = geom(x1, y1, x2, y2);
    for (const s of [-1, 1]) stroke(ctx, x1 + g.nx * 5 * s, y1 + g.ny * 5 * s, x2 + g.nx * 5 * s, y2 + g.ny * 5 * s, 3.4, P.mid);
  }
  function chain(ctx, x1, y1, x2, y2, c) {
    const P = pal(c);
    along(x1, y1, x2, y2, 12, (x, y, g, i) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(g.ang);
      ctx.strokeStyle = P.light; ctx.fillStyle = P.deep; ctx.lineWidth = 3;
      ctx.beginPath(); if (i % 2) ctx.ellipse(0, 0, 8, 3, 0, 0, TAU); else ctx.ellipse(0, 0, 6, 6, 0, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
    });
  }
  function crayon(ctx, x1, y1, x2, y2, c) {
    const P = pal(c); const R = rng(Math.round(x1 * 7 + y1 * 13 + x2 + y2)); const g = geom(x1, y1, x2, y2);
    for (let k = 0; k < 3; k += 1) { const o = (k - 1) * 3.2; ctx.globalAlpha = .55; stroke(ctx, x1 + g.nx * o + (R() - .5) * 3, y1 + g.ny * o + (R() - .5) * 3, x2 + g.nx * o + (R() - .5) * 3, y2 + g.ny * o + (R() - .5) * 3, 7, k === 1 ? P.mid : P.light); }
    ctx.globalAlpha = .7; ctx.fillStyle = P.deep; for (let i = 0; i < g.len / 3; i += 1) { const d = R() * g.len; const o = (R() - .5) * 13; ctx.fillRect(x1 + g.ux * d + g.nx * o, y1 + g.uy * d + g.ny * o, 1.4, 1.4); }
    ctx.globalAlpha = 1;
  }

  // ---- premiums (a clear look plus a short effect when a line is drawn) ----
  function cable(ctx, x1, y1, x2, y2, c) {
    const P = pal(c); stroke(ctx, x1, y1, x2, y2, 15, '#151a26'); stroke(ctx, x1, y1, x2, y2, 9, P.mid); stroke(ctx, x1, y1, x2, y2, 3, '#ffffff');
    ctx.strokeStyle = '#fff6a8'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
    along(x1, y1, x2, y2, 30, (x, y, g) => { ctx.moveTo(x - g.ux * 6 + g.nx * 6, y - g.uy * 6 + g.ny * 6); ctx.lineTo(x, y - g.ny * 0); ctx.lineTo(x + g.ux * 6 - g.nx * 6, y + g.uy * 6 - g.ny * 6); }); ctx.stroke();
  }
  function cableFx(ctx, x1, y1, x2, y2, c, t) {
    const R = rng(5);
    for (const [x, y] of [[x1, y1], [x2, y2]]) for (let i = 0; i < 6; i += 1) { const a = R() * TAU; const d = 6 + 26 * t * (.5 + R()); ctx.strokeStyle = `rgba(255,246,168,${1 - t})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * d * .5, y + Math.sin(a) * d * .5); ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); ctx.stroke(); }
  }
  function lava(ctx, x1, y1, x2, y2, c) {
    const P = pal(c); const R = rng(Math.round(x1 + y1 * 3 + x2 * 5)); const g = geom(x1, y1, x2, y2); const pts = [[x1, y1]];
    for (let d = 16; d < g.len - 8; d += 16) { const o = (R() - .5) * 12; pts.push([x1 + g.ux * d + g.nx * o, y1 + g.uy * d + g.ny * o]); }
    pts.push([x2, y2]);
    for (const [w, col] of [[16, P.deep], [12, P.mid], [5, '#ff7a1a'], [2, '#ffd24a']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); }
  }
  function lavaFx(ctx, x1, y1, x2, y2, c, t) {
    const R = rng(8); along(x1, y1, x2, y2, 22, (x, y) => { const k = R(); ctx.fillStyle = `rgba(255,${150 + (k * 90 | 0)},40,${(1 - t) * .9})`; ctx.beginPath(); ctx.arc(x + (R() - .5) * 10, y - 6 - 28 * t * (.6 + k), 2.4 * (1 - t) + .6, 0, TAU); ctx.fill(); });
  }
  function laser(ctx, x1, y1, x2, y2, c) {
    const P = pal(c); ctx.globalAlpha = .35; stroke(ctx, x1, y1, x2, y2, 18, P.light); ctx.globalAlpha = .95; stroke(ctx, x1, y1, x2, y2, 8, P.mid); stroke(ctx, x1, y1, x2, y2, 3, '#ffffff'); ctx.globalAlpha = 1;
    for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.fillStyle = '#1a2233'; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill(); ctx.fillStyle = P.light; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); }
  }
  function laserFx(ctx, x1, y1, x2, y2, c, t) {
    const x = x1 + (x2 - x1) * t; const y = y1 + (y2 - y1) * t; const g = ctx.createRadialGradient(x, y, 0, x, y, 26); g.addColorStop(0, `rgba(255,255,255,${1 - t * .5})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.fill();
  }

  // ---- legend: 회로 지배자 -- a circuit trace, current running along a fresh line, and boxes become energy cells ----
  function circuit(ctx, x1, y1, x2, y2, c) {
    const P = pal(c); stroke(ctx, x1, y1, x2, y2, 16, '#0a1b22'); stroke(ctx, x1, y1, x2, y2, 8, P.mid); stroke(ctx, x1, y1, x2, y2, 3, P.neon);
    along(x1, y1, x2, y2, 30, (x, y, g) => { ctx.fillStyle = '#e8fbff'; ctx.save(); ctx.translate(x, y); ctx.rotate(g.ang); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); });
  }
  function circuitFx(ctx, x1, y1, x2, y2, c, t) {
    const P = pal(c); for (let k = 0; k < 3; k += 1) { const u = clamp01(t * 1.4 - k * .12); if (u <= 0 || u >= 1) continue; const x = x1 + (x2 - x1) * u; const y = y1 + (y2 - y1) * u; const g = ctx.createRadialGradient(x, y, 0, x, y, 20); g.addColorStop(0, '#ffffff'); g.addColorStop(.4, P.neon); g.addColorStop(1, 'rgba(56,189,248,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill(); }
  }
  function cell(ctx, bx, by, size, c, t) { // a claimed box becomes an energy cell
    const P = pal(c); const pulse = .5 + .5 * Math.sin(t * 6);
    ctx.save(); ctx.translate(bx + size / 2, by + size / 2);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * .7); g.addColorStop(0, `${P.neon}`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = .32 + .18 * pulse; ctx.fillStyle = g; ctx.fillRect(-size / 2, -size / 2, size, size); ctx.globalAlpha = 1;
    ctx.strokeStyle = P.neon; ctx.lineWidth = 4; ctx.strokeRect(-size * .36, -size * .36, size * .72, size * .72);
    ctx.fillStyle = '#e8fbff'; ctx.beginPath(); [[.05, -.3], [-.16, .04], [-.02, .04], [-.06, .3], [.16, -.06], [.02, -.06]].forEach(([x, y], i) => { if (i) ctx.lineTo(x * size, y * size); else ctx.moveTo(x * size, y * size); }); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // v1.9.0 legend standard: `special(ctx, boxes, t, color)` when one line closes two or more boxes, `win(ctx, boxes, t,
  // color, size)` over all the winner's boxes when the game ends. A box is { x, y, size } (its top-left and side).
  const mid = (b) => ({ x: b.x + b.size / 2, y: b.y + b.size / 2 });
  function circuitSpecial(ctx, boxes, t, c) { // an arc of current jumps between the boxes closed together
    const P = pal(c); const pts = boxes.map(mid); const a = Math.sin(clamp01(t) * Math.PI); const R = rng(Math.floor(t * 20));
    ctx.save(); ctx.strokeStyle = P.neon; ctx.shadowColor = P.neon; ctx.shadowBlur = 14; ctx.lineWidth = 4; ctx.globalAlpha = a;
    for (let i = 1; i < pts.length; i += 1) { const p = pts[i - 1]; const q = pts[i]; ctx.beginPath(); ctx.moveTo(p.x, p.y); for (let k = 1; k < 8; k += 1) { const u = k / 8; ctx.lineTo(p.x + (q.x - p.x) * u + (R() - .5) * 26, p.y + (q.y - p.y) * u + (R() - .5) * 26); } ctx.lineTo(q.x, q.y); ctx.stroke(); }
    ctx.restore();
  }
  function circuitWin(ctx, boxes, t, c, size) { // current flows through every cell of the winner, then the whole board lights up
    const P = pal(c); const flow = clamp01(t / .6); const flash = clamp01((t - .55) / .45);
    ctx.save();
    boxes.forEach((b, i) => { const on = clamp01(flow * boxes.length - i); if (on <= 0) return; ctx.strokeStyle = P.neon; ctx.shadowColor = P.neon; ctx.shadowBlur = 18 * on; ctx.lineWidth = 5; ctx.strokeRect(b.x + 4, b.y + 4, b.size - 8, b.size - 8); });
    if (flash > 0 && flash < 1) { ctx.globalAlpha = Math.sin(flash * Math.PI) * .22; ctx.fillStyle = P.neon; ctx.fillRect(0, 0, size.w, size.h); }
    ctx.restore();
  }

  // ---- legend 2 (v1.9.0): 낙서 마법사 ↔ 낙서 공책 -- a wobbly magic crayon; closed boxes become little doodle creatures ----
  function wobble(ctx, x1, y1, x2, y2, w, col, seed) {
    const g = geom(x1, y1, x2, y2); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); for (let d = 0; d <= g.len; d += 6) { const off = Math.sin(d / 9 + seed) * 3.2; const x = x1 + g.ux * d + g.nx * off; const y = y1 + g.uy * d + g.ny * off; if (d) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.lineTo(x2, y2); ctx.stroke();
  }
  function magicCrayon(ctx, x1, y1, x2, y2, c) {
    const P = pal(c); wobble(ctx, x1, y1, x2, y2, 11, P.main, 0); wobble(ctx, x1, y1 - 2, x2, y2 - 2, 3, P.light, 1.3);
    along(x1, y1, x2, y2, 40, (x, y, g, i) => { ctx.fillStyle = i % 2 ? '#ffd23f' : '#ffffff'; ctx.strokeStyle = P.deep; ctx.lineWidth = 1.5; starPath(ctx, x + g.nx * 10, y + g.ny * 10, 6, 2.6, 5); ctx.fill(); ctx.stroke(); });
  }
  function magicCrayonFx(ctx, x1, y1, x2, y2, c, t) { // a little star scribbles itself along the new line
    const P = pal(c); const x = x1 + (x2 - x1) * t; const y = y1 + (y2 - y1) * t;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 8); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = P.deep; ctx.lineWidth = 2; starPath(ctx, 0, 0, 13 * (1 - t * .4), 5.5, 5); ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = `rgba(255,210,63,${1 - t})`; ctx.lineWidth = 2; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.arc(x, y, 18 + t * 10, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  function doodleBox(ctx, bx, by, size, c) { // a claimed box: a small doodle creature in the owner's crayon (the letter stays)
    const P = pal(c); const cx = bx + size / 2; const cy = by + size / 2;
    ctx.save(); ctx.fillStyle = c === 'white' ? 'rgba(239,68,68,.16)' : 'rgba(37,99,235,.16)'; ctx.fillRect(bx, by, size, size);
    wobble(ctx, cx - size * .32, cy + size * .3, cx + size * .32, cy + size * .3, 3, P.main, 2); // the ground line
    ctx.strokeStyle = P.main; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(cx, cy + size * .04, size * .3, size * .24, 0, 0, TAU); ctx.stroke();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * size * .14, cy - size * .16); ctx.lineTo(cx + s * size * .22, cy - size * .36); ctx.stroke(); }
    ctx.fillStyle = P.deep; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + s * size * .1, cy - size * .02, size * .035, 0, TAU); ctx.fill(); }
    ctx.beginPath(); ctx.arc(cx, cy + size * .06, size * .09, .2, Math.PI - .2); ctx.stroke();
    ctx.fillStyle = P.main; ctx.font = `italic 900 ${Math.round(size * .2)}px "Segoe Print", "Comic Sans MS", system-ui, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(c === 'white' ? 'R' : 'P', bx + size * .84, by + size * .26);
    ctx.restore();
  }
  function doodleSpecial(ctx, boxes, t, c) { // two boxes at once: stars and swirls scribble out of them, with a big "×2"
    const P = pal(c); const pts = boxes.map(mid); const a = 1 - clamp01((t - .7) / .3);
    ctx.save(); ctx.globalAlpha = a;
    pts.forEach((p, i) => { const R = rng(i + 7); for (let k = 0; k < 7; k += 1) { const ang = R() * TAU; const d = 20 + 60 * clamp01(t * 1.3); ctx.fillStyle = ['#ffd23f', P.light, '#ffffff'][k % 3]; ctx.strokeStyle = P.deep; ctx.lineWidth = 1.5; starPath(ctx, p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d, 8, 3.4, 5); ctx.fill(); ctx.stroke(); } });
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length; const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const k = Math.min(1, t * 3); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = P.deep; ctx.lineWidth = 4;
    ctx.font = `italic 900 ${Math.round(46 * k)}px "Segoe Print", "Comic Sans MS", system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeText(`×${boxes.length}`, cx, cy); ctx.fillText(`×${boxes.length}`, cx, cy);
    ctx.restore();
  }
  function doodleWin(ctx, boxes, t, c, size) { // the winner's creatures hop in turn, then a crayon crown is drawn over the page
    const P = pal(c); const hop = clamp01(t / .6); const crown = clamp01((t - .5) / .5);
    ctx.save();
    boxes.forEach((b, i) => { const on = clamp01(hop * boxes.length * .6 - i * .5); if (on <= 0 || on >= 1) return; const p = mid(b); ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = P.deep; ctx.lineWidth = 2; starPath(ctx, p.x, p.y - b.size * .5 - Math.sin(on * Math.PI) * 18, 10, 4, 5); ctx.fill(); ctx.stroke(); });
    if (crown > 0) {
      const cx = size.w / 2; const cy = size.h / 2; const s = size.w * .16; const draw = Math.min(1, crown * 1.6);
      const pts = [[-1, .5], [-1, -.4], [-.5, .05], [0, -.7], [.5, .05], [1, -.4], [1, .5], [-1, .5]];
      ctx.globalAlpha = 1 - clamp01((crown - .8) / .2);
      ctx.strokeStyle = P.main; ctx.lineWidth = 9; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.fillStyle = 'rgba(255,210,63,.7)';
      ctx.beginPath(); const n = Math.max(2, Math.ceil(pts.length * draw)); pts.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(cx + x * s, cy + y * s) : ctx.moveTo(cx + x * s, cy + y * s)));
      if (draw >= 1) ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  // ---- room themes: the page, and the colour of the dots ----
  function doodle(ctx, w, h) { // 낙서 공책
    ctx.fillStyle = '#fffdf3'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(120,170,230,.45)'; ctx.lineWidth = 1.6;
    for (let y = 48; y < h; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(230,110,110,.7)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(56, 0); ctx.lineTo(56, h); ctx.stroke();
    ctx.fillStyle = '#9ba8b8'; for (let y = 30; y < h; y += 60) { ctx.beginPath(); ctx.arc(22, y, 8, 0, TAU); ctx.fill(); }
    const R = rng(91); ctx.lineCap = 'round';
    for (let i = 0; i < 16; i += 1) { const x = 70 + R() * (w - 90); const y = 20 + R() * (h - 40); ctx.strokeStyle = ['rgba(240,130,60,.35)', 'rgba(80,170,120,.35)', 'rgba(130,100,220,.35)'][i % 3]; ctx.lineWidth = 3; const k = 8 + R() * 10;
      if (i % 3 === 0) { starPath(ctx, x, y, k, k * .45, 5); ctx.stroke(); } else if (i % 3 === 1) { ctx.beginPath(); ctx.arc(x, y, k, 0, 5.2); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(x - k, y); ctx.quadraticCurveTo(x, y - k * 1.6, x + k, y); ctx.stroke(); } }
  }
  function pcb(ctx, w, h) { // 사이버 회로판
    ctx.fillStyle = '#05231e'; ctx.fillRect(0, 0, w, h); const R = rng(57);
    ctx.strokeStyle = 'rgba(60,220,190,.28)'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    for (let i = 0; i < 26; i += 1) { let x = R() * w; let y = R() * h; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k += 1) { if (k % 2) y += (R() - .5) * 240; else x += (R() - .5) * 240; ctx.lineTo(x, y); } ctx.stroke(); ctx.fillStyle = 'rgba(120,255,230,.5)'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 5; i += 1) { const x = R() * (w - 90); const y = R() * (h - 90); ctx.fillStyle = 'rgba(8,60,52,.9)'; ctx.fillRect(x, y, 70, 50); ctx.strokeStyle = 'rgba(120,255,230,.45)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, 70, 50); }
  }

  function previewLine(ctx, w, h, skinId) {
    ctx.fillStyle = '#fbf6e8'; ctx.fillRect(0, 0, w, h); const d = S.def(skinId);
    for (const [x, y] of [[w * .14, h * .3], [w * .86, h * .3], [w * .14, h * .7], [w * .86, h * .7]]) { ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); }
    d.line(ctx, w * .14, h * .3, w * .86, h * .3, 'black'); d.line(ctx, w * .14, h * .7, w * .86, h * .7, 'white');
    if (d.lineFx) d.lineFx(ctx, w * .14, h * .5, w * .86, h * .5, 'black', .45);
    if (d.box) d.box(ctx, w * .36, h * .3, h * .4, 'black', 1);
  }
  function previewTheme(ctx, w, h, skinId) {
    const b = S.def(skinId).board; b.paint(ctx, w, h);
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 4; j += 1) { ctx.fillStyle = b.dot[1]; ctx.beginPath(); ctx.arc(w * (.2 + j * .2), h * (.22 + i * .28), 5, 0, TAU); ctx.fill(); }
    S.def('dots_c5')?.line(ctx, w * .2, h * .22, w * .4, h * .22, 'black'); S.def('dots_c5')?.line(ctx, w * .4, h * .22, w * .4, h * .5, 'white');
  }
  const line = (fn, fx, extra = {}) => ({ line: fn, lineFx: fx, preview: previewLine, ...extra });
  const theme = (paint, dot) => ({ board: { paint, dot }, preview: previewTheme });
  S.define({
    dots_c1: line(bamboo), dots_c2: line(rope), dots_c3: line(rail), dots_c4: line(chain), dots_c5: line(crayon),
    dots_p1: line(cable, cableFx), dots_p2: line(lava, lavaFx), dots_p3: line(laser, laserFx),
    dots_t1: theme(doodle, ['rgba(55,65,81,.22)', '#374151']),
    dots_t2: theme(pcb, ['rgba(80,255,220,.3)', '#7ffff0']),
    dots_l1: line(circuit, circuitFx, { box: cell, legend: true, special: circuitSpecial, win: circuitWin }),
    dots_l2: line(magicCrayon, magicCrayonFx, { box: doodleBox, legend: true, special: doodleSpecial, win: doodleWin }),
  });
}());
