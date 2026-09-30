'use strict';
// 서버 쪽 최소 WebSocket(RFC 6455): 텍스트 프레임만 다루고 새 의존성을 추가하지 않는다.
// 잿빛 원정 입력 전용이라 조각난 메시지는 이어 붙이되, 큰 메시지(64KB 초과)는 연결을 끊는다.
const crypto = require('node:crypto');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 64 * 1024;

function frame(opcode, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const len = body.length;
  const head = len < 126 ? Buffer.from([0x80 | opcode, len])
    : len < 65536 ? Buffer.from([0x80 | opcode, 126, len >> 8, len & 255])
      : (() => { const b = Buffer.alloc(10); b[0] = 0x80 | opcode; b[1] = 127; b.writeBigUInt64BE(BigInt(len), 2); return b; })();
  return Buffer.concat([head, body]);
}

// 업그레이드 요청을 받아들여 { send, close, onMessage, onClose } 연결을 돌려준다. 실패하면 소켓을 닫고 null.
function accept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (req.headers.upgrade?.toLowerCase() !== 'websocket' || !key || req.headers['sec-websocket-version'] !== '13') {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return null;
  }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);

  const conn = { onMessage: null, onClose: null, closed: false };
  let buffer = Buffer.alloc(0);
  let fragments = [];

  conn.send = (text) => { if (!conn.closed) socket.write(frame(0x1, text)); };
  conn.close = (code = 1000) => {
    if (conn.closed) return;
    conn.closed = true;
    try { socket.end(frame(0x8, Buffer.from([code >> 8, code & 255]))); } catch {}
    conn.onClose?.();
  };

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (buffer.length < 2) return;
      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let len = buffer[1] & 0x7f;
      let offset = 2;
      if (len === 126) { if (buffer.length < 4) return; len = buffer.readUInt16BE(2); offset = 4; }
      else if (len === 127) { if (buffer.length < 10) return; len = Number(buffer.readBigUInt64BE(2)); offset = 10; }
      if (!masked || len > MAX_PAYLOAD) return conn.close(1009); // 클라이언트 프레임은 반드시 마스크
      if (buffer.length < offset + 4 + len) return;
      const mask = buffer.subarray(offset, offset + 4);
      const data = Buffer.from(buffer.subarray(offset + 4, offset + 4 + len));
      for (let i = 0; i < data.length; i += 1) data[i] ^= mask[i & 3];
      buffer = buffer.subarray(offset + 4 + len);
      if (opcode === 0x8) return conn.close(1000);
      if (opcode === 0x9) { if (!conn.closed) socket.write(frame(0xA, data)); continue; }
      if (opcode === 0xA) continue;
      if (opcode === 0x1 || opcode === 0x0) {
        fragments.push(data);
        if (fragments.reduce((n, d) => n + d.length, 0) > MAX_PAYLOAD) return conn.close(1009);
        if (fin) { const text = Buffer.concat(fragments).toString('utf8'); fragments = []; conn.onMessage?.(text); }
      } else return conn.close(1003); // 이진 프레임은 쓰지 않는다
    }
  });
  socket.on('close', () => { if (!conn.closed) { conn.closed = true; conn.onClose?.(); } });
  socket.on('error', () => { if (!conn.closed) { conn.closed = true; conn.onClose?.(); } });
  return conn;
}

module.exports = { accept };
