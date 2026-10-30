# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.209 X2 카운트다운

- countdown-2026: 12/31 18:00~1/1 01:00 KST(달력 시간 창 fromHour/toHour, 날짜 넘김). 판(newyear.countdown_board) (0, −98)·발사대 둘(±6 m).
- 판 글 서버 시계(festival GET now): 23시 전 「2026 → 2027」, 23시부터 분:초, 마지막 10초 큰 숫자, 0시 「2027」.
- 0시 불꽃: 올라가는 줄기·판 위 12~18 m 3~5 m 터짐·떨어지는 꼬리·빛 번짐, 금·빨강·초록·흰색, 첫 3초 6발 뒤 0.7~1초마다 3분, 입자 PC 600 / 폰 200, 움직임 줄이기면 빛만. 0시에 판 곁이면 카메라 한 번 하늘로.
- 0:00~0:10 판 12 m 둘레: 칭호 「해피 뉴 이어」 + 도장 1(가게 없음) → 01:00 뒤 끝 이야기(도장 있는 계정만).
- 시험 시계 tick. 단위 countdown, e2e island-countdown(PC·폰). 사진 notes img/countdown.

## v1.10.208 V1 시점 — 1인칭·3인칭(밖·집)

- 시점 틀: 밖 3인칭·집 안 1인칭 기본, 「👁 시점」·V, 밖·안 따로 기억(gc.view.out/in). 다른 실내는 V2 전까지 3인칭 + 「곧」. 시험은 gc.testRealView 없으면 3인칭.
- 1인칭: 체형 눈높이, 몸 숨김, 75°, near 0.05, 흔들림 없음, PC WASD·끌기, 폰 오른쪽 반 끌기. 방에 들어오면 방 쪽. 이름표 가까이서 커지지 않음.
- 1인칭 대화: 60° 안 상대, 눈높이(Head 뼈)·머리부터 어깨 45 %·얼굴 위쪽 1/3, 64°, 대화 중 보조광. 문 1 m 우선 그대로.
- 집 안 1인칭: 벽지 윗선 위 같은 색 띠·나무 띠, 천장 3.8 m(큰 집 4.0 m).
- 탁상형 곤충 상자(에셋 86): 받치는 가구 위면 탁상형 모델·자리, 위에서 0.36 x 0.24.
- 시험 흔들림: 관광객 사진(작은 명소), 주민 대화 닫힘 문구. 1인칭 저장 시 시작 오류 고침.
- e2e island-view-modes·island-view-talk(PC·폰). 사진 notes img/view-modes.

## v1.10.207 집 꾸미기 — 작은 물건 위에 올리기·꾸미기 창 종이

- island-home SMALL(곤충 상자·라디오·달/조개 램프·작은 등대·청사초롱·트로피 둘·스노볼·과자집) → TOPS(책상 0.765·서랍장 0.85·낮은 탁자 0.45·식탁 0.78·조리대 0.89·소반 0.34, 모델 실제 윗면을 광선으로 잼) 하나의 발자국 안이면 그 위, 0.05 m 칸, 같은 윗면끼리 안 겹침, 걸치면 바닥 규칙. 협탁·장난감 상자·TV장·잔칫상은 윗면이 평평하지 않아 뺌.
- 위에 물건 있는 가구: 옮기기·돌리기·창고 막음(서버 HOLDS_THINGS·꾸미기 창·잡고 밀기) 「위에 놓인 물건을 먼저 치워 주세요」. 저장은 자리로 판단, 집 넓힐 때 받치는 가구 먼저.
- 꾸미기 창: 섬 창 종이, 고른 칸 진한 갈색, 「↻ 돌리기」 한 줄.
- 시험: 단위 island-home, e2e my-home(PC·폰) + 시험용 /api/test/home/release. 사진 notes img/home-tabletop. 탁상형 곤충 상자(주문 86)는 다음 묶음.
