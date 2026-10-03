// v1.7.4 게임센터 자체 화투 그림: 48장 + 보너스 2장을 코드로 그린 벡터(SVG).
// 전통 화투의 월별 소재(송학·매조·벚꽃·흑싸리·난초·모란·홍싸리·공산·국진·단풍·오동·비)와 광·열끗·띠·피의
// 구도만 참고해 기본 도형으로 새로 그렸다. 상용 게임이나 현대 제조사의 카드 이미지·UI 자산은 쓰지 않는다.
// 각 카드는 외부 파일·<use> 참조 없이 스스로 완결된 인라인 SVG라서 PiP 창·연출 레이어에서도 그대로 보인다.
(() => {
  'use strict';

  const W = 60; const H = 90;
  const cache = new Map();
  const r = (n) => Math.round(n * 10) / 10;

  // ---- 공통 도형 -------------------------------------------------------------------------------
  const circle = (x, y, rad, fill, extra = '') => `<circle cx="${r(x)}" cy="${r(y)}" r="${r(rad)}" fill="${fill}"${extra}/>`;
  const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
  const stroke = (d, color, width, extra = '') => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
  // 다섯 꽃잎 꽃(매화·벚꽃·국화 계열)
  function flower(x, y, size, petal, center, count = 5) {
    let out = '';
    for (let i = 0; i < count; i += 1) {
      const a = (Math.PI * 2 * i) / count - Math.PI / 2;
      out += circle(x + Math.cos(a) * size * 0.55, y + Math.sin(a) * size * 0.55, size * 0.48, petal);
    }
    return out + circle(x, y, size * 0.28, center);
  }
  // 솔잎 뭉치
  function pineTuft(x, y, s, color) {
    let out = '';
    for (let i = -3; i <= 3; i += 1) {
      const a = (i * 16 - 90) * Math.PI / 180;
      out += stroke(`M${r(x)} ${r(y)}L${r(x + Math.cos(a) * s)} ${r(y + Math.sin(a) * s)}`, color, 1.6);
    }
    return out;
  }
  // 단풍잎(뾰족한 별꼴)
  function maple(x, y, s, fill, rot = 0) {
    const pts = [];
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI * 2 * i) / 10 - Math.PI / 2 + rot;
      const len = i % 2 ? s * 0.42 : s;
      pts.push(`${r(x + Math.cos(a) * len)} ${r(y + Math.sin(a) * len)}`);
    }
    return path(`M${pts.join('L')}Z`, fill) + stroke(`M${r(x)} ${r(y)}L${r(x)} ${r(y + s * 1.3)}`, '#7a3b12', 0.9);
  }
  function leaf(x, y, len, angle, fill) {
    const a = angle * Math.PI / 180;
    const ex = x + Math.cos(a) * len; const ey = y + Math.sin(a) * len;
    const nx = -Math.sin(a) * len * 0.28; const ny = Math.cos(a) * len * 0.28;
    const mx = (x + ex) / 2; const my = (y + ey) / 2;
    return path(`M${r(x)} ${r(y)}Q${r(mx + nx)} ${r(my + ny)} ${r(ex)} ${r(ey)}Q${r(mx - nx)} ${r(my - ny)} ${r(x)} ${r(y)}Z`, fill);
  }
  function hill(color, top = 52) {
    return path(`M0 ${top + 8}Q12 ${top - 4} 24 ${top + 4}Q36 ${top + 12} 46 ${top}Q54 ${top - 6} 60 ${top + 2}L60 90L0 90Z`, color);
  }
  function rain(color = 'rgba(30,41,59,.55)') {
    let out = '';
    for (let i = 0; i < 9; i += 1) out += stroke(`M${6 + i * 7} ${4 + (i % 3) * 6}l-5 16`, color, 1.1);
    return out;
  }

  // ---- 표식 ------------------------------------------------------------------------------------
  // 광: 붉은 원 안의 흰 光(전통 화투의 오래된 공통 표식).
  // 오른쪽 위: 왼쪽 위에는 화면의 월 숫자 칩이 얹힌다.
  const gwangMark = () => circle(49, 11, 7.2, '#c1121f', ' stroke="#fff7e6" stroke-width="1.2"')
    + `<text x="49" y="14.4" text-anchor="middle" font-size="9.5" font-weight="900" fill="#fff7e6" font-family="serif">光</text>`;
  // 쌍피: 금색 둥근 딱지 안의 2.
  const doubleMark = (n = 2) => circle(49, 11, 6.6, '#b8860b', ' stroke="#fff7e6" stroke-width="1"')
    + `<text x="49" y="14.2" text-anchor="middle" font-size="9" font-weight="900" fill="#fff7e6" font-family="sans-serif">${n}</text>`;
  // 띠: 비스듬한 띠. 홍단·청단은 글씨, 초단·비띠는 무늬 없음.
  function ribbon(dan) {
    const fill = dan === 'cheong' ? '#1d4ed8' : dan === 'hong' || dan === 'cho' ? '#c1121f' : '#a21caf';
    const edge = dan === 'cheong' ? '#93c5fd' : '#fecaca';
    let out = path('M20 22L32 20L38 64L26 66Z', fill, ` stroke="${edge}" stroke-width="1"`);
    if (dan === 'hong' || dan === 'cheong') {
      out += `<text x="29" y="36" text-anchor="middle" font-size="6.2" font-weight="900" fill="#fff7e6" transform="rotate(-8 29 43)" font-family="sans-serif">${dan === 'hong' ? '홍' : '청'}</text>`
        + `<text x="30.4" y="45" text-anchor="middle" font-size="6.2" font-weight="900" fill="#fff7e6" transform="rotate(-8 29 43)" font-family="sans-serif">단</text>`;
    }
    if (!dan) out += stroke('M24 32L34 31M25 44L35 43M26 56L36 55', '#fde68a', 1);
    return out;
  }

  // ---- 동물·광 그림 ------------------------------------------------------------------------------
  const FIG = {
    crane: () => path('M24 56Q18 40 30 34Q40 30 44 40Q46 50 38 56Z', '#fdfdfd', ' stroke="#1f2937" stroke-width="1"')
      + stroke('M30 34Q27 24 32 18', '#1f2937', 1.6) + circle(33, 17, 2.4, '#c1121f') + stroke('M34 18L41 20', '#1f2937', 1.2)
      + path('M38 44Q48 42 52 50Q44 50 38 50Z', '#1f2937') + stroke('M30 56L28 68M36 56L37 68', '#1f2937', 1.2),
    sun: () => circle(28, 28, 11, '#e63946'),
    warbler: () => path('M20 44Q24 34 34 36Q42 38 42 46Q36 52 26 50Z', '#6b8e23', ' stroke="#2f3d10" stroke-width=".8"')
      + circle(36, 40, 1.3, '#111') + path('M42 42L47 43L42 45Z', '#b45309') + path('M20 46L12 50L20 50Z', '#556b2f'),
    curtain: () => path('M6 38L54 38L54 58Q48 64 42 58Q36 64 30 58Q24 64 18 58Q12 64 6 58Z', '#c1121f')
      + stroke('M14 38V60M22 38V60M30 38V60M38 38V60M46 38V60', '#fff1f2', 2.2) + path('M6 34L54 34L54 39L6 39Z', '#7c2d12'),
    cuckoo: () => path('M18 30Q28 22 40 28Q46 32 44 38Q34 40 24 36Z', '#1f2937') + path('M44 30L50 29L45 33Z', '#b45309')
      + circle(40, 30, 1.2, '#fbbf24') + path('M24 34L14 42L26 38Z', '#111827') + circle(46, 16, 5.5, '#fde68a', ' opacity=".9"'),
    bridge: () => path('M4 58Q30 44 56 58L56 64Q30 50 4 64Z', '#8b5a2b') + stroke('M12 56V66M22 52V62M32 50V60M42 52V62M50 55V65', '#5b3a1a', 1.4),
    butterflies: () => [[20, 30, '#2563eb'], [40, 42, '#0ea5e9']].map(([x, y, c]) => path(`M${x} ${y}Q${x - 9} ${y - 8} ${x - 8} ${y + 2}Q${x - 5} ${y + 8} ${x} ${y + 2}Q${x + 5} ${y + 8} ${x + 8} ${y + 2}Q${x + 9} ${y - 8} ${x} ${y}Z`, c, ' stroke="#0f172a" stroke-width=".7"')).join(''),
    boar: () => path('M10 60Q12 44 30 44Q46 44 50 54Q52 60 46 62L14 64Z', '#7c4a1e', ' stroke="#3b2210" stroke-width="1"')
      + path('M46 50L54 52L48 56Z', '#3b2210') + circle(44, 52, 1.2, '#111') + stroke('M18 64V70M26 64V70M38 63V69M44 62V68', '#3b2210', 2),
    moon: () => circle(30, 32, 14, '#fff7e6', ' stroke="#fcd34d" stroke-width="1.2"'),
    geese: () => [[16, 22], [28, 16], [40, 24]].map(([x, y]) => stroke(`M${x - 6} ${y + 3}Q${x - 2} ${y - 3} ${x} ${y + 1}Q${x + 2} ${y - 3} ${x + 6} ${y + 3}`, '#111827', 1.8)).join(''),
    cup: () => path('M16 44L44 44L40 58Q30 64 20 58Z', '#b91c1c', ' stroke="#fde68a" stroke-width="1.4"') + path('M24 60L36 60L38 66L22 66Z', '#7f1d1d')
      + circle(30, 50, 4, '#fde68a'),
    deer: () => path('M16 62Q18 46 32 46Q44 46 46 54L44 62Z', '#a0522d', ' stroke="#4a2511" stroke-width="1"')
      + stroke('M40 46Q42 36 48 34M40 46Q38 36 32 34M47 38L51 34M35 38L31 35', '#4a2511', 1.4) + circle(44, 44, 3.5, '#a0522d') + stroke('M20 62V72M28 62V72M36 62V72M42 62V72', '#4a2511', 1.8),
    phoenix: () => path('M14 52Q16 36 30 34Q42 32 46 42Q40 50 28 52Z', '#16a34a', ' stroke="#064e3b" stroke-width=".8"')
      + path('M30 34Q32 24 40 22Q38 30 34 34Z', '#dc2626') + circle(38, 26, 1.3, '#111')
      + path('M14 52Q4 60 8 72Q16 62 22 54Z', '#f59e0b') + path('M22 54Q20 66 28 74Q30 62 30 54Z', '#dc2626') + path('M28 52Q34 64 42 68Q38 58 36 50Z', '#7c3aed'),
    umbrellaMan: () => path('M22 40Q34 24 50 36Z', '#c1121f', ' stroke="#7f1d1d" stroke-width="1"') + stroke('M36 34V58', '#3f2d1d', 1.4)
      + path('M28 44Q30 40 34 42L34 64L26 64Z', '#1f2937') + circle(30, 42, 3, '#f5d0a9') + stroke('M18 70Q24 64 30 70', '#65a30d', 2),
    swallow: () => path('M12 36Q26 30 36 34L48 26L42 36L50 44L36 40Q24 46 12 36Z', '#111827') + path('M30 38Q34 42 30 44Z', '#dc2626'),
    thunder: () => path('M0 0H60V90H0Z', 'rgba(30,27,75,.55)') + path('M34 14L22 44L32 44L24 74L44 36L33 36L40 14Z', '#facc15', ' stroke="#fef3c7" stroke-width="1"'),
  };

  // ---- 월별 식물 배경 ----------------------------------------------------------------------------
  const MONTH = {
    1: { bg: '#f1e6cf', plant: () => stroke('M4 84Q18 62 30 70Q44 78 56 60', '#5b3a1a', 3) + pineTuft(12, 74, 11, '#1f5130') + pineTuft(28, 70, 13, '#1f5130') + pineTuft(46, 66, 12, '#1f5130') + pineTuft(52, 80, 9, '#2d6a4f') },
    2: { bg: '#f7e7e2', plant: () => stroke('M6 86Q20 66 28 56Q36 44 54 30', '#4a2c1a', 2.6) + flower(22, 64, 6, '#e0457b', '#fde68a') + flower(34, 48, 5.5, '#f06292', '#fde68a') + flower(48, 34, 5, '#e0457b', '#fde68a') + flower(12, 78, 4.6, '#f48fb1', '#fde68a') },
    3: { bg: '#fbecf1', plant: () => stroke('M0 70Q20 60 60 72', '#6b3f2a', 2.4) + flower(10, 70, 7, '#f9a8c9', '#db2777') + flower(26, 64, 8, '#fbcfe8', '#db2777') + flower(44, 68, 7.5, '#f9a8c9', '#db2777') + flower(54, 80, 6, '#fbcfe8', '#db2777') + flower(18, 82, 6, '#fbcfe8', '#db2777') },
    4: { bg: '#ecefe2', plant: () => [8, 20, 32, 44, 54].map((x, i) => stroke(`M${x} 0Q${x + 4} ${30 + i * 4} ${x - 2} ${58 + i * 3}`, '#1f2937', 1.6) + [16, 30, 44].map((y) => leaf(x, y + i * 2, 7, 110, '#111827') + circle(x + 3, y + 6 + i * 2, 1.2, '#b91c1c')).join('')).join('') },
    5: { bg: '#eaeef7', plant: () => [10, 22, 36, 50].map((x, i) => leaf(x, 88, 30, -95 + i * 6 - 10, '#2f6f3e') + leaf(x + 3, 88, 24, -70 - i * 4, '#3f8f50')).join('') + flower(18, 58, 6, '#5b3fa0', '#fde047', 3) + flower(42, 52, 6.5, '#6d28d9', '#fde047', 3) },
    6: { bg: '#f7eaea', plant: () => leaf(8, 86, 20, -60, '#2f6f3e') + leaf(52, 86, 20, -120, '#2f6f3e') + leaf(30, 88, 18, -90, '#3f8f50') + circle(30, 66, 11, '#e11d48') + circle(24, 62, 7, '#fb7185') + circle(36, 62, 7, '#f43f5e') + circle(30, 58, 6, '#fda4af') + circle(30, 66, 3, '#fde047') },
    7: { bg: '#f4ebe4', plant: () => [10, 24, 38, 52].map((x, i) => stroke(`M${x} 90Q${x - 6} 70 ${x + 4} ${40 + i * 3}`, '#6b4f2a', 1.3) + [0, 1, 2, 3].map((k) => circle(x + (k % 2 ? 3 : -2), 52 + i * 3 + k * 8, 2.4, '#c2185b') + leaf(x, 56 + k * 8, 6, k % 2 ? -20 : 200, '#8d6e3f')).join('')).join('') },
    8: { bg: '#f6e3b8', plant: () => hill('#1c1917', 50) + [8, 18, 30, 42, 52].map((x) => stroke(`M${x} 90Q${x + 2} 72 ${x + 6} 58`, '#fef3c7', 1) + stroke(`M${x + 2} 90Q${x} 74 ${x - 4} 62`, '#fef3c7', 1)).join('') },
    9: { bg: '#f5eed8', plant: () => leaf(10, 88, 16, -70, '#3f6212') + leaf(50, 88, 16, -110, '#3f6212') + flower(20, 70, 8, '#f2b705', '#b45309', 12) + flower(42, 74, 7, '#facc15', '#b45309', 12) + flower(32, 58, 6, '#fde047', '#b45309', 10) },
    10: { bg: '#f7eadf', plant: () => stroke('M4 20Q24 30 30 50Q36 70 58 80', '#7a3b12', 1.8) + maple(12, 22, 8, '#c1121f', 0.2) + maple(28, 40, 9, '#dc2626', -0.2) + maple(44, 60, 8, '#b91c1c', 0.4) + maple(20, 70, 7, '#ef4444', 0.1) + maple(50, 80, 6, '#dc2626', -0.3) },
    11: { bg: '#e9ecf5', plant: () => path('M4 90Q2 66 16 58Q28 54 30 70Q32 84 22 90Z', '#1e293b') + path('M56 90Q60 68 46 60Q34 56 32 72Q30 84 40 90Z', '#273449') + path('M30 88Q20 70 30 62Q40 70 30 88Z', '#334155') + [0, 1, 2, 3, 4].map((k) => circle(22 + k * 4, 50 - (k % 2) * 3, 2.4, '#7b5ea7')).join('') },
    12: { bg: '#e2e8ee', plant: () => [8, 20, 34, 48].map((x, i) => stroke(`M${x} 0Q${x + 6} 30 ${x + 2} ${54 + (i % 2) * 8}`, '#4d7c0f', 1.3) + [14, 28, 42].map((y) => leaf(x + 2, y + i * 2, 8, 100, '#65a30d')).join('')).join('') + rain() },
  };

  const ANIMAL = { 2: 'warbler', 4: 'cuckoo', 5: 'bridge', 6: 'butterflies', 7: 'boar', 8: 'geese', 9: 'cup', 10: 'deer', 12: 'swallow' };
  const GWANG = { 1: ['sun', 'crane'], 3: ['curtain'], 8: ['moon'], 11: ['phoenix'], 12: ['umbrellaMan'] };
  const DAN = { 1: 'hong', 2: 'hong', 3: 'hong', 4: 'cho', 5: 'cho', 7: 'cho', 6: 'cheong', 9: 'cheong', 10: 'cheong' };

  function parse(id) {
    if (id === 'bonus-2' || id === 'bonus-3') return { bonus: true, value: id === 'bonus-3' ? 3 : 2 };
    const m = /^m(\d\d)-(gwang|animal|ribbon|ssangpi|pi\d)$/.exec(id);
    return m ? { month: Number(m[1]), part: m[2] } : null;
  }

  function body(id) {
    const c = parse(id);
    if (!c) return '';
    if (c.bonus) {
      return `<rect width="${W}" height="${H}" fill="#fef3c7"/>`
        + `<rect x="4" y="4" width="52" height="82" rx="4" fill="none" stroke="#b45309" stroke-width="1.6" stroke-dasharray="3 2"/>`
        + [0, 1, 2].slice(0, c.value).map((i) => flower(30, 30 + i * 16 - (c.value - 1) * 8 + 8, 7, '#f59e0b', '#b45309', 6)).join('')
        + `<text x="30" y="78" text-anchor="middle" font-size="8" font-weight="900" fill="#78350f" font-family="sans-serif">${c.value === 3 ? '쓰리피' : '쌍피'}</text>`
        + doubleMark(c.value);
    }
    const month = MONTH[c.month];
    if (!month) return ''; // unknown card id: no drawing (the UI falls back to text)
    let out = `<rect width="${W}" height="${H}" fill="${month.bg}"/>`;
    if (c.part === 'gwang' && c.month === 8) out = `<rect width="${W}" height="${H}" fill="#e2562f"/>`; // 공산 광: 붉은 하늘
    if (c.part === 'gwang' && c.month === 12) out = `<rect width="${W}" height="${H}" fill="#8aa0b5"/>`; // 비광: 흐린 하늘
    if (c.part === 'gwang') out += (GWANG[c.month] || []).filter((f) => f === 'sun' || f === 'moon').map((f) => FIG[f]()).join('');
    if (c.part === 'animal' && c.month === 8) out += circle(46, 16, 7, '#fff7e6', ' opacity=".85"');
    if (c.part === 'ssangpi' && c.month === 12) out += FIG.thunder();
    out += month.plant();
    if (c.part === 'gwang') out += (GWANG[c.month] || []).filter((f) => f !== 'sun' && f !== 'moon').map((f) => FIG[f]()).join('') + gwangMark();
    if (c.part === 'animal') out += FIG[ANIMAL[c.month]]();
    if (c.part === 'ribbon') out += ribbon(DAN[c.month] || null);
    if (c.part === 'ssangpi') out += doubleMark(2);
    return out;
  }

  // 한 장의 완결된 SVG 문자열(같은 카드는 한 번만 만든다).
  function svg(id) {
    if (!cache.has(id)) {
      const inner = body(id);
      cache.set(id, inner ? `<svg class="hwatuSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${inner}</svg>` : '');
    }
    return cache.get(id);
  }

  const IDS = [];
  for (let m = 1; m <= 12; m += 1) {
    const parts = { 1: ['gwang', 'ribbon', 'pi1', 'pi2'], 2: ['animal', 'ribbon', 'pi1', 'pi2'], 3: ['gwang', 'ribbon', 'pi1', 'pi2'], 4: ['animal', 'ribbon', 'pi1', 'pi2'],
      5: ['animal', 'ribbon', 'pi1', 'pi2'], 6: ['animal', 'ribbon', 'pi1', 'pi2'], 7: ['animal', 'ribbon', 'pi1', 'pi2'], 8: ['gwang', 'animal', 'pi1', 'pi2'],
      9: ['animal', 'ribbon', 'pi1', 'pi2'], 10: ['animal', 'ribbon', 'pi1', 'pi2'], 11: ['gwang', 'ssangpi', 'pi1', 'pi2'], 12: ['gwang', 'animal', 'ribbon', 'ssangpi'] }[m];
    for (const part of parts) IDS.push(`m${String(m).padStart(2, '0')}-${part}`);
  }
  IDS.push('bonus-2', 'bonus-3');

  // v1.8.6: the 48 regular cards show the public Korean hwatu pictures (public/hwatu/<id>.svg, Wikimedia Commons
  // "SVG Hwatu", CC BY-SA 4.0 -- see public/hwatu/LICENSE.md). The two bonus cards are not in that deck and keep the
  // drawing above. html(id) is what the table puts inside a card; svg(id) stays the game center drawing.
  const PUBLIC = new Set(IDS.filter(id => !id.startsWith('bonus-')));
  function html(id) {
    if (PUBLIC.has(id)) return `<img class="hwatuImg" src="/hwatu/${id}.svg" alt="" draggable="false" decoding="async">`;
    return svg(id);
  }

  window.HwatuArt = { svg, html, ids: IDS, publicIds: [...PUBLIC] };
})();
