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
    res.end(`<!DOCTYPE html><html lang="sl"><head><meta charset="UTF-8"><title>KajDogaja - Funkcionalnosti odjemalca</title></head>
<body><h1>KajDogaja – Funkcionalnosti odjemalca</h1>
<ul>
  <li><a href="/funkcionalnosti-odjemalca/">Funkcionalnosti odjemalca</a></li>
  <li><a href="/posebnosti/">Tehnicne posebnosti odjemalca</a></li>
  <li><a href="/img/uml_odjemalec.png">UML diagram primerov uporabe</a></li>
</ul></body></html>`);
  } else if (pathname === '/funkcionalnosti-odjemalca/' || pathname === '/funkcionalnosti-odjemalca') {
    sendFile(res, path.join(__dirname, 'pages', 'funkcionalnosti-odjemalca.html'), 'text/html; charset=utf-8');
  } else if (pathname === '/posebnosti/' || pathname === '/posebnosti') {
    sendFile(res, path.join(__dirname, 'texts', 'posebnosti.txt'), 'text/plain; charset=utf-8');
  } else if (pathname === '/img/uml_odjemalec.png') {
    sendFile(res, path.join(__dirname, 'img', 'uml_odjemalec.png'), 'image/png');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Napaka 404: Stran ne obstaja.');
  }
});

server.listen(PORT, () => {
  console.log(`Dokumentacijski streznik na: http://localhost:${PORT}`);
  console.log(`  /funkcionalnosti-odjemalca/  – opis funkcionalnosti odjemalca`);
  console.log(`  /posebnosti/                 – tehnicne zahteve odjemalca`);
  console.log(`  /img/uml_odjemalec.png       – UML diagram`);
});
