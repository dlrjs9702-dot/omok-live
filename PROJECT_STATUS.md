# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.418 U4 닫기 하나 · 창 폭 셋(검토 ui-review-20261121 C2 · C3 · C4 · D3 · D4)

- 닫기: 섬 창(대화 창 빼고) 머리에 ✕ 하나(폰 40px). 아래쪽 「닫기」 11곳 뺌(텃밭 · 손보기 · 증권 · 벼룩 · 테드 · 바 카운터 · 암호 · 주사위 · 용서장 · 택시 부르기 · 택시 목적지).
- 창 폭: `openPlazaWindow(title, nodes, size)`가 's'(440) · 'm'(560) · 넓음 셋 중 하나. 승강기 's', 펫샵 · 가구점 · 잡화점 'm'.
- 시험: `island-ui-u4`(닫기 규칙 · 아래 닫기 없음 · 창 폭), e2e는 `#plazaCloseBtn`으로 닫기.

## v1.10.417 U3 섬 화면 토큰화(검토 ui-review-20261121 §3-3, 결정 43 A)

- 섬 색 이름: `--isle-card` · `--isle-field`를 더하고, 섬 규칙 안 종이 값 44곳을 토큰으로(같은 값). 게임 카드 색은 그대로.
- 부품: `.ghost` · `.secondary` · `.primary`가 변수(`--btn-*`)로 색을 받음(기본은 어두운 값). 섬 종이 창 전체(…Mode 창 포함)에서 한 번에 종이 값 — 새 창 · 새 부품은 아무것도 안 해도 종이색.
- 시험: `island-ui-tokens`(토큰 · 부품 · 섬 규칙에 어두운 팔레트 색 금지), `island-paper-windows`가 단추 · 입력칸 대비 4.5 이상과 종이 창 안 짙은 파랑 0도 봄.

## v1.10.416 S4 망루 + 먼 시야(사용자 결정 72 · 73 · 166A, 검토 safe-zones-visible §2-4 · §3, 에셋 178)

- 망루 `lookout_tower` (394.75, 216.75), 돌담 마당 안 · 오솔길 밖, 오르는 곳이 길가.
- 걷는 면 8개(발치 · 계단 셋(기울기 0.46) · 층계참 셋 · 마루 6 m)를 섬 높이 목록 `onTower`로(능선 계단 · 부두처럼), 땅보다 낮게는 안 됨. 난간 막는 원 128개 — 발치 말고는 높은 면으로 못 걸어 들어감.
- 결정 166A: 마루 · 꼭대기 층계참 위에서 안개 600 · 그리는 거리 650, 본섬 숲을 10 m 그물 하나(멀리 모양)로. 230 m 밖 물건은 그대로 안 그림.
