# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.183 도둑잡기, 판에 앉아서

- 도둑잡기 판 중에는 위쪽 자리 카드 대신 판 위 이름표에 얼굴과 이름이 붙어요.
- 상대 손패가 부채꼴로 펼쳐지고, 내가 뽑을 차례엔 「한 장을 눌러 뽑아요」가 떠요.
- 짝을 버리면 「딩동」, 마지막 둘이 남으면 판이 붉게 두근거려요 — 조커는 누구에게?

## v1.10.182 다빈치 코드, 판에 앉아서

- 다빈치 코드 판 중에는 위쪽 자리 카드 대신, 판 둘레 받침대에 얼굴과 이름이 붙어요.
- 숫자 추측은 고른 타일 옆 숫자판으로만, 「여기서 멈추기」는 판 가운데에 떠요.
- 맞히면 「딩동」, 틀리면 「둥」 소리가 나요.

## v1.10.181 고스톱 결과 점수표

- 고스톱·맞고 결과가 한지 점수표로 바뀌었어요: 광·띠·열끗·피가 한 줄씩, 고·합계·배수·점당, 그리고 누가 얼마를 내고 받았는지 크게.
- 이기면 점수표에 「승」 도장이 찍혀요.
- 다음 판은 점수표의 「한 판 더」로 열어요.
