# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.380 자리 비움(총괄 결정 11 「A, 1분으로」)·해변 절벽 가려도 보이기(사용자 「건물, 절벽 등에만」)

- 자리 비움: 화면이 마지막 입력(키·누르기·움직이기·휠·터치)부터 지난 시간을 포즈마다 보냄(idle), 서버가 activeAt을 두고(걷기·자리 바뀜·idle 없는 옛 화면은 지금) 1분 지나면 away. 스냅숏 away, 150 ms 틱에서 바뀌면 바로 알림. 서버 plazaSeparate는 away인 사람을 건너뜀, away인 사람이 그대로 서 있으면 밀지 않음. 화면: 이름표에 회색 「자리 비움」 알약, 몸은 반투명(재질마다 사본 하나, 다시 입힌 것도 다음 스냅숏에), otherCircles·주민 걷기 사람 목록에서 빠짐. 시험용 /api/test/away {ms}.
- 해변 절벽: 달마루섬 해변 angular.cliff_a/b(약 4 m)가 카메라-나 선 위에 있으면 SEE.cliff로 그 모델만 내 둘레 구멍(나무 구멍은 그대로 별마루섬만). 땅 절벽은 카메라가 절벽 안에 남아 밖이 보이는 방식(문제 기록 7, camFloor)이라 따로 안 함.
- 시험: e2e general-store 「자리 비움」(두 사람, 4초, 같은 미끼 그 자리에서 사기, 돌아오면 원래대로), island-view-modes 가려도(해변 절벽 cliff 1, 나무 on 0) PC·폰. 단위 native-transformations·skirt-arms의 import 치환 갱신.
