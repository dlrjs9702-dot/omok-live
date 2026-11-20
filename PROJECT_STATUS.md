# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.385 부팅 무게 2(총괄: 입력 해시 키로 결과 미리 만들기, 바이트 같음)

- 섬 나무·덤불·바위 배치(nature)와 주민 길 격자: 빌드(postinstall tools/warm-boot-cache.js)에서 서버를 BOOT_CACHE_ONLY로 띄워 .cache/boot-cache.json에 저장, 시작 때 public/plaza·lib·server.js 내용 해시가 같으면 읽기만(island-events 전에 넣어 두기, 이벤트 순서 그대로). 다르거나 깨졌으면 예전처럼 만들고 파일을 씀.
- 바이트 같음: 읽어서 쥔 상태를 다시 쓴 파일 = 새로 만든 파일(test/boot-cache.test.js). 이 PC 모듈 4.9 → 0.86 s, 단위 전체 1149 → 816 s(시험 서버도 읽음).
- 에셋 목록: 같은 커밋(RENDER_GIT_COMMIT)에서 만든 목록은 크기가 같으면 파일 시각과 상관없이 믿기(Render는 업로드로 시각이 바뀌어 매번 3943개 다시 해시, 약 8.7 s).
- [boot] 줄: modules(boot-cache read | made: none/other/broken), assets(… cache kept/none/broken, same commit).

## v1.10.384 부팅 무게(총괄 384: 382 [boot] points → before-listen 15.3 s)

- 원인: 「닉네임 중복」→「공지사항 동기화」 줄 사이 14.5 s(379 재시작 6.3 s). PostgreSQL seedReleases가 출시 공지 550개마다 SELECT(제목 LIKE 전체 훑기)+UPDATE — 시작마다 1,100번 왕복, 모든 줄을 매번 다시 씀.
- 고침: 한 번 읽고 바뀐 줄만 쓰기(JSON 저장소와 같은 규칙, 닉네임 안내 고정은 이미 고정이면 안 씀). 역 리프트(island-train)는 시작 때 만든 것 사용 — 나무 자리 시도마다 역마다 땅 높이 18번이던 것. nature·주민 길 격자 해시 같음, 이 PC 2.04 → 1.51 s(Render 약 16배).
- [boot] 줄에 accounts·notices 표시.
- 메모리: heapUsed 4~6시간 31~48 MB 평평, rss 처음 한 시간 175~235 MB 뒤 평평, 379의 327 MB는 꺼지기 2분 전 한 번(heap 38 그대로) — 누수 아님.
- 남은 무게(나중): 주민 길 격자 이 PC 1.9 s(Render 약 30 s), 산책길 거리 계산(Render 약 10 s).

## v1.10.383 호랑이 지능·공격 패턴(결정 12·16·17·18)·Codex #14·#18·비탈·검토 8건

- 지능(①~④): 몸에 맞는 길(앞뒤 칸이 비는 방향만), 끼임 풀기(1.5초 0.3 m도 못 가고 목표에도 못 가까워지면 뒤로 빠져 다른 길, 엉덩이 원 확인), 가로채기·모퉁이 감속, 놓치면 마지막 본 곳 둘러보기, 둘이면 몰고 막기·안전지대 입구 지키기. 큰 바위(0.45 m 이상)는 호랑이만 피함. 쫓을 때 우레 13·안개 12.
- 공격(에셋 159): 서 있는 사람(2.5 m/s 미만)에게 앞발치기·돌며 치기(오른쪽 TurnSwipe·왼쪽 L)·물기 돌진, 그 공격 판정이 지금 자리에 맞을 때만(검토 #1). 달아나는 사람에게 덮치기(2.5 m부터, 서 있으면 4.5 m부터). 화면은 같은 곡선(돌기·달려들기), fadeIn 0.1, 같은 공격 다시면 무게 1(#7).
- 사람 속도는 자세 시각 차이로(#2), 몸 원은 모델 자리 머리 +2.5·어깨 +1.1·엉덩이 −1.9(#3).
- 잡힘: 이송·알림 바로, 가방 저장 늦으면 tigerLost, 못 본 화면엔 다시 붙을 때 한 번 더(/api/island/tiger/seen, #4), 잡힌 화면만 이송(#6), 기록 정리(#8).
- Codex #14 길 계산 재사용·필요한 범위만(틱 평균 0.61 → 0.17 ms), #18 숨은 호랑이 믹서 쉼.
- 비탈(사용자 「허공에 떠 있는 티」): 네 발 땅 높이로 앞뒤 기울이기·옆 8°까지·가장 낮은 발 안 뜨게.
- 자리 비움인 사람도 잡힘(사용자 결정 27 A): 그때는 화면에 남겨 두었다가 돌아와 처음 입력하면 「자리를 비운 사이 …잡혔어요」를 다시, 그 뒤 seen.
- 측정(그려진 몸 자리): 어디든 닿음 6.72 % → 2.58 %, 나무·덤불 2.51 → 1.82 %, 바위 4.55 → 0.75 %, 잡은 횟수 17 → 15(36번). 엉덩이 나머지는 등뼈 휘기로 나중.
