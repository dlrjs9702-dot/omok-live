# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.71 AI 대전·게임별 랭킹(한판마당 자료 4차)

- 지시(사용자 2026-10-12): 마지막 묶음 — 오목 AI는 「연습으로 둔다」(포인트 없음). 같은 묶음의 랭킹과 함께. 윷놀이 AI 대신 두기는 설계 결정 필요로 보류(아래).
- AI 대전: `public/reflex/js/games/{gomoku,connect4,reversi,ai-core,rules,chess-core,go-core,turnnet}.js` 원본(ai-core·rules가 체스·바둑 코어를 import해서 함께). `public/reflex/js/cosmetics.js`는 우리 것(자료에 없는 꾸미기 상점 대신 늘 기본 바둑판·흑백 돌). 고친 곳: `reversi.js` 이름 「리버시」→「오델로」. 싱글게임 → 「AI 대전」(`#soloAiBtn`) → reflex.js `open('ai')`. AI 난이도 쉬움·보통·어려움(`E.level`), 게임의 `options`를 그대로 고르기로(오목 규칙 렌주룰/3수 교환·먼저 두기, 사목·오델로 먼저 두기 — reflex.js가 퍼즐의 「문제」 고르기도 같은 길로 일반화). AI 계산은 브라우저(자료 그대로). 결과는 서버로 보내지 않음(포인트·전적 없음). 사목 색은 자료 그대로 노랑/분홍(우리 방 게임은 빨강/노랑).
- 게임별 랭킹: `lib/game-ranking.js`(자료 `ranking-excerpt.js`의 `weekStart`·`wilson` 그대로 + 순위 정렬), 전적 저장소 `matchesOf(game, since)`(JSON·PostgreSQL, 색인 `game_match_history_game_at_idx`), `GET /api/records/ranking?game=&week=this|all` → 상위 20·내 순위. 10판 이상, 무승부 반 승, 윌슨 하한 → 판수 → 그 기록에 먼저 도달(마지막 판 시각), 같은 점수 같은 순위, 이번 주 = 서울 월요일 0시부터. 화면: 내 전적 「랭킹」 → 게임(규칙 설명의 게임 목록, 랜드킹·잿빛 원정 제외)·이번 주/전체. 이름은 전적 조회와 같은 플레이어 목록(입장 키 닉네임).
- Codex 검토 2건 반영: ① 자료 `rules.js` `gmForbidden`이 한 수로 5목과 다른 방향 장목이 함께 생기면 5목을 먼저 봐서 승리로 처리 — 우리 오목(`lib/game.js`)은 장목 금수라 장목을 먼저 보게 고침(주석 「아일랜드 v1.10.71」, `test/hanpan-gomoku-rules.test.js`, 자료의 렌주 시험 `gomoku-renju.mjs`도 그대로 통과) ② 게임 선택이 랜드킹·잿빛 원정일 때 랭킹 창이 빈 게임으로 열려 오류 → 오목으로.
- 보류 — 윷놀이 AI 대신 두기: 우리 윷은 2인(1:1)이고, 한판마당도 1:1 대결은 AI가 대신 두지 않고 재접속을 기다린다(대신 두기는 2~4인 여럿이 판만). 1:1에서 대신 두면 자리 비운 사람이 참가 포인트·전적을 AI 덕에 얻을 수 있고, 자료의 `yutAi`는 한판마당 윷 규칙 형식이라 우리 규칙(빽도·지름길·완주 직전 칸)에 맞춘 연결이 필요 — 사용자 결정 대기.
- 검증: `test/game-ranking.test.js`(공식·순위·같은 순위·주 경계, JSON·PostgreSQL 기간 조회, API), e2e 「AI 대전」(오목 두면 AI가 받아 둠·서버로 안 보냄)·「랭킹」(PC·휴대폰 프로필). 실제 휴대폰 미검증.

## v1.10.70 카드 게임 3종·게임 목록 뒤로 가기(한판마당 자료 3차)

