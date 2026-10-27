# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.191 펫샵 마당으로 통일·에셋 81 Low

- 펫샵(`public/plaza/island-petshop.js`): 하루 10마리 = 기본 6(종류마다 둘, 무늬 무작위) + 특별 4(메타몽·변신 23가지를 섞은 고리에서 하루 넷씩 차례로 — 어느 6일에도 23가지 모두, 하루 안 겹침). 데려가기는 마당 방식 그대로(하루 1마리, 먼저 온 사람), 이미 가진 특별 펫은 `ALREADY_OWNED` 「이미 함께 살아요」.
- 창구: 판매 목록 없앰 — 점원 대화 「오늘 아이들은 마당에 있어요…」 + 오늘 특별 펫 이름. `/api/island/petshop/buy`는 410 `CATALOG_CLOSED`, GET 응답에 `catalog` 없음(특별 펫은 `special`·`ip`·`owned`).
- 마당 펫 머리 위 이름표(특별은 이름, 기본은 「강아지 (갈색)」), 가까이 가면 값(안내). 변신 펫도 마당에서 걷는 모습.
- 우리 1.5배(10 × 8 → 15 × 12 m, 문 3 m), 소품도 1.5배로 펼침. 이름표는 3.5 m 안 가까운 3마리만, 대화 중 숨김. 대화 카메라는 방 바닥 높이를 겨눔, 펫샵 창구는 더 높이·옆에서.
- 에셋 81 Low 고침 등록: dock_boat_low·pier_dalkkeut_low(lowSrc·lowSha256), `low = null` 줄 없앰, floor-low 통과.

## v1.10.190 입장 파일 로그인·앱 아이콘·메신저 배지·말풍선 메뉴·데크 말뚝

- 입장 파일은 로그인만: 아이디 있는 계정의 파일 → 내 계정 화면, 섬은 「게임 접속」. 「이미 사용 중」은 게임 접속 때만. 아이디 설정 뒤에도 내 계정(「설정하고 로그인」). 시험 모드는 파일로 바로 입장, `/api/test/account-setup` 키만 운영처럼.
- 앱 아이콘: 게임에서 찍은 달마루섬 위 모습(`tools/assets/app-icon-shot.jpg`, `tools/make-app-icons.js`) — 192·512·apple·maskable, `public/favicon.ico` 16/32/48. island.svg 없앰.
- 메신저 배지: `public/messenger-alert.js` 하나 — 게임 창·메신저 창·messenger-sw.js가 같은 값(알림 끈 방 뺀 서버 안 읽은 합계), 0일 때만 지움. 창마다 안 보일 때 새 글이면 제목 1초마다 「● 새 메시지 (n)」.
- 메신저 말풍선: 「삭제」 글자 없음 — PC 오른쪽 클릭·폰 0.5초 꾹(키보드 메뉴 키) 작은 메뉴, 바깥·Esc 닫힘.
- 에셋 81: dock_boat·pier_dalkkeut High(말뚝·가로 보·물 띠·돌계단), DOCK.rects에 계단 칸. 81 Low는 갑판 윗면이 빠져 등록 안 함(다시 주문 중).

## v1.10.189 스툴·방석 방향 고르기

- 등받이 없는 스툴·방석에는 앉기 직전 바라보던 방향(45° 단위)으로 앉아요 — 전에는 늘 가구 앞쪽만 봤어요.
- 앉은 채 ←/→로 45°씩 돌아요(↑/↓는 일어나기). 폰은 앉아 있는 동안 걷기 단추 위에 ↺ ↻ 단추가 나와요.
- 다른 사람 화면에도 같은 방향으로 보여요.
- 소파·의자·벤치는 그대로 앞을 봐요.
