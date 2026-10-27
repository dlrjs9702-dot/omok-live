// G-틀③ 게임방 소리 (gamecenter-notes docs/gamehall-audit-20261025.md): a stone set down, a card played, the yut sticks
// falling, a bell, a win and a loss -- made with Web Audio (no sound files), on by default, the same setting as 한판마당's
// (localStorage gc.settings.sound, reflex/js/store.js)
(() => {
  const KEY = 'gc.settings';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const isOn = () => read().sound !== false;
  function setOn(on) { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), sound: Boolean(on) })); } catch {} }
  let ac = null; let out = null; let noiseBuf = null;
  function ctx() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ac = new AC(); out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function tone({ f = 440, f2 = null, type = 'sine', dur = 0.12, vol = 0.25, at = 0 }) {
    const a = ctx(); if (!a) return; const t = a.currentTime + at;
    const o = a.createOscillator(); const g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise({ dur = 0.08, vol = 0.25, from = 3000, to = 600, at = 0 }) {
    const a = ctx(); if (!a) return; const t = a.currentTime + at;
    const s = a.createBufferSource(); const f = a.createBiquadFilter(); const g = a.createGain(); s.buffer = noiseBuf; f.type = 'lowpass';
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur);
  }
  // (C4 P2-2: iPhone Safari lets a context sound only if it is resumed inside a touch's handler -- the first touch or key
  // makes it and plays a silent buffer, sound on or off; the sounds themselves come after a server's answer)
  const UNLOCK = ['pointerdown', 'touchend', 'keydown'];
  function unlock() {
    const a = ctx(); if (!a) return;
    try { const s = a.createBufferSource(); s.buffer = a.createBuffer(1, 1, a.sampleRate); s.connect(a.destination); s.start(0); } catch {}
    if (a.state === 'running') UNLOCK.forEach((t) => document.removeEventListener(t, unlock, true));
  }
  UNLOCK.forEach((t) => document.addEventListener(t, unlock, true));
  const NOTE = (n) => 440 * 2 ** ((n - 69) / 12);
  const SOUNDS = {
    stone: () => { noise({ dur: 0.05, vol: 0.35, from: 2600, to: 900 }); tone({ f: 340, f2: 220, dur: 0.07, vol: 0.18, type: 'triangle' }); }, // (탁: a stone on wood)
    card: () => { noise({ dur: 0.06, vol: 0.3, from: 5000, to: 1800 }); tone({ f: 180, f2: 120, dur: 0.05, vol: 0.12 }); }, // (착: a card down)
    yut: () => [0, 0.09, 0.15, 0.24].forEach((at) => { noise({ dur: 0.05, vol: 0.28, from: 2200, to: 700, at }); tone({ f: 260 + Math.random() * 80, dur: 0.05, vol: 0.12, type: 'triangle', at }); }),
    bell: () => { tone({ f: 1568, dur: 0.6, vol: 0.18 }); tone({ f: 2349, dur: 0.45, vol: 0.08, at: 0.01 }); },
    turn: () => tone({ f: 880, f2: 1175, dur: 0.12, vol: 0.12, type: 'triangle' }),
    win: () => [60, 64, 67, 72, 76].forEach((n, i) => tone({ f: NOTE(n), dur: 0.22, vol: 0.15, type: 'triangle', at: i * 0.08 })),
    lose: () => [64, 60, 55, 48].forEach((n, i) => tone({ f: NOTE(n), dur: 0.22, vol: 0.13, at: i * 0.11 })),
    end: () => [64, 64].forEach((n, i) => tone({ f: NOTE(n), dur: 0.16, vol: 0.13, type: 'triangle', at: i * 0.14 })),
    stamp: () => { tone({ f: 120, f2: 55, dur: 0.22, vol: 0.32 }); noise({ dur: 0.12, vol: 0.3, from: 1800, to: 300 }); }, // (G-고스톱ⓔ 쾅: 뻑·쪽·따닥·판쓸이·폭탄·흔들기·스톱)
    right: () => [76, 83].forEach((n, i) => tone({ f: NOTE(n), dur: 0.2, vol: 0.14, at: i * 0.07 })), // (G-게임별 다빈치 맞힘: 딩동 up)
    wrong: () => tone({ f: 196, f2: 150, dur: 0.28, vol: 0.18, type: 'triangle' }), // (틀림: a low 둥)
    flip: (i = 0) => { noise({ dur: 0.035, vol: 0.22, from: 4200, to: 1600 }); tone({ f: 880 + Math.min(i, 12) * 70, dur: 0.045, vol: 0.08, type: 'triangle' }); }, // (G-게임별 v187 오델로 착: a disc turned -- a little higher each)
    go: () => [67, 74].forEach((n, i) => tone({ f: NOTE(n), dur: 0.18, vol: 0.18, type: 'triangle', at: i * 0.1 })), // (고!: two notes up)
  };
  let played = []; // (tests: what was asked to sound, while on)
  function play(kind, arg) { if (!isOn() || !SOUNDS[kind] || document.hidden) return false; played = [...played.slice(-19), kind]; try { SOUNDS[kind](arg); } catch {} return true; }
  // (G-게임별 v187) when a move's sounds fall, in ms after it comes in -- the board's own motion (app.js drawOmokBoard 300 ms
  // set-down, drawConnect4Board 260 + 70 per row fall, drawOthelloBoard 260 ms drop and each flip edge-on at 200 + 66 + 110 n):
  // [[ms, kind, arg]]; reduced motion draws it at once, so one sound at once
  const STONES = new Set(['omok', 'omok2v2', 'othello', 'connect4', 'dots']);
  function landPlan(game, last, reduced = false) {
    if (!STONES.has(game)) return [[0, 'card']];
    if (reduced || !last || game === 'dots') return [[0, 'stone']];
    if (game === 'connect4') return [[240 + 70 * (Number(last.y) || 0), 'stone']];
    if (game === 'othello') return [[240, 'stone'], ...(last.flippedCells || []).map((_, i) => [266 + 110 * i, 'flip', i])];
    return [[260, 'stone']];
  }
  function playPlan(plan) { for (const [ms, kind, arg] of plan) if (ms > 0) setTimeout(() => play(kind, arg), ms); else play(kind, arg); }
  window.RoomSound = { play, isOn, setOn, landPlan, playPlan, played: () => played.slice() };
})();
