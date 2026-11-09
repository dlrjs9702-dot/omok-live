// v1.10.263 감정 표현 (gamecenter-notes docs/emotes-20261107.md, assets 101 emotes.json): one feeling = a move, a face (the
// eyes and mouth worn a moment over mine; null keeps mine) and a mark over the head, at the times the asset gave (seconds
// from the clip's start). The page draws them; the server lets `emote:<id>` through as an act others see. The wheel's order:
// the inner eight, then the outer eight.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IslandEmotes = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  const E = (id, label, clip, dur, eyes, mouth, at, back, mark, markAt, markFor, more = {}) => ({ id, label, clip, dur, eyes, mouth, at, back, mark, markAt, markFor, ...more });
  const LIST = [
    E('wave', '인사', 'wave', 2.1, 'happy', null, 0.1, 1.9, 'flower', 0.3, 1.2, { icon: 'wave' }),
    E('laugh', '웃음', 'laugh', 1.6, 'happy', 'laugh', 0.05, 1.45, 'note', 0.15, 1.2),
    E('clap', '박수', 'clap', 1.8, 'happy', 'laugh', 0.1, 1.6, 'sparkle', 0.3, 1.0),
    E('thumbsup', '엄지', 'thumbsUp', 1.0, 'happy', 'grin', 0.1, 0.85, 'sparkle', 0.3, 0.7),
    E('heart', '하트', 'heartHands', 1.4, 'shy', 'grin', 0.15, 1.2, 'heart', 0.35, 1.0, { icon: 'hearthands' }),
    E('surprise', '놀람', 'surprise', 0.9, 'surprised', 'o', 0.05, 0.8, 'exclaim', 0.1, 0.8),
    E('think', '고민', 'think', 2.0, null, 'frown', 0.2, 1.8, 'question', 0.3, 1.0, { then: { mark: 'idea', at: 1.4, for: 0.6 } }),
    E('dance', '춤', 'dance', 4.0, 'happy', 'laugh', 0, null, 'note', 0.2, 1.5, { loop: true }),
    E('jumpjoy', '기쁨', 'jumpJoy', 1.0, 'happy', 'laugh', 0.05, 0.9, 'sparkle', 0.2, 0.8),
    E('shy', '부끄러움', 'shy', 1.6, 'shy', 'wavy', 0.1, 1.4, 'heart', 0.35, 1.0),
    E('shrug', '으쓱', 'shrug', 1.0, null, 'wavy', 0.15, 0.85, 'question', 0.25, 0.75),
    E('facepalm', '이마 짚기', 'facepalm', 1.4, 'blink', 'wavy', 0.2, 1.2, 'sweat', 0.35, 0.9),
    E('yawn', '하품', 'yawn', 2.0, 'blink', 'o', 0.3, 1.6, 'zzz', 0.6, 1.2),
    E('cry', '울음', 'cry', 2.0, 'sad', 'frown', 0.1, 1.75, 'tears', 0.3, 1.4),
    E('bow', '절', 'bow', 1.2, 'blink', null, 0.2, 1.0, null, 0, 0),
    E('angry', '화남', 'angry', 1.4, 'angry', 'grit', 0.05, 1.25, 'anger', 0.15, 1.0),
  ];
  const BY = Object.fromEntries(LIST.map((e) => [e.id, e]));
  // the game's own (행사·선물·축하): cheer and nod take the same way (no wheel cell)
  const EXTRA = { cheer: E('cheer', '환호', 'cheer', 1.5, 'happy', 'laugh', 0.05, 1.3, 'sparkle', 0.2, 1.0), nod: E('nod', '끄덕', 'nod', 1.5, null, 'grin', 0.1, 1.3, null, 0, 0),
    greet: E('greet', '살짝 인사', 'greet', 1.6, 'happy', null, 0.1, 1.4, 'flower', 0.3, 1.0) /* (v1.10.264: an islander's GreetingSmall) */ };
  const of = (id) => BY[id] || EXTRA[id] || null;
  const ACTS = LIST.map((e) => `emote:${e.id}`);
  const BLINK = { every: [3, 6], hold: 0.12, near: 15 };
  // v1.10.264 주민 반응 (6절): my feeling -> the islander's move (an emote id, its face with it), its mark when another than
  // the move's own, and its two lines (one picked, the islander's tail after it). Only on the screen: no 호감도, no server.
  const R = (move, mark, lines, more = {}) => ({ move, mark, lines, ...more });
  const HI = ['안녕!', '반가워!']; const FUN = ['뭐가 그렇게 좋아?', '나도 덩달아 웃음 나!']; const HUH = ['글쎄…', '나도 모르겠어.'];
  function reactOf(feel, { night = false, rain = false, level = 0 } = {}) {
    switch (feel) {
      case 'wave': return R('wave', null, HI); case 'bow': return R('bow', 'flower', HI);
      case 'laugh': case 'jumpjoy': case 'clap': return R('laugh', null, FUN);
      case 'dance': return night || rain ? R('clap', 'note', ['같이 춰!', '흥이 난다!']) : R('dance', null, ['같이 춰!', '흥이 난다!'], { ms: 4000 });
      case 'thumbsup': return R('thumbsup', null, ['최고!', '너도!']);
      case 'heart': return level >= 3 ? R('heart', null, ['헤헤…', '나도 좋아!']) : R('shy', 'heart', ['헤헤…', '나도 좋아!']);
      case 'shy': return R('greet', 'flower', ['왜 그래, 귀엽게.', '쑥스러워?']);
      case 'surprise': return R('surprise', null, ['앗, 왜?!', '뭐 있어?']);
      case 'think': case 'shrug': return R('shrug', null, HUH);
      case 'yawn': return night ? R('yawn', null, ['졸리다…', '벌써 졸려?']) : R('laugh', 'note', ['졸리다…', '벌써 졸려?']);
      case 'facepalm': return R('shrug', 'sweat', ['무슨 일 있었어?', '힘내!']);
      case 'cry': return R('surprise', 'sweat', ['괜찮아?', '울지 마, 내가 있잖아.'], { then: 'wave' });
      case 'angry': return R('surprise', 'sweat', ['히익, 미안해!', '진정해…']);
      default: return null;
    }
  }
  // v1.10.264 말할 때 (5절): an islander's face for the first 1.5 s of what it says -> { eyes, mouth } (null keeps that one) or
  // null: a rain or winter grumble sad; a rainbow or a star night pleased; an errand asked a grin; a rumour or their question
  // an 「o」; a greeting, thanks or a gift taken laughing
  function talkFace({ first = false, topic = null, mood = null, offer = false, question = false, reward = false } = {}) {
    if (mood === 'rain' || mood === 'winter') return { eyes: 'sad', mouth: 'frown' };
    if (mood === 'rainbow' || mood === 'stars') return { eyes: 'happy', mouth: 'grin' };
    if (offer) return { eyes: null, mouth: 'grin' };
    if (question || topic === 'rumor') return { eyes: null, mouth: 'o' };
    if (first || reward || topic === 'gift' || topic === 'answer') return { eyes: 'happy', mouth: 'laugh' };
    return null;
  }
  // v1.10.287 얼굴이 살아 있게 (notes docs/face-life-20261108.md 2절): a line said -- the mouth to 「o」 and back every 0.12~0.18 s
  // for its letters x 0.06 s, 0.6 s at least and 3 s at most
  const TALK = { letter: 0.06, min: 0.6, max: 3, flip: [0.12, 0.18] };
  const talkMs = (text) => Math.round(Math.min(TALK.max, Math.max(TALK.min, [...String(text || '')].length * TALK.letter)) * 1000);
  // (3절) the head turned to the nearest one within 4 m -- the one I talk with, if any, alone; at most 45° aside and 15° up or
  // down, there in 0.3 s, picked again every 0.25 s. self { x, y, z, yaw } (yaw: the body's, atan2(dx, dz)), people [{ x, y, z }]
  // (their eyes' height) -> { yaw, pitch, who } (radians from the body's front: + to its left as the yaw goes, + up) or null
  const LOOK = { near: 4, yaw: Math.PI / 4, pitch: Math.PI / 12, ease: 0.3, every: 0.25, cam: 15 };
  function lookPick(self, people = [], partner = null) {
    let who = partner; let best = Infinity;
    if (!who) for (const p of people) { const d = Math.hypot(p.x - self.x, p.z - self.z); if (d > 0.05 && d <= LOOK.near && d < best) { best = d; who = p; } }
    if (!who) return null;
    const flat = Math.hypot(who.x - self.x, who.z - self.z); const turn = Math.atan2(who.x - self.x, who.z - self.z) - (self.yaw || 0);
    const yaw = Math.atan2(Math.sin(turn), Math.cos(turn)); const pitch = Math.atan2((who.y ?? self.y) - self.y, Math.max(0.3, flat));
    return { yaw: Math.max(-LOOK.yaw, Math.min(LOOK.yaw, yaw)), pitch: Math.max(-LOOK.pitch, Math.min(LOOK.pitch, pitch)), who };
  }
  return { LIST, BY, EXTRA, of, ACTS, BLINK, TALK, talkMs, LOOK, lookPick, reactOf, talkFace, SAME_MS: 1000, DANCE_MS: 30000, MARK_SCALE: 1.75, MARK_UP: 0.25, NEAR: 40, REACT_R: 4, REACT_MS: 20000, TALK_FACE_MS: 1500, IDLE_MS: [120000, 240000], IDLE_NEAR: 30 };
}));
