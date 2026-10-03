// 스무고개 skins (v1.7.39): how a question + answer pair looks (by the asker's skin), the Q/A tags, a short effect
// when a new answer arrives, and the room theme (the panel's backdrop). Text stays at least 4.5:1 on its background.
(function () {
  const S = window.SkinLooks;
  if (!S) return;
  const { TAU, clamp01, rng, starPath } = S.h;
  const tile = (key, w, h, draw) => S.h.img(key, w, h, draw);

  // pair = CSS for the list item, color = its text, tagQ/tagA = the Q and A badges
  const look = (bg, image, border, color, tagQ, tagA, extra = {}, font = 'inherit') => ({
    pair: { backgroundColor: bg, backgroundImage: image, border: `1.5px solid ${border}`, color, fontFamily: font, ...extra }, text: { color, bg }, tagQ, tagA,
  });
  const tag = (bg, color) => ({ backgroundColor: bg, color });

  // ---- commons ----
  const memo = look('#fff6b8', tile('tq-memo', 40, 28, (c, w, h) => { c.strokeStyle = 'rgba(80,120,190,.35)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, h - 1); c.lineTo(w, h - 1); c.stroke(); }), '#d9c35c', '#2b2410', tag('#7a5c00', '#fff'), tag('#2b5a2b', '#fff'), {}, '"Segoe Print","Comic Sans MS",cursive');
  const news = look('#efe8d6', tile('tq-news', 30, 30, (c, w, h) => { c.fillStyle = 'rgba(60,50,30,.08)'; for (let y = 4; y < h; y += 5) c.fillRect(2, y, w - 4, 1.2); }), '#b9ad8a', '#1d1a12', tag('#1d1a12', '#efe8d6'), tag('#7a1f1f', '#fff'), {}, 'Georgia,"Times New Roman",serif');
  const radio = look('#2f3a2b', tile('tq-radio', 20, 20, (c) => { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, 0, 20, 2); }), '#8fa37a', '#e6f2d8', tag('#e0a81b', '#1b1b10'), tag('#6fd06f', '#0f1f0f'), {}, '"Consolas","Courier New",monospace');
  const specimen = look('#eaf6f3', tile('tq-spec', 22, 22, (c, w, h) => { c.strokeStyle = 'rgba(20,120,110,.22)'; c.strokeRect(.5, .5, w - 1, h - 1); }), '#5bb5aa', '#0d3a35', tag('#0d6b60', '#fff'), tag('#7a3b9a', '#fff'));
  const cipher = look('#e7d9b7', tile('tq-cipher', 60, 40, (c, w, h) => { c.fillStyle = 'rgba(90,60,20,.10)'; c.font = 'bold 12px monospace'; c.fillText('ᚠ ᚢ ᚦ ᛟ ᚱ', 4, 14); c.fillText('ᛗ ᛚ ᛞ ᚷ ᛈ', 10, 32); }), '#a48a52', '#2a1d08', tag('#5a3a10', '#fff'), tag('#8c1d1d', '#fff'), {}, 'Georgia,serif');

  // ---- premiums ----
  const crystal = look('#2a1b4d', tile('tq-crystal', 40, 40, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * .7); g.addColorStop(0, 'rgba(190,140,255,.35)'); g.addColorStop(1, 'rgba(190,140,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), '#9b72ff', '#f1e8ff', tag('#c7a8ff', '#1f1040'), tag('#ffd86b', '#1f1040'), { boxShadow: '0 0 12px rgba(155,114,255,.45)' });
  const decoder = look('#0f3a3a', tile('tq-decoder', 24, 24, (c, w, h) => { c.strokeStyle = 'rgba(90,240,220,.18)'; c.beginPath(); c.arc(w / 2, h / 2, 9, 0, TAU); c.stroke(); }), '#4fd9c8', '#dffdf8', tag('#4fd9c8', '#073030'), tag('#ffd86b', '#073030'), {}, '"Consolas",monospace');
  const holo = look('rgba(10,50,80,.85)', tile('tq-holo', 8, 6, (c, w) => { c.fillStyle = 'rgba(110,220,255,.16)'; c.fillRect(0, 0, w, 2); }), '#4fd0ff', '#e3f8ff', tag('#4fd0ff', '#04202e'), tag('#ffe066', '#04202e'), { boxShadow: '0 0 12px rgba(79,208,255,.45), inset 0 0 10px rgba(79,208,255,.2)' });
  const sparkle = (col) => (ctx, w, h, t) => { const R = rng(3); for (let i = 0; i < 10; i += 1) { ctx.fillStyle = `rgba(${col},${Math.sin(clamp01(t * 1.4 - R() * .4) * Math.PI)})`; starPath(ctx, 50 + R() * (w - 100), 40 + R() * (h - 80), 3 + R() * 4, 1, 4); ctx.fill(); } };
  crystal.fx = sparkle('220,190,255'); decoder.fx = sparkle('120,255,235'); holo.fx = (ctx, w, h, t) => { ctx.strokeStyle = `rgba(110,220,255,${(1 - t) * .9})`; ctx.lineWidth = 3; ctx.strokeRect(40 - t * 10, 30 - t * 6, w - 80 + t * 20, h - 60 + t * 12); };

  // ---- legend: 진실의 문 -- every answered question adds to the door's seal; the right answer opens it ----
  const door = look('#2b1d10', tile('tq-door', 60, 44, (c, w, h) => { c.strokeStyle = 'rgba(224,178,84,.35)'; c.strokeRect(3, 3, w - 6, h - 6); c.beginPath(); c.arc(w - 12, h / 2, 3, 0, TAU); c.stroke(); }), '#e0b254', '#fff1cf', tag('#e0b254', '#2b1d10'), tag('#9fe3b0', '#0f2a16'), { boxShadow: '0 0 10px rgba(224,178,84,.4)' }, 'Georgia,serif');
  door.fx = (ctx, w, h, t) => { ctx.strokeStyle = `rgba(255,222,140,${(1 - t) * .9})`; ctx.lineWidth = 3; for (let k = 0; k < 2; k += 1) { const u = clamp01(t * 1.3 - k * .2); ctx.beginPath(); ctx.arc(w / 2, h / 2, 10 + u * (w * .3), 0, TAU); ctx.globalAlpha = 1 - u; ctx.stroke(); ctx.globalAlpha = 1; } };
  door.win = (ctx, w, h, t) => { // two door leaves swing open over the panel, light pours out
    const k = clamp01(t * 1.2); const leaf = (w * .5) * (1 - k); ctx.fillStyle = `rgba(43,29,16,${1 - k * .9})`; ctx.fillRect(0, 0, leaf, h); ctx.fillRect(w - leaf, 0, leaf, h);
    const g = ctx.createLinearGradient(w / 2 - 80, 0, w / 2 + 80, 0); g.addColorStop(0, 'rgba(255,230,150,0)'); g.addColorStop(.5, `rgba(255,236,170,${Math.sin(k * Math.PI) * .85})`); g.addColorStop(1, 'rgba(255,230,150,0)'); ctx.fillStyle = g; ctx.fillRect(w / 2 - 80, 0, 160, h);
  };

  // v1.9.1 legend standard: `special` when this asker's guess is the round's right answer (door.win above opens the
  // door), `win` over the panel when the game ends with this player among the final winners.
  door.special = door.win;
  door.win = (ctx, w, h, t) => { // the door stands open and a golden key turns in a beam of light
    const k = clamp01(t / .5); const cx = w / 2; const cy = h / 2;
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    const g = ctx.createLinearGradient(cx, 0, cx, h); g.addColorStop(0, `rgba(255,236,170,${.55 * k})`); g.addColorStop(1, 'rgba(255,236,170,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx - 40, 0); ctx.lineTo(cx + 40, 0); ctx.lineTo(cx + 40 + w * .25 * k, h); ctx.lineTo(cx - 40 - w * .25 * k, h); ctx.closePath(); ctx.fill();
    ctx.translate(cx, cy); ctx.rotate((1 - k) * Math.PI); ctx.fillStyle = '#e0b254'; ctx.strokeStyle = '#6b4a14'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-50, 0, 22, 0, TAU); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#2b1d10'; ctx.beginPath(); ctx.arc(-50, 0, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e0b254'; ctx.fillRect(-30, -6, 90, 12); ctx.strokeRect(-30, -6, 90, 12); ctx.fillRect(40, 6, 10, 16); ctx.fillRect(54, 6, 8, 12);
    ctx.restore();
  };

  // ---- legend 2 (v1.9.1): 골든 버저 ↔ TV 퀴즈쇼 -- a stage card with marquee bulbs; the right answer slams the buzzer ----
  const buzzer = look('#2a0f5a', tile('tq-buzzer', 36, 44, (c, w, h) => { c.fillStyle = 'rgba(255,214,90,.55)'; for (const y of [3, h - 3]) for (let x = 6; x < w; x += 12) { c.beginPath(); c.arc(x, y, 1.8, 0, TAU); c.fill(); } }), '#ffd65a', '#fff6d6',
    tag('#ffd65a', '#2a0f5a'), tag('#5fe3ff', '#0b1a3a'), { boxShadow: '0 0 12px rgba(255,214,90,.35), inset 0 0 0 1px rgba(255,214,90,.4)' });
  buzzer.fx = (ctx, w, h, t) => { // the marquee bulbs blink around the new answer
    const n = 18; for (let i = 0; i < n; i += 1) { const on = (i + Math.floor(t * 12)) % 3 === 0; const u = i / n; const x = 40 + (w - 80) * u; ctx.fillStyle = on ? `rgba(255,236,150,${1 - t})` : `rgba(255,214,90,${(1 - t) * .3})`; for (const y of [30, h - 30]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill(); } }
  };
  buzzer.special = (ctx, w, h, t) => { // a big golden buzzer is slammed, a spotlight and a ring of light burst out
    const cx = w / 2; const cy = h * .55; const press = Math.sin(clamp01(t / .25) * Math.PI) * 10; const R = Math.min(w, h) * .14;
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .8) / .2);
    const sp = ctx.createRadialGradient(cx, cy, R, cx, cy, Math.max(w, h) * .6); sp.addColorStop(0, 'rgba(255,240,180,.4)'); sp.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = sp; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a3f4a'; ctx.beginPath(); ctx.ellipse(cx, cy + R * .45, R * 1.25, R * .45, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd65a'; ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(cx, cy + press, R, R * .55, 0, Math.PI, TAU); ctx.lineTo(cx + R, cy + R * .3); ctx.lineTo(cx - R, cy + R * .3); ctx.closePath(); ctx.fill(); ctx.stroke();
    const ring = clamp01((t - .2) / .6); if (ring > 0 && ring < 1) { ctx.strokeStyle = `rgba(255,236,150,${1 - ring})`; ctx.lineWidth = 8 * (1 - ring) + 1; ctx.beginPath(); ctx.ellipse(cx, cy, R * (1.2 + ring * 3), R * (.6 + ring * 1.5), 0, 0, TAU); ctx.stroke(); }
    ctx.restore();
  };
  buzzer.win = (ctx, w, h, t) => { // marquee bulbs chase round the whole panel and a trophy rises in the spotlight
    const n = 40; const per = 2 * (w + h); ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .85) / .15);
    for (let i = 0; i < n; i += 1) { const d = (i / n) * per; const [x, y] = d < w ? [d, 8] : d < w + h ? [w - 8, d - w] : d < 2 * w + h ? [w - (d - w - h), h - 8] : [8, h - (d - 2 * w - h)]; const on = (i + Math.floor(t * 20)) % 4 < 2; ctx.fillStyle = on ? '#fff0a8' : 'rgba(255,214,90,.35)'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); }
    const rise = clamp01((t - .15) / .45); const cx = w / 2; const cy = h * (1.1 - .55 * rise); const s = Math.min(w, h) * .16;
    ctx.fillStyle = '#ffd65a'; ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy - s); ctx.quadraticCurveTo(cx + s, cy + s * .4, cx, cy + s * .5); ctx.quadraticCurveTo(cx - s, cy + s * .4, cx - s, cy - s); ctx.fill(); ctx.stroke();
    ctx.fillRect(cx - s * .15, cy + s * .5, s * .3, s * .5); ctx.fillRect(cx - s * .55, cy + s, s * 1.1, s * .25); ctx.strokeRect(cx - s * .55, cy + s, s * 1.1, s * .25);
    ctx.fillStyle = '#ffffff'; starPath(ctx, cx, cy - s * .35, s * .3, s * .12, 5); ctx.fill();
    ctx.restore();
  };

  // ---- room themes: panel backdrop ----
  function office(ctx, w, h) { // 탐정 사무소: dark wood and a green lamp glow
    ctx.fillStyle = '#2a1d12'; ctx.fillRect(0, 0, w, h); const R = rng(51); ctx.strokeStyle = 'rgba(0,0,0,.25)';
    for (let y = 0; y < h; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(w * .3, y + R() * 5, w * .7, y - R() * 5, w, y); ctx.stroke(); }
    const g = ctx.createRadialGradient(w * .2, 0, 10, w * .2, 0, w * .7); g.addColorStop(0, 'rgba(120,220,150,.28)'); g.addColorStop(1, 'rgba(120,220,150,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function quizShow(ctx, w, h) { // TV 퀴즈쇼: stage colours and spotlights
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#2a0f5a'); g.addColorStop(1, '#0f2a7a'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (const [x, col] of [[.2, '255,220,120'], [.8, '120,220,255']]) { const s = ctx.createLinearGradient(w * x, 0, w * (x + (x < .5 ? .3 : -.3)), h); s.addColorStop(0, `rgba(${col},.35)`); s.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = s; ctx.beginPath(); ctx.moveTo(w * x - 10, 0); ctx.lineTo(w * x + 10, 0); ctx.lineTo(w * (x + (x < .5 ? .35 : -.35)) + 60, h); ctx.lineTo(w * (x + (x < .5 ? .35 : -.35)) - 60, h); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 24; i += 1) { ctx.beginPath(); ctx.arc(10 + i * (w / 23), h - 8, 2.2, 0, TAU); ctx.fill(); }
  }

  function previewPair(ctx, w, h, skinId) {
    const d = S.def(skinId); ctx.fillStyle = '#0b1324'; ctx.fillRect(0, 0, w, h);
    [[.1, '동물인가요?', '예'], [.52, '날 수 있나요?', '아니오']].forEach(([fy, q, a]) => {
      const y = h * fy; const rh = h * .36; const x = 12; const rw = w - 24;
      ctx.fillStyle = d.text.bg.startsWith('rgba') ? '#0a3250' : d.text.bg; ctx.beginPath(); ctx.roundRect(x, y, rw, rh, 8); ctx.fill();
      ctx.strokeStyle = d.pair.border.split(' ').pop(); ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, rw, rh, 8); ctx.stroke();
      ctx.fillStyle = d.tagQ.backgroundColor; ctx.beginPath(); ctx.arc(x + 16, y + rh * .3, 8, 0, TAU); ctx.fill(); ctx.fillStyle = d.tagQ.color; ctx.font = '900 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Q', x + 16, y + rh * .3 + 1);
      ctx.fillStyle = d.tagA.backgroundColor; ctx.beginPath(); ctx.arc(x + 16, y + rh * .72, 8, 0, TAU); ctx.fill(); ctx.fillStyle = d.tagA.color; ctx.fillText('A', x + 16, y + rh * .72 + 1);
      ctx.fillStyle = d.text.color; ctx.font = `700 ${rh * .26}px ${d.pair.fontFamily === 'inherit' ? 'sans-serif' : d.pair.fontFamily}`; ctx.textAlign = 'left'; ctx.fillText(q, x + 32, y + rh * .3 + 1); ctx.fillText(a, x + 32, y + rh * .72 + 1);
    });
    if (d.fx) { ctx.save(); d.fx(ctx, w, h, .5); ctx.restore(); }
  }
  function previewTheme(ctx, w, h, skinId) { S.def(skinId).panel(ctx, w, h); ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.beginPath(); ctx.roundRect(w * .12, h * .18, w * .76, h * .2, 8); ctx.roundRect(w * .12, h * .5, w * .76, h * .2, 8); ctx.fill(); }
  const piece = (def) => ({ ...def, preview: previewPair });
  const theme = (panel) => ({ panel, preview: previewTheme });
  S.define({
    twentyquestions_c1: piece(memo), twentyquestions_c2: piece(news), twentyquestions_c3: piece(radio), twentyquestions_c4: piece(specimen), twentyquestions_c5: piece(cipher),
    twentyquestions_p1: piece(crystal), twentyquestions_p2: piece(decoder), twentyquestions_p3: piece(holo),
    twentyquestions_t1: theme(office), twentyquestions_t2: theme(quizShow),
    twentyquestions_l1: piece({ ...door, legend: true }),
    twentyquestions_l2: piece({ ...buzzer, legend: true }),
  });
}());
