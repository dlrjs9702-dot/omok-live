# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.326 흔들림 고치기

- patch-speed §6 순서대로: 시험 한 줄 고침 7개(messenger 보류 줄, visit-tasks 자리 키, view-modes·talk-camera 주민 고르기·fov, 광장 챔피언 60 s, 운반 count, fish-tug tug:false, emotes 깜박임), 시간 예산(백화점 문 30·45 s, talk-camera 25 s), game-points-server 시험 파일 둘로.
- 게임 한 줄 둘: 역 승강기 입구가 더 가까운 사람·물건을 덮지 않음, 대화 카메라는 모형이 6 m 밖이면 서버 자리로.
- 확신 낮은 둘(emotes 표정 미리 그리기, resident-faces 팩·긴 줄)은 2주 지켜봄.
- 기록의 탑 시험: 'board:records'가 뒷면 키의 앞부분이라 뒷면에서 누름이 사라지던 것 → 앞면 키를 정확히 기다림. resident-bets는 325에서 고침(그날 심부름 주민 빼기).
- rerun-once: 열린 PR의 머리 커밋 실행만 다시 돌림.
- 다음: 택시 손보기(속도 16·다리 같은 속도·요금).

## v1.10.325 크리스마스 1: 마켓 + 대청마당 다시 배치 + 채석장 바닥

- 대청마당 다시 배치(54A·55A·56A): 미션판 (−42.2, −82) 알림마루 줄 북쪽 끝, 기부함 (3.5, −62) 경제 앞뜰, 벽화 (−33, −105) 북서 쉼터, 볏단 (−40, −108.5). 빈 미션판·벽화 자리에 벤치 4개(테 벤치 14 → 18). 전·후 사진 img/plaza-relayout-325.
- 크리스마스 마켓 P1(124 에셋 12개, xmas-v2): 겨울 장식일 때 (27·31·35, −104.5)에 분수를 보는 가판대 3. 가판대 앞 2.2 m에서 POST /api/island/market/buy(요청마다 한 번 차감), 간식 5분 손에 들기·다른 사람에게 보임, 축제 과제 「마켓 들르기」(하루 1, 간식 산 뒤 5분 안).
- 채석장 흙·자갈 바닥(59A): 지면 지도 다시 만듦.
- 사용자 확인 필요: 간식 가격 300P, 김 오르는 효과는 아직 없음.
- 다음: 흔들림 고치기 PR, 그다음 326.

## v1.10.324 스스로 알려 주는 섬 + 광석 300P

- 검토 ②(docs/direction-ideas-20261110, 7A): 화면 오류(한 종류 한 번, 한 페이지 10개)와 섬 프레임(1분 뒤, 15분마다)을 POST /api/client/report(들어온 사람만, 1분 20번)로 모아 매일 00:10 KST 뒤 Render 로그 [client] 한 줄(오류 상위 20·종류 수, 기기별 fps 10·50·90%·20 아래 비율·단계 분포). 주소·아이디·긴 토큰은 지움, 계정·이름·자리 없음.
- 광석 판매가 800 → 300P(58A).
- DB 백업(③)은 60A~63A로 정했고 사용자가 요청할 때 넣어요.
- 다음: 크리스마스 보강 + 대청마당 다시 배치.
