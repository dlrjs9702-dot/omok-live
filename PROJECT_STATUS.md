# Game Center 릴리스 기술 기록

릴리스별 구현·검증의 기술 이력이다. 현재 코드·버전은 [omok-live main](https://github.com/dlrjs9702-dot/omok-live), 진행 작업과 담당은 비공개 [STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/STATUS.md), 확정 결정은 비공개 [IDEAS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/IDEAS.md)를 확인한다. 운영 배포 상태는 Render에서 조회하고 공통 작업 규칙은 [AGENTS.md](AGENTS.md)를 따른다.

- **보관(2026-10-10):** 이 파일에는 최근 3개 버전만 둔다. v1.10.57 이전 기록과 앞으로 밀려나는 절은 비공개 [gamecenter-notes/archive/기술기록-PROJECT_STATUS.md](https://github.com/dlrjs9702-dot/gamecenter-notes/blob/main/archive/%EA%B8%B0%EC%88%A0%EA%B8%B0%EB%A1%9D-PROJECT_STATUS.md)에 있다(코드 주석이 가리키는 옛 버전 절도 그 파일에서 찾는다).

## 데이터 저장 구조

- `DATABASE_URL`이 설정된 환경의 PostgreSQL: 입장키·닉네임·관리자 메모·공지사항과 전체 게임 누적 전적/대전 결과를 영구 저장한다. 개발용 환경에서 `DATABASE_URL`이 없으면 각 저장소 모듈의 JSON 파일 방식을 사용한다. 구현 근거: `lib/access-store.js`, `lib/announcement-store.js`, `lib/match-records.js` 및 `server.js`.
- 서버 메모리: 게임방, 진행 중 대국, 세션, 초대, 로비·방 채팅(재배포하면 초기화). 실제 운영 배포 상태와 PostgreSQL 만료 대응은 Render 및 비공개 `STATUS.md`에서 확인한다.

## 코드 위치 참고

- 서버 `server.js`, 화면 `public/index.html`·`public/app.js`·`public/styles.css`, 게임 로직 `lib/games/`, 영구 저장 `lib/access-store.js`·`lib/announcement-store.js`·`lib/match-records.js`, 자동 공지 `lib/release-announcements.js`, 테스트 `test/`. 초기 `README.md`는 현재 기능의 기준 문서가 아니다.

## v1.10.375 N2a-1 별마루섬 소품 (152/152c 목책·문·늪·안내판, 136 캠핑장, 157 샘 동굴)

- 자료: public/plaza/isle2-props.js(tools/isle2-props.cjs가 만듦, --check로 확인) -- 목책 349조각(fence_segment/palisade_b/palisade_e/stonewall), 문 1(다리 길 위, 몸 지나갈 틈 0.8 m), 안내판(sign_tiger, 152 무텍스처), 늪 6(바깥선·갈대 24·꾸미기 26), 캠핑장 6(모닥불·통나무 의자), 샘 동굴(개울 머리), 우레 바위(봉우리 아래).
- 막힘: 소품 원·상자를 natureSolids에 넣고, 자연물(나무·덤불·숲)은 소품을 비켜 놓음(isle2PropsNear). 본섬 자연물 자리는 그대로(땅 지도 바뀐 곳은 별마루섬 쪽만).
- 그리기: island.js 인스턴스 대신 상자 → REGISTRY byeolmaru.*/newisle.*/spring.cave(계절 4), 늪 진흙은 바깥선에서 직접 만든 메시(가장자리 투명).
- 자전거: 늪 안에서는 4.3 m/s.
- 에셋: island-models.json sources byeolmaru152·byeolmaru152e·newisle136·spring157, 50 파일(sha256 확인), budgets 예외(문·동굴·모닥불·의자).
- 남은 것: 호랑이(152e, 1.10.376 N2a-2), 동굴 물 재질, 글자 안내판(sign_reserve/trail), 부두 문(N3).

## v1.10.374 메신저 프로필 사진 (notes docs/messenger-profile-photo-20261119.md) + Codex 봇 지적 3건 + AGENTS.md

- 저장소: 한 계정 한 장(덮어쓰기, 버전 v) -- JSON은 messenger-avatars 폴더(계정 해시 이름)+meta, PostgreSQL은 messenger_avatars 표(백업에 들어감).
- API: GET /api/messenger/avatars/:id(메신저 허용 계정만, private 1년 캐시·버전 주소), POST /api/messenger/avatar(WebP·JPEG, 64KB, 내용 머리 확인, 바꾸기 5분에 3번·시도 5분 20번), POST /api/messenger/avatar/clear. GET /api/messenger에 photos {id: v}.
- 화면: 「내 프로필」(고르기 → 정사각 자르기 끌기·크기·휠 → 256x256 WebP, 안 되면 JPEG → 저장, 기본으로), 사진은 머리글로 받아 data: 주소로 캐시, 방 목록(1:1 상대)·말풍선 이름 옆·멤버 줄·사람 고르기·1:1 알림 아이콘, 누르면 크게 보기.
- Codex 봇: #521 개수 칸 −/+/전부는 포커스를 안 가져감(첫 누름 살림), #522 숲 소리는 장면 stop()에서 끔, #523 답 없는 재료 주문은 수량도 고정·서버는 저장된 qty.
- AGENTS.md:56 효과음·BGM 금지 문장 삭제(사용자 2026-11-20 직접).

## v1.10.373 가려도 보이기 점무늬 (총괄 급함, Codex 자문 371 화면 「방충망」)

- 원인: 371 햇살 줄기가 아니라 369 가까운 것 흐리기(near fade)의 4x4 Bayer 디더 -- 시선 방향으로 누운 큰 줄기가 3~6 m 구간에 길게 걸려 반쯤 뚫린 채 점무늬로 보임(햇살 줄기는 가산 반투명이라 점 없음).
- see-through.js: 가까운 것 흐리기는 내 둘레 원(구멍 반지름 2배) 안, 카메라 3.5 m 안만, 반쯤이 없이 깔끔하게 자름(step). 구멍 가장자리 디더는 격자 없는 interleaved gradient noise.
- plaza-scene seeStep: 구멍이 꺼져 있어도 가까운 것 흐리기 원의 자리(center·radius)는 계속 갱신.
- 사진: work/screens-371b (PC·폰 오솔길 점무늬 없음).
