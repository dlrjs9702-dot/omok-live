# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.356 가방 개편: 종류별 탭 + 골라 팔기 (사용자 2026-11-17, notes docs/bag-tabs-20261117.md)

- 탭: public/island-bag-data.js(193개 물건의 탭과 설명, work/bag356/make-data.cjs가 notes story/bag-items·bag-descriptions json에서 만듦), app.js drawBagTabs·applyBagTab(칸 hidden)·gc.bagTab 기억·가구 탭 drawFurnList(/api/island/furniture/mine placed:false만).
- 설명 칸 bagDetail: 그림·이름·종류·설명·쓰는 곳(파는 곳·값, 집 손보기 재료, 벼룩시장)·크기·산 것. 자전거 꺼내기·넣기.
- 골라 팔기: 창 두 칸(왼쪽 내 가방+종류 탭, 오른쪽 팔 물건 −/+/전부, 다 옮기기, 끌어 놓기), 안 받는 것은 흐리게 이유, 합계 → 한 번 더 확인. 좁은 폰은 위아래. 창 폭 640px.
- 서버: /api/island/sell pick [{entryId, qty}] 1~64개, lib/island-items sellPicked(고른 수만, 물고기는 작은 것부터, 나머지는 가방에), requestId 그대로.
- 시험: island-items 단위 「골라 팔기」, island-bag.spec 탭·개수·설명·기억·가구 탭(PC·폰), plaza.spec 관공서·노점 새 흐름.

## v1.10.355 캐기+낚시 미니게임 다듬기 (사용자 2026-11-17, notes island-expansion 「캐기 미니게임 다듬기」, fishing-minigames 「타격감」) + playerRadiusAt + 거울호수

- 같은 효과 도구: public/island-feel.js(글자·흔들림·진동·소리·가방으로 날기·빨간 가장자리, 효과음은 gc.settings.sound, 흔들림·진동은 gc.lessMotion), room-sound 섬 소리(쨍·툭·찰싹·첨벙·찰방·릴·심장·콤보·휙·반짝), plaza-scene feelBurst(조각·불꽃·먼지·물방울 InstancedMesh 풀)·feelPillar·feelFishJump.
- 캐기: 줄어드는 고리(빛 가운데에 딱 겹침 = 보너스), 기다림 흰빛 → 빛 금빛, 바위 위 세 칸(●✕○), 맞힘 쨍!/완벽!, 놓침 툭+먼지, 두 번 맞히면 바로 결과(서버: 스스로 잰 두 번이면 일찍 finish 허용), 광석 가방으로 날기·드문 광석 빛기둥, 「광석 +1 · 오늘 n/60」, 캐는 동안 다른 안내 숨김(islandMining), 폰 큰 「캐기」 단추(빛나는 금).
- 낚시: 타이밍 막대 칸 빛남·찰싹!/완벽!(낚싯대 끝 휨)·첨벙, 화살표 톡 튀기·콤보 소리·n 콤보, 줄다리기 릴 소리·줄 떨림·장력 빨간 가장자리·심장·힘쓸 때 큰 물보라와 진동, 잡았을 때 물고기 튀어 오름+찰방!. 판정은 서버 그대로.
- playerRadiusAt: 문을 칸으로 0.5초마다 다시 담고 3x3 칸만(10.3 → 0.7 kB/프레임), 모든 문 훑기와 같은 답(doorRadiusCheck e2e).
- 거울호수 fishWater: 호숫가 탐침이 타원 4 m 안·강보다 가까우면 lake(호숫가 lake 84→303, river 271→52, 밖 변화 없음).
- 영상·사진 notes img/minigames-355.

## v1.10.354 지형 높이 함수 호출 줄이기 (총괄 2026-11-17: 353 다음 작은 PR)

- island-npcs pointMemo: createWalkers의 walkable을 정확한 (x, z) 기억 표(1024칸, 타입 배열, 할당 없음)로 감쌈 -- 같은 점은 같은 답, 프레임마다 실제 계산 약 20 → 7회(나머지 13회는 기억).
- plaza-scene stepWanderers: 주민 땅 높이는 걸음이 움직였을 때만 다시(c.groundX/Z/Y), 85 m 밖(그리지 않음)은 높이 안 구함.
- plaza-scene canFishHere: 낚시 자리 판정은 내가 움직였을 때만.
- 지형 함수(dalmaru-terrain·island)와 서버 공식은 그대로.
- 측정(work/alloc-353/a.cjs, 처음 자리 가만히, PC): 지형 58.3 → 19.0 kB/프레임, 섬 전체 255 → 205; CPU 4배 느리게: 지형 61 → 18, 전체 329 → 277, fps 17.5 → 18.3.
- 시험: island-npc-walk 단위(pointMemo 같은 답·덜 계산, 실제 걷기 기억 적중), e2e 주민·낚시·택시(bicycle 택시 화면 돌리기 시험 훅 carYaw).
