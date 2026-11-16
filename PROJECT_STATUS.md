# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.335 주식 장 09~23시·주문 횟수 제한 없음 (긴급)

- lib/island-stocks.js CLOSE 17 → 23, PER_DAY 9 → 15(마감가 23:00). 시세는 틱 번호로 뽑아서 첫날(11-16) 09~17시 값·부도 계획이 그대로(키 두 개로 sha1 확인, 단위 시험).
- 하루 주문 20번 제한 없앰(LIMIT 오류·「남은 주문 n번」 표시 지움, 하루 횟수는 기록만). 수수료 0.5%·한 회사 1,000주 그대로.
- 화면·오류 문구 「오전 9시~오후 11시」.
- 다음: 1.10.336 138 주민 크리스마스 차림·하얀 눈(103A)·앉기·택시 화면 돌리기.

## v1.10.334 크리스마스 3 ②: 썰매 언덕·눈 요새 (P2·P3, 128)

- 썰매 언덕(128): 눈사람 밭 남쪽 풀밭(대청마당 포장 밖, 영웅마루 벽감 앞 비움), 발치 (-17, -115.5), 서쪽으로 내려옴. 아래 끝 「썰매 타기」 → 꼭대기 출발, 약 5초(최고 6 m/s), 발치 지나 5 m 미끄러져 멈춤. 다른 화면에도 썰매 탄 모습(act sled).
- 눈 요새 둘: 눈사람 밭과 언덕 사이 포장, (-24.5, -107.5)·(-15.5, -107.5) 마주 봄. 둘레에서 SPACE로 눈덩이(앞쪽 가까운 사람 겨눔, 11 m), 맞은 화면이 HitReact·눈 묻음(snow:hit), 요새 벽이 막음. 다섯 번에 도장 「눈싸움 한 판」 1개 하루 1(서버 셈, 0.8 s 간격).
- 행사 동안만 놓고 막힘 원도 그때만. XmasPlay(xmas-play.js).
- 사진 notes img/xmas5-334.
- 다음: 섬 경매장.

## v1.10.333 크리스마스 3 ①: 산타 썰매·양말 선물 (M6)

- 썰매 비행(127): 24일 21~22시, 반지름 105 m·높이 40 m(1.8배)로 2분에 한 바퀴, 행사 시계라 화면마다 같은 자리. 내 위 45 m 안이면 Wave(산타 손). IslandCalendar.sleighOf.
- 양말 선물: 25일 06시부터 집에 양말 걸이(xmas_stocking)가 걸려 있으면 사탕 주머니 2 + 「산타」 도장 편지, 계정·행사마다 한 번(가방이 차면 다음에).
- 관리실 미리 보기 「12월 24일 밤 (산타 썰매)」.
- 사진 notes img/xmas4-333.
- 다음: 1.10.334 P2 눈 요새·눈싸움, P3 썰매 언덕(사용자 95A·96A·97A).
