# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.312 땅·길

- 검토 ground-path-audit ①~⑤: 눈 구역 풀 바닥 판 끔, 둥근 클로버 점, 대청마당 자갈 테 틈(지도가 포장 0.75 m 앞에서 끝남), 절벽 기울기 바위색·높이 줄무늬·옆 결, 흙 결 256(tools/ground-soil.js)·자갈 점·가장자리 테, 대청마당 얼룩·줄눈 이끼, 비 젖음(setRain), 풀밭 넓은 얼룩. 넓은 덩굴은 곧은 면만. 호출 +0, 새 텍스처 0.
- 다음: 택시 서서 기다리기, 마당 농사 F1.

## v1.10.311 Codex 301~310

- P1 AI의 마지막 수로 끝난 판 기록·정산(aiMoved: recordFinishedMatch 뒤 broadcast, 윷·오목류 AI 둘 다; 주민 내기 AI 승리도 정산). P2 gatherGrowing 복원은 읽기 성공 뒤에만, 실패하면 30초·채집 시작 때 다시, 복원 전 저장 안 함. P3 윷 업힘 tr 같이, adminJailOf 새 구금 다시 읽기, 메신저 칩 순서 revision·끌기 정리, placeKeeper freeBusker, 디버그 pilotOld 제거.
- 다음: 땅·길(1.10.312, claude/ground-path), 택시 서서 기다리기, 마당 농사 F1.

## v1.10.310 잡초 편입

- 잡초를 assets 106 넓은 잎·풀포기·고사리(60:30:10, island-pilot weedKind, weed.* 그림자 없음·48/25m hideFar, 고사리 0.65)로 그림. 뽑아 든 모양도 같은 모델·계절(hold season). 시범 구역 자체 꾸밈·나무 교체 제거(섬 공통 자연·잡초), 안 쓰는 모델 78개 제거. 덩굴 135(tools/vine-spots.js → island-vines.js: 56° 이상 면 윗단에서 면 따라 x2.2, 면마다 여러 가닥).
- 다음: 택시 서서 기다리기, 마당 농사 F1.
