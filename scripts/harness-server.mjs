/**
 * Harness file bridge.
 *
 * The end-to-end test has to run in a browser - WebCodecs, canvas text metrics
 * and the font loader do not exist in Node. But a browser cannot read or write
 * project files. So this serves the input video to the page and accepts the
 * rendered MP4 back, which lets the whole pipeline be exercised for real
 * instead of mocked.
 *
 *   node scripts/harness-server.mjs
 */

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 5299;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Result-Name',
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  /* ---- serve repo-root files the harness needs ---- */
  const SERVE = {
    '/test.mp4': 'video/mp4',
    '/result.mp4': 'video/mp4',
    '/design.json': 'application/json',
    '/design-before.json': 'application/json',
  };
  if (req.method === 'GET' && url.pathname in SERVE) {
    const path = resolve(root, url.pathname.slice(1));
    if (!existsSync(path)) {
      res.writeHead(404, CORS);
      return res.end(`${url.pathname} not found at the repo root`);
    }
    const buf = await readFile(path);
    res.writeHead(200, {
      ...CORS,
      'Content-Type': SERVE[url.pathname],
      'Content-Length': buf.length,
    });
    return res.end(buf);
  }

  /* ---- accept the rendered result ---- */
  if (req.method === 'POST' && url.pathname === '/result') {
    const name = req.headers['x-result-name'] || 'result.mp4';
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buf = Buffer.concat(chunks);

    // Refuse to write a plainly broken file - a zero-length or tiny "MP4" means
    // the encoder failed and silently produced nothing, which is exactly the
    // failure this harness exists to catch.
    const minBytes = String(name).endsWith('.json') ? 2 : 1024;
    if (buf.length < minBytes) {
      res.writeHead(400, CORS);
      return res.end(`refused: only ${buf.length} bytes`);
    }

    const out = resolve(root, String(name).replace(/[^\w.-]/g, ''));
    await writeFile(out, buf);
    console.log(`  wrote ${out}  (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
    res.writeHead(200, { ...CORS, 'Content-Type': 'text/plain' });
    return res.end(out);
  }

  /* ---- structured log line from the page ---- */
  if (req.method === 'POST' && url.pathname === '/log') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    console.log('  ' + Buffer.concat(chunks).toString());
    res.writeHead(204, CORS);
    return res.end();
  }

  res.writeHead(404, CORS);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`harness bridge on http://localhost:${PORT}`);
  console.log(`  GET  /test.mp4   serves the source clip`);
  console.log(`  POST /result     writes the rendered MP4 to the repo root`);
});
