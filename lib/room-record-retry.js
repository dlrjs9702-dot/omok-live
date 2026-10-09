'use strict';

// Reading the board never waits for persistence. A single background job retries transient failures.
function queueRoomRecord(room, { record, isCurrent, onSaved, onError }) {
  if (room.readRecording || room.readRecordTimer) return;
  const task = Promise.resolve().then(() => record(room)).then(saved => {
    room.readRecordAttempts = 0;
    if (saved && isCurrent()) onSaved();
  }).catch(error => {
    onError(error);
    if (!isCurrent()) return;
    const delays = [2000, 5000, 15000, 60000];
    const attempt = room.readRecordAttempts || 0;
    room.readRecordAttempts = attempt + 1;
    room.readRecordTimer = setTimeout(() => {
      room.readRecordTimer = null;
      if (isCurrent()) queueRoomRecord(room, { record, isCurrent, onSaved, onError });
    }, delays[Math.min(attempt, delays.length - 1)]);
    room.readRecordTimer.unref?.();
  }).finally(() => { if (room.readRecording === task) room.readRecording = null; });
  room.readRecording = task;
}

module.exports = { queueRoomRecord };
