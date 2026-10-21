# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.122 문제 기록 2회차 4묶음: 내 집 가구를 캐릭터로 직접 옮기기

- 근거: gamecenter-notes `docs/issue-log-review-20261021-b.md` 11번.
- 11: 내 집에서 가구 앞에 서서 행동 단추(Space)를 0.45초 길게 누르면 잡기 — 앞뒤 이동으로 0.5 m 칸씩 밀고 당기기(속도 0.9), R·돌리기 단추로 90°, 다시 누르면 놓기. 자리 검사는 `HOME.placeError` 그대로, 옮길 때마다 `/api/home/place`로 저장하고 틀리면 되돌림.
- 모션 4개(FurnGrab·FurnPush·FurnPull·FurnTurn, `island-models.json`), 안내 「가구 놓기 · R 돌리기」, 휴대폰은 행동 단추 누름·뗌으로 같은 동작.
- 검증: e2e 내 집(잡기·밀기 0.5 m 칸·돌리기·놓기, 서버 반영, PC·휴대폰). Codex 검토 대기(10/25).

## v1.10.121 문제 기록 2회차 3묶음: 폭포 위 연못, 관공서 옆 절벽

- 근거: gamecenter-notes `docs/issue-log-review-20261021-b.md` 16·18번.
- 18: 두 폭포 위 능선에 작은 연못(`dalmaru-terrain` FALLS·HEAD_PONDS), 폭포가 연못 물 높이에서 흘러내림(`island.js`, 연못 면 = 못 높이 − 3 cm), 연못은 물로 처리(`isWater`).
- 16: 관공서 계단 쪽 옆면도 절벽으로 — 깎는 자리(CUTS)를 계단 길 폭(`stairsBand`)에서만 비움, 백화점처럼 파고 들어간 모양.
- 검증: 단위(달마루 섬), e2e 달마루 걷기·섬 충돌 포함 전체(CI). Codex 검토 대기(10/25).

## v1.10.120 문제 기록 2회차 2묶음: 승강기·집 벽·마루·다리 끝·반려동물 이름, 사진 링크

- 근거: gamecenter-notes `docs/issue-log-review-20261021-b.md` 2·4·8·10·12·14번, 사진 링크(로그에서 사진 보기, 2026-10-21 제안).
- 8: 승강기 충돌을 실제 모델 자리(lx -14.05~-12.14)에, 서는 자리를 문 앞(-11.5)으로 — 1·2·3층(`island-store`·`island-furniture`·`island-petshop`, 서버 승강기 거리 2.6 그대로).
- 12: 집 안 벽에서 0.55 m(큰 머리 반지름) 떨어져 섬. 14: 방 바닥을 마루판 바로 아래(2 cm)로 — 4 cm 판이 걸레받이를 덮고 떠 보이던 것.
- 4: 자동 다리 양 끝을 각자 둑 높이에(서쪽 강 북쪽 끝 단차 65 cm → 4 cm), 가운데는 전보다 낮지 않게, 난간도 같은 기울기. 단위 시험(모든 자동 다리 끝 단차 10 cm 미만).
- 10: 이름 붙인 반려동물 머리 위 이름표(사람 이름표와 같은 모양, 내 것·남의 것), 내 반려동물 창 「이름 바꾸기」(`/api/island/pet/name`, 닉네임 규칙 한글·숫자·공백, 10자).
- 2: 자전거가 앞·뒤 바퀴 땅 높이로 기울고 두 바퀴 평균 높이에 섬. 기록 자리(0.8,-33.9)는 거의 평평해 재현 안 됨 — 사진 확인 뒤 다시.
- 사진 링크: `[issue]` 추가 줄에 `shot` 서명 링크(HMAC-SHA256, 7일, 로그인 없이 JPEG 한 장, 틀리거나 만료·삭제면 404, IP당 분당 60회), 서버 시작 때 한 번 열린 기록의 `[issue-shot-link]`. 키는 처음 한 번 만들어 서버 저장소에만(`issueShotKey`). base64 조각 줄은 뺌.
- 검증: 단위(다리 끝, 사진 링크 서명·만료·위조·삭제), e2e 가구점·펫샵(이름표·이름 바꾸기, PC·휴대폰)·잡화점·내 집·자전거(비탈 바퀴)·달마루 걷기. Codex 검토 대기(10/25).
