(function (root) {
  'use strict';

  // v1.10.14: the game center runs only in Google Chrome. One classifier serves both the server (Sec-CH-UA request
  // header) and the page (navigator.userAgentData.brands); both carry the same brand list. Without client hints the
  // user-agent string is the fallback, and anything unrecognised counts as 'other' (blocked in production).
  const GREASE = /^not.a.brand$/i; // "Not A(Brand", "Not;A=Brand", ... (random filler brands)
  const OTHER_CHROMIUM = /\b(?:Edg|EdgA|EdgiOS|Edge|OPR|Opera|Whale|SamsungBrowser|YaBrowser|Vivaldi|UCBrowser|CriOS|FxiOS|Firefox)\//;

  const IOS_OTHER = /\b(?:FxiOS|OPiOS|OPT|Whale|YaBrowser|SamsungBrowser|DuckDuckGo|GSA|KAKAOTALK|NAVER|Line|FBAN|FBAV|Instagram)\b/;

  function classifyBrowser({ brands, ua = '', vendor } = {}) {
    if (Array.isArray(brands) && brands.length) {
      const names = brands.map(item => String(item?.brand ?? item)).filter(name => !GREASE.test(name));
      if (names.includes('Microsoft Edge')) return 'edge';
      if (names.includes('Google Chrome')) return 'chrome';
      // Playwright and other unbranded builds report Chromium alone (or HeadlessChrome); Brave, Opera, Whale... add their own
      return names.every(name => name === 'Chromium' || name === 'HeadlessChrome') ? 'chromium' : 'other';
    }
    ua = String(ua);
    if (/\bEdg(?:e|A|iOS)?\//.test(ua)) return 'edge';
    // v1.10.65 아이폰 허용 (IDEAS 2026-10-12): Safari and Chrome (CriOS) on an iPhone/iPad -- both WebKit underneath, and
    // there are no client hints there. Other iOS browsers and in-app views (Firefox, Whale, KakaoTalk...) stay 'other'.
    if (/\b(?:iPhone|iPad|iPod)\b/.test(ua) && /\bAppleWebKit\//.test(ua) && !IOS_OTHER.test(ua)
      && (/\bCriOS\//.test(ua) || /\bVersion\/\d[\d.]*\b.*\bSafari\//.test(ua)
        // v1.10.66: opened from the home-screen icon (standalone) the UA ends at "Mobile/…" with no Safari token; an in-app
        // view adds its own name after it (or is one of IOS_OTHER)
        || /\bMobile\/\w+$/.test(ua.trim()))) return 'ios';
    if (/\bHeadlessChrome\//.test(ua)) return 'chromium';
    if (/\bChrome\/\d/.test(ua) && !OTHER_CHROMIUM.test(ua) && (vendor === undefined || vendor === 'Google Inc.')) return 'chrome';
    return 'other';
  }

  // `"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"` -> brand names (null when the header is absent)
  function parseSecChUa(header) {
    if (!header) return null;
    const names = [...String(header).matchAll(/"((?:[^"\\]|\\.)*)"\s*;\s*v="[^"]*"/g)].map(m => m[1]);
    return names.length ? names : null;
  }

  const api = { classifyBrowser, parseSecChUa };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BrowserGate = api;
})(typeof window !== 'undefined' ? window : globalThis);
