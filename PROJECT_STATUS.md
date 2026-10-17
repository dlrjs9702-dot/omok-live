# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.88 메신저 카카오톡처럼

- 지시(사용자 2026-10-17): IDEAS `#future-messenger-kakao` 구현, 보관은 A안(서버에 전부 보관·기기 저장 없음, v1.10.87과 같음).
- 저장(`lib/messenger-store.js`, JSON·PostgreSQL 같은 동작): 계정별 마지막 읽은 번호(`setRead`, 앞으로만·방 회원만), 1:1 방(`dmRoom`, 두 사람당 한 방 — PostgreSQL은 쌍 잠금; 나간 사람이 다시 열리면 재입장 `joined`), 시스템 문구(`post(..., system)`; PostgreSQL은 기존 표를 바꾸지 않고 보낸 사람 앞에 `!`), 방의 마지막 메시지(`last`), 이름 바꾸기·알림 끄기. 새 표 `messenger_reads`·`messenger_mutes`·`messenger_dm`(기존 표 변경 없음).
- 서버(`/api/messenger*`): 방 보기에 `kind`·`unread`·`muted`·`reads`·`last`·회원 `active`(허용 해제·권한 취소는 안 읽은 사람 셈에서 뺌). 대화를 받으면 그 번호까지 읽음, 내가 보낸 줄은 읽음. `POST /api/messenger/dm`(1:1, 이름 = 상대), 초대·만들기·나가기·이름 변경 때 시스템 문구, `POST …/name`(단체만)·`…/mute`, 1:1 방 초대 막음, 이미 있는 사람 초대 막음.
- 화면(`public/app.js` messenger): 목록에 마지막 메시지·시간·안 읽은 수·🔕, 「1:1 대화」, 방 머리 「이름」·「알림 끄기」, 메시지 옆 안 읽은 사람 수(마우스 올리면 이름, 휴대폰은 눌러서), 날짜 구분선, 같은 사람 연속 메시지는 이름 한 번, 가운데 시스템 문구, 나가기 확인창 「나가면 대화 내용이 모두 사라지고 다시 초대받아야 들어올 수 있습니다」. 메신저 버튼 알림은 서버의 안 읽은 수(알림 끈 방 제외) — 기기별 `gc.messengerSeen`은 더 쓰지 않음.
- 남긴 것: 실시간(SSE) 대신 지금의 3초·10초 폴링 유지, 섬·게임 안 새 메시지 알림, 메시지 삭제(제안), 대화 목록 고정(선택). 업데이트 직후 기존 방은 서버 읽음 기록이 없어 한 번 전부 안 읽음으로 보임.
- 검증: `test/messenger.test.js`(JSON·PostgreSQL 읽음·1:1 동시 열기 한 방·재입장·시스템 문구·이름·알림, API 읽음·1:1·나가기 뒤 기록 유지·재입장 문구·허용 해제 active), e2e `messenger.spec.js` PC·휴대폰(시스템 문구, 「1」이 상대가 읽으면 사라짐, 서버 안 읽은 수 2, 목록 미리보기, 1:1 방 이름·초대 숨김, 나가기 경고 문구), 화면 확인. 실제 휴대폰 미검증.

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
