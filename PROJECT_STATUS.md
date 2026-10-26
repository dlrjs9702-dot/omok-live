# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.176 화투가 진짜 화투처럼

- 고스톱·맞고 화투 앞면의 「1월」 「피」 글자 띠를 없앴어요. 그림만 보고 치는 진짜 화투처럼요.
- 처음이라 헷갈리면 ☰ 메뉴 환경설정의 「화투 패 이름 보기」를 켜세요. 모서리에 달과 종류가 작게 보여요.
- PC에서는 손패와 바닥패가 더 커졌어요.
- 휴대폰에서 맞고 판이 화면 밖으로 삐져나가던 것을 고쳤어요. 손패 10장이 한 줄에 겹쳐 들어가고, 바닥패는 4장씩 놓여요.

## v1.10.175 게임방 결과가 한지 쪽지로

- 판이 끝나면 판 위에 한지 종이 결과 창이 떠요. 이기면 빨간 「승」 도장이 찍혀요.
- 내기 판에서는 받은 포인트가 「+800P」처럼 크게 한 줄로 보여요(자세한 계산은 마우스를 올리면).
- 오델로·윷·점과 상자는 점수가 하나씩 올라가며 보이고, 이긴 사람 이름표에 왕관이 씌워져요.
- 「한 판 더」·「게임관으로」 단추가 커졌어요.

## v1.10.174 게임방에 소리가 생겼어요

- 돌을 놓으면 「탁」, 패를 내면 「착」, 윷을 던지면 윷가락 떨어지는 소리, 할리갈리 종, 내 차례가 오면 짧은 알림, 판이 끝나면 승리·패배 소리가 나요.
- 소리는 기본으로 켜져 있어요. ☰ 메뉴 환경설정의 「게임 효과음」으로 끌 수 있고, 한판마당과 같은 설정이에요.
