# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.319 111b 새 마당 물건 25종

- 에셋 111 「새 마당 물건」 35에서 밭·작물 10을 뺀 25종(yard-v2 사계절 100 파일), 값표 docs/yard-111b-prices-20261110(합 197,500P).
- 3층 가구점 30×20 → 38×26 m(사용자 10A·11B, notes img/yard-111b map-A2): 마당 코너 4열×8줄 32칸(지금 13 + 작은 것 19), 큰 것 6은 제 크기로 단 위(앞 띠·오른쪽 띠), 통로 1.8 m 이상, 큰 단은 가장자리로 SPACE 거리, 벽 진열 4는 뒷벽과 3 m 뒤로, 바닥 모델 늘림.
- 다음: 320 섬 주식(거래소 자리 후보 사진부터).

## v1.10.318 마당 농사 F1 + 집 손보기

- docs/yard-farming-20261109 추천안 + gather-must-ideas 1A 2A 3B: 텃밭(에셋 115, 작물 6, 4단계, 마당 단계별 2/3/4개, 퇴비 남은 시간 반), 씨앗 1층 잡화, 작물은 가방 → 노점·상인.
- 집 손보기: 주마다 잡초 30·나뭇가지 10·작은 돌 5(큰 집 ×1.5, 대저택 ×2), 문 옆 상자, 보답 10,000P, 한 주 빠지면 허름함(겉모습만), 주간 쪽지.
- 재료로 쓰기(퇴비·징검돌·나무 울타리), 내 마당 잡초 하루 3(최대 12, 누구나 뽑기), 새 채집 「작은 돌」 30곳.
- 사용자 확인 ①~⑥ A(PR 그대로).
- 다음: 319 111b 새 마당 물건 25종(가구점 배치 안 사용자 선택 대기).

## v1.10.317 택시 서서 기다리기

- docs/taxi-yield-20261109 A1~A4·C1: 서버가 길 시계(warp)로 차 속도를 0.1초마다 정하고 300 ms 앞에 알림, 앞길(모퉁이 포함)에 선 플레이어 앞 코 1 m에서 섬, 2초 「빵」, 4초 뒤 걷는 속도로 지나가며 옆으로 밀기, 주민은 다가오는 차 앞에서 걸어서 비킴(사용자 A: 차는 플레이어에게만 섬).
- C1 건널목 4곳(island-taxi CROSSINGS): 그 밖의 택시 길 가운데는 주민 길 비용 40, 멈출 자리 46곳 길 옆으로, 건널목 5 m 안 막히는 물체 없음. 길 가운데 걷기 1,270→97 m.
- 다음: 마당 농사 + 집 손보기.
