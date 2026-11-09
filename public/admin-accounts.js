// 293 관리자 계정 탭 (사용자 「찾는데 너무 힘들고 보기 어려워」, notes docs/admin-jail-292-20261109.md 6절): finding accounts --
// a search over nickname, login id, real name and memo (초성 too: 「ㅇㅅ」 finds 우성), filter chips with their counts, four
// sorts, 「방금 · 3시간 전 · 어제 · 12일 전」. Works in the browser (window.AdminAccounts) and in node tests (require).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AdminAccounts = factory();
}(typeof self !== 'undefined' ? self : this, () => {
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  // a word's first consonants (other letters as they are)
  const choseong = (s) => [...String(s || '')].map((ch) => { const c = ch.charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : ch; }).join('');
  const onlyCho = (q) => /^[ㄱ-ㅎ]+$/.test(q);
  const DAY = 86400000; const seenAt = (k) => (k.lastSeenAt ? Date.parse(k.lastSeenAt) : NaN);
  const daysSince = (k, now) => (Number.isFinite(seenAt(k)) ? (now - seenAt(k)) / DAY : Infinity);
  // the chips (a tag's: 'tag:<id>'); 「취소됨」 shows only the revoked, every other only the live ones
  const CHIPS = Object.freeze([['all', '전체'], ['online', '접속 중'], ['today', '오늘 옴'], ['week', '7일 안'], ['away', '30일 넘게 안 옴'], ['jail', '구치소'], ['debt', '체납'], ['messenger', '메신저 허용'], ['issues', '문제 기록 허용'], ['noid', '아이디 없음'], ['revoked', '취소됨']]);
  const sameDay = (a, b) => new Date(a + 9 * 3600000).toISOString().slice(0, 10) === new Date(b + 9 * 3600000).toISOString().slice(0, 10);
  function inChip(k, chip, now = Date.now()) {
    if (chip === 'revoked') return Boolean(k.revokedAt); if (k.revokedAt || k.pendingAt) return false;
    if (chip.startsWith('tag:')) return (k.tags || []).includes(chip.slice(4));
    switch (chip) {
      case 'online': return Boolean(k.presence?.online);
      case 'today': return Boolean(k.presence?.online) || (Number.isFinite(seenAt(k)) && sameDay(seenAt(k), now));
      case 'week': return daysSince(k, now) <= 7;
      case 'away': return daysSince(k, now) > 30;
      case 'jail': return Boolean(k.jail);
      case 'debt': return k.debt > 0;
      case 'messenger': return Boolean(k.messenger);
      case 'issues': return Boolean(k.issues);
      case 'noid': return !k.loginId;
      default: return true;
    }
  }
  function matches(k, q) {
    const s = String(q || '').trim().toLowerCase(); if (!s) return true;
    const fields = [k.label, k.loginId, k.realName, k.adminNote].map((v) => String(v || '').toLowerCase());
    return fields.some((f) => f.includes(s)) || (onlyCho(s) && fields.some((f) => choseong(f).includes(s)));
  }
  const SORTS = Object.freeze([['seen', '최근 접속'], ['joined', '가입한 날'], ['name', '이름'], ['points', '포인트 많은 순']]);
  function sortKeys(keys, by) {
    const t = (v) => (v ? Date.parse(v) || 0 : 0);
    const cmp = { seen: (a, b) => Number(Boolean(b.presence?.online)) - Number(Boolean(a.presence?.online)) || t(b.lastSeenAt) - t(a.lastSeenAt), joined: (a, b) => t(b.createdAt) - t(a.createdAt), name: (a, b) => String(a.label).localeCompare(String(b.label), 'ko'), points: (a, b) => (b.points || 0) - (a.points || 0) }[by] || (() => 0);
    return [...keys].sort((a, b) => cmp(a, b) || String(a.label).localeCompare(String(b.label), 'ko'));
  }
  // what the list shows: searched, filtered, sorted; and each chip's count (over the searched)
  function view(keys, { q = '', chip = 'all', sort = 'seen', tags = [], now = Date.now() } = {}) {
    const found = keys.filter((k) => !k.pendingAt && matches(k, q));
    const chips = [...CHIPS.map(([id, label]) => ({ id, label })), ...tags.map((g) => ({ id: `tag:${g.id}`, label: g.name, color: g.color }))].map((c) => ({ ...c, count: found.filter((k) => inChip(k, c.id, now)).length }));
    return { rows: sortKeys(found.filter((k) => inChip(k, chip, now)), sort), chips };
  }
  // 「방금 · 3시간 전 · 어제 · 12일 전」
  function ago(iso, now = Date.now()) {
    const t = iso ? Date.parse(iso) : NaN; if (!Number.isFinite(t)) return '없음'; const m = (now - t) / 60000;
    if (m < 5) return '방금'; if (m < 60) return `${Math.floor(m)}분 전`; if (m < 1440) return `${Math.floor(m / 60)}시간 전`;
    const d = Math.floor(m / 1440); return d === 1 ? '어제' : `${d}일 전`;
  }
  // 12.3만 · 1,234
  const pointsShort = (n) => (n >= 10000 ? `${Math.round(n / 1000) / 10}만` : Number(n || 0).toLocaleString('ko-KR'));
  return Object.freeze({ choseong, matches, inChip, CHIPS, SORTS, sortKeys, view, ago, pointsShort });
}));
