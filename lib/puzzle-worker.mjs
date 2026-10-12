// v1.10.69 오늘의 문제 (한판마당 자료 server/pz-worker.js): the day's puzzle made again from its seed by the very code the
// page runs (public/reflex/js/games/*-core.js), off the main thread (a hard sudoku can take over a second); only the answer
// goes back.
import { parentPort } from 'node:worker_threads';
import { dailySeed, dayIndex } from '../public/reflex/js/games/pz-util.js';
import { generate as sudoku } from '../public/reflex/js/games/sudoku-core.js';
import { generate as hashi } from '../public/reflex/js/games/hashi-core.js';
import { generate as circuit } from '../public/reflex/js/games/circuit-core.js';
import { dailyPicture } from '../public/reflex/js/games/nonogram-core.js';

const MAKE = {
  sudoku: (lv, date) => sudoku(dailySeed('sudoku', lv, date), lv).solution,
  hashi: (lv, date) => hashi(dailySeed('hashi', lv, date), lv).solution,
  circuit: (lv, date) => circuit(dailySeed('circuit', lv, date), lv).solution,
  nonogram: (lv, date) => dailyPicture(lv, dayIndex(date)).sol,
};
parentPort.on('message', ({ id, game, lv, date }) => {
  try { parentPort.postMessage({ id, sol: MAKE[game](lv, date) }); } catch (e) { parentPort.postMessage({ id, error: String(e) }); }
});
