// 아이콘 세트 — UI(24px 라인) + 게임 아트(64px 실루엣)

const U = {
  home: '<path d="M3.5 10.2 12 3.5l8.5 6.7V19a1.5 1.5 0 0 1-1.5 1.5h-4.2v-6h-5.6v6H5A1.5 1.5 0 0 1 3.5 19z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.6-4 3.9-6.5 8-6.5s7.4 2.5 8 6.5"/>',
  settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.3"/><circle cx="9" cy="17" r="2.3"/>',
  pause: '<rect x="6.5" y="5" width="3.8" height="14" rx="1.4" fill="currentColor" stroke="none"/><rect x="13.7" y="5" width="3.8" height="14" rx="1.4" fill="currentColor" stroke="none"/>',
  play: '<path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l11-6.8a1 1 0 0 0 0-1.8l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor" stroke="none"/>',
  restart: '<path d="M3.5 12a8.5 8.5 0 1 0 2.8-6.3"/><path d="M3.5 4v4.5H8"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5.5l6.5 6.5L9 18.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 0 1-8 0z"/><path d="M8 6H5.5a2.5 2.5 0 0 0 2.6 4M16 6h2.5a2.5 2.5 0 0 1-2.6 4M12 14v4M8.5 21h7M9.5 18h5"/>',
  star: '<path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" fill="currentColor" stroke="none"/>',
  flame: '<path d="M12 21.5c3.9 0 6.8-2.6 6.8-6.5 0-3.4-2.3-5.6-3.8-7.9-.5 1.9-1.5 3-2.9 3.5.4-3.2-1-6.1-3.8-8.3-.2 3.6-3.9 6.1-3.9 10.7 0 4 3.4 8.5 7.6 8.5z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  sound: '<path d="M4 9.5v5h3.8L13 18.5v-13L7.8 9.5z"/><path d="M16.5 9a4.2 4.2 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5v5h3.8L13 18.5v-13L7.8 9.5z"/><path d="M17 9.5l5 5M22 9.5l-5 5"/>',
  vibrate: '<rect x="7.5" y="3.5" width="9" height="17" rx="2"/><path d="M4 8.5v7M20 8.5v7"/>',
  heart: '<path d="M12 20.5s-7.3-4.4-9.2-8.9C1.6 8.5 3.6 5 7 5c2 0 3.5 1.1 5 2.9C13.5 6.1 15 5 17 5c3.4 0 5.4 3.5 4.2 6.6-1.9 4.5-9.2 8.9-9.2 8.9z" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M3 3l18 18M10.5 5.6c.5-.1 1-.1 1.5-.1 6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.9 3.8M6.5 6.8C3.9 8.5 2.5 12 2.5 12S6 18.5 12 18.5c1.8 0 3.4-.6 4.7-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  logout: '<path d="M14.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3.5M10 16.5 14.5 12 10 7.5M14.5 12H3.5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  shield: '<path d="M12 3l7.5 3v6c0 4.7-3.2 7.8-7.5 9-4.3-1.2-7.5-4.3-7.5-9V6z"/><path d="M9 12l2 2 4-4"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>',
  crown: '<path d="M3.5 8.5l4.3 3.7L12 5.5l4.2 6.7 4.3-3.7-1.8 10H5.3z" fill="currentColor" stroke="none"/>',
  flag: '<path d="M5.5 21V4M5.5 4.5H17l-2.2 4 2.2 4H5.5"/>',
  gamepad: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9" fill="currentColor"/><circle cx="17.5" cy="13.5" r=".9" fill="currentColor"/>',
  sparkle: '<path d="M12 2.5l2 5.6 5.5 1.9-5.5 1.9-2 5.6-2-5.6L4.5 10 10 8.1z" fill="currentColor" stroke="none"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" stroke="none"/>',
  tap: '<path d="M9.5 11.5V6a1.5 1.5 0 0 1 3 0v5l3.7.8a2 2 0 0 1 1.5 2.4L16.8 19a2 2 0 0 1-2 1.5h-3.2a2 2 0 0 1-1.6-.8l-3.5-4.5a1.4 1.4 0 0 1 2-2l1 1"/><path d="M6.5 7a5 5 0 0 1 9 0"/>',
  drag: '<path d="M3.5 12h17M7.5 8l-4 4 4 4M16.5 8l4 4-4 4"/>',
  vdrag: '<path d="M12 3.5v17M8 7.5l4-4 4 4M8 16.5l4 4 4-4"/>',
  swipe: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  avoid: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17v.3"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12z"/>',
  bomb: '<circle cx="10.5" cy="14" r="6.5"/><path d="M15 9.5l2.5-2.5M19 3.5v1.5M21 5.5h-1.5M20 7l1 1"/>',
  music: '<path d="M9 18V5.5l10.5-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>',
  cards: '<rect x="3" y="5" width="9" height="12" rx="2"/><rect x="12" y="7" width="9" height="12" rx="2"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20.5 4v5h-5"/>',
  down: '<path d="M12 4v15M6 13l6 6 6-6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7.5l8.5 6 8.5-6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  chart: '<path d="M5 20v-8M11 20V5M17 20v-5M3 20.5h18"/>',
  versus: '<path d="M4 4l7 8-7 8M20 4l-7 8 7 8" opacity=".9"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/>',
  signal: '<path d="M5 19v-3M10 19v-6M15 19V9M20 19V5"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
  offline: '<path d="M2.5 8.8a14 14 0 0 1 5-2.8M12 5.5a14 14 0 0 1 9.5 3.3M5.8 12.3a9 9 0 0 1 3.4-1.9M14.6 10.6a9 9 0 0 1 3.6 1.7M9.3 15.6a4.5 4.5 0 0 1 5.4 0"/><circle cx="12" cy="19" r=".8"/><path d="M3 3l18 18"/>',
  update: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5"/><path d="M5 19.5h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
  brain: '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 2.5V4.5zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 2.5V4.5z"/>',
  bag: '<path d="M5 8.5h14l-1.2 11.2a1.5 1.5 0 0 1-1.5 1.3H7.7a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5v7.5h14v-7.5M12 8.5v11.5M12 8.5C10 5 6.5 5 7 7.5s5 1 5 1zm0 0c2-3.5 5.5-3.5 5-1s-5 1-5 1z"/>',
  hole: '<ellipse cx="12" cy="15" rx="8.5" ry="3.5"/><path d="M7 14.5V11a5 5 0 0 1 10 0v3.5"/>',
};

