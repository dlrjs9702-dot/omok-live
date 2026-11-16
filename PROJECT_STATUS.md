# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

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

## v1.10.337 문제 기록 11-16 묶음 (A2·A3·111A·112A)

- A2: 대청마당 포장·분수 원·관공서 마당에 계절 땅 덮개·지면 레이어 안 나옴(island.js bareGround).
- A3(91A): 지금 채석장 범위(IslandQuarry.inArea)에 잡초(시작·새로 남)·채집물·곤충·바람 풀 없음.
- 111A: 키 큰 장식 풀(ground.tallgrass 240곳) → 같은 자리에 작은 들꽃(nature.flower 2·1·4), 포장·채석장 밖.
- 112A: 포장 돌에 돌결(135 모래 그림)·돌마다 밝기·색(넓은 무늬)·이음매 쪽 그늘, 323과 같은 단계(높음·중간). PC·폰 60 fps(화면 상한) 그대로.
- A1: 분수 둘레 밝은 부채꼴은 에셋 59 원판의 금빛 초승달 상감(의도한 장식) — 바꿀지 사용자 확인 필요.
- 사진 notes img/issues-337.
- 다음: 섬 경매장(137) + 주식 소식.
