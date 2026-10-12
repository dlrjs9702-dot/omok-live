// 공용 유틸
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
export const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const ease = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

// HTML 이스케이프 (사용자 입력 닉네임 등)
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 숫자 포맷
export const fmtNum = (n) => Math.round(n).toLocaleString('ko-KR');
export const fmtPct = (r) => (r == null ? '—' : Math.round(r * 100) + '%');
export const fmtDuration = (sec) => {
  sec = Math.round(sec);
  if (sec < 60) return sec + '초';
  const m = Math.floor(sec / 60);
  if (m < 60) return m + '분';
  return Math.floor(m / 60) + '시간 ' + (m % 60) + '분';
};

// 게임 점수 단위별 표시
export function fmtScore(v, unit) {
  if (v == null) return '—';
  switch (unit) {
    case 'ms': return Math.round(v) + 'ms';
    case 'sec': return (v / 1000).toFixed(1) + '초';
    case 'round': return v + '라운드';
    case 'time': { const t = Math.round(v / 1000); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; }
    default: return fmtNum(v);
  }
}

// 날짜 기반 시드 (오늘의 게임)
export function daySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// 색 유틸: #rrggbb → rgba
export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// 닉네임 이니셜 아바타 색
const AV = ['#7C6CFF', '#FF6B8B', '#FF9F43', '#2ED3A0', '#35B6FF', '#C069FF', '#FFC43D'];
export function avatarColor(seed = '') {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AV[h % AV.length];
}

// 짧은 대기
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
