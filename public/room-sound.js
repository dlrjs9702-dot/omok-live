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
    go: () => [67, 74].forEach((n, i) => tone({ f: NOTE(n), dur: 0.18, vol: 0.18, type: 'triangle', at: i * 0.1 })), // (고!: two notes up)
  };
  let played = []; // (tests: what was asked to sound, while on)
  function play(kind) { if (!isOn() || !SOUNDS[kind] || document.hidden) return false; played = [...played.slice(-19), kind]; try { SOUNDS[kind](); } catch {} return true; }
  window.RoomSound = { play, isOn, setOn, played: () => played.slice() };
})();
