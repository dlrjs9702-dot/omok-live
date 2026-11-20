# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.381 요리 대회 주제·점수 도장(사용자 결정 15 A)·행사 할 일 「섬 대회 참가」(결정 14 A)·크리스마스 안내

- 요리 대회: lib/island-festival COOK_THEMES 6개(버섯·물고기·열매·밭 채소 2+·세 종류 다름·약재)를 서울 날짜 일수 % 6으로 하루 하나, 맞으면 +30점·심사 말 앞에 「오늘 주제에 딱 맞아요!」. 도장 cookStamps: 90 미만 1·90~139 2·140 이상 3(award에 이번 도장 수). 행사 창 요리 대회 칸 「오늘의 주제 · …(맞으면 +30점)」, 결과 「N점 · 도장 N개를 받았어요」, 할 일 줄 「도장 1~3개」. 점수 식은 그대로(재료 값 합/100 + 종류×10).
- 주말 대회(IslandCalendar.CONTEST.on false)가 꺼져 있는 동안 「매주 대회 참가」 줄은 행사 창에서 숨기고 taskOpen도 닫음(켜지면 다시).
- 수확제·크리스마스 tasks에 islandContest 「섬 대회 참가」 도장 1·하루 1: 서버 contestNote에서 그날 섬 대회 기록이 남으면 IslandFestival.award(결과에 stamp, 있을 때만). 행사 창 안내 「매일 HH:MM 섬 대회, 행사 가판대 옆 천막에서 참가해 기록을 남기면」(관리자 대회 시각, /api/island/festival contestTime).
- 크리스마스 「마켓 들르기」·「눈싸움 한 판」 안내가 「요리 대회 칸에서」로 나오던 것 바로잡음.
- 크리스마스 마지막 7일 도장 50 → 55(섬 대회 7). 시험: island-calendar(숨김·하루 1번), festival-server(크리스마스 할 일 목록), island-contest-server(행사 시계 고정, 첫 기록 도장), e2e 계절 행사·크리스마스 창 안내.
- 호랑이 ①~④(결정 16·17)와 공격 패턴은 382, 부팅 무게 383.

## v1.10.380 자리 비움(총괄 결정 11 「A, 1분으로」)·해변 절벽 가려도 보이기(사용자 「건물, 절벽 등에만」)

- 자리 비움: 화면이 마지막 입력(키·누르기·움직이기·휠·터치)부터 지난 시간을 포즈마다 보냄(idle), 서버가 activeAt을 두고(걷기·자리 바뀜·idle 없는 옛 화면은 지금) 1분 지나면 away. 스냅숏 away, 150 ms 틱에서 바뀌면 바로 알림. 서버 plazaSeparate는 away인 사람을 건너뜀, away인 사람이 그대로 서 있으면 밀지 않음. 화면: 이름표에 회색 「자리 비움」 알약, 몸은 반투명(재질마다 사본 하나, 다시 입힌 것도 다음 스냅숏에), otherCircles·주민 걷기 사람 목록에서 빠짐. 시험용 /api/test/away {ms}.
- 해변 절벽: 달마루섬 해변 angular.cliff_a/b(약 4 m)가 카메라-나 선 위에 있으면 SEE.cliff로 그 모델만 내 둘레 구멍(나무 구멍은 그대로 별마루섬만). 땅 절벽은 카메라가 절벽 안에 남아 밖이 보이는 방식(문제 기록 7, camFloor)이라 따로 안 함.
- 시험: e2e general-store 「자리 비움」(두 사람, 4초, 같은 미끼 그 자리에서 사기, 돌아오면 원래대로), island-view-modes 가려도(해변 절벽 cliff 1, 나무 on 0) PC·폰. 단위 native-transformations·skirt-arms의 import 치환 갱신.

## v1.10.379 채석장(사용자 「제한 없애고 바위마다 고르게」·결정 8 A)·곡괭이·158 Pounce·가려도 보이기 별마루섬만

- 곡괭이: 잡화점 줄 kind 표에 곡괭이(e.tool 'pickaxe', qty 합)로 3개까지, TOOL_MAX 안내 「곡괭이는 3개까지」(결정 6 A).
- 채석장: 하루 60번 한도 없음(셈은 남김), 바위는 비지 않음(늘 가득, 캐기마다 자기 claim, quarryKept 안 씀). 화강암 벽 그대로. 곡괭이 닳기 40번 그대로.
- 광석 표(lib/island-ores): 모든 바위 한 조각 기대값 같게 -- 제 광석 몫 흔함 34 %·보통 30 %·드묾 12 %·아주 드묾 7 %, 나머지 12종은 price^beta(목표값에 맞춰 풂), 각 광석은 제 바위에서 가장 많이(흔함·보통 바위는 그 바위에서도 가장 많이), 모든 바위에 네 등급. 보너스·「채석 위 단계」 비율 옛 그대로. 보석 모든 바위 같게: 달빛석 5‰(보너스 15‰), 루비·사파이어·에메랄드 5‱(14‱, 경제 키 단위 ‱).
- 값(결정 8 A): 상인 값 ×0.46 -- 화강암 20·점토·사암 370·석탄·철·구리·주석 550·은 1,380·수정·옥 1,610·금·흑요석 3,680, 달빛석 23,000·루비 등 46,000. 맞힌 한 조각 725P, 못 맞힘(20 %) 작은 돌 100P -> 캐기 한 번 600P, 약 7.5초 -> 시간당 약 480번·288,000P. 잡화점은 상인 값 ×3 그대로.
- 호랑이(에셋 158): 새 Pounce(달리며 뛰어오름), 서버는 Run 0.40~0.55초 위상에서만 덮치기 시작, 화면은 Run을 서버 시작 시각·speed/run으로 재생, Pounce fadeIn 0.1초. 우레 12 m/s가 선 사람 둘레를 돌던 것: 4.5 m 안이면 어느 방향이든 덮치기, 잡기는 몸 중심에서 0.84초 앞발 자리까지의 선분 거리, yaw 감김 고침. 선 사람 18 m에서 약 4초에 잡힘(시뮬).
- 가려도 보이기(사용자 「별마루에서만… 달마루섬은 건물에만」): plaza-scene seeStep의 나무 구멍·가까운 흐림은 IslandTerrain.onIsle2일 때만, 달마루섬 건물은 occlusion.js 그대로. e2e island-view-modes(달마루섬 구멍 없음) + 사진 PC·폰(달마루 숲·광장 나무·별마루 숲·건물 옆).
