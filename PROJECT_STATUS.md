# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.72 게임방 AI 자리(오목·사목·오델로)

- 지시(사용자 2026-10-12): 한판마당 오목 등 AI를 우리 오목판에 — ②「게임방 AI 자리」(서버 판정), 전적·랭킹에서 빼고 참가 포인트도 뺀다. 성능 질문에 대한 답: 트래픽은 사람 수 하나와 같고, CPU는 어려움 오목 수당 약 0.7초(로컬) → 작업 스레드 하나에서 차례로 계산해 섬·다른 방은 막지 않음.
- 서버(`lib/room-ai.js`·`lib/room-ai-worker.mjs`): 자료 `ai-core.js`의 `gomokuAi`·`connect4AiAs`·`reversiAiAs`(v1.10.71에 들어온 그 파일, AI 오목 장목 규칙 수정 포함)를 작업 스레드에서. 우리 판(`[y][x]` 'black'/'white')을 위에서부터 한 줄씩 펼친 0/1/2로 넘기고, 돌려받은 칸 번호(사목은 열)를 같은 게임 엔진 `applyMove`로 둔다. 대기 20개·30초 넘으면 실패 → 3초 뒤 다시(유휴 틱도 다시 부름). 최소 0.5초 뒤에 둔다(너무 빠르지 않게).
- 방(`server.js`): `/api/rooms` `ai: easy|normal|hard`(오목·사목·오델로만, 오목 2vs2 아님) → 비공개 방 + AI 참가자(`ai:<방 id>`, 세션·포인트 계정·전적 id 없음, 항상 접속, 이름 「AI · 보통」). 자리 고르기: 한 사람만 흑·백 어느 쪽이든, AI는 맞은편으로 옮겨 앉음(둘째 사람은 관전만, 409). 참가 포인트 없음(`entrySnapshot` null), `recordFinishedMatch`가 바로 끝냄(전적·미션·업적·랭킹 없음), 끊김 판정에서 AI 제외·AI 차례엔 자리비움 시계 없음. 매 행동 뒤·유휴 틱마다 `scheduleAiMove`(판·라운드·수가 그대로일 때만 둠, 오델로 패스 뒤 연속 차례도).
- 화면: 방 만들기 「상대」 사람 / AI 쉬움 / 보통 / 어려움(오목 1vs1·사목·오델로일 때만, `#roomAiChoices`). 게임판·스킨은 평소 방 그대로.
- 검증: `test/room-ai-server.test.js`(빙고·없는 난이도 400, 비공개, 백을 고르면 AI가 흑으로 먼저 둠, 둘째 사람 자리 409, 두면 AI가 받아 둠, 기권 뒤 전적 0판·잔액 그대로, 다음 판에 다시 앉음), e2e 「게임방 AI」(오목 방 UI로 AI 보통 → 흑 → 두면 2수, PC·휴대폰 프로필). 실제 휴대폰 미검증.

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
