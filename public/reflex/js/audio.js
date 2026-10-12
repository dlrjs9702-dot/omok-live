// Web Audio 합성 효과음 — 별도 음원 파일 없이 동작
import { Settings } from './store.js';

let ac = null, master = null, noiseBuf = null;

function ctx() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.55;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp).connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

// 첫 터치에서 오디오 잠금 해제
export function unlockAudio() { ctx(); }
/** 광고가 나오는 동안 게임 소리 끄기 · 다시 켜기 */
export function muteAll(on) {
  if (!ac) return;
  if (on) ac.suspend().catch(() => {});
  else if (!document.hidden) ac.resume().catch(() => {});
}
export const audioReady = () => ac?.state === 'running';
// 화면이 꺼지거나 다른 앱으로 가면 오디오 엔진을 쉬게 한다 (배터리 절약)
document.addEventListener('visibilitychange', () => {
  if (!ac) return;
  if (document.hidden) ac.suspend().catch(() => {});
  else ac.resume().catch(() => {});
});

function tone({ f = 440, f2 = null, type = 'sine', dur = 0.12, vol = 0.3, at = 0, attack = 0.005 }) {
  const a = ctx();
  if (!a || !Settings.get('sound')) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.25, vol = 0.35, from = 2400, to = 200, at = 0 }) {
  const a = ctx();
  if (!a || !Settings.get('sound')) return;
  const t = a.currentTime + at;
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = noiseBuf;
  f.type = 'lowpass';
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur);
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI → Hz

export const sfx = {
  tap: () => tone({ f: 1100, f2: 900, dur: 0.05, vol: 0.12, type: 'triangle' }),
  ui: () => tone({ f: 700, f2: 1000, dur: 0.07, vol: 0.1, type: 'sine' }),
  score: () => { tone({ f: 988, dur: 0.07, vol: 0.14, type: 'square' }); tone({ f: 1319, dur: 0.12, vol: 0.12, type: 'square', at: 0.06 }); },
  point: () => tone({ f: 880, f2: 1320, dur: 0.09, vol: 0.16, type: 'triangle' }),
  shoot: () => tone({ f: 1400, f2: 500, dur: 0.06, vol: 0.05, type: 'square' }),
  bounce: () => tone({ f: 520, f2: 640, dur: 0.06, vol: 0.18, type: 'sine' }),
  move: () => tone({ f: 320, dur: 0.035, vol: 0.1, type: 'triangle' }),
  rotate: () => tone({ f: 520, f2: 760, dur: 0.05, vol: 0.1, type: 'triangle' }),
  drop: () => { tone({ f: 180, f2: 70, dur: 0.12, vol: 0.3, type: 'sine' }); noise({ dur: 0.08, vol: 0.12, from: 1200, to: 200 }); },
  hit: () => { noise({ dur: 0.3, vol: 0.35 }); tone({ f: 200, f2: 50, dur: 0.3, vol: 0.3, type: 'sawtooth' }); },
  pop: () => { tone({ f: 260, f2: 90, dur: 0.12, vol: 0.35, type: 'sine' }); noise({ dur: 0.06, vol: 0.15, from: 3000, to: 800 }); },
  wrong: () => { tone({ f: 220, dur: 0.12, vol: 0.18, type: 'square' }); tone({ f: 165, dur: 0.18, vol: 0.18, type: 'square', at: 0.1 }); },
  flip: () => noise({ dur: 0.07, vol: 0.12, from: 4000, to: 1500 }),
  flap: () => tone({ f: 400, f2: 700, dur: 0.08, vol: 0.12, type: 'triangle' }),
  clear: () => [72, 76, 79, 84].forEach((n, i) => tone({ f: NOTE(n), dur: 0.14, vol: 0.14, type: 'triangle', at: i * 0.05 })),
  beep: (hi) => tone({ f: hi ? 1320 : 660, dur: 0.12, vol: 0.16, type: 'sine' }),
  goal: () => [67, 71, 74, 79].forEach((n, i) => tone({ f: NOTE(n), dur: 0.16, vol: 0.15, type: 'triangle', at: i * 0.07 })),
  win: () => [60, 64, 67, 72, 76].forEach((n, i) => tone({ f: NOTE(n), dur: 0.22, vol: 0.16, type: 'triangle', at: i * 0.08 })),
  lose: () => [64, 60, 55, 48].forEach((n, i) => tone({ f: NOTE(n), dur: 0.22, vol: 0.14, type: 'sine', at: i * 0.11 })),
  draw: () => [64, 64].forEach((n, i) => tone({ f: NOTE(n), dur: 0.16, vol: 0.14, type: 'triangle', at: i * 0.14 })),
  best: () => [72, 76, 79, 84, 88, 91].forEach((n, i) => tone({ f: NOTE(n), dur: 0.25, vol: 0.13, type: 'triangle', at: i * 0.07 })),
  note: (midi, dur = 0.25, vol = 0.2, type = 'triangle') => tone({ f: NOTE(midi), dur, vol, type }),
  kick: () => tone({ f: 150, f2: 45, dur: 0.18, vol: 0.45, type: 'sine', attack: 0.002 }),
  hat: () => noise({ dur: 0.04, vol: 0.08, from: 9000, to: 6000 }),
};
