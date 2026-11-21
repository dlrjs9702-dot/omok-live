# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.400 펫 태우기 다듬기 — 결정 56 「전부 A」 코드 몫(notes asset-eyes-2-20261121 덧붙임 「펫」)

- 머리 위 펫 HEAD_SINK 0.05(가장 낮은 점이 정수리 1.7 cm 위 → 3 cm 아래, 9종). 탄 동안 주인 이름표는 어깨 옆 70%(스프라이트 center 이동 — 모든 화면), 말풍선은 펫 위. 폰 세로(aspect < 0.8)+자전거+머리 위 펫: 조준 0.7 m 위·15% 멀리(headPetK).
- 연: 줄 끝 = 주인 Hand.R, 연은 그 손 쪽으로 0.55 m 옆. 배트맨 활공 뒤 간격 1.9 m.
- 펫 이름표: 모델 높이(보이는 메시만)+6 cm. 밤: 펫 재질 복사본의 색 ×1.45(정점 색·그림 그대로 — emissive는 회색으로 씻겨 버림).
- 디버그 petFit(key): 펫 가장 낮은 점·주인 머리 위·이름표 높이.
- 에셋 169(자세·망토)는 401에서 연결.

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
