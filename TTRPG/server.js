/**
 * TTRPG Companion — Local Server + API Proxy
 * Zero dependencies (Node.js built-ins only).
 * Usage: node server.js
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT_START = 8080;
const DIR = __dirname;
const PID_FILE = path.join(DIR, '.ttrpg_server.pid');

// ── MIME ──────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
};

// ── Hop-by-hop headers to strip ──────────────────────
const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host', 'x-proxy-target',
]);

// ── Clean stale servers ──────────────────────────────
function killStaleServers() {
  if (process.platform !== 'win32') return;
  try {
    const out = execSync('netstat -ano', { timeout: 5000, encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      for (let p = PORT_START; p < PORT_START + 20; p++) {
        if (line.includes(`127.0.0.1:${p}`) || line.includes(`0.0.0.0:${p}`)) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (/^\d+$/.test(pid)) pids.add(pid);
          break;
        }
      }
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid}`, { timeout: 3000 });
        console.log(`  已清理旧进程 PID:${pid}`);
      } catch (_) {}
    }
  } catch (_) {}
}

// ── Find free port ───────────────────────────────────
function findFreePort(start) {
  for (let p = start; p < start + 20; p++) {
    try {
      const s = require('net').createServer();
      s.listen(p, '127.0.0.1');
      s.close();
      return p;
    } catch (_) {}
  }
  return start;
}

// ── PID file ─────────────────────────────────────────
function writePid(port) {
  try { fs.writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, port })); } catch (_) {}
}
function removePid() {
  try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch (_) {}
}

// ── Static file serve ────────────────────────────────
function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const ct = MIME[ext] || 'application/octet-stream';
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': ct });
    res.end(data);
  } catch (_) {
    res.writeHead(404);
    res.end('Not Found');
  }
}

// ── API Proxy ────────────────────────────────────────
function proxyRequest(req, res, target) {
  const url = new URL(target);
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;

  // Build upstream headers
  const upstreamHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) upstreamHeaders[k] = v;
  }

  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    const bodyBuf = Buffer.concat(body);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: { ...upstreamHeaders, 'Content-Length': bodyBuf.length },
      timeout: 120000,
    };

    const proxyReq = transport.request(options, proxyRes => {
      const resHeaders = {};
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (!HOP_BY_HOP.has(k.toLowerCase())) resHeaders[k] = v;
      }
      resHeaders['X-Proxy-Source'] = 'upstream';
      res.writeHead(proxyRes.statusCode, resHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      console.error(`  [PROXY] error: ${err.message}`);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'application/json', 'X-Proxy-Source': 'proxy' });
      }
      res.end(JSON.stringify({ error: { message: err.message, code: 502 } }));
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: { message: 'Gateway Timeout', code: 504 } }));
    });

    if (bodyBuf.length) proxyReq.write(bodyBuf);
    proxyReq.end();
  });
}

// ── Server ───────────────────────────────────────────
killStaleServers();
const port = findFreePort(PORT_START);
const url = `http://127.0.0.1:${port}/index.html`;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization, x-api-key, x-proxy-target, anthropic-version');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/__ttrpg_ping__') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'X-TTRPG-Server': '1' });
    res.end('ttrpg-server ok');
    return;
  }

  // API proxy
  if (req.method === 'POST' && req.url === '/api/proxy') {
    const target = req.headers['x-proxy-target'];
    if (!target) {
      res.writeHead(400);
      res.end('Missing X-Proxy-Target header');
      return;
    }
    console.log(`  [PROXY] → ${target}`);
    proxyRequest(req, res, target);
    return;
  }

  // Static files
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';
  const safePath = path.normalize(reqPath).replace(/^[/\\]+/, '');
  const filePath = path.join(DIR, safePath);
  if (!filePath.startsWith(DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  serveStatic(res, filePath);
});

server.listen(port, '127.0.0.1', () => {
  writePid(port);
  process.on('exit', removePid);
  process.on('SIGINT', () => { removePid(); process.exit(0); });
  process.on('SIGTERM', () => { removePid(); process.exit(0); });

  console.log('');
  console.log('  🎲 跑团助手 TTRPG Companion');
  console.log('  ─────────────────────────────');
  console.log(`  服务地址: ${url}`);
  console.log('  按 Ctrl+C 或关闭此窗口退出');
  console.log('');

  // Open browser
  const { exec } = require('child_process');
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
});
