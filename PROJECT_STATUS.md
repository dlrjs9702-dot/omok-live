# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.203 X1 크리스마스 에셋 붙이기

- 76 열다섯(xmas-v1): REGISTRY xmas.* 일곱(집 가구 다섯·가판대 덧씌움·선물 자루), snow.ball, snowman.part.* 다섯, newyear.countdown_board·firework_launcher — 광장 배치는 X2.
- 집 가구 다섯은 island-furniture EVENT_GOODS __plain(가구점 진열 없음, 크리스마스 도장 가게 몫), island-home SIZE(76 README 값), 양말 걸이 HUNG.
- 옷 둘은 skins-x2 WINTER_ITEMS(코인 상점 늘 판매): 크리스마스 스웨터(78 판, 희귀, baked), 털 귀마개(77 판, 고급, 머리카락 cover 없음).
- e2e island-xmas-assets(PC·폰): 옷 입기, 오두막에 가구 다섯 놓기. 사진 notes img/xmas-assets-game.

## v1.10.202 79 소품 맞춤

- 50번(slim50)에서 오던 목걸이·신발 중 79에 같은 이름이 있는 것을 79 판으로(High 63 · Low 62, 소스 refit79, SHA 갱신). 79의 동물 목걸이·신발 20개는 게임 파일이 없어 안 붙임(동물 변신은 native/animal-*.glb).
- asset-pipeline.js FIT.pendantZ −0.2 → −0.13: 맞춘 펜던트(몸 앞 0.14~0.17)도 두꺼운 옷 위에서 밀어내기가 닿음.
- e2e island-refit79(PC·폰): 세일러 + 별 목걸이 + 부츠 → 목걸이 shift.

## v1.10.201 S2 섬 이야기 장면

- 섬 일지(기록관 창): 앞쪽 셋·쪽 1~4·쪽 5~8(노을 3장 뒤)·빠진 쪽. 읽은 쪽 story.read log:N.
- 조각 7: 일지 1~8쪽 다 읽음 + 가람 3장 + 등대 8 m 안 「살펴보기」 → 문 발치 상자에서 빠진 쪽(한 번). 문은 잠긴 채, 마지막 장에서 처음 열림. 기록관 열쇠는 글로만.
- 마지막 장(오 탐정 「결론 듣기」, 수사판 8 + 노을 단짝): 쪽지 여섯(안 A 그대로), 가구 「초승 등불」 + 칭호 「등대의 이웃」 한 번(doc.gifted 뒤 건너뜀). 쪽지가 열리면 대화 창 닫힘.
- 전하기 받는 쪽 대사 다섯(S2 정함). 수사판 = 이야기 책 초승등대 탭(기록관 문양 도장, 글 옆).
- 에셋 80(story-v1): 등대 아래 문(keepNodes, 문 조각), 문 발치 상자, 가구 초승 등불. 등대도 keepNodes(glow). 밤 깜빡임 달·마·루 / 마친 사람은 어·서·와, 꼭대기 빛 번짐 스프라이트. 움직임 줄이기면 은은히 켬.
- 섬에 들어올 때 이야기 상태를 바로 불러옴.
