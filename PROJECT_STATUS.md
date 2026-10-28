# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.196 대화 상대 몸 돌리기·주민 대화 카메라

- 마루: 대화 중 걸음 멈추고 대화 카메라 쪽으로 돌아섬(`yard.talk(at)`, debug `townhall().talking`), 끝나면 문으로·비켜섬. v194 시장 전용 카메라 없앰(원인: strict 뒤 되돌아 걷는 방향이 얼굴 방향을 덮음).
- 주민·마루·펫샵 창구 대화 카메라 옆 3.4 m·위 2.9 m. 벽 가까운 백화점 창구는 예전 구도(넓히면 벽 속).
- e2e plaza 시장 정문: 대화 중 talking true → 허가 뒤 false.

## v1.10.195 가방 개편

- 구름 주머니(대화창 구름 부품)·동그라미 칸 PC 8 / 폰(터치) 4칸(32칸이면 칸이 주머니 안에서 스크롤)·빈칸 점·그림+개수만·고르면 아래 이름 줄·할 수 있는 것만 말풍선 메뉴(첫 줄은 아래로)·든 도구 진한 테두리·아래 줄 도감·반려동물·기념사진·포인트. 닫기: Esc·바깥·가방 단추.
- 내 순서: 끌기(PC)·0.4초 꾹 → 칸 탭(폰)·Shift+방향키, 물건 위면 자리 바꿈·빈칸이면 맨 뒤. `POST /api/island/bag/order` {ids}|{sort}, 다른 화면에서 바뀐 뒤면 409 STALE_ORDER. 정리: 도구→물고기→곤충→재료→기타. JSON·PG `islandBagOrder`.
- 가방 늘리기 16→24→32(경제 값 bag:24·bag:32), 잡화점 주인 대화, `POST /api/island/bag/grow`(1층에서만, claim bag:<n>:<계정>), world bagSlots → `IslandItems.setSlotsHook`, 모든 addToBag가 계정 크기(선물은 받는 사람). 가득 참 안내에 「잡화점에서 가방을 늘릴 수 있어요」.
- 뺀 것: 메뉴의 선물하기·버리기, 빈칸 자리 그대로 두기(저장 형식 변경 필요).

## v1.10.194 대화창 2차·주민 이름

- 주민 이름(설정집 2-1): 보이는 글자만 — WALKERS 해송·노을·누리(`call`: 해송 할아버지·노을 할머니·오 탐정, 주민끼리 말할 때 `callOf`), 부탁 주민(island-quests) 빛나·꽃님·물결·한들·고은·철이·가락·반디·바위·한결·느티·콩이, 시장 마루(머리 위·대화), 어부 판매 창 「물결」, 구치소장 「김우성」. 대사 「이장님」→「시장님」, 「바다 할아버지」→「해송 할아버지」. 저장 키·n 그대로.
- 대화창 2차: 글자 clamp(≈22px, 500), 구름 가장자리(::before 둥근 혹 + drop-shadow 선)·톡 뜨기(움직임 줄이기면 없음), 이름표 크게 −5°, 하트는 이름표 옆(`data-hearts`), 직업·관계 줄 없음, 「」 없앰(openTalk에서 통째 따옴표만), 「닫기」 없음(Esc·잘 가요·바깥 누르기, 방향키는 답만 돎), 선택지 한 풍선 ▶.
- 총괄 검토: 선택지 첫 줄이 처음부터 골라짐(굵게 ▶), 대화 중 머리 위 이름표(내 것·남의 것·펫·시장) 숨김, 시장 대화 카메라 뒤·오른쪽·위에서 마루 머리를 겨눔, 폰 말풍선 아래 여백(safe-area).
