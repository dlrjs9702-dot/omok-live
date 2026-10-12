// 차례 온라인 대결 공용 조각 (바둑 · 체스 · 체커 · 백개먼 · 오목 · 리버시 · 사목 · 틱택토)
// 게임 화면은 평소처럼 두고, 온라인이면:
//   · 내 차례에 둔 수는 화면에 바로 반영하고 E.online.move(수)로 서버에 보낸다 (서버가 규칙을 다시 검사)
//   · update()에서 pump()를 불러 상대의 수를 받아 같은 방법으로 둔다
//   · 서버와 어긋나면(드묾) 서버 상태(st)로 판 전체를 다시 맞춘다
//   · 승패는 서버가 정한다 (engine.js가 게임의 E.end를 기다리게 하고 서버 결과로 끝낸다)
import { E } from '../engine.js';
import { lvName } from '../levels.js';

/** 차례 온라인 대결 중이면 그 판(net.js createTurnMatch), 아니면 null */
export const net = () => (E.online?.kind === 'turn' ? E.online : null);
/** 서버가 AI를 두는 랭킹 AI 대결이면 그 난이도 */
export const vsAi = () => net()?.ai || null;
/** 좌석(0 먼저 · 1 나중)이 나인지 */
export const isMe = (seat) => net()?.you === seat;
/** 좌석의 이름: '나' 또는 상대 닉네임 */
export const seatName = (seat) => (isMe(seat) ? '나' : vsAi() ? 'AI' : net()?.opp.nick || '상대');
/** 결과 화면 통계의 상대 칸: 온라인 대결 · AI(난이도) */
export const netStat = () => (vsAi() ? ['AI', lvName(vsAi())] : ['대결', '온라인']);

/**
 * 받은 사건 처리
 * @param {(seat:number, m:any, st:object) => void} onMove 상대가 둔 수
 * @param {(st:object) => void} onLoad 서버 상태로 판 전체 다시 맞추기
 * @param {(seat:number, m:any, st:object) => void} [onMine] 내 수의 서버 확인 (백개먼: 다음 주사위 등)
 */
export function pump(onMove, onLoad, onMine) {
  const o = net();
  if (!o) return;
  for (const ev of o.take()) {
    if (ev.type === 'mv') (ev.seat === o.you ? onMine : onMove)?.(ev.seat, ev.m, ev.st);
    else if (ev.type === 'load') { onLoad(ev.st); if (ev.bad) E.banner('서버와 판을 다시 맞췄어요', 'info', 1400); }
  }
}
