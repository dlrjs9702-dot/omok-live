// v1.10.72 게임방 AI 자리 (한판마당 자료 04 ai-core.js): the AI's move for a room's board, off the main thread (a hard
// 오목 move takes most of a second). Boards come flat, row by row from the top, 0 empty · 1 the first player (흑/빨강) ·
// 2 the second; the answer is the index played (오목·오델로) or the column (사목), null when there is none.
import { parentPort } from 'node:worker_threads';
import { gomokuAi, connect4AiAs, reversiAiAs } from '../public/reflex/js/games/ai-core.js';

const THINK = {
  omok: ({ board, color, level }) => gomokuAi(board, level, color),
  connect4: ({ board, color, level }) => connect4AiAs(board, level, color),
  othello: ({ board, color, level }) => reversiAiAs(board, level, color)?.i ?? null,
};
parentPort.on('message', ({ id, job }) => {
  try { parentPort.postMessage({ id, move: THINK[job.game](job) ?? null }); } catch (e) { parentPort.postMessage({ id, error: String(e) }); }
});
