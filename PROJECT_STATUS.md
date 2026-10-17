# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.86 주민세·세금 창구

- 결정(사용자 2026-10-17): 주민세 재산의 3%를 하루 단위, 최소 20,000P, 모든 계정에서; 최대 체납 200,000P; 체납자는 「체납자」 칭호 강제·흰색/검은색 줄무늬 옷 강제; 체납 세금은 관공서 창구에서 직접 납부; 세금·예금 창구는 별도 NPC 창구.
- 저장(`lib/point-store.js` `taxSplit`·`taxCollect`·`taxPay`·`taxDebts`): 재산 = 지갑 + 예금(그날 이자까지), 세액 = max(20,000, 재산×3% 내림). 지갑 먼저·예금 다음·남은 것은 체납(200,000P까지만 쌓임, 넘는 것은 걷지 않음). 하루 한 번(JSON 키, PostgreSQL 새 표 `tax_days`·`tax_debts`), 원장 `resident_tax`·`tax_payment`.
- 서버(`server.js` `collectTaxes`): 한국 시간 날짜가 바뀌면(5분마다 확인) 모든 계정(권한 취소 계정 포함)에서 그날 세금; 서버가 잠든 동안 지난 날짜도 깨어날 때 하루씩 차례로(최대 30일, Codex 검토). 납부 요청은 예금만으로 낸 경우도 한 번만(PostgreSQL 원장 표시, Codex 검토). `lookFor`: 체납 중이면 장착 칭호 대신 「체납자」, 의상은 줄무늬(`avatar_outfit_2`, `look.prisoner` → 바탕 흰색·줄 검정, 변신 해제). `/api/island/tax` GET(체납·오늘 밤 예상)·POST(세금 창구 1.8m 안에서 납부).
- 화면: 민원실 창구를 민원(정산)·세금·예금 세 칸, 직원 셋·명패 셋(창구마다 1.8m 안에서만). `#taxDialog`, 이름표 빨간 「체납자」 표식. 포인트 내역 「주민세」·「체납 세금 납부」.
- 검증: `test/resident-tax.test.js`(세액 계산, JSON·PostgreSQL 하루 한 번·체납 상한, 서버 전 계정 징수·체납자 칭호·줄무늬·세금 창구 납부로 해제), 예금·관공서 실내·잡초 정산 시험 갱신, e2e 관공서 흐름, 화면 확인(줄무늬 옷·체납자 표식·세 창구). 실제 휴대폰 미검증.

## v1.10.85 관공서 예금 창구

- 결정(사용자 2026-10-17): 은행 건물 없이 관공서 실내에 예금 창구, 예금 금리 하루 4%·이자 상한 없음·입출금 제한 없음, 대출 없음. 주택·방치 회수는 보류(IDEAS 은행 절).
- 저장(`lib/point-store.js` `bankAccrue`·`bankView`·`bankMove`): 지갑과 예금을 따로, 한국 시간 자정마다 예금 + 예금의 4%(원 단위 내림, 복리) — 접속 없는 날도 다음에 볼 때 지난 자정 수만큼 계산. 맡기기·찾기는 요청 id로 한 번만, 원장 `bank_deposit`(지갑 −)·`bank_withdraw`(지갑 +). JSON은 계정에 `deposit`·`depositDay`, PostgreSQL은 새 표 `bank_deposits`(기존 표는 바꾸지 않음). 기술 상한은 안전한 정수(약 9천조 P)뿐.
- 서버(`/api/island/bank` GET·POST): 관공서 실내에서 예금 창구 3m 안일 때만. 화면: 민원실 창구를 왼쪽 「민원」·오른쪽 「예금」 두 칸·직원 둘·명패, SPACE · 예금 창구 → `#bankDialog`(지갑·예금·내일 예상 이자, 맡기기·찾기·전부). 포인트 내역 「예금 맡기기/찾기」.
- 검증: `test/bank-deposit.test.js`(이자 계산·복리·같은 날·상한, 저장소 JSON·PostgreSQL 같은 동작, API 창구 거리·부족·한 번만·내역), 관공서 실내·잡초 정산 시험, e2e 가방·관공서·상인·시장 정문, 화면 확인. 실제 휴대폰 미검증.

## v1.10.84 관공서 실내 — 1층 민원실 · 휴대폰 조작 배치

- 지시(사용자 2026-10-17 3순위, IDEAS 「관공서 실내 공간」 2026-10-07 확정): 본섬과 좌표·렌더링이 분리된 공용 3D 실내, 1층 민원실 하나, 정산·분실물 반납을 실내 창구로.
- 공간(`island-terrain.js` `TOWNHALL_ROOM`·`roomClamp`): 섬 밖 (0, -330), 16×11m, 문은 +z·창구는 뒤쪽. 서버(`server.js` `townhallInside`): `POST /api/island/townhall/enter`(관공서 문 앞 2.4m·시장 허가·열차 아님) / `leave`(방 문 앞)로 서버가 직접 옮김, 실내 포즈는 방 안으로만(늦게 온 다른 공간 포즈는 무시), presence `space`, 접속이 끊기면 다음 방문은 관공서 문 앞. 관공서 정산(`/api/island/sell` office)은 실내 창구 3m 안에서만(Codex 검토 P2 — 문 앞 정산 막음). 채팅은 같은 공간끼리만.
- 화면(`plaza-scene.js` `buildRoom`·`setSpace`): 대리석 벽·초록 카펫·창구와 직원·「민원실」 현판·대기 벤치·화분·조명(밤에도 밝게), 앞벽은 낮게(카메라가 넘어봄). SPACE · 관공서 들어가기 → SPACE · 민원 창구(기존 관공서 창) → SPACE · 나가기. 실내에서는 섬 장면·지도를 숨기고(성능), 다른 사람은 같은 공간만 보임.
- 휴대폰 조작 배치(사용자 2026-10-17 「조이스틱·걷기 등을 내가 설정, 기본은 왼손 조이스틱·오른손 상호작용·걷기·뛰기」, 이 패치에 함께): 오른손에 `#islandActBtn`(상호작용=SPACE)·`#islandWalkBtn`(누를 때마다 느리게/보통)·`#islandRunBtn`(누르는 동안 뛰기), v1.10.79의 걸음 버튼 하나는 이 둘로 나눔. 메뉴 「조작 배치」(v1.10.67 조이스틱 조정을 넓힘, `app.js` `CONTROLS`)에서 네 조작을 끌어 옮기고 마지막에 누른 것의 크기를 슬라이더로, 각자 이 기기에 저장(`gc.stick`·`gc.ctl.act/walk/run`), 기본값은 넷 모두. 근처 안내는 화면 아래 가운데 글자로(눌러도 됨). 컨트롤러 `paceTap`·`setRun`. e2e `mobile-island.spec.js` 「조작 배치」(기본 좌우 배치, 걷기 전환·뛰기 누르는 동안, 상호작용 옮기기·크기·새로고침 유지·기본값).
- 검증: `test/townhall-room.test.js`(문 앞 아닌 입장 거절·문 앞 정산 거절, 섬 좌표 포즈는 방 안으로, 창구 정산, 창구에서 퇴장 거절·문에서 퇴장), 잡초 정산 시험 실내 흐름으로 갱신, e2e 가방·관공서·상인과 시장 정문, 실내 스크린샷. Codex 검토 P2 반영. 실제 휴대폰 미검증.
