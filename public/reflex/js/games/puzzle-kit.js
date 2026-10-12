// 논리 퍼즐 4종(스도쿠 · 네모로직 · 다리 잇기 · 회로 연결) 공용 화면 도구
// · 오늘의 문제: 한국 날짜 · 난이도마다 모두 같은 문제. 처음 푼 기록만 랭킹에 오른다(다시 풀면 연습).
//   푸는 중에 나가도 판과 시간을 저장해 두었다가 이어서 푼다(처음부터 다시 풀어 기록을 줄이지 못하게).
// · 새 문제: 풀 때마다 다른 문제(연습 · 기록 없음)
// · 힌트: 답 대신 '왜 그 칸이 그렇게 되는지'를 알려 준다. 쓸 때마다 기록에 HINT_SEC초가 더해진다.
import { E } from '../engine.js';
import { storage, Stats } from '../store.js';
import { queueRecord as queueOut } from '../outbox.js';
import { kstDate, dailySeed, puzzleId, pzVersion, pzDateOk } from './pz-util.js';

export const HINT_SEC = 30;
export const RANK_RULE = `클리어 시간이 빠른 순 (오늘의 문제를 처음 풀 때만 · 힌트 1번마다 +${HINT_SEC}초)`;
export const MODE_OPTION = {
  id: 'mode', title: '문제', def: 'daily',
  items: [['daily', '오늘의 문제'], ['random', '새 문제 (연습)']],
  note: { daily: '하루 한 문제 · 모두 같은 문제예요. 처음 푼 기록만 랭킹에 오르고, 나갔다 와도 이어서 풀어요', random: '풀 때마다 새 문제가 나와요. 연습이라 기록은 남지 않아요' },
};

/** 이번 판의 문제 정보와 저장 도구 */
export function session(gameId) {
  const level = E.level || 'normal', date = kstDate(), daily = (E.opts?.mode || 'daily') !== 'random';
  const uid = Stats.uid || 'guest', doneKey = `gc.pzdone.${uid}`, progKey = `gc.pzprog.${uid}.${gameId}.${level}`;
  const done = storage.read(doneKey, {}) || {};
  const already = daily && done[`${gameId}.${level}`] === date;
  const ranked = daily && !already;
  const pid = puzzleId(gameId, level, date);
  return {
    gameId, level, date, daily, already, ranked, pid, uid,
    seed: daily ? dailySeed(gameId, level, date) : (Math.random() * 2 ** 32) >>> 0,
    label: daily ? (ranked ? '오늘의 문제' : '오늘의 문제 · 연습') : '새 문제 · 연습',
    /** 오늘의 문제를 푸는 중이었다면 그 상태 */
    load() { if (!ranked) return null; const p = storage.read(progKey, null); return p && p.date === date && (p.pid == null || p.pid === pid) ? p : null; },
    save(state) { if (ranked) storage.write(progKey, { ...state, date, pid }); },
    clear() { storage.remove(progKey); },
    markDone() { const d = storage.read(doneKey, {}) || {}; for (const k in d) if (d[k] !== date) delete d[k]; d[`${gameId}.${level}`] = date; storage.write(doneKey, d); },
  };
}

/* ---------------- 문제 만들기 (워커 · 오늘의 문제는 저장해 두고 다시 씀) ---------------- */
let worker = null, reqId = 0;
function getWorker() {
  if (worker !== null) return worker;
  try { worker = typeof Worker === 'function' ? new Worker(new URL('./pz-worker.js', import.meta.url), { type: 'module' }) : false; } catch { worker = false; }
  return worker;
}
/** kind 문제를 seed로 만들어 ready(문제)를 부른다. local: 워커를 못 쓸 때 직접 만드는 함수
 *  (저장해 둔 오늘의 문제가 있거나 워커가 없으면 바로 부른다 — 시험 환경도 같은 길) */
