'use strict';
// v1.10.266 주민 대화 나무 (gamecenter-notes docs/resident-talk-trees-20261104.md, text: story/extra-20261104/final-6-trees.json
// -> island-talk-trees.json): 27 islanders x 6 topics, each a tree of their lines and my replies (3~4, +1 or 0 호감도), its ends a
// warm word, a keepsake or a hint the server fills from the island as it is. Here only the trees: which topics are open, the
// first words (another first line once a topic was talked before), a reply checked and its next node, an end's result. The
// server keeps where a talk stands and what was said today.
const TREES = require('./island-talk-trees.json');

const TOPIC_IDS = Object.freeze(['today', 'hint', 'work', 'you', 'friend', 'heart']);
const LABELS = Object.freeze({ today: '요즘 어때요?', hint: '뭐 좋은 거 없어요?', work: '하는 일 이야기', you: '제 이야기 들어 줄래요?', heart: '속 이야기' }); // (friend: its own label, 「○○ 어때요?」)
const HINT_KINDS = Object.freeze(['fishHot', 'nightFish', 'dexGap', 'insectNow', 'contestTip', 'storyNext', 'project', 'weeds']);
const PER_DAY = 3; // topics with one islander a day (then their one line as before)

const topicOf = (n, id) => (TREES[n] || []).find((t) => t.id === id) || null;
const labelOf = (n, id) => topicOf(n, id)?.label || LABELS[id] || id;
// open to me: its 호감도 level reached; 속 이야기 only once their story book's third chapter is done (its words tell what the book
// has not yet -- 노을's lighthouse daughter)
function openTopics(n, { level = 0, storyDone = 0 } = {}) {
  return (TREES[n] || []).filter((t) => level >= t.level && (t.id !== 'heart' || storyDone >= 3)).map((t) => t.id);
}
// an end's hint kind: the topic's own, else by what it leaves to fill -- {fish}{water} a night fish, {name}{where}{time} a fish
// not in my 도감, {insect} one out now, {project}{left} the island's works, {game}{tip} today's contest, {name}{place} my story's
// next stop, {place} alone the weeds (풀) or today's good water
function hintKindOf(topic, node) {
  if (!node?.hint) return null; if (typeof topic?.hint === 'string' && HINT_KINDS.includes(topic.hint)) return topic.hint;
  const text = (node.say || []).join(' '); const has = (k) => new RegExp(`\\{${k}[|}]`).test(text);
  if (has('fish') && has('water')) return 'nightFish';
  if (has('where') && has('time')) return 'dexGap';
  if (has('insect')) return 'insectNow';
  if (has('project')) return 'project';
  if (has('game')) return 'contestTip';
  if (has('name') && has('place')) return 'storyNext';
  if (has('place')) return /풀|잡초/.test(text) ? 'weeds' : 'fishHot';
  return null;
}
const nodeKeys = (topic) => Object.keys(topic?.nodes || {});
const kindsOf = (topic) => [...new Set(nodeKeys(topic).map((k) => hintKindOf(topic, topic.nodes[k])).filter(Boolean))];
// the first words: the tree's, or -- talked before (`last`, my last reply there) -- one of its `again` lines in place of the first
function begin(n, id, { again = false, pick = 0 } = {}) {
  const t = topicOf(n, id); if (!t) return null; const start = t.nodes.start;
  const say = again && t.again?.length ? [t.again[pick % t.again.length], ...start.say.slice(1)] : start.say.slice();
  return { node: 'start', say, replies: start.replies.map((r) => r[0]) };
}
// my reply `i` at node `key` -> { next, delta, text } (null: no such reply there)
function answer(n, id, key, i) {
  const node = topicOf(n, id)?.nodes[key]; const r = Number.isInteger(i) ? node?.replies?.[i] : null; if (!r) return null;
  return { next: r[1], delta: r[2] > 0 ? 1 : 0, text: r[0] };
}
function view(n, id, key) { const node = topicOf(n, id)?.nodes[key]; if (!node) return null; return { node: key, say: node.say.slice(), replies: node.end ? null : (node.replies || []).map((r) => r[0]), end: Boolean(node.end) }; }
// the end reached: its words, its keepsake, its hint kind -- a hint that cannot be told now (`can(kind)` false: nothing true to
// say, or already told today) gives way to another end of this topic that can, then to one with no hint, then to the topic's
// first warm end with its hint line left out
function endOf(n, id, key, can = () => true) {
  const t = topicOf(n, id); const node = t?.nodes[key]; if (!node?.end) return null;
  const kind = hintKindOf(t, node); const out = (k, nd) => ({ node: k, say: nd.say.slice(), gift: nd.gift || null, hint: hintKindOf(t, nd) });
  const ends = nodeKeys(t).filter((k) => t.nodes[k].end);
  if (!kind && t.id === 'hint') { const told = ends.find((k) => { const h = hintKindOf(t, t.nodes[k]); return h && can(h); }); if (told) return out(told, t.nodes[told]); } /* (검토 2026-11-06: 「뭐 좋은 거 없어요?」 ended without one -- an end that tells something true now in its place) */
  if (!kind || can(kind)) return out(key, node);
  const other = ends.find((k) => { const h = hintKindOf(t, t.nodes[k]); return h && h !== kind && can(h); }); if (other) return out(other, t.nodes[other]);
  const plain = ends.find((k) => !t.nodes[k].hint); if (plain) return out(plain, t.nodes[plain]);
  return { node: key, say: node.say.filter((l) => !/\{(?!me[|}])\w+/.test(l)).concat(node.say.every((l) => /\{(?!me[|}])\w+/.test(l)) ? ['오늘은 이 정도만 알려 줄게요.'] : []), gift: null, hint: null };
}

