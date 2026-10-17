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

  // ---- v1.10.90 스킨 2배 (IDEAS #future-skins-double): five commons, three premiums, a legend and its page (별자리 지도
  // ↔ 밤하늘 지도). Blue stays the first player's and red the second's in every line.
  function ribbon(ctx, x1, y1, x2, y2, c) { // 리본: a satin ribbon with a bow at the middle
    const P = pal(c); const g = geom(x1, y1, x2, y2);
    ctx.strokeStyle = P.mid; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.beginPath();
    for (let d = 0; d <= g.len; d += 4) { const off = Math.sin(d / 14) * 2.5; const x = x1 + g.ux * d + g.nx * off; const y = y1 + g.uy * d + g.ny * off; if (d) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
    stroke(ctx, x1, y1 - 2, x2, y2 - 2, 2.5, 'rgba(255,255,255,.55)');
    const mx = (x1 + x2) / 2; const my = (y1 + y2) / 2; ctx.fillStyle = P.main;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + g.ux * s * 12 + g.nx * 9, my + g.uy * s * 12 + g.ny * 9); ctx.lineTo(mx + g.ux * s * 12 - g.nx * 9, my + g.uy * s * 12 - g.ny * 9); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = P.light; ctx.beginPath(); ctx.arc(mx, my, 4, 0, TAU); ctx.fill();
  }
  function zipper(ctx, x1, y1, x2, y2, c) { // 지퍼: two rows of teeth on a tape
    const P = pal(c); stroke(ctx, x1, y1, x2, y2, 14, P.main);
    along(x1, y1, x2, y2, 6, (x, y, g, i) => { const s = i % 2 ? 1 : -1; ctx.fillStyle = '#d6dbe4'; ctx.fillRect(x - 2.2 + g.nx * s * 2, y - 2.2 + g.ny * s * 2, 4.4, 4.4); });
  }
  function fence(ctx, x1, y1, x2, y2, c) { // 나무 울타리: two rails and painted posts
    const P = pal(c); const tone = c === 'white' ? '#a8653a' : '#6a7f8a';
    stroke(ctx, x1, y1 - 3, x2, y2 - 3, 4, tone); stroke(ctx, x1, y1 + 3, x2, y2 + 3, 4, tone);
    along(x1, y1, x2, y2, 22, (x, y, g) => { ctx.save(); ctx.translate(x, y); ctx.rotate(g.ang); ctx.fillStyle = P.mid; ctx.fillRect(-3.5, -9, 7, 18); ctx.beginPath(); ctx.moveTo(-3.5, -9); ctx.lineTo(0, -13); ctx.lineTo(3.5, -9); ctx.fill(); ctx.restore(); });
  }
  function yarn(ctx, x1, y1, x2, y2, c) { // 털실: a knitted cord
    const P = pal(c); stroke(ctx, x1, y1, x2, y2, 12, P.main);
    along(x1, y1, x2, y2, 8, (x, y, g) => { ctx.strokeStyle = P.light; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x - g.ux * 3 - g.nx * 5, y - g.uy * 3 - g.ny * 5); ctx.lineTo(x + g.ux * 1, y + g.uy * 1); ctx.lineTo(x - g.ux * 3 + g.nx * 5, y - g.uy * 3 + g.ny * 5); ctx.stroke(); });
  }
  function pearls(ctx, x1, y1, x2, y2, c) { // 진주 목걸이: beads on a thread
    const P = pal(c); stroke(ctx, x1, y1, x2, y2, 2, P.deep);
    along(x1, y1, x2, y2, 11, (x, y) => { const g = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 6); g.addColorStop(0, '#ffffff'); g.addColorStop(.5, P.light); g.addColorStop(1, P.main); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 5.4, 0, TAU); ctx.fill(); });
  }
  function rainbow(ctx, x1, y1, x2, y2, c) { // 무지개 길: the side's colour edged with a rainbow
    const P = pal(c); stroke(ctx, x1, y1, x2, y2, 15, P.main);
    const g = geom(x1, y1, x2, y2); ['#ff5f5f', '#ffb84a', '#ffe94a', '#5fd07a', '#5fa8ff'].forEach((col, i) => { const off = (i - 2) * 2.2; stroke(ctx, x1 + g.nx * off, y1 + g.ny * off, x2 + g.nx * off, y2 + g.ny * off, 1.6, col); });
  }
  function rainbowFx(ctx, x1, y1, x2, y2, c, t) { // a bright head runs along and leaves sparkles
    const x = x1 + (x2 - x1) * t; const y = y1 + (y2 - y1) * t;
    ctx.save(); ctx.fillStyle = `rgba(255,255,255,${1 - t * .5})`; starPath(ctx, x, y, 12, 4, 4); ctx.fill();
    ['#ff5f5f', '#ffe94a', '#5fd07a', '#5fa8ff'].forEach((col, i) => { ctx.fillStyle = col; ctx.globalAlpha = 1 - t; ctx.beginPath(); ctx.arc(x - (x2 - x1) * .1 * i * t, y - 8 - i * 3, 2.4, 0, TAU); ctx.fill(); });
    ctx.restore();
  }
  function ice(ctx, x1, y1, x2, y2, c) { // 얼음 기둥: a clear icy bar tinted with the side's colour
    const P = pal(c); stroke(ctx, x1, y1, x2, y2, 14, P.light); stroke(ctx, x1, y1, x2, y2, 8, 'rgba(255,255,255,.65)'); stroke(ctx, x1, y1 + 4, x2, y2 + 4, 3, P.mid);
    along(x1, y1, x2, y2, 18, (x, y, g) => { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x - g.nx * 6, y - g.ny * 6); ctx.lineTo(x + g.ux * 4, y + g.uy * 4); ctx.stroke(); });
  }
  function iceFx(ctx, x1, y1, x2, y2, c, t) { // frost crystals spring up at both ends
    ctx.save(); ctx.strokeStyle = `rgba(220,240,255,${1 - t})`; ctx.lineWidth = 2;
    for (const [x, y] of [[x1, y1], [x2, y2]]) for (let i = 0; i < 6; i += 1) { const a = i * TAU / 6; const k = 6 + 18 * t; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * k, y + Math.sin(a) * k); ctx.stroke(); }
    ctx.restore();
  }
  function vine(ctx, x1, y1, x2, y2, c) { // 꽃 넝쿨: a green vine with flowers in the side's colour
    const P = pal(c); const g = geom(x1, y1, x2, y2);
    ctx.strokeStyle = '#3a8a4a'; ctx.lineWidth = 5; ctx.beginPath(); for (let d = 0; d <= g.len; d += 4) { const off = Math.sin(d / 10) * 4; const x = x1 + g.ux * d + g.nx * off; const y = y1 + g.uy * d + g.ny * off; if (d) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke();
    along(x1, y1, x2, y2, 20, (x, y, g2, i) => { const s = i % 2 ? 1 : -1; const fx = x + g2.nx * s * 7; const fy = y + g2.ny * s * 7; ctx.fillStyle = P.mid; for (let k = 0; k < 5; k += 1) { const a = k * TAU / 5; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 3.4, fy + Math.sin(a) * 3.4, 2.8, 0, TAU); ctx.fill(); } ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(fx, fy, 2, 0, TAU); ctx.fill(); });
  }
  function vineFx(ctx, x1, y1, x2, y2, c, t) { // petals pop out along it
    const P = pal(c); ctx.save(); ctx.globalAlpha = 1 - t;
    along(x1, y1, x2, y2, 30, (x, y, g, i) => { ctx.fillStyle = i % 2 ? P.light : '#ffd23f'; ctx.beginPath(); ctx.ellipse(x + g.nx * (8 + 14 * t) * (i % 2 ? 1 : -1), y + g.ny * (8 + 14 * t) * (i % 2 ? 1 : -1), 4, 2.4, i, 0, TAU); ctx.fill(); });
    ctx.restore();
  }
  // 별자리 지도 (legend) ↔ 밤하늘 지도 (page)
  function starLine(ctx, x1, y1, x2, y2, c) { // a constellation line: a soft glow, the side's colour, a star at each end
    const P = pal(c); stroke(ctx, x1, y1, x2, y2, 12, c === 'white' ? 'rgba(251,113,133,.25)' : 'rgba(56,189,248,.25)'); stroke(ctx, x1, y1, x2, y2, 4, P.mid);
    for (const [x, y] of [[x1, y1], [x2, y2]]) { ctx.fillStyle = '#fff6c8'; starPath(ctx, x, y, 7, 2.6, 4); ctx.fill(); }
    along(x1, y1, x2, y2, 26, (x, y) => { ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); });
  }
  function starLineFx(ctx, x1, y1, x2, y2, c, t) { // a shooting star draws the line in
    const x = x1 + (x2 - x1) * t; const y = y1 + (y2 - y1) * t;
    ctx.save(); const g = ctx.createLinearGradient(x1, y1, x, y); g.addColorStop(0, 'rgba(255,246,200,0)'); g.addColorStop(1, `rgba(255,246,200,${1 - t * .4})`);
    ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x, y); ctx.stroke(); ctx.fillStyle = '#fffbe6'; starPath(ctx, x, y, 10, 3, 4); ctx.fill(); ctx.restore();
  }
  function constellationBox(ctx, bx, by, size, c) { // a claimed box: a little constellation in the owner's colour (the letter stays)
    const P = pal(c); const R = rng(Math.round(bx * 7 + by * 13));
    ctx.save(); ctx.fillStyle = c === 'white' ? 'rgba(239,68,68,.14)' : 'rgba(37,99,235,.16)'; ctx.fillRect(bx, by, size, size);
    const pts = Array.from({ length: 4 }, () => ({ x: bx + size * (.2 + R() * .55), y: by + size * (.3 + R() * .5) }));
    ctx.strokeStyle = P.light; ctx.lineWidth = 1.6; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    for (const p of pts) { ctx.fillStyle = '#fff6c8'; starPath(ctx, p.x, p.y, size * .07, size * .025, 4); ctx.fill(); }
    ctx.fillStyle = P.main; ctx.font = `900 ${Math.round(size * .2)}px system-ui, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(c === 'white' ? 'R' : 'P', bx + size * .84, by + size * .26);
    ctx.restore();
  }
  function constellationSpecial(ctx, boxes, t, c) { // two boxes at once: a shooting star crosses between them
    const pts = boxes.map(mid); if (pts.length < 2) return; const u = clamp01(t);
    const x = pts[0].x + (pts[1].x - pts[0].x) * u; const y = pts[0].y + (pts[1].y - pts[0].y) * u - Math.sin(u * Math.PI) * 30;
    ctx.save(); ctx.globalAlpha = Math.sin(u * Math.PI); ctx.fillStyle = '#fffbe6'; starPath(ctx, x, y, 14, 4, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,246,200,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
  }
  function constellationWin(ctx, boxes, t, c, size) { // the winner's boxes light up one by one, then the sky turns for a moment
    const P = pal(c); const on = clamp01(t / .6) * boxes.length;
    ctx.save();
    boxes.forEach((b, i) => { const a = clamp01(on - i); if (a <= 0) return; const p = mid(b); const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, b.size * .7); g.addColorStop(0, `rgba(255,246,200,${.55 * a})`); g.addColorStop(1, 'rgba(255,246,200,0)'); ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.size, b.size); });
    const spin = clamp01((t - .55) / .45);
    if (spin > 0 && spin < 1) { ctx.translate(size.w / 2, size.h / 2); ctx.rotate(spin * .6); ctx.strokeStyle = P.neon; ctx.globalAlpha = Math.sin(spin * Math.PI) * .5; ctx.lineWidth = 2; for (let k = 1; k <= 3; k += 1) { ctx.beginPath(); ctx.arc(0, 0, Math.min(size.w, size.h) * .15 * k, 0, TAU); ctx.stroke(); } }
    ctx.restore();
  }
  function nightChart(ctx, w, h) { // 밤하늘 지도: a deep-blue star chart with faint grid circles
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * .7); g.addColorStop(0, '#1d2f6a'); g.addColorStop(1, '#0b1438'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(170,190,255,.14)'; ctx.lineWidth = 1.2; for (let k = 1; k <= 4; k += 1) { ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * .14 * k, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
    const R = rng(19); for (let i = 0; i < 160; i += 1) { ctx.fillStyle = `rgba(255,255,255,${.15 + R() * .5})`; ctx.beginPath(); ctx.arc(R() * w, R() * h, .5 + R() * 1.1, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(230,200,120,.5)'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, w - 12, h - 12);
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
    // v1.10.90 스킨 2배
dots_c6: line(ribbon), dots_c7: line(zipper), dots_c8: line(fence), dots_c9: line(yarn), dots_c10: line(pearls),
    dots_p4: line(rainbow, rainbowFx), dots_p5: line(ice, iceFx), dots_p6: line(vine, vineFx),
    dots_t3: theme(nightChart, ['rgba(200,215,255,.3)', '#e0e8ff']),
    dots_l3: line(starLine, starLineFx, { box: constellationBox, legend: true, special: constellationSpecial, win: constellationWin }), // 별자리 지도 ↔ 밤하늘 지도
  });
}());
