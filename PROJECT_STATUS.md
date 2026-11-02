# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.229 1인칭 손 동작 (할 때만 보이는 내 손)

- 공 주먹 → 손바닥·손가락·엄지 낮은 다각형 손(0.7배), 피부색 look.skinColor, 손목 소매는 윗옷 색(asset-loader c.sleeve).
- 빈손은 할 때만(fpBusy): 잡초(0.62 s부터 잡초 든 손), 나무 열매(0.98 s부터 열매), SPACE 톡 0.38 s, 잃어버린 물건 건네기 0.9 s. 0.14 s에 올라오고 내려감, 몸 손 뼈 움직임 0.35배로 화면 안.
- 손은 투명 패스 맨 나중·깊이 시험 없이 그려 나무 잎·가게 유리에 안 가림. 낚싯대·잠자리채 손도 같은 손.
- 시험: e2e fp-hands(PC·폰, 당기기 0.66~1.3 s 모든 프레임 손+잡초, 피부색 둘, 3인칭 손 없음).

## v1.10.228 물결에게 팔기 (근무표가 켜진 섬에서 오늘 물결이 있는 곳)

- 서버 /api/island/sell: fisher 거리 확인을 항구 8 m 대신 questTalkPos('fisher', at)로 — 말 걸기와 같은 기준(걷는 날 물결 옆, mall1 날 1층 계산대, 근무표 꺼지면 항구).
- 원인: 운영은 근무표가 켜져 물결이 항구에 거의 없음, 시험 서버는 근무표가 꺼져 통과했음.
- 시험: fisher-sell 단위(근무표 켜고 계산대 날·걷는 날·멀리서 TOO_FAR·끄면 항구).

## v1.10.227 주간 신상 (옷 10·가구 6 매주, 참치 6칸, 전적관 섬 종이)

- 주: 월요일 0시(서울) 경계, IslandFurniture.weekOf/weekEndsAt(2026-11-02 = 0주). 서버 NEW_WEEK 또는 /api/test/new-week로 고정, 시험 서버는 고정했을 때만 주를 따름.
- 옷: skins WEEKLY_POOL 46종(희귀·전설 avatar, IP·겨울·할로윈·변신 제외), weeklySkins(w) 10종(부위 둘·전설 둘까지·지난주와 안 겹침). 숨긴 것 사기·선물 409 NOT_THIS_WEEK(가진 것은 그대로·입기), 옷가게(avatar 구역)에서 이번 주 10종 모두 삼. 화면: 「이번 주 신상 · 남은 날」 줄.
- 가구: WEEK_SLOTS 6칸(3층 계산대 오른쪽), weeklyOf(w) 드문 바닥 가구 6점(모양 안 겹침), 일일 진열은 드문 것 빼고(벽면 수조 넓은 칸만). 사기 claimId furniture:week:<requestId>, 매진 없음, 하루 수에 셈. 「이번 주 신상」 팻말은 진열대 앞 열린 모서리.
- 게시판: weeklynew:<주> 「[이번 주 신상] 옷 10 · 가구 6」 주마다 한 번.
- 참치: island-home FISH_ROOM 6칸, tankRoom — 큰·원기둥 수조 참치 1 + 2마리, 벽면 2마리(이미 든 건 그대로). 작은 수조에서는 작게 그려 유리 안.
- 전적관: 섬에서 전적 카드·이야기 책/섬 일지·다른 플레이어 조회·랭킹 창(이번 주/전체 섬 단추, 고른 쪽 갈색)이 섬 종이, 로비는 그대로.
- 시험: weekly-new 단위·e2e(PC·폰), general-store 인사 네 방향, my-home 수조 글자.
