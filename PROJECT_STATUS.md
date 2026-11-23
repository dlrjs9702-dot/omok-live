# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.421 U7 첫째 — 폰 다듬기(검토 ui-review-20261121 P2 · P3 · P5 · P7 · D6)

- 터치 화면: 가방 아래 단추 · 증권 · 벼룩 탭 한 줄 밀기, 기록의 탑 칩 끝 흐림, 작은 누름 대상 40px 이상, 폰 도감 목록 높이 52dvh(가방 아래 줄이 화면 밖으로 안 밀리게).
- 노점(D6): 골라 팔기 목록에서 가게가 사는 것 먼저.
- 시험: `island-ui-u7`, e2e dex-tabs · island-bag · island-stocks · island-contest · mobile-island.

## v1.10.420 U6 관리자 창 섬 종이(검토 ui-review-20261121 A3 · B16, 결정 43 A 1)

- 관리자 창: 섬 종이 규칙에 들어감(카드 · 계정 칩 · 단추가 종이색, 고른 칩은 꿀색). 머리 제목 옆에 빨간 「관리자」 표시.
- 시험: admin-issue-log · admin-point-grant · island-paper-windows e2e.

## v1.10.419 U5 고른 색 하나 · 12px · 선 색 하나(검토 ui-review-20261121 C5 · C7 · C11, 결정 43 A 2)

- 고른 것(탭 · 칩 · 가방 탭 등): `--isle-select` 바탕 + `--isle-tag` 테 + `--isle-ink` 글자로 하나.
- 글자: 섬 창 안 12px(.75rem) 아래 8곳을 .75rem으로.
- 선: 비슷한 선 색들을 `--isle-line` 하나로.
- 시험: `island-ui-tokens` U5 규칙.
