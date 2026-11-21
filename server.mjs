import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { GeminiVisionServer } from './src/gemini-vision-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY_BYTES = 5 * 1024 * 1024; // 5MB max for camera snapshot

const vision = new GeminiVisionServer(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('حجم الصورة كبير جداً.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('صيغة البيانات المرسلة غير صالحة.'));
      }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, urlPath) {
  if (urlPath === '/api/config' && req.method === 'GET') {
    vision.reloadConfig();
    return sendJson(res, 200, vision.getStatus());
  }

  if (urlPath === '/api/config' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const status = vision.saveConfig({ apiKey: body.apiKey, model: body.model });
      return sendJson(res, 200, { ok: true, ...status });
    } catch (err) {
      return sendJson(res, 400, { ok: false, error: err.message });
    }
  }

  if (urlPath === '/api/identify' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const result = await vision.identifyImage({
        imageBase64: body.imageBase64,
        mimeType: body.mimeType || 'image/jpeg',
        mode: body.mode || 'kids',
      });
      return sendJson(res, 200, { ok: true, result });
    } catch (err) {
      const statusCode =
        err.code === 'NO_API_KEY'
          ? 400
          : err.code === 'INVALID_API_KEY'
            ? 401
            : err.code === 'QUOTA_EXCEEDED'
              ? 429
              : 500;
      return sendJson(res, statusCode, {
        ok: false,
        code: err.code || 'VISION_ERROR',
        error: err.message || 'تعذر تحليل الصورة عبر Gemini Vision.',
      });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'Endpoint not found' });
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath.startsWith('/api/')) {
    return handleApi(req, res, urlPath);
  }

  // Never serve .env or private config files
  if (urlPath.includes('.env')) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const safePath = path
    .normalize(urlPath === '/' ? '/index.html' : urlPath)
    .replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    const compressible = ['.html', '.css', '.js', '.mjs', '.json', '.webmanifest', '.svg'].includes(ext);

    if (compressible && data.length > 512 && acceptEncoding.includes('gzip')) {
      const zipped = zlib.gzipSync(data, { level: 6 });
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip',
        Vary: 'Accept-Encoding',
        'Cache-Control': 'no-cache',
      });
      res.end(zipped);
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const status = vision.getStatus();
  console.log(
    `لمسة نور (Lamsat Noor) running at http://localhost:${PORT} | API Key: ${
      status.configured ? 'Configured' : 'Not set yet'
    } | Model: ${status.model}`
  );
});
