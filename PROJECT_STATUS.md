# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.293 구치소 세금 없애기·관리자 구치소·관리자 화면 탭

- 감방에서 세금 못 냄(반성문만), 관리자 구치소(1시간·자정·3일·풀 때까지 + 사유, 섬에 있으면 바로, 반성문으로 그날 나감·다음 날 다시, JSON·PG·변경 이력·[admin-jail]), 관리자 화면 탭 넷(현황·계정·섬 운영·경제), 계정 탭(검색·초성·/ 키·정렬·칩·분류 태그·한 줄 목록·상세 창), /api/admin/keys에 포인트·체납·구치소·집·태그; Codex 281~290 #5~#8(풀 계절 색, stepLook 월드 좌표, 내기 정산 재시도). 다음: G3 빛.

## v1.10.292 물고기 노점·내기 목표·메신저 사진 확대

- 물고기는 백화점 1층 노점(mall:stall, `fish: true` → sellAt merchant+fisher), 물결 fisher 판매 400·「물고기 팔기」 없앰, 낚시왕은 sold의 fish_ 값 합(JSON·PG); 주민 내기 목표 = 기록의 탑 역대 1위 × 0.9/0.75/0.55(시간은 나눔, 3명 미만은 표의 쉬움 기준, 표가 한도, 서울 하루 한 번, 내기에 박힘), 창에 「역대 최고 · 나는」; 메신저 사진 1~5배(두 손가락·두 번 톡 2.5배·휠·「− 100% +」, 끌기 한도, 넘기면 1배, public/messenger-zoom.js). 다음: 293 구치소·관리자·Codex 281~290 #5~#8.

## v1.10.291 Codex 281~290 빠른 고침

- 풀 칸 InstancedMesh 구를 모든 잎으로 잰 뒤 count 0(three 0.186은 count만 재서 빈 구 → 칸이 잘려 안 보임), 섞기 끝 fill 앞에 그 배치 entryMatrix, 섞기 메시 감싼 geometry의 lodFade 버퍼만 정리, 자동 화질은 머무는 동안에도 9초 느리면 내림. 시험: fp G1 구 반지름, island-assets fillSame 0. 다음: 1.10.292 물고기 노점·내기 목표·메신저 사진 확대.
