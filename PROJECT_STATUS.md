# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.210 메신저 알림·1인칭 키

- 메신저 입구: 계정·기기 열쇠가 같은 계정이면 기기를 붙임 → 아일랜드에서 연 메신저 창도 알림 켜기(DEVICE_NEEDED 고침).
- push는 기기마다: 메신저 스트림에 device 기록, 그 기기에서 열려 있는 기기만 뺌(PC 창이 열려 있어도 폰엔 push).
- 창이 열려 있어도 안 보고 있으면(hidden·!hasFocus) 페이지가 push와 같은 모양·tag로 알림, 꺼 둔 방·내 글(방 목록 last.mine) 제외.
- 배지: 일꾼 배지는 그 scope 안의 앱에만 붙어 push·알림 누르기를 앱의 sw.js(scope /)로 옮김, 옛 /messenger 구독은 페이지가 옮김, 캐시가 꺼져도 구독이 있으면 sw.js 남김, messenger-sw.js 지움.
- 1인칭 키: 방향키 걷기(↑↓ 보는 쪽, ←→ 옆걸음), W/A/S/D 시점(FP_WALK 지움).
- 시험: 단위 messenger-device(같은 계정 200·계정만 409·다른 계정 기기 409·PC 스트림+폰 구독 → 폰만), e2e messenger(안 볼 때 팝업), island-view-modes(1인칭 키).

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
