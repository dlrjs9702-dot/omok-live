// 오목 skins (v1.7.35): five commons that change the stone's silhouette, three premiums with a placement effect, two
// room themes (the board itself), and the legend 「천상 바둑」 (constellation stones, ripples, a win constellation).
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
    const pr = r * .74; const ring = d ? 'rgba(255,196,110,.95)' : 'rgba(110,140,205,.92)';
    const drawRing = (from, to) => {
      ctx.save(); ctx.rotate(-.42); ctx.strokeStyle = ring; ctx.lineWidth = r * .15;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.04, r * .3, 0, from, to); ctx.stroke(); ctx.restore();
    };
    drawRing(Math.PI, TAU);
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, pr, 0, TAU); ctx.clip();
    ctx.fillStyle = sphere(ctx, pr, d ? ['#7382c4', '#262d5c', '#080a1e'] : ['#fff7e8', '#efdabc', '#c4a880'], .5);
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
    ctx.strokeStyle = d ? '#5fe3ff' : '#3a7bd5'; ctx.lineWidth = r * .09; ctx.stroke();
    ctx.beginPath();
    [[.14, -.74], [-.36, .08], [-.04, .08], [-.16, .76], [.38, -.16], [.05, -.16]].forEach(([x, y], i) => { if (i) ctx.lineTo(x * r, y * r); else ctx.moveTo(x * r, y * r); });
    ctx.closePath(); ctx.fillStyle = d ? '#8af2ff' : '#ffc928'; ctx.fill();
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

  // ---- legend (3,000,000P): 천상 바둑 ---------------------------------------------------------------------------------
  const STARS = [[-.46, -.3], [-.05, -.56], [.4, -.36], [.5, .12], [.08, .3], [-.42, .34], [-.12, -.05]];
  const LINKS = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [1, 6], [6, 4]];
  function celestial(ctx, r, c) {
    const d = dark(c);
    ctx.fillStyle = sphere(ctx, r, d ? ['#5566d4', '#1b2463', '#060a26'] : ['#ffffff', '#eaedff', '#a9b3e6'], .48);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = d ? 'rgba(255,227,138,.55)' : 'rgba(180,135,30,.6)'; ctx.lineWidth = Math.max(1, r * .05);
    for (const [a, b] of LINKS) { ctx.beginPath(); ctx.moveTo(STARS[a][0] * r, STARS[a][1] * r); ctx.lineTo(STARS[b][0] * r, STARS[b][1] * r); ctx.stroke(); }
    ctx.fillStyle = d ? '#ffe38a' : '#d29a1f';
    STARS.forEach(([x, y], i) => { starPath(ctx, x * r, y * r, r * (i === 6 ? .16 : .11), r * .04, 4); ctx.fill(); });
    ctx.strokeStyle = d ? 'rgba(255,227,138,.75)' : 'rgba(190,140,30,.8)'; ctx.lineWidth = Math.max(1, r * .06);
    ctx.beginPath(); ctx.arc(0, 0, r * .97, 0, TAU); ctx.stroke();
    gloss(ctx, r, .14);
  }
  function celestialFx(ctx, r, t) {
    for (let k = 0; k < 2; k += 1) {
      const tt = clamp01(t * 1.25 - k * .22);
      if (tt <= 0 || tt >= 1) continue;
      ctx.strokeStyle = `rgba(255,227,138,${(1 - tt) * .85})`; ctx.lineWidth = r * .11 * (1 - tt) + 1;
      ctx.beginPath(); ctx.arc(0, 0, r * (1.05 + 2.3 * tt), 0, TAU); ctx.stroke();
    }
    ctx.fillStyle = `rgba(255,240,180,${1 - t})`;
    for (let i = 0; i < 4; i += 1) { const a = i * TAU / 4 + Math.PI / 4; starPath(ctx, Math.cos(a) * r * (1.2 + 1.2 * t), Math.sin(a) * r * (1.2 + 1.2 * t), r * .26 * (1 - t) + 1, r * .05, 4); ctx.fill(); }
  }
  function celestialWin(ctx, pts, r, t) { // the five stones join into a constellation, then a halo opens over it
    if (pts.length < 2) return;
    const p = clamp01(t * 1.5) * (pts.length - 1);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, col] of [[r * .34, 'rgba(255,214,90,.22)'], [r * .12, '#ffe38a']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) { const f = clamp01(p - (i - 1)); if (f <= 0) break; ctx.lineTo(pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f); }
      ctx.stroke();
    }
    pts.forEach((pt, i) => {
      if (p < i) return;
      const pulse = 1 + .18 * Math.sin(t * 14 + i);
      ctx.fillStyle = '#fff6c8'; starPath(ctx, pt.x, pt.y - 0, r * .62 * pulse, r * .12, 4); ctx.fill();
    });
    const mid = pts[Math.floor(pts.length / 2)];
    const halo = clamp01((t - .35) / .65);
    if (halo > 0 && halo < 1) { ctx.strokeStyle = `rgba(255,230,140,${(1 - halo) * .8})`; ctx.lineWidth = r * .14; ctx.beginPath(); ctx.arc(mid.x, mid.y, r * (1.5 + 5 * halo), 0, TAU); ctx.stroke(); }
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
  function paintObservatory(ctx, w, h, pad) { // 별빛 천문대: a night sky with constellations and a golden star chart
    const sky = ctx.createLinearGradient(0, 0, w * .4, h); sky.addColorStop(0, '#0a1030'); sky.addColorStop(1, '#1c2660');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    const R = rng(33);
    for (let i = 0; i < 160; i += 1) { ctx.fillStyle = `rgba(255,255,255,${.25 + R() * .6})`; ctx.beginPath(); ctx.arc(R() * w, R() * h, .5 + R() * 1.3, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(159,180,255,.28)'; ctx.lineWidth = 1.2; ctx.fillStyle = 'rgba(200,215,255,.8)';
    for (let g = 0; g < 4; g += 1) {
      let x = R() * w; let y = R() * h; ctx.beginPath(); ctx.moveTo(x, y); const pts = [[x, y]];
      for (let k = 0; k < 4; k += 1) { x += (R() - .5) * 160; y += (R() - .5) * 120; ctx.lineTo(x, y); pts.push([x, y]); }
      ctx.stroke(); for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, 2.2, 0, TAU); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(216,190,110,.2)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .36, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .22, 0, TAU); ctx.stroke();
    ctx.strokeStyle = '#d8be6e'; ctx.lineWidth = 3; ctx.strokeRect(pad * .45, pad * .45, w - pad * .9, h - pad * .9);
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
  const theme = (paint, line, star) => ({ board: { paint, line, star }, preview: previewTheme });
  S.define({
    omok_c1: piece(cat), omok_c2: piece(taegeuk), omok_c3: piece(gear), omok_c4: piece(planet), omok_c5: piece(dokkaebi),
    omok_p1: piece(sakura, sakuraFx), omok_p2: piece(volt, voltFx), omok_p3: piece(lava, lavaFx),
    omok_t1: theme(paintGiwon, '#2b1a10', '#8b2a1f'),
    omok_t2: theme(paintObservatory, 'rgba(222,199,120,.85)', '#f3dc8e'),
    omok_l1: piece(celestial, celestialFx, celestialWin),
  });
}());
