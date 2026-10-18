# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.95 날씨·별똥별(A4 일부), 게임관 점검 반영 2차(A3)

- 지시: 구현 순서 A3 나머지(작업서 gamehall-fix-spec-20261018.md)와 A4 「함께하는 섬 — 에셋 없이 되는 것」의 날씨·별똥별.
- 날씨(`lib/island-weather.js`): 서울 하루의 3시간 단위마다 맑음·비(약 1/4, 시드 고정 — 서버마다 같음), 비 갠 뒤 30분 무지개. `/api/island/weather`, 관리자 고정 `/api/admin/island/weather`(worldValue `weather`, `islandWeather` 방송). 화면: 비 줄기(화질 단계별 200/450/900)·겨울 구역은 눈(`seasonAt`)·비 올 때 하늘·조명 어둡게·무지개는 시야 위 띠(카메라가 아래를 봐 하늘이 화면에 없음). 비 오는 동안 낚시는 한 번 더 뽑아 비싼 쪽(`where.rain`).
- 별똥별(`lib/island-stars.js`): 서울 밤(20~4시) 30분마다 45%로 한 개, 시각은 시드 고정. `/api/island/stars`(지금·다음 별, 어제 소원 선물 300P 지급 — `claimEvent star_gift_<slot>` 1회), `/api/island/stars/wish`(떨어지는 20초 안 1회, 계정의 `stars` 문서에 기록). 우체통(B 47)이 생기면 선물을 그쪽으로.
- A3 2차: 맞고 결과 창(body로 옮긴 가운데 창, 항목 한 줄씩, [한 판 더]·[게임관으로]·[판 보기]), 따 온 패 「n장부터」(엔진 `SCORE_FROM`·`PIBAK_MAX`를 공개 상태로)·단·고도리 n/3·피박·광박 위험, 이름표 얼굴(`publicPlayer` face·title — 피부·머리색 요약), 오목 AI 연습에 장착한 오목 돌 스킨(`/api/skins`), 카드놀이 공용 탁자(초록 펠트+나무 테두리)·도둑잡기 같은 앞면·파란 뒷면·부채꼴 상대 패, 다빈치 차례 시간은 고리로.
- 남은 A4: 주말 섬 대회. A5: 메신저 SSE, 기념사진 2버튼, 근거리·같은 열차 채팅, 통합 UI, 관리자 나머지.
- 검증: e2e island-weather·island-stars(관리자 고정·겨울 눈·무지개, 별 시계 이동 시험 훅)·gostop-late-layout(결과 창)·reflex(AI 스킨)·skins-cards, 단위 gostop 60건·theme-light. Codex 검토 대기(사용량 한도, 18:19 KST 해제 뒤). 실제 휴대폰·두 기기 미검증.

## v1.10.94 게임관 점검 반영 1차(A3): 게임방 한 화면·차례 시간 고리, 맞고 테이블, 터치 두 번 누르기, 한판마당 PC 넓게

