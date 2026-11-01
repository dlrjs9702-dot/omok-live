# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.221 도구 닳기

- 낚싯대·잠자리채 칸마다 하나(unique), 남은 횟수 meta.uses(없으면 가득: 30, 튼튼한 것 80). 잡기 판정 때 islandGive(wear)가 같은 claim 안에서 가장 낡은 것 1 — 놓침·허공·놀람은 안 줄어듦, 0이면 빠짐. 자전거 안 닳음.
- 잡화점 튼튼한 낚싯대·잠자리채 3,800P(good:*_sturdy), 도구 벽 다음 고리·같은 모델·금테.
- 종류마다 3개까지(TOOL_MAX) — 사기 거래 안에서 셈(JSON·PG), 자전거는 한 대.
- 화면: 가방 막대, 든 도구 횟수(PC 오른쪽 아래·폰 왼쪽 위), 5회 쪽지, 0 「툭!」 조각.
- 시험: store-tools·wearTool·낚시·곤충 단위, e2e tool-wear(새, PC·폰).

## v1.10.220 새 주민 17명 좋아하는 것·8명 편지·심부름 그날 걷는 주민

- LIKES 10~26(27개, 로드 때 RESIDENTS 수 확인), giftReact 기본 분기 지움. own.letter: 반디·바위·한결·김우성·마루·단비·한솔·새롬 5개씩(notes docs/resident-likes-letters-17-20261101.md).
- 심부름: errandsOf(day, walksToday) — 그날 걷는 주민끼리, 넘기지 않으면 예전 열 명(결과 같음).
- 27명으로: 호감도 단계 보상·단짝 칭호(titleOf)·주민 편지(residentLetter)·심부름 사례 이름·callOf. 친한 사이 가구는 10명분만.
- 시험: resident-likes-letters.test(새), likes-letters-photo.spec(사진 전용).

## v1.10.219 대화 자리 잡기 + 역 철이

- 대화 카메라: 섬에서 시선에 나무·덤불·가로등(natureSolids)이 걸치면 내 왼쪽 → 양쪽 가까이(0.6배) 중 먼저 트인 자리(대화마다 한 번, talkSide). 주민 바로 뒤 나무(마지막 8 %)는 벽 아님.
- 키 작은 주민(2.1 m 아래): k = max(0.6, top/2.1)로 카메라 가깝고 낮게(y 1.9×k), 겨누는 점을 나에게서 조금 더 비켜 — 콩이 머리 화면 위쪽. 2.1 m·2.6 m 넘는 주민은 전과 같음.
- 먼 주민: 대화가 1.9 m보다 멀리서 잡히면 1.6 m(1인칭 fpGap)까지 걸어감(걷기 동작).
- 역 철이(근무표 지킴이·부탁 철이): 광장 대신 옆 길을 봄(facePath).
- 시험: talk-spot.spec(새, PC·폰).
