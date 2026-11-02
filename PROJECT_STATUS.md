# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.230 울타리 마을 (집터 동네를 새 땅으로)

- 땅: 툇마루섬 남쪽, 기차 고리 너머 새 땅(dalmaru-terrain VILLAGE x -154~170·z 199~281, 목 NECK x -20), coastDist에 soft union, 높이 0.9로 평평. 바닥 590 m·SEG 236, 구운 지도 1536.
- 집터 16곳(한 길 STREET_Z 236 따라 북 8·남 8, 12곳에 기존 집). 마당 = 울타리 안(18×16 → 22×20 → 26×24), 울타리 조각·문 1.4 m·이름 팻말(주인 「내 집」, 남 「○○의 집」)·문기둥·최대 크기 모서리 말뚝.
- 이사(server homeOf villageV 1): 집 안 그대로, 마당 물건은 가구 창고로, 관공서 쪽지 한 번, 게시판 알림 한 번. 새로 지은 집은 처음부터 villageV 1.
- 옛 툇마루섬 집터 → 꽃밭 4곳·벤치 8. 표지 「울타리 마을 ↓」「울타리 마을」. 지도·미니맵 땅 그림 z 300까지.
- 주민은 마을로 내려가는 목 길에서 멈추지 않음(서버 걸음과 어긋남). 잡초 범위 r 200, 서버 시작 바닥 계산 빠르게(ground-cover 먼 바다 건너뜀).
- 시험: dalmaru-island 16곳, island-yard(울타리 안·새 집 쪽지 없음), yard·weekly-new e2e 마을 이동은 PlazaWarp.

## v1.10.229 1인칭 손 동작 (할 때만 보이는 내 손)

- 공 주먹 → 손바닥·손가락·엄지 낮은 다각형 손(0.7배), 피부색 look.skinColor, 손목 소매는 윗옷 색(asset-loader c.sleeve).
- 빈손은 할 때만(fpBusy): 잡초(0.62 s부터 잡초 든 손), 나무 열매(0.98 s부터 열매), SPACE 톡 0.38 s, 잃어버린 물건 건네기 0.9 s. 0.14 s에 올라오고 내려감, 몸 손 뼈 움직임 0.35배로 화면 안.
- 손은 투명 패스 맨 나중·깊이 시험 없이 그려 나무 잎·가게 유리에 안 가림. 낚싯대·잠자리채 손도 같은 손.
- 시험: e2e fp-hands(PC·폰, 당기기 0.66~1.3 s 모든 프레임 손+잡초, 피부색 둘, 3인칭 손 없음).

## v1.10.228 물결에게 팔기 (근무표가 켜진 섬에서 오늘 물결이 있는 곳)

- 서버 /api/island/sell: fisher 거리 확인을 항구 8 m 대신 questTalkPos('fisher', at)로 — 말 걸기와 같은 기준(걷는 날 물결 옆, mall1 날 1층 계산대, 근무표 꺼지면 항구).
- 원인: 운영은 근무표가 켜져 물결이 항구에 거의 없음, 시험 서버는 근무표가 꺼져 통과했음.
- 시험: fisher-sell 단위(근무표 켜고 계산대 날·걷는 날·멀리서 TOO_FAR·끄면 항구).
