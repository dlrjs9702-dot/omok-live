# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.197 파티 공통 틀 — 그림 맞히기·라이어·스무고개

- tableGameRoom·tableGamePlaying에 세 게임(+ partyGame): 판 중 자리 카드 비킴, 점수는 한 줄 얼굴 이름표(차례 노란 테두리), 입력 줄 판 아래 sticky(safe-area), 토스트·쪽지는 위 띠 아래(--roomBarBottom), 맞힘·틀림 소리(그림 roundAwards, 라이어 결과 내 편, 스무고개 guessHistory).
- 그림: 그림판 높이 맞춤 폭(3:2 그대로), 판 머리 한 줄(라운드·카테고리·시간, 「○○님이 그리는 중」은 띠에만), 제시어+도구 한 줄, 타이머 줄바꿈 없음.
- 라이어: 이름표 고르기 → 「○○님 지목」 확인, 판 수 고르기 판 중 숨김, 점수 이름표 줄은 제시어 바로 아래.
- 스무고개: 머리 「? 스무고개」·차례 상자 숨김, 내 정답은 작은 쪽지, 입력 하나 + 「질문」·「정답」, 출제자 예/아니오/비슷함/애매함 판 아래 엄지 자리.
- e2e party-table(PC·폰, 3명).

## v1.10.196 대화 상대 몸 돌리기·주민 대화 카메라

- 마루: 대화 중 걸음 멈추고 대화 카메라 쪽으로 돌아섬(`yard.talk(at)`, debug `townhall().talking`), 끝나면 문으로·비켜섬. v194 시장 전용 카메라 없앰(원인: strict 뒤 되돌아 걷는 방향이 얼굴 방향을 덮음).
- 주민·마루·펫샵 창구 대화 카메라 옆 3.4 m·위 2.9 m. 벽 가까운 백화점 창구는 예전 구도(넓히면 벽 속).
- e2e plaza 시장 정문: 대화 중 talking true → 허가 뒤 false.

## v1.10.195 가방 개편

- 구름 주머니(대화창 구름 부품)·동그라미 칸 PC 8 / 폰(터치) 4칸(32칸이면 칸이 주머니 안에서 스크롤)·빈칸 점·그림+개수만·고르면 아래 이름 줄·할 수 있는 것만 말풍선 메뉴(첫 줄은 아래로)·든 도구 진한 테두리·아래 줄 도감·반려동물·기념사진·포인트. 닫기: Esc·바깥·가방 단추.
- 내 순서: 끌기(PC)·0.4초 꾹 → 칸 탭(폰)·Shift+방향키, 물건 위면 자리 바꿈·빈칸이면 맨 뒤. `POST /api/island/bag/order` {ids}|{sort}, 다른 화면에서 바뀐 뒤면 409 STALE_ORDER. 정리: 도구→물고기→곤충→재료→기타. JSON·PG `islandBagOrder`.
- 가방 늘리기 16→24→32(경제 값 bag:24·bag:32), 잡화점 주인 대화, `POST /api/island/bag/grow`(1층에서만, claim bag:<n>:<계정>), world bagSlots → `IslandItems.setSlotsHook`, 모든 addToBag가 계정 크기(선물은 받는 사람). 가득 참 안내에 「잡화점에서 가방을 늘릴 수 있어요」.
- 뺀 것: 메뉴의 선물하기·버리기, 빈칸 자리 그대로 두기(저장 형식 변경 필요).
