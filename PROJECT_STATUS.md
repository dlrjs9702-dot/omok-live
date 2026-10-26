# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.174 게임방에 소리가 생겼어요

- 돌을 놓으면 「탁」, 패를 내면 「착」, 윷을 던지면 윷가락 떨어지는 소리, 할리갈리 종, 내 차례가 오면 짧은 알림, 판이 끝나면 승리·패배 소리가 나요.
- 소리는 기본으로 켜져 있어요. ☰ 메뉴 환경설정의 「게임 효과음」으로 끌 수 있고, 한판마당과 같은 설정이에요.

## v1.10.173 게임방: 마주 앉은 이름표

- 판이 시작되면 내 이름표는 판 아래, 상대 이름표는 판 위에 놓여요. 판을 사이에 두고 마주 앉은 것처럼요(오목·사목·오델로·점과 상자·윷, 2vs2 오목).
- 이름표에 이름이 먼저 크게 보이고, 자리(흑·백)와 접속 상태는 아래 줄에 있어요.
- 윷은 완주 수, 점과 상자는 상자 수, 오델로는 돌 수가 이름표에 보여요.
- 구치소장에게 이름이 생겼어요: 「김우성 구치소장」.

## v1.10.172 게임방: 판이 시작되면 판이 화면 가득

- 판이 시작되면 오른쪽 채팅·시스템 칸이 접히고 판이 화면을 넓게 써요. 채팅은 위 띠의 💬, 게임 진행 칸은 🎮로 열어요. 판이 끝나면 원래대로 돌아와요.
- 위 띠는 얇게(‹ 게임관 · 게임 이름 · 💬 🎮 · ☰), 차례 안내는 작은 한 줄과 내 시계만 남겼어요. PC의 내 차례 알림은 🔔 하나로.
- 기권은 ☰ 메뉴 안에 있어요.
- 새 시스템 알림과 안내 문구는 판 위에 잠깐 떴다가 사라지고, 판을 누르는 데 방해하지 않아요.
- 윷가락·주사위를 던지면 판 위에서 굴러가는 모습이 보여요.
- 휴대폰에서는 위 띠가 한 줄이 되고, 선수 칸 상태도 한 줄로 정리했어요.
