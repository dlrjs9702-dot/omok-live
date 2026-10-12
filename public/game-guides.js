// v1.10.69 게임 안내 (한판마당 자료 05, 제작자 허락): 상황 예시 그림 · 자주 하는 실수 · 잘하는 요령. 문구는 한판마당
// tools/guide-detail.mjs · guide-content.mjs를 우리 규칙에 맞게 고침(사목 색은 빨강 선 · 노랑 후, 오목 금수 표시·AI·랭킹·
// 개시 규칙 문장 제외, 윷은 던질 때마다 바로 옮기므로 「결과 쓰는 순서」 제외). 그림은 tools/guide-figs.mjs가 만든 SVG 그대로.
// app.js가 게임 규칙 설명(게임 선택 「자세히 보기」)과 지뢰찾기 창에 그린다.
window.GameGuides = Object.freeze({
 "omok": {
  "cases": [
   {
    "title": "흑의 3-3은 금수",
    "svg": "<svg viewBox=\"0 0 254 254\" width=\"254\" height=\"254\" role=\"img\" aria-label=\"흑의 3-3은 금수\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"system-ui, sans-serif\"><rect width=\"254\" height=\"254\" rx=\"10\" fill=\"#e2b66b\"/><line x1=\"22\" y1=\"4\" x2=\"22\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"52\" y1=\"4\" x2=\"52\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"82\" y1=\"4\" x2=\"82\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"112\" y1=\"4\" x2=\"112\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"142\" y1=\"4\" x2=\"142\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"172\" y1=\"4\" x2=\"172\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"202\" y1=\"4\" x2=\"202\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"232\" y1=\"4\" x2=\"232\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"22\" x2=\"250\" y2=\"22\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"52\" x2=\"250\" y2=\"52\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"82\" x2=\"250\" y2=\"82\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"112\" x2=\"250\" y2=\"112\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"142\" x2=\"250\" y2=\"142\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"172\" x2=\"250\" y2=\"172\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"202\" x2=\"250\" y2=\"202\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"232\" x2=\"250\" y2=\"232\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><circle cx=\"82\" cy=\"142\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"112\" cy=\"142\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"142\" cy=\"82\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"142\" cy=\"112\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"172\" cy=\"112\" r=\"13.5\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.2\"/><circle cx=\"112\" cy=\"172\" r=\"13.5\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.2\"/><path d=\"M134.575 134.575L149.425 149.425M149.425 134.575L134.575 149.425\" stroke=\"#e5484d\" stroke-width=\"2.97\" stroke-linecap=\"round\"/></svg>",
    "text": "흑이 ×에 두면 가로와 세로에 열린 3이 동시에 생겨요. 렌주룰에서 흑은 이렇게 열린 3 두 개를 한꺼번에 만드는 3-3을 둘 수 없습니다. 같은 자리라도 백은 둘 수 있어요."
   },
   {
    "title": "흑의 4-3은 이기는 수",
    "svg": "<svg viewBox=\"0 0 254 254\" width=\"254\" height=\"254\" role=\"img\" aria-label=\"흑의 4-3은 이기는 수\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"system-ui, sans-serif\"><rect width=\"254\" height=\"254\" rx=\"10\" fill=\"#e2b66b\"/><line x1=\"22\" y1=\"4\" x2=\"22\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"52\" y1=\"4\" x2=\"52\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"82\" y1=\"4\" x2=\"82\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"112\" y1=\"4\" x2=\"112\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"142\" y1=\"4\" x2=\"142\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"172\" y1=\"4\" x2=\"172\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"202\" y1=\"4\" x2=\"202\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"232\" y1=\"4\" x2=\"232\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"22\" x2=\"250\" y2=\"22\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"52\" x2=\"250\" y2=\"52\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"82\" x2=\"250\" y2=\"82\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"112\" x2=\"250\" y2=\"112\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"142\" x2=\"250\" y2=\"142\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"172\" x2=\"250\" y2=\"172\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"202\" x2=\"250\" y2=\"202\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"232\" x2=\"250\" y2=\"232\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><circle cx=\"52\" cy=\"142\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"82\" cy=\"142\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"112\" cy=\"142\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"142\" cy=\"82\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"142\" cy=\"112\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"22\" cy=\"142\" r=\"13.5\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.2\"/><circle cx=\"142\" cy=\"142\" r=\"8.1\" fill=\"none\" stroke=\"#2f6fed\" stroke-width=\"2.7\"/></svg>",
    "text": "흑이 ○에 두면 가로 4(왼쪽은 백이 막음)와 세로 열린 3이 함께 생겨요. 4-3은 렌주룰에서도 흑이 둘 수 있습니다. 백이 가로 4의 오른쪽 끝을 막으면, 흑은 세로 3을 양쪽이 열린 4로 늘려 다음 수에 반드시 다섯을 잇습니다."
   }
  ],
  "mistakes": [
   [
    "흑으로 3-3을 만들려다 금수에 걸려요.",
    "흑은 4-3으로 공격하세요. 4를 먼저 만들어 상대가 막게 한 뒤 남은 3을 열린 4로 늘리는 것이 흑의 기본 승리법입니다."
   ],
   [
    "띈 3(돌 하나를 띄운 3)을 위협으로 보지 않아요.",
    "띈 3도 한 수만 더하면 열린 4가 돼요. 붙은 3과 똑같이 막아야 합니다."
   ],
   [
    "흑으로 6개를 이었는데 이기지 못해요.",
    "흑은 정확히 다섯 개를 이어야 이겨요. 6개 이상(장목)이 되는 자리는 금수입니다."
   ]
  ],
  "tips": [
   "양쪽이 열린 셋(열린 3)은 상대가 바로 막아야 하는 위협입니다. 흑이라면 3-3은 금수이니 4와 3을 동시에 만드는 4-3으로 공격하세요.",
   "백이라면 흑의 금수 자리를 활용하세요. 흑이 막아야 하는 자리가 금수라면 흑은 그곳을 막을 수 없습니다.",
   "공격만 생각하다 보면 상대 위협을 놓치기 쉽습니다. 돌을 놓기 전에 상대가 다음에 둘 수 있는 가장 좋은 자리를 한 번 확인하세요."
  ]
 },
 "omok2v2": {
  "cases": [
   {
    "title": "흑의 3-3은 금수",
    "svg": "<svg viewBox=\"0 0 254 254\" width=\"254\" height=\"254\" role=\"img\" aria-label=\"흑의 3-3은 금수\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"system-ui, sans-serif\"><rect width=\"254\" height=\"254\" rx=\"10\" fill=\"#e2b66b\"/><line x1=\"22\" y1=\"4\" x2=\"22\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"52\" y1=\"4\" x2=\"52\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"82\" y1=\"4\" x2=\"82\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"112\" y1=\"4\" x2=\"112\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"142\" y1=\"4\" x2=\"142\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"172\" y1=\"4\" x2=\"172\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"202\" y1=\"4\" x2=\"202\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"232\" y1=\"4\" x2=\"232\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"22\" x2=\"250\" y2=\"22\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"52\" x2=\"250\" y2=\"52\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"82\" x2=\"250\" y2=\"82\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"112\" x2=\"250\" y2=\"112\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"142\" x2=\"250\" y2=\"142\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"172\" x2=\"250\" y2=\"172\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"202\" x2=\"250\" y2=\"202\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"232\" x2=\"250\" y2=\"232\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><circle cx=\"82\" cy=\"142\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"112\" cy=\"142\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"142\" cy=\"82\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"142\" cy=\"112\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"172\" cy=\"112\" r=\"13.5\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.2\"/><circle cx=\"112\" cy=\"172\" r=\"13.5\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.2\"/><path d=\"M134.575 134.575L149.425 149.425M149.425 134.575L134.575 149.425\" stroke=\"#e5484d\" stroke-width=\"2.97\" stroke-linecap=\"round\"/></svg>",
    "text": "흑이 ×에 두면 가로와 세로에 열린 3이 동시에 생겨요. 렌주룰에서 흑은 이렇게 열린 3 두 개를 한꺼번에 만드는 3-3을 둘 수 없습니다. 같은 자리라도 백은 둘 수 있어요."
   },
   {
    "title": "흑의 4-3은 이기는 수",
    "svg": "<svg viewBox=\"0 0 254 254\" width=\"254\" height=\"254\" role=\"img\" aria-label=\"흑의 4-3은 이기는 수\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"system-ui, sans-serif\"><rect width=\"254\" height=\"254\" rx=\"10\" fill=\"#e2b66b\"/><line x1=\"22\" y1=\"4\" x2=\"22\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"52\" y1=\"4\" x2=\"52\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"82\" y1=\"4\" x2=\"82\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"112\" y1=\"4\" x2=\"112\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"142\" y1=\"4\" x2=\"142\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"172\" y1=\"4\" x2=\"172\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"202\" y1=\"4\" x2=\"202\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"232\" y1=\"4\" x2=\"232\" y2=\"250\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"22\" x2=\"250\" y2=\"22\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"52\" x2=\"250\" y2=\"52\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"82\" x2=\"250\" y2=\"82\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"112\" x2=\"250\" y2=\"112\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"142\" x2=\"250\" y2=\"142\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"172\" x2=\"250\" y2=\"172\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"202\" x2=\"250\" y2=\"202\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><line x1=\"4\" y1=\"232\" x2=\"250\" y2=\"232\" stroke=\"#6b4a1f\" stroke-width=\"1\"/><circle cx=\"52\" cy=\"142\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"82\" cy=\"142\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"112\" cy=\"142\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"142\" cy=\"82\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"142\" cy=\"112\" r=\"13.5\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.2\"/><circle cx=\"22\" cy=\"142\" r=\"13.5\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.2\"/><circle cx=\"142\" cy=\"142\" r=\"8.1\" fill=\"none\" stroke=\"#2f6fed\" stroke-width=\"2.7\"/></svg>",
    "text": "흑이 ○에 두면 가로 4(왼쪽은 백이 막음)와 세로 열린 3이 함께 생겨요. 4-3은 렌주룰에서도 흑이 둘 수 있습니다. 백이 가로 4의 오른쪽 끝을 막으면, 흑은 세로 3을 양쪽이 열린 4로 늘려 다음 수에 반드시 다섯을 잇습니다."
   }
  ],
  "mistakes": [
   [
    "흑으로 3-3을 만들려다 금수에 걸려요.",
    "흑은 4-3으로 공격하세요. 4를 먼저 만들어 상대가 막게 한 뒤 남은 3을 열린 4로 늘리는 것이 흑의 기본 승리법입니다."
   ],
   [
    "띈 3(돌 하나를 띄운 3)을 위협으로 보지 않아요.",
    "띈 3도 한 수만 더하면 열린 4가 돼요. 붙은 3과 똑같이 막아야 합니다."
   ],
   [
    "흑으로 6개를 이었는데 이기지 못해요.",
    "흑은 정확히 다섯 개를 이어야 이겨요. 6개 이상(장목)이 되는 자리는 금수입니다."
   ]
  ],
  "tips": [
   "양쪽이 열린 셋(열린 3)은 상대가 바로 막아야 하는 위협입니다. 흑이라면 3-3은 금수이니 4와 3을 동시에 만드는 4-3으로 공격하세요.",
   "백이라면 흑의 금수 자리를 활용하세요. 흑이 막아야 하는 자리가 금수라면 흑은 그곳을 막을 수 없습니다.",
   "공격만 생각하다 보면 상대 위협을 놓치기 쉽습니다. 돌을 놓기 전에 상대가 다음에 둘 수 있는 가장 좋은 자리를 한 번 확인하세요."
  ]
 },
 "connect4": {
  "cases": [
   {
    "title": "상대가 이길 칸 바로 아래에 두지 않기",
    "svg": "<svg viewBox=\"0 0 250 234\" width=\"250\" height=\"234\" role=\"img\" aria-label=\"상대가 이길 칸 바로 아래에 두지 않기\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"system-ui, sans-serif\"><rect x=\"0\" y=\"0\" width=\"250\" height=\"216\" rx=\"10\" fill=\"#2457d6\"/><circle cx=\"23\" cy=\"23\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"57\" cy=\"23\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"91\" cy=\"23\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"125\" cy=\"23\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"159\" cy=\"23\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"193\" cy=\"23\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"227\" cy=\"23\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"23\" cy=\"57\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"57\" cy=\"57\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"91\" cy=\"57\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"125\" cy=\"57\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"159\" cy=\"57\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"193\" cy=\"57\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"227\" cy=\"57\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"23\" cy=\"91\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"57\" cy=\"91\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"91\" cy=\"91\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"125\" cy=\"91\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"159\" cy=\"91\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"193\" cy=\"91\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"227\" cy=\"91\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"23\" cy=\"125\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"57\" cy=\"125\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"91\" cy=\"125\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"125\" cy=\"125\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"159\" cy=\"125\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"193\" cy=\"125\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"227\" cy=\"125\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"23\" cy=\"159\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"57\" cy=\"159\" r=\"13.600000000000001\" fill=\"#facc15\"/><circle cx=\"91\" cy=\"159\" r=\"13.600000000000001\" fill=\"#facc15\"/><circle cx=\"125\" cy=\"159\" r=\"13.600000000000001\" fill=\"#facc15\"/><circle cx=\"159\" cy=\"159\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"193\" cy=\"159\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"227\" cy=\"159\" r=\"13.600000000000001\" fill=\"#ef4444\"/><circle cx=\"23\" cy=\"193\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"57\" cy=\"193\" r=\"13.600000000000001\" fill=\"#ef4444\"/><circle cx=\"91\" cy=\"193\" r=\"13.600000000000001\" fill=\"#facc15\"/><circle cx=\"125\" cy=\"193\" r=\"13.600000000000001\" fill=\"#ef4444\"/><circle cx=\"159\" cy=\"193\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"193\" cy=\"193\" r=\"13.600000000000001\" fill=\"#0f2c7a\"/><circle cx=\"227\" cy=\"193\" r=\"13.600000000000001\" fill=\"#ef4444\"/><text x=\"23\" y=\"228\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">1</text><text x=\"57\" y=\"228\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">2</text><text x=\"91\" y=\"228\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">3</text><text x=\"125\" y=\"228\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">4</text><text x=\"159\" y=\"228\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">5</text><text x=\"193\" y=\"228\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">6</text><text x=\"227\" y=\"228\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">7</text><path d=\"M15.146 185.146L30.854 200.854M30.854 185.146L15.146 200.854\" stroke=\"#fff\" stroke-width=\"3.1416\" stroke-linecap=\"round\"/><path d=\"M151.146 185.146L166.854 200.854M166.854 185.146L151.146 200.854\" stroke=\"#fff\" stroke-width=\"3.1416\" stroke-linecap=\"round\"/></svg>",
    "text": "빨강 차례예요. 노랑은 아래에서 두 번째 줄에 셋을 이었지만, 양쪽 끝(1번 · 5번 줄의 그 높이)은 아래 칸이 비어 있어 아직 둘 수 없어요. 빨강이 1번이나 5번 줄(×)에 두면 바로 위 칸이 열려 노랑이 그 칸에 넷을 잇습니다. 빨강은 두 줄을 건드리지 말고 다른 줄에 둬야 해요."
   }
  ],
  "mistakes": [
   [
    "상대의 세 개를 막으려고 아래 칸이 빈 자리에 서둘러 두려 해요.",
    "돌은 맨 아래 빈칸까지 떨어져요. 막을 칸 아래가 비어 있으면 지금은 막을 수 없고, 그 아래를 채우지 않는 것이 막는 방법입니다."
   ],
   [
    "가장자리 줄부터 채워요.",
    "가장자리는 넷을 만들 수 있는 방향이 적어요. 가운데 줄을 먼저 차지하세요."
   ]
  ],
  "tips": [
   "가운데 줄은 가로, 대각선 어느 방향으로든 네 개를 만들기 쉬운 자리입니다. 초반에는 가운데를 차지하세요.",
   "상대가 세 개를 이었다면 네 번째 칸이 언제 채워질 수 있는지 확인하세요. 바로 아래 칸이 비어 있다면 지금은 막을 수 없습니다.",
   "내가 돌을 놓으면 그 위 칸이 상대에게 열립니다. 상대가 이길 수 있는 칸 바로 아래에는 두지 마세요.",
   "이길 수 있는 자리를 두 군데 동시에 만들면 상대는 하나밖에 막지 못합니다."
  ]
 },
 "othello": {
  "cases": [
   {
    "title": "귀 옆 대각선 칸이 위험한 이유",
    "svg": "<svg viewBox=\"0 0 292 292\" width=\"292\" height=\"292\" role=\"img\" aria-label=\"귀 옆 대각선 칸이 위험한 이유\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"system-ui, sans-serif\"><rect x=\"19\" y=\"19\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"53\" y=\"19\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"87\" y=\"19\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"121\" y=\"19\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"155\" y=\"19\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"189\" y=\"19\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"223\" y=\"19\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"257\" y=\"19\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"19\" y=\"53\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"53\" y=\"53\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"87\" y=\"53\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"121\" y=\"53\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"155\" y=\"53\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"189\" y=\"53\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"223\" y=\"53\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"257\" y=\"53\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"19\" y=\"87\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"53\" y=\"87\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"87\" y=\"87\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"121\" y=\"87\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"155\" y=\"87\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"189\" y=\"87\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"223\" y=\"87\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"257\" y=\"87\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"19\" y=\"121\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"53\" y=\"121\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"87\" y=\"121\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"121\" y=\"121\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"155\" y=\"121\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"189\" y=\"121\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"223\" y=\"121\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"257\" y=\"121\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"19\" y=\"155\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"53\" y=\"155\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"87\" y=\"155\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"121\" y=\"155\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"155\" y=\"155\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"189\" y=\"155\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"223\" y=\"155\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"257\" y=\"155\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"19\" y=\"189\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"53\" y=\"189\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"87\" y=\"189\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"121\" y=\"189\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"155\" y=\"189\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"189\" y=\"189\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"223\" y=\"189\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"257\" y=\"189\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"19\" y=\"223\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"53\" y=\"223\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"87\" y=\"223\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"121\" y=\"223\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"155\" y=\"223\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"189\" y=\"223\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"223\" y=\"223\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"257\" y=\"223\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"19\" y=\"257\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"53\" y=\"257\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"87\" y=\"257\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"121\" y=\"257\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"155\" y=\"257\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"189\" y=\"257\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"223\" y=\"257\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><rect x=\"257\" y=\"257\" width=\"34\" height=\"34\" fill=\"#2f8a57\" stroke=\"#1d5e3a\" stroke-width=\"1\"/><text x=\"36\" y=\"13\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">A</text><text x=\"9\" y=\"40\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">1</text><text x=\"70\" y=\"13\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">B</text><text x=\"9\" y=\"74\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">2</text><text x=\"104\" y=\"13\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">C</text><text x=\"9\" y=\"108\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">3</text><text x=\"138\" y=\"13\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">D</text><text x=\"9\" y=\"142\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">4</text><text x=\"172\" y=\"13\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">E</text><text x=\"9\" y=\"176\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">5</text><text x=\"206\" y=\"13\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">F</text><text x=\"9\" y=\"210\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">6</text><text x=\"240\" y=\"13\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">G</text><text x=\"9\" y=\"244\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">7</text><text x=\"274\" y=\"13\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">H</text><text x=\"9\" y=\"278\" font-size=\"12\" font-weight=\"700\" fill=\"currentColor\" opacity=\".7\" text-anchor=\"middle\">8</text><circle cx=\"172\" cy=\"172\" r=\"12.92\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.4\"/><circle cx=\"172\" cy=\"138\" r=\"12.92\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.4\"/><circle cx=\"138\" cy=\"172\" r=\"12.92\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.4\"/><circle cx=\"172\" cy=\"206\" r=\"12.92\" fill=\"#1d1e22\" stroke=\"#000\" stroke-width=\"1.4\"/><circle cx=\"104\" cy=\"104\" r=\"12.92\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.4\"/><circle cx=\"138\" cy=\"138\" r=\"12.92\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.4\"/><circle cx=\"206\" cy=\"206\" r=\"12.92\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.4\"/><circle cx=\"138\" cy=\"104\" r=\"12.92\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.4\"/><circle cx=\"206\" cy=\"172\" r=\"12.92\" fill=\"#f6f5f0\" stroke=\"#6b6b6b\" stroke-width=\"1.4\"/><path d=\"M70 61.1464L78.568 76.426L61.432 76.426Z\" fill=\"none\" stroke=\"#e5484d\" stroke-width=\"2.856\" stroke-linejoin=\"round\"/><circle cx=\"36\" cy=\"36\" r=\"8.568\" fill=\"none\" stroke=\"#2f6fed\" stroke-width=\"2.856\"/></svg>",
    "text": "흑이 △(B2)에 두면 C3 · D4의 백이 뒤집혀 대각선이 흑으로 이어지고 돌도 늘어 보여요. 하지만 그러면 백이 ○(A1) 귀에 두어 B2부터 E5까지 흑 네 개를 한꺼번에 뒤집습니다. 귀에 놓인 돌은 끝까지 뒤집히지 않으니 백에게 귀와 대각선을 통째로 내주는 셈이에요."
   }
  ],
  "mistakes": [
   [
    "초반부터 가장 많이 뒤집는 수를 둬요.",
    "돌이 많아지면 상대가 둘 곳도 많아져요. 초반에는 적게 뒤집고 내가 둘 수 있는 곳을 늘리는 편이 유리합니다."
   ],
   [
    "귀 바로 옆 칸에 먼저 둬요.",
    "위 예처럼 귀 옆 칸은 상대에게 귀를 내주는 통로가 되기 쉬워요. 그 귀를 이미 내가 가졌을 때만 두세요."
   ]
  ],
  "tips": [
   "네 귀퉁이는 한 번 차지하면 다시 뒤집히지 않습니다. 모서리를 먼저 잡는 쪽이 크게 유리합니다.",
   "귀퉁이 바로 옆 칸(특히 대각선 칸)에 먼저 두면 상대에게 귀퉁이를 내주기 쉬우니 조심하세요.",
   "초반에는 돌을 많이 뒤집기보다 적게 뒤집으면서 내가 둘 수 있는 칸을 많이 남기는 편이 좋습니다.",
   "상대가 둘 곳이 없게 만들면 상대는 차례를 넘겨야 합니다. 막판에는 이런 상황을 노려 보세요."
  ]
 },
 "yut": {
  "cases": [],
  "mistakes": [
   [
    "말을 업어서 한꺼번에 달리다 같이 잡혀요.",
    "업은 말은 함께 움직이고 잡힐 때도 함께 처음으로 돌아가요. 상대 말이 1~3칸 뒤에 있으면 업기를 미루세요."
   ]
  ],
  "tips": [
   "모서리나 가운데 칸에 딱 멈추면 다음 이동부터 지름길로 갈 수 있습니다. 거리를 계산해 모서리에 멈추는 수를 노리세요.",
   "내 말끼리 같은 칸에서 만나면 업어서 함께 움직입니다. 빨리 갈 수 있지만, 잡히면 한꺼번에 돌아가니 상대 말과의 거리를 확인하세요.",
   "상대 말을 잡으면 한 번 더 던질 수 있습니다. 잡을 수 있는 거리라면 대개 잡는 편이 이득입니다.",
   "상대 말 바로 앞 1~3칸은 도 · 개 · 걸로 잡히기 쉬운 자리입니다. 멈출 칸을 고를 수 있다면 피하세요."
  ]
 },
 "minesweeper": {
  "cases": [
   {
    "title": "1-2-1 모양",
    "svg": "<svg viewBox=\"0 0 172 104\" width=\"172\" height=\"104\" role=\"img\" aria-label=\"1-2-1 모양\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"system-ui, sans-serif\"><rect x=\"1\" y=\"1\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#9aa3c7\" stroke=\"#7d83a0\" stroke-width=\".6\"/><circle cx=\"18\" cy=\"18\" r=\"8.568\" fill=\"none\" stroke=\"#1f9d55\" stroke-width=\"2.856\"/><rect x=\"35\" y=\"1\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#9aa3c7\" stroke=\"#7d83a0\" stroke-width=\".6\"/><path d=\"M48 26V9L59 14L48 19\" fill=\"#e5484d\" stroke=\"#333\" stroke-width=\"1.4\" stroke-linejoin=\"round\"/><rect x=\"69\" y=\"1\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#9aa3c7\" stroke=\"#7d83a0\" stroke-width=\".6\"/><circle cx=\"86\" cy=\"18\" r=\"8.568\" fill=\"none\" stroke=\"#1f9d55\" stroke-width=\"2.856\"/><rect x=\"103\" y=\"1\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#9aa3c7\" stroke=\"#7d83a0\" stroke-width=\".6\"/><path d=\"M116 26V9L127 14L116 19\" fill=\"#e5484d\" stroke=\"#333\" stroke-width=\"1.4\" stroke-linejoin=\"round\"/><rect x=\"137\" y=\"1\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#9aa3c7\" stroke=\"#7d83a0\" stroke-width=\".6\"/><circle cx=\"154\" cy=\"18\" r=\"8.568\" fill=\"none\" stroke=\"#1f9d55\" stroke-width=\"2.856\"/><rect x=\"1\" y=\"35\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#e9ebf5\" stroke=\"#7d83a0\" stroke-width=\".6\"/><text x=\"18\" y=\"58\" font-size=\"17\" font-weight=\"800\" fill=\"#2f6fed\" text-anchor=\"middle\">1</text><rect x=\"35\" y=\"35\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#e9ebf5\" stroke=\"#7d83a0\" stroke-width=\".6\"/><text x=\"52\" y=\"58\" font-size=\"17\" font-weight=\"800\" fill=\"#2f6fed\" text-anchor=\"middle\">1</text><rect x=\"69\" y=\"35\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#e9ebf5\" stroke=\"#7d83a0\" stroke-width=\".6\"/><text x=\"86\" y=\"58\" font-size=\"17\" font-weight=\"800\" fill=\"#1f9d55\" text-anchor=\"middle\">2</text><rect x=\"103\" y=\"35\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#e9ebf5\" stroke=\"#7d83a0\" stroke-width=\".6\"/><text x=\"120\" y=\"58\" font-size=\"17\" font-weight=\"800\" fill=\"#2f6fed\" text-anchor=\"middle\">1</text><rect x=\"137\" y=\"35\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#e9ebf5\" stroke=\"#7d83a0\" stroke-width=\".6\"/><text x=\"154\" y=\"58\" font-size=\"17\" font-weight=\"800\" fill=\"#2f6fed\" text-anchor=\"middle\">1</text><rect x=\"1\" y=\"69\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#e9ebf5\" stroke=\"#7d83a0\" stroke-width=\".6\"/><rect x=\"35\" y=\"69\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#e9ebf5\" stroke=\"#7d83a0\" stroke-width=\".6\"/><rect x=\"69\" y=\"69\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#e9ebf5\" stroke=\"#7d83a0\" stroke-width=\".6\"/><rect x=\"103\" y=\"69\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#e9ebf5\" stroke=\"#7d83a0\" stroke-width=\".6\"/><rect x=\"137\" y=\"69\" width=\"33\" height=\"33\" rx=\"4\" fill=\"#e9ebf5\" stroke=\"#7d83a0\" stroke-width=\".6\"/></svg>",
    "text": "판 가장자리를 따라 닫힌 칸 아래에 1 · 1 · 2 · 1 · 1이 열렸어요. 가운데 2는 위 세 칸 가운데 두 곳이 지뢰라는 뜻인데, 그 옆의 1들이 지뢰를 하나씩만 허락하므로 지뢰는 2의 양옆 위(깃발)뿐이고 2 바로 위와 양 끝(○)은 안전합니다. 1-2-1이 보이면 1 위가 지뢰, 2 위가 안전하다고 기억하세요."
   }
  ],
  "mistakes": [
   [
    "확실하지 않은 칸에 깃발을 꽂고 숫자를 눌러요.",
    "틀린 깃발로 주변을 한 번에 열면 지뢰가 열려 끝나요. 깃발은 확실할 때만 꽂으세요."
   ],
   [
    "막히면 바로 아무 칸이나 찍어요.",
    "찍기 전에 숫자 두세 개를 함께 놓고 따져 보세요. 1-2-1, 1-1 같은 모양에서 확실한 칸이 남아 있는 경우가 많습니다."
   ]
  ],
  "tips": [
   "숫자 1 옆에 닫힌 칸이 하나뿐이라면 그 칸이 지뢰입니다. 확실한 칸부터 깃발을 꽂아 나가세요.",
   "숫자만큼 깃발을 꽂았다면 그 숫자를 눌러 주변의 나머지 칸을 한 번에 열 수 있습니다. 기록을 줄이는 핵심 기술입니다.",
   "1-2-1이나 1-2-2-1처럼 자주 나오는 숫자 배열은, 그 숫자들이 닿는 닫힌 칸이 한 줄에만 남아 있을 때(판 가장자리나 이미 열린 칸에 막힌 줄) 지뢰 위치가 정해집니다. 주변에 닫힌 칸이 더 있는지 함께 확인하세요.",
   "더 이상 확실한 칸이 없을 때만 찍으세요. 찍어야 한다면 가장자리보다 정보가 많이 열릴 칸을 고르는 것이 좋습니다."
  ]
 }
});