- 지시(사용자 2026-10-12): 한판마당 다음 묶음(카드 3종) + 순발력·퍼즐 목록의 「나가기」가 바로 아일랜드로 가므로 뒤로 가는 버튼 — 함께 한 패치.
- 자료: `public/reflex/js/games/{klondike,freecell,spider,freecell-deals,cards}.js` 원본. 고친 곳(주석 「아일랜드 v1.10.70」): 섞기·프리셀 게임 번호를 서버가 준 시드(`E.opts.seed`, `pz-util.js` `rng`)로 — 서버가 같은 판을 다시 나누려고; 클론다이크 소개 문구에서 「윈도우의 그 카드놀이!」(제품 이름) 뺌.
- 화면: 싱글게임 → 「카드 게임」(`#soloCardsBtn`) → 같은 `#reflexView`(`open('cards')`). 난이도는 게임의 `levelIds`(클론다이크 1장/3장 넘기기, 프리셀 빈칸 4/3개, 스파이더 1·2·4벌).
- 서버 확인(`lib/cards.js`·`lib/card-worker.mjs`, `/api/solo/cards`·`/start`·`/finish`): 판을 열 때 서버가 시드를 준다(메모리 3시간). 화면(reflex.js)은 판 동안 행동을 적는다 — 게임의 `doMove`(`m,from,idx,to`), `flip`(`f`)·`deal`(`d`)·`undo`(`u`), 그리고 `doMove` 밖에서 일어난 `Table.move`(`a,…` 클론다이크 마무리·프리셀 자동 올리기). 끝나면 `;`로 이은 기록(5,000개까지, 46,000자)을 보낸다. 서버는 작업 스레드에서 **화면과 같은 게임 코드**(엔진·cards·각 게임)를 브라우저 부품만 아무 값이나 받는 대역(Proxy)으로 두고 같은 시드로 나눈 뒤 기록대로 다시 둔다 — 이동마다 게임 자신의 `canPick`/`run`·`canDrop`으로 확인, 규칙에 없는 이동·끝 뒤의 행동·이기지 못한 기록은 거부(400). 스파이더 점수는 재생한 점수, 클론다이크·프리셀 시간 기록은 서버 시계(판을 나눈 때부터 보고까지 — 화면 시계는 작게 보낼 수 있어 쓰지 않음, Codex 검토). 3시간 지난 판은 보고 때 거부(순발력 판도 1시간, Codex 검토). 지급: 클론다이크 2,000/4,000, 프리셀 3,000/5,000, 스파이더 3,000/6,000/10,000P, 세 게임 합쳐 하루 30,000P(`soloDaily` 날짜 이름 `cards:YYYY-MM-DD`, 순발력과 별도), 60초 안에 끝낸 판은 0P. 기록은 클론다이크·프리셀 짧을수록, 스파이더 높을수록.
- v1.10.69 퍼즐 Codex 검토(늦게 받음, 이 패치에서 고침): ① 같은 브라우저의 계정들이 오늘의 문제 진행·완료 표시를 함께 썼다(`Stats.uid`가 늘 `guest`) → 서버가 계정별 익명 id(`/api/solo/puzzle` `uid`, sha256 16자)를 주고 퍼즐을 열 때 `Stats.load(uid)` ② 보내기 실패(네트워크·503) 뒤 다시 보낼 길이 없었다 → puzzle-kit이 완료 표시 전에 적는 자료의 보낼 기록함(`outbox.js`, `gc.outbox.<uid>`)을 씀: 서버가 확정 답(2xx·4xx, 429 제외)을 주면 빼고, 아니면 남겨 퍼즐을 다시 열 때 다시 보낸다. e2e 「퍼즐」이 첫 보내기를 끊어 기록함에 남는 것 → 다시 열면 보내져 기록되는 것까지 확인.
- 뒤로 가기: 세 목록 왼쪽 위 「나가기」 → 「‹ 뒤로」(Esc도 같음) — 게임관 창을 다시 연다(게임방에서 나올 때와 같은 `PLAZA_FACILITIES games`, 탭은 마지막 「싱글게임」 그대로). 섬 밖(옛 로비)에서는 로비로.
- 검증: `test/cards-server.test.js` — 시험용 탐욕 봇(`test-support/spider-bot.mjs`, 게임 코드로 1벌 스파이더를 두고 같은 형식의 기록을 씀)이 이긴 판을 재생하면 같은 점수로 승리, 다른 시드·중간까지·규칙 밖은 거부; API 시드·한 번만·안 끝난 판 400·빠르면 0P·지급·기록. e2e 「카드 게임」(화면의 스파이더를 같은 봇이 게임 함수로 끝까지 둠 → 화면이 적은 기록을 서버가 재생해 확인·기록, 「‹ 뒤로」는 게임 선택으로, PC·휴대폰 프로필). 세 게임 PC·휴대폰 크기 화면 확인. 클론다이크도 탐욕 봇(`test-support/klondike-bot.mjs`)으로 이긴 판의 마무리 자동 이동(`a`)까지 재생 확인(단위), e2e 「카드놀이」는 화면의 실제 update()가 마무리한 판을 서버가 확인. 프리셀 승리 재생은 자동 시험 없음(자동 올리기는 클론다이크와 같은 길) — 실제 클리어 확인 필요. 실제 휴대폰 미검증.

## v1.10.69 퍼즐 4종·오늘의 문제·게임 안내(한판마당 자료 2차)

