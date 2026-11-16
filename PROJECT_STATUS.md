# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.333 크리스마스 3 ①: 산타 썰매·양말 선물 (M6)

- 썰매 비행(127): 24일 21~22시, 반지름 105 m·높이 40 m(1.8배)로 2분에 한 바퀴, 행사 시계라 화면마다 같은 자리. 내 위 45 m 안이면 Wave(산타 손). IslandCalendar.sleighOf.
- 양말 선물: 25일 06시부터 집에 양말 걸이(xmas_stocking)가 걸려 있으면 사탕 주머니 2 + 「산타」 도장 편지, 계정·행사마다 한 번(가방이 차면 다음에).
- 관리실 미리 보기 「12월 24일 밤 (산타 썰매)」.
- 사진 notes img/xmas4-333.
- 다음: 1.10.334 P2 눈 요새·눈싸움, P3 썰매 언덕(사용자 95A·96A·97A).

## v1.10.332 관리자 크리스마스 미리 보기

- 관리실 「섬 환경」 아래 「크리스마스 미리 보기 (내 화면만)」: 끔 / 장식·오르골 / 첫 저녁(눈·점등 카운트다운) / 점등 뒤 밤(눈·집 전구) / 화이트 크리스마스.
- 고른 값은 그 브라우저(gc.xmasPreview)에만 남고, 같은 브라우저로 섬에 들어가면 그 화면에만 보여요. 서버·다른 사람 화면은 그대로(시험: 다른 화면 날짜대로, 서버 장식 auto).
- 나뭇가지(사용자 78A): 자리 34 → 60, 다시 나는 시간 3시간 → 2시간. 섬 전체 재생 공급 약 52.7만P/시.
- 다빈치 코드 단위 시험: 임시 폴더를 서버가 멈춘 뒤 지움(ENOTEMPTY 흔들림, #482).
- 다음: 크리스마스 3(M6 썰매·양말 127, P2 눈 요새 128, P3 썰매 언덕).

## v1.10.331 크리스마스 2단계 ②: 집 장식·오르골·인사

- M2 집 장식(125): 집 단계(오두막·집·큰 집·2층 큰 집)마다 덧씌움, 겨울 장식일 때만 받아옴. glow는 밤에만 — 전구는 정점 색(빨강·초록·금) × 1.7, 창 빛 판은 따뜻한 색 0.75; 낮에는 창 판을 유리 빛으로.
- M4 소리: public/plaza/xmas-music.js — 오르골 캐럴 셋(Jingle Bells·We Wish You a Merry Christmas·Silent Night, 저작권 끝난 곡)과 24초마다 종, Web Audio 합성. 트리 4 m 안 최대, 24 m 밖 없음. 게임방과 같은 소리 설정.
- M3 인사: 행사 동안 배회 주민 10명이 자기 말투로 「메리 크리스마스」(대화 60%). 차림(모자·목도리)은 에셋 138 오면 다음 PR.
- 눈송이 near fade: 카메라 0.8~3 m 안에서 흐려지고 최대 24 px.
- 사진 notes img/xmas3-331.
- 다음: 327 몫(M6 썰매 비행·양말 선물 127, P2 눈 요새 128, P3 썰매 언덕).
