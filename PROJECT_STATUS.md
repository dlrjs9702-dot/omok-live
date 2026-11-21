# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.399 작은 묶음 — 에셋 168 연결 · 배 물결 · 밤 빛 · 폰 다리 위 시점(notes asset-eyes-2-20261121, 결정 52 A)

- 에셋 168(SHA 일치): 자전거 몸체·크랭크(bike.frame__* keepNodes, basket_cushion은 펫이 바구니에 타면 숨김), fence_gate_wide 빗장, fence_gate 잎 팻말, 옷가게 preview_bg, 새 taxi.stop_mark(모든 자리 boardOf)·taxi.lane(종점 쉼터→문양 타일)·dalmaru.dock_board(T.DOCK_BOARDS, dest_plate에 글자, 기둥 원 structureSolids — 배 타는 곳은 걷는 길 피해 (−2.5, −3.5)).
- 배 물결: 움직이는 탐방선 양옆 두 줄(속도에 따라). 밤 빛: 승선 계단·긴 다리 세 곳 양 끝·택시 문양에 그린 빛 웅덩이(wayLights, 업라이트 수와 따로). 폰 세로 화면 긴 다리 가운데: 시점 8° 낮게·1/5 멀리·옆 2.2 m.
- 고침: 택시 화면 정류장 출발 빈 차의 머무를 곳(STOPS[from].to → toOf, 392부터 페이지 오류).
- 예산: 자전거 몸체 메시 2·노드 6, 새 모델 셋.

## v1.10.398 새것 다듬기 — 결정 55 A 건물 가려도 보이기 · 에셋 검사 2회차 코드 몫 · CI 흔들림(notes asset-eyes-2-20261121, ui-review P6)

- 결정 55 A: see-through.js SEE_BUILDING_IDS(달마루섬 건물 77종·그 위 장식) + seeBuilding — asset-loader attach/swapAttach가 대역·모델 재질을 SEE.cliff 구멍 사본으로(High만, 지붕 눈 포함), seeHolders; occlusion.js blocked()로 카메라→나 줄을 건물 모양 상자로 판정(별도 인스턴스 sight), cliffWant에 더함; 백화점 유리는 userData.facadeGlass로 따로(이중 구멍 없음). 실내·1인칭·사진 모드는 꺼짐 그대로.
- 택시: 목적지 고른 줄 ✓, 타기 버튼 「○○행 타기」. 정류장 표지 45°. 부두 안내 「별마루섬행/달마루섬행 타기」. 탐방선 오른쪽 좌석 이름표 0.42 m 위.
- 폰 옷가게: 한 줄 막대(점수+버튼 넷)·270 px 간판이 360 px를 넘던 것 — 간판 2/3, 잔액 줄바꿈, 점수 한 줄, 버튼 셋 다음 줄, 아래 닫기 숨김(✕).
- CI 흔들림: river-fishing(빗나감 표시 누를 때 읽기·바늘 22초·빨간 테두리 최고값), island-view-modes 숲(겨울엔 잎 0이 맞음).
- 남김: 배 물결·밤 빛(승선구·택시 대기 자리·다리 입구)·폰 다리 위 시점 → 다음 작은 묶음.

## v1.10.397 N4-c 세 번째 종점 · 정류장 ⑥⑦ · 별마루다리 한 줄 · 목책 긴 틈(notes n4-plan-20261120 §5-3·§5-4, 결정 1 B · 54 A)

- island-taxi: STOPS.head 「별마루섬 입구」(EXT 끝, 넓은 문 안 10.5 m) — 차 6대(종점 셋 × 2). 줄기 TRUNK(ROUTE → 마을 앞 모퉁이 → EXT), 마을 종점은 모퉁이에서 6.4 m 가지(SPUR): sOf·distanceOf·driveBetween·atS가 줄기로, nearestRoom·sendCar가 길 거리로. 대청마당↔마을 404 m(1,000P) 그대로, 대청마당↔별마루섬 입구 718 m(1,750P).
- 정류장 ⑥ 마을 가운데(x −3, s 475.1) · ⑦ 마을 동쪽 끝(x 106, s 584.1): 표지는 남쪽 인도 위(signOut 1.0 — 마당 울타리 앞).
- 한 줄 다리 BRIDGES = 윤슬다리 · 별마루다리(넓은 문까지): 그 위는 길 가운데, 서버는 같은 다리 위 반대 방향 차만 기다림(bridgeOf).
- 별마루섬 자연물: 세 번째 종점 둘레 10 m 비움.
- 결정 54 A 목책: 걸을 수 있는 둑·절벽 끝 조각도 세움(시냇물 위만 비움) — 목책 줄에 지나갈 틈 0, 드나드는 곳은 넓은 문·부두 문.
- 시험: 세 종점 2/2/2·6대, 모든 두 자리 사이 길(끊김 없음·끝은 그 자리)·거리·요금·두 다리 가운데.