- 지시(사용자 2026-10-12): 남은 한판마당 자료를 세 번에 나눠 — 1번 「퍼즐 4종 + 오늘의 문제 + 게임 안내 5종」(다음 카드 3종, 그다음 랭킹 + 윷 AI 대신 두기).
- 자료: `public/reflex/js/games/`에 퍼즐 원본 그대로(`{sudoku,nonogram,hashi,circuit}.js` 화면, `*-core.js` 생성·풀이·힌트, `pz-util.js`·`pz-bank.js`·`nonogram-pics.js`·`puzzle-kit.js`·브라우저 `pz-worker.js`), `js/outbox.js`(puzzle-kit이 import, 우리는 기록함을 쓰지 않음: 사용자 id가 `guest`라 적지 않는 길). `public/reflex/js/package.json`(`type: module`)로 서버도 같은 코어를 ES 모듈로 읽는다 — 서버·화면이 한 벌.
- 화면: 싱글게임 → 「퍼즐」(`#soloPuzzleBtn`) → 순발력 게임과 같은 `#reflexView`(reflex.js가 `open('puzzle')`로 목록만 바꿈). 게임 화면에 문제 선택(오늘의 문제 · 새 문제(연습))과 난이도(오늘의 문제일 때 포인트 표시). 오늘의 문제 진행은 자료대로 기기에 저장되어 나갔다 와도 이어 푼다(시간도 이어짐), 처음 푼 뒤 같은 날 다시 하면 연습. 퍼즐 중 Esc는 퍼즐 자체(힌트 닫기)에 맡기고 ✕로 나간다. 스도쿠는 방향키·숫자·Backspace·m(메모)·h(힌트)도 됨(자료 그대로).
- 서버(`lib/puzzle-daily.js`·`lib/puzzle-worker.mjs`, `/api/solo/puzzle`·`/start`·`/finish`): 자료 `server/pzdaily.js` 방식 — 화면이 보낸 푼 판을 서버가 같은 시드로 그날 정답을 작업 스레드에서 다시 만들어 비교(캐시 120개, 대기 6개·30초 넘으면 503 다시 시도). 날짜는 오늘·어제(서울)만, 버전 1만. 지급: 게임·난이도·날짜마다 첫 정답 한 번(정산 id = sha256(계정|게임|난이도|날짜), `soloClear`·사유 `solo_game`) 쉬움 2,000 / 보통 3,000 / 어려움 5,000P(하루 최대 40,000P). 사람이 못 푸는 시간(쉬움 15·보통 30·어려움 45초 미만: 기록 시간 또는 서버가 본 처음 연 때부터)은 0P(그날 기회 사용). 처음 연 때는 메모리(`puzzleStarts`, 2일) — 재시작 뒤에는 화면이 보낸 시간만 본다. 연습은 서버에 보내지 않음(포인트 없음, 결정 ③ 「연습 보상 없음 또는 소액」 중 없음). 기록은 게임·난이도별 최고(짧을수록).
- 주의: 작업 스레드는 리스너를 단 뒤에 `unref()`(먼저 하면 리스너가 프로세스를 붙잡아 시험이 끝나지 않음).
- 게임 안내(자료 05): `public/game-guides.js`(window.GameGuides) — 오목(2:2 포함)·사목·오델로·윷놀이·지뢰찾기의 상황 예시 그림(자료 `guide-figs.mjs` SVG, 사목은 우리 색 빨강 선·노랑 후로 바꿈)·자주 하는 실수·잘하는 요령. 문구는 우리 규칙과 대조해 고침: 오목 금수 × 표시·AI·3수 교환 문장 제외, 사목 칩→돌·색, 윷은 던질 때마다 바로 옮기므로 「결과 쓰는 순서」 사례·실수 제외. 자료의 HTML 페이지는 인라인 style(CSP)·한판마당 메뉴·다른 규칙이 섞여 쓰지 않았다. 표시: 게임 선택 「자세히 보기」의 규칙 설명 아래(`#gameGuideMore`), 지뢰찾기 창 「요령」.
- 검증: `test/puzzle-daily-server.test.js`(네 퍼즐 같은 날 같은 정답·틀린 판·다른 버전, API 처음 한 번·틀린 판/지난 날 400·빠르면 0P·지급·기록), e2e `reflex.spec.js` 「퍼즐」(스도쿠 오늘의 문제를 키보드로 실제로 풀어 서버 정답 확인·기록, PC·휴대폰 프로필)·「게임 안내」(사목 그림·문구, 오목 2개, 빙고 없음, 지뢰찾기 요령). 네 퍼즐 PC·휴대폰 크기 화면 확인. 실제 휴대폰 미검증.
