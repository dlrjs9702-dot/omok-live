# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.429 택시 종점 마당 목책(사용자 결정 86 · 87 A, 검토 terminal-yard-20261123)

- 높은 목책 15칸(14 + 부두 길 쪽문 1)으로 섬 바깥 목책과 캠핑장 목책을 이음, 이음 두 곳에 통나무 끝 기둥(코드, 막는 원 0.3 m).
- NEW_ISLE.yard 다각형을 서버 safeAt · 화면 tigers-view에: 마당 안 쫓길 곳 0 · 호랑이 땅 0. SAFES를 지금 반지름 22.9 · 11.9로.
- 종점 차 길: 이 종점만 손님을 마당 쪽 차선에 내리고, 왼쪽으로 크게 돌아(반지름 2.2 m) 앞으로 자리에 — 캠핑장 목책을 뚫던 반원 대신, 울타리와 1.19 m 넘게 · 쉼터와 1.6 m.
- 시험: `terminal-yard`, camp-s1(캠핑장 고리만), e2e dalmaru-walk · 택시 정류장 · 택시 양보 · 호랑이.

## v1.10.428 스파이더맨 펫 끌려오기(에셋 182 WebSki, 사용자 결정 85 A)

- 자전거 뒤 고리에서 1.9 m 거미줄 → 두 손 잡는 점: 줄이 팽팽할 때만 끌려와 굽이에서 바깥으로 쏠림, 땅 높이 · 고리를 봄, 곧은 길 좌우 0.4 m(2.6초), 굽이에서 살짝 기움.
- 초속 1 m 아래면 서서(Idle) 줄 가운데가 10 cm 처짐. 옛 「연」 자리(자전거 틀 고정)는 없앰.
- 시험: `spiderman-182`, e2e island-pets(섬 → 끌려오기, 잰 속도에 맞는 클립).

## v1.10.427 아이언맨 펫 날기(에셋 181, 사용자 「다리, 팔에서 불꽃 효과를 넣고 날아오게 해」)

- 불꽃 넷: 손은 LowerArm → Hand 파랑(안쪽 밝게), 발은 LowerLeg → Foot 주황 — 날 때 뒤로, 떠 있을 때 아래로; 속도로 길이, 깜빡임, 40 m 밖은 안 그림.
- 몸: 속도로 기울기(느리면 −25° · 초속 12 m에서 +15°), 굽이에서 20°까지 기움, 위아래 6 cm(1.3초); 초속 1.5 m 아래면 Hover.
- 에셋 181: FlyRepulsor 다시(머리 들고 손바닥 · 발바닥 뒤), Hover 새로(sha256 확인).
- 시험: `ironman-181`, e2e island-pets(Hover → 날기).
