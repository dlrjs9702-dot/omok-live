'use strict';

// Pure scoring for 대박맞고-style Go-Stop. Nothing here touches game flow or points storage.
const { getCard } = require('./cards');

const STOP_THRESHOLD = { matgo: 7, gostop: 3 };
const PIBAK_MAX = { matgo: 7, gostop: 5 }; // 1..N pi (by value) is 피박; 0 pi is exempt
const MAX_GO_MULTIPLIER_EXPONENT = 7; // 7고 = ×128, the cap
const INSTANT_WIN_SCORE = 10; // 총통, 3뻑

// Counts for one player's captured pile. `gukjinAsPi` moves 9월 국진 from 열끗 to a 쌍피.
function tally(capturedIds, gukjinAsPi = false) {
  const gwang = []; const animals = []; const ribbons = []; let piValue = 0; let piCards = 0;
  for (const id of capturedIds) {
    const item = getCard(id);
    if (item.gukjin && gukjinAsPi) { piValue += 2; piCards += 1; continue; }
    if (item.kind === 'gwang') gwang.push(item);
    else if (item.kind === 'animal') animals.push(item);
    else if (item.kind === 'ribbon') ribbons.push(item);
    else { piValue += item.piValue; piCards += 1; }
  }
  return { gwang, animals, ribbons, piValue, piCards };
}

function scoreBreakdown(capturedIds, gukjinAsPi = false) {
  const t = tally(capturedIds, gukjinAsPi);
  const items = [];
  const hasRain = t.gwang.some(item => item.rain);
  let gwangScore = 0;
  if (t.gwang.length >= 5) gwangScore = 15;
  else if (t.gwang.length === 4) gwangScore = 4;
  else if (t.gwang.length === 3) gwangScore = hasRain ? 2 : 3;
  if (gwangScore) items.push({ key: t.gwang.length === 5 ? 'ogwang' : t.gwang.length === 4 ? 'sagwang' : hasRain ? 'bisamgwang' : 'samgwang', points: gwangScore });

  const animalScore = t.animals.length >= 5 ? t.animals.length - 4 : 0;
  if (animalScore) items.push({ key: 'animal', points: animalScore, count: t.animals.length });
  const godori = [2, 4, 8].every(month => t.animals.some(item => item.godori && item.month === month));
  if (godori) items.push({ key: 'godori', points: 5 });

  const ribbonScore = t.ribbons.length >= 5 ? t.ribbons.length - 4 : 0;
  if (ribbonScore) items.push({ key: 'ribbon', points: ribbonScore, count: t.ribbons.length });
  for (const dan of ['hong', 'cheong', 'cho']) {
    if (t.ribbons.filter(item => item.dan === dan).length === 3) items.push({ key: `${dan}dan`, points: 3 });
  }

  const piScore = t.piValue >= 10 ? t.piValue - 9 : 0;
  if (piScore) items.push({ key: 'pi', points: piScore, count: t.piValue });

  const total = items.reduce((sum, item) => sum + item.points, 0);
  return {
    total, items,
    counts: { gwang: t.gwang.length, animal: t.animals.length, ribbon: t.ribbons.length, pi: t.piValue },
    gwangScore, animalScore, piScore, meongtta: t.animals.length >= 7,
  };
}

// 박 against one loser, judged from the winner's scoring categories and the loser's own pile.
function baks({ mode, winner, loser, loserWent }) {
  const list = [];
  if (winner.piScore > 0 && loser.counts.pi >= 1 && loser.counts.pi <= PIBAK_MAX[mode]) list.push('pibak');
  if (winner.gwangScore > 0 && loser.counts.gwang === 0) list.push('gwangbak');
  if (winner.meongtta && winner.animalScore > 0 && loser.counts.animal === 0) list.push('meongbak');
  if (loserWent) list.push('gobak');
  return list;
}

function goMultiplier(goCount) {
  return 2 ** Math.min(Math.max(0, goCount), MAX_GO_MULTIPLIER_EXPONENT);
}

// The per-loser payment. `score` already includes the +N go points.
function payment({ score, goCount, shakes, bombs, nagari, bakList, pointsPerScore }) {
  const factors = [
    { key: 'go', multiplier: goMultiplier(goCount), count: goCount },
    { key: 'shake', multiplier: 2 ** shakes, count: shakes },
    { key: 'bomb', multiplier: 2 ** bombs, count: bombs },
    { key: 'nagari', multiplier: 2 ** nagari, count: nagari },
    ...bakList.map(key => ({ key, multiplier: 2, count: 1 })),
  ].filter(item => item.multiplier > 1);
  const multiplier = factors.reduce((product, item) => product * item.multiplier, 1);
  return { score, multiplier, factors, pointsPerScore, amount: score * multiplier * pointsPerScore };
}

module.exports = { STOP_THRESHOLD, PIBAK_MAX, INSTANT_WIN_SCORE, tally, scoreBreakdown, baks, goMultiplier, payment };
