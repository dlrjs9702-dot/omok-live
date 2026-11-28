---
version: alpha
name: 게임 아일랜드 (달마루섬)
description: |
  세 가지 화면 바탕을 가진 웹 게임센터. 섬(3D 마을) 위의 창은 크림색 종이와 갈색 먹(--isle-*),
  게임관 안은 짙은 남색 무대와 게임 고유색(한판마당 기준 --hp-*, 밝은 테마 있음),
  섬 밖 화면(로그인·로비·관리자 대체 로비)은 처음부터 쓰던 어두운 슬레이트 팔레트다.
  화면을 만들기 전에 그 화면이 어느 바탕인지부터 정하고, 그 바탕의 토큰만 쓴다.
  정보는 짧고 작게, 화려함은 한 화면에 한 곳만, 글은 쉬운 해요체.
colors:
  primary: "#9c5f14"
  on-primary: "#ffffff"
  isle:
    paper: "#fff6e3"
    card: "#fffaf0"
    field: "#fffdf6"
    hover: "#f7e7c6"
    select: "#f0dcb6"
    tag: "#8a6a4a"
    line: "#d9c3a0"
    ink: "#5a4632"
    soft: "#7d6852"
    btn: "#9c5f14"
    value: "#8a4b00"
    value-pill: "#f2e3c4"
    danger: "#9b2c1f"
    good: "#166534"
    wood: "#9b6a3f"
    wood-dark: "#6e4728"
  hall:
    dark:
      bg: "#0B0C1A"
      bg2: "#15172E"
      line: "rgba(255,255,255,.08)"
      face: "rgba(255,255,255,.08)"
      face-on: "rgba(255,255,255,.2)"
      glass: "rgba(11,12,26,.5)"
      t1: "#F4F5FC"
      t2: "rgba(255,255,255,.55)"
      t3: "rgba(255,255,255,.35)"
      gold: "#FFD34D"
      win: "#3DDC97"
      draw: "#FFCB57"
      loss: "#FF5A79"
      blue: "#5B7BFF"
      on-c1: "#0B0C1A"
    light:
      bg: "#F7EFE1"
      bg2: "#FFFAF0"
      line: "rgba(61,47,32,.12)"
      face: "rgba(61,47,32,.07)"
      face-on: "rgba(61,47,32,.16)"
      glass: "rgba(255,250,240,.72)"
      t1: "#3D2F20"
      t2: "rgba(61,47,32,.64)"
      t3: "rgba(61,47,32,.42)"
      gold: "#8A5A00"
      win: "#17805A"
      draw: "#8F6A00"
      loss: "#B82A4C"
      blue: "#1C6B5C"
      on-c1: "#FFFFFF"
  lobby:
    dark:
      page: "#0b1220"
      card: "rgba(17,24,39,.92)"
      card-line: "rgba(148,163,184,.16)"
      row: "#0f172a"
      row-line: "#273449"
      input-line: "#334155"
      chat: "#0b1324"
      chat-line: "#263246"
      text: "#f8fafc"
      text-2: "#cbd5e1"
      text-3: "#94a3b8"
      deco: "#64748b"
      accent: "#60a5fa"
      accent-soft: "#93c5fd"
      blue: "#2563eb"
      yellow: "#fbbf24"
      yellow-2: "#facc15"
      yellow-3: "#fde68a"
      danger-bg: "#7f1d1d"
      danger-ink: "#fecaca"
      danger-line: "#ef4444"
      success: "#16a34a"
      sheet: "#111827"
      btn-ink: "#111827"
    light:
      page: "#f4ede0"
      card: "#fffaf1"
      row: "#f7efe1"
      line: "#e2d4bd"
      line-2: "#d6c3a5"
      text: "#33281d"
      text-2: "#5e4d3b"
      text-3: "#7a6650"
      accent: "#23806f"
      yellow-ink: "#8a5a00"
  world:
    plaza: "#f3e6c8"
    path: "#efe4cc"
    grass-edge: "#a7d483"
    spring-ground: "#c0e0a4"
    summer-ground: "#acd497"
    autumn-ground: "#e9d7a8"
    winter-ground: "#eff4fa"
    water: "#86d0f0"
    foam: "#e9f7ff"
    marble-night-glow: "#4a5262"
typography:
  base:
    fontFamily: Inter, Pretendard, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
    fontSize: 15px
    fontWeight: 800
    lineHeight: 1.45
  isle:
    display:
      fontSize: 24px
      fontWeight: 900
      lineHeight: 1.3
    title:
      fontSize: 18px
      fontWeight: 900
      lineHeight: 1.35
    subtitle:
      fontSize: 16px
      fontWeight: 800
      lineHeight: 1.4
    body:
      fontSize: 15px
      fontWeight: 700
      lineHeight: 1.5
    body-long:
      fontSize: 15px
      fontWeight: 400
      lineHeight: 1.6
    support:
      fontSize: 13px
      fontWeight: 700
      lineHeight: 1.45
    smallest:
      fontSize: 12px
      fontWeight: 700
      lineHeight: 1.4
  hall:
    title:
      fontSize: 24px
      fontWeight: 900
      lineHeight: 1.3
      letterSpacing: -0.03em
    hud-number:
      fontSize: 34px
      fontWeight: 900
      lineHeight: 1
      fontFeature: '"tnum"'
    result-number:
      fontSize: 64px
      fontWeight: 900
      lineHeight: 1
      fontFeature: '"tnum"'
    hud-label:
      fontSize: 11px
      fontWeight: 800
      lineHeight: 1.3
      letterSpacing: 0.06em
    body:
      fontSize: 14px
      fontWeight: 700
      lineHeight: 1.5
    pill:
      fontSize: 13px
      fontWeight: 800
      lineHeight: 1.3
  lobby:
    body:
      fontSize: 0.84rem
      fontWeight: 800
      lineHeight: 1.45
    row:
      fontSize: 0.8rem
      fontWeight: 800
      lineHeight: 1.45
    support:
      fontSize: 0.74rem
      fontWeight: 800
      lineHeight: 1.45
    heading:
      fontSize: 1.1rem
      fontWeight: 900
      lineHeight: 1.35
    number-lg:
      fontSize: 1.35rem
      fontWeight: 900
      lineHeight: 1.2
    eyebrow:
      fontSize: 0.78rem
      fontWeight: 900
      lineHeight: 1.3
      letterSpacing: 0.16em
