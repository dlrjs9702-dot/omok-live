// 보낼 기록함 (계정마다 gc.outbox.<계정>) — 기록을 서버에 보내기 전에 먼저 적어 두는 곳
// rank.js(모든 게임)와 puzzle-kit.js(오늘의 문제 완성 순간)가 같은 규칙으로 쓴다:
// · 최대 OUTBOX_MAX개 — 넘치면 오래된 것부터 빼고, 뺀 개수를 기록(gc.outlog.<계정>.dropped)해 홈에서 알린다 (조용히 버리지 않음)
// · 같은 번호(rid)는 한 번만 · 적기에 성공했을 때만 true (저장 공간 부족이면 false → 부른 쪽이 알림)
import { storage } from './store.js';

export const OUTBOX_MAX = 200, OUTBOX_DAYS = 7;
export const outKey = (uid) => 'gc.outbox.' + uid;
export const logKey = (uid) => 'gc.outlog.' + uid; // { dropped, expired, rejected:[{ game, lv, at, msg }] }
const changed = () => globalThis.dispatchEvent?.(new Event('gc:outbox'));
export const readQueue = (uid) => storage.read(outKey(uid), []) || [];

/** 빠진 · 기한 지난 · 거절된 기록 수 남기기 */
export function outLog(uid, fn) {
  const l = storage.read(logKey(uid), null) || { dropped: 0, expired: 0, rejected: [] };
  fn(l);
  l.rejected = l.rejected.slice(-20);
  return storage.write(logKey(uid), l);
}
/** 기록함에 적기 → 적었으면 true (이미 있는 번호면 그대로 true) */
export function queueRecord(uid, body) {
  const list = readQueue(uid);
  if (list.some((x) => x.rid === body.rid)) return true;
  list.push(body);
  const over = list.length - OUTBOX_MAX;
  if (!storage.write(outKey(uid), over > 0 ? list.slice(-OUTBOX_MAX) : list)) return false;
  if (over > 0) outLog(uid, (l) => { l.dropped += over; });
  changed();
  return true;
}
/** 그 번호의 기록만 뺀다 (기다리는 동안 새로 들어온 기록은 그대로) */
export function dropRecord(uid, rid) {
  storage.write(outKey(uid), readQueue(uid).filter((x) => x.rid !== rid));
  changed();
}
