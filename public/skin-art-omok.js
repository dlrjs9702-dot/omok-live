// 오목 skins (v1.7.35): five commons that change the stone's silhouette, three premiums with a placement effect, two
// room themes (the board itself), and two legends paired with them (v1.8.7: 천상 바둑 ↔ 별빛 천문대, 왕실 기보 ↔ 조선 기원).
// Every stone keeps its side readable: black is always the dark stone, white the light one.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, sphere, gloss, starPath } = S.h;
  const dark = (c) => c === 'black';

  // ---- commons (500,000P) -------------------------------------------------------------------------------------
  function cat(ctx, r, c) { // 냥발석: a cat head with ears and a paw print
    const d = dark(c);
    const fur = d ? ['#5b606c', '#24272e', '#08090c'] : ['#ffffff', '#f7f0e5', '#d2c6b2'];
    const pad = d ? '#ea90aa' : '#f0a0b4';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * r * .92, -r * .3); ctx.lineTo(s * r * .74, -r * 1.1); ctx.lineTo(s * r * .2, -r * .86); ctx.closePath();
      ctx.fillStyle = d ? '#24272e' : '#efe5d4'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(s * r * .76, -r * .5); ctx.lineTo(s * r * .68, -r * .95); ctx.lineTo(s * r * .36, -r * .8); ctx.closePath();
      ctx.fillStyle = pad; ctx.fill();
    }
    ctx.fillStyle = sphere(ctx, r, fur, .45);
    ctx.beginPath(); ctx.arc(0, 0, r * .98, 0, TAU); ctx.fill();
    ctx.fillStyle = pad;
    ctx.beginPath(); ctx.ellipse(0, r * .28, r * .34, r * .27, 0, 0, TAU); ctx.fill();
    for (const [x, y] of [[-.46, -.04], [-.17, -.34], [.17, -.34], [.46, -.04]]) { ctx.beginPath(); ctx.ellipse(x * r, y * r, r * .13, r * .16, x * .4, 0, TAU); ctx.fill(); }
    gloss(ctx, r, .16);
  }

  function taegeuk(ctx, r, c) { // 태극석: the yin-yang swirl
    const d = dark(c);
    const A = d ? '#3a4e7e' : '#c2cfe8';
    const B = d ? '#0a0b10' : '#fbf8f0';
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.fillStyle = B; ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = A; ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -r / 2, r / 2, 0, TAU); ctx.fill();
    ctx.fillStyle = B; ctx.beginPath(); ctx.arc(0, r / 2, r / 2, 0, TAU); ctx.fill();
    ctx.fillStyle = B; ctx.beginPath(); ctx.arc(0, -r / 2, r / 6, 0, TAU); ctx.fill();
    ctx.fillStyle = A; ctx.beginPath(); ctx.arc(0, r / 2, r / 6, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-r * .35, -r * .4, r * .1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,.3)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = g; ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.strokeStyle = d ? 'rgba(200,215,255,.45)' : 'rgba(80,95,130,.5)'; ctx.lineWidth = Math.max(1, r * .06);
    ctx.beginPath(); ctx.arc(0, 0, r * .97, 0, TAU); ctx.stroke();
  }

  function gear(ctx, r, c) { // 기어코어: a toothed gear with a hub and bolts
    const d = dark(c);
    const teeth = 10; const ro = r * 1.04; const ri = r * .84; const step = TAU / teeth;
    ctx.beginPath();
    for (let k = 0; k < teeth; k += 1) {
      const a = k * step - Math.PI / 2;
      for (const [off, rad] of [[-.3, ri], [-.15, ro], [.15, ro], [.3, ri]]) {
        const x = Math.cos(a + off * step * 1.6) * rad; const y = Math.sin(a + off * step * 1.6) * rad;
        if (k === 0 && off === -.3) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = sphere(ctx, r, d ? ['#7a8494', '#262c38', '#07090d'] : ['#ffffff', '#e6eaf0', '#9aa4b2'], .5);
    ctx.fill();
    ctx.strokeStyle = d ? 'rgba(0,0,0,.6)' : 'rgba(70,80,95,.55)'; ctx.lineWidth = Math.max(1, r * .05); ctx.stroke();
    ctx.strokeStyle = d ? 'rgba(180,195,215,.4)' : 'rgba(80,90,105,.45)'; ctx.lineWidth = Math.max(1, r * .07);
    ctx.beginPath(); ctx.arc(0, 0, r * .6, 0, TAU); ctx.stroke();
    ctx.fillStyle = d ? '#9fb0c8' : '#7a8696';
    ctx.beginPath(); ctx.arc(0, 0, r * .2, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.arc(Math.cos(i * TAU / 6) * r * .42, Math.sin(i * TAU / 6) * r * .42, r * .05, 0, TAU); ctx.fill(); }
    gloss(ctx, r, .14);
  }

  function planet(ctx, r, c) { // 행성석: a ringed planet; the ring is part of the silhouette
    const d = dark(c);
    const pr = r * .74; const ring = d ? 'rgba(168,104,30,.95)' : 'rgba(110,140,205,.92)';
    const drawRing = (from, to) => {
      ctx.save(); ctx.rotate(-.42); ctx.strokeStyle = ring; ctx.lineWidth = r * .13;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.04, r * .3, 0, from, to); ctx.stroke(); ctx.restore();
    };
    drawRing(Math.PI, TAU);
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.clip();
    ctx.fillStyle = sphere(ctx, pr, d ? ['#56639e', '#1c2248', '#05060f'] : ['#fff7e8', '#efdabc', '#c4a880'], .5);
    ctx.fillRect(-pr, -pr, pr * 2, pr * 2);
    ctx.strokeStyle = d ? 'rgba(170,185,255,.3)' : 'rgba(150,110,60,.3)'; ctx.lineWidth = pr * .13;
    for (const y of [-.45, -.05, .35]) { ctx.beginPath(); ctx.moveTo(-pr, y * pr + pr * .15); ctx.quadraticCurveTo(0, y * pr - pr * .15, pr, y * pr + pr * .15); ctx.stroke(); }
    ctx.restore();
    drawRing(0, Math.PI);
    gloss(ctx, pr, .16);
  }

  function dokkaebi(ctx, r, c) { // 도깨비석: a horned goblin face
    const d = dark(c);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(s * r * .32, -r * .74); ctx.lineTo(s * r * .48, -r * 1.14); ctx.lineTo(s * r * .68, -r * .6); ctx.closePath();
      ctx.fillStyle = d ? '#f3e6c4' : '#d8b96a'; ctx.fill();
    }
    ctx.fillStyle = sphere(ctx, r, d ? ['#7479dd', '#2f3388', '#0d0f36'] : ['#ffffff', '#fdf0e4', '#dcc6ae'], .45);
    ctx.beginPath(); ctx.arc(0, 0, r * .98, 0, TAU); ctx.fill();
    const ink = d ? '#fdf3d0' : '#3a2230';
    ctx.strokeStyle = ink; ctx.lineWidth = r * .1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * .62, -r * .42); ctx.lineTo(-r * .16, -r * .22); ctx.moveTo(r * .62, -r * .42); ctx.lineTo(r * .16, -r * .22); ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(s * r * .36, -r * .08, r * .17, r * .14, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = d ? '#12143a' : '#b02a2a'; ctx.beginPath(); ctx.arc(s * r * .36, -r * .06, r * .08, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = d ? '#0d0f36' : '#7a1f2a';
    ctx.beginPath(); ctx.moveTo(-r * .5, r * .2); ctx.quadraticCurveTo(0, r * .82, r * .5, r * .2); ctx.quadraticCurveTo(0, r * .36, -r * .5, r * .2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * .3, r * .3); ctx.lineTo(s * r * .18, r * .52); ctx.lineTo(s * r * .06, r * .34); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = 'rgba(235,90,90,.45)';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * .62, r * .12, r * .1, 0, TAU); ctx.fill(); }
    gloss(ctx, r, .14);
  }

  // ---- premiums (1,000,000P): a clear change of look plus a short effect when the stone lands ---------------------
  function sakura(ctx, r, c) { // 벚꽃석: a five-petal blossom
    const d = dark(c);
    const tip = d ? '#3c1f3f' : '#f7a9c4'; const base = d ? '#7a4a78' : '#fffafb';
    for (let i = 0; i < 5; i += 1) {
      ctx.save(); ctx.rotate(i * TAU / 5 - Math.PI / 2);
      const g = ctx.createLinearGradient(0, 0, 0, -r); g.addColorStop(0, base); g.addColorStop(1, tip);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-r * .66, -r * .25, -r * .66, -r * .98, -r * .13, -r); ctx.lineTo(0, -r * .86); ctx.lineTo(r * .13, -r);
      ctx.bezierCurveTo(r * .66, -r * .98, r * .66, -r * .25, 0, 0);
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = d ? 'rgba(255,190,220,.4)' : 'rgba(215,110,150,.4)'; ctx.lineWidth = Math.max(1, r * .04);
      ctx.beginPath(); ctx.moveTo(0, -r * .18); ctx.lineTo(0, -r * .68); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = d ? '#e0669a' : '#e0668f'; ctx.beginPath(); ctx.arc(0, 0, r * .2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd86a';
    for (let i = 0; i < 8; i += 1) { ctx.beginPath(); ctx.arc(Math.cos(i * TAU / 8) * r * .3, Math.sin(i * TAU / 8) * r * .3, r * .035, 0, TAU); ctx.fill(); }
  }
  function sakuraFx(ctx, r, t) {
    for (let i = 0; i < 9; i += 1) {
      const a = i * TAU / 9 + .3; const dist = r * (.9 + 1.9 * t);
      ctx.save(); ctx.translate(Math.cos(a) * dist, Math.sin(a) * dist - t * r * .4); ctx.rotate(a + t * 4);
      ctx.globalAlpha = (1 - t) * .95; ctx.fillStyle = i % 2 ? '#ffb3cd' : '#ffd6e4';
      ctx.beginPath(); ctx.ellipse(0, 0, r * .2, r * .11, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  }

  function volt(ctx, r, c) { // 번개핵: a hexagonal core with a lightning bolt
    const d = dark(c);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) { const a = i * TAU / 6 - Math.PI / 6; const x = Math.cos(a) * r * 1.02; const y = Math.sin(a) * r * 1.02; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath();
    ctx.fillStyle = sphere(ctx, r, d ? ['#4a6cb8', '#15234f', '#050817'] : ['#ffffff', '#e8f1ff', '#9db6df'], .5); ctx.fill();
    ctx.strokeStyle = d ? '#2b88b0' : '#8fb0e6'; ctx.lineWidth = r * .09; ctx.stroke();
    ctx.beginPath();
    [[.14, -.74], [-.36, .08], [-.04, .08], [-.16, .76], [.38, -.16], [.05, -.16]].forEach(([x, y], i) => { if (i) ctx.lineTo(x * r, y * r); else ctx.moveTo(x * r, y * r); });
    ctx.closePath(); ctx.fillStyle = d ? '#3fb4d6' : '#ffc928'; ctx.fill();
    ctx.strokeStyle = d ? '#1c6f8c' : '#b57d00'; ctx.lineWidth = Math.max(1, r * .04); ctx.stroke();
  }
  function voltFx(ctx, r, t) {
    const R = rng(7);
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(120,230,255,${(1 - t) * .9})`; ctx.lineWidth = r * .12 * (1 - t) + 1;
    ctx.beginPath(); ctx.arc(0, 0, r * (1.05 + 1.3 * t), 0, TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(255,255,255,${(1 - t)})`; ctx.lineWidth = Math.max(1.4, r * .07);
    for (let i = 0; i < 6; i += 1) {
      const a = i * TAU / 6 + .2; const r0 = r * 1.0; const r1 = r * (1.25 + 1.0 * t);
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      for (let k = 1; k <= 3; k += 1) { const rr = r0 + (r1 - r0) * k / 3; const aa = a + (R() - .5) * .5; ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
      ctx.stroke();
    }
  }

  function lava(ctx, r, c) { // 용암핵: a cracked rock with glowing fissures
    const d = dark(c);
    const R = rng(d ? 11 : 12); const n = 13;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) { const a = i * TAU / n; const rad = r * (.88 + R() * .14); const x = Math.cos(a) * rad; const y = Math.sin(a) * rad; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath();
    ctx.fillStyle = sphere(ctx, r, d ? ['#5a4641', '#231815', '#060303'] : ['#f1ece4', '#c3baac', '#80776a'], .5); ctx.fill();
    ctx.strokeStyle = d ? 'rgba(0,0,0,.6)' : 'rgba(80,70,60,.5)'; ctx.lineWidth = Math.max(1, r * .05); ctx.stroke();
    const cracks = [[[0, 0], [-.3, -.35], [-.2, -.7], [-.5, -.88]], [[0, 0], [.4, -.1], [.62, .2], [.88, .3]], [[0, 0], [-.1, .4], [.15, .62], [.1, .9]]];
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, col] of [[r * .15, 'rgba(255,110,20,.4)'], [r * .07, '#ffc04a']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w;
      for (const pts of cracks) { ctx.beginPath(); pts.forEach(([x, y], i) => { if (i) ctx.lineTo(x * r, y * r); else ctx.moveTo(x * r, y * r); }); ctx.stroke(); }
    }
  }
  function lavaFx(ctx, r, t) {
    ctx.strokeStyle = `rgba(255,110,20,${(1 - t) * .75})`; ctx.lineWidth = r * .12 * (1 - t) + 1;
    ctx.beginPath(); ctx.arc(0, 0, r * (1.05 + .9 * t), 0, TAU); ctx.stroke();
    const R = rng(3);
    for (let i = 0; i < 8; i += 1) {
      const x = (R() - .5) * r * 1.6; const y = -r * (.3 + 1.9 * t * (.6 + R() * .6)); const k = r * .1 * (1 - t) + .6;
      ctx.fillStyle = `rgba(255,${150 + (R() * 70 | 0)},40,${(1 - t) * .95})`; ctx.beginPath(); ctx.arc(x + Math.sin(t * 6 + i) * r * .15, y, k, 0, TAU); ctx.fill();
    }
  }

  // ---- legends (3,000,000P) — v1.8.7 reference implementation of the legend standard ---------------------------
  // A legend is its own grade, not a stronger premium: (1) its own silhouette, (2) its own placement effect, (3) its own
  // special-situation effect (here: four in a row, the moment before five), (4) its own win sequence, plus the profile
  // badge (server). Each pairs with a room theme: 별빛 천문대 ↔ 천상 바둑, 조선 기원 ↔ 왕실 기보. The silhouette is only
  // drawn: the stone still sits on the same intersection, is clicked and judged exactly like a round stone.
  // Win sequences run on t 0..1 (about 2.4 s) and stay around the winning line, so the board stays readable.

  // 천상 바둑: five-pointed celestial stones. Black is a deep blue-violet star with a bright rim, white a white star
  // with a gold rim. Placement sends a star-shaped ripple; four in a row draws a faint constellation; five in a row
  // links the stars, opens a celestial sphere with a halo and ends in a burst of starlight.
  function starStone(ctx, r, c) {
    const d = dark(c);
    const outer = r * 1.08; const inner = r * .5;
    ctx.save();
    ctx.shadowColor = d ? 'rgba(110,130,240,.5)' : 'rgba(255,214,110,.75)'; ctx.shadowBlur = r * .35;
    starPath(ctx, 0, 0, outer, inner, 5);
    const g = ctx.createRadialGradient(-r * .2, -r * .3, r * .05, 0, 0, outer);
    if (d) { g.addColorStop(0, '#3a2f80'); g.addColorStop(.5, '#17114a'); g.addColorStop(1, '#070520'); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#f7f5ff'); g.addColorStop(1, '#e3e2f5'); }
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.2, r * (d ? .05 : .07)); // thin rims keep the two sides apart
    ctx.strokeStyle = d ? '#b4c0ff' : '#e2b23c';
    starPath(ctx, 0, 0, outer, inner, 5); ctx.stroke();
    ctx.lineWidth = Math.max(1, r * .05); ctx.strokeStyle = d ? 'rgba(140,155,255,.35)' : 'rgba(190,140,40,.35)';
    starPath(ctx, 0, 0, outer * .62, inner * .62, 5); ctx.stroke();
    ctx.fillStyle = d ? '#fff3c4' : '#d9a92e';
    starPath(ctx, 0, 0, r * .2, r * .07, 4); ctx.fill();
    ctx.restore();
  }
  function starStoneFx(ctx, r, t) { // a star-shaped ripple and four sparks
    ctx.save(); ctx.lineJoin = 'round';
    for (let k = 0; k < 2; k += 1) {
      const tt = clamp01(t * 1.2 - k * .25);
      if (tt <= 0 || tt >= 1) continue;
      const s = 1.15 + 2.2 * tt;
      ctx.strokeStyle = `rgba(255,232,150,${(1 - tt) * .9})`; ctx.lineWidth = r * .1 * (1 - tt) + 1;
      starPath(ctx, 0, 0, r * s, r * s * .5, 5, -Math.PI / 2 + tt * .6); ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,248,210,${1 - t})`;
    for (let i = 0; i < 5; i += 1) { const a = i * TAU / 5 - Math.PI / 2; starPath(ctx, Math.cos(a) * r * (1.3 + 1.4 * t), Math.sin(a) * r * (1.3 + 1.4 * t), r * .24 * (1 - t) + 1, r * .05, 4); ctx.fill(); }
    ctx.restore();
  }
  function starStoneSpecial(ctx, pts, r, t) { // four in a row: a faint constellation and a shooting star along it
    if (pts.length < 2) return;
    const fade = t < .8 ? 1 : (1 - t) / .2;
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(190,205,255,${.55 * fade})`; ctx.lineWidth = r * .1; ctx.setLineDash([r * .25, r * .2]);
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y); ctx.stroke();
    ctx.setLineDash([]);
    const u = clamp01(t / .7) * (pts.length - 1); const i = Math.min(pts.length - 2, Math.floor(u)); const f = u - i;
    const x = pts[i].x + (pts[i + 1].x - pts[i].x) * f; const y = pts[i].y + (pts[i + 1].y - pts[i].y) * f;
    ctx.fillStyle = `rgba(255,246,200,${fade})`; starPath(ctx, x, y, r * .5, r * .12, 4); ctx.fill();
    ctx.restore();
  }
  function starStoneWin(ctx, pts, r, t) { // constellation → celestial sphere and halo → burst of starlight
    if (pts.length < 2) return;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const link = clamp01(t / .35) * (pts.length - 1);
    for (const [w, col] of [[r * .36, 'rgba(255,214,90,.22)'], [r * .12, '#ffe38a']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) { const f = clamp01(link - (i - 1)); if (f <= 0) break; ctx.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f); }
      ctx.stroke();
    }
    pts.forEach((pt, i) => { if (link < i) return; const pulse = 1 + .15 * Math.sin(t * 14 + i); ctx.fillStyle = 'rgba(255,246,200,.9)'; starPath(ctx, pt.x, pt.y, r * .55 * pulse, r * .13, 4); ctx.fill(); });
    const mid = pts[Math.floor(pts.length / 2)];
    const span = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y) / 2 + r * 1.6;
    const globe = clamp01((t - .3) / .4); // the celestial sphere: a ring with two tilted meridians, slowly turning
    if (globe > 0 && t < .95) {
      const a = Math.min(1, globe * 1.4) * (t > .8 ? (.95 - t) / .15 : 1);
      ctx.strokeStyle = `rgba(214,198,120,${.75 * a})`; ctx.lineWidth = Math.max(1.5, r * .08);
      ctx.beginPath(); ctx.arc(mid.x, mid.y, span, 0, TAU); ctx.stroke();
      for (const tilt of [.35, -.35]) { ctx.beginPath(); ctx.ellipse(mid.x, mid.y, span, span * Math.abs(Math.cos(t * 3 + tilt * 4)) * .55 + 2, tilt, 0, TAU); ctx.stroke(); }
      const halo = ctx.createRadialGradient(mid.x, mid.y, span * .2, mid.x, mid.y, span * 1.15);
      halo.addColorStop(0, `rgba(255,240,180,${.18 * a})`); halo.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mid.x, mid.y, span * 1.15, 0, TAU); ctx.fill();
    }
    const burst = clamp01((t - .68) / .32); // starlight bursting outward from the line
    if (burst > 0 && burst < 1) {
      const R = rng(57);
      for (let i = 0; i < 26; i += 1) {
        const ang = R() * TAU; const dist = span * (.3 + R() * .9) * burst + r;
        ctx.fillStyle = `rgba(${200 + (R() * 55 | 0)},${200 + (R() * 55 | 0)},255,${1 - burst})`;
        starPath(ctx, mid.x + Math.cos(ang) * dist, mid.y + Math.sin(ang) * dist, r * (.32 + R() * .25) * (1 - burst * .5), r * .07, 4); ctx.fill();
      }
    }
    ctx.restore();
  }

  // 왕실 기보: octagonal royal-seal stones (팔각 어보). Black is black lacquer with a gold double rim and cloud knots,
  // white is white jade with a red seal square. Placement stamps a red seal; four in a row lays a dancheong band;
  // five in a row draws a gold cord, raises a red sun and a white moon at its ends and scatters gold leaf.
  function octagon(ctx, rad) {
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) { const a = Math.PI / 8 + i * TAU / 8; const x = Math.cos(a) * rad; const y = Math.sin(a) * rad; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    ctx.closePath();
  }
  function sealStone(ctx, r, c) {
    const d = dark(c);
    const rad = r * 1.04;
    ctx.save();
    octagon(ctx, rad);
    ctx.fillStyle = d ? sphere(ctx, r, ['#3a1f19', '#140906', '#030101'], .5) : sphere(ctx, r, ['#ffffff', '#fbf7ec', '#ebe2cc'], .55);
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, r * (d ? .06 : .08)); ctx.strokeStyle = d ? '#e3b54c' : '#3a2412'; octagon(ctx, rad); ctx.stroke();
    ctx.lineWidth = Math.max(1, r * .045); ctx.strokeStyle = d ? 'rgba(227,181,76,.75)' : 'rgba(58,36,18,.55)'; octagon(ctx, rad * .78); ctx.stroke();
    if (d) { // gold cloud knots at the four corners
      ctx.fillStyle = '#e3b54c';
      for (let i = 0; i < 4; i += 1) { const a = Math.PI / 4 + i * TAU / 4; const x = Math.cos(a) * r * .5; const y = Math.sin(a) * r * .5; for (const [dx, dy, k] of [[0, 0, .09], [.08, -.05, .06], [-.08, -.05, .06]]) { ctx.beginPath(); ctx.arc(x + dx * r, y + dy * r, k * r, 0, TAU); ctx.fill(); } }
    } else { // a red seal square in the middle
      ctx.fillStyle = '#b3261e'; ctx.fillRect(-r * .22, -r * .22, r * .44, r * .44);
      ctx.strokeStyle = '#f6efdf'; ctx.lineWidth = Math.max(1, r * .05);
      ctx.beginPath(); ctx.moveTo(-r * .12, -r * .09); ctx.lineTo(r * .12, -r * .09); ctx.moveTo(0, -r * .15); ctx.lineTo(0, r * .15); ctx.moveTo(-r * .12, r * .09); ctx.lineTo(r * .12, r * .09); ctx.stroke();
    }
    gloss(ctx, r, d ? .1 : .22);
    ctx.restore();
  }
  function sealStoneFx(ctx, r, t) { // a red seal pressed down: a square that settles, an ink ring spreading
    ctx.save();
    const press = clamp01(t / .35); const s = 1.9 - .7 * press;
    ctx.globalAlpha = (1 - clamp01((t - .45) / .55)) * .9;
    ctx.strokeStyle = '#c0281f'; ctx.lineWidth = r * .14;
    ctx.strokeRect(-r * s, -r * s, r * s * 2, r * s * 2);
    ctx.globalAlpha = (1 - t) * .7; ctx.strokeStyle = 'rgba(192,40,31,.8)'; ctx.lineWidth = r * .08;
    ctx.beginPath(); ctx.arc(0, 0, r * (1.2 + 1.8 * t), 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function sealStoneSpecial(ctx, pts, r, t) { // four in a row: a dancheong band (green, red, blue) laid along the line
    if (pts.length < 2) return;
    const fade = t < .75 ? 1 : (1 - t) / .25;
    const grow = clamp01(t / .4);
    const end = { x: pts[0].x + (pts[pts.length - 1].x - pts[0].x) * grow, y: pts[0].y + (pts[pts.length - 1].y - pts[0].y) * grow };
    ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = .65 * fade;
    for (const [w, col] of [[r * 1.15, '#2f7a5a'], [r * .75, '#a8322a'], [r * .32, '#2c4f9e']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); ctx.lineTo(end.x, end.y); ctx.stroke(); }
    ctx.restore();
  }
  function sealStoneWin(ctx, pts, r, t) { // gold cord → red sun and white moon at the ends with a gold halo → gold leaf
    if (pts.length < 2) return;
    ctx.save(); ctx.lineCap = 'round';
    const link = clamp01(t / .35);
    const a = pts[0]; const b = pts[pts.length - 1];
    const ex = a.x + (b.x - a.x) * link; const ey = a.y + (b.y - a.y) * link;
    for (const [w, col] of [[r * .4, 'rgba(227,181,76,.3)'], [r * .14, '#e3b54c']]) { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(ex, ey); ctx.stroke(); }
    const rise = clamp01((t - .3) / .35);
    if (rise > 0) {
      const dx = (b.x - a.x); const dy = (b.y - a.y); const len = Math.hypot(dx, dy) || 1; const nx = -dy / len; const ny = dx / len;
      const off = r * (1.4 + .8 * rise);
      const fadeOut = t > .9 ? (1 - t) / .1 : 1;
      ctx.globalAlpha = rise * fadeOut;
      ctx.fillStyle = '#d23b2a'; ctx.beginPath(); ctx.arc(a.x + nx * off, a.y + ny * off, r * .9, 0, TAU); ctx.fill(); // sun
      ctx.fillStyle = '#f4f1e6'; ctx.beginPath(); ctx.arc(b.x + nx * off, b.y + ny * off, r * .8, 0, TAU); ctx.fill(); // moon
      ctx.strokeStyle = '#e3b54c'; ctx.lineWidth = Math.max(1.5, r * .08);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const span = len / 2 + r * 1.5;
      ctx.beginPath(); ctx.ellipse(mid.x, mid.y, span, span * .45, Math.atan2(dy, dx), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const leaf = clamp01((t - .66) / .34);
    if (leaf > 0 && leaf < 1) {
      const R = rng(83); const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      for (let i = 0; i < 24; i += 1) {
        const ang = R() * TAU; const dist = (r * 2 + R() * r * 5) * leaf; const s = r * (.18 + R() * .16);
        ctx.save(); ctx.translate(mid.x + Math.cos(ang) * dist, mid.y + Math.sin(ang) * dist + leaf * r * 1.5); ctx.rotate(ang + leaf * 4);
        ctx.fillStyle = `rgba(232,190,80,${1 - leaf})`; ctx.fillRect(-s, -s * .6, s * 2, s * 1.2); ctx.restore();
      }
    }
    ctx.restore();
  }

  // ---- room themes (1,500,000P): the board itself -----------------------------------------------------------------
  function paintGiwon(ctx, w, h, pad) { // 조선 기원: hanji paper in a painted dancheong frame
    const wood = ctx.createLinearGradient(0, 0, w, h); wood.addColorStop(0, '#7a4726'); wood.addColorStop(1, '#5a3219');
    ctx.fillStyle = wood; ctx.fillRect(0, 0, w, h);
    const R = rng(21);
    ctx.fillStyle = '#ecddb8'; ctx.fillRect(pad * .55, pad * .55, w - pad * 1.1, h - pad * 1.1);
    ctx.strokeStyle = 'rgba(150,120,70,.16)'; ctx.lineWidth = 1;
    for (let i = 0; i < 260; i += 1) { const x = R() * w; const y = R() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (R() - .5) * 26, y + (R() - .5) * 26); ctx.stroke(); }
    ctx.lineWidth = Math.max(2, pad * .08); ctx.strokeStyle = '#a8322a'; ctx.strokeRect(pad * .3, pad * .3, w - pad * .6, h - pad * .6);
    ctx.lineWidth = Math.max(1.5, pad * .05); ctx.strokeStyle = '#2f7a5a'; ctx.strokeRect(pad * .42, pad * .42, w - pad * .84, h - pad * .84);
    ctx.fillStyle = '#d6b052';
    for (const [x, y] of [[.3, .3], [1, .3], [.3, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(x < 1 ? pad * x : w - pad * .3, y < 1 ? pad * y : h - pad * .3, pad * .12, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(180,140,60,.4)'; ctx.lineWidth = 1.6;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { // cloud scrolls in the corners
      const x0 = sx > 0 ? pad * .7 : w - pad * .7; const y0 = sy > 0 ? pad * .7 : h - pad * .7;
      for (let k = 1; k <= 3; k += 1) { ctx.beginPath(); ctx.arc(x0 + sx * k * 9, y0 + sy * k * 9, k * 7, 0, TAU); ctx.stroke(); }
    }
  }
  // v1.8.7 readability: the sky stays deep blue-violet but is no longer near black, the playing area gets a soft light
  // field, and the stars, nebula and constellations keep away from every intersection (a stone's spot) and fade inside
  // the grid, so lines and stones are read first. Stones get a matching accent (see `accent` below).
  function paintObservatory(ctx, w, h, pad) { // 별빛 천문대: a night sky with constellations and a golden star chart
    const sky = ctx.createLinearGradient(0, 0, w * .4, h); sky.addColorStop(0, '#1a2358'); sky.addColorStop(1, '#2c3a86');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h / 2, w * .05, w / 2, h / 2, w * .62); // soft light over the grid
    glow.addColorStop(0, 'rgba(176,192,255,.34)'); glow.addColorStop(.7, 'rgba(150,170,255,.16)'); glow.addColorStop(1, 'rgba(150,170,255,0)');
    ctx.fillStyle = glow; ctx.fillRect(pad * .6, pad * .6, w - pad * 1.2, h - pad * 1.2);
    const grid = (w - pad * 2) / 14;
    const inGrid = (x, y) => x > pad - grid * .5 && x < w - pad + grid * .5 && y > pad - grid * .5 && y < h - pad + grid * .5;
    const nearPoint = (x, y) => { // within reach of an intersection (where a stone sits)
      if (!inGrid(x, y)) return false;
      const gx = Math.round((x - pad) / grid); const gy = Math.round((y - pad) / grid);
      return Math.hypot(x - (pad + gx * grid), y - (pad + gy * grid)) < grid * .55;
    };
    const R = rng(33);
    const nebula = ctx.createRadialGradient(w * .78, h * .22, 4, w * .78, h * .22, w * .3); // a faint nebula in a corner
    nebula.addColorStop(0, 'rgba(206,150,255,.16)'); nebula.addColorStop(1, 'rgba(206,150,255,0)');
    ctx.fillStyle = nebula; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i += 1) {
      const x = R() * w; const y = R() * h; const k = .5 + R() * 1.2; const bright = .25 + R() * .55;
      if (nearPoint(x, y) || x < 22 && y < 22) continue;
      ctx.fillStyle = `rgba(255,255,255,${inGrid(x, y) ? bright * .45 : bright})`; ctx.beginPath(); ctx.arc(x, y, k, 0, TAU); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(190,205,255,.3)'; ctx.lineWidth = 1.2; ctx.fillStyle = 'rgba(214,224,255,.85)';
    for (const [cx, cy] of [[pad * .5, h * .3], [w - pad * .5, h * .7], [w * .3, pad * .5], [w * .7, h - pad * .5]]) { // constellations live in the frame
      ctx.beginPath(); const pts = [];
      for (let k = 0; k < 4; k += 1) { const x = cx + (R() - .5) * pad * .6; const y = cy + (R() - .5) * 90; pts.push([x, y]); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke(); for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(216,190,110,.16)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .36, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#d8be6e'; ctx.lineWidth = 3; ctx.strokeRect(pad * .45, pad * .45, w - pad * .9, h - pad * .9);
  }
  // Drawn over every stone on this board, whatever its skin: black gets a bright rim and a starlit edge, white a dark
  // outline and a star glint, so both stand out from the night sky at least as well as on the wooden board.
  function observatoryAccent(ctx, r, color) {
    ctx.save();
    if (color === 'black') {
      ctx.strokeStyle = 'rgba(214,226,255,.95)'; ctx.lineWidth = Math.max(1.6, r * .11);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.02, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#ffffff';
      for (const a of [-2.3, -.7, .9, 2.5]) starPath(ctx, Math.cos(a) * r * 1.02, Math.sin(a) * r * 1.02, r * .16, r * .04, 4), ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(14,18,48,.85)'; ctx.lineWidth = Math.max(1.4, r * .09);
      ctx.beginPath(); ctx.arc(0, 0, r * 1.01, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.95)'; starPath(ctx, -r * .32, -r * .38, r * .22, r * .05, 4); ctx.fill();
    }
    ctx.restore();
  }

  // ---- shop pictures ----------------------------------------------------------------------------------------------
  function drawPair(ctx, w, h, skinId, y = h / 2, r = Math.min(w, h) * .3) {
    for (const [cx, color] of [[w * .28, 'black'], [w * .72, 'white']]) {
      ctx.save(); ctx.fillStyle = 'rgba(40,20,0,.32)';
      ctx.beginPath(); ctx.ellipse(cx + 2, y + 3, r, r * .92, 0, 0, TAU); ctx.fill();
      ctx.translate(cx, y); S.paintStone(ctx, r, skinId, color); ctx.restore();
    }
  }
  function previewTheme(ctx, w, h, skinId) {
    const board = S.def(skinId).board; const pad = 16;
    board.paint(ctx, w, h, pad);
    ctx.strokeStyle = board.line; ctx.lineWidth = 1;
    for (let i = 0; i <= 6; i += 1) { const x = pad + (w - pad * 2) * i / 6; ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke(); }
    for (let i = 0; i <= 3; i += 1) { const y = pad + (h - pad * 2) * i / 3; ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke(); }
    const r = (w - pad * 2) / 6 * .42;
    for (const [gx, gy, color] of [[2, 1, 'black'], [3, 2, 'white'], [4, 1, 'black']]) {
      ctx.save(); ctx.translate(pad + (w - pad * 2) * gx / 6, pad + (h - pad * 2) * gy / 3); S.paintStone(ctx, r, null, color); ctx.restore();
    }
  }
  function previewPiece(ctx, w, h, skinId) {
    const wood = ctx.createLinearGradient(0, 0, w, h); wood.addColorStop(0, '#d9b070'); wood.addColorStop(1, '#c39a58');
    ctx.fillStyle = wood; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(50,30,10,.7)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.moveTo(w * .28, 0); ctx.lineTo(w * .28, h); ctx.moveTo(w * .72, 0); ctx.lineTo(w * .72, h); ctx.stroke();
    drawPair(ctx, w, h, skinId);
    const fx = S.def(skinId).fx; // a premium/legend preview shows its landing effect around the white stone
    if (fx) { ctx.save(); ctx.translate(w * .72, h / 2); fx(ctx, Math.min(w, h) * .3, .42, 'white'); ctx.restore(); }
  }

  const piece = (stone, fx, win) => ({ stone, fx, win, preview: previewPiece });
  // A legend also carries `special` (four in a row) and `legend: true`, which lets the room show its win on the board
  // first and keep the result as a small banner (app.js).
  const legend = (stone, fx, special, win) => ({ stone, fx, special, win, legend: true, preview: previewPiece });
  const theme = (paint, line, star, extra = {}) => ({ board: { paint, line, star, ...extra }, preview: previewTheme });
  S.define({
    omok_c1: piece(cat), omok_c2: piece(taegeuk), omok_c3: piece(gear), omok_c4: piece(planet), omok_c5: piece(dokkaebi),
    omok_p1: piece(sakura, sakuraFx), omok_p2: piece(volt, voltFx), omok_p3: piece(lava, lavaFx),
    omok_t1: theme(paintGiwon, '#2b1a10', '#8b2a1f'),
    omok_t2: theme(paintObservatory, 'rgba(236,216,140,.9)', '#f3dc8e', { accent: observatoryAccent, shadow: 'rgba(150,170,255,.32)' }),
    omok_l1: legend(starStone, starStoneFx, starStoneSpecial, starStoneWin), // 천상 바둑 ↔ 별빛 천문대
    omok_l2: legend(sealStone, sealStoneFx, sealStoneSpecial, sealStoneWin), // 왕실 기보 ↔ 조선 기원
  });
}());