rounded:
  isle:
    tape: 4px
    md: 12px
    sheet: 22px
    full: 999px
  hall:
    md: 14px
    lg: 18px
    xl: 28px
    card: 22px
    full: 99px
  lobby:
    row: 10px
    md: 12px
    card-phone: 16px
    card: 22px
    full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 18px
  sheet-pad: 16px
  window-sm: 440px
  window-md: 560px
  window-lg: 1120px
  shell-max: 1180px
  touch-min: 44px
  bp-two-col: 880px
  bp-phone: 520px
motion:
  press:
    duration: 150ms
    delay: 0ms
    timingFunction: ease
  hall-panel-enter:
    duration: 400ms
    delay: 0ms
    timingFunction: cubic-bezier(.2,.9,.3,1.3)
  hall-board-open:
    duration: 500ms
    delay: 0ms
    timingFunction: ease-out
components:
  isle-sheet:
    backgroundColor: "{colors.isle.paper}"
    textColor: "{colors.isle.ink}"
    rounded: "{rounded.isle.sheet}"
    padding: 16px
  isle-sheet-head:
    backgroundColor: "{colors.isle.card}"
    textColor: "{colors.isle.ink}"
    typography: "{typography.isle.title}"
    height: 56px
  isle-close:
    backgroundColor: "{colors.isle.paper}"
    textColor: "{colors.isle.ink}"
    rounded: "{rounded.isle.full}"
    size: 34px
  isle-button-primary:
    backgroundColor: "{colors.isle.btn}"
    textColor: "{colors.on-primary}"
    typography: "{typography.isle.subtitle}"
    rounded: "{rounded.isle.md}"
    height: 44px
  isle-button-paper:
    backgroundColor: "{colors.isle.card}"
    textColor: "{colors.isle.ink}"
    rounded: "{rounded.isle.md}"
    height: 44px
  isle-button-danger:
    backgroundColor: "{colors.isle.paper}"
    textColor: "{colors.isle.danger}"
    rounded: "{rounded.isle.md}"
    height: 44px
  isle-button-disabled:
    backgroundColor: "{colors.isle.card}"
    textColor: "{colors.isle.soft}"
    rounded: "{rounded.isle.md}"
    height: 44px
  isle-tab:
    backgroundColor: "{colors.isle.card}"
    textColor: "{colors.isle.ink}"
    typography: "{typography.isle.support}"
    rounded: "{rounded.isle.full}"
    height: 36px
  isle-tab-selected:
    backgroundColor: "{colors.isle.select}"
    textColor: "{colors.isle.ink}"
    typography: "{typography.isle.support}"
    rounded: "{rounded.isle.full}"
    height: 36px
  isle-row:
    backgroundColor: "{colors.isle.card}"
    textColor: "{colors.isle.ink}"
    typography: "{typography.isle.body}"
    rounded: "{rounded.isle.md}"
    height: 44px
  isle-input:
    backgroundColor: "{colors.isle.field}"
    textColor: "{colors.isle.ink}"
    rounded: "{rounded.isle.md}"
    height: 44px
  isle-value-pill:
    backgroundColor: "{colors.isle.value-pill}"
    textColor: "{colors.isle.value}"
    typography: "{typography.isle.support}"
    rounded: "{rounded.isle.full}"
  isle-tape:
    backgroundColor: "{colors.isle.field}"
    textColor: "{colors.isle.ink}"
    rounded: "{rounded.isle.tape}"
  isle-wood-board:
    backgroundColor: "{colors.isle.wood-dark}"
    textColor: "{colors.isle.paper}"
  hall-button:
    backgroundColor: "{colors.hall.dark.bg2}"
    textColor: "{colors.hall.dark.t1}"
    rounded: "{rounded.hall.md}"
    height: 50px
  hall-button-cta:
    rounded: "{rounded.hall.lg}"
    height: 58px
  hall-pill:
    backgroundColor: "{colors.hall.dark.bg}"
    textColor: "{colors.hall.dark.t1}"
    typography: "{typography.hall.pill}"
    rounded: "{rounded.hall.full}"
    height: 34px
  hall-close:
    backgroundColor: "{colors.hall.dark.bg2}"
    textColor: "{colors.hall.dark.t1}"
    rounded: "{rounded.hall.full}"
    size: 40px
  hall-result-panel:
    backgroundColor: "{colors.hall.dark.bg2}"
    textColor: "{colors.hall.dark.t1}"
    rounded: "{rounded.hall.xl}"
    width: 420px
  hall-game-card:
    textColor: "#ffffff"
    rounded: "{rounded.hall.card}"
    height: 150px
  hall-game-sheet:
    rounded: "{rounded.hall.card}"
    width: 560px
  lobby-card:
    backgroundColor: "{colors.lobby.dark.sheet}"
    textColor: "{colors.lobby.dark.text}"
    rounded: "{rounded.lobby.card}"
    padding: 14px
  lobby-row:
    backgroundColor: "{colors.lobby.dark.row}"
    textColor: "{colors.lobby.dark.text}"
    typography: "{typography.lobby.row}"
    rounded: "{rounded.lobby.md}"
    padding: 10px
  lobby-button-primary:
    backgroundColor: "{colors.lobby.dark.text}"
    textColor: "{colors.lobby.dark.btn-ink}"
    rounded: "{rounded.lobby.md}"
  lobby-button-secondary:
    backgroundColor: "{colors.lobby.dark.blue}"
    textColor: "{colors.lobby.dark.text}"
    rounded: "{rounded.lobby.md}"
  lobby-button-ghost:
    backgroundColor: "#1e293b"
    textColor: "{colors.lobby.dark.text}"
    rounded: "{rounded.lobby.md}"
  lobby-button-danger:
    backgroundColor: "{colors.lobby.dark.danger-bg}"
    textColor: "{colors.lobby.dark.danger-ink}"
    rounded: "{rounded.lobby.md}"
  lobby-input:
    backgroundColor: "{colors.lobby.dark.row}"
    textColor: "{colors.lobby.dark.text}"
    rounded: "{rounded.lobby.md}"
