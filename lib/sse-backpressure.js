'use strict';

// Writes one SSE frame unless the socket is already backed up (`writableNeedDrain`: its buffer passed the
// high-water mark because the client reads slower than we send). Only for frames that are safe to drop
// because the next one supersedes them (the 20 Hz 잿빛 원정 snapshot). Returns whether it was written.
function writeUnlessBacklogged(res, payload) {
  if (res.writableNeedDrain || res.destroyed || res.writableEnded) return false;
  try { res.write(payload); return true; } catch { return false; }
}

module.exports = { writeUnlessBacklogged };
