import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from './main.ts';
import { createStatic } from './static.ts';

/** A raw request: fetch() would normalize `..` and `%2e%2e` before sending. */
const raw = (port: number, path: string, method = 'GET', headers: Record<string, string> = {}) =>
  new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end();
  });

describe('8.6 game files served by the server', () => {
  const port = 26770 + Math.floor(Math.random() * 100);
  const parent = mkdtempSync(join(tmpdir(), 'cinecards-static-'));
  const dir = join(parent, 'dist');
  let server: Awaited<ReturnType<typeof startServer>>;

  beforeAll(async () => {
    mkdirSync(join(dir, 'assets'), { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>CineCards</title>');
    writeFileSync(join(dir, 'assets', 'app-abc123.js'), 'console.log(1);');
    writeFileSync(join(dir, 'assets', 'app-abc123.css'), 'body{}');
    writeFileSync(join(dir, 'assets', 'font-x1.woff2'), 'w');
    writeFileSync(join(dir, 'assets', 'card-x1.webp'), 'p');
    writeFileSync(join(dir, 'icon.svg'), '<svg/>');
    writeFileSync(join(dir, 'manifest.webmanifest'), '{}');
    writeFileSync(join(parent, 'secret.txt'), 'secret');
    server = await startServer(port, undefined, { dataDir: ':memory:', clientDir: dir });
  });
  afterAll(async () => {
    await server.gracefullyShutdown(false);
    rmSync(parent, { recursive: true, force: true });
  });

  it('serves index.html at / without caching, with the safety headers', async () => {
    const r = await raw(port, '/');
    expect(r.status).toBe(200);
    expect(r.body).toContain('<title>CineCards</title>');
    expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(r.headers['cache-control']).toBe('no-cache');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['referrer-policy']).toBe('same-origin');
    expect((await raw(port, '/index.html')).headers['cache-control']).toBe('no-cache');
  });

  it('gives fingerprinted assets their type and a long cache', async () => {
    const js = await raw(port, '/assets/app-abc123.js');
    expect(js.status).toBe(200);
    expect(js.body).toBe('console.log(1);');
    expect(js.headers['content-type']).toBe('text/javascript; charset=utf-8');
    expect(js.headers['content-length']).toBe(String('console.log(1);'.length));
    expect(js.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((await raw(port, '/assets/app-abc123.css')).headers['content-type']).toBe('text/css; charset=utf-8');
    expect((await raw(port, '/assets/font-x1.woff2')).headers['content-type']).toBe('font/woff2');
    expect((await raw(port, '/assets/card-x1.webp')).headers['content-type']).toBe('image/webp');
    expect((await raw(port, '/icon.svg')).headers['content-type']).toBe('image/svg+xml');
    expect((await raw(port, '/manifest.webmanifest')).headers['content-type']).toBe('application/manifest+json; charset=utf-8');
  });

  it('answers HEAD with the headers and no body', async () => {
    const r = await raw(port, '/assets/app-abc123.js', 'HEAD');
    expect(r.status).toBe(200);
    expect(r.headers['content-length']).toBe('15');
    expect(r.body).toBe('');
  });

  it('falls back to index.html for paths without an extension, 404 for a missing file', async () => {
    for (const p of ['/salle-xyz', '/?salle=AB12C', '/salle/AB12C?x=1']) {
      const r = await raw(port, p);
      expect(r.status, p).toBe(200);
      expect(r.body, p).toContain('<title>CineCards</title>');
    }
    const missing = await raw(port, '/manque.js');
    expect(missing.status).toBe(404);
    expect(missing.headers['x-content-type-options']).toBe('nosniff');
  });

  it('never reads outside the client folder', async () => {
    for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/..%2f..%2fsecret.txt', '/%2E%2E%2Fsecret.txt', '/index.html%00.js', '/%00', '/%E0%A4%A']) {
      const r = await raw(port, p);
      expect(r.status, p).toBe(404);
      expect(r.body, p).not.toContain('secret');
    }
  });

  it('leaves /health, /api, matchmaking and other methods to the server', async () => {
    expect((await raw(port, '/health')).body).toBe('ok');
    const api = await raw(port, '/api/health');
    expect(JSON.parse(api.body)).toMatchObject({ ok: true, accounts: true });
    expect((await raw(port, '/api/nothing')).status).toBe(404);
    expect((await raw(port, '/api/nothing')).body).toContain('not_found');
    // Colyseus' matchmaking answers in JSON, not with the game's index.html
    const mm = await fetch(`http://127.0.0.1:${port}/matchmake/create/nope`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    expect(await mm.text()).not.toContain('<title>CineCards</title>');
    const mmGet = await raw(port, '/matchmake/create/nope');
    expect(mmGet.body).not.toContain('<title>CineCards</title>');
    expect((await raw(port, '/__healthcheck')).body).not.toContain('<title>CineCards</title>');
    expect((await raw(port, '/', 'POST')).body).not.toContain('<title>CineCards</title>');
  });
});

describe('8.6 no game files without CLIENT_DIR', () => {
  it('is inert when the folder is unset, missing or has no index.html', () => {
    const empty = mkdtempSync(join(tmpdir(), 'cinecards-empty-'));
    try {
      for (const d of [undefined, '', join(empty, 'nope'), empty]) {
        const handler = createStatic(d);
        expect(handler({ method: 'GET', url: '/', headers: {} } as http.IncomingMessage, {} as http.ServerResponse)).toBe(false);
      }
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
