# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.258 자랑 장면 (catch-card 9절) + 폴드 회귀

- 자랑 장면: Show* 동작 9개(에셋 97), 카메라 3.6 m 왼쪽, 잡은 것 최소 0.5 m/0.22 m, 물고기는 얼굴 옆, 장면 동안 보조 빛. 건너뛰기 SPACE·걷기·스틱·탭.
- asset-loader hold size: 메시 상자로 재요(스킨 곤충이 빈 상자로 읽혀 크기가 안 바뀌던 것).
- 폴드: /island/guest-entry(옛 경로도 받음), 안드로이드 메신저 intent://, 섬 「앱으로 설치」(첫 화면·☰).
- 시험: island-daily-server 부탁 날짜 고정.

## v1.10.257 잡기 카드·설명 카드 (catch-card 1~5절)

- 잡기 카드: 신기록·새 친구·대어·드문 곤충·박물관보다 큼일 때만, 3초 뒤/Esc/다음 던지기에 쪽지. 설명 카드 하나(카드 더보기·쪽지·가방 ⓘ·도감 칸·박물관 명판).
- 서버: 낚시 결과 prevBest·museumSize, 도감 note·where·sizes(이야기는 찾은 것만). lib/island-dex-notes.js 62종.
- 9절 자랑 장면은 258.

## v1.10.256 주소 옮기기 (14·15절)

- 섬 manifest id·start·scope /island/, 메신저 /messenger (따로 설치). / → /island/ 302, 영웅전 /island/herosurv/. SW는 /sw.js 하나.
- MOVED_TO: 저장소 열기 전 lib/moved.js만 (DB 연결 없음) — 안내 페이지, API 410, /guest-entry 307, /health moved.
- 옛 주소 구독: 7일 뒤 지움, 같은 계정·이름 기기 새 구독 때 바로 지움 (from 주소, 다 지운 뒤 건너뜀).
- 관리자 저장 공간: /api/admin/storage, 80% 주황·90% 빨강, [storage] 하루 한 줄(80%↑ warn).
