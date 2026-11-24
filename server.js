// Node.js 18+ | Local app server
// Run: npm start
// Open: http://localhost:4173
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  fs.readFile(filename, (error, data) => {
    if (error) { response.writeHead(404).end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    response.end(data);
  });
});
const port = Number(process.env.PORT) || 4173;
server.listen(port, '0.0.0.0', () => console.log(`快递取件：http://localhost:${port}`));
