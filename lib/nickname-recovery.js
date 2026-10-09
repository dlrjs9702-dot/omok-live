'use strict';

// Resolve only newly journaled incomplete changes. Historic successful records are never refunded.
async function recoverNicknamePayments(pointStore, accessStore) {
  const pending = await pointStore.pendingNicknameRequests();
  if (!pending.length) return { completed: 0, refunded: 0 };
  const keys = new Map((await accessStore.list()).map(key => [key.id, key]));
  const result = { completed: 0, refunded: 0 };
  for (const record of pending) {
    const request = { userId: record.userId, requestId: record.settlementId.slice('nickname:'.length), name: record.name };
    const key = keys.get(record.userId.slice('guest:'.length));
    if (key?.label === record.name) {
      if (await pointStore.completeNickname(request)) result.completed += 1;
    } else if (await pointStore.refundNickname(request)) result.refunded += 1;
  }
  return result;
}

module.exports = { recoverNicknamePayments };
