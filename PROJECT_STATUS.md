# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.226 가구 리폼 (3층 계산대·같은 모양 다른 색·놓인 가구 그대로)

- island-furniture reformColors/reformTo: 같은 모양의 있는 색만(행사·마당·한 색뿐 제외), 새 모델 없음.
- 서버 /api/island/furniture/reform(3층 계산대 3 m, worldEdit 안): 경제 값 furniture:reform 3,000P, claimId furniture:reform:<requestId> — 같은 요청 재전송은 ok, 이미 낸 requestId로 다른 색·조각은 USED. 가구 창고 id + 놓인 조각은 같은 uid·자리·방향(수조 물고기·위 물건 그대로, 2층 같음).
- SSE homeInside: 집 안 손님이 집을 다시 받음(리폼·가구 놓기).
- 화면: 계산대 대화 「가구 리폼」 → 내 가구(「놓임」) → 색 칸(「지금」)·3D 미리보기 → 「바꾸기」.
- 시험: furniture-reform 단위·e2e(PC·폰, 근무표 켜고), island-tool-rules는 곤충 4 m 안 잡초 뺌.

## v1.10.225 마당 꾸미기 (3층 「마당」 진열대·내 마당·마당 넓히기·2층 큰 집 막기)

- public/plaza/island-yard.js(서버·화면 같이): 집 모델 바닥+처마 둘레 마당 칸 — 처음 2.5 m·넓히기 4 m·6 m(땅 닿는 데까지), 집·현관→길 1.4 m·섬 길·물가·비탈·이웃 쪽·나무·덤불·가로등·툇마루역 승강기 뺌. 0.25 m 칸·90° 돌리기·겹침 막음(울타리는 끝 기둥만), 개수 24/40/60.
- 3층 「마당」 진열대 12칸(경제 값 yard:<모양>), 가구 창고 가구·마당 칸, 집 안↔마당 섞기 서버가 막음. /api/home/yard(내 마당에 서서), /api/home/yard/grow(민원실, yard:price_2·3 = 100,000·200,000, 바로), 단계는 worldValue yard:<계정>(집터 풀어도 남음). 집 넓히면 걸린 물건 창고로+관공서 쪽지.
- 장면: 모양마다 인스턴스 한 묶음(Low 멀리), 막는 원은 걷기 격자에(아치 양 기둥만, 디딤돌 안 막힘), 벤치 두 자리, 석등·정원등 nightGlow. 2층 큰 집(4단계)도 큰 집 원으로 막힘.
- 에셋 70(yard-v1 12개). 시험: island-yard 단위, e2e yard(PC·폰, 실제 모델은 SHOT_DIR 때만, 프레임 비교 한 줄).

## v1.10.224 섬 가꾸기 3 (강 어귀 다리·낚시터·전망대·투광등 빛)

- 새 다리: 은하내 어귀(161.4, −15), 열리면 지형 다리 규칙(projectTerrain — 서버·화면, reset 때 뺌). 길: walk 13 → 다리 48 m + 건너편 2 m(ground-v2 다시 만듦, 저절로 다리 없음).
- 강 어귀 낚시터: 건너편 둔덕(바다·강), fish:mouth SPACE 낚시·미니맵 이름, 열리기 전 못 감.
- 능선 전망대(−43, −136): 뒤 계단 SPACE → 망원경(서쪽 먼 바위산).
- 투광등 밤 빛 기둥·바닥 빛(가산, 불투명도 낮게).
- 시험: island-projects 단위·dalmaru-paths 다리 잇기·island-events 열 명 고정, e2e island-projects-3(새).
