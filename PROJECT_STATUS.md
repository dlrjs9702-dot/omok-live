# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.237 문제 기록 ②-a + CI A·B안

- 1103 4·1104 E: 쓰레기 해안 32·풀밭 28·윤슬만 8(넓이 비율 v1.10.50 대비 해안 ×3.44·풀밭 ×3.01 → 27.5·18, 사용자 최소가 큼), 풀밭 쓰레기 셋에 하나는 길 위·해안 쓰레기도 길 제외 풀림(다리·계단은 막음), 잡초 TARGET 2,800 → 4,300·GROW_MAX 700 → 1,080(v1.10.113 대비 걷는 땅 ×1.54). 공급 244,000 → 520,000P/h(경제 값으로 조절).
- 1103 4 한 번 공지: /api/island/notices(계정별 seen, 시험은 /api/test/notices로 켤 때만), 섬 종이 창 「📢 섬 소식」 + 「알겠어요」.
- 1103 9: 근무표 박물관 자리(한결·하람·이솔, POST_AT museum), 따로 서던 안내 주민 없음 — 출석대 근무자가 「섬 안내」(안내 단계 「말 걸기」는 출석대), 행사 주인은 HOSTS 주민 모습·「수확제 · 한들 · 말 걸기」, 느티는 부탁 주가 아니어도 매일 정자.
- 1104 G: 1인칭에서 던진 낚시는 끝까지 1인칭(fpNow에서 !fishing 뺌), 던질 때 물 쪽 보기, 줄은 손에 든 대 끝에서 물 위 찌로, 잡은 물고기는 1인칭 손에 쥐고 눈앞 오른쪽 아래.
- 덤: 풍선은 이름표 옆으로, quickbar 시험 개수 20.
- CI A안: main push 실행 없음(workflow_dispatch·주 1회 schedule), 초안 PR은 part·모으는 검사 건너뜀, md·docs만 PR은 안 돎. B안: CI에서 재시도 2, ci-timings 236 초록으로 새로, PC 13 + 휴대폰 6.
- B7: 새 spec 셋을 island-view-modes·resident-roster에 합침(섬 입장 안 늘림), 공지 본 것 저장은 단위 island-notice-server. Codex 검토는 10번에 한 번(240·250…) 규칙으로 docs/release.md·AGENTS.md·CLAUDE.md 고침.

## v1.10.236 빠른 칸

- notes docs/quickbar-20261104.md: 다섯 칸(도구는 종류, 쓰는 것은 물건별), IslandItems.quickSlots(다섯 칸·도구와 쓰는 것만·한 물건 한 칸) + /api/island/quick(계정별 world 값 quick:<계정>).
- 가방 말풍선 「빠른 칸에」 → 가방 아래 빠른 칸 누르기 또는 1~5, PC는 끌어다 놓기도; 칸의 「빼기」. 쓰는 것의 가방 말풍선은 「쓰기」 → 「들기/넣기」.
- 섬에서 1~5(Digit·Numpad, 글 칸·다른 창 제외, 대화 창은 답 고르기 그대로)·칸 탭으로 들기, 같은 칸 다시 넣기. 든 쓰는 것은 앞에 아무것도 없을 때 「SPACE · 폭죽 쓰기」(goods/use 그대로), 다 쓰면 손에서 내리고 「다 썼어요」, 0개 칸은 「없어요. 잡화점에서…」.
- 든 것(도구·쓰는 것)은 plaza/state held로 곁 사람에게 보임(낚시 중엔 낚시 대).
- 화면: 아래 가운데 종이 칸(든 칸 올림·진한 테두리, 빈 칸 점선, 다 쓴 칸 흐림), 휴대폰은 오른쪽 끝 세로 줄(걷기 단추 위, 44 px — 캐릭터를 안 가림; 가로로 들면 아래 가운데), 휴대폰 안내 쪽지는 가방·사진 오른쪽에 두 줄까지, 든 폭죽·비눗방울은 손에 0.85·0.7 m, 풍선은 옆 머리 위로, 창·사진·낚시 화살표 중 숨김, 안내판은 줄 위로.
- CI: 휴대폰 e2e 4 → 5묶음, ci-timings 새로(235 초록 바퀴).

## v1.10.235 문제 기록 ①

- Codex 6차 P3 다섯(각 단위 시험): 가구 리폼 같은 요청 다시 보내면 집도 저장, 섬 가꾸기 보태기가 사업 저장에 실패하면 같은 requestId로 다시 반영(한 번만), 메신저 사진 붙이기 일부만 되면 되돌림·JSON 저장소 await 없음, 사진 하루 한도에 올리는 중인 사진 포함, 물고기 팔기 같은 어종은 모든 칸에서 작은 것부터.
- 1103 10: 고르는 창 WASD(event.code, 글 칸 제외) — 대화 답·가방(Shift+WASD 옮기기)·게임관·배치 도구·낚시 화살표; 게임관 카드·방 목록 W/S는 화면 위·아래 칸, 맨 윗줄 W는 칩, 칩 S는 첫 카드.
- 1103 5: PC 창 1100px 이하에서 안내 쪽지를 단추 줄 위로, 두 줄까지.
- 1103 8: 역 이름판 아래 도착 안내판(분 올림 = 서버 판정, 1분 안 「곧 도착」), 승강장 「도착 2분 15초」.
- 1103 11: 섬 종이 창 안 어두운 부품(미션 탭·줄·막대·보상, 스킨 상점·지뢰찾기·이벤트·포인트 지급 창 종이, 하늘 계단 요약).
- 1103 3: 1인칭으로 앉아도 1인칭(앉은 눈높이, 앉은 방향 ±100°).
- 1103 2: 큰 집 반벽 앞 조각을 앞벽까지(모델 꼭짓점, fixed 맞춤).
- 1103 6: 실내 출구 다섯 곳 문간(1.6×1.2 m 틀·「나가기」·빛·매트), 바깥으로 걸어 들어가면 0.3초 뒤 나가기, 들어오자마자는 문간을 한 번 벗어나기 전까지 안 나감, 돌아서면 남음, 창·꾸미기·배치·앉기 중 꺼짐.
- 총괄 검토: 모델 문틀 있는 관공서·잡화점은 빛·매트·「나가기」판만, 구치소 벤치를 문간 정면에서 옆으로(2.6, -3.2), 전시 자전거는 탈 때 크기.
- Codex 235 검토(astra high): 섬 가꾸기 다시 반영은 1시간 안·요청 기록 2시간, 사진 올리기는 계정마다 차례로.
- 1104 A~D: 섬 표지판·명판 막힘, 펫 마당 문 0.9 m 높게, 전시 자전거 바퀴, 배웅 배는 땅 없는 바다 쪽으로(카메라도).
