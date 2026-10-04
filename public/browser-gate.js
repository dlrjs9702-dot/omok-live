(function (root) {
  'use strict';

  // v1.10.14: the game center runs only in Google Chrome. One classifier serves both the server (Sec-CH-UA request
  // header) and the page (navigator.userAgentData.brands); both carry the same brand list. Without client hints the
  // user-agent string is the fallback, and anything unrecognised counts as 'other' (blocked in production).
  const GREASE = /^not.a.brand$/i; // "Not A(Brand", "Not;A=Brand", ... (random filler brands)
  const OTHER_CHROMIUM = /\b(?:Edg|EdgA|EdgiOS|Edge|OPR|Opera|Whale|SamsungBrowser|YaBrowser|Vivaldi|UCBrowser|CriOS|FxiOS|Firefox)\//;

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
