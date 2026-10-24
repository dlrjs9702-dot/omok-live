// v1.10.73 게임관 전면 개편 (IDEAS #future-gamehall-renewal, 사용자 확정 2026-10-12): every game in the game hall as one
// card of the same size -- its two own colours (card gradient and icon only, white text on both at 4.5:1 or more,
// test/gamehall-catalog.test.js), a drawn icon, a name, its categories and players. A card opens the game's sheet.
// `room`: the game room's gameType (data-game). `set`/`game`: a solo game on the 한판마당 screen (public/reflex/reflex.js).
// `launch`: another solo screen (mines, herosurv). `ai`: the AI practice of that board game (reflex 'ai' set).
// `soon`: still being made (준비 중). `art`: an icon of public/reflex/js/icons.js, or `svg` drawn here (64×64, white).
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GamehallCatalog = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const CATEGORIES = [
    ['all', '전체'], ['board', '판 게임'], ['cards', '카드·화투'], ['party', '파티·추리'], ['coop', '협동'],
    ['reflex', '순발력'], ['puzzle', '퍼즐'], ['solo', '혼자 하기'], ['ai', 'AI 연습'],
  ];
  const SVG = {
    pencil: '<path d="M14 50l4-14 26-26a5 5 0 0 1 7 0l3 3a5 5 0 0 1 0 7L28 46z" fill="currentColor"/><path d="M14 50l14-4-10-10z" fill="currentColor" opacity=".55"/>',
    mask: '<path d="M8 22c8-6 40-6 48 0 0 16-8 28-24 28S8 38 8 22z" fill="currentColor"/><ellipse cx="22" cy="29" rx="6" ry="4" fill="#000" opacity=".45"/><ellipse cx="42" cy="29" rx="6" ry="4" fill="#000" opacity=".45"/>',
    question: '<path d="M22 22a10 10 0 1 1 15 9c-3 2-5 4-5 8v3" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="32" cy="52" r="4.5" fill="currentColor"/>',
    virus: '<circle cx="32" cy="32" r="13" fill="currentColor"/><g stroke="currentColor" stroke-width="4" stroke-linecap="round"><path d="M32 8v8M32 48v8M8 32h8M48 32h8M15 15l6 6M43 43l6 6M15 49l6-6M43 21l6-6"/></g>',
    bell: '<path d="M14 44c4-4 4-10 4-16a14 14 0 0 1 28 0c0 6 0 12 4 16z" fill="currentColor"/><rect x="10" y="44" width="44" height="6" rx="3" fill="currentColor"/><circle cx="32" cy="12" r="4" fill="currentColor"/>',
    hwatu: '<rect x="10" y="12" width="24" height="38" rx="4" fill="currentColor" transform="rotate(-10 22 31)"/><rect x="30" y="14" width="24" height="38" rx="4" fill="currentColor" opacity=".7" transform="rotate(8 42 33)"/><circle cx="23" cy="26" r="6" fill="#000" opacity=".35"/>',
    city: '<path d="M8 54V30l12-8v32zM24 54V16l14-6v44zM42 54V26l14 6v22z" fill="currentColor"/>',
    sword: '<path d="M44 8l12 0 0 12-24 24-12-12z" fill="currentColor"/><path d="M14 38l12 12-4 4-4-4-6 6-4-4 6-6-4-4z" fill="currentColor" opacity=".7"/>',
    hero: '<circle cx="32" cy="16" r="8" fill="currentColor"/><path d="M18 56l4-24h20l4 24z" fill="currentColor"/><path d="M46 30l10-10" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    bingo: '<rect x="8" y="8" width="48" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="5"/><path d="M24 8v48M40 8v48M8 24h48M8 40h48" stroke="currentColor" stroke-width="3"/><path d="M12 12l40 40" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    dots: '<g fill="currentColor"><circle cx="14" cy="14" r="5"/><circle cx="32" cy="14" r="5"/><circle cx="50" cy="14" r="5"/><circle cx="14" cy="32" r="5"/><circle cx="32" cy="32" r="5"/><circle cx="50" cy="32" r="5"/><circle cx="14" cy="50" r="5"/><circle cx="32" cy="50" r="5"/><circle cx="50" cy="50" r="5"/></g><path d="M14 14h18v18H14z" fill="currentColor" opacity=".5"/>',
    bat: '<circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" stroke-width="5"/><path d="M20 18c6 8 6 20 0 28M44 18c-6 8-6 20 0 28" fill="none" stroke="currentColor" stroke-width="3"/>',
    tiles: '<rect x="8" y="14" width="14" height="36" rx="3" fill="currentColor"/><rect x="25" y="14" width="14" height="36" rx="3" fill="currentColor" opacity=".55"/><rect x="42" y="14" width="14" height="36" rx="3" fill="currentColor"/>',
  };
  const how = (...lines) => lines;
  // [id, name, categories, players, colours, art, launch, intro, how]
  const GAMES = [
    { id: 'omok', name: '오목', cats: ['board', 'ai'], players: '2·4인', colors: ['#8a5a1f', '#5c3a12'], art: 'gomoku', room: 'omok', ai: 'gomoku',
      intro: '다섯 개를 먼저 잇는 바둑판 대결', how: how('흑과 백이 번갈아 한 수씩 둡니다', '가로·세로·대각선으로 5개를 먼저 이으면 이깁니다', '흑은 3-3·4-4·6목이 금수, 2vs2 팀전도 있어요') },
    { id: 'connect4', name: '사목', cats: ['board', 'ai'], players: '2인', colors: ['#1d4ed8', '#1e3a8a'], art: 'connect4', room: 'connect4', ai: 'connect4',
      intro: '떨어뜨린 말로 네 개를 잇는 대결', how: how('줄을 골라 말을 떨어뜨리면 맨 아래 빈칸에 놓입니다', '가로·세로·대각선으로 4개를 먼저 이으면 이깁니다', '상대의 세 개 줄은 미리 막으세요') },
    { id: 'othello', name: '오델로', cats: ['board', 'ai'], players: '2인', colors: ['#166534', '#14532d'], art: 'reversi', room: 'othello', ai: 'reversi',
      intro: '사이에 낀 돌을 뒤집는 판 게임', how: how('상대 돌을 내 돌 사이에 끼우는 자리에만 둡니다', '끼운 돌은 모두 내 색으로 뒤집힙니다', '판이 다 차면 돌이 많은 쪽이 이깁니다') },
    { id: 'yut', name: '윷놀이', cats: ['board'], players: '2인', colors: ['#9a3412', '#7c2d12'], art: 'yut', room: 'yut',
      intro: '윷을 던져 말 네 개를 먼저 내는 놀이', how: how('윷을 던져 나온 만큼 말을 움직입니다', '윷·모가 나오거나 상대 말을 잡으면 한 번 더', '말 네 개가 먼저 한 바퀴를 돌아 나오면 이깁니다') },
    { id: 'dots', name: '점과 상자', cats: ['board'], players: '2인', colors: ['#0f766e', '#115e59'], svg: 'dots', room: 'dots',
      intro: '선을 그어 상자를 더 많이 닫는 대결', how: how('점 사이에 선을 하나씩 긋습니다', '상자의 네 번째 선을 그으면 내 상자가 되고 한 번 더', '상자를 더 많이 가진 쪽이 이깁니다') },
    { id: 'bingo', name: '빙고', cats: ['board', 'party'], players: '2~4인', colors: ['#b45309', '#92400e'], svg: 'bingo', room: 'bingo',
      intro: '부른 숫자로 줄을 먼저 채우는 빙고', how: how('내 판에 숫자를 채운 뒤 차례로 숫자를 부릅니다', '불린 숫자는 모두의 판에서 지워집니다', '지운 줄이 먼저 다섯 줄이 되면 빙고!') },
    { id: 'gostop', name: '고스톱 · 맞고', cats: ['cards'], players: '2~3인', colors: ['#b91c1c', '#14532d'], svg: 'hwatu', room: 'gostop',
      intro: '화투로 점수를 내는 고스톱과 맞고', how: how('같은 달의 패를 맞춰 가져옵니다', '광·띠·열끗·피로 점수를 냅니다', '점수가 나면 고 또는 스톱, 점당 포인트를 고릅니다') },
    { id: 'oldmaid', name: '도둑잡기', cats: ['cards'], players: '2~4인', colors: ['#4338ca', '#312e81'], art: 'spades', room: 'oldmaid',
      intro: '마지막에 조커를 든 사람이 지는 카드놀이', how: how('같은 숫자 두 장은 버립니다', '옆 사람의 카드를 한 장씩 뽑아 옵니다', '조커 한 장만 남은 사람이 집니다') },
    { id: 'halligalli', name: '할리갈리', cats: ['cards', 'reflex'], players: '2~6인', colors: ['#c2410c', '#9a3412'], svg: 'bell', room: 'halligalli',
      intro: '같은 과일 다섯 개에 종을 치는 순발력 카드', how: how('차례대로 카드를 한 장씩 뒤집습니다', '보이는 같은 과일이 정확히 5개면 종을 칩니다', '먼저 친 사람이 카드를 모두 가져갑니다') },
    { id: 'davinci', name: '다빈치 코드', cats: ['cards', 'party'], players: '2~4인', colors: ['#374151', '#1f2937'], svg: 'tiles', room: 'davinci',
      intro: '상대의 숨은 숫자 타일을 맞히는 추리', how: how('타일은 작은 숫자부터 차례로 세워 둡니다', '상대 타일 하나를 골라 숫자를 맞힙니다', '맞히면 계속, 틀리면 내 타일 하나를 공개합니다') },
    { id: 'pictionary', name: '그림 맞히기', cats: ['party'], players: '2~8인', colors: ['#be185d', '#9d174d'], svg: 'pencil', room: 'pictionary',
      intro: '그린 그림으로 제시어를 맞히는 파티 게임', how: how('차례가 된 사람이 제시어를 그림으로 그립니다', '나머지는 채팅으로 정답을 맞힙니다', '빨리 맞힐수록 점수가 큽니다') },
    { id: 'liar', name: '라이어게임', cats: ['party'], players: '3~8인', colors: ['#9f1239', '#881337'], svg: 'mask', room: 'liar',
      intro: '제시어를 모르는 라이어를 찾는 추리', how: how('라이어만 제시어를 모릅니다', '돌아가며 제시어를 한 마디씩 설명합니다', '투표로 라이어를 찾으면 시민이 이깁니다') },
    { id: 'twentyquestions', name: '스무고개', cats: ['party', 'coop'], players: '2~8인', colors: ['#0e7490', '#155e75'], svg: 'question', room: 'twentyquestions',
      intro: '스무 번의 질문으로 답을 맞히는 놀이', how: how('출제자가 정한 답을 나머지가 맞힙니다', '예·아니오로 답할 수 있게 묻습니다', '스무 번 안에 맞히면 이깁니다') },
    { id: 'baseball', name: '숫자야구', cats: ['party'], players: '2인', colors: ['#15803d', '#166534'], svg: 'bat', room: 'baseball',
      intro: '상대의 비밀 숫자를 먼저 맞히는 추리', how: how('서로 겹치지 않는 3~4자리 숫자를 정합니다', '추측하면 스트라이크·볼로 힌트를 받습니다', '먼저 모든 자리를 맞히면 이깁니다') },
    { id: 'pandemic', name: '팬데믹', cats: ['coop'], players: '2~4인', colors: ['#b91c1c', '#7f1d1d'], svg: 'virus', room: 'pandemic',
      intro: '모두 힘을 합쳐 전염병을 막는 협동 게임', how: how('도시를 오가며 병을 치료합니다', '같은 색 카드를 모아 치료제를 만듭니다', '치료제 네 개를 만들면 모두 이깁니다') },
    { id: 'whack', name: '두더지 잡기', cats: ['reflex'], players: '혼자', colors: ['#a16207', '#713f12'], art: 'whack', set: 'reflex',
      intro: '30초 동안 튀어나오는 두더지를 잡으세요', how: how('두더지가 올라오면 재빨리 누르기, 10점', '황금 두더지는 30점', '폭탄을 누르면 시간이 3초 줄어요') },
    { id: 'reaction', name: '반응속도', cats: ['reflex'], players: '혼자', colors: ['#dc2626', '#991b1b'], art: 'reaction', set: 'reflex',
      intro: '화면이 초록색으로 바뀌는 순간 누르세요', how: how('빨간 화면에서 기다리다가', '초록색으로 바뀌면 최대한 빨리 누르기', '미리 누르면 그 라운드는 다시, 모두 5라운드') },
    { id: 'colorfind', name: '다른 색 찾기', cats: ['reflex'], players: '혼자', colors: ['#be185d', '#831843'], art: 'colorfind', set: 'reflex',
      intro: '딱 하나 색이 다른 칸을 찾으세요', how: how('비슷한 색 사이에서 하나 다른 칸을 누릅니다', '맞힐수록 칸은 많아지고 색 차이는 줄어요', '틀리면 3초가 줄어요, 60초 동안') },
    { id: 'numbers', name: '숫자 터치', cats: ['reflex'], players: '혼자', colors: ['#2563eb', '#1e40af'], art: 'numbers', set: 'reflex',
      intro: '1부터 순서대로 빠르게 누르세요', how: how('1부터 끝 숫자까지 순서대로 누릅니다', '시작 전 몇 초 동안 숫자 위치를 외울 수 있어요', '틀린 숫자를 누르면 1초 벌칙') },
    { id: 'rhythm', name: '비트 탭', cats: ['reflex'], players: '혼자', colors: ['#7e22ce', '#581c87'], art: 'rhythm', set: 'reflex',
      intro: '비트에 맞춰 떨어지는 노트를 누르세요', how: how('노트가 판정선에 닿는 순간 그 줄을 누릅니다', 'PC는 D·F·J·K 키', '놓치면 체력이 줄어요, 60초를 버텨 보세요') },
    { id: 'stairs', name: '계단 질주', cats: ['reflex'], players: '혼자', colors: ['#0ea5e9', '#0c4a6e'], art: 'stairs', set: 'reflex', // R7 (IDEAS #future-stair-dash)
      intro: '왼쪽·오른쪽 두 버튼으로 끝없는 하늘 계단을 올라요', how: how('다음 계단이 있는 쪽을 누르면 한 칸 올라요(PC는 ← → 또는 A D)', '반대쪽을 누르면 헛디뎌요', '숨 막대가 줄어요 — 오를수록 빨리, 한 칸마다 조금 차요') },
    { id: 'sudoku', name: '스도쿠', cats: ['puzzle'], players: '혼자', colors: ['#0369a1', '#0c4a6e'], art: 'sudoku', set: 'puzzle',
      intro: '가로·세로·3×3 칸마다 1부터 9까지 한 번씩', how: how('빈칸을 누르고 숫자를 골라 채웁니다', '메모로 들어갈 수 있는 숫자를 적어 둘 수 있어요', '오늘의 문제는 처음 푼 한 번만 포인트') },
    { id: 'nonogram', name: '네모로직', cats: ['puzzle'], players: '혼자', colors: ['#4d7c0f', '#365314'], art: 'nonogram', set: 'puzzle',
      intro: '숫자 단서로 칸을 칠해 숨은 그림을 완성', how: how('줄 옆 숫자는 이어 칠한 칸 묶음의 길이예요', '칸을 눌러 칠하고, 끌면 한 줄을 이어 칠해요', '오늘의 문제는 처음 푼 한 번만 포인트') },
    { id: 'hashi', name: '다리 잇기', cats: ['puzzle'], players: '혼자', colors: ['#0f766e', '#134e4a'], art: 'hashi', set: 'puzzle',
      intro: '섬의 숫자만큼 다리를 놓아 모두 이으세요', how: how('섬을 누른 뒤 이을 섬을 누르면 다리가 놓여요', '다리는 가로·세로로만, 엇갈리지 않게', '모든 섬이 하나로 이어지면 완성') },
    { id: 'circuit', name: '회로 연결', cats: ['puzzle'], players: '혼자', colors: ['#a21caf', '#701a75'], art: 'circuit', set: 'puzzle',
      intro: '칸을 돌려 모든 칸에 전기가 흐르게', how: how('칸을 누르면 90도씩 돌아갑니다', '전원과 이어진 칸에 불이 들어와요', '모든 칸에 불이 들어오면 완성') },
    { id: 'mines', name: '지뢰찾기', cats: ['puzzle', 'solo'], players: '혼자', colors: ['#475569', '#334155'], art: 'mines', launch: 'mines',
      intro: '숫자를 단서로 지뢰를 피해 칸을 여세요', how: how('칸의 숫자는 주변 8칸의 지뢰 수예요', '지뢰라고 생각되면 깃발을 꽂습니다', '지뢰 아닌 칸을 모두 열면 성공') },
    { id: 'klondike', name: '카드놀이', cats: ['solo'], players: '혼자', colors: ['#15803d', '#14532d'], art: 'klondike', set: 'cards',
      intro: '모든 카드를 무늬별로 A부터 K까지 올리세요', how: how('색이 다르고 숫자가 1 큰 카드 위에 놓습니다', '더미를 누르면 카드를 넘겨요', '빈 줄에는 K만 놓을 수 있어요') },
    { id: 'freecell', name: '프리셀', cats: ['solo'], players: '혼자', colors: ['#1d4ed8', '#1e3a8a'], art: 'freecell', set: 'cards',
      intro: '빈칸을 잘 써서 카드를 무늬별로 올리세요', how: how('색이 다르고 숫자가 1 큰 카드 위에 놓습니다', '왼쪽 위 빈칸에 카드를 한 장씩 잠시 둡니다', '모든 카드를 올리면 성공') },
    { id: 'spider', name: '스파이더 카드놀이', cats: ['solo'], players: '혼자', colors: ['#334155', '#0f172a'], art: 'spider', set: 'cards',
      intro: '같은 무늬로 K부터 A까지 모아 치우세요', how: how('숫자가 1 큰 카드 위에 놓습니다', '같은 무늬로 K~A를 모으면 치워져요', '더미를 누르면 10장을 새로 나눠요') },
    { id: 'herosurv', name: '두 세계 영웅전', cats: ['solo'], players: '혼자', colors: ['#b45309', '#78350f'], svg: 'hero', launch: 'herosurv',
      intro: '몰려오는 적을 버티는 액션', credit: '원작: 스마트대디 · 게임센터용으로 일부 수정', how: how('방향키로 움직이면 영웅이 알아서 공격합니다', '레벨이 오르면 기술을 고릅니다', '오래 버틸수록 높은 기록') },
    { id: 'cityking', name: '랜드킹', cats: ['board'], players: '2~4인', colors: ['#0369a1', '#075985'], svg: 'city', room: 'cityking', soon: true,
      intro: '도시를 사고 지어 부자가 되는 보드게임', how: how('주사위를 굴려 판을 돕니다', '도시를 사고 건물을 지어 통행료를 받습니다', '아직 만드는 중이에요') },
    { id: 'rpg', name: '잿빛 원정', cats: ['coop'], players: '1~4인', colors: ['#57534e', '#292524'], svg: 'sword', room: 'rpg', soon: true,
      intro: '함께 던전을 탐험하는 원정', how: how('방을 골라 앞으로 나아갑니다', '동료와 힘을 합쳐 적을 물리칩니다', '아직 만드는 중이에요') },
  ];
  // 오늘의 게임: one of the playable games for everyone, turning with the Seoul date
  const DAY = 86400e3; const KST = 9 * 3600e3;
  function todayGame(ms = Date.now()) {
    const ready = GAMES.filter((g) => !g.soon);
    return ready[Math.floor((ms + KST) / DAY) % ready.length];
  }
  const inCategory = (g, cat) => cat === 'all' || g.cats.includes(cat);
  return { CATEGORIES, GAMES, SVG, todayGame, inCategory };
}));
