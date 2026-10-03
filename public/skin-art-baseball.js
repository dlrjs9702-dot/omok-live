// 숫자야구 skins (v1.7.38): how a guess row looks (by the guesser's skin), what the S/B/O lamps look like, a short
// effect when a new result arrives, and the room theme (the guess list's backdrop). The guess digits and the S/B/O
// counts stay in the same place and at least as legible as the default green scoreboard.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, starPath } = S.h;

  // A row = CSS properties for the row and for its digits; `lamp` = colours/shape of the S/B/O lamps.
  const row = (props, digit, lamp, extra = {}) => ({ row: props, digit, lamp, ...extra });
  const tile = (key, w, h, draw) => S.h.img(key, w, h, draw);

  // ---- commons ----
  const scoreboard = row(
    { backgroundColor: '#06240f', backgroundImage: tile('bb-led', 10, 10, (c) => { c.fillStyle = 'rgba(120,255,160,.14)'; c.beginPath(); c.arc(5, 5, 1.6, 0, TAU); c.fill(); }), borderColor: '#e5e7eb', color: '#dff8e6', fontFamily: '"Consolas","Courier New",monospace' },
    { color: '#ffe066', textShadow: '0 0 7px rgba(255,224,102,.7)' },
    { strike: '#ffe066', ball: '#4ade80', out: '#ff5b5b', off: '#0e2a18', radius: '50%', glow: true });
  const notebook = row(
    { backgroundColor: '#fbf4dc', backgroundImage: tile('bb-notebook', 40, 30, (c, w, h) => { c.strokeStyle = 'rgba(90,140,200,.45)'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(0, h - 1); c.lineTo(w, h - 1); c.stroke(); }), borderColor: '#c9b98a', color: '#3a2a12', fontFamily: '"Segoe Print","Comic Sans MS",cursive' },
    { color: '#1f3a8a', textShadow: 'none' },
    { strike: '#1d4ed8', ball: '#15803d', out: '#b91c1c', off: '#e6dcc0', radius: '2px', glow: false });
  const slot = row(
    { backgroundColor: '#7f1014', backgroundImage: tile('bb-slot', 60, 40, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,215,120,.5)'); g.addColorStop(.5, 'rgba(255,215,120,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), borderColor: '#f2c14e', color: '#ffe9a8', fontFamily: 'Georgia,serif' },
    { color: '#ffffff', textShadow: '0 1px 0 #7f1014,0 0 8px rgba(255,215,120,.8)', letterSpacing: '.3em' },
    { strike: '#ffd23f', ball: '#7be0a0', out: '#ffffff', off: '#4a0a0d', radius: '3px', glow: true });
  const vault = row(
    { backgroundColor: '#3d4653', backgroundImage: tile('bb-vault', 40, 40, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(6, 6, 2, 0, TAU); c.arc(w - 6, h - 6, 2, 0, TAU); c.fill(); }), borderColor: '#9aa6b5', color: '#e5e9ef', fontFamily: '"Consolas",monospace' },
    { color: '#f4f7fb', textShadow: '0 1px 0 #202733' },
    { strike: '#ffb02e', ball: '#5fd4ff', out: '#ff5b5b', off: '#2a313d', radius: '1px', glow: true });
  const lab = row(
    { backgroundColor: '#e6f4f1', backgroundImage: tile('bb-lab', 24, 24, (c, w, h) => { c.strokeStyle = 'rgba(20,120,110,.25)'; c.lineWidth = 1; c.strokeRect(.5, .5, w - 1, h - 1); }), borderColor: '#5bb5aa', color: '#0f3d38', fontFamily: '"Segoe UI",system-ui,sans-serif' },
    { color: '#0b5d54', textShadow: 'none' },
    { strike: '#9a6a00', ball: '#0f7a52', out: '#b42323', off: '#c8e3de', radius: '50%', glow: false, ring: true });

  // ---- premiums ----
  const terminal = row(
    { backgroundColor: '#020a04', backgroundImage: tile('bb-term', 6, 6, (c) => { c.fillStyle = 'rgba(60,255,110,.10)'; c.fillRect(0, 0, 6, 1); }), borderColor: '#1f7a3a', color: '#5dff8a', fontFamily: '"Consolas","Courier New",monospace' },
    { color: '#9bffb5', textShadow: '0 0 8px rgba(93,255,138,.9)' },
    { strike: '#9bffb5', ball: '#5dc9ff', out: '#ff6b6b', off: '#0a2412', radius: '0', glow: true });
  const hologram = row(
    { backgroundColor: 'rgba(10,50,80,.78)', backgroundImage: tile('bb-holo', 8, 6, (c, w, h) => { c.fillStyle = 'rgba(110,220,255,.16)'; c.fillRect(0, 0, w, 2); }), borderColor: '#4fd0ff', color: '#bdeeff', fontFamily: '"Segoe UI",system-ui,sans-serif', boxShadow: '0 0 12px rgba(79,208,255,.45), inset 0 0 12px rgba(79,208,255,.25)' },
    { color: '#e6fbff', textShadow: '0 0 10px rgba(110,220,255,.95)' },
    { strike: '#ffe066', ball: '#6ee7b7', out: '#ff7aa0', off: '#0d3148', radius: '50%', glow: true });
  const safe = row(
    { backgroundColor: '#20252d', backgroundImage: tile('bb-safe', 50, 50, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = '#d4af37'; for (const [x, y] of [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6]]) { c.beginPath(); c.arc(x, y, 2.6, 0, TAU); c.fill(); } }), borderColor: '#d4af37', color: '#f3dea0', fontFamily: 'Georgia,serif' },
    { color: '#ffe9a8', textShadow: '0 0 6px rgba(212,175,55,.7)' },
    { strike: '#ffcf4a', ball: '#9adbff', out: '#ff6b6b', off: '#2c323b', radius: '2px', glow: true, lock: true });

  // ---- legend: 마스터 코드 -- every strike opens one more lock pin ----
  const master = row(
    { backgroundColor: '#111827', backgroundImage: tile('bb-master', 60, 44, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(212,175,55,.0)'); g.addColorStop(.5, 'rgba(212,175,55,.22)'); g.addColorStop(1, 'rgba(212,175,55,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(212,175,55,.25)'; c.strokeRect(2.5, 2.5, w - 5, h - 5); }), borderColor: '#d4af37', color: '#f5e6b0', fontFamily: 'Georgia,serif', boxShadow: '0 0 10px rgba(212,175,55,.35)' },
    { color: '#fff1bf', textShadow: '0 0 8px rgba(255,214,102,.85)', letterSpacing: '.28em' },
    { strike: '#ffd54a', ball: '#8fd3ff', out: '#ff6b6b', off: '#2a2d36', radius: '1px', glow: true, lock: true, pin: true },
    { fx: unlockFx, win: vaultWin, special: lockSpecial, legend: true });
  function unlockFx(ctx, w, h, t) { // a golden sweep and a few sparks across the new row
    const x = w * (.1 + .8 * t); const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0); g.addColorStop(0, 'rgba(255,214,102,0)'); g.addColorStop(.5, `rgba(255,236,160,${(1 - t) * .7})`); g.addColorStop(1, 'rgba(255,214,102,0)');
    ctx.fillStyle = g; ctx.fillRect(40, 30, w - 80, h - 60); const R = rng(9);
    for (let i = 0; i < 8; i += 1) { ctx.fillStyle = `rgba(255,230,140,${1 - t})`; starPath(ctx, 50 + R() * (w - 100), h / 2 + (R() - .5) * 26 - t * 14, 4 * (1 - t) + 1, 1, 4); ctx.fill(); }
  }
  function vaultWin(ctx, w, h, t) { // the vault opens: two doors swing apart over the list
    const k = clamp01(t * 1.3); ctx.fillStyle = `rgba(30,36,48,${1 - k})`; ctx.fillRect(40, 40, (w - 80) / 2 * (1 - k), h - 80); ctx.fillRect(w / 2 + (w - 80) / 4 * k * 2, 40, (w - 80) / 2 * (1 - k), h - 80);
    ctx.fillStyle = `rgba(255,214,102,${Math.sin(k * Math.PI) * .7})`; ctx.fillRect(w / 2 - 6 - k * 60, 40, 12 + k * 120, h - 80);
  }

  // v1.9.1 legend standard: `special(ctx, w, h, t)` on a guess one strike short of the answer (over that row), `win`
  // over the list when the game is won (vaultWin above for 마스터 코드).
  function lockSpecial(ctx, w, h, t) { // one pin left: a combination dial spins at the row's end, a pin pops up
    const cx = w - 70; const cy = h / 2; const R = Math.min(30, h * .32);
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .8) / .2);
    ctx.fillStyle = '#1a1f2b'; ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.translate(cx, cy); ctx.rotate(t * TAU * 1.5); ctx.strokeStyle = '#f5e6b0'; ctx.lineWidth = 2;
    for (let i = 0; i < 12; i += 1) { const a = i * TAU / 12; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * .7, Math.sin(a) * R * .7); ctx.lineTo(Math.cos(a) * R * .9, Math.sin(a) * R * .9); ctx.stroke(); }
    ctx.restore();
    const pop = clamp01((t - .45) / .3); if (pop > 0) { ctx.fillStyle = `rgba(255,214,90,${1 - clamp01((t - .8) / .2)})`; ctx.fillRect(cx - 4, cy - R - 6 - pop * 18, 8, 16); }
  }

  // ---- legend 2 (v1.9.1): 끝내기 홈런 ↔ 야구장 덕아웃 -- a stitched baseball row; one strike short winds up a swing ----
  const walkoff = row(
    { backgroundColor: '#f7f3ea', backgroundImage: tile('bb-walkoff', 64, 44, (c, w, h) => { c.strokeStyle = 'rgba(200,40,50,.75)'; c.lineWidth = 1.6; for (const y of [5, h - 5]) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = 4; x < w; x += 8) { c.beginPath(); c.moveTo(x, y - 3); c.lineTo(x + 3, y + 3); c.stroke(); } } }), borderColor: '#c8283a', color: '#1b2a4a', fontFamily: '"Segoe UI",system-ui,sans-serif', boxShadow: '0 0 0 2px #1b2a4a inset, 0 4px 10px rgba(0,0,0,.25)', borderRadius: '22px' },
    { color: '#0f1c3a', textShadow: '0 1px 0 #ffffff', letterSpacing: '.24em' },
    { strike: '#c8283a', ball: '#127a3e', out: '#1b2a4a', off: '#ddd3bd', radius: '50%', glow: false, ring: true },
    { fx: pitchFx, special: swingSpecial, win: homeRunWin, legend: true });
  function pitchFx(ctx, w, h, t) { // a pitch flies across the new row and leaves a seam trail
    const x = 40 + (w - 80) * t; const y = h / 2 - Math.sin(t * Math.PI) * 10;
    for (let k = 0; k < 6; k += 1) { const u = Math.max(0, t - k * .03); ctx.fillStyle = `rgba(200,40,50,${(1 - k / 6) * (1 - t) * .6})`; ctx.beginPath(); ctx.arc(40 + (w - 80) * u, h / 2 - Math.sin(u * Math.PI) * 10, 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c8283a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); ctx.stroke();
  }
  function swingSpecial(ctx, w, h, t) { // one strike short: a bat swings at the row's end and a crack bursts
    const cx = w - 80; const cy = h / 2 + 6; const a = -2.4 + clamp01(t / .4) * 2.8; const L = Math.min(70, h * .9);
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .8) / .2); ctx.translate(cx, cy); ctx.rotate(a);
    ctx.fillStyle = '#c08a55'; ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(L, -7); ctx.arc(L, 0, 7, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    const crack = clamp01((t - .35) / .4); if (crack > 0 && crack < 1) { ctx.strokeStyle = `rgba(255,214,90,${1 - crack})`; ctx.lineWidth = 3; for (let i = 0; i < 8; i += 1) { const b = i * TAU / 8; ctx.beginPath(); ctx.moveTo(cx + Math.cos(b) * (14 + crack * 10), cy - 20 + Math.sin(b) * (14 + crack * 10)); ctx.lineTo(cx + Math.cos(b) * (22 + crack * 30), cy - 20 + Math.sin(b) * (22 + crack * 30)); ctx.stroke(); } }
  }
  function homeRunWin(ctx, w, h, t) { // the ball sails out over the list in a long arc and fireworks open where it lands
    const fly = clamp01(t / .55); const bx = w * .12 + w * .76 * fly; const by = h * .85 - Math.sin(fly * Math.PI) * h * .7;
    ctx.save();
    for (let k = 1; k < 14; k += 1) { const u = Math.max(0, fly - k * .02); ctx.fillStyle = `rgba(255,255,255,${(1 - k / 14) * .55})`; ctx.beginPath(); ctx.arc(w * .12 + w * .76 * u, h * .85 - Math.sin(u * Math.PI) * h * .7, 5, 0, TAU); ctx.fill(); }
    if (fly < 1) { ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#c8283a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 10, 0, TAU); ctx.fill(); ctx.stroke(); }
    const boom = clamp01((t - .5) / .5);
    if (boom > 0 && boom < 1) for (const [fx, fy, col] of [[w * .88, h * .85, '255,214,90'], [w * .7, h * .3, '200,40,50'], [w * .3, h * .35, '79,168,255']]) for (let i = 0; i < 14; i += 1) { const a = i * TAU / 14; const d = 10 + boom * 70; ctx.fillStyle = `rgba(${col},${1 - boom})`; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * d, fy + Math.sin(a) * d + boom * boom * 20, 3, 0, TAU); ctx.fill(); }
    if (boom > 0) { ctx.globalAlpha = Math.sin(boom * Math.PI); ctx.fillStyle = '#c8283a'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5; ctx.font = `900 ${Math.round(Math.min(w, 600) * .1)}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.strokeText('HOME RUN!', w / 2, h / 2); ctx.fillText('HOME RUN!', w / 2, h / 2); }
    ctx.restore();
  }

  // ---- room themes: the backdrop of the guess list ----
  function dugout(ctx, w, h) { // 야구장 덕아웃: wooden bench boards and a chalk line
    ctx.fillStyle = '#6b4526'; ctx.fillRect(0, 0, w, h); const R = rng(14);
    for (let y = 0; y < h; y += 14) { ctx.fillStyle = `rgba(0,0,0,${.12 + R() * .1})`; ctx.fillRect(0, y, w, 2); ctx.strokeStyle = 'rgba(255,220,170,.12)'; ctx.beginPath(); ctx.moveTo(0, y + 6); ctx.bezierCurveTo(w * .3, y + 4 + R() * 4, w * .7, y + 8 - R() * 4, w, y + 6); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.strokeRect(6, 6, w - 12, h - 12);
  }
  function secretLab(ctx, w, h) { // 극비 연구소: a dark lab wall with a hazard stripe and a grid
    ctx.fillStyle = '#0d141d'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(90,220,230,.14)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } for (let y = 0; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = '#e0b32a'; for (let x = -h; x < w; x += 24) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, 6); ctx.clip(); ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 12, 0); ctx.lineTo(x + 6, 6); ctx.lineTo(x - 6, 6); ctx.fill(); ctx.restore(); }
  }

  function previewRow(ctx, w, h, skinId, keepBackdrop) {
    const d = S.def(skinId); if (!keepBackdrop) { ctx.fillStyle = '#0b1324'; ctx.fillRect(0, 0, w, h); }
    [[.08, '123', 1, 1], [.5, '456', 0, 2]].forEach(([fy, digits, sCount, bCount]) => {
      const y = h * fy + 6; const rh = h * .38; const x = 10; const rw = w - 20;
      ctx.fillStyle = d.row.backgroundColor.startsWith('rgba') ? '#0a3250' : d.row.backgroundColor; ctx.beginPath(); ctx.roundRect(x, y, rw, rh, 8); ctx.fill();
      if (d.row.preTile) { ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, rw, rh, 8); ctx.clip(); d.row.preTile(ctx, x, y, rw, rh); ctx.restore(); }
      ctx.strokeStyle = d.row.borderColor; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, rw, rh, 8); ctx.stroke();
      ctx.fillStyle = d.digit.color; ctx.font = `900 ${rh * .5}px ${d.row.fontFamily}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(digits.split('').join(' '), x + 14, y + rh / 2 + 1);
      const kinds = [['strike', sCount], ['ball', bCount]]; let lx = x + rw - 14 - 6 * 24;
      for (const [kind, n] of kinds) for (let i = 0; i < 3; i += 1) { ctx.fillStyle = i < n ? d.lamp[kind] : d.lamp.off; ctx.beginPath(); if (d.lamp.radius === '50%') ctx.arc(lx + 8, y + rh / 2, 7, 0, TAU); else ctx.roundRect(lx + 2, y + rh / 2 - 7, 12, 14, 2); ctx.fill(); lx += 24; }
    });
    if (d.fx) { ctx.save(); d.fx(ctx, w, h, .5); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) { S.def(skinId).panel(ctx, w, h); ctx.globalAlpha = .55; previewRow(ctx, w, h, 'baseball_c1', true); ctx.globalAlpha = 1; }
  const piece = (def) => ({ ...def, preview: previewRow });
  const theme = (panel, frame) => ({ panel, frame, preview: previewTheme });
  S.define({
    baseball_c1: piece(scoreboard), baseball_c2: piece(notebook), baseball_c3: piece(slot), baseball_c4: piece(vault), baseball_c5: piece(lab),
    baseball_p1: piece({ ...terminal, fx: (ctx, w, h, t) => { ctx.fillStyle = `rgba(93,255,138,${(1 - t) * .28})`; ctx.fillRect(40, 30, w - 80, h - 60); } }),
    baseball_p2: piece({ ...hologram, fx: (ctx, w, h, t) => { ctx.strokeStyle = `rgba(110,220,255,${(1 - t) * .9})`; ctx.lineWidth = 3; ctx.strokeRect(40 - t * 10, 30 - t * 6, w - 80 + t * 20, h - 60 + t * 12); } }),
    baseball_p3: piece({ ...safe, fx: (ctx, w, h, t) => { const R = rng(4); for (let i = 0; i < 9; i += 1) { ctx.fillStyle = `rgba(255,${190 + (R() * 50 | 0)},60,${1 - t})`; ctx.beginPath(); ctx.arc(40 + R() * (w - 80), h / 2 + (R() - .5) * 20 - t * 20, 2.4 * (1 - t) + .6, 0, TAU); ctx.fill(); } } }),
    baseball_t1: theme(dugout, { borderColor: '#e9d9b5', boxShadow: 'inset 0 0 0 3px #6b4526, 0 0 0 2px #e9d9b5' }), baseball_t2: theme(secretLab, { borderColor: '#e0b32a', boxShadow: 'inset 0 0 0 3px #0d141d, 0 0 14px rgba(90,220,230,.4)' }),
    baseball_l1: piece(master),
    baseball_l2: piece(walkoff),
  });
}());
