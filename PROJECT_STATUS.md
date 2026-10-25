# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.164 건물 얼굴 — 게임관·기록관·백화점이 한눈에

- 게임관: 지붕 위 주사위·카드 장식, 양옆 깃발, 문 앞 아치 간판(「게임관」 글자).
- 기록관: 시계탑을 얹은 새 건물, 현관 위 판에 「기록관」 글자, 문 앞 트로피 받침.
- 백화점: 유리가 비쳐 줄무늬 차양 아래 진열창의 마네킹·쇼핑백이 보이고, 안쪽에 따뜻한 쇼윈도 불빛(밤엔 더 밝게).
- 기록관이 커져서 문·걷는 길·충돌을 새 크기에 맞춤.

## v1.10.163 주민 말투 다듬기 — 자주 듣는 말도 열 명 모두 다르게

- 심부름 부탁·고마움, 보통 선물, 사이가 가까워질 때, 편지 첫 줄에 주민마다 자기 한마디가 붙음 — 오 탐정 「흠… 의뢰가 하나 있단 말이지.」, 다온 「반죽 부풀 동안만 부탁할게요!」, 바람이 「배달 경로에 하나만 넣어 줄래요?」, 가람 「대원! 탐험 임무다!」, 하람 「아, 저… 부탁이 하나 있달까요…」 …
- 오 탐정은 바다 할아버지와 다른 자기 탐정 말씨(「~란 말이지」)로.
- 「봄이가 보낸 우산요?」 → 「우산이요?」(받침 따라).
- 시험: 자주 보는 대사 11가지를 열 명에게 시켜 열 가지 모두 다름.

## v1.10.162 주민 말투 — 주민마다 말씨·말버릇

- 문제 기록 7회차 2 「주민마다 특색이 있는데 대사창으로 출력되는 것들이 말투가 다 똑같아서 어색해」 → 사용자 결정 「사람 주민에 말버릇」: 인사·심부름·선물·오늘의 이야기·편지·맞았을 때·단계가 오를 때 하는 말까지 그 주민 말씨로.
- 말씨 넷: 해요체(봄이·하람·두리·다온·바람이·이솔), 하게체(바다 할아버지·오 탐정), 할머니 말(노을 할머니), 꼬마 반말(가람). 주민마다 자기 문장도 몇 개씩.
- 말버릇은 말한 것 끝에 한 번 — 봄이 「꽃!」, 두리 「붕붕」, 다온 「빵!」, 바람이 「휙!」, 이솔 「반짝…」, 하람 「~랄까요…」, 바다 할아버지 「~라네·~구먼」, 노을 할머니 「~구나, 얘야」, 오 탐정 「~란 말이지」, 가람 「~가자!·~거든!」.
- 시험: 단위 `resident-voice`(10명 × 37가지 대사, 남의 말버릇 0, 끝에 한 번, 이름·조사, 머리 위 인사 짧게).
