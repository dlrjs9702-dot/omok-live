# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.383 호랑이 지능·공격 패턴(결정 12·16·17·18)·Codex #14·#18·비탈·검토 8건

- 지능(①~④): 몸에 맞는 길(앞뒤 칸이 비는 방향만), 끼임 풀기(1.5초 0.3 m도 못 가고 목표에도 못 가까워지면 뒤로 빠져 다른 길, 엉덩이 원 확인), 가로채기·모퉁이 감속, 놓치면 마지막 본 곳 둘러보기, 둘이면 몰고 막기·안전지대 입구 지키기. 큰 바위(0.45 m 이상)는 호랑이만 피함. 쫓을 때 우레 13·안개 12.
- 공격(에셋 159): 서 있는 사람(2.5 m/s 미만)에게 앞발치기·돌며 치기(오른쪽 TurnSwipe·왼쪽 L)·물기 돌진, 그 공격 판정이 지금 자리에 맞을 때만(검토 #1). 달아나는 사람에게 덮치기(2.5 m부터, 서 있으면 4.5 m부터). 화면은 같은 곡선(돌기·달려들기), fadeIn 0.1, 같은 공격 다시면 무게 1(#7).
- 사람 속도는 자세 시각 차이로(#2), 몸 원은 모델 자리 머리 +2.5·어깨 +1.1·엉덩이 −1.9(#3).
- 잡힘: 이송·알림 바로, 가방 저장 늦으면 tigerLost, 못 본 화면엔 다시 붙을 때 한 번 더(/api/island/tiger/seen, #4), 잡힌 화면만 이송(#6), 기록 정리(#8).
- Codex #14 길 계산 재사용·필요한 범위만(틱 평균 0.61 → 0.17 ms), #18 숨은 호랑이 믹서 쉼.
- 비탈(사용자 「허공에 떠 있는 티」): 네 발 땅 높이로 앞뒤 기울이기·옆 8°까지·가장 낮은 발 안 뜨게.
- 자리 비움인 사람도 잡힘(사용자 결정 27 A): 그때는 화면에 남겨 두었다가 돌아와 처음 입력하면 「자리를 비운 사이 …잡혔어요」를 다시, 그 뒤 seen.
- 측정(그려진 몸 자리): 어디든 닿음 6.72 % → 2.58 %, 나무·덤불 2.51 → 1.82 %, 바위 4.55 → 0.75 %, 잡은 횟수 17 → 15(36번). 엉덩이 나머지는 등뼈 휘기로 나중.

## v1.10.382 Codex 371~380 검토 고침(18건 중 16건, #14·#18은 1.10.383 호랑이 묶음) -- notes docs/codex-review-371-380.md 「구현 확인」

- P1: #1 채석 종료 즉시 판정 확정(finishing, 겹친 종료 COLLECT_BUSY, 그 뒤 타격 거절), #2 호랑이 포획 계정마다 8초에 한 번, #3 수조 꺼내기 fid 청구·넣기 저장 실패 때 되돌림, #4 날 지난 재료 인계는 다음 날 첫 대화에서 지급(부탁 ID로 한 번).
- P2: #5 이송 자리 notePlazaSpot·sentT, #6 포획 저장 id·최대 5번·저장 뒤 알림(실패면 「가방은 그대로예요」), #7 서버 늪 자전거 4.3×1.3 m/s, #8 자리 비움은 서버가 본 위치 변화·POST 행동만(화면 idle 지움), #9 쫓기는 중 막혔을 때 NOT_NOW, #10 채굴 자리 조회 뒤 재검사, #11 ‱ 보석 새 키 gem10k(옛 ‰ 무시)·관리 화면 적용값, #12 3배 행사 mushroom*, #13 집 곤충 상자 insect_<종> 전부, #15 호랑이는 'tigers' 프레임으로 별마루섬 근처에만(광장 스냅숏에서 뺌), #16 판매 정산에 extraBy·행사 누계 판매별 한 번. P3: #17 채석 뒤 바위 방송 없음.
- 시험: island-quarry(동시 종료·같은 자리), island-tigers-server(새: 두 마리·늦은 이동·늪·막혔을 때), home-tank-water(저장 실패), resident-affinity(자정 재료), economy(옛 ‰), island-home(26종), island-admin-events(같은 판매 다시), e2e 잡화점 자리 비움(돌아오기 한 걸음).

## v1.10.381 요리 대회 주제·점수 도장(사용자 결정 15 A)·행사 할 일 「섬 대회 참가」(결정 14 A)·크리스마스 안내

- 요리 대회: lib/island-festival COOK_THEMES 6개(버섯·물고기·열매·밭 채소 2+·세 종류 다름·약재)를 서울 날짜 일수 % 6으로 하루 하나, 맞으면 +30점·심사 말 앞에 「오늘 주제에 딱 맞아요!」. 도장 cookStamps: 90 미만 1·90~139 2·140 이상 3(award에 이번 도장 수). 행사 창 요리 대회 칸 「오늘의 주제 · …(맞으면 +30점)」, 결과 「N점 · 도장 N개를 받았어요」, 할 일 줄 「도장 1~3개」. 점수 식은 그대로(재료 값 합/100 + 종류×10).
- 주말 대회(IslandCalendar.CONTEST.on false)가 꺼져 있는 동안 「매주 대회 참가」 줄은 행사 창에서 숨기고 taskOpen도 닫음(켜지면 다시).
- 수확제·크리스마스 tasks에 islandContest 「섬 대회 참가」 도장 1·하루 1: 서버 contestNote에서 그날 섬 대회 기록이 남으면 IslandFestival.award(결과에 stamp, 있을 때만). 행사 창 안내 「매일 HH:MM 섬 대회, 행사 가판대 옆 천막에서 참가해 기록을 남기면」(관리자 대회 시각, /api/island/festival contestTime).
- 크리스마스 「마켓 들르기」·「눈싸움 한 판」 안내가 「요리 대회 칸에서」로 나오던 것 바로잡음.
- 크리스마스 마지막 7일 도장 50 → 55(섬 대회 7). 시험: island-calendar(숨김·하루 1번), festival-server(크리스마스 할 일 목록), island-contest-server(행사 시계 고정, 첫 기록 도장), e2e 계절 행사·크리스마스 창 안내.
- 호랑이 ①~④(결정 16·17)와 공격 패턴은 382, 부팅 무게 383.
