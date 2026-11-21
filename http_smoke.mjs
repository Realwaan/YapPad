import assert from 'node:assert/strict';
import { createServer } from './server.mjs';

const server = createServer();

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const paths = [
    '/',
    '/index.html',
    '/styles.css',
    '/js/audio.js',
    '/js/moods.js',
    '/js/grammar.js',
    '/js/ai.js',
    '/js/modals.js',
    '/js/ragebait.js',
    '/js/app.js',
    '/health'
  ];

  for (const p of paths) {
    const res = await fetch(`${baseUrl}${p}`);
    assert.equal(res.status, 200, `Expected HTTP 200 for ${p}, got ${res.status}`);
    const body = await res.text();
    assert.ok(body.length > 10, `Expected non-empty body for ${p}`);
  }

  const traversalRes = await fetch(`${baseUrl}/..%2fpackage.json`);
  assert.ok([400, 403, 404].includes(traversalRes.status), 'Path traversal must be blocked');

  console.log('HTTP_SMOKE_TEST_PASSED');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
