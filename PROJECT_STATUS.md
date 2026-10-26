# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.168 부탁은 받고 나서 시작해요

- 섬 주민과 이야기 주민의 부탁이 이제 쪽지로 먼저 와요. 할 일·받는 것·기한을 보고 「할게요!」를 눌러야 시작되고, 「다음에요」면 그냥 넘어가요.
- 받은 부탁은 화면 왼쪽 위 종이 카드에 진행이 보여요(최대 3개). 다 모으면 ✓와 함께 「○○에게 돌아가 말해요」로 바뀌고, 카드를 눌러 그만둘 수도 있어요.
- 부탁을 마치면 받은 것이 적힌 완료 카드가 떠요.
- 역 승강기 시험이 느린 화면에서 가끔 흔들리던 것을 고쳤어요.

## v1.10.167 휴대폰 낚시 화살표가 잘 눌려요

- 휴대폰에서 입질 화살표 단추가 조이스틱·걷기·뛰기·상호작용 단추에 가려 안 눌리던 문제를 고쳤어요. 화살표가 뜨는 동안은 조작 단추가 잠깐 숨고, 낚시가 끝나면 다시 나와요(조작 단추를 옮기거나 키웠어도 같아요).

## v1.10.166 섬 경제 다듬기 — 예금은 구간 이자, 출석은 연속이 좋아요

- 예금 이자가 구간별로 붙어요: 50만 P까지 하루 3%(세금과 같아 작은 예금은 줄지 않아요), 50만~500만 P 부분 1.5%, 그 위 0.5%. 예금 창구에 구간과 내일 예상 이자가 보여요. 예금이 끝없이 불어나 물건 값이 의미 없어지는 것을 막아요.
- 출석은 하루 30,000P, 7일 연속인 날은 20,000P를 더 — 출석 도장 카드에 7칸마다 큰 도장(「일주일 개근!」)과 연속 일수.
- 등반 주간 상은 1위 200,000P · 2위 150,000P · 3위 100,000P · 4~20위 30,000P, 하루 등반 최대는 30,000P(같은 곡선). 지난주 등반 1위는 영웅마루에 등반왕 동상으로 서요.
- 낚시 입질 화살표를 틀리면 처음부터 다시(화살표 줄이 빨갛게 흔들리고 「틀렸어요! 처음부터」).
- 펫샵·가구점 점원이 계산대 앞(손님 쪽)을 봐요. 미용실 점원도 손님 쪽으로.
- 관리자: 「경제 통계」(전체 포인트·최근 14일 사유별 들어옴·나감·많이 가진 10명).
