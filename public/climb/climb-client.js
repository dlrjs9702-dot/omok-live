// v1.9.4 상시 등반 도전 screen: draws the course, runs the shared simulation ahead of the server for instant
// controls and sends the inputs (never a position or a height). The server's state always wins: each answer
// replaces the local state and the inputs it has not seen yet are replayed on top. Other climbers are drawn as
// faint figures only; they never block anyone.
(function () {
  const S = window.ClimbSim;
  if (!S) return;
  const { BIT, TICKS_PER_SECOND } = S;
  const TICK_MS = 1000 / TICKS_PER_SECOND;
  const SECTION_SKY = [['#bfe6ff', '#e8f6ff'], ['#c8e8c0', '#eef8e8'], ['#d8e4f0', '#f2f6fb'], ['#ffe2c4', '#fff4e6'], ['#d6f0e8', '#f0fbf6'],
    ['#ffd9d9', '#fff0f0'], ['#cfd8ff', '#eef1ff'], ['#e8d8ff', '#f6efff'], ['#d9eefc', '#ffffff'], ['#2a3566', '#5b6bb0']];
  const SECTION_GROUND = ['#7cc46a', '#a9774f', '#9aa3ad', '#c58b5a', '#6fb8a0', '#c96b6b', '#8a96d8', '#a985d8', '#b8d4ea', '#e8c56a'];

  let api = null; let els = null; let onExit = null;
  let state = null; let climbId = null; let pending = []; let others = [];
  let raf = 0; let last = 0; let acc = 0; let sending = false; let lastSend = 0; let camY = 0; let running = false; let ending = false;
  const keys = new Set();
  const tapped = new Set(); // keys pressed and released between two ticks still count once (a quick Space tap jumps)

  const held = (key) => keys.has(key) || tapped.has(key);
  const inputNow = () => { const bits = (held('ArrowLeft') ? BIT.left : 0) | (held('ArrowRight') ? BIT.right : 0) | (held(' ') ? BIT.jump : 0) | (held('ArrowUp') ? BIT.up : 0) | (held('ArrowDown') ? BIT.down : 0); tapped.clear(); return bits; };
  const onKey = (down) => (event) => {
    if (!running || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '')) return;
    event.preventDefault();
    if (down) { keys.add(event.key); tapped.add(event.key); } else keys.delete(event.key);
  };
  const keydown = onKey(true); const keyup = onKey(false); const blur = () => { keys.clear(); tapped.clear(); };

  // Send the inputs the server has not seen, starting exactly at its tick. One request at a time.
  async function flush(force = false) {
    if (sending || !pending.length || (!force && performance.now() - lastSend < 100)) return;
    sending = true; lastSend = performance.now();
    const batch = pending.slice(0, 60);
    try {
      const data = await api('/api/climb/input', { method: 'POST', body: JSON.stringify({ tick: batch[0].tick, inputs: batch.map((p) => p.input) }) });
      const server = data.state;
      pending = pending.filter((p) => p.tick >= server.tick); // the server has these (or skipped them: resend from its tick)
      if (pending.length && pending[0].tick !== server.tick) pending = []; // a gap: drop and follow the server
      const replay = { ...server };
      for (const p of pending) S.step(replay, p.input);
      state = replay; others = data.others || [];
    } catch (error) {
      if (error.status === 409) { stop(); els.status.textContent = '등반이 끝났거나 다른 창에서 이어 하고 있습니다.'; }
    } finally { sending = false; }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    acc += Math.min(250, now - (last || now)); last = now;
    while (acc >= TICK_MS && state && !ending) {
      const input = inputNow();
      pending.push({ tick: state.tick, input });
      S.step(state, input);
      acc -= TICK_MS;
      if (pending.length > 240) pending = pending.slice(-240);
    }
    flush();
    draw();
  }

  // ---- drawing ----
  function draw() {
    const c = els.canvas; const ctx = c.getContext('2d'); const w = c.width; const h = c.height;
    const scale = w / (S.W + 2); const ox = scale; const viewH = h / scale;
    camY += ((state.y - viewH * 0.38) - camY) * 0.15; camY = Math.max(-1, camY);
    const toX = (x) => ox + x * scale; const toY = (y) => h - (y - camY) * scale;
    const sec = Math.min(9, Math.floor(Math.max(0, state.y) / 300));
    const sky = ctx.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, SECTION_SKY[sec][0]); sky.addColorStop(1, SECTION_SKY[sec][1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    // far parallax hills
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    for (let i = 0; i < 6; i += 1) { const x = ((i * 220 - camY * 3) % (w + 300) + w + 300) % (w + 300) - 150; ctx.beginPath(); ctx.arc(x, h * 0.3 + (i % 3) * 60, 40 + (i % 2) * 20, 0, Math.PI * 2); ctx.fill(); }
    const tick = state.tick; const y0 = camY - 2; const y1 = camY + viewH + 2;
    // gusts
    for (const g of S.COURSE.gusts) {
      const push = S.gustAt(g, tick); if (!push || g.y1 < y0 || g.y0 > y1) continue;
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2;
      for (let k = 0; k < 14; k += 1) { const yy = Math.max(g.y0, y0) + ((k * 1.7 + tick * 0.02) % (Math.min(g.y1, y1) - Math.max(g.y0, y0))); const xx = ((k * 3.1 + tick * 0.25 * push) % S.W + S.W) % S.W; ctx.beginPath(); ctx.moveTo(toX(xx), toY(yy)); ctx.lineTo(toX(xx + push * 0.5), toY(yy)); ctx.stroke(); }
    }
    // ladders and ropes
    for (const l of S.COURSE.ladders) {
      if (l.y1 < y0 || l.y0 > y1) continue;
      if (l.kind === 'rope') { ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3; ctx.beginPath(); for (let y = l.y0; y <= l.y1; y += 0.5) { const x = toX(l.x + Math.sin(y * 1.3 + tick * 0.05) * 0.06); if (y === l.y0) ctx.moveTo(x, toY(y)); else ctx.lineTo(x, toY(y)); } ctx.stroke(); }
      else { ctx.strokeStyle = '#8a5a3b'; ctx.lineWidth = 3; for (const dx of [-0.3, 0.3]) { ctx.beginPath(); ctx.moveTo(toX(l.x + dx), toY(l.y0)); ctx.lineTo(toX(l.x + dx), toY(l.y1)); ctx.stroke(); } ctx.lineWidth = 2; for (let y = l.y0 + 0.3; y < l.y1; y += 0.45) { ctx.beginPath(); ctx.moveTo(toX(l.x - 0.3), toY(y)); ctx.lineTo(toX(l.x + 0.3), toY(y)); ctx.stroke(); } }
    }
    // platforms
    for (const p of S.COURSE.platforms) {
      if (p.y < y0 - 3 || p.y > y1 + 3) continue;
      const q = S.platformAt(p, tick); const s = Math.min(9, Math.floor(p.y / 300));
      const x = toX(q.x0); const width = (q.x1 - q.x0) * scale; const top = toY(q.y);
      ctx.fillStyle = p.shelf ? '#8a6a4a' : '#a8826a'; ctx.fillRect(x, top, width, (p.shelf ? 0.45 : 0.32) * scale);
      ctx.fillStyle = p.move ? '#ffd23f' : SECTION_GROUND[s]; ctx.fillRect(x, top - 3, width, 6);
      if (p.shelf && p.y > 0) { ctx.fillStyle = '#4a3828'; ctx.font = '800 14px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${p.y.toLocaleString('ko-KR')}m`, toX(0.3), top + 0.45 * scale + 14); }
      if (p.summit) { ctx.strokeStyle = '#4a3828'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(toX(S.W / 2), top); ctx.lineTo(toX(S.W / 2), top - 3 * scale); ctx.stroke(); ctx.fillStyle = '#e83c46'; ctx.beginPath(); ctx.moveTo(toX(S.W / 2), top - 3 * scale); ctx.lineTo(toX(S.W / 2 + 1.4), top - 2.6 * scale); ctx.lineTo(toX(S.W / 2), top - 2.2 * scale); ctx.fill(); }
    }
    // rolling balls
    for (const b of S.COURSE.balls) {
      if (b.cy < y0 || b.cy > y1) continue;
      const q = S.ballAt(b, tick); ctx.fillStyle = '#d64545'; ctx.beginPath(); ctx.arc(toX(q.x), toY(q.y), q.r * scale, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a1f1f'; ctx.lineWidth = 2; ctx.stroke();
    }
    // other climbers: faint, never in the way
    ctx.globalAlpha = 0.4;
    for (const o of others) { drawClimber(ctx, toX(o.x), toY(o.y), scale, '#94a3b8'); ctx.fillStyle = '#1f2937'; ctx.font = '800 12px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(o.name, toX(o.x), toY(o.y) - S.HEIGHT * scale - 6); }
    ctx.globalAlpha = 1;
    drawClimber(ctx, toX(state.x), toY(state.y), scale, state.stun > 0 ? '#ff8a8a' : '#2563eb');
    // altitude gauge on the right edge
    const gx = w - 10; ctx.fillStyle = 'rgba(15,23,42,.35)'; ctx.fillRect(gx - 3, 12, 6, h - 24);
    ctx.fillStyle = '#fbbf24'; const gy = h - 12 - (h - 24) * (state.y / S.TOP); ctx.beginPath(); ctx.arc(gx, gy, 6, 0, Math.PI * 2); ctx.fill();
    // HUD (DOM, fixed over the canvas) and the end button
    const meters = S.altitude(state);
    els.hud.textContent = `현재 ${meters.toLocaleString('ko-KR')}m`;
    els.end.disabled = !S.isSafe(state) || ending;
  }
  function drawClimber(ctx, x, footY, scale, color) {
    const bw = S.HALF_W * 2 * scale; const bh = S.HEIGHT * scale;
    ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x - bw / 2, footY - bh * 0.62, bw, bh * 0.62, bw * 0.3); ctx.fill();
    ctx.fillStyle = '#ffe0c4'; ctx.beginPath(); ctx.arc(x, footY - bh * 0.78, bw * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a3326'; ctx.beginPath(); ctx.arc(x, footY - bh * 0.82, bw * 0.56, Math.PI, Math.PI * 2); ctx.fill();
  }

  // ---- lifecycle ----
  async function begin(restart) {
    els.status.textContent = '';
    els.result.classList.add('hidden');
    stop(); running = true; // keys held while the screen opens already count
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur);
    els.canvas.focus({ preventScroll: true });
    let data;
    try { data = await api('/api/climb/start', { method: 'POST', body: JSON.stringify({ restart: Boolean(restart) }) }); } catch (error) { stop(); throw error; }
    climbId = data.active.id; state = { ...data.active.state }; pending = []; others = []; ending = false;
    camY = state.y - 6; last = 0; acc = 0;
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false; keys.clear(); cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur);
  }
  async function finish() {
    if (!S.isSafe(state) || ending) return;
    ending = true; keys.clear();
    while (pending.length) { await flush(true); if (sending) await new Promise((r) => setTimeout(r, 30)); } // the server needs every input first
    try {
      const data = await api('/api/climb/end', { method: 'POST', body: '{}' });
      stop();
      els.resultTitle.textContent = `${data.altitude.toLocaleString('ko-KR')}m 기록`;
      els.resultDetail.textContent = `${data.delta > 0 ? `+${data.delta.toLocaleString('ko-KR')}P · ` : ''}오늘 최고 ${data.best.toLocaleString('ko-KR')}m · 이번 주 최고 ${data.weekBest.toLocaleString('ko-KR')}m`;
      els.result.classList.remove('hidden');
    } catch (error) {
      ending = false; els.status.textContent = error.message;
    }
  }
  async function leave() { // back to the lobby; the climb waits (no record) until I come back or start over
    if (running) { keys.clear(); await flush(true); }
    stop(); onExit?.();
  }

  window.ClimbClient = {
    mount(options) {
      ({ api } = options); onExit = options.onExit;
      els = { canvas: options.canvas, hud: options.hud, end: options.endButton, status: options.status, result: options.result, resultTitle: options.resultTitle, resultDetail: options.resultDetail };
      els.end.addEventListener('click', finish);
      options.leaveButton.addEventListener('click', leave);
      options.againButton.addEventListener('click', () => begin(true));
      options.lobbyButton.addEventListener('click', () => { stop(); onExit?.(); });
    },
    begin, stop, leave,
    debug: () => (state ? { x: state.x, y: state.y, tick: state.tick, safe: S.isSafe(state), altitude: S.altitude(state), climbId, pending: pending.length, others: others.length, running } : null),
  };
}());