---

# DESIGN.md — 게임 아일랜드 화면 기준

맨 위 YAML은 정확한 값(토큰), 아래 글은 그 값을 쓰는 까닭과 방법이다. 형식은 Google의 DESIGN.md 규격(google-labs-code/design.md)을 따른다. 값은 `public/styles.css`(main 1.10.435)에서 실제로 쓰는 것이다. 화면(HTML·CSS·렌더링 코드)을 만들거나 고치기 전에 이 파일을 읽는다(AGENTS.md). 새 값이 필요하면 코드보다 이 파일에 먼저 넣는다.

## Overview

**한눈에.** 달마루섬은 3D 섬 마을 위에 게임관·가게·관공서 같은 창이 뜨는 웹 게임센터다. 섬은 따뜻한 동화책 느낌, 게임관은 게임기처럼 집중하는 어두운 무대다. PC와 휴대폰에서 똑같이 돈다.

**화면 바탕 셋.** 먼저 만들 화면이 어느 바탕인지 정한다. 바탕마다 토큰 묶음이 다르고, 섞지 않는다.

| 바탕 | 어디 | 토큰 | 느낌 |
|---|---|---|---|
| **섬 종이** | 섬(`body.plazaMode`) 위의 모든 창: 가방·가게·게시판·관공서·출석·택시·관리자 창(U6) | `colors.isle.*`, CSS `--isle-*`, 부품은 `--btn-*` | 크림색 종이, 갈색 먹, 나무판. 테마와 상관없이 늘 종이 |
| **게임관 무대** | `#gamehallView`·`#roomView`·`#reflexView`·`#gameSheet` 안 | `colors.hall.dark/light.*`, CSS `--hp-*`, 게임색 `--c1/--c2/--c3` | 한판마당 기준: 짙은 남색 무대 + 그 게임 고유색 + 금·초록·분홍 셋 |
| **섬 밖 슬레이트** | 로그인, 관리자 대체 로비(고전 레이아웃), 섬 밖에서 뜨는 옛 화면 | `colors.lobby.dark/light.*` | 처음부터 쓰던 어두운 슬레이트. 새 화면은 되도록 위 둘 중 하나로 |

- 밝은 테마는 메뉴(Esc) → 환경설정에서 고른다(`<html data-theme>`, 어둡게 기본·밝게·기기 설정). 게임관은 `:root[data-theme="light"]`의 `--hp-*` 밝은 값, 섬 밖 화면은 `node tools/theme-light.js`가 `styles.css`에서 만드는 `public/theme-light-auto.css`와 손으로 고친 `public/theme-light.css`를 따른다(`test/theme-light.test.js`가 오래된 파일을 잡음). 섬 종이 창은 테마로 바뀌지 않는다.
- 각 게임 판·카드 그림·3D 물건의 고유 색은 테마로 바꾸지 않는다.

## Colors

**고르는 순서.** 바탕을 정했으면 그 바탕의 토큰 이름으로 쓴다(`var(--isle-ink)`처럼). 값을 직접 적지 않는다. 표에 없는 색이 필요하면 이 파일에 먼저 넣는다.

### 섬 종이 (`--isle-*`)

- **종이 `paper` #fff6e3:** 창 바탕. **카드 `card` #fffaf0:** 줄·종이 단추·창 머리. **입력 `field` #fffdf6:** 입력칸·테이프·알림.
- **먹 `ink` #5a4632(8.3:1):** 글자. **옅은 먹 `soft` #7d6852(4.9:1):** 가장 옅은 글자. 이보다 옅게, 투명도로 흐리게 쓰지 않는다. 올린 줄·고른 줄 위에서는 쓰지 않는다.
- **선 `line` #d9c3a0**, **올림 `hover` #f7e7c6**, **고름 `select` #f0dcb6 + 진한 테두리 `tag` #8a6a4a**(결정 43 A 2: 고른 것이 가장 또렷하게).
- **주 단추 `btn` #9c5f14 + 흰 글자(5.2:1)** — 이 파일의 `primary`. 한 창에 하나.
- **값 `value` #8a4b00(6.3:1):** 포인트·보상 숫자, 알약 바탕 #f2e3c4. **위험 `danger` #9b2c1f:** 종이 바탕 + 붉은 글자·선. **좋음 `good` #166534(6.6:1).**
- **나무판 `wood` #9b6a3f / `wood-dark` #6e4728:** 가격표·기부함 같은 물건 모양 창. 나무 위 글은 흰색·크림만.
- 남색·파랑은 창의 부품(단추·입력칸·거르기 칸·줄 바탕)에 쓰지 않는다. 쓸 수 있는 곳: 주민 고유색(이름표·얼굴), 값 내림(▼), 포커스 테두리, 3D 물건(전광판), 섬 밖 화면.
- 부품은 색을 변수로 받는다(1.10.417 U3): `.ghost/.secondary/.primary`는 `:root`의 어두운 기본값을 `body.plazaMode`에서 한 번 종이 값으로 바꾼다. 새 창·새 부품은 아무것도 안 해도 종이색이 된다. 창마다 덮어쓰는 선택자를 늘리지 않는다.

### 게임관 무대 (`--hp-*`, 한판마당 기준)

