# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.419 U5 고른 색 하나 · 12px · 선 색 하나(검토 ui-review-20261121 C5 · C7 · C11, 결정 43 A 2)

- 고른 것(탭 · 칩 · 가방 탭 등): `--isle-select` 바탕 + `--isle-tag` 테 + `--isle-ink` 글자로 하나.
- 글자: 섬 창 안 12px(.75rem) 아래 8곳을 .75rem으로.
- 선: 비슷한 선 색들을 `--isle-line` 하나로.
- 시험: `island-ui-tokens` U5 규칙.

## v1.10.418 U4 닫기 하나 · 창 폭 셋(검토 ui-review-20261121 C2 · C3 · C4 · D3 · D4)

- 닫기: 섬 창(대화 창 빼고) 머리에 ✕ 하나(폰 40px). 아래쪽 「닫기」 11곳 뺌(텃밭 · 손보기 · 증권 · 벼룩 · 테드 · 바 카운터 · 암호 · 주사위 · 용서장 · 택시 부르기 · 택시 목적지).
- 창 폭: `openPlazaWindow(title, nodes, size)`가 's'(440) · 'm'(560) · 넓음 셋 중 하나. 승강기 's', 펫샵 · 가구점 · 잡화점 'm'.
- 시험: `island-ui-u4`(닫기 규칙 · 아래 닫기 없음 · 창 폭), e2e는 `#plazaCloseBtn`으로 닫기.

## v1.10.417 U3 섬 화면 토큰화(검토 ui-review-20261121 §3-3, 결정 43 A)

- 섬 색 이름: `--isle-card` · `--isle-field`를 더하고, 섬 규칙 안 종이 값 44곳을 토큰으로(같은 값). 게임 카드 색은 그대로.
- 부품: `.ghost` · `.secondary` · `.primary`가 변수(`--btn-*`)로 색을 받음(기본은 어두운 값). 섬 종이 창 전체(…Mode 창 포함)에서 한 번에 종이 값 — 새 창 · 새 부품은 아무것도 안 해도 종이색.
- 시험: `island-ui-tokens`(토큰 · 부품 · 섬 규칙에 어두운 팔레트 색 금지), `island-paper-windows`가 단추 · 입력칸 대비 4.5 이상과 종이 창 안 짙은 파랑 0도 봄.
