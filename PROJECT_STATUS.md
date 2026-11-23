# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.426 U8 남은 화면 정리(검토 ui-review-20261121 A9 · C6 · C8 · C9 · C10 · D5 · P4, stamp-overflow §3, 결정 83 A)

- 가방: 칸 메뉴 첫 열 · 끝 열에서 창 안(atStart · atEnd), PC(pointer:fine)는 종류 탭 · 기록의 탑 칩 줄바꿈, 폰은 가방 한 세로 줄(빠른 칸이 화면 안).
- 옷가게(D5 · A9): 섬에서 아래 닫기 · 포인트 숨김, 거르기 칩 한 줄 + 「더 보기」.
- 포인트 알약(C9), 빈 목록 글(C10), 창 모서리 12px(C8), 섬 창 옆 스크롤 없음.
- 시험: `island-ui-u8`, e2e island-paper-windows · island-bag.

## v1.10.425 H1 한판마당 혼자 퍼즐(사용자 결정 82 A, 에셋 180)

- 불빛 채우기: 오늘의 퍼즐(서버가 답을 만들어 확인, 퍼즐 워커), 퍼즐 카드 · 게임관 카드.
- 점수 퍼즐 묶음: 숫자 밀기(크기 · 걸린 시간) · 블록 퍼즐 · 사과 게임 · 수박 만들기(점수전만) — 판은 서버가 열고, 사람이 낼 수 있는 기록만 받음.
- 기록의 탑 19게임: 칭호 불빛 화가 · 숫자 조각가 · 블록 장인 · 사과 농부 · 수박 농부, 주간 트로피(에셋 180 열 개, sha256 확인) 마당 · 가구 이름.
- 시험: `h1-games`, reflex · puzzle-daily · solo-ranking 서버, e2e reflex · hanpan-h1 · solo-quest.

## v1.10.424 달무리 사목 ①(한판마당 자료)

- 서버 `lib/games/orbit4.js`: 바깥 · 안쪽 고리, 구슬마다 반시계 한 칸 돌림, 돌기 전 상대 구슬 밀기(선택), 줄은 돈 뒤에만 · 둘 다 이으면 무승부, 판이 차면 다섯 번 더 돌림, 구슬 각 8개.
- 화면: 밤하늘 판(고리 · 돌림 화살표, 달 · 별 구슬 또는 사목 칩 꾸미기), 밀기는 상대 구슬 → 옆 칸(터치는 칸을 두 번).
- 게임관 카드 · 방 목록 · 규칙 · 안내 · 소리 · 최근 수, 미션 · 업적(74) · 자리 이름 달 / 별.
- 시험: `orbit4`(8), e2e orbit4 · achievements.
