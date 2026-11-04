# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.239 배치 도구 가리지 않게·단추 한 모양 + 1인칭 실내 앞벽

- 배치 도구(place-tool 5절, 사용자 「배치시 말풍선이 아래 부분을 다 가리고 있어서 배치할 수가 없어」): body.placing에서 가방·사진·시점·채팅·메신저·☰·할 일 칩·미니맵·빠른 칸·대회 띠·힌트·남 이름표 숨김, 토스트 위 가운데. 판 두 모양 — 고르기(머리 한 줄 + 물건 줄), 들고 있기(상태 한 줄 + ✕ ↻ ⋯ 창고로(놓인 것만) ✓ 한 줄, ⋯이면 ←↑↓→가 막대 위). 단추는 모두 섬 종이 단추(44/48px, 모서리 14), ✓ 놓기만 갈색, 못 누르면 흐리게. 폰은 아이콘만(✓ 놓기만 글). 꾸미기 카메라는 판 높이만큼 view offset + 그만큼 뒤로(insetZoom) — 마당 앞 가장자리가 판 위에 보임.
- 1인칭 실내 앞벽(사용자 「집 안쪽 칸 나누는 부분이 이상해」): 방 모델의 카메라 쪽(−Z) 앞벽이 3인칭용 낮은 벽이라 1인칭에서 낮은 벽 두 토막·문설주·밤·천장 띠가 보였음. homeLid(1인칭 전용)에 앞벽(낮은 벽 바로 뒤, 바닥~천장, 문간 비움, 인방, 양쪽 창)을 더함. 모든 집 단계·2층, 3인칭 그대로. 디버그 whatAt(화면 점의 방 메시).
- 총괄 검토: 빨강일 때 이유 전부(PC 상태 두 줄, 폰 막대 위 종이 띠).
- 3b 몫 먼저: 앉았을 때 걷기 키를 프레임 사이에 짧게 눌러도 일어남(tapped) — 폰 「앉았다 W로 일어나기」 흔들림 원인.

## v1.10.238 문제 기록 ②-b: 섬 대회 = 혼자 하는 게임 대회, 대청마당 대회 천막

- 1103 7-1: lib/island-contest.js 종목을 게임관 싱글게임으로(두더지·카드놀이·다른 색·비트 탭·프리셀·하늘 계단·숫자 터치·스파이더·반응속도, 주마다), 낚시·잡초 뺌. 대회마다 난이도 하나(순발력 보통, 카드 쉬움), 시간 종목은 짧을수록 위, 카드 대회는 대회 id로 만든 씨앗 하나(모두 같은 패). 관리자 창에서 다음 대회 종목 고르기(config.kinds).
- 7-2: 대회 10분 전~끝난 뒤 30분 대청마당 행사 노점 옆 대회 천막(줄무늬 지붕·깃발·「🏆 섬 대회 · ○○」 간판), 앞에 가락(별 표시), 문 contest:tent, 미니맵 표시. 그동안 가락은 걷지 않고 거리 악단 모습도 내려가요. 가락 「참가하기」(천막 곁, POST /api/island/contest/join → 이 대회 출입증) → 그 자리에서 대회 판(GameLaunch place 'contest', 「🏆 대회 · 남은 m:ss」 표시, 다시 하기도 대회 판), 결과 줄에 대회 기록·순위. 대회 전엔 남은 시간·규칙·상금, 뒤엔 1~3위.
- 기록은 천막 출입증이 있는 대회 판만(reflex/cards start의 contest, finish에서 contestNote). 게임관 판은 평소 기록만. 띠: 「… · 대청마당 대회 천막」, 누르면 안내 화살표.
- A4_END(11/7 끔) 없앰 — E1 매주 대회는 233에서 꺼져 있음. 총괄 검토: A4 결과·동상은 따로(soloContestResult, 게임관 앞 (45, −60) 받침대) — E1 contestResult·영웅마루와 안 부딪힘. 점수 종목 0점 안 받음. 천막 세움 간판·깃발 둘·금색 띠, 가락은 천막 앞, 지붕 밑 막음.
- 설계와 다른 점: 지뢰찾기·퍼즐은 모두 같은 문제를 만드는 씨앗 판이 아직 없어 이번 종목에서 뺌(ponytail 표시). 천막 에셋은 주문 전이라 행사 노점 + 도형 지붕.

## v1.10.237 문제 기록 ②-a + CI A·B안

- 1103 4·1104 E: 쓰레기 해안 32·풀밭 28·윤슬만 8(넓이 비율 v1.10.50 대비 해안 ×3.44·풀밭 ×3.01 → 27.5·18, 사용자 최소가 큼), 풀밭 쓰레기 셋에 하나는 길 위·해안 쓰레기도 길 제외 풀림(다리·계단은 막음), 잡초 TARGET 2,800 → 4,300·GROW_MAX 700 → 1,080(v1.10.113 대비 걷는 땅 ×1.54). 공급 244,000 → 520,000P/h(경제 값으로 조절).
- 1103 4 한 번 공지: /api/island/notices(계정별 seen, 시험은 /api/test/notices로 켤 때만), 섬 종이 창 「📢 섬 소식」 + 「알겠어요」.
- 1103 9: 근무표 박물관 자리(한결·하람·이솔, POST_AT museum), 따로 서던 안내 주민 없음 — 출석대 근무자가 「섬 안내」(안내 단계 「말 걸기」는 출석대), 행사 주인은 HOSTS 주민 모습·「수확제 · 한들 · 말 걸기」, 느티는 부탁 주가 아니어도 매일 정자.
- 1104 G: 1인칭에서 던진 낚시는 끝까지 1인칭(fpNow에서 !fishing 뺌), 던질 때 물 쪽 보기, 줄은 손에 든 대 끝에서 물 위 찌로, 잡은 물고기는 1인칭 손에 쥐고 눈앞 오른쪽 아래.
- 덤: 풍선은 이름표 옆으로, quickbar 시험 개수 20.
- CI A안: main push 실행 없음(workflow_dispatch·주 1회 schedule), 초안 PR은 part·모으는 검사 건너뜀, md·docs만 PR은 안 돎. B안: CI에서 재시도 2, ci-timings 236 초록으로 새로, PC 13 + 휴대폰 6.
- B7: 새 spec 셋을 island-view-modes·resident-roster에 합침(섬 입장 안 늘림), 공지 본 것 저장은 단위 island-notice-server. Codex 검토는 10번에 한 번(240·250…) 규칙으로 docs/release.md·AGENTS.md·CLAUDE.md 고침.
