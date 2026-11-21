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
/**
 * Zero-dependency Node HTTP static server for YapPad.
 * Serves files from the repository root on http://127.0.0.1:3456 (or PORT)
 * with strict path-traversal and dotfile protection.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT_DIR = fs.realpathSync(path.dirname(__filename));

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT) || 3456;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

/**
 * Resolve a request URL path strictly inside ROOT_DIR.
 * Returns { status, filePath? }.
 */
export function resolveSafePath(rawUrl) {
  const urlWithoutQuery = String(rawUrl || "/").split("?")[0].split("#")[0];

  // Block raw traversal patterns, backslashes, or null bytes before decoding.
  if (
    urlWithoutQuery.includes("\0") ||
    urlWithoutQuery.includes("\\") ||
    /(^|\/)\.\.(\/|$)/.test(urlWithoutQuery)
  ) {
    return { status: 403 };
  }

  let decoded;
  try {
    decoded = decodeURIComponent(urlWithoutQuery);
  } catch {
    return { status: 400 };
  }

  // Re-check decoded path for encoded traversal (%2e%2e), backslashes, or null bytes.
  if (
    decoded.includes("\0") ||
    decoded.includes("\\") ||
    /(^|\/)\.\.(\/|$)/.test(decoded)
  ) {
    return { status: 403 };
  }

  const relativePath = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");

  // Reject dotfiles / hidden segments such as .env or .git/...
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.some((seg) => seg.startsWith("."))) {
    return { status: 403 };
  }

  const candidatePath = path.resolve(ROOT_DIR, relativePath);
  const rootPrefix = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : ROOT_DIR + path.sep;
  if (candidatePath !== ROOT_DIR && !candidatePath.startsWith(rootPrefix)) {
    return { status: 403 };
  }

  let realPath;
  try {
    realPath = fs.realpathSync(candidatePath);
  } catch {
    return { status: 404 };
  }

  if (realPath !== ROOT_DIR && !realPath.startsWith(rootPrefix)) {
    return { status: 403 };
  }

  let stats;
  try {
    stats = fs.statSync(realPath);
  } catch {
    return { status: 404 };
  }

  if (stats.isDirectory()) {
    const indexCandidate = path.join(realPath, "index.html");
    if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
      return { status: 200, filePath: indexCandidate };
    }
    return { status: 403 };
  }

  if (!stats.isFile()) {
    return { status: 404 };
  }

  return { status: 200, filePath: realPath };
}

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store",
  });
  res.end(`${statusCode} ${message}\n`);
}

export function createStaticServer() {
  return http.createServer((req, res) => {
    const method = req.method || "GET";
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, {
        Allow: "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("405 Method Not Allowed\n");
      return;
    }

    const result = resolveSafePath(req.url);
    if (result.status !== 200 || !result.filePath) {
      const label =
        result.status === 400
          ? "Bad Request"
          : result.status === 403
            ? "Forbidden"
            : "Not Found";
      sendError(res, result.status, label);
      return;
    }

    const ext = path.extname(result.filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.readFile(result.filePath, (err, data) => {
      if (err) {
        sendError(res, 500, "Internal Server Error");
        return;
      }
      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": data.length,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      });
      if (method === "HEAD") {
        res.end();
      } else {
        res.end(data);
      }
    });
  });
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
  const server = createStaticServer();
  server.listen(PORT, HOST, () => {
    console.log(`YapPad server running at http://${HOST}:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