if (require.main === module) {
  const assert = require('node:assert/strict');
  assert.equal(Object.keys(TREES).length, 27);
  let ends = 0; let hints = 0;
  for (const [n, topics] of Object.entries(TREES)) {
    assert.deepEqual(topics.map((t) => t.id).sort(), [...TOPIC_IDS].sort(), `${n}: six topics`);
    for (const t of topics) {
      // every node reached from the start, every path to an end, every reply to a node that is there
      const seen = new Set(); const walk = (k) => { if (seen.has(k)) return; seen.add(k); const nd = t.nodes[k]; assert.ok(nd, `${n}/${t.id}/${k}`); if (nd.end) { ends += 1; return; } assert.ok(nd.replies?.length >= 2 && nd.replies.length <= 4, `${n}/${t.id}/${k} replies`); for (const r of nd.replies) walk(r[1]); };
      walk('start'); assert.equal(seen.size, nodeKeys(t).length, `${n}/${t.id}: no node left out`);
      for (const k of nodeKeys(t)) if (t.nodes[k].hint) { hints += 1; assert.ok(hintKindOf(t, t.nodes[k]), `${n}/${t.id}/${k}: a hint kind`); }
      assert.ok(t.again?.length >= 1, `${n}/${t.id}: again`);
    }
  }
  assert.ok(ends > 600 && hints > 100);
  assert.deepEqual(openTopics(0, { level: 0 }), ['today', 'hint']); assert.ok(openTopics(0, { level: 3 }).length === 5 && !openTopics(0, { level: 3 }).includes('heart'));
  assert.ok(openTopics(0, { level: 3, storyDone: 3 }).includes('heart'));
  const b = begin(0, 'today'); assert.equal(b.node, 'start'); assert.equal(b.replies.length, 4); assert.notEqual(begin(0, 'today', { again: true }).say[0], b.say[0]);
  assert.deepEqual(answer(0, 'today', 'start', 2), { next: 'c', delta: 0, text: '저는 졸려요' }); assert.equal(answer(0, 'today', 'start', 9), null); assert.equal(answer(0, 'today', 'nope', 0), null);
  assert.equal(hintKindOf(topicOf(0, 'hint'), topicOf(0, 'hint').nodes.e2), 'weeds');
  assert.equal(endOf(0, 'hint', 'e2').hint, 'weeds'); const none = endOf(0, 'hint', 'e2', () => false); assert.equal(none.hint, null); assert.ok(none.say.every((l) => !/\{place/.test(l)));
  assert.equal(endOf(0, 'today', 'e1').gift, '눌러 말린 꽃잎');
  { const t = topicOf(1, 'hint'); const plain = nodeKeys(t).find((k) => t.nodes[k].end && !hintKindOf(t, t.nodes[k])); /* (해송: an end of 「뭐 좋은 거 없어요?」 with no hint words -- a hint end in its place while one can be told) */
    if (plain) { assert.ok(endOf(1, 'hint', plain).hint); assert.equal(endOf(1, 'hint', plain, () => false).hint, null); } }
  console.log('island-talks ok', ends, 'ends', hints, 'hints');
}

module.exports = { TREES, TOPIC_IDS, LABELS, HINT_KINDS, PER_DAY, topicOf, labelOf, openTopics, hintKindOf, kindsOf, begin, answer, view, endOf };
