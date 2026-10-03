// 그림 맞히기 skins (v1.7.39): the drawer's tool. A skin changes how a stroke is textured, the cursor, the paper and its
// frame, and (legend) a moment when the answer is found. The colour the drawer picked is always the colour of the stroke:
// every texture is painted in that colour, never in another one.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, starPath } = S.h;
  const hash = (x, y, k) => { const s = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453; return s - Math.floor(s); };
  const len = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const line = (ctx, x1, y1, x2, y2, w, col, alpha = 1) => { ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.globalAlpha = 1; };
  const along = (x1, y1, x2, y2, step, fn) => { const L = len(x1, y1, x2, y2) || 1; for (let d = 0; d <= L; d += step) fn(x1 + (x2 - x1) * d / L, y1 + (y2 - y1) * d / L, d); };
  const normal = (x1, y1, x2, y2) => { const L = len(x1, y1, x2, y2) || 1; return [-(y2 - y1) / L, (x2 - x1) / L]; };

  // ---- commons: each segment is painted in the drawer's colour with a different hand ----
  function pencil(ctx, x1, y1, x2, y2, c, w) {
    line(ctx, x1, y1, x2, y2, w * .6, c, .72);
    along(x1, y1, x2, y2, 2, (x, y) => { for (let k = 0; k < 3; k += 1) { ctx.fillStyle = c; ctx.globalAlpha = .55; ctx.fillRect(x + (hash(x, y, k) - .5) * w, y + (hash(y, x, k + 4) - .5) * w, 1.2, 1.2); } ctx.globalAlpha = 1; });
  }
  function crayon(ctx, x1, y1, x2, y2, c, w) {
    line(ctx, x1, y1, x2, y2, w * 1.35, c, .55); line(ctx, x1 + .8, y1 - .6, x2 + .8, y2 - .6, w * .95, c, .6);
    along(x1, y1, x2, y2, 3, (x, y) => { if (hash(x, y, 1) > .55) { ctx.fillStyle = '#fffdf6'; ctx.globalAlpha = .7; ctx.fillRect(x + (hash(x, y, 2) - .5) * w * 1.2, y + (hash(y, x, 3) - .5) * w * 1.2, 1.6, 1.6); ctx.globalAlpha = 1; } });
  }
  function paintBrush(ctx, x1, y1, x2, y2, c, w) {
    const [nx, ny] = normal(x1, y1, x2, y2);
    for (let k = -3; k <= 3; k += 1) { const o = k * w * .16; line(ctx, x1 + nx * o, y1 + ny * o, x2 + nx * o, y2 + ny * o, w * .22, c, .55 + hash(k, x1, 1) * .4); }
  }
  function fountain(ctx, x1, y1, x2, y2, c, w) {
    const v = Math.min(.6, len(x1, y1, x2, y2) / 40);
    line(ctx, x1, y1, x2, y2, w * (1.15 - v), c, 1);
    line(ctx, x1 - .6, y1 - .6, x2 - .6, y2 - .6, Math.max(1, w * .25), '#ffffff', .22);
  }
  function spray(ctx, x1, y1, x2, y2, c, w) {
    const count = Math.max(2, len(x1, y1, x2, y2) * w * .5 | 0);
    for (let i = 0; i < count; i += 1) { const t = hash(x1, i, 5); const a = hash(y1, i, 6) * TAU; const r = Math.sqrt(hash(x2, i, 7)) * w * .95; ctx.fillStyle = c; ctx.globalAlpha = .95; ctx.fillRect(x1 + (x2 - x1) * t + Math.cos(a) * r, y1 + (y2 - y1) * t + Math.sin(a) * r, 2, 2); }
    ctx.globalAlpha = 1;
  }

  // ---- premiums ----
  function starPen(ctx, x1, y1, x2, y2, c, w) {
    line(ctx, x1, y1, x2, y2, w, c, 1);
    along(x1, y1, x2, y2, 4, (x, y) => { if (hash(x, y, 9) > .9) { ctx.fillStyle = '#fff6b0'; ctx.strokeStyle = '#ffb703'; ctx.lineWidth = .8; starPath(ctx, x + (hash(y, x, 2) - .5) * w * 1.6, y + (hash(x, y, 3) - .5) * w * 1.6, w * .8 + 2, w * .25, 4); ctx.fill(); ctx.stroke(); } });
  }
  function rainbowBrush(ctx, x1, y1, x2, y2, c, w) {
    const [nx, ny] = normal(x1, y1, x2, y2);
    for (const s of [-1, 1]) line(ctx, x1 + nx * w * .8 * s, y1 + ny * w * .8 * s, x2 + nx * w * .8 * s, y2 + ny * w * .8 * s, w * .28, `hsl(${(x1 + y1) % 360},95%,62%)`, .5);
    line(ctx, x1, y1, x2, y2, w, c, 1);
  }
  function quill(ctx, x1, y1, x2, y2, c, w) {
    along(x1, y1, x2, y2, 1.5, (x, y) => { ctx.save(); ctx.translate(x, y); ctx.rotate(-.8); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, w * .65, w * .22, 0, 0, TAU); ctx.fill(); ctx.restore(); });
    along(x1, y1, x2, y2, 6, (x, y) => { if (hash(x, y, 4) > .6) { ctx.fillStyle = '#ffe28a'; ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(x + (hash(y, x, 1) - .5) * w * 2, y + (hash(x, y, 8) - .5) * w * 2 - 2, 1.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; } });
  }

  // ---- legend: 꿈을 그리는 붓 ----
  function dream(ctx, x1, y1, x2, y2, c, w) {
    line(ctx, x1, y1, x2, y2, w, c, 1);
    along(x1, y1, x2, y2, 3, (x, y) => {
      const k = hash(x, y, 11); if (k > .97) { ctx.fillStyle = ['#ffe28a', '#ffb3d9', '#a8d8ff'][(k * 100 | 0) % 3]; ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = .7; starPath(ctx, x + (hash(y, x, 2) - .5) * w * 2.4, y + (hash(x, y, 3) - .5) * w * 2.4, w * .45 + 1, w * .16, 4); ctx.fill(); ctx.stroke(); }
      else if (k < .04) { ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x + (hash(y, x, 5) - .5) * w * 2, y + (hash(x, y, 6) - .5) * w * 2, 1.3, 0, TAU); ctx.fill(); }
    });
  }
  function dreamWin(ctx, w, h, t) { // stars fall over the frame when the answer is found
    for (let i = 0; i < 50; i += 1) { const x = hash(i, 1, 1) * w; const y = ((hash(i, 2, 2) * h) + t * h * 1.1) % h; const k = Math.sin(clamp01(t * 1.4 - hash(i, 3, 3) * .4) * Math.PI); ctx.fillStyle = `rgba(255,${210 + (hash(i, 4, 4) * 40 | 0)},120,${k})`; starPath(ctx, x, y, 4 + hash(i, 5, 5) * 7, 1.6, 4); ctx.fill(); }
    ctx.strokeStyle = `rgba(255,226,138,${(1 - t) * .9})`; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8);
  }

  // v1.9.1 legend standard: `special(ctx, w, h, t)` over the frame when a round's answer is found (dreamWin above for
  // 꿈을 그리는 붓), `win(ctx, w, h, t)` when the game ends with this drawer among the final winners.
  function dreamFinal(ctx, w, h, t) { // a crescent moon rises and draws a constellation over the whole picture
    const R = Math.min(w, h) * .12; const rise = clamp01(t / .4); const mx = w * .82; const my = h * (.5 - .3 * rise);
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    ctx.fillStyle = 'rgba(30,26,80,.25)'; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.beginPath(); ctx.arc(mx, my, R, 0, TAU); ctx.clip(); // a crescent: the disc minus an offset disc
    ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(mx, my, R, 0, TAU); ctx.arc(mx + R * .45, my - R * .2, R * .9, 0, TAU); ctx.fill('evenodd'); ctx.restore();
    const pts = Array.from({ length: 7 }, (_, i) => ({ x: w * (.1 + i * .11), y: h * (.3 + Math.sin(i * 1.7) * .15) })); const n = Math.floor(clamp01((t - .3) / .5) * pts.length);
    ctx.strokeStyle = 'rgba(255,226,138,.85)'; ctx.lineWidth = 3; ctx.beginPath(); pts.slice(0, n + 1).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
    pts.slice(0, n + 1).forEach((p) => { ctx.fillStyle = '#fff6d0'; starPath(ctx, p.x, p.y, 10, 3, 5); ctx.fill(); });
    ctx.restore();
  }

  // ---- legend 2 (v1.9.1): 황금 팔레트 ↔ 미술교실 -- thick gouache with a dark impasto edge and gold flecks ----
  function palette(ctx, x1, y1, x2, y2, c, w) {
    line(ctx, x1, y1, x2, y2, w * 1.25, c, 1); // the paint itself, in the drawer's colour
    line(ctx, x1, y1, x2, y2, w * 1.25 + 2, 'rgba(0,0,0,.22)', 1); line(ctx, x1, y1, x2, y2, w * 1.15, c, 1); // a dark impasto rim
    const [nx, ny] = normal(x1, y1, x2, y2); line(ctx, x1 - nx * w * .25, y1 - ny * w * .25, x2 - nx * w * .25, y2 - ny * w * .25, Math.max(1, w * .22), 'rgba(255,255,255,.35)', 1); // wet highlight
    along(x1, y1, x2, y2, 5, (x, y) => { if (hash(x, y, 21) > .86) { ctx.fillStyle = '#d4a017'; ctx.globalAlpha = .9; ctx.fillRect(x + nx * w * (.6 + hash(y, x, 2) * .3), y + ny * w * (.6 + hash(x, y, 3) * .3), 1.6, 1.6); ctx.globalAlpha = 1; } });
  }
  function splashSpecial(ctx, w, h, t) { // the answer is found: paint splashes burst from the corners in many colours
    const cols = ['#e11d48', '#f59e0b', '#16a34a', '#1d4ed8', '#9333ea'];
    for (const [cx, cy, k0] of [[0, 0, 0], [w, 0, 1], [0, h, 2], [w, h, 3]]) for (let i = 0; i < 9; i += 1) {
      const a = Math.atan2(h / 2 - cy, w / 2 - cx) + (hash(i, k0, 1) - .5) * 1.6; const d = clamp01(t * 1.5) * Math.min(w, h) * (.18 + hash(i, k0, 2) * .3);
      ctx.fillStyle = cols[(i + k0) % cols.length]; ctx.globalAlpha = 1 - clamp01((t - .7) / .3);
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 6 + hash(i, k0, 3) * 12, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function paletteWin(ctx, w, h, t) { // a great golden palette swings in, its paint wells overflow and the frame turns gold
    const k = clamp01(t / .4); const R = Math.min(w, h) * .28; const cx = w / 2; const cy = h / 2 + (1 - k) * h * .5;
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    ctx.fillStyle = '#c99a2e'; ctx.strokeStyle = '#7a5a12'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.25, R, -.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fffdf6'; ctx.beginPath(); ctx.arc(cx + R * .7, cy + R * .35, R * .18, 0, TAU); ctx.fill(); // the thumb hole
    const cols = ['#e11d48', '#f59e0b', '#16a34a', '#1d4ed8', '#9333ea', '#111111']; const spill = clamp01((t - .35) / .4);
    cols.forEach((col, i) => { const a = Math.PI * (.95 + i * .2); const x = cx + Math.cos(a) * R * .75; const y = cy + Math.sin(a) * R * .6; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, R * (.13 + spill * .06), 0, TAU); ctx.fill(); ctx.beginPath(); ctx.ellipse(x, y + R * .2 * spill, R * .05, R * .2 * spill, 0, 0, TAU); ctx.fill(); });
    ctx.strokeStyle = `rgba(212,160,23,${Math.sin(clamp01((t - .4) / .6) * Math.PI)})`; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.restore();
  }

  // ---- cursors (32px icons, hot spot at the tip) ----
  const pencilIcon = (body, tip) => (ctx, s) => { ctx.save(); ctx.translate(s * .12, s * .88); ctx.rotate(-Math.PI / 4); ctx.fillStyle = body; ctx.fillRect(0, -s * .07, s * .7, s * .14); ctx.fillStyle = '#f2c79a'; ctx.beginPath(); ctx.moveTo(0, -s * .07); ctx.lineTo(-s * .16, 0); ctx.lineTo(0, s * .07); ctx.fill(); ctx.fillStyle = tip; ctx.beginPath(); ctx.moveTo(-s * .1, -s * .02); ctx.lineTo(-s * .16, 0); ctx.lineTo(-s * .1, s * .02); ctx.fill(); ctx.restore(); };

  // ---- room themes: paper and frame ----
  function classroomPaper(ctx, w, h) { // 미술교실
    ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(160,140,100,.08)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  }
  function nightPaper(ctx, w, h) { // 한밤의 화실: still light paper so every chosen colour stays readable
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f5f2ff'); g.addColorStop(1, '#e9ecff'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(120,130,200,.12)'; for (let i = 0; i < 30; i += 1) { starPath(ctx, hash(i, 1, 1) * w, hash(i, 2, 2) * h, 5 + hash(i, 3, 3) * 6, 1.5, 4); ctx.fill(); }
  }

  function previewBrush(ctx, w, h, skinId) {
    const d = S.def(skinId); const paper = d.paper; if (paper) paper(ctx, w, h); else { ctx.fillStyle = '#fffdf6'; ctx.fillRect(0, 0, w, h); }
    const seg = d.seg || S.def('pictionary_c1').seg; const pts = []; for (let i = 0; i <= 40; i += 1) { const t = i / 40; pts.push([w * (.1 + .8 * t), h * (.5 + Math.sin(t * TAU * 1.2) * .22)]); }
    [['#e11d48', 0], ['#1d4ed8', .16]].forEach(([col, off]) => { for (let i = 1; i < pts.length; i += 1) seg(ctx, pts[i - 1][0], pts[i - 1][1] + h * off, pts[i][0], pts[i][1] + h * off, col, 7); });
    if (d.frame) { ctx.strokeStyle = d.frame.stroke; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8); }
  }
  const tool = (seg, extra = {}) => ({ seg, preview: previewBrush, ...extra });
  const paper = (paperFn, frame, stroke) => ({ paper: paperFn, frame: { css: frame, stroke }, preview: previewBrush });
  S.define({
    pictionary_c1: tool(pencil, { cursor: pencilIcon('#e8b23a', '#374151') }), pictionary_c2: tool(crayon, { cursor: pencilIcon('#d9463b', '#d9463b') }),
    pictionary_c3: tool(paintBrush, { cursor: pencilIcon('#8a5a2b', '#3b82f6') }), pictionary_c4: tool(fountain, { cursor: pencilIcon('#1f2937', '#9ca3af') }),
    pictionary_c5: tool(spray, { cursor: pencilIcon('#94a3b8', '#e5e7eb') }),
    pictionary_p1: tool(starPen, { cursor: pencilIcon('#6d28d9', '#ffd54a') }), pictionary_p2: tool(rainbowBrush, { cursor: pencilIcon('#ec4899', '#22d3ee') }),
    pictionary_p3: tool(quill, { cursor: pencilIcon('#7c3aed', '#fbbf24') }),
    pictionary_t1: paper(classroomPaper, { boxShadow: '0 0 0 10px #8a5a2b, 0 0 0 13px #5a3a18, 0 10px 24px rgba(0,0,0,.45)' }, '#8a5a2b'),
    pictionary_t2: paper(nightPaper, { boxShadow: '0 0 0 10px #2a3158, 0 0 0 12px #8f9bff, 0 0 26px rgba(120,140,255,.6)' }, '#2a3158'),
    pictionary_l1: tool(dream, { cursor: pencilIcon('#7c3aed', '#ffd54a'), legend: true, special: dreamWin, win: dreamFinal }),
    pictionary_l2: tool(palette, { cursor: pencilIcon('#c99a2e', '#e11d48'), legend: true, special: splashSpecial, win: paletteWin }),
  });
}());