- **바탕 `bg` #0B0C1A, 한 단 위 `bg2` #15172E.** 게임마다 위쪽에 그 게임색이 22% 번지는 것은 괜찮다.
- **면 `face` 흰 8%(켜짐 `face-on` 20%), 선 `line` 흰 8%, 유리 `glass` 남색 50% + 블러.**
- **글 `t1` #F4F5FC, 흐린 글 `t2` 흰 55% · `t3` 흰 35%.**
- **강조는 셋뿐:** 금 `gold` #FFD34D, 승리 `win` #3DDC97, 경고·패배 `loss` #FF5A79(무승부 `draw` #FFCB57). 브랜드 파랑 `blue` #5B7BFF.
- 게임색 `--c1/--c2`는 `public/gamehall-catalog.js`의 두 색, `--c3`는 c2를 더 어둡게. 판 재질(오목 나무, 카드 초록 펠트)은 게임마다 자유.
- 밝은 테마는 YAML `hall.light`(크림 #F7EFE1, 먹 #3D2F20, 민트 #1C6B5C). 펠트·지도처럼 늘 어두운 판 위(`.gostopFelt`·`#pandemicPanel` 등)는 테마와 상관없이 어두운 값을 다시 쓴다.

### 섬 밖 슬레이트 (`lobby`)

- 페이지 `#0b1220`(+ `radial-gradient(… #1f2937 → #0b1220 → #050914)`), 카드 `rgba(17,24,39,.92)` + 테두리 `rgba(148,163,184,.16)`, 안쪽 행·입력 `#0f172a` + 선 `#273449`/`#334155`, 채팅·목록 `#0b1324` + 선 `#263246`.
- 글자 본문 `#f8fafc` · 보조 `#cbd5e1` · 흐림 `#94a3b8`. 강조(링크·포커스) `#60a5fa`(포커스 링 `rgba(96,165,250,.12)`), 접기 제목 `#93c5fd`. 파랑 단추 `#2563eb`. 노랑(내 차례·점수) `#fbbf24`/`#facc15`/`#fde68a`. 위험 바탕 `#7f1d1d`·글자 `#fecaca`·선 `#ef4444`. 성공 `#16a34a`.
- `#64748b`는 선·장식에만. 글자에는 쓰지 않는다(4.5:1 미달). 가장 흐린 글자는 `#94a3b8`.
- 밝은 팔레트: 페이지 `#f4ede0` · 카드 `#fffaf1` · 안쪽 행 `#f7efe1` · 선 `#e2d4bd`/`#d6c3a5` · 글자 `#33281d`/`#5e4d3b`/흐림 `#7a6650` · 강조(민트) `#23806f` · 노랑 글자 `#8a5a00`.

### 게임 아일랜드 3D 환경

창·버튼·안내에는 위 UI 색을 쓰고, 3D 땅과 소품에 UI 바탕색을 넣지 않는다. 제작본 에셋의 얼굴·의상·건물 재질색은 그 에셋 명세를 따른다. 높은 거칠기·낮은 금속성, 계절 경계의 완만한 색 섞임을 지킨다.

| 용도 | 현재 코드 기준 색상 |
| --- | --- |
| 중앙광장·길 연결 | `#f3e6c8` |
| 길·흙 바탕 | `#efe4cc` |
| 풀 가장자리 | `#a7d483` |
| 봄 지면·흙 | `#c0e0a4`, `#ddc39c` |
| 여름 지면·흙 | `#acd497`, `#d9be95` |
| 가을 지면·흙 | `#e9d7a8`, `#d4b890` |
| 겨울 지면·흙 | `#eff4fa`, `#e5e7eb` |
| 분수 물·물방울·포말 | `#86d0f0`, `#c8ecff`, `#e9f7ff` |
| 야간 대리석 약한 자기발광 | `#4a5262` (밝은 저채도 면에만 적용) |

### 게임별 포인트 색 (카드·배너·아이콘 바탕에만, 흰 글자 대비 — 4.5:1 이상)

원본은 `public/gamehall-catalog.js` 한 곳이다. 게임을 더하거나 색을 바꾸면 이 표에도 같은 줄을 넣는다. `test/gamehall-catalog.test.js`가 아래 표의 줄 모양(게임 이름, 두 색을 ` · `로 이음)과 흰 글자 대비를 확인하니, 줄 모양을 바꾸지 않는다.

| 게임 | 두 색 | 흰 글자 대비 |
|---|---|---|
| 오목 | `#8a5a1f` · `#5c3a12` | 5.9 · 10.1 |
| 사목 | `#1d4ed8` · `#1e3a8a` | 6.7 · 10.4 |
| 달무리 사목 | `#3730a3` · `#1e1b4b` | 9.9 · 16.1 |
| 오델로 | `#166534` · `#14532d` | 7.1 · 9.1 |
| 윷놀이 | `#9a3412` · `#7c2d12` | 7.3 · 9.4 |
| 점과 상자 | `#0f766e` · `#115e59` | 5.5 · 7.6 |
| 빙고 | `#b45309` · `#92400e` | 5.0 · 7.1 |
| 고스톱 · 맞고 | `#b91c1c` · `#14532d` | 6.5 · 9.1 |
| 도둑잡기 | `#4338ca` · `#312e81` | 7.9 · 11.4 |
| 할리갈리 | `#c2410c` · `#9a3412` | 5.2 · 7.3 |
| 다빈치 코드 | `#374151` · `#1f2937` | 10.3 · 14.7 |
| 그림 맞히기 | `#be185d` · `#9d174d` | 6.0 · 7.9 |
| 라이어게임 | `#9f1239` · `#881337` | 8.0 · 9.6 |
| 스무고개 | `#0e7490` · `#155e75` | 5.4 · 7.3 |
| 숫자야구 | `#15803d` · `#166534` | 5.0 · 7.1 |
| 팬데믹 | `#b91c1c` · `#7f1d1d` | 6.5 · 10.0 |
| 두더지 잡기 | `#a16207` · `#713f12` | 4.9 · 8.7 |
| 반응속도 | `#dc2626` · `#991b1b` | 4.8 · 8.3 |
| 다른 색 찾기 | `#be185d` · `#831843` | 6.0 · 9.6 |
| 숫자 터치 | `#2563eb` · `#1e40af` | 5.2 · 8.7 |
| 비트 탭 | `#7e22ce` · `#581c87` | 7.0 · 10.9 |
| 하늘 계단 | `#0e7490` · `#164e63` | 5.4 · 9.1 |
| 스도쿠 | `#0369a1` · `#0c4a6e` | 5.9 · 9.5 |
| 네모로직 | `#4d7c0f` · `#365314` | 5.0 · 8.7 |
| 다리 잇기 | `#0f766e` · `#134e4a` | 5.5 · 9.5 |
| 회로 연결 | `#a21caf` · `#701a75` | 6.3 · 10.0 |
| 불빛 채우기 | `#b45309` · `#78350f` | 5.0 · 9.1 |
| 숫자 밀기 | `#475569` · `#1e293b` | 7.6 · 14.6 |
| 블록 퍼즐 | `#4338ca` · `#312e81` | 7.9 · 11.4 |
| 사과 게임 | `#b91c1c` · `#7f1d1d` | 6.5 · 10.0 |
| 수박 만들기 | `#15803d` · `#14532d` | 5.0 · 9.0 |
| 지뢰찾기 | `#475569` · `#334155` | 7.6 · 10.4 |
| 카드놀이 | `#15803d` · `#14532d` | 5.0 · 9.1 |
| 프리셀 | `#1d4ed8` · `#1e3a8a` | 6.7 · 10.4 |
| 스파이더 카드놀이 | `#334155` · `#0f172a` | 10.4 · 17.9 |
| 두 세계 영웅전 | `#b45309` · `#78350f` | 5.0 · 9.1 |
| 랜드킹 | `#0369a1` · `#075985` | 5.9 · 7.6 |
| 잿빛 원정 | `#57534e` · `#292524` | 7.6 · 15.2 |

## Typography

**글꼴.** `Inter, Pretendard, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` 하나를 상속해 쓴다(따로 지정하지 않음). 예외는 몇몇 게임 그림 안의 글(Georgia 계열)과 고정폭 글(Consolas)뿐이다. 숫자가 바뀌는 곳(점수·시간·포인트)은 `font-variant-numeric: tabular-nums`. YAML의 글자 단계는 모두 `typography.base`의 글꼴을 물려받는다(단계마다 다시 적지 않음).

**굵기.** 섬 밖·게임관은 기본 800, 제목·수치 900(400~700은 거의 쓰지 않음). 섬 종이 창은 본문 700, 긴 글은 400.

**단계.**

| 바탕 | 단계 (크기 / 굵기) |
|---|---|
| 섬 종이 | 큰 값 24/900 · 창 제목 18/900 · 소제목·주 단추 16/800 · 본문 15/700(긴 글 400) · 보조(칩·덧글·단위) 13/700 · **가장 작게 12/700, 이보다 작게 쓰지 않기** |
| 게임관 | 제목 24/900(자간 −.03em) · HUD 숫자 34/900 · 결과 점수 64/900 · HUD 라벨 11/800(자간 +.06em) · 본문 14~15/600~700 · 알약 13/800. **글보다 숫자**: 상태는 「0 / 27초 / 12수 / 2 : 2」처럼 숫자 하나 |
| 섬 밖 | 본문 `.84rem` · 목록/행 `.78–.80` · 보조 `.72–.76` · 칩·시간 `.62–.70` · 소제목 `1–1.2` · 큰 수치 `1.35` · 대문자 라벨(`.eyebrow`) `.78rem` 900 자간 `.16em` `#94a3b8` |

**줄 간격.** 본문 1.45~1.5, 긴 설명 1.6. 줄이 바뀔 수 있는 글은 1.3 아래로 내리지 않는다(한 줄짜리 큰 숫자만 1).

### 한글 글자 규칙 (oh-my-design `hangul` 규칙 참고)

- **어절로 줄 바꾸기:** 단추·라벨·탭·칩·카드 제목·짧은 안내는 `word-break: keep-all` + `overflow-wrap: anywhere`를 함께 쓴다(「있어요」가 「있어/요」로 쪼개지지 않게, 긴 영어·숫자는 넘치지 않게). 긴 본문은 `normal`이어도 된다.
- **`word-break: break-all`은 한글에 쓰지 않는다.**
- **자간:** 20px 아래 한글 본문·UI 글은 0. 음수 자간은 20px 이상 제목·큰 숫자에만, −0.03em까지.
- **기울임 없음:** 한글에 `font-style: italic`을 쓰지 않는다. `<em>`·`<i>`는 굵기나 색으로 강조한다.
- **숫자와 단위:** 세 자리 쉼표(`toLocaleString('ko-KR')`), 단위는 숫자에 붙인다(「1,000P」 「3칸」 「27초」). 한 화면 안에서 같은 방식만 쓴다.
- **잘림:** 한 줄 말줄임은 `overflow:hidden; white-space:nowrap; text-overflow:ellipsis`, 여러 줄은 `line-clamp`. 전체 글은 DOM에 남긴다(`title`·`aria-label`).
- `<html lang="ko">`를 지킨다. 영어 문단에는 `lang="en"`.

## Layout

- **기본 간격:** `6 / 8 / 10 / 12px`, 좁은 칩 사이 `3–5px`, 큰 구역 사이 `18px`. 섬 창 안 좌우 여백 16px.
- **섬 창 폭 셋(1.10.418 U4):** 작게 440(`.winS`, 확인 창·반려동물·택시 목적지) / 보통 560(`.winM`, 관공서·집 문 앞) / 넓게 1120(기본, 가게·게시판). 폭은 `min(…, 94vw)`로 화면을 넘지 않는다. 창 안 칸은 `repeat(auto-fit, minmax(min(340px,100%),1fr))`.
- **게임관:** 시트 560px(폰은 아래에서 올라오는 시트), 결과 패널 420px, 카드 격자 `minmax(160px,1fr)`(520px 이하 2열). 판은 HUD 아래 남은 높이에 맞춘 정사각형.
- **섬 밖:** `.shell` 최대 `1180px`, 좌우 여백 `12px`. 패딩: 행 `10px` · 버튼 `11px 15px` · 카드 `14px`(모바일) ~ `28px`(넓은 화면).
- **목록 줄:** 이름 왼쪽, 값·단추 오른쪽. 카드 안의 반복 항목은 모두 줄(행)로 만든다.

## Elevation & Depth

- **그림자는 맨 바깥 하나만.** 섬 창은 종이 시트에 그림자 하나(`0 10px 28px rgba(74,56,40,.3)` 안팎), 섬 밖 카드는 `0 24px 70px rgba(0,0,0,.28)`. 안쪽 요소에는 그림자를 넣지 않는다.
- **카드 안에 카드를 넣지 않는다.** 안쪽은 줄·구분선으로 나눈다.
- **게임관 결과·안내는 덮개 위 패널 하나:** 어두운 블러 덮개 + `hall-result-panel`(`bg2`, 모서리 28). 이모지 카드·한지 종이를 겹쳐 두 창으로 만들지 않는다.
- **섬의 층:** 3D 섬 → 위 가운데 띠(테이프 한 줄) → 알림 → 창. 알림·힌트는 테이프(`field` 바탕, 모서리 4px). 구름 모양은 가방(내 것)과 주민 대화(사람)에만.

## Shapes

| 바탕 | 모서리 |
|---|---|
| 섬 종이 | 창 22 · 줄·단추·입력 12 · 테이프 4 · 탭·칩·알약 999 · 닫기 ✕ 원 |
| 게임관 | 단추 14 · 큰 단추 18 · 결과 패널 28 · 카드·시트 22(폰 16) · 알약 99 · 아이콘 타일 14(게임방 위 34px 타일은 10) |
| 섬 밖 | 카드 22(모바일 16) · 행·입력 10–12 · 버튼 12 · 칩·배지 999 |

한 화면 안에서 둥근 모서리와 각진 모서리를 섞지 않는다. 물건 모양 창(게시판 코르크·안내 지도·가격표 나무판·기부함)은 틀만 물건 모양이고, 머리·닫기·글자·단추는 섬 규칙을 따른다(결정 43 A 3).

## Motion & Micro-interaction

- **저절로 움직이는 연출은 화면마다 한 번**(열릴 때 한 장면)만. 줄·칸마다 반복되는 등장 효과와 hover 효과는 넣지 않는다.
- **누른 것에 대한 반응**(열기·펼치기·확인)은 무엇이 바뀌었는지 보여 줄 때 쓴다. 누름 `press` 150ms ease(`translateY(-1px)` 정도), 게임관 패널 등장 `hall-panel-enter` 400ms 스프링, 판 열림 `hall-board-open` 500ms.
- `transform`·`opacity`만 움직인다(레이아웃을 다시 계산하는 속성은 움직이지 않는다).
- **동작 줄이기:** 기기의 `prefers-reduced-motion`을 따른다. 섬에서는 상시 물결·분수·호흡·장식 움직임과 카메라 자동 보간을 줄이고, 이동·수확·낚시·승하차 같은 실제 행동과 수동 시점 조작은 둔다. 게임 연출은 「연출 효과」 설정(effectsOff, v1.6.51)이 먼저다.

## Voice & Content Strategy

- **쉬운 해요체.** 사용자 입장의 쉬운 말로 쓴다. 단추 이름과 결과 알림은 같은 낱말을 쓴다(「보내기」→「보냈어요」, 「구매」→「샀어요」).
- **오류는 무엇이 잘못됐고 어떻게 하면 되는지** 한 줄로. 막힌 단추에는 까닭을 한 줄로(「포인트가 모자라요」).
- **빈 목록은 할 일을 안내한다**(「물고기를 낚으면 여기에 모여요」).
- **짧게.** 한 줄 안내 + 접힌 상세(`<details>`)로 대신하고, 설명 문단을 늘어놓지 않는다.
- **번호·이름표·구분선은 뜻이 있을 때만.** 번호는 실제 순서(순위·단계)일 때만.
- 플레이어 이름 옆에는 오프라인 여부만. 세부 정보는 「자세히 보기」로 연다.
- 게임관 안의 상태는 문장보다 숫자·배너(「내 차례예요」 한 번)로.

## Components

### 섬 종이 창 (`.isle-sheet`, `.recordsDialog.plazaDialog`)

| 부품 | 규칙 |
|---|---|
| 창 | `isle-sheet`: 종이 바탕, 선, 모서리 22, 그림자 하나, 폭 셋 중 하나 |
| 머리 | `isle-sheet-head`: 높이 56, 제목 18/900 왼쪽, 카드 바탕, 아래 점선. 보유 포인트는 머리 오른쪽 알약 하나. 창을 내려도 위에 붙어 있다 |
| 닫기 | `isle-close`: 오른쪽 위 ✕ 원 34px(폰 40px) **하나**. 아래쪽 「닫기」 단추 없음. Esc·바깥 누르기로도 닫힘. 대화는 「잘 가요」 |
| 단추 | 주 단추 `isle-button-primary`(한 창에 하나, 하는 일의 이름) · 종이 단추 `isle-button-paper` · 위험 `isle-button-danger`. 높이 44(작은 것 36). **채운 파랑·초록·분홍 단추는 쓰지 않는다** |
| 비활성 | `isle-button-disabled`: 투명도로 흐리게 하지 않는다. 카드 바탕 + 옅은 먹 + 점선 테두리 + 까닭 한 줄 |
| 탭·칩 | `isle-tab` / `isle-tab-selected`: 알약, 높이 36, 13/800. 고른 것은 꿀색 + 진한 테두리 + 먹 글자. 개수는 작은 동그라미 배지 |
| 목록 줄 | `isle-row`: 카드 바탕, 선, 모서리 12, 높이 44 이상 |
| 입력칸·select | `isle-input`: 입력 바탕, 선, 먹 글자, 안내 글 옅은 먹, 포커스는 갈색 테두리. 라디오·체크는 `accent-color: var(--isle-btn)` |
| 값 표시 | `isle-value-pill`: 「동전 그림 + 숫자P」 알약, 숫자는 값 색 |
| 확인 창 | 작은 폭 440, 물음 한 줄 + 주 단추(하는 일의 이름) + 종이 단추(「그만두기」) |
| 옮기기 창 | 「왼쪽 내 가방 · 오른쪽 옮긴 것」 두 칸(노점·마당 창고·골라 팔기가 같이 씀) |
| 물건 모양 창 | `isle-wood-board` 등: 틀은 물건 모양, 나무 위 글은 흰색·크림, 종이 조각 위 글은 먹 |

### 게임관 · 게임방 (한판마당 기준, v1.10.73 개편 + v1.10.243 통일)

- **게임관은 전용 전체 화면(`#gamehallView`):** 섬에서 들어오면 섬은 멈춘다. 상단 바(‹ 섬으로 · 「게임관」 · 효과음 · ☰)와 게임 목록만 둔다. Esc·‹ 섬으로는 섬의 같은 자리로. 관리자 대체 로비(고전 레이아웃)는 바꾸지 않는다.
- **구성 순서:** 「오늘의 게임」 배너 1개(서울 날짜마다 차례로, 높이 92px 이상, 모서리 22) → 내 요약 3칸(포인트·이번 주 판수·승률) → 분류 칩 한 줄 → 게임 카드 격자.
- **분류 칩:** 전체·판 게임·카드·화투·파티·추리·협동·순발력·퍼즐·혼자 하기·AI 연습 + 공개방. 한 게임이 여러 칩에 들어간다. 방향키로 칩 사이를 옮긴다.
- **게임 카드(`.gameCard`, `data-game`) `hall-game-card`:** 모든 게임이 같은 규격 — 최소 높이 150(폰 132), 모서리 22(폰 16), 게임 2색 135° 그라데이션, 아이콘 타일 56px, 이름 1rem 900, 분류·인원 `.7rem`. 준비 중 카드는 맨 끝·투명도 .7·「준비 중」. 포커스는 `#60a5fa` 3px.
- **게임 시트(`#gameSheet`) `hall-game-sheet`:** 유일한 시작 화면. 머리(그 게임 2색, 76px 아이콘, 24/900 제목) → 한 줄 소개 → 방법 3줄 → 난이도·옵션 알약 → 내 기록 → 바닥에 붙은 58px 시작 단추(방 게임: 빠른 시작·방 만들기, AI가 있는 판 게임: AI 연습, 혼자: 시작).
- **단추 셋만:** `hall-button`(`.hpBtn` 50px, 모서리 14, 테두리 없음, 주 단추는 `--c1`, 큰 단추 58px·17px·모서리 18) · `hall-pill`(`.hpPill` 34~40px 유리 알약) · `hall-close`(`.hpX` 40px 둥근 ✕). 게임관 안에 `.ghost/.primary/.secondary`를 새로 쓰지 않는다.
- **게임방 틀:** 판 위 HUD 한 줄(왼쪽 ✕ 나가기 · 가운데 라벨 + 큰 숫자 · 오른쪽 알약 · ☰) + 시간 막대(10초 아래 분홍). 이름표는 차례 알약(34~40px, 모서리 12, 차례인 쪽만 흰 14% + `--c1` 2px 선, 오른쪽 m:ss).
- **결과:** `hall-result-panel` 하나 — 결과 알약 → 제목 → 큰 숫자 64 → 최고 기록·신기록 → 통계 3칸 → 단추 2개(한 판 더 / 게임관으로).
- **게임 실행 규약:** 혼자 하는 게임·AI 연습은 `GameLaunch.play(게임, { level, goal, place })`로 띄운다(결과 `{ score, done, run }`). 판·카드 그림은 게임별 고유 디자인.

### 섬 밖 슬레이트

- 버튼: 테두리 없음, 모서리 12, 800~850 굵기, hover 시 `translateY(-1px)`, 비활성 `opacity:.45`. `.primary`(`lobby-button-primary`) 흰 바탕 + `#111827` 글자 · `.secondary` 파랑 · `.ghost` `#1e293b` + `#334155` 선 · `.danger` 어두운 빨강. (섬 위에서는 같은 클래스가 `--btn-*`로 종이색이 된다.)
- 카드(`.card`, `lobby-card`): 화면의 큰 구역에만. 한 구역 = 카드 하나.
- 행(`.player`, `.publicRoomRow`, `.teamPlayer`, `lobby-row`): `#0f172a` 바탕 + 얇은 선 + 모서리 11–15.
- 배지(`.badge`): 알약, `.78rem`, `#475569` 선.
- 접기: `<details>` + `<summary>`(`.helpDisclosure`, `.collapsibleInfo`, `.gameRuleDetails`), 제목 `.73rem` 800 `#93c5fd`, 기본 마커 숨김.
- 입력(`lobby-input`): `#0f172a` 바탕, `#334155` 선, 포커스 시 `#60a5fa` 선 + 3px 링.
- 새 게임은 공통 구조(좌석 `.players`, 팀 `.teamPlayers`, 채팅 `.chat*`, 방 정보 `#gameInfoPanel`)의 모양을 그대로 쓴다.

## Do's and Don'ts

### Do

- 바탕(섬 종이 / 게임관 무대 / 섬 밖)을 먼저 정하고 그 토큰만 쓴다.
- 정보는 짧고 작게. 한 줄에 여러 항목, 긴 설명·규칙은 접어 둔다.
- 한 화면의 화려함은 한 곳에만(예: 기록의 탑 1등 자리, 잡기 카드). 둘레는 조용히.
- 글자 대비는 4.5:1 이상(큰 숫자 3:1 이상). 새 색은 대비를 재서 이 파일에 적는다.
- 폰에서 누르는 곳은 44px(최소 40px). PC와 폰에서 같은 기능이 같은 자리에서 돈다.

### Don't

- 큰 히어로 영역을 새로 만들지 않는다(예외: 로그인 화면의 큰 `h1`, 게임관 「오늘의 게임」 배너 1개).
- 보라색 그라데이션, 그 밖의 장식용 그라데이션을 더하지 않는다(예외: 게임 카드·아이콘·시트 머리의 게임 고유색, 섬 창 머리의 창 종류 색).
- 카드 안에 카드를 넣지 않는다.
- 섬 종이 창 안에 남색·짙은 파랑(`#0f172a`·`#111827`·`#1e293b`·`#334155`·`#94a3b8`·`#64748b`)을 쓰지 않는다.
- 투명도로 글자를 흐리게 하지 않는다(섬은 `--isle-soft`, 섬 밖은 `#94a3b8`가 가장 옅은 글자).
- 12px보다 작은 글자를 섬 창에 쓰지 않는다. 한글에 `break-all`·기울임을 쓰지 않는다.
- 3D 땅·소품에 UI 바탕색을 넣지 않는다.

## Responsive Behavior

- **PC와 폰을 같이 지원한다**(아이폰 포함). 같은 CSS가 두 곳에서 돌고, 폰 전용 판단은 `pointer:coarse`·`body.touchIsland`로 한다.
- **구간:** `880px`(2단 → 1단), `520px`(폰 축소: 게임 카드 2열, 카드 모서리 16). 섬 창 폭은 `94vw`를 넘지 않는다.
- **누르는 곳:** 폰에서 탭·작은 단추·닫기는 40~44px(닫기 34 → 40). 가방·도감·노점 탭도 같다.
- **줄어들 때:** 탭·칩 줄은 두 줄로 꺾지 말고 가로로 민다(밀 수 있으면 끝을 흐리게). 아래 단추 줄은 「더 보기」 하나로 묶거나 아이콘만. 넓은 창은 폰에서 미리보기 → 거르기 → 목록을 세로 한 줄로.
- **게임관:** 폰은 화면 전체가 판, 시트는 아래에서 올라온다. PC는 시트를 가운데 560px로.

## Accessibility

- 모든 입력·버튼은 `:focus-visible`에서 외곽선이 보인다(섬 밖·게임관 `#60a5fa`, 섬 종이는 갈색 테두리). `outline:none` 단독 금지.
- 행마다 반복되는 같은 이름의 단추는 `aria-label`에 대상(방 이름, 보낸 사람)을 넣는다.
- 채팅 목록은 `role="log" aria-live="polite"`.
- 소리에 기대는 기능(낭독 등)은 먼저 만들지 않는다. 주 사용 환경은 소리 없는 PC라, 소리로만 알리는 것은 화면 글로도 알린다.

## Iteration Guide

AI가 화면을 만들거나 고칠 때의 순서.

1. 이 파일의 Overview에서 바탕을 고른다. 섬 위면 `colors.isle`, 게임관이면 `colors.hall`, 섬 밖이면 `colors.lobby`.
2. YAML의 `components`에서 가까운 부품을 찾아 그 값을 그대로 쓴다(`{colors.isle.btn}`처럼 이름으로). 글로 다시 풀어 쓰지 않는다.
3. 새 색·크기가 필요하면 YAML과 해당 절에 먼저 넣고, 대비를 적는다.
4. 고친 뒤 확인: `npx @google/design.md lint DESIGN.md`(토큰 참조·대비), 게임 색은 `node --test test/gamehall-catalog.test.js`, 밝은 테마는 `node tools/theme-light.js` 후 `test/theme-light.test.js`, 섬 창은 그 창을 여는 e2e(`island-paper-windows`, `island-bag`, `general-store`, `dress-room`, `attendance-card` 등)를 먼저 돌린다.
5. 화면이 바뀌면 PC·폰 사진으로 확인한다.

## Known Gaps

이 파일과 실제 화면이 아직 다른 곳. 고칠 때 이 목록도 줄인다.

- **한글 글꼴을 따로 불러오지 않는다.** `Pretendard`는 이름만 있고 파일을 불러오지 않아, 윈도우는 맑은 고딕, 애플 기기는 애플 SD 고딕 Neo로 보인다. 글꼴 목록에 `"Apple SD Gothic Neo", "Malgun Gothic"`이 없다(브라우저가 알아서 고름).
- **섬 밖 화면에 12px보다 작은 글자가 많다**(`.62–.72rem` ≈ 10–11.5px). 섬 창의 12px 하한은 섬 위에서만 지켜진다. 게임관 HUD 라벨 11px는 한판마당 원본 값이다.
- **섬 토큰이 모두 변수가 된 것은 아니다.** `--isle-good`(#166534)·값 알약 #f2e3c4는 아직 값으로만 적혀 있고, 가방 가구 칸(`.furnCell`) 등 몇 곳은 `#fffaf0`·`#4a3524`를 직접 쓴다.
- **3D 색 표에서 뺀 것:** 옛 표의 길·흙 다섯 색(`#e8d6b4`·`#dcc59a`·`#efdcb4`·`#d9c391`·`#e8d6ad`)과 길가 돌 타일 `#c9a786`·대리석 타일 `#e4ddca`는 지금 코드에 없어 뺐다(1.10.435 기준). 3D 색은 에셋·땅 텍스처가 정하는 부분이 커서, 이 표는 코드에 적힌 색만 담는다.
- **움직임 토큰은 CSS 변수가 아니다.** `--hp-spring` 말고는 시간이 곳곳에 값으로 적혀 있다.
- **섬 종이 창의 밝은 테마, 실제 아이폰, 여러 GPU에서의 3D 색**은 아직 확인하지 않았다.
- 섬 밖 슬레이트(`lobby`)의 YAML 부품 대비는 바탕이 반투명(`rgba`)인 카드 대신 `#111827` 시트 기준으로 적었다.
