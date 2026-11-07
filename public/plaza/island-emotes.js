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
  const EXTRA = { cheer: E('cheer', '환호', 'cheer', 1.5, 'happy', 'laugh', 0.05, 1.3, 'sparkle', 0.2, 1.0), nod: E('nod', '끄덕', 'nod', 1.5, null, 'grin', 0.1, 1.3, null, 0, 0) };
  const of = (id) => BY[id] || EXTRA[id] || null;
  const ACTS = LIST.map((e) => `emote:${e.id}`);
  const BLINK = { every: [3, 6], hold: 0.12, near: 15 };
  return { LIST, BY, EXTRA, of, ACTS, BLINK, SAME_MS: 1000, DANCE_MS: 30000, MARK_SCALE: 1.75, MARK_UP: 0.25, NEAR: 40 };
}));
