# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.295 뒷머리 층(턱) 고침

- 에셋 116 머리 23개(High 12·Low 11): 73 뒤통수 껍질을 머리 테두리에 맞춰 다시, 테두리 법선 바깥으로(문제 기록 「건」). 코드 변경 없음. 다음: G3 빛.

## v1.10.294 작은 묶음: 잡기 카드·모자×머리·택시 끊김·정류장마다 한 대

- 잡기 카드·자세 3초/6초 없앰(✕·「확인」·Esc·걷기·섬 누르기); 모자 아래 머리 각도마다 자르기, 택시에서 모자 숨기면 머리 원래 모양, 산호 장식관 sink 3 cm; 택시 화면 시계 2 ms씩(타는 동안 serverOffset 최대 122 ms 튐), 풀 칸 1.5초 앞 2 ms, 새 섞기 한 장면 8개; 정류장마다 한 대(제자리 돌기·같은 길로 빈 차·다시 돌기, TAXI_AWAY 돈 안 냄, 정류장 위 「돌아오는 중 · N초」, 돈 전 잠금); 계정 탭 검색칸 폭, 구치소 칩은 관리자가 보낸 사람 + 지금 감방. 에셋: vampire_sweep 뒷머리 턱(114 뒤). 다음: G3 빛.

## v1.10.293 구치소 세금 없애기·관리자 구치소·관리자 화면 탭

- 감방에서 세금 못 냄(반성문만), 관리자 구치소(1시간·자정·3일·풀 때까지 + 사유, 섬에 있으면 바로, 반성문으로 그날 나감·다음 날 다시, JSON·PG·변경 이력·[admin-jail]), 관리자 화면 탭 넷(현황·계정·섬 운영·경제), 계정 탭(검색·초성·/ 키·정렬·칩·분류 태그·한 줄 목록·상세 창), /api/admin/keys에 포인트·체납·구치소·집·태그; Codex 281~290 #5~#8(풀 계절 색, stepLook 월드 좌표, 내기 정산 재시도). 다음: G3 빛.
