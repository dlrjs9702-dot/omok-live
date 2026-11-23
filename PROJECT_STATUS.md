# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.428 스파이더맨 펫 끌려오기(에셋 182 WebSki, 사용자 결정 85 A)

- 자전거 뒤 고리에서 1.9 m 거미줄 → 두 손 잡는 점: 줄이 팽팽할 때만 끌려와 굽이에서 바깥으로 쏠림, 땅 높이 · 고리를 봄, 곧은 길 좌우 0.4 m(2.6초), 굽이에서 살짝 기움.
- 초속 1 m 아래면 서서(Idle) 줄 가운데가 10 cm 처짐. 옛 「연」 자리(자전거 틀 고정)는 없앰.
- 시험: `spiderman-182`, e2e island-pets(섬 → 끌려오기, 잰 속도에 맞는 클립).

## v1.10.427 아이언맨 펫 날기(에셋 181, 사용자 「다리, 팔에서 불꽃 효과를 넣고 날아오게 해」)

- 불꽃 넷: 손은 LowerArm → Hand 파랑(안쪽 밝게), 발은 LowerLeg → Foot 주황 — 날 때 뒤로, 떠 있을 때 아래로; 속도로 길이, 깜빡임, 40 m 밖은 안 그림.
- 몸: 속도로 기울기(느리면 −25° · 초속 12 m에서 +15°), 굽이에서 20°까지 기움, 위아래 6 cm(1.3초); 초속 1.5 m 아래면 Hover.
- 에셋 181: FlyRepulsor 다시(머리 들고 손바닥 · 발바닥 뒤), Hover 새로(sha256 확인).
- 시험: `ironman-181`, e2e island-pets(Hover → 날기).

## v1.10.426 U8 남은 화면 정리(검토 ui-review-20261121 A9 · C6 · C8 · C9 · C10 · D5 · P4, stamp-overflow §3, 결정 83 A)

- 가방: 칸 메뉴 첫 열 · 끝 열에서 창 안(atStart · atEnd), PC(pointer:fine)는 종류 탭 · 기록의 탑 칩 줄바꿈, 폰은 가방 한 세로 줄(빠른 칸이 화면 안).
- 옷가게(D5 · A9): 섬에서 아래 닫기 · 포인트 숨김, 거르기 칩 한 줄 + 「더 보기」.
- 포인트 알약(C9), 빈 목록 글(C10), 창 모서리 12px(C8), 섬 창 옆 스크롤 없음.
- 시험: `island-ui-u8`, e2e island-paper-windows · island-bag.
