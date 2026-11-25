import http from 'node:http';
import { readFile, writeFile, mkdir, rm, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.dirname(fileURLToPath(import.meta.url));
const allowed = new Set(['/', '/index.html', '/styles.css', '/app.js', '/core.mjs', '/favicon.svg']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 4173);
const REPO = 'fei33fei/NikiPuzzle';
const BRANCH = 'main';
const REPO_URL = 'https://github.com/' + REPO;
const UPDATE_FILES = ['index.html', 'app.js', 'core.mjs', 'styles.css', 'server.mjs', 'favicon.svg', 'package.json', 'README.md'];

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(payload));
}

async function localVersion() {
  try { return String(JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')).version || '0.0.0'); }
  catch { return '0.0.0'; }
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map(v => parseInt(v, 10) || 0);
  const pb = String(b).split('.').map(v => parseInt(v, 10) || 0);
  for (let i = 0; i < 3; i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x < y ? -1 : 1; }
  return 0;
}

async function remoteInfo() {
  const sources = [
    { url: 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/package.json', kind: 'branch' },
    { url: 'https://api.github.com/repos/' + REPO + '/releases/latest', kind: 'release' }
  ];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, { headers: { 'User-Agent': 'NikiPuzzle', Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) continue;
      const data = await response.json();
      if (source.kind === 'branch') {
        const version = String(data.version || '');
        if (version) return { version, source: 'branch', url: REPO_URL + '/commits/' + BRANCH, notes: '', publishedAt: null };
      } else {
        const version = String(data.tag_name || '').replace(/^v/, '');
        if (version) return { version, source: 'release', url: data.html_url || REPO_URL + '/releases', notes: String(data.body || ''), publishedAt: data.published_at || null };
      }
    } catch { }
  }
  return null;
}

function readTarString(block, start, length) {
  let end = start;
  while (end < start + length && block[end] !== 0) end++;
  return block.toString('utf8', start, end);
}

// Minimal tar.gz reader: enough for GitHub source archives, no dependencies.
async function extractTarGz(buffer, dest) {
  const tar = zlib.gunzipSync(buffer);
  const files = [];
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    let blank = true;
    for (const byte of header) if (byte !== 0) { blank = false; break; }
    if (blank) break;
    const name = readTarString(header, 0, 100);
    const prefix = readTarString(header, 345, 155);
    const sizeField = readTarString(header, 124, 12).trim();
    const size = sizeField ? parseInt(sizeField, 8) : 0;
    const type = String.fromCharCode(header[156]);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    offset = dataStart + Math.ceil(size / 512) * 512;
    if (type !== '0' && type !== '\u0000') continue;
    const parts = (prefix ? prefix + '/' + name : name).split('/');
    const relative = parts.slice(1).join('/');
    if (!relative || relative.startsWith('/') || relative.split('/').includes('..')) continue;
    const target = path.join(dest, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, tar.subarray(dataStart, dataEnd));
    files.push(relative);
  }
  return files;
}

async function installUpdate() {
  const url = 'https://codeload.github.com/' + REPO + '/tar.gz/refs/heads/' + BRANCH;
  const response = await fetch(url, { headers: { 'User-Agent': 'NikiPuzzle' }, signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error('下载更新失败（HTTP ' + response.status + '）');
  const buffer = Buffer.from(await response.arrayBuffer());
  const temp = path.join(root, '.update-tmp');
  await rm(temp, { recursive: true, force: true });
  await mkdir(temp, { recursive: true });
  try {
    await extractTarGz(buffer, temp);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = path.join(root, '.update-backup', stamp);
    const installed = [];
    for (const name of UPDATE_FILES) {
      const source = path.join(temp, name);
      if (!existsSync(source)) continue;
      const target = path.join(root, name);
      if (existsSync(target)) {
        await mkdir(backup, { recursive: true });
        await copyFile(target, path.join(backup, name));
      }
      await copyFile(source, target);
      installed.push(name);
    }
    if (!installed.length) throw new Error('更新包里没有可安装的文件');
    return { installed, backup: path.relative(root, backup) };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

function restartServer() {
  setTimeout(() => {
    if (server.closeAllConnections) server.closeAllConnections();
    server.close(() => {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], { detached: true, stdio: 'ignore', cwd: root });
      child.unref();
      setTimeout(() => process.exit(0), 250);
    });
  }, 400);
}

async function handleApi(req, res, url) {
  const origin = req.headers.origin;
  if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (url.pathname === '/api/ping' && req.method === 'GET') { json(res, 200, { ok: true, version: await localVersion() }); return; }
  if (url.pathname === '/api/version' && req.method === 'GET') { json(res, 200, { version: await localVersion(), repo: REPO_URL }); return; }
  if (url.pathname === '/api/update/check' && req.method === 'GET') {
    const current = await localVersion();
    const remote = await remoteInfo();
    if (!remote) { json(res, 200, { current, available: false, repo: REPO_URL, error: '无法连接 GitHub，请检查网络后重试' }); return; }
    json(res, 200, { current, latest: remote.version, available: compareVersions(remote.version, current) > 0, repo: REPO_URL, source: remote.source, url: remote.url, notes: remote.notes, publishedAt: remote.publishedAt });
    return;
  }
  if (url.pathname === '/api/update/install' && req.method === 'POST') {
    if (req.headers['x-nikipuzzle-update'] !== '1') { res.writeHead(403); res.end('Forbidden'); return; }
    try {
      const result = await installUpdate();
      console.log('[update] installed', result.installed.join(', '));
      json(res, 200, { ok: true, installed: result.installed, backup: result.backup, restart: result.installed.includes('server.mjs') });
      if (result.installed.includes('server.mjs')) restartServer();
    } catch (error) {
      json(res, 500, { ok: false, error: error.message });
    }
    return;
  }
  res.writeHead(404); res.end('Not found');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) { await handleApi(req, res, url); return; }
  if (!allowed.has(url.pathname)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const name = url.pathname === '/' ? '/index.html' : url.pathname;
    const data = await readFile(path.join(root, name));
    res.writeHead(200, { 'Content-Type': types[path.extname(name)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'" });
    res.end(data);
  } catch { res.writeHead(500); res.end('Unable to read application file'); }
});

server.listen(port, '127.0.0.1', () => console.log('NikiPuzzle ready: http://127.0.0.1:' + port));
