# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.283 Codex 271~280 12건 + 창구 이름

- 잊힌 내기 환불은 :stake 있고 :pay 없을 때만(hasClaim), 시작은 opens 먼저, 계정별 정산 직렬화, pending 안 지움, 실패 되돌림·b.want 재정산·settled 한 번, 택시 동시 요금 막음, contest+bet 400; 내기 단추·결과 감시·그림 글자 길이·pilot dispose·시범 나무 숨김 시점; 민원실 창구 안내 「· 직원 이름」. 다음: 그래픽 G1, G2(에셋 109).

## v1.10.282 움직이는 이모티콘

- 에셋 107b 24장 islanders1/anim/, stickers.json anim·animSha256; 방 안 메시지만 anim, 판(격자·미리 보기)은 멈춘 그림, prefers-reduced-motion이면 멈춘 그림; 단위가 그림마다 sha256 대조. 다음: 283 Codex 271~280 12건 + 창구 안내 직원 이름.

## v1.10.281 문제 기록 1·2·4

- 마우스 잠금은 사용자가 푼 것만 꺼짐(게임이 푼 것은 다음 클릭·키에서 다시 잡음); 개명 신청 직원 「개명 담당」, 시장 안내 「말 걸기 · 마루」; 🚲 단추 없앰, 폰은 빠른 칸 자전거(서버 빠른 칸 bike), 😊 단추 🚲 자리. 다음: 282 움직이는 이모티콘(107b), 283 Codex 271~280 12건.
