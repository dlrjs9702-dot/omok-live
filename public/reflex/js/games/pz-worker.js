// 논리 퍼즐 문제 만들기 워커: 어려운 문제는 만드는 데 시간이 걸려서 화면 밖에서 만든다 (화면이 멈추지 않게)
import { generate as sudoku } from './sudoku-core.js';
import { randomPuzzle as nonogram } from './nonogram-core.js';
import { generate as hashi } from './hashi-core.js';
import { generate as circuit } from './circuit-core.js';
const MAKE = { sudoku, nonogram, hashi, circuit };
self.onmessage = (e) => {
  const { id, kind, seed, level } = e.data;
  try { self.postMessage({ id, puzzle: MAKE[kind](seed, level) }); } catch (err) { self.postMessage({ id, error: String(err) }); }
};
