'use strict';

// PostgreSQL for the store tests. With POINTS_TEST_DATABASE_URL set, that real server is used (as before). Without
// it, an in-process PGlite (real PostgreSQL compiled to WebAssembly) is started behind a local socket, so the
// PostgreSQL paths run in every `npm test` and in CI instead of being skipped. Each call starts its own database:
// test files run in parallel and drop/create the same tables, so they must never share one.
// Dev-only (devDependencies); the production server never loads this file.

const net = require('node:net');

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
  });
}

async function testDatabase() {
  if (process.env.POINTS_TEST_DATABASE_URL) return { url: process.env.POINTS_TEST_DATABASE_URL, stop: async () => {} };
  const { PGlite } = await import('@electric-sql/pglite');
  const { PGLiteSocketServer } = await import('@electric-sql/pglite-socket');
  const db = await PGlite.create();
  const port = await freePort();
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  return {
    url: `postgres://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`,
    async stop() { await server.stop().catch(() => {}); await db.close().catch(() => {}); },
  };
}

module.exports = { testDatabase };
