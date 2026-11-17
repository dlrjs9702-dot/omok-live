// 1.10.331 M4 크리스마스 소리 (gamecenter-notes docs/christmas-boost-20261115.md M4): by the plaza's tree, with the winter
// decor up, a music box plays old carols whose copyright is long over (Jingle Bells 1857, We Wish You a Merry Christmas,
// Silent Night 1818) and a bell rings now and then -- all made with Web Audio (no sound files), louder the nearer one stands
// (nothing past REACH m), under the same 소리 setting as the game rooms (RoomSound / gc.settings.sound).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.XmasMusic = api;
}(typeof self !== 'undefined' ? self : this, () => {
  // [midi note, beats]; a music box an octave up (BOX_UP)
  const C4 = 60; const D4 = 62; const E4 = 64; const F4 = 65; const Fs4 = 66; const G4 = 67; const A4 = 69; const B4 = 71; const C5 = 72; const D5 = 74; const E5 = 76; const F5 = 77;
  const WISH = [[D4, 1], [G4, 1], [G4, 0.5], [A4, 0.5], [G4, 0.5], [Fs4, 0.5], [E4, 1], [E4, 1], [E4, 1], [A4, 1], [A4, 0.5], [B4, 0.5], [A4, 0.5], [G4, 0.5], [Fs4, 1], [D4, 1], [D4, 1],
    [B4, 1], [B4, 0.5], [C5, 0.5], [B4, 0.5], [A4, 0.5], [G4, 1], [E4, 1], [D4, 0.5], [D4, 0.5], [E4, 1], [A4, 1], [Fs4, 1], [G4, 3]];
  const JINGLE_A = [[E4, 1], [E4, 1], [E4, 2], [E4, 1], [E4, 1], [E4, 2], [E4, 1], [G4, 1], [C4, 1.5], [D4, 0.5], [E4, 4]];
  const SONGS = Object.freeze([
    Object.freeze({ id: 'jingle', name: 'Jingle Bells', beat: 0.3, notes: Object.freeze([...JINGLE_A, [F4, 1], [F4, 1], [F4, 1.5], [F4, 0.5], [F4, 1], [E4, 1], [E4, 1], [E4, 0.5], [E4, 0.5], [E4, 1], [D4, 1], [D4, 1], [E4, 1], [D4, 2], [G4, 2],
      ...JINGLE_A, [F4, 1], [F4, 1], [F4, 1], [F4, 1], [F4, 1], [E4, 1], [E4, 1], [E4, 0.5], [E4, 0.5], [G4, 1], [G4, 1], [F4, 1], [D4, 1], [C4, 4]]) }),
    Object.freeze({ id: 'wish', name: 'We Wish You a Merry Christmas', beat: 0.36, notes: Object.freeze([...WISH, /* (good tidings we bring) */ [D4, 1], [G4, 1], [G4, 1], [G4, 1], [Fs4, 2], [Fs4, 1], [G4, 1], [Fs4, 1], [E4, 1], [D4, 2], [A4, 1], [B4, 1], [A4, 1], [G4, 1], [D5, 1], [D4, 1], [D4, 0.5], [D4, 0.5], [E4, 1], [A4, 1], [Fs4, 1], [G4, 3], ...WISH]) }),
    Object.freeze({ id: 'silent', name: 'Silent Night', beat: 0.28, notes: Object.freeze([[G4, 1.5], [A4, 0.5], [G4, 1], [E4, 3], [G4, 1.5], [A4, 0.5], [G4, 1], [E4, 3], [D5, 2], [D5, 1], [B4, 3], [C5, 2], [C5, 1], [G4, 3],
      [A4, 2], [A4, 1], [C5, 1.5], [B4, 0.5], [A4, 1], [G4, 1.5], [A4, 0.5], [G4, 1], [E4, 3], [A4, 2], [A4, 1], [C5, 1.5], [B4, 0.5], [A4, 1], [G4, 1.5], [A4, 0.5], [G4, 1], [E4, 3],
      [D5, 2], [D5, 1], [F5, 1.5], [D5, 0.5], [B4, 1], [C5, 3], [E5, 3], [C5, 1], [G4, 1], [E4, 1], [G4, 1.5], [F4, 0.5], [D4, 1], [C4, 6]]) }),
  ]);
  const BOX_UP = 12; const REACH = 24; const GAP = 2.5; const BELL_EVERY = 24; const VOLUME = 0.16;
  const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);
  const songLength = (s) => s.notes.reduce((n, [, b]) => n + b, 0) * s.beat;
  // how loud by the distance to the tree: full within 4 m, nothing past REACH
  const loudness = (d) => (d >= REACH ? 0 : d <= 4 ? 1 : 1 - (d - 4) / (REACH - 4));
  function create({ isOn = () => true } = {}) {
    let ac = null; let out = null; let at = 0; let song = 0; let note = 0; let nextBell = 0; let playing = false; let level = 0;
    const ctx = () => { if (!ac) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return null; ac = new AC(); out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination); } if (ac.state === 'suspended') ac.resume().catch(() => {}); return ac; };
    // a music box's tine: a bright attack, two overtones, a ring of a second and a bit
    function tine(f, t, vol) { for (const [m, v, len] of [[1, 1, 1.4], [2, 0.32, 0.6], [3.01, 0.12, 0.3]]) { const o = ac.createOscillator(); const g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * m, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.05); } }
    // a church bell far off: its inharmonic partials, a long hum
    function bell(t) { for (const [m, v, len] of [[1, 0.5, 3.2], [2.4, 0.3, 2.2], [3.76, 0.2, 1.5], [0.5, 0.25, 3.6]]) { const o = ac.createOscillator(); const g = ac.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(392 * m, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + len); o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.05); } }
    return {
      // each frame: `dist` from the tree (m), `on` the decor up and on the island (not indoors)
      step(dist, on) {
        const want = on && isOn() ? loudness(dist) : 0;
        if (!want && !playing) return;
        const a = ctx(); if (!a) return; const now = a.currentTime;
        level = want; out.gain.setTargetAtTime(want * VOLUME, now, 0.4);
        if (!want) { if (playing && out.gain.value < 0.002) playing = false; return; }
        if (!playing) { playing = true; at = now + 0.2; note = 0; nextBell = now + 3; }
        if (at < now) at = now + 0.05; /* (1.10.344 Codex 331~340 P2-8: back from a long pause -- on from now, the missed notes not all made at once) */
        if (nextBell < now - 1) nextBell = now + 1;
        while (at < now + 0.6) { /* (the next notes scheduled a little ahead) */
          const s = SONGS[song]; const [m, b] = s.notes[note]; tine(freq(m + BOX_UP), at, 0.5); at += b * s.beat; note += 1;
          if (note >= s.notes.length) { note = 0; song = (song + 1) % SONGS.length; at += GAP; }
        }
        if (now >= nextBell) { bell(now + 0.05); nextBell = now + BELL_EVERY; }
      },
      state: () => ({ playing, level, song: SONGS[song].id }),
      stop() { playing = false; if (ac) { out.gain.cancelScheduledValues(ac.currentTime); out.gain.value = 0; } },
    };
  }
  return { SONGS, BOX_UP, REACH, BELL_EVERY, freq, songLength, loudness, create };
}));
