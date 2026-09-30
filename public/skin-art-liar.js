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
  });
}());
