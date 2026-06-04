const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || process.argv[2] || 8080);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function send(res, statusCode, body, contentType) {
  res.writeHead(statusCode, { 'Content-Type': contentType || 'text/plain; charset=utf-8' });
  res.end(body);
}

function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split('?')[0]);
  const normalizedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const requestedPath = path.normalize(path.join(root, normalizedPath));

  if (!requestedPath.startsWith(root)) {
    return null;
  }

  return requestedPath;
}

const server = http.createServer((req, res) => {
  const filePath = resolveRequestPath(req.url || '/');

  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      send(res, 404, 'Not found');
      return;
    }

    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, () => {
  console.log(`GPR Portal is running at http://localhost:${port}`);
});
