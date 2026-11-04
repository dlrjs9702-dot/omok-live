// v1.10.242 가락 대회 말 (gamecenter-notes docs/story-extra-20261104.md 2, 총괄 글 묶음 2026-11-04; the lines as written in
// story/extra-20261104/final-2-contest.js.txt): 가락's words at the 대회 천막 -- each game's before (soon), during (live), after
// with a winner (after) or with too few (none); the next one (idle), the podium's 1st~3rd, a round joined. {winner} {name} {game}
// filled as island-cast fills its words ({x|A|B}: A after a final consonant).
(function (root) {
  'use strict';
  const LINES = Object.freeze({
  games: {
    whack: {
      soon: [
        '10분 뒤 두 시, 두더지 잡기 대회가 열려요.',
        '한 판 최고 점수로 겨뤄요. 톡톡 박자를 타 봐요.'
      ],
      live: [
        '두더지들이 고개를 내밀어요. 나한테 참가를 눌러요.',
        '톡, 톡, 박자 좋은 손이면 충분해요. 어서 와요.'
      ],
      after: [
        '{winner} 쪽 손박자가 제일 빨랐어요. 축하해요.',
        '두더지들도 {winner} 쪽에게 박수를 쳤을 거예요.'
      ],
      none: [
        '참가한 쪽이 둘이 안 돼서 상은 없어요. 아쉬워요.',
        '혼자 치는 박자는 쓸쓸해요. 다음엔 같이 해요.'
      ]
    },
    klondike: {
      soon: [
        '10분 뒤에 카드놀이 대회예요. 모두 같은 패를 받아요.',
        '다 맞추는 데 가장 빠른 쪽이 이겨요. 숨 고르고 와요.'
      ],
      live: [
        '같은 패로 다 같이 시작해요. 참가하기를 눌러요.',
        '카드 넘기는 소리도 박자 같아요. 어서 와요.'
      ],
      after: [
        '{winner} 쪽이 제일 빨리 다 맞췄어요. 축하해요.',
        '손끝이 노래 같았어요. {winner} 쪽, 멋졌어요.'
      ],
      none: [
        '겨룬 쪽이 둘이 안 돼서 이번엔 상이 없어요.',
        '카드 소리가 조금 조용했어요. 다음엔 함께해요.'
      ]
    },
    colorfind: {
      soon: [
        '10분 뒤에 다른 색 찾기 대회가 열려요.',
        '최고 점수로 겨뤄요. 눈을 갈대처럼 가늘게 떠 봐요.'
      ],
      live: [
        '색 하나가 몰래 달라요. 참가하기를 눌러 봐요.',
        '바람 색이 바뀌는 걸 읽는 눈, 기다리고 있어요.'
      ],
      after: [
        '{winner} 쪽 눈이 제일 밝았어요. 축하해요.',
        '미세한 색 차이도 놓치지 않았어요. {winner} 쪽, 최고예요.'
      ],
      none: [
        '참가한 쪽이 둘이 안 돼서 상이 없어요.',
        '색은 같이 볼 때 더 고와요. 다음엔 함께해요.'
      ]
    },
    rhythm: {
      soon: [
        '10분 뒤에 비트 탭 대회예요. 내 박자 대회예요.',
        '최고 점수로 겨뤄요. 귀를 열고 손을 가볍게 해요.'
      ],
      live: [
        '박자가 흐르고 있어요. 나한테 참가를 눌러요.',
        '박자를 타는 손이면 누구든 환영이에요. 어서 와요.'
      ],
      after: [
        '{winner} 쪽 박자는 정말 곱고 정확했어요. 축하해요.',
        '들으면서 몸이 저절로 흔들렸어요. {winner} 쪽, 멋져요.'
      ],
      none: [
        '박자 맞출 쪽이 둘이 안 돼서 상은 없어요.',
        '합주는 둘부터예요. 다음엔 같이 쳐요.'
      ]
    },
    freecell: {
      soon: [
        '10분 뒤에 프리셀 대회예요. 모두 같은 패를 받아요.',
        '가장 빨리 푸는 쪽이 이겨요. 천천히, 그러나 빠르게요.'
      ],
      live: [
        '같은 패, 같은 출발선이에요. 참가하기를 눌러요.',
        '카드 한 장씩 풀리는 소리가 노래 같아요.'
      ],
      after: [
        '{winner} 쪽이 가장 빨리 풀었어요. 축하해요.',
        '막힘없이 흐르는 소절 같았어요. {winner} 쪽, 최고예요.'
      ],
      none: [
        '푼 쪽이 둘이 안 돼서 이번엔 상이 없어요.',
        '혼자 푸는 건 쉬는 박자예요. 다음엔 함께해요.'
      ]
    },
    stairs: {
      soon: [
        '10분 뒤에 하늘 계단 대회가 열려요.',
        '가장 높은 칸까지 오른 쪽이 이겨요. 숨 크게 쉬어요.'
      ],
      live: [
        '구름 사이로 계단이 이어져요. 참가를 눌러 봐요.',
        '한 칸씩 박자 맞춰 오르면 돼요. 어서 와요.'
      ],
      after: [
        '{winner} 쪽이 제일 높이 올랐어요. 축하해요.',
        '높은 음까지 거침없었어요. {winner} 쪽, 멋졌어요.'
      ],
      none: [
        '오른 쪽이 둘이 안 돼서 상은 없어요. 아쉬워요.',
        '계단은 같이 오를 때 더 높아요. 다음에 함께해요.'
      ]
    },
    numbers: {
      soon: [
        '10분 뒤에 숫자 터치 대회예요. 빠른 손이 이겨요.',
        '순서대로 톡톡 짚어요. 가장 빠른 기록이 일등이에요.'
      ],
      live: [
        '숫자가 흩어져 있어요. 나한테 참가를 눌러요.',
        '하나, 둘, 셋, 박자 세듯이 짚어 봐요.'
      ],
      after: [
        '{winner} 쪽 손이 제일 빨랐어요. 축하해요.',
        '숫자 세는 박자가 흠잡을 데 없었어요. {winner} 쪽, 최고예요.'
      ],
      none: [
        '겨룬 쪽이 둘이 안 돼서 이번엔 상이 없어요.',
        '숫자도 둘이 세야 재밌어요. 다음엔 같이 해요.'
      ]
    },
    spider: {
      soon: [
        '10분 뒤에 스파이더 대회예요. 같은 패로 겨뤄요.',
        '점수가 가장 높은 쪽이 이겨요. 차분히 풀어 봐요.'
      ],
      live: [
        '카드 거미줄이 쳐졌어요. 참가하기를 눌러요.',
        '한 줄씩 정리하다 보면 노래가 돼요. 어서 와요.'
      ],
      after: [
        '{winner} 쪽 점수가 제일 높았어요. 축하해요.',
        '줄이 하나씩 풀리는 게 소절 같았어요. {winner} 쪽, 멋져요.'
      ],
      none: [
        '푼 쪽이 둘이 안 돼서 상은 없어요.',
        '거미줄도 같이 풀면 덜 얽혀요. 다음엔 함께해요.'
      ]
    },
    reaction: {
      soon: [
        '10분 뒤에 반응속도 대회가 열려요.',
        '신호에 가장 빨리 반응한 쪽이 이겨요. 귀를 세워요.'
      ],
      live: [
        '신호가 오면 바로 눌러요. 나한테 참가를 눌러요.',
        '쉼표 뒤의 첫 박처럼, 딱 맞춰 눌러 봐요.'
      ],
      after: [
        '{winner} 쪽 반응이 가장 빨랐어요. 축하해요.',
        '첫 박을 놓치지 않았어요. {winner} 쪽, 정말 대단해요.'
      ],
      none: [
        '신호를 받을 쪽이 둘이 안 돼서 상이 없어요.',
        '박자는 둘부터 맞춰져요. 다음엔 같이 해요.'
      ]
    }
  },
  idle: [
    '내일 14:00 · {game} 대회가 열려요. 천막에서 봐요.',
    '다음 대회는 내일 14:00 · {game}. 손 풀어 둬요.',
    '내일 14:00 · {game} 대회예요. 미리 박자를 맞춰 둬요.'
  ],
  podium1: [
    '{name} 쪽이 첫째예요. 제일 높은 소절이었어요.',
    '1등 {name} 쪽, 축하해요. 박수가 끝나질 않아요.',
    '{name} 쪽이 오늘의 주인공이에요. 멋졌어요.'
  ],
  podium2: [
    '{name} 쪽이 둘째예요. 바로 뒤를 따르는 화음이었어요.',
    '2등 {name} 쪽, 정말 잘했어요. 축하해요.',
    '{name} 쪽도 반짝였어요. 다음엔 더 높이 가요.'
  ],
  podium3: [
    '{name} 쪽이 셋째예요. 든든한 저음 같았어요.',
    '3등 {name} 쪽, 축하해요. 끝까지 박자를 지켰어요.',
    '{name} 쪽도 멋졌어요. 박수를 보내요.'
  ],
  joined: [
    '참가 접수됐어요. 숨 한 번 고르고 시작해요.',
    '자리가 마련됐어요. 가볍게, 박자 타듯 가 봐요.',
    '좋아요, 판이 열려요. 바람도 도와줄 거예요.'
  ]
});
  const cast = () => root.IslandCast || require('./island-cast.js');
  const fill = (line, vars) => Object.entries(vars).reduce((s, [k, w]) => cast().slot(s, k, String(w)), line);
  // a line: a game's (key soon / live / after / none) or the tent's (idle, podium1~3, joined)
  function say(kind, key, vars = {}, random = Math.random) {
    const list = LINES.games[kind]?.[key] || (LINES.games[key] ? null : LINES[key]); if (!list?.length) return null;
    return fill(list[Math.floor(random() * list.length) % list.length], vars);
  }
  const api = { LINES, say };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.ContestLines = api;
  if (typeof require === 'function' && typeof module === 'object' && require.main === module) {
    const assert = require('node:assert/strict');
    for (const g of ["whack","klondike","colorfind","rhythm","freecell","stairs","numbers","spider","reaction"]) for (const k of ['soon', 'live', 'after', 'none']) assert.ok(say(g, k, { winner: '하나' }));
    assert.equal(say('whack', 'after', { winner: '하나' }, () => 0), '하나 쪽 손박자가 제일 빨랐어요. 축하해요.');
    assert.equal(say(null, 'podium1', { name: '솔' }, () => 0), '솔 쪽이 첫째예요. 제일 높은 소절이었어요.');
    assert.match(say(null, 'idle', { game: '프리셀' }, () => 0), /^내일 14:00 · 프리셀 대회/);
    assert.equal(say('fish', 'soon'), null); assert.ok(!/[{}]/.test(say('rhythm', 'after', { winner: '은빛' })));
    console.log('contest-lines ok');
  }
})(globalThis);
