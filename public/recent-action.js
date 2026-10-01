// One short public sentence for the last thing that happened in a game (the 「방금」 line under the headline).
// v1.7.28: built only from each game's own public state (moves, throws, picks, draws, rolls, guesses), never from
// the room's system chat, so a join/leave notice can no longer be read as a game action. When a game's state
// cannot say which of two kinds of action came last, nothing is shown rather than a possibly stale line.
// Works in the browser (window.RecentAction) and in node tests (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RecentAction = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Korean particles after a number: 0, 1, 3, 6, 7, 8 (영 일 삼 육 칠 팔, and every ...십/백) end in a consonant.
  const endsInConsonant = n => [0, 1, 3, 6, 7, 8].includes(Math.abs(Number(n)) % 10);
  const eulReul = n => (endsInConsonant(n) ? '을' : '를');

  // state: the room state; helpers.actorName(seatOrColor) -> "이름님"(나).
  function narrate(state, { actorName }) {
    const g = state?.game;
    if (!g || !['playing', 'finished', 'draw', 'setup', 'round-ended'].includes(g.status)) return '';
    const m = g.lastMove;
    switch (state.gameType) {
      case 'omok':
        return m ? `${actorName(m.color)}이 돌을 놓았습니다` : '';
      case 'omok2v2': // the engine records the acting seat (`playerSeat`); the colour is only the team
        return m ? `${actorName(m.playerSeat ?? m.color)}이 돌을 놓았습니다` : '';
      case 'othello':
        return m ? `${actorName(m.color)}이 두어 ${m.flipped || 0}개를 뒤집었습니다` : '';
      case 'connect4':
        return m ? `${actorName(m.color)}이 ${m.x + 1}열에 넣었습니다` : '';
      case 'dots':
        return m ? `${actorName(m.color)}이 선을 그었습니다${m.claimed?.length ? ` · 상자 ${m.claimed.length}개 완성` : ''}` : '';
      case 'baseball':
        return m ? `${actorName(m.color)}의 추측 ${m.guess} → ${m.strikes}S ${m.balls}B` : '';
      case 'halligalli': {
        const bell = g.lastBell && g.lastBell.flipId === g.flipId ? g.lastBell : null;
        if (bell) return `${actorName(bell.seat)}이 종을 쳤습니다 · ${bell.correct ? `성공, 카드 ${bell.totalTransferred || 0}장 획득` : '실패, 벌칙 카드'}`;
        return g.lastFlip ? `${actorName(g.lastFlip.seat)}이 카드를 뒤집었습니다` : '';
      }
      case 'davinci': {
        const guess = g.lastGuess || g.history?.at(-1);
        return guess ? `${actorName(guess.seat)}이 ${actorName(guess.target)}의 타일을 ${guess.number}(으)로 추측 · ${guess.correct ? '정답' : '오답'}` : '';
      }
      case 'liar': {
        const hint = g.hints?.at(-1);
        return hint ? `${actorName(hint.seat)}의 힌트 · ${hint.timedOut ? '시간 초과' : `"${hint.text}"`}` : '';
      }
      case 'bingo': {
        const picked = g.lastSelected;
        return picked ? `${actorName(picked.seat)}이 ${picked.number}${eulReul(picked.number)} 골랐습니다` : '';
      }
      case 'yut': {
        // After a throw the move is still pending (phase 'move'); otherwise the last thing was a pass or a move.
        if (g.phase === 'move' && g.lastThrow) return `${actorName(g.turn)}의 윷 던지기 → ${g.lastThrow.name}`;
        if (g.lastPass) return `${actorName(g.lastPass)}이 이동할 말이 없어 차례를 넘겼습니다`;
        return m ? `${actorName(m.color)}이 말을 옮겼습니다${m.captured?.length ? ` · 상대 말 ${m.captured.length}개 잡음` : ''}${m.bonus ? ' · 한 번 더' : ''}` : '';
      }
      case 'oldmaid': {
        const draw = g.history?.at(-1);
        if (!draw) return '';
        const pairs = Number(draw.pairs) || 0;
        return `${actorName(draw.actor)}이 ${actorName(draw.target)}의 카드를 뽑았습니다${pairs ? ` · ${pairs}쌍을 버림` : ''}${draw.emptied ? ` · ${actorName(draw.emptied)}이 손패를 모두 비움` : ''}`;
      }
      case 'cityking': {
        const roll = g.lastRoll;
        if (!roll) return '';
        return `${actorName(roll.seat)}이 주사위 ${roll.total}${roll.double ? '(더블)' : ''}${g.lastEvent ? ` · ${g.lastEvent}` : ''}`;
      }
      case 'twentyquestions': {
        // Answered questions and judged guesses are kept in separate lists with no order between them: a step that is
        // still waiting is named first; afterwards the last thing is named only when just one kind exists so far.
        if (g.pendingQuestion) return `${actorName(g.pendingQuestion.seat)}이 질문했습니다`;
        if (g.pendingGuess) return `${actorName(g.pendingGuess.seat)}이 정답을 시도했습니다`;
        const asked = g.questions?.at(-1);
        const tried = g.guessHistory?.at(-1);
        if (g.phase === 'asking' && !asked && !tried) return g.drawerSeat ? `${actorName(g.drawerSeat)}이 정답을 설정했습니다` : '';
        if (asked && !tried) return `${actorName(g.drawerSeat)}이 ${actorName(asked.seat)}의 질문에 "${asked.reply}"(으)로 답했습니다`;
        if (tried && !asked) return `${actorName(tried.seat)}의 정답 시도 · ${tried.correct ? '정답' : '오답'}`;
        return '';
      }
      case 'pandemic': {
        const verbs = { move: '말을 옮겼습니다', build: '연구소를 지었습니다', treat: '질병을 치료했습니다', cure: '치료제를 개발했습니다', event: '이벤트 카드를 썼습니다', store: '이벤트 카드를 보관했습니다', discard: '카드를 버렸습니다' };
        const e = g.log?.findLast(e => verbs[e.kind] || e.kind === 'share');
        if (!e) return '';
        return e.kind === 'share' ? `${actorName(e.from)}이 ${actorName(e.to)}에게 카드를 줬습니다` : `${actorName(e.seat)}이 ${verbs[e.kind]}`;
      }
      case 'pictionary': {
        // Wrong guesses (guessLog) and correct ones (roundAwards) are separate lists with no order between them:
        // name the last one only when just one kind exists.
        const wrong = g.guessLog?.at(-1);
        const right = g.roundAwards?.at(-1);
        if (wrong && !right) return `${actorName(wrong.seat)}의 추측 · "${wrong.text}"`;
        if (right && !wrong) return `${actorName(right.seat)}이 정답을 맞혔습니다${right.first ? ' · 첫 정답' : ''}`;
        return '';
      }
      default:
        return '';
    }
  }

  return { narrate };
});
