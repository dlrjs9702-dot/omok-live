# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.180 큰 순간은 크게

- 고스톱·맞고에서 뻑·쪽·따닥·판쓸이·폭탄·흔들기·고·스톱이 판 한가운데 큰 도장 글자로 찍히고, 「쾅」 소리가 나요.
- 고를 외칠 때마다 이름 옆에 「1고」 「2고」 도장이 쌓여요.
- 소리는 ☰ 「게임 효과음」으로 끌 수 있어요.

## v1.10.179 상대가 마주 앉아 있어요

- 고스톱·맞고에서 상대 이름표에 얼굴이 생겼고, 상대 손패 뒷면이 부채꼴로 펼쳐져요. 상대가 패를 내면 그 부채에서 날아와요.
- 휴대폰에서 「손패 10장」이 잘리지 않고, 속도 단추가 상대 패를 가리지 않아요.
- 뻑 표시는 그 달 묶음 위 작은 빨간 표로 보여요.

## v1.10.178 바닥패가 산을 둘러싸요

- 고스톱·맞고에서 산(뒤집을 패 더미)이 바닥 한가운데로 왔어요. 바닥패는 그 둘레에 월별로 살짝 비틀어 놓여요.
- 산에서 뒤집는 패가 판 가운데에서 날아가요.
