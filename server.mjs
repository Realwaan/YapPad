import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(__filename));
const PORT = Number(process.env.PORT) || 3456;
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png'
};

export function createServer() {
  return http.createServer((req, res) => {
    try {
      const rawUrl = req.url || '/';
      const parsedUrl = new URL(rawUrl, `http://${HOST}:${PORT}`);
      let pathname = decodeURIComponent(parsedUrl.pathname);

      if (pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'ok', app: 'YapPad' }));
        return;
      }

      if (pathname === '/') {
        pathname = '/index.html';
      }

      // Guard against path traversal before and after normalization
      if (pathname.includes('\0') || pathname.includes('..')) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
      }

      const candidatePath = path.resolve(ROOT_DIR, '.' + pathname);
      if (candidatePath !== ROOT_DIR && !candidatePath.startsWith(ROOT_DIR + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403 Forbidden');
        return;
      }

      fs.stat(candidatePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
          return;
        }

        const ext = path.extname(candidatePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-store'
        });

        const stream = fs.createReadStream(candidatePath);
        stream.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          }
          res.end('500 Internal Server Error');
        });
        stream.pipe(res);
      });
    } catch {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('400 Bad Request');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`YapPad server listening on http://${HOST}:${PORT}`);
  });
}
