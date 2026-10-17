# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.83 섬 창 디자인 통일 (통합 UI 6~8)

- 지시(사용자 2026-10-17 3순위): 게임관 밖 창(게시판류·상점류·가방·내 정보·HUD)을 게임관 스타일로.
- 섬의 `.recordsDialog` 계열 창 전부(게시판·미션·출석·상점·가방·내 정보·기록·랭킹·기부·작명·등반·메뉴·메신저)를 게임 상세 시트(`.gameSheet`) 모양으로 — 모서리 22px·바탕 `#111827`·내용 좌우 16px, 머리 막대는 창 종류별 2색 그라데이션(흰 글자 4.5:1 이상)이고 창을 내려도 위에 붙음(`public/styles.css` 끝, DESIGN.md 「섬의 창」). CSS만 바꿔 창의 부품·키 조작·시험 선택자는 그대로, 밝은 테마는 생성기로 다시 만듦(머리 색은 두 테마 공통). HUD(채팅·가방·사진·☰)는 이미 같은 알약 모양이라 그대로.
- 검증: 창 스크린샷(가방·내 정보·미션·게시판·상점 어두운/밝은), 밝은 테마 대비 시험, e2e plaza·skins·messenger 39개(부하로 실패한 2개는 단독 재실행 통과). 실제 휴대폰 미검증.

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
