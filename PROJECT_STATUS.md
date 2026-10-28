# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.194 대화창 2차·주민 이름

- 주민 이름(설정집 2-1): 보이는 글자만 — WALKERS 해송·노을·누리(`call`: 해송 할아버지·노을 할머니·오 탐정, 주민끼리 말할 때 `callOf`), 부탁 주민(island-quests) 빛나·꽃님·물결·한들·고은·철이·가락·반디·바위·한결·느티·콩이, 시장 마루(머리 위·대화), 어부 판매 창 「물결」, 구치소장 「김우성」. 대사 「이장님」→「시장님」, 「바다 할아버지」→「해송 할아버지」. 저장 키·n 그대로.
- 대화창 2차: 글자 clamp(≈22px, 500), 구름 가장자리(::before 둥근 혹 + drop-shadow 선)·톡 뜨기(움직임 줄이기면 없음), 이름표 크게 −5°, 하트는 이름표 옆(`data-hearts`), 직업·관계 줄 없음, 「」 없앰(openTalk에서 통째 따옴표만), 「닫기」 없음(Esc·잘 가요·바깥 누르기, 방향키는 답만 돎), 선택지 한 풍선 ▶.
- 총괄 검토: 선택지 첫 줄이 처음부터 골라짐(굵게 ▶), 대화 중 머리 위 이름표(내 것·남의 것·펫·시장) 숨김, 시장 대화 카메라 뒤·오른쪽·위에서 마루 머리를 겨눔, 폰 말풍선 아래 여백(safe-area).

## v1.10.193 민원 창구 집 넓히기 고침

- 민원 창구 「집 넓히기」 단추가 v117 기준(오두막만)으로 남아 작은 집부터 「내 집」·꺼짐 → 작은 집→큰 집, 큰 집→2층 큰 집을 화면에서 못 함. 기준을 `IslandHome.TOP_STAGE`(4)로: 그보다 낮으면 「집 넓히기」·켜짐, 4면 「내 집」·꺼짐(서버 /api/home/upgrade·openHomeApply는 원래 4까지).
- e2e my-home 「민원 창구 집 넓히기」(PC·폰): 작은 집·큰 집에서 단추 켜짐 → 공사 시작, 2층 큰 집에서 꺼짐. 고치기 전 코드에선 「내 집」으로 실패 확인.

## v1.10.192 U2 메뉴 안 창도 종이·게임관 화면·내 반려동물

- 종이 창 한 벌 `.isle-sheet`(`body.plazaMode`): 종이 바탕·갈색 글자·선, 머리 제목 + ✕(이름 「닫기」), 종이 알약·입력·체크, 어두운 줄·카드는 종이 카드, `color-scheme: light`. ☰·내 정보·문제 기록·접속 종료·이름 짓기·plaza 기본 창·관공서 정산·세금·예금·개명소·기부·미션·랭킹·등반. 클래스에 `Mode`가 있는 창(대화·가게·게시판·우체통·도장·지도·꾸미기·관리자 `adminMode`)은 제 모양.
- ☰ 환경설정: 「게임관 화면:」 밝게 / 어둡게 / 기기 설정, 체크 상자는 글자 앞 한 줄.
- 내 반려동물: 펫 얼굴(가방 그림과 같은 이모지), 「함께 다니는 중」 딱지, 폭 440px. 이름 짓기·바꾸기는 종이 입력 창 `#nameAskDialog`(브라우저 prompt 없앰).
- 가방 칸 안 단추·닫기 ✕, 사진 모드 띠 종이 알약.
- e2e `island-paper-windows`: 종이색·대비 4.5·✕·펫 얼굴(PC·폰).
