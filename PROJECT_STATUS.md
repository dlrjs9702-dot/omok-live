# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.301 마당·길 바꾸기(111a)

- 에셋 111 yard-v2: 등록부 23개 같은 대상에 파일만, 꽃 셋만 Low; 다리 BRIDGE 값을 새 모델에 맞춤(판 윗면 0.752 − 0.148x², 끝 ±2.08). 옛 파일 54개 정리. 에셋 113 land-v1 34모델 등록만(G4a·G4b에서 놓기). Codex 291~300 7건(fillBox ID, box/grow to, 구치소 기간 끝 jailFree·같은 기록만, 관리자 태그 3).
- 다음: 게임관 1차(판 안에서 고르기·팬데믹 1차), 그다음 G4a.

## v1.10.300 끊기지 않는 섬

- (가) release-batch.yml: 매일 05:00 KST·손으로 live ← main fast-forward(Render Branch→live·/ready는 병합 뒤 총괄). (나) SIGTERM → SSE restart → 화면 알림·/health 뒤 기기 로그인으로 다시 입장(자동 로그인 끈 계정·손님은 로그인 화면). (다) 07:35 원인 = /api/home 집터마다 동시 읽기 + 풀 3·쉬는 연결 10초 닫힘 → worldValues 한 쿼리, 쉬는 연결 5분, 듣기 전 데우기·/ready, SELECT만 한 번 더. 사진 부탁 자리 집 7 m 밖.
- 다음: 게임관 1차 또는 111(사용자 답).

## v1.10.299 G2 나무·덤불·바위

- 에셋 109 Nature Megapack 144개(36모델 × 4계절)를 같은 대상에 파일만 바꿔 씀(자리·solid·대역 그대로), Low 없음(사용자 「로우 모델 넣지 마」). 옛 자연물 155개·빌드 설정 80줄 정리.
- 덤불: 새 층진 덤불 그대로(사용자 「추천으로 하자」), 60 m 밖은 0.4초 점무늬로 숨김(`hideFar`), 그림자 없음. 「중간」 GPU 대청마당 132→155 fps, 툇마루섬 123→130, 부두 134→138.
- 다음: 111 마당·길.
