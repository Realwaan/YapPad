import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from './server.mjs';

const server = createServer();

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

function rawGetStatus(reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method: 'GET', path: reqPath },
      (res) => {
        res.resume();
        res.on('end', () => resolve(res.statusCode));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

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

  const blockedPaths = [
    '/../',
    '/../etc/passwd',
    '/%2e%2e/',
    '/..%2fpackage.json',
    '/js/../../etc/passwd',
    '/.env',
    '/.git/config'
  ];

  for (const badPath of blockedPaths) {
    const status = await rawGetStatus(badPath);
    assert.ok(
      [400, 403, 404].includes(status),
      `Path traversal / hidden file must be blocked for ${badPath}, got ${status}`
    );
  }

  console.log('HTTP_SMOKE_TEST_PASSED');
} finally {
  await new Promise((resolve) => server.close(resolve));
}
