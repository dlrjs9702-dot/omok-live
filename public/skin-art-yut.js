// 윷놀이 skins (v1.7.37): the pieces (말) and the mat. Every piece keeps its team colour as the dominant body colour
// (blue = first player `black`, red = second `white`) and its number on a plate, so the pieces stay readable.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, sphere, starPath, badge } = S.h;
  const TEAM = {
    black: { main: '#2563eb', light: '#93c5fd', dark: '#1e3a8a', deep: '#0f1f5a' },
    white: { main: '#ef4444', light: '#fca5a5', dark: '#7f1d1d', deep: '#450a0a' },
  };
  const team = (c) => TEAM[c === 'white' ? 'white' : 'black'];
  const body = (ctx, r, c, k = .92) => { const T = team(c); ctx.fillStyle = sphere(ctx, r * k, [T.light, T.main, T.dark], .5); ctx.beginPath(); ctx.arc(0, 0, r * k, 0, TAU); ctx.fill(); };
  const eyes = (ctx, r, y = -.12, dx = .3, k = .12) => { for (const s of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * r * dx, r * y, r * k, 0, TAU); ctx.fill(); ctx.fillStyle = '#10131a'; ctx.beginPath(); ctx.arc(s * r * dx, r * y, r * k * .55, 0, TAU); ctx.fill(); } };

  // ---- commons ----
  function chick(ctx, r, c, label) { // 병아리
    body(ctx, r, c);
    ctx.strokeStyle = team(c).dark; ctx.lineWidth = r * .09; ctx.lineCap = 'round';
    for (const x of [-.14, 0, .14]) { ctx.beginPath(); ctx.moveTo(x * r, -r * .86); ctx.lineTo(x * r * 1.4, -r * 1.06); ctx.stroke(); }
    eyes(ctx, r, -.22, .3);
    ctx.fillStyle = '#ffa41c'; ctx.beginPath(); ctx.moveTo(-r * .16, -r * .02); ctx.lineTo(r * .16, -r * .02); ctx.lineTo(0, r * .2); ctx.fill();
    ctx.fillStyle = team(c).light; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * r * .8, r * .05, r * .14, r * .26, s * .4, 0, TAU); ctx.fill(); }
    badge(ctx, r, label);
  }
  function car(ctx, r, c, label) { // 장난감 자동차
    const T = team(c);
    ctx.fillStyle = '#1b1b22'; for (const [x, y] of [[-.66, -.5], [.66, -.5], [-.66, .5], [.66, .5]]) ctx.fillRect(x * r - r * .16, y * r - r * .26, r * .32, r * .52);
    ctx.fillStyle = sphere(ctx, r, [T.light, T.main, T.dark], .5); ctx.beginPath(); ctx.roundRect(-r * .6, -r * .95, r * 1.2, r * 1.9, r * .4); ctx.fill();
    ctx.fillStyle = '#bfe3ff'; ctx.beginPath(); ctx.roundRect(-r * .38, -r * .5, r * .76, r * .42, r * .1); ctx.fill();
    ctx.fillStyle = '#ffe66b'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * .36, -r * .82, r * .09, 0, TAU); ctx.fill(); }
    ctx.fillStyle = T.dark; ctx.fillRect(-r * .38, r * .1, r * .76, r * .1);
    badge(ctx, r, label);
  }
  function goblin(ctx, r, c, label) { // 꼬마 도깨비
    const T = team(c);
    for (const s of [-1, 1]) { ctx.fillStyle = '#f7e7a8'; ctx.beginPath(); ctx.moveTo(s * r * .3, -r * .7); ctx.lineTo(s * r * .5, -r * 1.12); ctx.lineTo(s * r * .68, -r * .55); ctx.fill(); }
    body(ctx, r, c);
    ctx.strokeStyle = T.deep; ctx.lineWidth = r * .1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-r * .55, -r * .4); ctx.lineTo(-r * .14, -r * .22); ctx.moveTo(r * .55, -r * .4); ctx.lineTo(r * .14, -r * .22); ctx.stroke();
    eyes(ctx, r, -.05, .3, .13);
    ctx.fillStyle = T.deep; ctx.beginPath(); ctx.moveTo(-r * .4, r * .15); ctx.quadraticCurveTo(0, r * .6, r * .4, r * .15); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * .26, r * .2); ctx.lineTo(s * r * .15, r * .4); ctx.lineTo(s * r * .05, r * .22); ctx.fill(); }
    badge(ctx, r, label);
  }
  function warrior(ctx, r, c, label) { // 조선 무사
    const T = team(c);
    ctx.fillStyle = '#f2c79a'; ctx.beginPath(); ctx.arc(0, r * .08, r * .68, 0, TAU); ctx.fill();
    ctx.fillStyle = T.dark; ctx.beginPath(); ctx.ellipse(0, -r * .28, r * 1.02, r * .3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = sphere(ctx, r, [T.light, T.main, T.dark], .5); ctx.beginPath(); ctx.ellipse(0, -r * .48, r * .48, r * .48, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#f7d65a'; ctx.beginPath(); ctx.arc(0, -r * .95, r * .1, 0, TAU); ctx.fill();
    eyes(ctx, r, .02, .26, .09);
    ctx.strokeStyle = '#3a2412'; ctx.lineWidth = r * .08; ctx.beginPath(); ctx.arc(0, r * .32, r * .3, .2, Math.PI - .2); ctx.stroke();
    badge(ctx, r, label);
  }
  function robot(ctx, r, c, label) { // 미니 로봇
    const T = team(c);
    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = r * .07; ctx.beginPath(); ctx.moveTo(0, -r * .7); ctx.lineTo(0, -r * 1.02); ctx.stroke();
    ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(0, -r * 1.04, r * .1, 0, TAU); ctx.fill();
    ctx.fillStyle = sphere(ctx, r, [T.light, T.main, T.dark], .5); ctx.beginPath(); ctx.roundRect(-r * .8, -r * .72, r * 1.6, r * 1.44, r * .3); ctx.fill();
    ctx.fillStyle = '#0c1a2a'; ctx.beginPath(); ctx.roundRect(-r * .6, -r * .48, r * 1.2, r * .5, r * .12); ctx.fill();
    ctx.fillStyle = '#5ff0ff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * .3, -r * .23, r * .13, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = T.deep; ctx.lineWidth = r * .05; for (const x of [-.3, -.1, .1, .3]) { ctx.beginPath(); ctx.moveTo(x * r, r * .12); ctx.lineTo(x * r, r * .3); ctx.stroke(); }
    badge(ctx, r, label);
  }

  // ---- premiums ----
  function ghost(ctx, r, c, label) { // 유령 행렬
    const T = team(c);
    ctx.fillStyle = sphere(ctx, r, [T.light, T.main, T.dark], .5);
    ctx.beginPath(); ctx.arc(0, -r * .1, r * .82, Math.PI, TAU); ctx.lineTo(r * .82, r * .78);
    for (let i = 0; i < 4; i += 1) ctx.quadraticCurveTo(r * (.82 - i * .41 - .2), r * 1.0, r * (.82 - (i + 1) * .41), r * .78);
    ctx.closePath(); ctx.fill();
    eyes(ctx, r, -.18, .3, .15);
    ctx.fillStyle = T.deep; ctx.beginPath(); ctx.ellipse(0, r * .2, r * .13, r * .18, 0, 0, TAU); ctx.fill();
    badge(ctx, r, label);
  }
  function ghostTrail(ctx, pts, r, c) { pts.forEach((p, i) => { const a = (i + 1) / pts.length; ctx.globalAlpha = a * .32; ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = team(c).light; ctx.beginPath(); ctx.arc(0, 0, r * .7 * a, 0, TAU); ctx.fill(); ctx.restore(); }); ctx.globalAlpha = 1; }
  function knight(ctx, r, c, label) { // 기사단
    const T = team(c);
    ctx.strokeStyle = T.light; ctx.lineWidth = r * .16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, -r * .62); ctx.quadraticCurveTo(r * .9, -r * 1.3, r * .7, -r * .1); ctx.stroke();
    ctx.fillStyle = sphere(ctx, r, ['#eef2f7', '#9aa6b5', '#4b5563'], .5); ctx.beginPath(); ctx.arc(0, -r * .1, r * .8, Math.PI, TAU); ctx.lineTo(r * .8, r * .7); ctx.lineTo(-r * .8, r * .7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = T.main; ctx.fillRect(-r * .8, -r * .02, r * 1.6, r * .16);
    ctx.fillStyle = '#10131a'; ctx.fillRect(-r * .62, -r * .34, r * 1.24, r * .18);
    ctx.fillStyle = T.main; ctx.beginPath(); ctx.moveTo(0, -r * .9); ctx.lineTo(r * .16, -r * .62); ctx.lineTo(-r * .16, -r * .62); ctx.fill();
    badge(ctx, r, label);
  }
  function knightTrail(ctx, pts, r) { pts.forEach((p, i) => { const a = (i + 1) / pts.length; ctx.fillStyle = `rgba(210,190,150,${a * .4})`; ctx.beginPath(); ctx.arc(p.x, p.y + r * .7, r * .3 * a, 0, TAU); ctx.fill(); }); }
  function ship(ctx, r, c, label) { // 소형 우주선
    const T = team(c);
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.moveTo(-r * .2, r * .55); ctx.lineTo(0, r * 1.05); ctx.lineTo(r * .2, r * .55); ctx.fill();
    ctx.fillStyle = T.dark; ctx.beginPath(); ctx.moveTo(-r * .95, r * .62); ctx.lineTo(-r * .3, -r * .1); ctx.lineTo(-r * .3, r * .6); ctx.fill(); ctx.beginPath(); ctx.moveTo(r * .95, r * .62); ctx.lineTo(r * .3, -r * .1); ctx.lineTo(r * .3, r * .6); ctx.fill();
    ctx.fillStyle = sphere(ctx, r, [T.light, T.main, T.dark], .5); ctx.beginPath(); ctx.moveTo(0, -r * 1.02); ctx.quadraticCurveTo(r * .55, -r * .3, r * .42, r * .62); ctx.lineTo(-r * .42, r * .62); ctx.quadraticCurveTo(-r * .55, -r * .3, 0, -r * 1.02); ctx.fill();
    ctx.fillStyle = '#bfe8ff'; ctx.beginPath(); ctx.arc(0, -r * .28, r * .18, 0, TAU); ctx.fill();
    badge(ctx, r, label);
  }
  function shipTrail(ctx, pts, r) { pts.forEach((p, i) => { const a = (i + 1) / pts.length; ctx.fillStyle = `rgba(255,${140 + (a * 90 | 0)},60,${a * .55})`; ctx.beginPath(); ctx.arc(p.x, p.y + r * .5, r * .34 * a, 0, TAU); ctx.fill(); }); }

  // ---- legend: 사방신 -- the piece number picks one of the four guardians; each leaves its own trail ----
  const GUARD = ['청룡', '백호', '주작', '현무'];
  function guardian(ctx, r, c, label) {
    const T = team(c); const k = Math.max(0, Math.min(3, (Number(label) || 1) - 1));
    ctx.fillStyle = sphere(ctx, r, [T.light, T.main, T.dark], .5); ctx.beginPath(); ctx.arc(0, 0, r * .96, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#f7d65a'; ctx.lineWidth = r * .1; ctx.beginPath(); ctx.arc(0, 0, r * .9, 0, TAU); ctx.stroke();
    ctx.save(); ctx.translate(0, -r * .06); ctx.scale(.74, .74);
    if (k === 0) { // 청룡: a coiled dragon with whiskers
      ctx.strokeStyle = '#37e0b0'; ctx.lineWidth = r * .16; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * .55, r * .3); ctx.bezierCurveTo(-r * .5, -r * .5, r * .1, r * .5, r * .3, -r * .3); ctx.stroke();
      ctx.fillStyle = '#37e0b0'; ctx.beginPath(); ctx.arc(r * .36, -r * .34, r * .2, 0, TAU); ctx.fill(); ctx.fillStyle = '#0b3b2f'; ctx.beginPath(); ctx.arc(r * .42, -r * .38, r * .05, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#b6ffe8'; ctx.lineWidth = r * .05; ctx.beginPath(); ctx.moveTo(r * .5, -r * .3); ctx.quadraticCurveTo(r * .75, -r * .2, r * .8, -r * .05); ctx.stroke();
    } else if (k === 1) { // 백호: a striped tiger face
      ctx.fillStyle = '#fbfbfb'; ctx.beginPath(); ctx.arc(0, 0, r * .55, 0, TAU); ctx.fill();
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(s * r * .42, -r * .44, r * .16, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = r * .09; ctx.lineCap = 'round';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * r * .48, -r * .1); ctx.lineTo(s * r * .3, -r * .02); ctx.moveTo(s * r * .5, r * .14); ctx.lineTo(s * r * .3, r * .14); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(0, -r * .5); ctx.lineTo(0, -r * .3); ctx.stroke();
      ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(-r * .2, -r * .06, r * .06, 0, TAU); ctx.arc(r * .2, -r * .06, r * .06, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(-r * .1, r * .14); ctx.lineTo(r * .1, r * .14); ctx.lineTo(0, r * .26); ctx.fill();
    } else if (k === 2) { // 주작: a firebird with spread wings
      ctx.fillStyle = '#ff7a1f'; ctx.beginPath(); ctx.moveTo(0, -r * .6); ctx.quadraticCurveTo(r * .9, -r * .3, r * .7, r * .3); ctx.quadraticCurveTo(r * .3, r * .1, 0, r * .55); ctx.quadraticCurveTo(-r * .3, r * .1, -r * .7, r * .3); ctx.quadraticCurveTo(-r * .9, -r * .3, 0, -r * .6); ctx.fill();
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.moveTo(0, -r * .4); ctx.quadraticCurveTo(r * .35, -r * .1, 0, r * .4); ctx.quadraticCurveTo(-r * .35, -r * .1, 0, -r * .4); ctx.fill();
    } else { // 현무: a turtle shell with a snake
      ctx.fillStyle = '#2f5d4a'; ctx.beginPath(); ctx.ellipse(0, r * .05, r * .6, r * .46, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8fd1b0'; ctx.lineWidth = r * .06; ctx.beginPath(); ctx.moveTo(-r * .3, -r * .2); ctx.lineTo(r * .3, -r * .2); ctx.moveTo(-r * .4, r * .1); ctx.lineTo(r * .4, r * .1); ctx.moveTo(0, -r * .4); ctx.lineTo(0, r * .5); ctx.stroke();
      ctx.strokeStyle = '#6fd3a0'; ctx.lineWidth = r * .12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r * .5, r * .3); ctx.bezierCurveTo(-r * .9, r * .5, -r * .7, -r * .3, -r * .4, -r * .4); ctx.stroke();
    }
    ctx.restore();
    badge(ctx, r, label);
  }
  function guardianTrail(ctx, pts, r, c, label) {
    const k = Math.max(0, Math.min(3, (Number(label) || 1) - 1));
    pts.forEach((p, i) => {
      const a = (i + 1) / pts.length; ctx.save(); ctx.translate(p.x, p.y);
      if (k === 0) { ctx.strokeStyle = `rgba(90,240,200,${a * .6})`; ctx.lineWidth = r * .1; ctx.beginPath(); ctx.arc(0, 0, r * (1.4 - a * .5), i, i + 1.6); ctx.stroke(); }
      else if (k === 1) { ctx.strokeStyle = `rgba(255,255,255,${a * .75})`; ctx.lineWidth = r * .09; for (const d of [-.3, 0, .3]) { ctx.beginPath(); ctx.moveTo(-r * .5, r * d); ctx.lineTo(r * .5, r * (d + .25)); ctx.stroke(); } }
      else if (k === 2) { ctx.fillStyle = `rgba(255,${120 + (a * 100 | 0)},30,${a * .7})`; ctx.beginPath(); ctx.arc(0, r * .3, r * .3 * a, 0, TAU); ctx.fill(); }
      else { ctx.fillStyle = `rgba(120,200,255,${a * .65})`; ctx.beginPath(); ctx.ellipse(0, r * .3, r * .14, r * .22, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    });
  }

  // v1.9.0 legend standard: `special(ctx, pts, r, t, color, label)` when this piece catches one (pts: the catch spot),
  // `win(ctx, pts, r, t, color, size)` when its player wins (pts: the start/finish tile).
  const GUARD_COL = ['90,240,200', '255,255,255', '255,140,40', '120,200,255'];
  function guardianSpecial(ctx, pts, r, t, c, label) { // the guardian's element bursts on the catch
    const k = Math.max(0, Math.min(3, (Number(label) || 1) - 1)); const p = pts[0]; const col = GUARD_COL[k];
    for (let i = 0; i < 3; i += 1) { const tt = clamp01(t * 1.3 - i * .2); if (tt <= 0 || tt >= 1) continue; ctx.strokeStyle = `rgba(20,25,40,${(1 - tt) * .35})`; ctx.lineWidth = r * .4 * (1 - tt) + 2; ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 + 3 * tt), 0, TAU); ctx.stroke(); ctx.strokeStyle = `rgba(${col},${(1 - tt) * .9})`; ctx.lineWidth = r * .25 * (1 - tt) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 + 3 * tt), 0, TAU); ctx.stroke(); }
    const R = rng(k + 3);
    for (let i = 0; i < 12; i += 1) { const a = R() * TAU; const d = r * (1 + 3.2 * clamp01(t)); ctx.fillStyle = `rgba(${col},${1 - clamp01(t)})`; ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, r * .18, 0, TAU); ctx.fill(); }
  }
  function guardianWin(ctx, pts, r, t, c, size) { // four guardian lights circle the board and meet over the finish tile
    const { w, h } = size; const cx = w / 2; const cy = h * .47; const p = pts[0];
    const gather = clamp01(t / .65); const flash = clamp01((t - .6) / .4);
    ctx.save();
    GUARD_COL.forEach((col, i) => {
      const a = i * TAU / 4 + gather * TAU * .75; const rad = w * .32 * (1 - gather);
      const x = cx + (p.x - cx) * gather + Math.cos(a) * rad; const y = cy + (p.y - cy) * gather + Math.sin(a) * rad;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2); g.addColorStop(0, `rgba(${col},.95)`); g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, TAU); ctx.fill();
    });
    if (flash > 0 && flash < 1) { ctx.strokeStyle = `rgba(247,214,90,${1 - flash})`; ctx.lineWidth = r * .5 * (1 - flash) + 1; ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 + 8 * flash), 0, TAU); ctx.stroke(); }
    ctx.restore();
  }

  // ---- legend 2 (v1.9.0): 옥토끼 원정대 ↔ 달나라 윷판 -- moon rabbits with long ears; a catch pounds the mortar ----
  function rabbit(ctx, r, c, label) {
    const T = team(c);
    for (const s of [-1, 1]) { // the long ears are the silhouette
      ctx.save(); ctx.translate(s * r * .34, -r * .78); ctx.rotate(s * .22);
      ctx.fillStyle = T.main; ctx.beginPath(); ctx.ellipse(0, -r * .32, r * .2, r * .5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffc2d6'; ctx.beginPath(); ctx.ellipse(0, -r * .3, r * .09, r * .36, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = sphere(ctx, r, [T.light, T.main, T.dark], .5); ctx.beginPath(); ctx.arc(0, 0, r * .94, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.ellipse(0, r * .2, r * .42, r * .3, 0, 0, TAU); ctx.fill();
    for (const s of [-1, 1]) { ctx.fillStyle = '#10131a'; ctx.beginPath(); ctx.arc(s * r * .3, -r * .16, r * .1, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s * r * .3 - r * .03, -r * .2, r * .035, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ff7aa2'; ctx.beginPath(); ctx.moveTo(-r * .07, r * .08); ctx.lineTo(r * .07, r * .08); ctx.lineTo(0, r * .17); ctx.fill();
    ctx.strokeStyle = '#f7d65a'; ctx.lineWidth = r * .08; ctx.beginPath(); ctx.arc(0, 0, r * .9, Math.PI * .15, Math.PI * .85); ctx.stroke(); // a crescent collar
    badge(ctx, r, label);
  }
  function moonDust(ctx, pts, r) { // little hops of moon dust and crescents behind the rabbit
    pts.forEach((p, i) => { const a = (i + 1) / pts.length; ctx.fillStyle = `rgba(255,236,170,${a * .6})`; ctx.beginPath(); ctx.arc(p.x, p.y + r * .55, r * .3 * a, Math.PI * .2, Math.PI * 1.4); ctx.arc(p.x + r * .1, p.y + r * .5, r * .22 * a, Math.PI * 1.4, Math.PI * .2, true); ctx.fill(); });
  }
  function mortarSpecial(ctx, pts, r, t, c) { // a pestle pounds the catch spot: 쿵! rice-cake dust and stars
    const p = pts[0]; const down = clamp01(t / .3); const after = clamp01((t - .3) / .7);
    ctx.save();
    const y = p.y - r * 3.4 * (1 - down * down);
    ctx.fillStyle = '#c08a55'; ctx.strokeStyle = '#4a2c12'; ctx.lineWidth = r * .1;
    ctx.save(); ctx.translate(p.x, y); ctx.rotate(-.35); ctx.beginPath(); ctx.roundRect(-r * .28, -r * 1.6, r * .56, r * 1.7, r * .2); ctx.fill(); ctx.stroke(); ctx.restore();
    if (after > 0) {
      ctx.globalAlpha = 1 - after;
      ctx.strokeStyle = c === 'white' ? '#b91c1c' : '#1d4ed8'; ctx.lineWidth = r * .14; ctx.beginPath(); ctx.ellipse(p.x, p.y + r * .4, r * (1 + 1.6 * after), r * (.5 + .8 * after), 0, 0, TAU); ctx.stroke(); // 쿵!
      ctx.fillStyle = '#f7a8c8'; for (let i = 0; i < 10; i += 1) { const a = i * TAU / 10; const d = r * (1 + 2.4 * after); ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d * .55 + r * .4, r * .22, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#ffd86b'; for (let i = 0; i < 5; i += 1) { const a = -Math.PI / 2 + (i - 2) * .5; starPath(ctx, p.x + Math.cos(a) * r * 2.2 * after, p.y - r * .4 + Math.sin(a) * r * 2.2 * after, r * .3, r * .1, 5); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
  function fullMoonWin(ctx, pts, r, t, c, size) { // a full moon rises over the board with a rabbit pounding inside it
    const { w, h } = size; const cx = w / 2; const rise = clamp01(t / .6); const cy = h * (.95 - .45 * rise); const R = w * .17;
    ctx.save(); ctx.globalAlpha = Math.min(1, t * 4) * (1 - clamp01((t - .85) / .15));
    const g = ctx.createRadialGradient(cx, cy, R * .2, cx, cy, R * 1.8); g.addColorStop(0, 'rgba(255,244,200,.55)'); g.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.8, 0, TAU); ctx.fill();
    const night = ctx.createRadialGradient(cx, cy, R * .9, cx, cy, R * 1.7); night.addColorStop(0, 'rgba(20,30,80,.7)'); night.addColorStop(1, 'rgba(20,30,80,0)'); // a patch of night so the moon reads on any mat
    ctx.fillStyle = night; ctx.beginPath(); ctx.arc(cx, cy, R * 1.7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff4c8'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill();
    const hop = Math.abs(Math.sin(t * Math.PI * 6)) * R * .08;
    ctx.fillStyle = 'rgba(150,130,90,.55)'; // the rabbit in the moon
    ctx.beginPath(); ctx.ellipse(cx - R * .15, cy + R * .15 - hop, R * .28, R * .22, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - R * .22, cy - R * .2 - hop, R * .07, R * .24, -.2, 0, TAU); ctx.ellipse(cx - R * .08, cy - R * .2 - hop, R * .07, R * .24, .2, 0, TAU); ctx.fill();
    ctx.fillRect(cx + R * .2, cy + R * .1, R * .3, R * .25);
    const R2 = rng(5); ctx.fillStyle = '#fff';
    for (let i = 0; i < 16; i += 1) { const a = R2() * TAU; const d = R * (1.2 + R2() * 1.4); const tw = Math.sin((t * 3 + R2()) * Math.PI); if (tw > 0) { starPath(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * .3 * tw, r * .08, 4); ctx.fill(); } }
    ctx.restore();
  }

  // ---- room themes: the mat and the paper ----
  function courtyard(ctx, w, h) { // 설날 한옥마당
    ctx.fillStyle = '#e8eef5'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(120,135,155,.35)'; ctx.lineWidth = 2;
    for (let y = 0; y < h; y += 90) for (let x = (y / 90) % 2 ? 0 : 45; x < w; x += 90) ctx.strokeRect(x, y, 90, 90);
    const R = rng(17); ctx.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 70; i += 1) { ctx.beginPath(); ctx.arc(R() * w, R() * h, 1.5 + R() * 3, 0, TAU); ctx.fill(); }
    const inset = 26; ctx.save(); ctx.shadowColor = 'rgba(30,40,60,.4)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#fff3d6'; ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2 - 40); ctx.restore();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 8; ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2 - 40);
    ctx.strokeStyle = '#e0b84a'; ctx.lineWidth = 3; ctx.strokeRect(inset + 9, inset + 9, w - inset * 2 - 18, h - inset * 2 - 58);
  }
  function moon(ctx, w, h) { // 달나라 윷판
    ctx.fillStyle = '#6f7686'; ctx.fillRect(0, 0, w, h); const R = rng(27);
    for (let i = 0; i < 26; i += 1) { const x = R() * w; const y = R() * h; const k = 10 + R() * 34; ctx.fillStyle = 'rgba(40,46,60,.35)'; ctx.beginPath(); ctx.arc(x, y, k, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(200,208,225,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, k, 0, TAU); ctx.stroke(); }
    const inset = 26; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#1b2345'; ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2 - 40); ctx.restore();
    for (let i = 0; i < 70; i += 1) { ctx.fillStyle = `rgba(255,255,255,${.25 + R() * .6})`; ctx.beginPath(); ctx.arc(inset + R() * (w - inset * 2), inset + R() * (h - inset * 2 - 40), .6 + R() * 1.2, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = '#9fb4ff'; ctx.lineWidth = 3; ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2 - 40);
  }

  // ---- shop pictures ----
  function previewPiece(ctx, w, h, skinId) {
    ctx.fillStyle = '#b8914f'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#f3e7c4'; ctx.fillRect(8, 8, w - 16, h - 16);
    const r = Math.min(w, h) * .3; const d = S.def(skinId);
    if (d.trail) { const pts = Array.from({ length: 8 }, (_, i) => ({ x: w * .08 + i * w * .05, y: h * .52 - Math.sin(i / 7 * Math.PI) * 10 })); ctx.save(); d.trail(ctx, pts, r * .6, 'black', '1'); ctx.restore(); }
    [[w * .34, 'black', '1'], [w * .7, 'white', d.legend ? '3' : '2']].forEach(([cx, color, label]) => {
      ctx.save(); ctx.fillStyle = 'rgba(30,16,4,.3)'; ctx.beginPath(); ctx.ellipse(cx + 2, h / 2 + r * .9, r * .9, r * .3, 0, 0, TAU); ctx.fill(); ctx.translate(cx, h / 2); S.paintStone(ctx, r, skinId, color, label); ctx.restore();
    });
  }
  function previewTheme(ctx, w, h, skinId) {
    const b = S.def(skinId).board; b.paint(ctx, w, h);
    ctx.strokeStyle = b.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * .22, h * .3); ctx.lineTo(w * .78, h * .3); ctx.lineTo(w * .78, h * .72); ctx.lineTo(w * .22, h * .72); ctx.closePath(); ctx.moveTo(w * .22, h * .3); ctx.lineTo(w * .78, h * .72); ctx.stroke();
    for (const [x, y] of [[.22, .3], [.78, .3], [.78, .72], [.22, .72], [.5, .51]]) { ctx.fillStyle = b.node; ctx.beginPath(); ctx.arc(w * x, h * y, 9, 0, TAU); ctx.fill(); ctx.stroke(); }
    ctx.save(); ctx.translate(w * .5, h * .51); S.paintStone(ctx, 14, null, 'black'); ctx.restore();
  }
  const piece = (stone, trail, extra = {}) => ({ stone, trail, preview: previewPiece, ...extra });
  const theme = (paint, ink, node) => ({ board: { paint, ink, node }, preview: previewTheme });
  S.define({
    yut_c1: piece(chick), yut_c2: piece(car), yut_c3: piece(goblin), yut_c4: piece(warrior), yut_c5: piece(robot),
    yut_p1: piece(ghost, ghostTrail), yut_p2: piece(knight, knightTrail), yut_p3: piece(ship, shipTrail),
    yut_t1: theme(courtyard, 'rgba(60,30,20,.85)', '#fff3d6'),
    yut_t2: theme(moon, 'rgba(180,200,255,.9)', '#2a3566'),
    yut_l1: piece(guardian, guardianTrail, { legend: true, special: guardianSpecial, win: guardianWin }),
    yut_l2: piece(rabbit, moonDust, { legend: true, special: mortarSpecial, win: fullMoonWin }),
  });
}());
