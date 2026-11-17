# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.353 무게·검토 고침 (gpu-weak-audit, 사용자 185A~190A, Codex 341~350 P2 나머지, 재사용 1~4, §9 ⓐ)

- 무게: 화면 밖·85 m 밖 캐릭터 안 그림(186A 서 있는 NPC 85 m), 섬·모델 부품 행렬 얼리기, LOD·열린 창 판정 줄이기, 기록의 탑 먼 곳 건너뜀, 185A 중간 그림자 격 프레임, 187A 화질 기억(gc.autoTier, 7일·기기마다)·다시 올리기, 189A 방은 장면에서 떼기, 방 글자 판·뼈대 텍스처 정리, 지형 높이·문 목록 가비지 줄이기, [client] 로그 재시작에도 이어짐(clientReport), 190A 앱 배지는 메신저 창만.
- §9 ⓐ 셰이더 다시 고르기 0회/프레임: 수조 물·폭포·유리 forceSinglePass, 묶음(인스턴스) 복사본 재질 쌍둥이(asset-loader instTwinOf, propBatch batchTwin, 거품 고리 foamInst), 그림자 깊이 재질(기차 기둥, 뼈대 모델). 섬 전체 320 → 257 kB/프레임.
- 재사용(kB/프레임): 폭죽 21.7 → 2.2, 비눗방울 6.6 → 1.4, 말풍선 2.1 → 0.5(+텍스처 재사용), 깜빡·입·시선·택시 4.3 → 1.7, 감정 표시·그물 0.8 → 0.2. 측정 work/alloc-353/a.cjs.
- Codex 341~350 P2: #3 묶음 구매 requestId(buyReqs), #4 맡기기 pending은 게시판 저장 뒤에 지우고 새 올리기 전 복구, #7 되살리기 TRUNCATE 한 번·외래 키 순서(restoreOrder), #8·#9 도장 가구와 stampHanded를 setWorldValues로 한 번에·353 뒤 구매는 시간 제한 없이 다시 받기, #10 islandUse 재시도도 bought.
