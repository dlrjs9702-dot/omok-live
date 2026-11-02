# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.226 가구 리폼 (3층 계산대·같은 모양 다른 색·놓인 가구 그대로)

- island-furniture reformColors/reformTo: 같은 모양의 있는 색만(행사·마당·한 색뿐 제외), 새 모델 없음.
- 서버 /api/island/furniture/reform(3층 계산대 3 m, worldEdit 안): 경제 값 furniture:reform 3,000P, claimId furniture:reform:<requestId> — 같은 요청 재전송은 ok, 이미 낸 requestId로 다른 색·조각은 USED. 가구 창고 id + 놓인 조각은 같은 uid·자리·방향(수조 물고기·위 물건 그대로, 2층 같음).
- SSE homeInside: 집 안 손님이 집을 다시 받음(리폼·가구 놓기).
- 화면: 계산대 대화 「가구 리폼」 → 내 가구(「놓임」) → 색 칸(「지금」)·3D 미리보기 → 「바꾸기」.
- 시험: furniture-reform 단위·e2e(PC·폰, 근무표 켜고), island-tool-rules는 곤충 4 m 안 잡초 뺌.
