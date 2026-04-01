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
    res.end(`<!DOCTYPE html><html lang="sl"><head><meta charset="UTF-8"><title>KajDogaja - Funkcionalnosti streznika</title></head>
<body><h1>KajDogaja – Funkcionalnosti streznika</h1>
<ul>
  <li><a href="/funkcionalnosti-streznika/">Funkcionalnosti streznika</a></li>
  <li><a href="/posebnosti/">Tehnicne posebnosti streznika</a></li>
</ul></body></html>`);
  } else if (pathname === '/funkcionalnosti-streznika/' || pathname === '/funkcionalnosti-streznika') {
    sendFile(res, path.join(__dirname, 'pages', 'funkcionalnosti-streznika.html'), 'text/html; charset=utf-8');
  } else if (pathname === '/posebnosti/' || pathname === '/posebnosti') {
    sendFile(res, path.join(__dirname, 'texts', 'posebnosti.txt'), 'text/plain; charset=utf-8');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Napaka 404: Stran ne obstaja.');
  }
});

server.listen(PORT, () => {
  console.log(`Dokumentacijski streznik na: http://localhost:${PORT}`);
  console.log(`  /funkcionalnosti-streznika/  – opis strezniskih funkcionalnosti`);
  console.log(`  /posebnosti/                 – tehnicne zahteve streznika`);
});
