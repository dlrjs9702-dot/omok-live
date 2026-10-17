// 라이어게임 skins (v1.7.40): the speech bubble of a hint (by the speaker's skin), the name tag in it, a short
// effect when a hint arrives, the room theme (the panel's backdrop and frame) and, for the legend, what happens when
// the liar is revealed. Bubbles keep 4.5:1 text contrast and the roles/words stay exactly as public as before.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, starPath } = S.h;
  const tile = (key, w, h, draw) => S.h.img(key, w, h, draw);

  // bubble(bg, image, border, color, who, tail) -> a hint row look; `tail` colours the little pointer under the bubble
  const bubble = (bg, image, border, color, who, extra = {}, font = 'inherit') => ({
    row: { backgroundColor: bg, backgroundImage: image, border: `2px solid ${border}`, color, fontFamily: font, '--tail': bg.startsWith('rgba') ? border : bg, ...extra }, who: { color: who }, text: { color, bg, who },
  });

  // ---- commons ----
  const badge = bubble('#f6f0dc', tile('lr-badge', 40, 40, (c, w, h) => { c.strokeStyle = 'rgba(160,130,40,.2)'; c.beginPath(); c.arc(w - 10, h - 10, 6, 0, TAU); c.stroke(); starPath(c, w - 10, h - 10, 4, 1.5, 5); c.stroke(); }), '#b8952e', '#2b2208', '#7a5a00', {}, 'Georgia,serif');
  const wanted = bubble('#e8d3a3', tile('lr-wanted', 60, 44, (c, w, h) => { c.fillStyle = 'rgba(90,50,10,.10)'; for (let i = 0; i < 40; i += 1) c.fillRect((i * 37) % w, (i * 53) % h, 2, 1); }), '#8b5a1a', '#2a1a06', '#7a1f1f', {}, 'Georgia,serif');
  const tarot = bubble('#f2ead7', tile('lr-tarot', 40, 40, (c, w, h) => { c.strokeStyle = 'rgba(120,70,160,.25)'; c.strokeRect(3.5, 3.5, w - 7, h - 7); }), '#7a4aa0', '#231433', '#6b2fa0', {}, 'Georgia,serif');
  const envelope = bubble('#efe4cf', tile('lr-env', 60, 40, (c, w, h) => { c.strokeStyle = 'rgba(140,100,50,.22)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, h * .7); c.lineTo(w, 0); c.stroke(); }), '#b08a55', '#2a1c08', '#8a3a10');
  const cassette = bubble('#e9eef2', tile('lr-cass', 40, 28, (c, w, h) => { c.fillStyle = 'rgba(40,60,80,.08)'; c.fillRect(0, h - 4, w, 2); }), '#5a7088', '#0f1d2b', '#0b5a7a', {}, '"Consolas",monospace');

  // ---- premiums ----
  const agent = bubble('#14202b', tile('lr-agent', 30, 30, (c, w, h) => { c.fillStyle = 'rgba(120,200,255,.10)'; c.fillRect(0, 0, w, 1.5); c.fillRect(0, 0, 1.5, h); }), '#62b6ff', '#e5f3ff', '#7fd0ff', { boxShadow: '0 0 10px rgba(98,182,255,.35)' }, '"Consolas",monospace');
  const royal = bubble('#2a1438', tile('lr-royal', 50, 40, (c, w, h) => { c.fillStyle = 'rgba(255,214,102,.14)'; starPath(c, w / 2, h / 2, 14, 6, 4); c.fill(); }), '#f0c14e', '#fff3d4', '#ffd86b', { boxShadow: '0 0 10px rgba(240,193,78,.35)' }, 'Georgia,serif');
  const hologram = bubble('rgba(10,50,80,.85)', tile('lr-holo', 8, 6, (c, w) => { c.fillStyle = 'rgba(110,220,255,.16)'; c.fillRect(0, 0, w, 2); }), '#4fd0ff', '#e3f8ff', '#ffe066', { boxShadow: '0 0 12px rgba(79,208,255,.45), inset 0 0 10px rgba(79,208,255,.2)' });
  const glint = (col) => (ctx, w, h, t) => { const x = w * (.1 + .8 * t); const g = ctx.createLinearGradient(x - 40, 0, x + 40, 0); g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(.5, `rgba(${col},${(1 - t) * .75})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(40, 30, w - 80, h - 60); };
  agent.fx = glint('120,200,255'); royal.fx = glint('255,214,102'); hologram.fx = (ctx, w, h, t) => { ctx.strokeStyle = `rgba(110,220,255,${(1 - t) * .9})`; ctx.lineWidth = 3; ctx.strokeRect(40 - t * 10, 30 - t * 6, w - 80 + t * 20, h - 60 + t * 12); };

  // ---- legend: 무명의 왕 ----
  const king = bubble('#21170a', tile('lr-king', 60, 44, (c, w, h) => { c.strokeStyle = 'rgba(255,214,102,.3)'; c.lineWidth = 2; c.strokeRect(3, 3, w - 6, h - 6); c.beginPath(); c.moveTo(w / 2 - 10, 7); c.quadraticCurveTo(w / 2, 14, w / 2 + 10, 7); c.stroke(); }), '#e6b64a', '#fff0c6', '#ffd86b', { boxShadow: '0 0 12px rgba(230,182,74,.45)' }, 'Georgia,serif');
  king.fx = glint('255,226,140');
  king.win = (ctx, w, h, t) => { // the golden mask cracks across the result
    const k = clamp01(t * 1.4); ctx.strokeStyle = `rgba(255,226,140,${1 - t * .6})`; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); const pts = [[w * .5, 0], [w * .46, h * .22], [w * .55, h * .4], [w * .47, h * .6], [w * .53, h * .8], [w * .5, h]];
    const n = Math.max(1, Math.floor(k * (pts.length - 1))); pts.slice(0, n + 1).forEach(([x, y], i) => { if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
    const R = rng(7); for (let i = 0; i < 16; i += 1) { ctx.fillStyle = `rgba(255,226,140,${(1 - t) * clamp01(k * 2 - R())})`; ctx.fillRect(w * (.3 + R() * .4), h * R(), 4, 4); }
  };

  // v1.9.2 legend standard: `special` when the round's liar (this skin's owner) is revealed (king.win above cracks the
  // mask), `win` over the panel when the game ends with this player among the final winners.
  king.legend = true; king.special = king.win;
  king.win = (ctx, w, h, t) => { // masks rain down and a golden crown settles in the middle of the panel
    const R = rng(13); ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    for (let i = 0; i < 18; i += 1) { const x = R() * w; const y = -30 + ((R() * h * .4 + t * h * 1.3) % (h + 40)); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 6 + i) * .4); ctx.fillStyle = i % 2 ? '#f0c14e' : '#7a2a60'; ctx.beginPath(); ctx.ellipse(-9, 0, 9, 6, 0, 0, TAU); ctx.ellipse(9, 0, 9, 6, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    const k = clamp01((t - .2) / .4); const cx = w / 2; const cy = h * (.2 + .25 * k); const s = Math.min(w, h) * .14;
    ctx.fillStyle = '#ffd86b'; ctx.strokeStyle = '#7a5208'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - s, cy + s * .5); ctx.lineTo(cx - s, cy - s * .3); ctx.lineTo(cx - s * .5, cy + s * .1); ctx.lineTo(cx, cy - s * .55); ctx.lineTo(cx + s * .5, cy + s * .1); ctx.lineTo(cx + s, cy - s * .3); ctx.lineTo(cx + s, cy + s * .5); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  };

  // ---- legend 2 (v1.9.2): 심문관의 램프 ↔ 취조실 -- a case-file card under a swinging lamp; the reveal is a stamp ----
  const lamp = bubble('#1b1f26', tile('lr-lamp', 80, 44, (c, w, h) => { const g = c.createRadialGradient(w * .2, 0, 2, w * .2, 0, w * .7); g.addColorStop(0, 'rgba(255,214,140,.32)'); g.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, h - 2, w, 1); }),
    '#e0a84a', '#f3ead8', '#ffc36b', { borderRadius: '3px 16px 16px 16px', boxShadow: '0 0 0 1px #3a3f48 inset, 0 6px 14px rgba(0,0,0,.35)' }, '"Consolas","Courier New",monospace');
  lamp.legend = true;
  lamp.fx = (ctx, w, h, t) => { // the hanging lamp swings once: its cone of light sweeps across the new hint
    const a = Math.sin(t * Math.PI * 1.5) * .6; const px = w / 2; const L = h * 1.2;
    ctx.save(); ctx.translate(px, 0); ctx.rotate(a); const g = ctx.createLinearGradient(0, 0, 0, L); g.addColorStop(0, `rgba(255,220,150,${(1 - t) * .55})`); g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.lineTo(70, L); ctx.lineTo(-70, L); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  lamp.special = (ctx, w, h, t) => { // the lamp snaps onto the panel and a red ruling stamp lands
    const on = clamp01(t / .2); const cx = w / 2; const cy = h * .55;
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    ctx.fillStyle = `rgba(0,0,0,${.45 * on})`; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.min(w, h) * .45); g.addColorStop(0, `rgba(255,236,190,${.6 * on})`); g.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const stamp = clamp01((t - .25) / .2); if (stamp > 0) { const s = 1.6 - .6 * stamp; ctx.translate(cx, cy); ctx.rotate(-.18); ctx.scale(s, s); ctx.globalAlpha *= stamp;
      ctx.strokeStyle = '#d42a2a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(-90, -34, 180, 68, 10); ctx.stroke();
      ctx.fillStyle = '#d42a2a'; ctx.font = '900 40px "Malgun Gothic", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('판 결', 0, 2); }
    ctx.restore();
  };
  lamp.win = (ctx, w, h, t) => { // case files fly up and a 「사건 종결」 seal closes the dossier
    const R = rng(29); ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    for (let i = 0; i < 12; i += 1) { const x = R() * w; const y = h + 30 - t * h * (.8 + R() * .6); ctx.save(); ctx.translate(x, y); ctx.rotate((R() - .5) + t * 2); ctx.fillStyle = '#e8dcc0'; ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.5; ctx.fillRect(-18, -12, 36, 24); ctx.strokeRect(-18, -12, 36, 24); ctx.fillStyle = '#b8952e'; ctx.fillRect(-18, -16, 14, 5); ctx.restore(); }
    const k = clamp01((t - .3) / .3); if (k > 0) { const cx = w / 2; const cy = h / 2; ctx.globalAlpha *= k; ctx.fillStyle = 'rgba(212,42,42,.12)'; ctx.strokeStyle = '#d42a2a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, 62, 0, TAU); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, 52, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#d42a2a'; ctx.font = '900 22px "Malgun Gothic", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('사건 종결', cx, cy + 1); }
    ctx.restore();
  };

  // ---- room themes ----
  function interrogation(ctx, w, h) { // 취조실: concrete wall, a hanging lamp cone and a one-way mirror edge
    ctx.fillStyle = '#20252c'; ctx.fillRect(0, 0, w, h); const R = rng(77); ctx.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 200; i += 1) ctx.fillRect(R() * w, R() * h, 2, 2);
    const g = ctx.createRadialGradient(w / 2, 0, 10, w / 2, h * .4, w * .6); g.addColorStop(0, 'rgba(255,240,190,.4)'); g.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, h - 20, w, 20);
  }
  function masquerade(ctx, w, h) { // 가면무도회장: velvet curtains and gold masks
    const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#3a0f2e'); g.addColorStop(.5, '#551a45'); g.addColorStop(1, '#3a0f2e'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 6; for (let x = 0; x < w; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 8, h * .4, x - 8, h * .7, x, h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(240,193,78,.35)'; for (const [x, y] of [[.12, .15], [.88, .18], [.5, .9]]) { ctx.beginPath(); ctx.ellipse(w * x, h * y, 26, 16, 0, 0, TAU); ctx.fill(); }
  }

  // ---- v1.10.90 스킨 2배 (IDEAS #future-skins-double): five bubbles, three premiums, a legend and its room (구미호 가면
  // ↔ 구미호 숲). Bubbles keep 4.5:1 text contrast.
  const loveLetter = bubble('#ffeef3', tile('lr-love', 40, 40, (c, w, h) => { c.fillStyle = 'rgba(230,80,120,.14)'; const x = w - 10; const y = h - 10; c.beginPath(); c.moveTo(x, y + 4); c.bezierCurveTo(x - 7, y - 1, x - 4, y - 7, x, y - 3); c.bezierCurveTo(x + 4, y - 7, x + 7, y - 1, x, y + 4); c.fill(); }), '#e57aa0', '#3a0f1e', '#b8245a');
  const paperPlane = bubble('#eef6ff', tile('lr-plane', 60, 40, (c, w, h) => { c.strokeStyle = 'rgba(60,110,180,.18)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, h); c.lineTo(w, 0); c.stroke(); }), '#6a9ad0', '#0f2238', '#1d4e8a');
  const fortune = bubble('#fbf1dc', tile('lr-fortune', 60, 30, (c, w, h) => { c.fillStyle = 'rgba(214,150,70,.14)'; c.beginPath(); c.ellipse(w - 14, h / 2, 10, 7, 0, 0, TAU); c.fill(); }), '#d29a4a', '#2a1a06', '#a0461a', {}, 'Georgia,serif');
  const classNote = bubble('#fffef6', tile('lr-classnote', 40, 22, (c, w, h) => { c.strokeStyle = 'rgba(80,140,200,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, h - 1); c.lineTo(w, h - 1); c.stroke(); }), '#9ab0c8', '#1a2230', '#2a4a8a', { borderRadius: '4px 14px 14px 14px' }, '"Segoe Print","Comic Sans MS",system-ui,sans-serif');
  const explorer = bubble('#ece2c4', tile('lr-explorer', 50, 50, (c, w, h) => { c.strokeStyle = 'rgba(110,80,30,.18)'; c.lineWidth = 1.2; c.beginPath(); c.arc(w - 14, h - 14, 9, 0, TAU); c.moveTo(w - 14, h - 26); c.lineTo(w - 14, h - 2); c.moveTo(w - 26, h - 14); c.lineTo(w - 2, h - 14); c.stroke(); }), '#8a6a32', '#231a08', '#6a4210', {}, 'Georgia,serif');
  const spyRadio = bubble('#0d1a14', tile('lr-spyradio', 40, 30, (c, w, h) => { c.strokeStyle = 'rgba(90,240,150,.16)'; c.lineWidth = 1.2; for (const k of [6, 11, 16]) { c.beginPath(); c.arc(4, h / 2, k, -.6, .6); c.stroke(); } }), '#4ad98a', '#e2ffef', '#7cf0a8', { boxShadow: '0 0 10px rgba(74,217,138,.35)' }, '"Consolas","Courier New",monospace');
  const iceCrystal = bubble('#e8f6ff', tile('lr-ice', 40, 40, (c, w, h) => { c.strokeStyle = 'rgba(80,150,210,.22)'; c.lineWidth = 1.2; for (let i = 0; i < 6; i += 1) { const a = i * Math.PI / 3; c.beginPath(); c.moveTo(w - 12, h - 12); c.lineTo(w - 12 + Math.cos(a) * 8, h - 12 + Math.sin(a) * 8); c.stroke(); } }), '#6ab4e8', '#0b2236', '#1a5a9a', { boxShadow: '0 0 10px rgba(106,180,232,.4)' });
  const goldInvite = bubble('#fffaf0', tile('lr-invite', 40, 40, (c, w, h) => { c.strokeStyle = 'rgba(200,160,60,.35)'; c.lineWidth = 1; c.strokeRect(3.5, 3.5, w - 7, h - 7); }), '#d4a43a', '#2a1e06', '#9a6a10', { boxShadow: 'inset 0 0 0 1px rgba(212,164,58,.5)' }, 'Georgia,serif');
  spyRadio.fx = glint('120,255,170'); iceCrystal.fx = glint('180,225,255'); goldInvite.fx = glint('255,214,102');
  // 구미호 가면 (legend) ↔ 구미호 숲 (room)
  const gumiho = bubble('#2a1414', tile('lr-gumiho', 70, 44, (c, w, h) => { c.fillStyle = 'rgba(255,170,90,.18)'; c.beginPath(); c.moveTo(w - 30, h - 8); c.lineTo(w - 34, h - 26); c.lineTo(w - 24, h - 18); c.lineTo(w - 16, h - 26); c.lineTo(w - 6, h - 18); c.lineTo(w - 2, h - 26); c.lineTo(w - 6, h - 8); c.closePath(); c.fill(); }), '#f08a4a', '#ffeedd', '#ffb07a', { boxShadow: '0 0 12px rgba(240,138,74,.35)' }, 'Georgia,serif');
  gumiho.legend = true; gumiho.fx = glint('255,170,100');
  gumiho.special = (ctx, w, h, t) => { // the liar revealed: nine tails fan out behind a fox mask, 「라이어!」
    const cx = w / 2; const cy = h * .55; const k = clamp01(t / .4); const s = Math.min(w, h) * .12;
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .8) / .2);
    for (let i = 0; i < 9; i += 1) { const a = -Math.PI / 2 + (i - 4) * .3 * k; ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); const g = ctx.createLinearGradient(0, 0, 0, -s * 3); g.addColorStop(0, '#f08a4a'); g.addColorStop(1, '#fff3e6'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -s * 1.6 * k, s * .4, s * 1.6 * k, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = '#fff6ee'; ctx.strokeStyle = '#b8401a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - s, cy - s * .5); ctx.lineTo(cx - s * .7, cy - s * 1.3); ctx.lineTo(cx - s * .2, cy - s * .7); ctx.lineTo(cx + s * .2, cy - s * .7); ctx.lineTo(cx + s * .7, cy - s * 1.3); ctx.lineTo(cx + s, cy - s * .5); ctx.quadraticCurveTo(cx, cy + s * 1.1, cx - s, cy - s * .5); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d22a1a'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sx * s * .38, cy - s * .2, s * .16, s * .06, sx * .5, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#ffd6b0'; ctx.strokeStyle = '#5a1a08'; ctx.lineWidth = 4; ctx.font = `900 ${Math.round(s * .9)}px Georgia,serif`; ctx.textAlign = 'center'; ctx.strokeText('라이어!', cx, cy + s * 1.7); ctx.fillText('라이어!', cx, cy + s * 1.7);
    ctx.restore();
  };
  gumiho.win = (ctx, w, h, t) => { // fox fires drift up and circle the panel
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    for (let i = 0; i < 9; i += 1) { const a = i * TAU / 9 + t * 3; const r = Math.min(w, h) * (.2 + .15 * clamp01(t / .5)); const x = w / 2 + Math.cos(a) * r * 1.6; const y = h / 2 + Math.sin(a) * r - t * 20; const g = ctx.createRadialGradient(x, y, 0, x, y, 16); g.addColorStop(0, 'rgba(180,230,255,.95)'); g.addColorStop(.5, 'rgba(100,170,255,.5)'); g.addColorStop(1, 'rgba(100,170,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill(); }
    ctx.restore();
  };
  function gumihoForest(ctx, w, h) { // 구미호 숲: a moonlit bamboo grove, blue fox fires among the stems
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0e1a2a'); g.addColorStop(1, '#1a2a22'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const mg = ctx.createRadialGradient(w * .8, h * .18, 4, w * .8, h * .18, 60); mg.addColorStop(0, 'rgba(255,248,220,.9)'); mg.addColorStop(.3, 'rgba(255,248,220,.35)'); mg.addColorStop(1, 'rgba(255,248,220,0)'); ctx.fillStyle = mg; ctx.fillRect(0, 0, w, h);
    const R = rng(61);
    for (let i = 0; i < 14; i += 1) { const x = R() * w; ctx.fillStyle = `rgba(40,80,50,${.5 + R() * .4})`; ctx.fillRect(x, 0, 7, h); ctx.fillStyle = 'rgba(20,40,25,.6)'; for (let y = 30 + R() * 30; y < h; y += 50) ctx.fillRect(x - 1, y, 9, 3); }
    for (let i = 0; i < 6; i += 1) { const x = R() * w; const y = h * (.4 + R() * .5); const fg = ctx.createRadialGradient(x, y, 0, x, y, 12); fg.addColorStop(0, 'rgba(150,210,255,.8)'); fg.addColorStop(1, 'rgba(150,210,255,0)'); ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(x, y, 12, 0, TAU); ctx.fill(); }
  }

  function previewRow(ctx, w, h, skinId, keepBackdrop) {
    const d = S.def(skinId); if (!keepBackdrop) { ctx.fillStyle = '#0b1324'; ctx.fillRect(0, 0, w, h); }
    [[.08, '1차 · 민수', '바다에서 먹어요'], [.5, '2차 · 지은', '여름에 많이 먹죠']].forEach(([fy, who, text]) => {
      const y = h * fy; const rh = h * .36; const x = 12; const rw = w - 24;
      ctx.fillStyle = d.text.bg.startsWith('rgba') ? '#0a3250' : d.text.bg; ctx.beginPath(); ctx.roundRect(x, y, rw, rh, 10); ctx.fill();
      ctx.strokeStyle = d.row.border.split(' ').pop(); ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, rw, rh, 10); ctx.stroke();
      ctx.fillStyle = d.text.who; ctx.font = '900 12px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(who, x + 10, y + rh / 2 + 1);
      ctx.fillStyle = d.text.color; ctx.font = `700 13px ${d.row.fontFamily === 'inherit' ? 'sans-serif' : d.row.fontFamily}`; ctx.fillText(text, x + 92, y + rh / 2 + 1);
    });
    if (d.fx) { ctx.save(); d.fx(ctx, w, h, .5); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) { S.def(skinId).panel(ctx, w, h); ctx.globalAlpha = .7; previewRow(ctx, w, h, 'liar_c1', true); ctx.globalAlpha = 1; }
  const piece = (def) => ({ ...def, preview: previewRow });
  const theme = (panel, frame) => ({ panel, frame, preview: previewTheme });
  S.define({
    liar_c1: piece(badge), liar_c2: piece(wanted), liar_c3: piece(tarot), liar_c4: piece(envelope), liar_c5: piece(cassette),
    liar_p1: piece(agent), liar_p2: piece(royal), liar_p3: piece(hologram),
    liar_t1: theme(interrogation, { borderColor: '#9aa4b2', boxShadow: 'inset 0 0 0 3px #20252c, 0 0 0 2px #9aa4b2' }),
    liar_t2: theme(masquerade, { borderColor: '#f0c14e', boxShadow: 'inset 0 0 0 3px #3a0f2e, 0 0 14px rgba(240,193,78,.4)' }),
    liar_l1: piece(king),
    liar_l2: piece(lamp),
    // v1.10.90 스킨 2배
liar_c6: piece(loveLetter), liar_c7: piece(paperPlane), liar_c8: piece(fortune), liar_c9: piece(classNote), liar_c10: piece(explorer),
    liar_p4: piece(spyRadio), liar_p5: piece(iceCrystal), liar_p6: piece(goldInvite),
    liar_t3: theme(gumihoForest, { borderColor: '#f08a4a', boxShadow: 'inset 0 0 0 3px #10201a, 0 0 14px rgba(150,210,255,.35)' }),
    liar_l3: piece(gumiho), // 구미호 가면 ↔ 구미호 숲
  });
}());
