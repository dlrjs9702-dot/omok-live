# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.87 메신저 보완 (IDEAS 대조)

- 지시(사용자 2026-10-17): 「메신저 관련 사항 다 구현했는지 확인하고 부족하면 이어서」. IDEAS `#future-messenger` 대조 결과 보완 3가지.
- 보관: 「부담이 크면 7일, 아니면 계속 보관」 — 가족 규모 단체 대화(메시지 500자)는 부담이 작아 **전부 보관**으로(방마다 최근 1,000개만 두던 정리 제거, 방이 없어질 때만 함께 삭제). `lib/messenger-store.js`.
- 기록 조회: `GET /api/messenger/rooms/:id/messages?before=번호` → 그 앞 100개(`older`, JSON·PostgreSQL), 대화방 위 「이전 대화 더 보기」(보던 자리 유지).
- 알림: 내 계정 화면의 「메신저」 버튼에 안 읽은 새 메시지 수(창이 닫혀 있는 동안 30초마다, 이 기기에서 본 번호 기준).
- 그대로 둔 결정(v1.10.78): 관리자 계정별 허용, 허용자끼리 방 만들기·초대, 한 방 30명·한 사람 20방·500자, 채팅만(통화·파일 없음).
- 검증: `test/messenger.test.js`(전부 보관·이전 대화 100개씩), e2e `messenger.spec.js` PC·휴대폰(버튼의 「새 메시지 1」 포함). 실제 휴대폰 미검증.

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
