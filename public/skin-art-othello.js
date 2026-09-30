// 오델로 skins (v1.7.36): disc faces. A disc keeps its round outline (it flips edge-on), so the change is in the
// embossed emblem and rim. The black side is always the dark face and the white side the light one.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, sphere, gloss, starPath } = S.h;
  const dk = (c) => c === 'black';
  const face = (ctx, r, c, dark, light) => { ctx.fillStyle = sphere(ctx, r, dk(c) ? dark : light, .5); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); };
  const ring = (ctx, r, c, a = .86, colD = 'rgba(255,255,255,.35)', colL = 'rgba(40,50,70,.4)') => { ctx.strokeStyle = dk(c) ? colD : colL; ctx.lineWidth = Math.max(1.2, r * .07); ctx.beginPath(); ctx.arc(0, 0, r * a, 0, TAU); ctx.stroke(); };
  const DARK = ['#5a5a66', '#1c1c24', '#030305']; const LIGHT = ['#ffffff', '#f1f1ee', '#c4c8cb'];
  const ink = (c) => (dk(c) ? '#a6822f' : '#c99b34');

  function crown(ctx, r, c) { // 왕관 인장
    face(ctx, r, c, DARK, LIGHT); ring(ctx, r, c);
    ctx.fillStyle = ink(c); ctx.beginPath();
    ctx.moveTo(-r * .5, r * .3); ctx.lineTo(-r * .56, -r * .3); ctx.lineTo(-r * .26, -r * .02); ctx.lineTo(0, -r * .44); ctx.lineTo(r * .26, -r * .02); ctx.lineTo(r * .56, -r * .3); ctx.lineTo(r * .5, r * .3); ctx.closePath(); ctx.fill();
    ctx.fillRect(-r * .5, r * .36, r, r * .1);
    for (const [x, y] of [[-.56, -.3], [0, -.44], [.56, -.3]]) { ctx.beginPath(); ctx.arc(x * r, y * r, r * .07, 0, TAU); ctx.fill(); }
  }
  function paw(ctx, r, c) { // 고양이 발
    face(ctx, r, c, DARK, LIGHT); ring(ctx, r, c);
    ctx.fillStyle = dk(c) ? '#ea90aa' : '#e8788f';
    ctx.beginPath(); ctx.ellipse(0, r * .22, r * .34, r * .28, 0, 0, TAU); ctx.fill();
    for (const [x, y] of [[-.48, -.06], [-.17, -.36], [.17, -.36], [.48, -.06]]) { ctx.beginPath(); ctx.ellipse(x * r, y * r, r * .13, r * .17, x * .4, 0, TAU); ctx.fill(); }
  }
  function cog(ctx, r, c) { // 톱니기어
    face(ctx, r, c, ['#6a7283', '#232a36', '#05070b'], ['#ffffff', '#e4e8ee', '#a2abb8']);
    ctx.fillStyle = dk(c) ? '#5d6b80' : '#b8c2d0'; const n = 9; ctx.beginPath();
    for (let k = 0; k < n; k += 1) { const a = k * TAU / n; for (const [o, rad] of [[-.3, .42], [-.15, .58], [.15, .58], [.3, .42]]) { const x = Math.cos(a + o * TAU / n * 1.6) * r * rad; const y = Math.sin(a + o * TAU / n * 1.6) * r * rad; if (k === 0 && o === -.3) ctx.moveTo(x, y); else ctx.lineTo(x, y); } }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = dk(c) ? '#232a36' : '#e4e8ee'; ctx.beginPath(); ctx.arc(0, 0, r * .18, 0, TAU); ctx.fill(); ring(ctx, r, c);
  }
  function planetEmblem(ctx, r, c) { // 행성 문양
    face(ctx, r, c, ['#4a5190', '#171c48', '#04050f'], ['#fffdf6', '#f3ead6', '#c9b990']);
    ctx.fillStyle = dk(c) ? '#4d5699' : '#e3c890'; ctx.beginPath(); ctx.arc(0, 0, r * .36, 0, TAU); ctx.fill();
    ctx.strokeStyle = dk(c) ? '#a8833a' : '#8fa6d8'; ctx.lineWidth = r * .09; ctx.beginPath(); ctx.ellipse(0, 0, r * .7, r * .2, -.45, 0, TAU); ctx.stroke(); ring(ctx, r, c);
  }
  function shield(ctx, r, c) { // 방패 문장
    face(ctx, r, c, ['#6a3a3a', '#2a1212', '#060202'], ['#fffaf0', '#f4ead8', '#cdbb98']);
    ctx.beginPath(); ctx.moveTo(-r * .42, -r * .48); ctx.lineTo(r * .42, -r * .48); ctx.lineTo(r * .42, r * .08); ctx.quadraticCurveTo(r * .42, r * .5, 0, r * .68); ctx.quadraticCurveTo(-r * .42, r * .5, -r * .42, r * .08); ctx.closePath();
    ctx.fillStyle = dk(c) ? '#7a2424' : '#8fadea'; ctx.fill(); ctx.strokeStyle = ink(c); ctx.lineWidth = r * .06; ctx.stroke();
    ctx.fillStyle = ink(c); ctx.fillRect(-r * .05, -r * .44, r * .1, r * 1.0); ctx.fillRect(-r * .34, -r * .16, r * .68, r * .1); ring(ctx, r, c);
  }

  function prism(ctx, r, c) { // 프리즘 코어
    face(ctx, r, c, ['#5560a0', '#1b2050', '#04050f'], ['#ffffff', '#eef4ff', '#b8c6e4']);
    const cols = ['#ff6b9a', '#ffd86b', '#6bffb0', '#6bc8ff', '#b06bff', '#ff9a6b'];
    for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * .8, i * TAU / 6, (i + 1) * TAU / 6); ctx.closePath(); ctx.globalAlpha = dk(c) ? .28 : .2; ctx.fillStyle = cols[i]; ctx.fill(); }
    ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = r * .04;
    for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * TAU / 6) * r * .8, Math.sin(i * TAU / 6) * r * .8); ctx.stroke(); }
    ring(ctx, r, c, .8, 'rgba(255,255,255,.6)', 'rgba(255,255,255,.8)');
  }
  function prismFx(ctx, r, t) { ctx.save(); ctx.rotate(t * 2); for (let i = 0; i < 6; i += 1) { ctx.strokeStyle = `hsla(${i * 60},100%,70%,${(1 - t) * .9})`; ctx.lineWidth = r * .1 * (1 - t) + 1; ctx.beginPath(); ctx.moveTo(Math.cos(i * TAU / 6) * r * .9, Math.sin(i * TAU / 6) * r * .9); ctx.lineTo(Math.cos(i * TAU / 6) * r * (1.1 + .9 * t), Math.sin(i * TAU / 6) * r * (1.1 + .9 * t)); ctx.stroke(); } ctx.restore(); }
  function sunMoon(ctx, r, c) { // 태양·달: the dark side is the moon, the light side is the sun
    if (dk(c)) {
      face(ctx, r, c, ['#46507a', '#161b3a', '#03040c'], LIGHT);
      ctx.fillStyle = '#dfe6ff'; ctx.beginPath(); ctx.arc(-r * .06, 0, r * .48, 0, TAU); ctx.fill();
      ctx.fillStyle = '#161b3a'; ctx.beginPath(); ctx.arc(r * .16, -r * .06, r * .42, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff6c8'; starPath(ctx, r * .5, -r * .38, r * .12, r * .04, 4); ctx.fill(); ring(ctx, r, c);
    } else {
      face(ctx, r, c, DARK, ['#fffdf0', '#fff0b8', '#e6b84a']);
      ctx.fillStyle = '#f2a81d'; for (let i = 0; i < 12; i += 1) { const a = i * TAU / 12; ctx.beginPath(); ctx.moveTo(Math.cos(a - .12) * r * .5, Math.sin(a - .12) * r * .5); ctx.lineTo(Math.cos(a) * r * .8, Math.sin(a) * r * .8); ctx.lineTo(Math.cos(a + .12) * r * .5, Math.sin(a + .12) * r * .5); ctx.fill(); }
      ctx.fillStyle = '#f7c93c'; ctx.beginPath(); ctx.arc(0, 0, r * .44, 0, TAU); ctx.fill(); ring(ctx, r, c);
    }
  }
  function sunMoonFx(ctx, r, t, color) { const col = color === 'black' ? '200,215,255' : '255,200,60'; for (let k = 0; k < 2; k += 1) { const tt = clamp01(t * 1.3 - k * .25); if (tt <= 0 || tt >= 1) continue; ctx.strokeStyle = `rgba(${col},${(1 - tt) * .85})`; ctx.lineWidth = r * .12 * (1 - tt) + 1; ctx.beginPath(); ctx.arc(0, 0, r * (1 + 1.2 * tt), 0, TAU); ctx.stroke(); } }
  function iceFire(ctx, r, c) { // 얼음·불꽃: the dark side is fire, the light side is ice
    if (dk(c)) {
      face(ctx, r, c, ['#6a3a2a', '#2a120c', '#060202'], LIGHT);
      for (const [x, h, w] of [[-.4, .5, .22], [-.12, .8, .26], [.18, .62, .24], [.44, .42, .2]]) { const g = ctx.createLinearGradient(0, r * .6, 0, -r * h); g.addColorStop(0, '#c8400f'); g.addColorStop(1, '#e89a2a'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo((x - w / 2) * r, r * .6); ctx.quadraticCurveTo((x - w / 2) * r, -r * h * .4, x * r, -r * h); ctx.quadraticCurveTo((x + w / 2) * r, -r * h * .4, (x + w / 2) * r, r * .6); ctx.closePath(); ctx.fill(); }
      ring(ctx, r, c, .9, 'rgba(255,150,60,.5)');
    } else {
      face(ctx, r, c, DARK, ['#ffffff', '#e4f5ff', '#9fcbe8']);
      ctx.strokeStyle = '#8cc5e8'; ctx.lineWidth = r * .07; ctx.lineCap = 'round';
      for (let i = 0; i < 6; i += 1) { const a = i * TAU / 6; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r * .7, Math.sin(a) * r * .7); ctx.stroke(); for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * .45, Math.sin(a) * r * .45); ctx.lineTo(Math.cos(a + s * .5) * r * .6, Math.sin(a + s * .5) * r * .6); ctx.stroke(); } }
      ring(ctx, r, c, .9);
    }
  }
  function iceFireFx(ctx, r, t, color) {
    const R = rng(4);
    if (color === 'black') { for (let i = 0; i < 9; i += 1) { const x = (R() - .5) * r * 1.6; const y = -r * (.2 + 1.8 * t * (.6 + R() * .6)); ctx.fillStyle = `rgba(255,${130 + (R() * 100 | 0)},30,${1 - t})`; ctx.beginPath(); ctx.arc(x, y, r * .1 * (1 - t) + .6, 0, TAU); ctx.fill(); } }
    else { for (let i = 0; i < 8; i += 1) { const a = i * TAU / 8; const d = r * (.9 + 1.0 * t); ctx.strokeStyle = `rgba(150,215,255,${1 - t})`; ctx.lineWidth = r * .09; ctx.beginPath(); ctx.moveTo(Math.cos(a) * d, Math.sin(a) * d); ctx.lineTo(Math.cos(a) * (d + r * .3 * (1 - t)), Math.sin(a) * (d + r * .3 * (1 - t))); ctx.stroke(); } }
  }

  function eclipse(ctx, r, c) { // 일식과 월식: the dark face is the eclipsed sun with a corona, the light face the lit moon
    if (dk(c)) {
      face(ctx, r, c, ['#2a2f52', '#0b0d1f', '#010104'], LIGHT);
      const g = ctx.createRadialGradient(0, 0, r * .5, 0, 0, r); g.addColorStop(0, 'rgba(255,200,90,0)'); g.addColorStop(.75, 'rgba(255,190,80,.75)'); g.addColorStop(1, 'rgba(255,150,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#05060e'; ctx.beginPath(); ctx.arc(0, 0, r * .56, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,140,.8)'; ctx.lineWidth = r * .05; ctx.beginPath(); ctx.arc(0, 0, r * .58, 0, TAU); ctx.stroke();
    } else {
      face(ctx, r, c, DARK, ['#ffffff', '#f4f1e6', '#cbc4ae']);
      ctx.fillStyle = 'rgba(150,140,110,.35)'; for (const [x, y, k] of [[-.3, -.25, .2], [.3, .15, .16], [-.1, .4, .12]]) { ctx.beginPath(); ctx.arc(x * r, y * r, k * r, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(200,170,90,.7)'; ctx.lineWidth = r * .06; ctx.beginPath(); ctx.arc(0, 0, r * .9, 0, TAU); ctx.stroke();
    }
  }
  function eclipseFx(ctx, r, t, color) { // light and shadow turn across the disc while a corona flashes
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip();
    ctx.rotate(t * Math.PI * 1.4); ctx.fillStyle = color === 'black' ? `rgba(255,215,140,${(1 - t) * .55})` : `rgba(30,30,60,${(1 - t) * .5})`;
    ctx.fillRect(-r, -r, r, r * 2); ctx.restore();
    ctx.strokeStyle = `rgba(255,200,100,${(1 - t) * .9})`; ctx.lineWidth = r * .12 * (1 - t) + 1; ctx.beginPath(); ctx.arc(0, 0, r * (1.02 + .9 * t), 0, TAU); ctx.stroke();
  }

  // ---- room themes ----
  function parlor(ctx, w, h) { // 고전 응접실: polished walnut with a brass-lined grid
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#5a2f1a'); g.addColorStop(1, '#3a1d0e'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const R = rng(61); ctx.strokeStyle = 'rgba(20,8,2,.3)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 90; i += 1) { const y = R() * h; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * .3, y + (R() - .5) * 14, w * .7, y + (R() - .5) * 14, w, y); ctx.stroke(); }
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6);
  }
  function eclipseSky(ctx, w, h) { // 우주의 일식: a starfield under a ringed eclipse
    ctx.fillStyle = '#04060f'; ctx.fillRect(0, 0, w, h); const R = rng(71);
    for (let i = 0; i < 150; i += 1) { ctx.fillStyle = `rgba(255,255,255,${.2 + R() * .7})`; ctx.beginPath(); ctx.arc(R() * w, R() * h, .5 + R() * 1.3, 0, TAU); ctx.fill(); }
    const g = ctx.createRadialGradient(w / 2, h / 2, w * .1, w / 2, h / 2, w * .5); g.addColorStop(0, 'rgba(255,190,90,0)'); g.addColorStop(.55, 'rgba(255,170,70,.28)'); g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#02030a'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .2, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,205,120,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * .205, 0, TAU); ctx.stroke();
  }

  function previewPiece(ctx, w, h, skinId) {
    ctx.fillStyle = '#0f6b3a'; ctx.fillRect(0, 0, w, h); const r = Math.min(w, h) * .34;
    for (const [cx, color] of [[w * .28, 'black'], [w * .72, 'white']]) { ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.beginPath(); ctx.ellipse(cx + 2, h / 2 + 4, r, r * .96, 0, 0, TAU); ctx.fill(); ctx.translate(cx, h / 2); S.paintStone(ctx, r, skinId, color); ctx.restore(); }
    const fx = S.def(skinId).fx; if (fx) { ctx.save(); ctx.translate(w * .72, h / 2); fx(ctx, r, .4, 'white'); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) {
    const b = S.def(skinId).board; b.paint(ctx, w, h); ctx.strokeStyle = b.line; ctx.lineWidth = 1.2;
    for (let i = 0; i <= 4; i += 1) { ctx.beginPath(); ctx.moveTo(w * i / 4, 0); ctx.lineTo(w * i / 4, h); ctx.moveTo(0, h * i / 4); ctx.lineTo(w, h * i / 4); ctx.stroke(); }
    const r = Math.min(w, h) / 4 * .38;
    for (const [gx, gy, color] of [[1, 1, 'black'], [2, 1, 'white'], [1, 2, 'white'], [2, 2, 'black']]) { ctx.save(); ctx.translate(w * (gx + .5) / 4, h * (gy + .5) / 4); S.paintStone(ctx, r, null, color); ctx.restore(); }
  }
  const piece = (stone, fx) => ({ stone, fx, preview: previewPiece });
  const theme = (paint, line, dot) => ({ board: { paint, line, dot }, preview: previewTheme });
  S.define({
    othello_c1: piece(crown), othello_c2: piece(paw), othello_c3: piece(cog), othello_c4: piece(planetEmblem), othello_c5: piece(shield),
    othello_p1: piece(prism, prismFx), othello_p2: piece(sunMoon, sunMoonFx), othello_p3: piece(iceFire, iceFireFx),
    othello_t1: theme(parlor, 'rgba(201,162,74,.85)', '#c9a24a'),
    othello_t2: theme(eclipseSky, 'rgba(190,200,230,.6)', '#ffd98a'),
    othello_l1: piece(eclipse, eclipseFx),
  });
}());
