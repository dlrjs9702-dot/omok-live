'use strict';

const { getGame } = require('./games');

function currentTurnSeat(room) {
  if (!room?.game) return null;
  if (room.gameType === 'twentyquestions') {
    return ['secret', 'answering', 'judging'].includes(room.game.phase)
      ? room.game.drawerSeat
      : getGame('twentyquestions').currentTurn(room.game);
  }
  return (room.gameType === 'omok2v2' ? room.game.nextSeat : room.game.turn) || null;
}

function timer(source, label, deadlineAt, timeoutText, now, phase) {
  deadlineAt = Number(deadlineAt);
  if (!Number.isFinite(deadlineAt)) return null;
  return {
    key: `${source}:${phase || 'turn'}:${deadlineAt}`,
    source,
    phase: phase || 'turn',
    label,
    deadlineAt,
    timeoutText,
    serverNow: Number(now),
  };
}

function buildTwentyTimer(room, seat, now, afkTimeoutMs) {
  const g = room.game;
  const requiredSeat = currentTurnSeat(room);
  if (!requiredSeat || String(requiredSeat) !== seat) return null;
  const watch = room.turnWatch;
  if (!watch || String(watch.seat) !== seat || !Number.isFinite(Number(watch.since))) return null;
  const deadlineAt = Number(watch.since) + Number(afkTimeoutMs);
  if (g.phase === 'secret') return timer('twentyquestions', '내 출제 시간', deadlineAt, '시간 초과 시 라운드 무효', now, g.phase);
  if (g.phase === 'answering') return timer('twentyquestions', '내 답변 시간', deadlineAt, '시간 초과 시 라운드 무효', now, g.phase);
  if (g.phase === 'judging') return timer('twentyquestions', '내 판정 시간', deadlineAt, '시간 초과 시 라운드 무효', now, g.phase);
  if (g.phase === 'final-guesses') return timer('twentyquestions', '내 최종 정답', deadlineAt, '시간 초과 시 마지막 기회 소진', now, g.phase);
  if (g.phase === 'asking') return timer('twentyquestions', '내 차례', deadlineAt, '시간 초과 시 다음 도전자로', now, g.phase);
  return null;
}

function buildActionTimer(room, viewerSeat, now = Date.now(), afkTimeoutMs = 60_000) {
  const g = room?.game;
  const seat = viewerSeat == null ? null : String(viewerSeat);
  if (!g || !seat || g.status !== 'playing') return null;

  if (room.gameType === 'twentyquestions') return buildTwentyTimer(room, seat, now, afkTimeoutMs);

  if (room.gameType === 'halligalli') {
    if (String(g.turn) !== seat) return null;
    return timer('halligalli', '내 차례', g.deadlineAt, '시간 초과 시 자동 뒤집기', now, g.phase);
  }

  if (room.gameType === 'davinci') {
    if (String(g.turn) !== seat) return null;
    if (g.phase === 'reveal-own') return timer('davinci', '내 타일 공개', g.deadlineAt, '시간 초과 시 서버가 무작위 공개', now, g.phase);
    if (g.phase === 'guess' || g.phase === 'continue') {
      return timer('davinci', g.phase === 'continue' ? '내 선택 시간' : '내 추측 시간', g.deadlineAt, '시간 초과 시 오답 처리', now, g.phase);
    }
    return null;
  }

  if (room.gameType === 'liar') {
    if (['hint1', 'hint2', 'extraHint'].includes(g.phase)) {
      const speaker = g.hintOrder?.[g.hintIndex] || null;
      return String(speaker) === seat ? timer('liar', '내 힌트 시간', g.deadlineAt, '시간 초과 시 힌트 없음 · 다음 순서', now, g.phase) : null;
    }
    if (g.phase === 'vote' || g.phase === 'revote') {
      if (!g.players?.includes(seat) || Object.hasOwn(g.votes || {}, seat)) return null;
      return timer('liar', '내 투표 시간', g.deadlineAt, '시간 초과 시 미투표로 집계', now, g.phase);
    }
    if (g.phase === 'guess' && String(g.liarSeat) === seat && !g.guessSubmitted) {
      return timer('liar', '내 최종 추측', g.deadlineAt, '시간 초과 시 시민 승', now, g.phase);
    }
    return null;
  }

  if (room.gameType === 'pictionary') {
    if (g.phase !== 'drawing' || !g.seatOrder?.includes(seat)) return null;
    if (String(g.drawerSeat) === seat) return timer('pictionary', '내 출제 시간', g.roundEndsAt, '시간 초과 시 라운드 종료', now, g.phase);
    if (g.correctGuessers?.includes(seat)) return null;
    return timer('pictionary', '내 정답 입력', g.roundEndsAt, '시간 초과 시 라운드 종료', now, g.phase);
  }

  if (room.gameType === 'marathon') {
    if (g.phase !== 'mission' || !g.mission) return null;
    const group = getGame('marathon').groupOf(g, seat);
    if (!group || String(g.mission.group) !== String(group)) return null;
    return timer('marathon', g.mode === 'team' ? '우리 팀 미션' : '내 미션', g.deadlineAt, '시간 초과 시 2칸 후퇴 · 새 미션', now, g.phase);
  }

  if (g.paused) return null;
  const turnSeat = currentTurnSeat(room);
  const watch = room.turnWatch;
  if (!turnSeat || String(turnSeat) !== seat || !watch || String(watch.seat) !== seat || !Number.isFinite(Number(watch.since))) return null;
  return timer('generic', '내 차례', Number(watch.since) + Number(afkTimeoutMs), '시간 초과 시 일시정지', now, 'turn');
}

module.exports = { buildActionTimer, currentTurnSeat };
