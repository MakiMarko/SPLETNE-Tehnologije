const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

function sendFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Napaka 404: Datoteka ni bila najdena.');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;

  if (pathname === '/' || pathname === '') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html lang="sl"><head><meta charset="UTF-8"><title>KajDogaja - Podatkovni model</title></head>
<body><h1>KajDogaja – Podatkovni model & REST API</h1>
<ul>
  <li><a href="/podatkovni-model/">Podatkovni model</a></li>
  <li><a href="/REST/">REST API specifikacija</a></li>
</ul></body></html>`);
  } else if (pathname === '/podatkovni-model/' || pathname === '/podatkovni-model') {
    sendFile(res, path.join(__dirname, 'pages', 'podatkovni-model.html'), 'text/html; charset=utf-8');
  } else if (pathname === '/REST/' || pathname === '/REST') {
    sendFile(res, path.join(__dirname, 'texts', 'rest.txt'), 'text/plain; charset=utf-8');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Napaka 404: Stran ne obstaja.');
  }
});

server.listen(PORT, () => {
  console.log(`Dokumentacijski streznik na: http://localhost:${PORT}`);
  console.log(`  /podatkovni-model/  – podatkovni model`);
  console.log(`  /REST/              – REST API specifikacija`);
});
