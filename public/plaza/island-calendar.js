// E1 계절 행사 달력 (gamecenter-notes docs/season-events-design-20261025.md, 사용자 「달마다 큰 행사 + 매주 대회」 · 「행사 도장
// → 한정 물건」 · 「11월 앞당기자」): the festivals and the weekly contests, by Seoul dates. A festival: its days, its host by
// 대청마당, what earns stamps (and how many a day), and its stall's limited goods for stamps -- stamps are the festival's own
// and gone when it ends. The contests: Saturday fishing, Sunday insects, 10:00-22:00, three-minute rounds; the day's three
// best take a trophy and a title. The administrator can switch a festival off or move its days (an override). Browser and server.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.IslandCalendar = api;
}(typeof self !== 'undefined' ? self : this, () => {
  const KST = 9 * 3600 * 1000; const DAY = 86400 * 1000;
  const dayOf = (ms) => new Date(ms + KST).toISOString().slice(0, 10); // Seoul's date
  const hourOf = (ms) => new Date(ms + KST).getUTCHours();
  const weekdayOf = (ms) => new Date(ms + KST).getUTCDay(); // 0 Sunday .. 6 Saturday
  const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

  // the limited goods (assets 72): furniture into 가구 창고, a title worn in the title slot
  const GOODS = Object.freeze({
    harvest_basket: { name: '수확 바구니', kind: 'furniture', good: 'harvest_basket__plain' },
    straw_sheaf: { name: '볏단 장식', kind: 'furniture', good: 'straw_sheaf__plain' },
    corn_string: { name: '옥수수 걸이', kind: 'furniture', good: 'corn_string__plain' },
    persimmon_string: { name: '곶감 걸이', kind: 'furniture', good: 'persimmon_string__plain' },
    feast_table: { name: '잔칫상', kind: 'furniture', good: 'feast_table__plain' },
    title_harvest: { name: '칭호 「풍년」', kind: 'title', title: 'title_event_harvest' },
  });
  const FESTIVALS = Object.freeze([
    Object.freeze({
      id: 'harvest-2026', name: '수확제', start: '2026-11-20', end: '2026-11-26', // (소설 무렵, 7일 -- 사용자 2026-10-25)
      host: '수확제 주민', say: '풍년이에요! 밭에서 거두고, 요리 대회에 나오고, 마지막 날 저녁 잔치에 모여요.',
      tasks: Object.freeze({
        harvest: { name: '밭 수확', stamps: 1, perDay: 3 },
        cook: { name: '요리 대회', stamps: 2, perDay: 1 },
        feast: { name: '주민 잔치', stamps: 3, perDay: 1, lastDayFrom: 18, lastDayTo: 22 }, // (the last day's evening, by the feast table)
        contest: { name: '매주 대회 참가', stamps: 1, perDay: 1 }, // (a contest day in the festival: a round started)
      }),
      shop: Object.freeze([['harvest_basket', 3], ['straw_sheaf', 3], ['corn_string', 4], ['persimmon_string', 4], ['feast_table', 8], ['title_harvest', 10]].map(([id, stamps]) => Object.freeze({ id, stamps, ...GOODS[id] }))),
    }),
  ]);
  // titles the events give (worn like the others; owned once given)
  const TITLES = Object.freeze({
    title_event_harvest: { name: '풍년' },
    ...Object.fromEntries(['fish', 'bug'].flatMap((k) => [1, 2, 3].map((r) => [`title_contest_${k}_${r}`, { name: `${k === 'fish' ? '낚시' : '곤충'} 대회 ${['금', '은', '동'][r - 1]}상` }]))),
  });
  const titleOf = (id) => (TITLES[id] ? { id, ...TITLES[id] } : null);

  // the weekly contests: Saturday 낚시, Sunday 곤충, 10:00-22:00 Seoul, from the first one (2026-11-07)
  const CONTEST = Object.freeze({ first: '2026-11-07', from: 10, to: 22, roundMs: 3 * 60 * 1000, kinds: Object.freeze({ 6: 'fish', 0: 'bug' }), names: Object.freeze({ fish: '낚시 대회', bug: '곤충 대회' }) });
  const TROPHY = Object.freeze({ fish: ['trophy_fish__gold', 'trophy_fish__silver', 'trophy_fish__bronze'], bug: ['trophy_bug__gold', 'trophy_bug__silver', 'trophy_bug__bronze'] });

  // where an event stands on 대청마당 (its south side, clear of the disc, the channels and the gardens): the stall (its sign
  // read from its -Z, turned to face the disc), its host beside it -- the festival's and the contests' -- and the feast table
  const PLACES = Object.freeze({ stall: Object.freeze({ x: 12, z: -104, yaw: Math.PI }), host: Object.freeze({ x: 9.4, z: -102.6, yaw: -0.47 }) /* (toward the disc) */, feast: Object.freeze({ x: 0, z: -98, yaw: 0 }), REACH: 2.6, FEAST_R: 6 });
  // a festival's days with the administrator's override ({ [id]: { off, start, end } })
  function festivalDays(f, override = {}) { const o = override[f.id] || {}; return { start: o.start || f.start, end: o.end || f.end, off: Boolean(o.off) }; }
  // the festival on at `ms` (its days moved or switched off by the override), or null
  function festivalAt(ms, override = {}) {
    const day = dayOf(ms);
    for (const f of FESTIVALS) { const d = festivalDays(f, override); if (!d.off && day >= d.start && day <= d.end) return { ...f, start: d.start, end: d.end, lastDay: day === d.end, daysLeft: Math.round((Date.parse(`${d.end}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / DAY) }; }
    return null;
  }
  // the next festival from `ms` on (for 「곧」 notes), or null
  function nextFestival(ms, override = {}) {
    const day = dayOf(ms); let best = null;
    for (const f of FESTIVALS) { const d = festivalDays(f, override); if (!d.off && d.start > day && (!best || d.start < best.start)) best = { ...f, start: d.start, end: d.end }; }
    return best;
  }
  // the contest of `ms`'s day (kind, its day, open now or not), or null; `override.contest` { day: kind } puts one on a day (tests, admin)
  function contestAt(ms, override = {}) {
    const day = dayOf(ms); const forced = override.contest?.[day];
    const kind = forced || (day >= CONTEST.first ? CONTEST.kinds[weekdayOf(ms)] : null); if (!kind) return null;
    const h = hourOf(ms); const allDay = Boolean(override.contestAllDay);
    return { kind, name: CONTEST.names[kind], day, open: allDay || (h >= CONTEST.from && h < CONTEST.to), from: CONTEST.from, to: CONTEST.to };
  }
  // a festival task allowed now (the feast only on the last day's evening)
  function taskOpen(fest, task, ms) {
    const t = fest?.tasks?.[task]; if (!t) return false;
    if (t.lastDayFrom === undefined) return true;
    const h = hourOf(ms); return dayOf(ms) === fest.end && h >= t.lastDayFrom && h < t.lastDayTo;
  }
  // the day's ranking from each account's best score: [{ account, score, at }] -> sorted, the earlier first on a tie
  const rankOf = (rows) => rows.slice().sort((a, b) => b.score - a.score || a.at - b.at || String(a.account).localeCompare(String(b.account)));

  return { KST, DAY, dayOf, hourOf, weekdayOf, addDays, GOODS, FESTIVALS, TITLES, titleOf, CONTEST, TROPHY, PLACES, festivalDays, festivalAt, nextFestival, contestAt, taskOpen, rankOf };
}));
