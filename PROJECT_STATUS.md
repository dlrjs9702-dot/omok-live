# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.387 펫 태우기·새 자전거(사용자 결정 26·33·34, 에셋 161)

- 자전거: 에셋 161 몸체 4색·바퀴·크랭크(1.25배, 앞 짐받이+나무 상자, 뒤 고리), BIKE 숫자(wheelR 0.30, 바퀴 ±0.525, BikeRide 속도/5), 새 BikeRide·BikeIdle.
- 펫(걷기는 그대로, 뛰기·자전거일 때): 작은 변신 8·새 → 머리 위 HeadSit / 메타몽 → 뛰면 머리 위·자전거면 상자 BasketSit / 강아지·고양이·여우·토끼(옛 펫 포함) → 뛰면 Run, 자전거면 상자 / 곰·판다·소·돼지·양 → 따라오다 6 m 넘게 멀어지면 옆에 / 스파이더맨 → WebSwing(위로 흰 줄)·자전거면 KiteHang(고리에서 흰 줄) / 배트맨 Glide / 슈퍼맨 Fly / 아이언맨 FlyRepulsor / 캡틴 Sprint(이동 속도/6). 펫마다 앉는 자리 보정(README §2·§3).
- 뛰는 중은 내 달리기 상태로, 다른 화면은 자세의 run으로(느린 화면의 땅 속도로 가르지 않음). 내 1인칭에선 머리 위 펫 숨김.
- 새 동작 클립 8개(MOTIONS·animations), 옛 펫·메타몽 GLB 32개 새 클립(옛 클립 그대로), 빌드 목록 갱신. 시험용 /api/test/pet.

## v1.10.386 마당 창고(사용자 결정 19~21·24·32, 에셋 160 붉은 헛간)

- 짓기·넓히기: 관공서 민원실 「마당 창고 짓기/넓히기」 — 경제 값 storehouse:price_1~4(10만·30만·50만·100만, 관리자 창에서 수정), 단계와 값을 한 번에(questApply cost, 단계마다 한 번). 20 → 40 → 60 → 100칸.
- 놓기: 마당 꾸미기·배치 도구에 「마당 창고」 한 조각(uid storehouse), 마당 물건 수에 안 듦, 집 하나에 하나. 넓히면 같은 자리에서 커지고 안 맞으면 접어 둠(안내). 집이 커져 걸리면 접어 두고 쪽지.
- 넣고 빼기: 창고 문 앞 1.6 m에서 SPACE → 창(넣기·꺼내기·하나만). 가방 물건 중 도구·자전거·펫·심부름·잃어버린 물건 빼고, 한 칸 99개, 물고기는 한 칸 한 마리(크기 그대로), 넣기는 다 들어가거나 안 들어가거나. 창고 물건은 계정 문서(quest 'storehouse')에 가방과 한 번에(questApply bagNext).
- 모양: 에셋 160 storehouse_1~4(High·Low), 막는 원 두 줄, 지붕은 집 지붕 색(roof 재질 setRGB linear), 겨울 눈, 4단계 등 밤에 켜짐. 집터마다 따로 그림.
- 주민 머리 위 표시 남음(문제 기록 5e510d4d·d783b6d1, notes issue-quest-mark-20261120): 걷는 주민을 이벤트(분실물 주인·사진 손님)에 빌릴 때 옛 심부름 표시를 지움, 부탁 표시 높이를 표시가 바뀔 때마다 다시 맞춤(fitQuestTag). 디버그 headMarks, resident-talk e2e 한 걸음.
- 시험: 단위 island-storehouse(규칙·모양·서버), e2e yard.spec 「마당 창고」.

## v1.10.385 부팅 무게 2(총괄: 입력 해시 키로 결과 미리 만들기, 바이트 같음)

- 섬 나무·덤불·바위 배치(nature)와 주민 길 격자: 빌드(postinstall tools/warm-boot-cache.js)에서 서버를 BOOT_CACHE_ONLY로 띄워 .cache/boot-cache.json에 저장, 시작 때 public/plaza·lib·server.js 내용 해시가 같으면 읽기만(island-events 전에 넣어 두기, 이벤트 순서 그대로). 다르거나 깨졌으면 예전처럼 만들고 파일을 씀.
- 바이트 같음: 읽어서 쥔 상태를 다시 쓴 파일 = 새로 만든 파일(test/boot-cache.test.js). 이 PC 모듈 4.9 → 0.86 s, 단위 전체 1149 → 816 s(시험 서버도 읽음).
- 에셋 목록: 같은 커밋(RENDER_GIT_COMMIT)에서 만든 목록은 크기가 같으면 파일 시각과 상관없이 믿기(Render는 업로드로 시각이 바뀌어 매번 3943개 다시 해시, 약 8.7 s).
- [boot] 줄: modules(boot-cache read | made: none/other/broken), assets(… cache kept/none/broken, same commit).
