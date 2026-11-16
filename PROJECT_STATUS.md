# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.341 지하 도박장 (113C·114B·115A·116A·117B·118·119B·121A·122A·123A, 140A·141A·142A, 검토 §1-5~7) + 에셋 150c

- 규칙 lib/island-den.js: 판 4가지(주사위 크다·작다·홀·짝 ×1.96 세 개 같으면 짐, 카드 하이로우 0.95/확률, 룰렛 19칸 ×2·숫자 ×18, 슬롯 세븐 43·셋 15~5·체리 둘 2.5·하나 본전), 집 몫 약 5%, 한 판 1~5,000칩, 1초에 한 판. 140A 칩: 테드 창에서 포인트↔칩 1:1, 단속에 걸리면 칩 몰수(지갑 벌금 없음).
- 암호: 서버 열쇠·날짜로 오늘의 암호와 쪽지 벤치. 테드에게 말하면 그 계정 그날 책장 비밀문(147) 열림 → 지하 방(den_room, 310,−330).
- 단속 142A: 지하에 누가 있을 때만, 평균 40분 머물면 한 번, 하루 6번까지. 관공서 닫힘(안에 있던 사람 문밖, 「잠시 자리 비움」 팻말), 마루·단비·한솔·새롬이 관공서→거래소를 걸어감(서버 시각, 모든 화면 같음), 141A 내려오기 12초 전 지하 등불 깜빡임·테드 헛기침, 도착하면 지하에 있는(끊긴 접속 포함) 계정 칩 몰수·구치소. 다시 켜지면 단속 취소.
- 구치소: 계정에 저장(questDoc denJail, 그날 자정까지), 도박 반성문 121A(5줄, 「다시는 지하에 내려가지 않겠습니다」로 시작), 통과하면 세금 구치소도 같이 풀림, 123A 마루 용서장 화면.
- 에셋 147 den-v1 넣음(REGISTRY·파이프라인·island-assets 제외·예산 예외), 150c 6항목(감옥 칸·객차 Low·매장 선반 3·쪽지) 예산 안으로.
- 사진 notes img/den-341.

## v1.10.340 섬 벼룩시장(138A) + 주식 소식(102A) + 택시 133A + 깜빡임 고침 + 에셋 150

- 벼룩시장: lib/island-flea.js, /api/island/flea(GET·stock·list·buy·withdraw·claim), worldEdit 한 줄; 값 0.5~20배, 수수료 5%, 한 사람 10개, 3일. 134 같은 입장 파일 거래 허용(내 물건만 못 삼). 135B 게시판 「받기」+우편+「받을 돈」 표시, 136A 언제든 거두기, 137A 물고기 크기 그대로. 검토 §1: 3일 안 받은 대금 자동 지갑, 산 물고기·곤충 meta.bought(낚시왕 판매 합·박물관에서 뺌), 간식·도구·자전거·펫·쓰레기·지갑·분실물·퇴비·트로피 못 올림(150 사용자 확인 중). 게시판 137c, 밤 전구.
- 주식 소식 102A: lib/island-stock-news.json, 섬 소식 탭, 부도 까닭(139B 새 식 위에).
- 택시 133A: 1초 빵·「비켜 주세요~」, 3초 뒤 길 폭 안 옆으로(1.5 m까지, 사람과 1.3 m), 다리·건널목·틈 없으면 반투명 천천히, 지나가면 가운데·불투명. ride.side·ride.ghost(서버 시각) 모든 화면 같음.
- 깜빡임(flicker-signs-20261116): 글자 판 polygonOffset(boardText·plaque·밭·잡초·채석장·대회·역 판·행사 판), 구치소 반성문 판 25 mm 앞, 박물관 고침 A(「바다」·「대어 수조」 빈 이름판, 이름표 가운데 ±0.75 m 비움).
- 에셋 150: 같은 평면 겹친 면 498개 파일 (예산 넘은 6항목 — 감옥 칸·객차 Low(150b)·매장 선반 3·쪽지 — 은 이전 파일, 에셋에 다시 요청), 초승달은 150판. 한쪽만 온 25개 항목은 150 폴더 `06. Kept from game`을 원본으로.
- 콩이 (−15, −60.5).
- 사진 notes img/flea-340·flicker-340·assets150-340.

## v1.10.339 섬 주식 값 식 고침 (139B, 검토 §1-1)

- lib/island-stocks.js: 틱 15(11-17 09:00)부터 상장가 끌림(0.02 × (log 상장가 − log 값)) 뺌, 소식 점프 J → J − log cosh J(평균 1). 같은 뽑기 그대로라 틱 14까지 값은 같음(단위 시험).
- 단위 시험: 검토 모의(하루 21시 60% 아래 사서 95%에 팔기, 60일, 열쇠 8개) — 옛 식 하루 +174만 P·진 판 0/8, 새 식 하루 +1만 P·진 판 4/8.
- 다음: 크리스마스 다음 묶음 벼룩시장(+택시 133A).
