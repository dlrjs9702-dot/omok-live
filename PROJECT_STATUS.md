# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.337 문제 기록 11-16 묶음 (A2·A3·111A·112A)

- A2: 대청마당 포장·분수 원·관공서 마당에 계절 땅 덮개·지면 레이어 안 나옴(island.js bareGround).
- A3(91A): 지금 채석장 범위(IslandQuarry.inArea)에 잡초(시작·새로 남)·채집물·곤충·바람 풀 없음.
- 111A: 키 큰 장식 풀(ground.tallgrass 240곳) → 같은 자리에 작은 들꽃(nature.flower 2·1·4), 포장·채석장 밖.
- 112A: 포장 돌에 돌결(135 모래 그림)·돌마다 밝기·색(넓은 무늬)·이음매 쪽 그늘, 323과 같은 단계(높음·중간). PC·폰 60 fps(화면 상한) 그대로.
- A1: 분수 둘레 밝은 부채꼴은 에셋 59 원판의 금빛 초승달 상감(의도한 장식) — 바꿀지 사용자 확인 필요.
- 사진 notes img/issues-337.
- 다음: 섬 경매장(137) + 주식 소식.

## v1.10.336 주민 크리스마스 차림(138)·하얀 눈(103A)·앉기·택시 화면 돌리기

- 138: 주민 29명 47모습의 산타 모자·목도리·머리 장식을 Head·Neck 뼈에(resident-xmas-fits.js), 크리스마스 행사 기간·관리실 미리 보기에 40 m 안 주민만, High/Low는 몸 따라. REGISTRY xmas.resident.* 10.
- 103A: 눈 언덕·요새·눈사람 밭 눈 하얗게(색 1.2배 + 푸른 빛, 낮 0.42·저녁 0.24·밤 0.1), 재질 하나씩 나눠 씀.
- 앉기: 1103 3의 ±100° 제한 없앰, 3인칭 앉아도 마우스 잠금으로 둘러보기. 택시: 차 방향 바뀐 만큼만 따라 돌고 내가 돌린 각도 유지, 내려도 이어짐.
- 24일 밤 미리 보기는 화이트 크리스마스를 켬; 대청마당은 계절 구역이 아니라 눈 덮개가 원래 없음(사진 white-plaza / white-west).
- 사진 notes img/xmas6-336.
- 다음: 1.10.337 문제 기록(A1~A3·111A·112A).

## v1.10.335 주식 장 09~23시·주문 횟수 제한 없음 (긴급)

- lib/island-stocks.js CLOSE 17 → 23, PER_DAY 9 → 15(마감가 23:00). 시세는 틱 번호로 뽑아서 첫날(11-16) 09~17시 값·부도 계획이 그대로(키 두 개로 sha1 확인, 단위 시험).
- 하루 주문 20번 제한 없앰(LIMIT 오류·「남은 주문 n번」 표시 지움, 하루 횟수는 기록만). 수수료 0.5%·한 회사 1,000주 그대로.
- 화면·오류 문구 「오전 9시~오후 11시」.
- 다음: 1.10.336 138 주민 크리스마스 차림·하얀 눈(103A)·앉기·택시 화면 돌리기.
