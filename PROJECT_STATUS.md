# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.352 주식 개편 (사용자 176A, notes island-stocks 끝 「주식 개편 패치」)

- ① 섬 소식: 한 줄(시각·회사 이름 전부·▲/▼%), 누르면 소식 문장·그때 값(newsOf price)·회사 보기.
- ② 거래 기록: order()가 stocks 문서에 log(최근 200건: 시각·회사·사기/팔기·주 수·값·수수료·판 거래의 gain=판 값-평균 산 값), tw(이번 주)·tot(지금까지) 합계. 「이번 업데이트부터 기록돼요」.
- ③ 회사 그래프(오늘·지난 7일)에 내 평균 산 값 점선.
- ④ 관심 종목(별표, 시세 위로)·알림(회사마다 넘으면/밑이면 하나, 10개까지) POST /api/island/stocks/watch, 문서에 저장; 값이 새로 붙을 때 화면 알림(창 열려 있을 때, 다음 값 시각 뒤 30초마다 한 번 확인).
- ⑤ 회사 정보 카드: 업종(소식 json)·성격·상장가·상장 날짜·최근 소식 3줄.
- ⑥ 이번 주 순위 줄마다 번 돈 ▲/▼ P(weekGain, 순위·칭호는 수익률 그대로).
- 시험: island-stocks 단위(기록·gain·합계·200건·weekGain·watchSet·회사 정보·소식 값), e2e PC·폰(카드·평균선·별표·알림·거래 기록·순위 P·소식 펼치기). 사진 notes img/stocks-351.

## v1.10.351 긴급 고침 (Codex 341~350 P1 2 + P2 3, notes docs/codex-review-341-350.md)

- P1 #1 채굴 타이밍 위조: 누를 때마다 POST /api/island/quarry/tap, 서버가 받은 시각과 맞는 것만(IslandQuarry.tapAt, 오간 시간 -150~2000 ms); finish는 서버가 기록한 타격으로 판정(body.taps 안 읽음).
- P1 #2 손보기 상자: post를 고치기 버튼보다 먼저 선언(낡은 집에서 ReferenceError).
- P2 #5 화강암 벽 실패 보상 없음(작은 돌·곡괭이 닳음 없음).
- P2 #6 화강암 벽 미니게임: plaza-scene quarryWall(PROPS rock_wall_a_granite holder)로 시작.
- P2 #11 도박 구금: 구치소 상태 GET·퇴장 요청에서 jailable 다시 판단, 자정 지나면 풀림.
- 나머지 P2(#3 #4 #7 #8 #9 #10)는 다음 무게·검토 고침 묶음.
- 시험: island-quarry 단위(제때 보낸 타격·끝에 몰아 보낸 타격·벽 실패·tapAt), 도박장 단위(자정 지나 풀림), e2e 채석장(바위+화강암 벽 PC·폰), 마당(낡은 집 손보기 상자 열림).

## v1.10.350 체납 불이익 강화 묶음 (notes tax-bill-design 끝, underground-den 끝, island-expansion 끝, issue-log-review-20261116 끝)

- 체납 막기(서버 IN_ARREARS): 주식 주문, 벼룩시장 /list, 도박장 입장·칩 사기, 도장 가게 buy, 택시 자유이용권. 반성문 5줄 + 체납 중 통과마다 3줄(30줄까지, island-jail sentencesOf 23문장 돌려 씀), 다 내면 5줄(jail doc taxEssays). 184A: 체납 반성문 친해도 안 줄음, 체납으로 갇힐 때 하루 한 번 구치소장 호감도 -1·연속 +1씩·하루 -5까지(IslandJail.taxJailTake, point-store affinityTake 0 아래 안 감).
- 도박장: 테드는 암호·비밀문만, 지하 바 카운터(IslandDenRoom.BAR·atBar) SPACE 「칩 바꾸기」(지갑 전부 5만 이상·돌려받기), 바꾸기 전 탁자 DEN_NOCHIPS, 계단으로 나가면 남은 칩 포인트로(cashed), 카운터 안내 표지판.
- 채석장: DAILY 60·ORE_PER_ROCK 6(저장된 left 그대로, 다음 차오를 때 6). 화강암 벽(입구 쪽 rock_wall_a를 rock_wall_a_granite로, 칠 곱하기 [1.45,1.5,1.62], 벽면 표지판, 자리 3): 화강암만·안 빔·한도 밖, 실패하면 작은 돌. 화강암 상인 50P.
- 도구 들었을 때만: doors `tool`(채석장 바위·벽 = 곡괭이), 물가·곤충 안내 없앰, 곡괭이 자동 들기 없앰.
- 강가 꽃 늘 보이기(빨강·노랑·하양, 심부름 중엔 그 색), 마우스 잠금 중 감정 휠(blocked → 잠금 풀림·다시 잠금, 숫자 1~9).
- 시험: arrears-penalties(막기·5→8→30→5·호감도 날수), island-jail 5줄, island-den-server 바 흐름, island-quarry(60/6·벽), e2e island-den·fp·emotes·island-tool-rules·island-jail·plaza 채석장/낚시·dalmaru-walk. 사진 notes img/arrears-350.