- 지시: 구현 순서 A3, 작업서 gamecenter-notes `docs/gamehall-fix-spec-20261018.md`(기본값 표대로: 공통 틀 먼저, 터치일 때만 오목·맞고 두 번 누르기, 사목 빨강 선공).
- G1 공통 틀(`app.js` `setRoomPlaying`·`fitBoard`·`renderTurnRing`·`chatBubble`·`resultOverlayExtras`): 판 진행 중(`g.status` playing/setup) `body.roomPlaying` — 방 정보는 ⓘ(`#roomInfoBtn`), 빈자리 숨김, 캔버스 판은 남은 높이에 맞춤, `#gameActionsPanel`(윷 던지기·숫자야구·라이어 등, id 그대로)을 판 아래로 옮김, 휴대폰 💬·🎮는 위 막대로, 진행 중 옆 칸 좁게, 빠른 말 8개(방 채팅으로)와 이름표 말풍선, 결과 창에 참가 포인트·[한 판 더]·[게임관으로], 1:1 점수를 이름표 사이에. 서버는 방 상태에 공개 `turnTimer`({ seat, deadlineAt, serverNow }, `publicTurnTimer`).
- G2 맞고(`gostop-ui.js`·styles): 카드 크기를 화면 높이에 맞춤(--hh/--fh/--mh), 따 온 패는 한 줄 겹침, 바닥은 달 자리 6칸 2줄, 고/스톱 창은 테이블 가운데, 점수 이력·머리 줄은 ⓘ 뒤로, 같은 달 바닥패 빛남(마우스 올림·포커스·첫 터치)·터치 두 번 누르기·「버림」 표시, 진행 속도(보통·빠르게·연출 줄임, 이 기기), 자체 뒷면 무늬.
- G3: 게임방 오목 터치 두 번 누르기(첫 탭은 미리보기 돌), AI 연습 오목은 마우스 한 번, AI 연습 사목 빨강 선공·빨강 vs 노랑, 할리갈리 종을 판 가운데로, 문구(「내 차례」, 할리갈리 0.3초 안내 뺌). G4: 카드 게임·퍼즐은 넓은 PC에서 1200px 틀(`wideFrame`), 카드·판 상한 상향.
- 남은 것(다음 묶음): G1-5 이름표 얼굴, G2-4 따 온 패 조건까지 남은 수, G2-5 맞고 결과 창 점수표, G3-2 오목 AI 연습에 내 스킨, G3-5 트럼프 카드 한 벌·도둑잡기 부채꼴, 할리갈리·다빈치·라이어 따로 쓰던 남은 시간 글.
- Codex 검토: v1.10.92 지적 3건(심부름 건넴 뒤 보상 저장 실패 복구, 백화점 충돌 보정이 옆 가구로 밀던 것, 닿지 않던 편지지·액자) 반영, v1.10.93 지적 없음, v1.10.94 지적 2건(터치 첫 탭 선택이 판·차례를 넘어 남던 것) 반영.
- 검증: e2e room-play-layout(오목 4크기·윷 2크기·오목 터치)·gostop-late-layout(4크기, 판 후반)·reflex(PC 넓게)와 기존 방·고스톱 시험 통과(로컬은 한 번에 하나씩 — 동시 실행 시 관리자 로그인 제한), 단위 general-store(가구 안에 서지 않음·모든 물건 고를 수 있음). 실제 휴대폰·두 기기 미검증.

## v1.10.93 체형(DS 인상), 마을 주민 미니게임 퀘스트 2단계(7명·공동 진행도)

- 지시(사용자 2026-10-18): 구현 순서 `docs/implementation-order-20261018.md` A1(체형·팔, 시안 v2) → A2(주민 미니게임 퀘스트 2단계·정자 할아버지 AI 대전, assets 39).
- 체형(`asset-loader.js` `slimmedGeometry`, 등록부 `character.base.slim`): 몸통 폭 82%·깊이 80%, 팔 55%·다리 50%(뼈 축 쪽으로 스킨 가중치만큼), 손 82%·신발 85%. 몸과 모든 착용물(스킨·IP 파츠·변신)에 같은 변형을 적용해 따라감 — 재맞춤 주문 불필요. 모션 파일·리그는 그대로.
- 마을 주민(assets 39, `island-terrain.js` `VILLAGE`·`villageSolids`, `island-quests.js` 7편, `island-cast.js` 15~21): 한 주에 한 명씩(`VILLAGE` 순환, 주간 총액 그대로). 화가×다른 색 찾기→벽화 4단계, 거리 악단×비트 탭→무대 공연, 역무원×숫자 터치(`lower`)→남서해안역, 전기 담당×오늘의 회로 연결→가로등 3개, 공사 인부×오늘의 다리 잇기→징검돌 4단계(물 높이 −0.23), 도서관 할아버지×오늘의 네모로직→책 수레, 정자 할아버지×게임방 AI 오목→오델로(서버가 AI를 두고 승패 판정, `aiWinProgress`). 공동 진행도는 `/api/island/farm`의 `village`(그 주 도운 사람 수).
- 퍼즐 단계(`puzzle: true`): 오늘의 문제 쉬움의 정답 확인(`/api/solo/puzzle/finish`)이 단계를 채움. 이미 오늘 푼 사람은 말을 거는 순간 정산 기록(`puzzleSolved`)으로 바로 완료. 퀘스트로 연 판은 항상 오늘의 문제(`reflex.js` modeOf).
- 마을 소품 충돌: 충돌 격자는 시작 때 한 번 만들어지므로 마을 소품 원을 시작 때 넣음(전에는 나중에 넣어 통과됐음).
- 검증: 단위(village-quests·puzzle-quest-server·farmer·island-quests) 통과, e2e island-assets 등록부(백화점·마을 전용 모델 제외) 통과. Codex 검토 대기(사용량). 실제 휴대폰·GPU 미검증.
