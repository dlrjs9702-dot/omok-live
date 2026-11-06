# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.257 잡기 카드·설명 카드 (catch-card 1~5절)

- 잡기 카드: 신기록·새 친구·대어·드문 곤충·박물관보다 큼일 때만, 3초 뒤/Esc/다음 던지기에 쪽지. 설명 카드 하나(카드 더보기·쪽지·가방 ⓘ·도감 칸·박물관 명판).
- 서버: 낚시 결과 prevBest·museumSize, 도감 note·where·sizes(이야기는 찾은 것만). lib/island-dex-notes.js 62종.
- 9절 자랑 장면은 258.

## v1.10.256 주소 옮기기 (14·15절)

- 섬 manifest id·start·scope /island/, 메신저 /messenger (따로 설치). / → /island/ 302, 영웅전 /island/herosurv/. SW는 /sw.js 하나.
- MOVED_TO: 저장소 열기 전 lib/moved.js만 (DB 연결 없음) — 안내 페이지, API 410, /guest-entry 307, /health moved.
- 옛 주소 구독: 7일 뒤 지움, 같은 계정·이름 기기 새 구독 때 바로 지움 (from 주소, 다 지운 뒤 건너뜀).
- 관리자 저장 공간: /api/admin/storage, 80% 주황·90% 빨강, [storage] 하루 한 줄(80%↑ warn).

## v1.10.255 두더지 잡기 「헬」

- ♥5, 놓침 −1·폭탄 −2, 시간 없음, 한 마리 10점·황금 없음, 10마리마다 단계(0.93배, 바닥 0.32/0.22초, 폭탄 최대 20 %, 동시 최대 5). 식은 public/whack-hell.js 하나(화면·서버).
- 서버: hell은 whack만, 10의 배수, 상한 200,000, n마리 최소 시간(3·2·1 제외). 헬 순위 따로, 게시판·칭호는 보통.
- 더하기: 10 콤보마다 글·결과 「최대 콤보」, 단계 5 심지 반짝·10 붉은 빛·치익, 시작 전 3·2·1. 결과 알약 「게임 오버」, 단계 배너는 판 위 크게.
