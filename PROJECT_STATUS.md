# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.82 섬 채팅 근거리·같은 열차 (묶음 9)

- 지시(사용자 2026-10-17 3순위, IDEAS `#future-local-chat` 2026-10-08 확정): 섬 일반 채팅은 가까운 사람에게만, 열차에서는 같은 열차 승객끼리만. 거리 20m는 IDEAS의 시험 기준값(최종 확정 아님) 그대로.
- 서버(`server.js` `chatAudience`·`lobbyMessagesFor`): 섬 위(plazaPresence)에서 보낸 글은 보낸 순간 수신자 집합(`to`, 세션)을 고정 — 지상은 20m 안 지상 사용자, 탑승 중이면 같은 열차 ID 승객(`trainRiders`), 송신자 포함. 대기방 상태 SSE·재접속 이력이 수신자별로 걸러짐(화면에서만 숨기지 않음). 섬 밖(대기방) 글은 `to` 없이 모두. 받은 글은 멀어져도 남고, 늦게 가까워져도 지난 글은 안 보임.
- 화면(`app.js`): 열차 채팅은 🚃 표시. 말풍선·알림은 같은 상태를 쓰므로 범위가 같음.
- 검증: `test/local-chat.test.js`(지상 12m 수신·45m 미수신·탑승자 미수신, 같은 열차 2명만, 대기방 글 모두, 멀어져도 받은 글 유지), 채팅 e2e(chat-announce·모바일 섬·광장 채팅), Codex 검토 결함 없음. 실제 휴대폰 미검증.

## v1.10.81 기념사진 2버튼 (묶음 8)

- 지시(사용자 2026-10-17 3순위, IDEAS `#future-photo-action` 2026-10-08 확정): 「즉시 촬영」·「포즈 촬영」 두 버튼.
- 즉시 촬영(`app.js` `takePhoto({ now })`): 카운트다운·PhotoPose 없이 누른 순간의 프레임을 캡처 — 동작·소품·위치를 건드리지 않음(취소·종료 때도 동작 해제 안 함). 포즈 촬영은 기존 3-2-1·PhotoPose 그대로, 채집·낚시·앉기·기차 중이면 안내만(`plaza-scene.js` `actionBusy`, 진행 중 행동을 끊지 않음).
- 사진 모드(`plaza-scene.js` `setPhotoMode`): 채집 잠금(`gather` kind photo)을 쓰던 것을 별도 `photoMode` 상태로 — 풀 뽑기·낚시·앉기 도중에도 열리고 그 진행은 그대로(서버 판정·보상 무관), 사진 모드는 이동·SPACE 상호작용·화살표로 일어서기만 막음. PNG 저장·포토 스팟 기록·취소/재진입/로그아웃 처리는 두 버튼 공통.
- 검증: e2e `plaza.spec.js` 기념사진 3개(새: 앉은 채 즉시 촬영 — 카운트다운 없음·앉은 채 유지·PNG, 포즈 촬영 안내, 화살표로 안 일어남; 기존 촬영·취소/재진입/로그아웃), Codex 검토 결함 없음. 실제 휴대폰 미검증.

## v1.10.80 농부 × 두더지 잡기 (섬 미니게임 퀘스트 첫 단계)

- 지시(사용자 2026-10-17 2순위): IDEAS `#future-island-minigames` 첫 단계 — assets 26 농부 묶음과 `GameLaunch` 규약으로.
- 퀘스트(`lib/island-quests.js` `farmer`, 매주 `always`): 1단계 `minigame` — 서버가 지급 판정(`lib/reflex.js` judge `ok`)한 두더지 잡기 200점 이상 판(난이도 무관)이면 완료(`server.js` 순발력 finish → `islandProgress('minigame:whack')`), 2단계 밭 둘러보기. 3,000+4,000+보너스 15,000 = 22,000P(다른 이야기와 같음). 대화 응답의 `minigame`으로 「도와줄게요」가 그 판을 연다(`app.js` `openQuestTalk`).
- 공동 밭(C안): `GET /api/island/farm` → 이번 주 게임 단계를 넘긴 계정 수로 0~3단계·팻말 이름(`pointStore.questHelpers`, JSON·PostgreSQL, 10초 캐시·농부 보고 때 바로 갱신), 월요일 새 주는 저절로 0. 화면은 15초마다·섬 시작 때 받음(`plaza-scene.js` `setFarm`).
- 자리(`island-terrain.js` `FARM`): 마을 길가 (-17, 45.5) 8×5m, 농부 (-12.4, 42.7), 팻말 (-22.6, 44.6). 밭 자리 나무 1·덤불 2는 생성 뒤 걸러냄(다른 배치·채집 나무 27 불변), 풀포기는 잡초 번호(`w<i>`)라 그대로.
- 에셋(assets 26, 납품 바이트 그대로): 농부(공통 리그 — 몸에 든 옛 동작 대신 assets 36 동작 파일로 움직임, `asset-loader` `dress` `motions`), 밭 4단계, 팻말(이름은 캔버스 글자판), 뿅망치(손). 손 작물 2종은 수확 단계 때.
- 한판마당 퀘스트 판: 그만두기(✕·Esc)·결과 「섬으로」가 바로 섬으로(`public/reflex/reflex.js` `questMode`).
- 검증: `test/farmer-quest-server.test.js`(150점·너무 빠른 판 불인정, 230점 완료·보고, 4명 → 3단계·이름, 도운 사람 목록 JSON·PostgreSQL), `test/island-quests.test.js` 주간 순환, `tests/e2e/farmer.spec.js`(농부 모델·밭 0단계·말 걸기 → 도와줄게요 → 두더지 잡기 → Esc 섬으로, 다른 사람 도움으로 1단계), 한판마당 e2e 9, 화면 확인. 실제 휴대폰 미검증.
