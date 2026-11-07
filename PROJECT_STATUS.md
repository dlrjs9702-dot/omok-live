# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.269 시험 정리 1차

- 폰 빼기 38곳, 겹치는 e2e 지움(pandemic·island-entry 파일 포함), 스킨 판독 대비 12개 → skins-contrast 한 테스트, 메신저 manifest 단위, ci-timings 새로(PC 205·폰 50 기계분). 다음: 270 합침·줄이기, 크롬 열기 시험·install-why 지우기.

## v1.10.268 입장 파일 없애기 + 아이디 저장·자동 로그인

- 운영 입장 파일 발급 끔(entryKeysOn), 예전 파일 안내·setup·막힌 입장, 관리자 아이디 없는 계정·모두 막기, 첫 화면 체크 둘·device-login(game 용도)·로그아웃이 기기 토큰 끊음, deviceOf는 messenger 용도만, 크롬 열기 시험 1~4(install-why try). 다음: 269 시험 정리.

## v1.10.267 ② 주민 대화 나무 화면

- 4칸(이야기 책·힌트·오늘의 주제·더 보기)·대답 단추·흐린 두 줄·힌트 띠·미니맵 📍, 이야기 책 81장 대화(storyTalk), 받은 것(dex given), 메신저 주소 복사(섬 앱 창·Custom Tab)·gc.messengerApp, 😊 자리·조작 겹침 0 e2e. 다음: 268 입장 파일 없애기.
