'use strict';
// 잿빛 원정 실시간 전송(SSE). 20Hz로 전체 스냅샷을 보내되 느린 연결이 서버 메모리를 키우지 못하게 한다.
//  - 클라이언트별 대기 스냅샷은 1개(latest-wins): 쓰기가 막히면(res.write가 false) 최신 것만 남긴다.
//    건너뛴 스냅샷의 일회성 효과(fx: 피해 숫자, 사망 등)는 합쳐서 다음 전송에 실어 잃지 않는다.
//  - 'drain'이 오면 남은 최신 스냅샷을 바로 보낸다.
//  - maxStallMs 넘게 계속 막혀 있으면 연결을 끊는다. 브라우저가 자동 재연결하면서 전체 roomState로 재동기화한다.
const MAX_CARRIED_FX = 80;

function createRpgTransport({ maxStallMs = 5000, now = Date.now } = {}) {
  const states = new WeakMap(); // client -> { blocked, since, pending, carried }
  const stats = { sent: 0, dropped: 0, killed: 0 };

  function write(client, state, snap) {
    const body = `event: rpgTick\ndata: ${JSON.stringify(snap)}\n\n`;
    let ok;
    try { ok = client.res.write(body); } catch { return false; }
    stats.sent += 1;
    if (ok === false) {
      state.blocked = true;
      state.since = now();
      client.res.once('drain', () => flush(client, state));
    }
    return true;
  }

  function flush(client, state) {
    state.blocked = false;
    const { pending, carried } = state;
    state.pending = null; state.carried = [];
    if (pending) write(client, state, carried.length ? { ...pending, fx: [...carried, ...(pending.fx || [])] } : pending);
  }

  // clients: 방의 SSE 연결 집합. snap: engine.snapshot() 결과(모든 연결이 공유하므로 수정하지 않는다).
  function send(clients, snap) {
    for (const client of clients) {
      let state = states.get(client);
      if (!state) { state = { blocked: false, since: 0, pending: null, carried: [] }; states.set(client, state); }
      if (!state.blocked) { write(client, state, snap); continue; }
      if (now() - state.since > maxStallMs) {
        stats.killed += 1;
        try { client.res.end(); } catch {}
        clients.delete(client);
        continue;
      }
      if (state.pending) {
        stats.dropped += 1;
        state.carried = [...state.carried, ...(state.pending.fx || [])].slice(-MAX_CARRIED_FX);
      }
      state.pending = snap;
    }
  }

  return { send, stats };
}

module.exports = { createRpgTransport };
