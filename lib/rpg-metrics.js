'use strict';
// 잿빛 원정 계측: 최근 n개 표본의 p50/p95/p99. 관리자 /api/admin/rpg-metrics에서 읽는다.
function createSampler(max = 1000) {
  const samples = [];
  return {
    add(value) { samples.push(value); if (samples.length > max) samples.shift(); },
    summary() {
      if (!samples.length) return { n: 0 };
      const sorted = [...samples].sort((a, b) => a - b);
      const at = q => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] * 100) / 100;
      return { n: sorted.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: Math.round(sorted[sorted.length - 1] * 100) / 100 };
    },
  };
}
module.exports = { createSampler };
