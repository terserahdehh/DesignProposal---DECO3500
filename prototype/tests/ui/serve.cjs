// Serve the production export with the same /phone rewrites as Vercel.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../dist');
const { rewrites, cleanUrls } = require('../../vercel.json');
http.createServer((request, response) => {
  const route = new URL(request.url, 'http://localhost').pathname;
  let target = rewrites.find(rule => rule.source === route)?.destination || route;
  // Vercel removes HTML extensions from its routing filesystem before rewrites.
  if (cleanUrls && target.endsWith('.html')) { response.writeHead(404).end(); return; }
  if (target === '/') target = '/index.html';
  const file = path.resolve(root, `.${target}`);
  if (!file.startsWith(`${root}${path.sep}`)) { response.writeHead(403).end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream');
    response.end(bytes);
  });
}).listen(8091, '127.0.0.1');
