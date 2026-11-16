# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.338 크리스마스 12-1~25 확장 + 148 초승달 + 131A 대청마당 눈

- 127A: christmas-2026 시작 12-01(분위기·놀이·할 일·썰매 언덕·눈 요새), 점등 12-01 18시, 24·25 특별한 것 그대로, 관리자 미리 보기 첫날 12-01.
- 128A: 가판대 12가지 — 기존 tree_small 16·fireplace 16·snow_globe 8·stocking 6·gingerbread_house 8·칭호 20, 새 xmas-v3(에셋 149) check_sofa 16·gift_pile 8·rocking_reindeer 14·snowman_lamp 8·gingerbread_shelf 12·rug_snowflake 10. 램프·흔들목마는 밤에만 빛남, 흔들목마 앉으면 rock 노드 ±8°.
- 148: plaza_medallion(높음·낮음) 새 초승달로 교체, sha 확인.
- 131A: 화이트 날 대청마당 얇은 눈 판(분수 둘레 길·네 방향 길은 적게, 분수·수로·화단은 없음) + 트리 윗면 눈. PC·폰 60 fps(화면 상한) 전후 같음.
- 사진 notes img/xmas7-338.
- 다음: 섬 경매장(137) + 주식 소식(4가지 확인 대기).