/** UI 아이콘 */
export function icon(name, extra = '') {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${U[name] || ''}</svg>`;
}

/* ---------- 게임 아트 (흰색 실루엣, 카드 배경은 게임 색) ---------- */
const W = '#fff';
const D = 'var(--c3)';
const A = {
  shooter: `<rect x="30.5" y="1" width="3" height="8" rx="1.5" fill="${W}" opacity=".8"/>
    <circle cx="13" cy="15" r="6" fill="${W}" opacity=".55"/><circle cx="52" cy="22" r="4" fill="${W}" opacity=".4"/>
    <path d="M28 41 32 55 36 41z" fill="${W}" opacity=".55"/><path d="M32 13 44 44 32 38 20 44z" fill="${W}"/>`,
  dodge: `<rect x="4" y="12" width="24" height="9" rx="4.5" fill="${W}"/><rect x="42" y="12" width="18" height="9" rx="4.5" fill="${W}"/>
    <rect x="4" y="30" width="10" height="9" rx="4.5" fill="${W}" opacity=".45"/><rect x="28" y="30" width="32" height="9" rx="4.5" fill="${W}" opacity=".45"/>
    <circle cx="35" cy="52" r="11" fill="${W}" opacity=".22"/><circle cx="35" cy="52" r="6" fill="${W}"/>`,
  stairs: `<g fill="${W}"><rect x="6" y="50" width="16" height="7" rx="3"/><rect x="18" y="40" width="16" height="7" rx="3" opacity=".9"/><rect x="30" y="30" width="16" height="7" rx="3" opacity=".8"/><rect x="18" y="20" width="16" height="7" rx="3" opacity=".6"/><rect x="30" y="10" width="16" height="7" rx="3" opacity=".4"/></g>
    <circle cx="38" cy="22" r="6" fill="${W}"/>`, // (R7 하늘 계단: a zigzag stair and the climber)
  rhythm: `<g fill="${W}" opacity=".18"><rect x="7" y="2" width="11" height="60" rx="5.5"/><rect x="20" y="2" width="11" height="60" rx="5.5"/><rect x="33" y="2" width="11" height="60" rx="5.5"/><rect x="46" y="2" width="11" height="60" rx="5.5"/></g>
    <rect x="7" y="10" width="11" height="7" rx="3.5" fill="${W}"/><rect x="33" y="22" width="11" height="7" rx="3.5" fill="${W}"/>
    <rect x="20" y="31" width="11" height="7" rx="3.5" fill="${W}" opacity=".8"/><rect x="46" y="38" width="11" height="7" rx="3.5" fill="${W}"/>
    <rect x="4" y="49" width="56" height="3.5" rx="1.75" fill="${W}"/>`,
  whack: `<ellipse cx="32" cy="50" rx="25" ry="8" fill="#000" opacity=".22"/>
    <path d="M17 51V33a15 15 0 0 1 30 0v18z" fill="${W}"/>
    <circle cx="26.5" cy="31" r="2.6" fill="${D}"/><circle cx="37.5" cy="31" r="2.6" fill="${D}"/>
    <ellipse cx="32" cy="37.5" rx="4" ry="3" fill="${D}" opacity=".8"/>
    <path d="M8 50c16 9 32 9 48 0v5c-16 8-32 8-48 0z" fill="${W}" opacity=".5"/>`,
  reaction: `<circle cx="32" cy="32" r="26" fill="${W}" opacity=".18"/><circle cx="32" cy="32" r="18" fill="${W}" opacity=".18"/>
    <path d="M36 7 18 36h13l-3 21 18-30H33z" fill="${W}"/>`,
  snake: `<path d="M10 50h16V32h18" stroke="${W}" stroke-opacity=".6" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M44 32V16" stroke="${W}" stroke-width="10" stroke-linecap="round" fill="none"/>
    <circle cx="41.5" cy="15" r="1.8" fill="${D}"/><circle cx="46.5" cy="15" r="1.8" fill="${D}"/>
    <circle cx="18" cy="16" r="5" fill="${W}" opacity=".85"/>`,
  flappy: `<rect x="45" y="-2" width="15" height="22" rx="3" fill="${W}" opacity=".45"/><rect x="45" y="44" width="15" height="22" rx="3" fill="${W}" opacity=".45"/>
    <circle cx="26" cy="32" r="14" fill="${W}"/><ellipse cx="20" cy="35" rx="7.5" ry="4.8" fill="${D}" opacity=".28"/>
    <circle cx="31.5" cy="27.5" r="3.4" fill="${D}"/><path d="M39 30l9 3.5-9 3.5z" fill="${W}" opacity=".85"/>`,
  breakout: `<g fill="${W}"><rect x="6" y="8" width="16" height="8" rx="2.5"/><rect x="24" y="8" width="16" height="8" rx="2.5"/><rect x="42" y="8" width="16" height="8" rx="2.5"/></g>
    <g fill="${W}" opacity=".5"><rect x="6" y="18" width="16" height="8" rx="2.5"/><rect x="42" y="18" width="16" height="8" rx="2.5"/></g>
    <circle cx="35" cy="38" r="5" fill="${W}"/><rect x="16" y="51" width="30" height="6.5" rx="3.25" fill="${W}"/>`,
  g2048: `<rect x="6" y="6" width="24" height="24" rx="6" fill="${W}"/><rect x="34" y="6" width="24" height="24" rx="6" fill="${W}" opacity=".55"/>
    <rect x="6" y="34" width="24" height="24" rx="6" fill="${W}" opacity=".55"/><rect x="34" y="34" width="24" height="24" rx="6" fill="${W}" opacity=".3"/>
    <text x="18" y="24.5" text-anchor="middle" font-size="16" font-weight="900" fill="${D}" font-family="system-ui,sans-serif">2</text>
    <text x="46" y="52.5" text-anchor="middle" font-size="14" font-weight="900" fill="${W}" font-family="system-ui,sans-serif">8</text>`,
  simon: `<path d="M30 30H6A24 24 0 0 1 30 6z" fill="${W}"/><path d="M34 30V6a24 24 0 0 1 24 24z" fill="${W}" opacity=".5"/>
    <path d="M34 34h24a24 24 0 0 1-24 24z" fill="${W}" opacity=".75"/><path d="M30 34v24A24 24 0 0 1 6 34z" fill="${W}" opacity=".35"/>
    <circle cx="32" cy="32" r="10" fill="${D}"/>`,
  numbers: `<g fill="${W}" opacity=".3"><rect x="25" y="25" width="14" height="14" rx="4"/><rect x="42" y="25" width="14" height="14" rx="4"/><rect x="8" y="42" width="14" height="14" rx="4"/><rect x="42" y="42" width="14" height="14" rx="4"/><rect x="8" y="25" width="14" height="14" rx="4"/><rect x="25" y="42" width="14" height="14" rx="4"/></g>
    <g fill="${W}"><rect x="8" y="8" width="14" height="14" rx="4"/><rect x="25" y="8" width="14" height="14" rx="4"/><rect x="42" y="8" width="14" height="14" rx="4"/></g>
    <g font-size="10" font-weight="900" fill="${D}" text-anchor="middle" font-family="system-ui,sans-serif"><text x="15" y="18.5">1</text><text x="32" y="18.5">2</text><text x="49" y="18.5">3</text></g>`,
  pong: `<path d="M6 32h52" stroke="${W}" stroke-width="2.5" stroke-dasharray="4 5" stroke-linecap="round" opacity=".4"/>
    <rect x="24" y="6" width="26" height="7" rx="3.5" fill="${W}" opacity=".6"/><rect x="12" y="51" width="26" height="7" rx="3.5" fill="${W}"/>
    <circle cx="28" cy="44" r="3" fill="${W}" opacity=".3"/><circle cx="32" cy="37" r="4" fill="${W}" opacity=".55"/><circle cx="37" cy="29" r="5.5" fill="${W}"/>`,
  blocks: `<g fill="${W}"><rect x="14" y="4" width="12" height="12" rx="3"/><rect x="27" y="4" width="12" height="12" rx="3"/><rect x="40" y="4" width="12" height="12" rx="3"/><rect x="27" y="17" width="12" height="12" rx="3"/></g>
    <g fill="${W}" opacity=".45"><rect x="1" y="35" width="12" height="12" rx="3"/><rect x="14" y="35" width="12" height="12" rx="3"/><rect x="40" y="35" width="12" height="12" rx="3"/><rect x="53" y="35" width="10" height="12" rx="3"/>
    <rect x="1" y="48" width="12" height="12" rx="3"/><rect x="14" y="48" width="12" height="12" rx="3"/><rect x="27" y="48" width="12" height="12" rx="3"/><rect x="40" y="48" width="12" height="12" rx="3"/><rect x="53" y="48" width="10" height="12" rx="3"/></g>
    <rect x="27.5" y="35.5" width="11" height="11" rx="3" fill="none" stroke="${W}" stroke-width="1.5" stroke-dasharray="2.5 2"/>`,
  memory: `<rect x="5" y="14" width="27" height="38" rx="6" fill="${W}" opacity=".45" transform="rotate(-12 18 33)"/>
    <rect x="29" y="11" width="29" height="40" rx="6" fill="${W}" transform="rotate(8 43 31)"/>
    <path d="M43.5 21.5l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.5 2.9 1-6.2-4.4-4.4 6.2-.9z" fill="${D}" transform="rotate(8 43 31)"/>`,
  tictactoe: `<path d="M24 7v50M40 7v50M7 24h50M7 40h50" stroke="${W}" stroke-width="3" stroke-linecap="round" opacity=".4"/>
    <path d="M10 10l9 9M19 10l-9 9M45 45l9 9M54 45l-9 9" stroke="${W}" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="5.5" stroke="${W}" stroke-width="4.5" fill="none"/><circle cx="49" cy="15" r="5" stroke="${W}" stroke-width="4" fill="none" opacity=".6"/>`,
  gomoku: `<g stroke="${W}" stroke-width="2" opacity=".45"><path d="M6 14H58M6 26H58M6 38H58M6 50H58M14 6V58M26 6V58M38 6V58M50 6V58"/></g>
    <circle cx="26" cy="26" r="7.5" fill="${D}"/><circle cx="38" cy="38" r="7.5" fill="${D}"/><circle cx="50" cy="50" r="7.5" fill="${D}" opacity=".55"/>
    <circle cx="38" cy="26" r="7.5" fill="${W}"/><circle cx="26" cy="38" r="7.5" fill="${W}"/><circle cx="14" cy="14" r="7.5" fill="${D}"/>`,
  reversi: `<rect x="5" y="5" width="54" height="54" rx="12" fill="${W}" opacity=".16"/>
    <circle cx="21" cy="21" r="11" fill="${W}"/><circle cx="43" cy="43" r="11" fill="${W}"/>
    <circle cx="43" cy="21" r="11" fill="${D}"/><ellipse cx="21" cy="43" rx="4.5" ry="11" fill="${W}"/><ellipse cx="21" cy="43" rx="2.2" ry="11" fill="${D}"/>`,
  connect4: `<circle cx="32" cy="7" r="6" fill="${W}"/>
    <rect x="6" y="16" width="52" height="42" rx="9" fill="${W}"/>
    <g fill="${D}" opacity=".85"><circle cx="18" cy="28" r="5"/><circle cx="32" cy="28" r="5"/><circle cx="46" cy="28" r="5" opacity=".35"/><circle cx="18" cy="45" r="5" opacity=".35"/></g>
    <g fill="var(--c1)"><circle cx="32" cy="45" r="5"/><circle cx="46" cy="45" r="5"/></g>`,
  airhockey: `<rect x="9" y="3" width="46" height="58" rx="12" fill="none" stroke="${W}" stroke-width="3" opacity=".5"/>
    <path d="M9 32H55" stroke="${W}" stroke-width="2" opacity=".4"/><rect x="23" y="1.5" width="18" height="3" rx="1.5" fill="${W}" opacity=".8"/>
    <circle cx="36" cy="14" r="7" fill="${W}" opacity=".55"/><circle cx="38" cy="30" r="5" fill="${W}"/>
    <circle cx="27" cy="47" r="9.5" fill="${W}"/><circle cx="27" cy="47" r="4" fill="${D}"/>`,
  stack: `<rect x="10" y="47" width="42" height="10" rx="2.5" fill="${W}" opacity=".45"/>
    <rect x="12" y="35" width="40" height="10" rx="2.5" fill="${W}" opacity=".65"/>
    <rect x="14" y="23" width="36" height="10" rx="2.5" fill="${W}" opacity=".85"/>
    <rect x="24" y="7" width="34" height="10" rx="2.5" fill="${W}"/>
    <path d="M6 10h10M9 14h7" stroke="${W}" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>`,
  colorfind: `<g fill="${W}" opacity=".85"><rect x="6" y="6" width="15" height="15" rx="4"/><rect x="24.5" y="6" width="15" height="15" rx="4"/><rect x="43" y="6" width="15" height="15" rx="4"/>
    <rect x="6" y="24.5" width="15" height="15" rx="4"/><rect x="43" y="24.5" width="15" height="15" rx="4"/>
    <rect x="6" y="43" width="15" height="15" rx="4"/><rect x="24.5" y="43" width="15" height="15" rx="4"/><rect x="43" y="43" width="15" height="15" rx="4"/></g>
    <rect x="24.5" y="24.5" width="15" height="15" rx="4" fill="${W}" opacity=".45"/>
    <rect x="21.5" y="21.5" width="21" height="21" rx="6" fill="none" stroke="${W}" stroke-width="2.5"/>`,
  math: `<g stroke="${W}" stroke-width="4.5" stroke-linecap="round"><path d="M19 9v16M11 17h16"/><path d="M37 17h16" opacity=".75"/><path d="M13 41l12 12M25 41 13 53" opacity=".75"/><path d="M37 47h16"/></g>
    <circle cx="45" cy="40" r="2.8" fill="${W}"/><circle cx="45" cy="54" r="2.8" fill="${W}"/>`,
  spider: `<g transform="rotate(-14 30 38)"><rect x="10" y="14" width="26" height="36" rx="4" fill="${W}" opacity=".45"/></g>
    <g transform="rotate(9 34 36)"><rect x="24" y="12" width="28" height="38" rx="4.5" fill="${W}"/>
    <path d="M38 20c-5 6-10 9-10 14a4.5 4.5 0 0 0 8 2.6L35 42h6l-1-5.4a4.5 4.5 0 0 0 8-2.6c0-5-5-8-10-14z" fill="${D}"/></g>`,
  klondike: `<rect x="6" y="6" width="11" height="15" rx="2.5" fill="${W}" opacity=".45"/><rect x="20" y="6" width="11" height="15" rx="2.5" fill="${W}" opacity=".45"/>
    <rect x="37" y="6" width="11" height="15" rx="2.5" fill="none" stroke="${W}" stroke-width="2" opacity=".5"/><rect x="50" y="6" width="9" height="15" rx="2.5" fill="none" stroke="${W}" stroke-width="2" opacity=".5"/>
    <rect x="8" y="27" width="14" height="19" rx="3" fill="${W}"/><rect x="25" y="27" width="14" height="19" rx="3" fill="${W}" opacity=".5"/><rect x="25" y="34" width="14" height="19" rx="3" fill="${W}"/>
    <rect x="42" y="27" width="14" height="19" rx="3" fill="${W}" opacity=".5"/><rect x="42" y="33" width="14" height="19" rx="3" fill="${W}" opacity=".7"/><rect x="42" y="39" width="14" height="19" rx="3" fill="${W}"/>`,
  freecell: `<g fill="none" stroke="${W}" stroke-width="2" opacity=".55"><rect x="6" y="6" width="11" height="14" rx="2.5"/><rect x="20" y="6" width="11" height="14" rx="2.5"/></g>
    <rect x="34" y="6" width="11" height="14" rx="2.5" fill="${W}" opacity=".6"/><rect x="48" y="6" width="11" height="14" rx="2.5" fill="${W}" opacity=".6"/>
    <rect x="10" y="26" width="18" height="24" rx="3.5" fill="${W}" opacity=".55"/><rect x="10" y="33" width="18" height="24" rx="3.5" fill="${W}"/>
    <rect x="36" y="26" width="18" height="24" rx="3.5" fill="${W}" opacity=".55"/><rect x="36" y="33" width="18" height="24" rx="3.5" fill="${W}"/>
    <path d="M19 40l4 5-4 5-4-5z M45 40l4 5-4 5-4-5z" fill="${D}"/>`,
  go: `<rect x="8" y="8" width="48" height="48" rx="6" fill="${W}" opacity=".22"/><g stroke="${W}" stroke-width="1.6" opacity=".6"><path d="M16 14v36M26 14v36M38 14v36M48 14v36M14 16h36M14 26h36M14 38h36M14 48h36"/></g>
    <circle cx="26" cy="26" r="7" fill="${D}"/><circle cx="38" cy="26" r="7" fill="${W}"/><circle cx="26" cy="38" r="7" fill="${W}"/><circle cx="38" cy="38" r="7" fill="${D}"/><circle cx="48" cy="16" r="5" fill="${W}" opacity=".7"/>`,
  chess: `<path d="M20 54h24M22 50h20l-2-8H24zM26 42l-3-16h18l-3 16zM24 26c-4-3-3-10 2-12l2 5 3-7 3 7 3-5c5 2 6 9 2 12z" fill="${W}"/>
    <circle cx="48" cy="18" r="5" fill="${W}" opacity=".5"/><path d="M42 54h14l-2-16c3-3 3-9-2-11h-6c-5 2-5 8-2 11z" fill="${W}" opacity=".5"/>`,
  checkers: `<g fill="${W}"><circle cx="22" cy="24" r="11"/><circle cx="42" cy="44" r="11" opacity=".5"/></g><circle cx="22" cy="24" r="6.5" fill="none" stroke="${D}" stroke-width="2"/>
    <path d="M36 44l2-5 4 3 4-3 2 5z" fill="${D}" opacity=".7"/><rect x="8" y="42" width="10" height="10" rx="2" fill="${W}" opacity=".3"/><rect x="46" y="10" width="10" height="10" rx="2" fill="${W}" opacity=".3"/>`,
  backgammon: `<g fill="${W}"><path d="M8 8h8l-4 26zM20 8h8l-4 26zM36 56h8l-4-26zM48 56h8l-4-26z" opacity=".45"/></g>
    <rect x="24" y="36" width="15" height="15" rx="4" fill="${W}"/><rect x="40" y="16" width="15" height="15" rx="4" fill="${W}"/>
    <g fill="${D}"><circle cx="28" cy="40" r="1.8"/><circle cx="35" cy="47" r="1.8"/><circle cx="44" cy="20" r="1.8"/><circle cx="47.5" cy="23.5" r="1.8"/><circle cx="51" cy="27" r="1.8"/></g>`,
  hearts: `<g transform="rotate(-12 26 34)"><rect x="12" y="14" width="26" height="36" rx="4" fill="${W}" opacity=".5"/></g><g transform="rotate(10 38 32)"><rect x="26" y="12" width="26" height="36" rx="4" fill="${W}"/></g>
    <path d="M39 38c-8-5-11-9-9-13 1.5-3 6-3 9 1 3-4 7.5-4 9-1 2 4-1 8-9 13z" fill="${D}" transform="rotate(10 38 32)"/>`,
  spades: `<g transform="rotate(-12 26 34)"><rect x="12" y="14" width="26" height="36" rx="4" fill="${W}" opacity=".5"/></g><g transform="rotate(10 38 32)"><rect x="26" y="12" width="26" height="36" rx="4" fill="${W}"/></g>
    <path d="M39 20c-6 6-10 9-10 13a4.5 4.5 0 0 0 8 2.6L36 40h6l-1-4.4a4.5 4.5 0 0 0 8-2.6c0-4-4-7-10-13z" fill="${D}" transform="rotate(10 38 32)"/>`,
  yut: `<g fill="${W}"><rect x="9" y="12" width="9" height="42" rx="4.5" transform="rotate(-16 13 33)"/><rect x="21" y="9" width="9" height="46" rx="4.5" opacity=".55" transform="rotate(-5 25 32)"/><rect x="34" y="9" width="9" height="46" rx="4.5" transform="rotate(5 38 32)"/><rect x="46" y="12" width="9" height="42" rx="4.5" opacity=".55" transform="rotate(16 50 33)"/></g>`,
  mahjong: `<rect x="14" y="16" width="22" height="30" rx="4" fill="${W}" opacity=".45"/><rect x="28" y="12" width="22" height="30" rx="4" fill="${W}"/>
    <rect x="31" y="15" width="16" height="24" rx="2.5" fill="none" stroke="${D}" stroke-width="1.5" opacity=".5"/><text x="39" y="33" font-size="13" font-weight="900" text-anchor="middle" fill="${D}">中</text>`,
  mines: `<g stroke="${W}" stroke-width="3.5" stroke-linecap="round"><path d="M28 16v40M8 36h40M14 22l28 28M42 22 14 50"/></g>
    <circle cx="28" cy="36" r="13" fill="${W}"/><circle cx="23" cy="31" r="3.5" fill="${D}" opacity=".5"/>
    <path d="M46 6v20" stroke="${W}" stroke-width="3" stroke-linecap="round"/><path d="M47 6l12 5-12 5z" fill="${W}" opacity=".85"/>`,
  sudoku: `<rect x="7" y="7" width="50" height="50" rx="7" fill="${W}" opacity=".18"/><g stroke="${W}" stroke-width="1.4" opacity=".45"><path d="M23.7 9v46M40.3 9v46M9 23.7h46M9 40.3h46"/></g>
    <rect x="7" y="7" width="50" height="50" rx="7" fill="none" stroke="${W}" stroke-width="3"/>
    <g font-weight="900" text-anchor="middle" fill="${W}"><text x="15.4" y="21" font-size="12">5</text><text x="48.6" y="37.5" font-size="12">9</text><text x="32" y="54" font-size="12" opacity=".7">3</text></g>
    <rect x="24.5" y="24.5" width="15" height="15" rx="3" fill="${W}"/><text x="32" y="36.5" font-size="12" font-weight="900" text-anchor="middle" fill="${D}">7</text>`,
  nonogram: `<g fill="${W}"><rect x="22" y="22" width="9" height="9" rx="2"/><rect x="33" y="22" width="9" height="9" rx="2" opacity=".35"/><rect x="44" y="22" width="9" height="9" rx="2"/>
    <rect x="22" y="33" width="9" height="9" rx="2"/><rect x="33" y="33" width="9" height="9" rx="2"/><rect x="44" y="33" width="9" height="9" rx="2"/>
    <rect x="22" y="44" width="9" height="9" rx="2" opacity=".35"/><rect x="33" y="44" width="9" height="9" rx="2"/><rect x="44" y="44" width="9" height="9" rx="2" opacity=".35"/></g>
    <g font-size="8" font-weight="900" fill="${W}" text-anchor="middle" opacity=".8"><text x="26.5" y="17">2</text><text x="37.5" y="17">2</text><text x="48.5" y="17">2</text><text x="12" y="29.5">1 1</text><text x="13" y="40.5">3</text><text x="13" y="51.5">1</text></g>`,
  hashi: `<g stroke="${W}" stroke-width="3" stroke-linecap="round"><path d="M20 17h24M20 23h24"/><path d="M14 26v18" opacity=".7"/><path d="M50 26v18"/></g>
    <g fill="${W}"><circle cx="14" cy="20" r="8"/><circle cx="50" cy="20" r="8"/><circle cx="14" cy="50" r="8" opacity=".7"/><circle cx="50" cy="50" r="8"/></g>
    <g font-size="10" font-weight="900" fill="${D}" text-anchor="middle"><text x="14" y="23.5">3</text><text x="50" y="23.5">3</text><text x="14" y="53.5">1</text><text x="50" y="53.5">1</text></g>`,
  circuit: `<g stroke="${W}" stroke-width="6" stroke-linecap="round" fill="none"><path d="M32 32V10M32 32h22M32 32v12a6 6 0 0 1-6 6H10" /></g>
    <g stroke="${W}" stroke-width="6" stroke-linecap="round" opacity=".35"><path d="M10 14h10M54 50h-8"/></g>
    <circle cx="32" cy="32" r="9" fill="${W}"/><path d="M33.5 26l-5 7h4l-1.5 6 5-7.5h-4z" fill="${D}"/>`,
};

export function art(id) {
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${A[id] || ''}</svg>`;
}

// 앱 로고 (브랜드 마크)
export function logo(size = 34, id = 'lg') { // id: 한 화면에 로고가 여럿일 때 그라데이션 이름이 겹치지 않게
  return `<svg class="logo" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8A6CFF"/><stop offset=".55" stop-color="#5B7BFF"/><stop offset="1" stop-color="#35C8FF"/></linearGradient></defs>
    <rect width="64" height="64" rx="18" fill="url(#${id})"/>
    <path d="M17 14.5v15a1.3 1.3 0 0 0 2 1.1l12-7.5a1.3 1.3 0 0 0 0-2.2l-12-7.5a1.3 1.3 0 0 0-2 1.1z" fill="#fff"/>
    <rect x="36" y="13" width="15" height="15" rx="4.5" fill="#fff" opacity=".9"/>
    <rect x="13" y="36" width="15" height="15" rx="4.5" fill="#fff" opacity=".65"/>
    <rect x="36" y="36" width="15" height="15" rx="4.5" fill="#fff" opacity=".4"/>
  </svg>`;
}