export function makePuzzle(sess, kind, local, ready) {
  const cacheKey = `gc.pzcache.${kind}.${sess.level}`;
  if (sess.daily) { const c = storage.read(cacheKey, null); if (c && c.seed === sess.seed && c.v === 1 && c.pid === sess.pid && c.puzzle) return ready(c.puzzle); }
  const keep = (p) => { if (sess.daily && p) storage.write(cacheKey, { v: 1, pid: sess.pid, seed: sess.seed, puzzle: p }); ready(p); };
  const w = getWorker();
  if (!w) return keep(local(sess.seed, sess.level));
  const id = ++reqId;
  let fin = false;
  const finish = (p) => { if (fin) return; fin = true; clearTimeout(timer); w.removeEventListener('message', on); w.removeEventListener('error', fail); keep(p); };
  const fail = () => { worker = false; finish(local(sess.seed, sess.level)); };
  const on = (e) => { if (e.data.id !== id) return; if (e.data.error || !e.data.puzzle) return fail(); finish(e.data.puzzle); };
  const timer = setTimeout(fail, 20000);
  w.addEventListener('message', on);
  w.addEventListener('error', fail);
  w.postMessage({ id, kind, seed: sess.seed, level: sess.level });
}

/** 끝: 오늘의 문제를 처음 푼 판만 기록(점수 = 걸린 시간 + 힌트 벌칙, 1/1000초) */
/** sol: 다 푼 판 (스도쿠 숫자 · 네모로직 0/1 · 다리 수 · 회로 방향) — 오늘의 문제 첫 기록이면 서버가 그날 정답인지 확인한다 */
export function finish(sess, { time, hints, stats = [], name, sol }) {
  const sec = time + hints * HINT_SEC;
  const common = [['시간', fmtT(time)], ['힌트', hints ? `${hints}번 (+${hints * HINT_SEC}초)` : '안 씀'], ...stats];
  // 자정을 넘겨 오래 멈춰 있다 끝낸 판: 그날 문제로 낼 수 있는 시간이 지났으면 연습으로 마무리 (서버도 받지 않음)
  const late = sess.ranked && !pzDateOk(sess.date, Date.now(), Math.round(sec * 1000));
  if (sess.ranked && !late) {
    const score = Math.round(sec * 1000), proof = { date: sess.date, sol: [...sol], v: pzVersion(sess.date) };
    // 가입한 계정: 결과를 먼저 '보낼 기록함'에 적는다 (rank.js와 같은 형식 · 같은 번호로 보냄) → 적은 뒤에만 오늘 완료 · 진행판 정리
    // 결과 연출 · 전송 도중 앱이 꺼져도 다음에 같은 번호로 보내 한 번만 기록된다
    const rec = sess.uid === 'guest' ? null : queueRecord(sess, { score, proof });
    if (sess.uid !== 'guest' && !rec) {
      // 기기에 적지 못함(저장 공간 부족): 완료 표시를 하지 않아 다시 풀 수 있게 두고, 이번 판은 바로 보내 본다
      E.end(null, { score, delay: 1.1, title: name ? `완성! ${name}` : '완성!', stats: [['기록', fmtT(sec)], ...common, ['저장', '기기 저장 공간이 부족해요 · 연결이 안 되면 기록이 남지 않을 수 있어요']], proof });
      return;
    }
    sess.markDone(); sess.clear();
    E.end(null, { score, delay: 1.1, title: name ? `완성! ${name}` : '완성!', stats: [['기록', fmtT(sec)], ...common], proof, rec });
  } else if (late) {
    sess.markDone(); sess.clear();
    E.end(null, { score: null, delay: 1.1, title: `${name ? `완성! ${name}` : '완성!'} · 연습`, stats: [...common, ['랭킹', '날짜가 지난 문제라 연습으로 마무리했어요']] });
  } else {
    E.end(null, { score: null, delay: 1.1, title: `${name ? `완성! ${name}` : '완성!'} · 연습`, stats: [...common, ['랭킹', sess.already ? '오늘의 문제는 이미 기록했어요' : '연습은 기록하지 않아요']] });
  }
}
/** 오늘의 문제 결과를 보낼 기록함(rank.js의 gc.outbox.<계정>)에 먼저 적는다 → { rid, at } (적지 못하면 null) */
// (rank.js와 같은 outbox.js 규칙: 최대 개수 · 넘치면 뺀 개수를 기록해 홈에서 알림 · 적기에 성공했을 때만)
function queueRecord(sess, { score, proof }) {
  const at = Date.now();
  const rid = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(12)))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]);
  return queueOut(sess.uid, { game: sess.gameId, lv: sess.level, score, dur: Math.max(1, Math.round(E.t || 1)), rid, at, pz: proof }) ? { rid, at } : null;
}
export const fmtT = (sec) => { const s = Math.max(0, Math.floor(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** HUD: 가운데 시간(벌칙 포함), 오른쪽 문제 종류 · 힌트 수 */
export function hud(sess, time, hints) {
  E.hud({ center: fmtT(time + hints * HINT_SEC), right: `${sess.label}${hints ? ` · 힌트 ${hints}` : ''}` });
}

/* ---------------- 그리기 도우미 ---------------- */
const mctx = globalThis.document?.createElement?.('canvas')?.getContext?.('2d') || null;
/** 글을 너비에 맞게 줄 나누기 (한국어는 글자 단위로도 끊음) */
export function wrap(text, maxW, size, weight = 600) {
  const measure = (s) => { if (!mctx) return s.length * size * 0.92; mctx.font = `${weight} ${size}px system-ui, sans-serif`; return mctx.measureText(s).width; };
  const lines = [];
  let cur = '';
  for (const word of String(text).split(' ')) {
    const next = cur ? cur + ' ' + word : word;
    if (measure(next) <= maxW) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = '';
    let piece = '';
    for (const ch of word) { if (measure(piece + ch) > maxW && piece) { lines.push(piece); piece = ''; } piece += ch; }
    cur = piece;
  }
  if (cur) lines.push(cur);
  return lines;
}
export const inRect = (b, x, y) => !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
/** 둥근 버튼 */
export function button(c, b, label, { on = false, dim = false, color = '#5B7BFF', size = 15 } = {}) {
  c.fillStyle = on ? color : 'rgba(255,255,255,.08)';
  E.rr(b.x, b.y, b.w, b.h, Math.min(14, b.h / 2)); c.fill();
  E.text(label, b.x + b.w / 2, b.y + b.h / 2 + 1, size, dim ? 'rgba(255,255,255,.35)' : '#fff', 800);
}
/** 힌트 · 안내 상자: 화면 아래쪽에 겹쳐 그림. 돌려준 영역을 누르면 닫는다 */
export function panel(c, title, text, { color = '#5B7BFF' } = {}) {
  const w = Math.min(E.W - 24, 560), x = (E.W - w) / 2, size = 14.5, lh = 21;
  const lines = wrap(text, w - 32, size);
  const h = 54 + lines.length * lh + 18, y = E.bottom - h - 4;
  c.fillStyle = 'rgba(12,14,30,.96)'; E.rr(x, y, w, h, 18); c.fill();
  c.strokeStyle = color; c.lineWidth = 2; E.rr(x + 1, y + 1, w - 2, h - 2, 17); c.stroke();
  E.text(title, x + 16, y + 26, 15, color, 900, 'left');
  E.text('닫기 ✕', x + w - 16, y + 26, 13, 'rgba(255,255,255,.55)', 700, 'right');
  lines.forEach((l, i) => E.text(l, x + 16, y + 54 + i * lh, size, '#E9ECF8', 600, 'left'));
  return { x, y, w, h };
}
/** 문제를 만드는 중 표시 */
export function loading(c, text = '문제를 만드는 중…') {
  const a = 0.55 + Math.sin(performance.now() / 260) * 0.35;
  c.globalAlpha = a;
  E.text(text, E.W / 2, (E.top + E.bottom) / 2, 16, '#C9D1E6', 800);
  c.globalAlpha = 1;
}
