'use strict';

// Only drawing uses the sender's server-aligned clock. Physics, leases and actions
// keep the actual server receipt time. Old clients and implausible clocks fall back.
function poseTime(source, previous, receivedAt) {
  if (!Number.isFinite(source) || Math.abs(source - receivedAt) > 5000) return receivedAt;
  const bounded = Math.min(source, receivedAt);
  return Math.min(receivedAt, Math.max(bounded, (previous || 0) + 1));
}
module.exports = { poseTime };
