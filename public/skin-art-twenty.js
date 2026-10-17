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

  // ---- v1.10.90 스킨 2배 (IDEAS #future-skins-double): five looks, three premiums, a legend and its room (명탐정 돋보기
  // ↔ 안개 낀 런던). Text keeps at least 4.5:1 on its background.
  const postit = look('#ffd6e6', tile('tq-postit', 40, 40, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(0,0,0,.03)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), '#f09ab8', '#3a1020', tag('#b8245a', '#fff'), tag('#2a6a4a', '#fff'));
  const libraryCard = look('#f6f1e2', tile('tq-library', 40, 26, (c, w, h) => { c.strokeStyle = 'rgba(80,110,170,.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, h - 1); c.lineTo(w, h - 1); c.stroke(); c.strokeStyle = 'rgba(200,50,50,.45)'; c.beginPath(); c.moveTo(6, 0); c.lineTo(6, h); c.stroke(); }), '#b8a98a', '#1f1a10', tag('#6a1f1f', '#fff'), tag('#1f3a6a', '#fff'), {}, 'Georgia,serif');
  const comic = look('#ffffff', tile('tq-comic', 12, 12, (c) => { c.fillStyle = 'rgba(0,0,0,.06)'; c.beginPath(); c.arc(6, 6, 1.6, 0, TAU); c.fill(); }), '#111111', '#111111', tag('#ffd23f', '#111'), tag('#ff4a4a', '#fff'), { boxShadow: '3px 3px 0 #111' }, '"Comic Sans MS","Segoe Print",system-ui,sans-serif');
  const receipt = look('#fbfbf6', tile('tq-receipt', 30, 30, (c, w, h) => { c.fillStyle = 'rgba(0,0,0,.035)'; for (let y = 3; y < h; y += 6) c.fillRect(0, y, w, 1); }), '#9a9a90', '#1a1a1a', tag('#1a1a1a', '#fbfbf6'), tag('#5a5a5a', '#fff'), {}, '"Consolas","Courier New",monospace');
  const graphPaper = look('#f4fbff', tile('tq-graph', 16, 16, (c, w, h) => { c.strokeStyle = 'rgba(60,140,200,.22)'; c.lineWidth = 1; c.strokeRect(.5, .5, w, h); }), '#7ab8e0', '#0f2a40', tag('#1d6aa8', '#fff'), tag('#2a7a3a', '#fff'));
  const scroll = look('#efe0b8', tile('tq-scroll', 40, 40, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * .7); g.addColorStop(0, 'rgba(170,110,240,.18)'); g.addColorStop(1, 'rgba(170,110,240,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }), '#8a5ac0', '#2a1a40', tag('#6a3aa8', '#fff'), tag('#9a6a1a', '#fff'), { boxShadow: '0 0 10px rgba(170,110,240,.35)' }, 'Georgia,serif');
  const starLetter = look('#14204a', tile('tq-starletter', 40, 40, (c, w, h) => { const R = rng(2); for (let i = 0; i < 6; i += 1) { c.fillStyle = `rgba(255,255,255,${.2 + R() * .5})`; c.beginPath(); c.arc(R() * w, R() * h, .6 + R(), 0, TAU); c.fill(); } }), '#ffd86b', '#f2f4ff', tag('#ffd86b', '#14204a'), tag('#8fd3ff', '#14204a'));
  const neonChat = look('#120a1e', tile('tq-neon', 8, 8, (c) => { c.fillStyle = 'rgba(255,62,165,.06)'; c.fillRect(0, 0, 8, 1); }), '#ff3ea5', '#ffe6f6', tag('#ff3ea5', '#120a1e'), tag('#50f0ff', '#120a1e'), { boxShadow: '0 0 12px rgba(255,62,165,.45)' });
  scroll.fx = sparkle('200,150,255'); starLetter.fx = sparkle('255,230,140');
  neonChat.fx = (ctx, w, h, t) => { ctx.save(); ctx.shadowColor = '#ff3ea5'; ctx.shadowBlur = 14; ctx.strokeStyle = `rgba(255,62,165,${(1 - t) * .9})`; ctx.lineWidth = 3; ctx.strokeRect(40, 30, w - 80, h - 60); ctx.restore(); };
  // 명탐정 돋보기 (legend) ↔ 안개 낀 런던 (room)
  const detective = look('#4a3826', tile('tq-tweed', 12, 12, (c) => { c.strokeStyle = 'rgba(255,230,190,.08)'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, 0); c.lineTo(12, 12); c.moveTo(12, 0); c.lineTo(0, 12); c.stroke(); }), '#c8a56a', '#fff3dc', tag('#c8a56a', '#2a1d10'), tag('#9fd8c0', '#102a20'), { boxShadow: 'inset 0 0 0 1px rgba(200,165,106,.4)' }, 'Georgia,serif');
  detective.fx = (ctx, w, h, t) => { // a magnifying glass slides over the new answer
    const cx = 40 + (w - 80) * t; const cy = h / 2; ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .7) / .3);
    ctx.fillStyle = 'rgba(200,230,255,.18)'; ctx.strokeStyle = '#c8a56a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 6; ctx.strokeStyle = '#6a4a26'; ctx.beginPath(); ctx.moveTo(cx + 13, cy + 13); ctx.lineTo(cx + 30, cy + 30); ctx.stroke(); ctx.restore();
  };
  detective.special = (ctx, w, h, t) => { // the right answer: a big lens zooms in and 「정답!」 shows through it
    const k = clamp01(t / .4); const cx = w / 2; const cy = h / 2; const R = Math.min(w, h) * (.12 + .14 * k);
    ctx.save(); ctx.globalAlpha = 1 - clamp01((t - .8) / .2);
    ctx.fillStyle = 'rgba(220,240,255,.55)'; ctx.strokeStyle = '#c8a56a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#6a4a26'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(cx + R * .72, cy + R * .72); ctx.lineTo(cx + R * 1.4, cy + R * 1.4); ctx.stroke();
    ctx.fillStyle = '#2a1d10'; ctx.font = `900 ${Math.round(R * .5)}px Georgia,serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('정답!', cx, cy);
    ctx.restore();
  };
  detective.win = (ctx, w, h, t) => { // footprints cross the panel to a spotlight
    ctx.save(); const n = 10; const on = clamp01(t / .6) * n;
    for (let i = 0; i < n; i += 1) { if (on < i) break; const x = w * (.1 + .08 * i); const y = h * (.75 - .05 * i) + (i % 2 ? -10 : 10); ctx.fillStyle = `rgba(200,165,106,${.8 * (1 - clamp01((t - .85) / .15))})`; ctx.beginPath(); ctx.ellipse(x, y, 6, 10, -.5, 0, TAU); ctx.fill(); }
    const s = clamp01((t - .5) / .4); if (s > 0) { const g = ctx.createRadialGradient(w * .85, h * .3, 0, w * .85, h * .3, w * .25); g.addColorStop(0, `rgba(255,240,190,${.6 * s * (1 - clamp01((t - .85) / .15))})`); g.addColorStop(1, 'rgba(255,240,190,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
    ctx.restore();
  };
  function foggyLondon(ctx, w, h) { // 안개 낀 런던: a cobbled night street, gas lamps and drifting fog
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2a3340'); g.addColorStop(1, '#151a22'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(10,12,18,.8)'; for (let x = 0; x < w; x += 70) { const bh = h * (.35 + ((x * 7) % 30) / 100); ctx.fillRect(x, h * .55 - bh * .5, 60, bh); }
    for (const x of [w * .18, w * .82]) { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x - 2, h * .3, 4, h * .7); const lg = ctx.createRadialGradient(x, h * .3, 2, x, h * .3, 60); lg.addColorStop(0, 'rgba(255,214,140,.55)'); lg.addColorStop(1, 'rgba(255,214,140,0)'); ctx.fillStyle = lg; ctx.fillRect(x - 60, h * .3 - 60, 120, 120); }
    const R = rng(73); for (let i = 0; i < 6; i += 1) { const y = h * (.4 + R() * .5); const fg = ctx.createLinearGradient(0, y - 20, 0, y + 20); fg.addColorStop(0, 'rgba(200,210,220,0)'); fg.addColorStop(.5, 'rgba(200,210,220,.12)'); fg.addColorStop(1, 'rgba(200,210,220,0)'); ctx.fillStyle = fg; ctx.fillRect(0, y - 20, w, 40); }
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
    // v1.10.90 스킨 2배
twentyquestions_c6: piece(postit), twentyquestions_c7: piece(libraryCard), twentyquestions_c8: piece(comic), twentyquestions_c9: piece(receipt), twentyquestions_c10: piece(graphPaper),
    twentyquestions_p4: piece(scroll), twentyquestions_p5: piece(starLetter), twentyquestions_p6: piece(neonChat),
    twentyquestions_t3: theme(foggyLondon),
    twentyquestions_l3: piece({ ...detective, legend: true }), // 명탐정 돋보기 ↔ 안개 낀 런던
  });
}());
