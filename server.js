const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;

function sendFile(res, filePath, contentType, statusCode = 200) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Napaka 404: Datoteka ni bila najdena.');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Napaka 500: Prišlo je do napake na strežniku.');
            }
            return;
        }

        res.writeHead(statusCode, { 'Content-Type': contentType });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (pathname === '/') {
        const homePage = `
<!DOCTYPE html>
<html lang="sl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KajDogaja - Domov</title>
    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: linear-gradient(135deg, #eef3ff 0%, #f8fbff 100%);
            color: #1f2937;
        }

        .page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
        }

        .card {
            width: 100%;
            max-width: 950px;
            background: #ffffff;
            border-radius: 22px;
            padding: 40px;
            box-shadow: 0 18px 45px rgba(31, 60, 136, 0.12);
            border: 1px solid #e5eaf5;
        }

        .badge {
            display: inline-block;
            background: #e8efff;
            color: #1f3c88;
            font-size: 0.9rem;
            font-weight: 700;
            padding: 8px 14px;
            border-radius: 999px;
            margin-bottom: 18px;
        }

        h1 {
            margin: 0 0 12px 0;
            font-size: 2.4rem;
            color: #1f3c88;
            letter-spacing: -0.02em;
        }

        .subtitle {
            margin: 0 0 30px 0;
            font-size: 1.05rem;
            line-height: 1.7;
            color: #4b5563;
            max-width: 760px;
        }

        .section-title {
            margin: 34px 0 14px 0;
            font-size: 1.2rem;
            color: #1f3c88;
        }

        .routes {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 18px;
            margin-top: 18px;
        }

        .route-card {
            background: #f8faff;
            border: 1px solid #dbe5ff;
            border-radius: 16px;
            padding: 18px;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .route-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(31, 60, 136, 0.08);
        }

        .route-card a {
            text-decoration: none;
            color: inherit;
            display: block;
        }

        .route-path {
            display: inline-block;
            font-family: Consolas, Monaco, monospace;
            font-size: 0.95rem;
            background: #eef2ff;
            color: #1f3c88;
            padding: 6px 10px;
            border-radius: 10px;
            margin-bottom: 10px;
        }

        .route-title {
            margin: 0 0 8px 0;
            font-size: 1.05rem;
            color: #111827;
        }

        .route-desc {
            margin: 0;
            color: #4b5563;
            line-height: 1.6;
            font-size: 0.95rem;
        }

        .footer-note {
            margin-top: 34px;
            padding-top: 18px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 0.95rem;
            line-height: 1.6;
        }

        code {
            background: #eef2ff;
            color: #1f3c88;
            padding: 2px 6px;
            border-radius: 6px;
            font-family: Consolas, Monaco, monospace;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="card">
            <h1>KajDogaja</h1>

            <h2 class="section-title">Povezave</h2>

            <div class="routes">
                <div class="route-card">
                    <a href="/funkcionalnosti-odjemalca/">
                        <div class="route-path">/funkcionalnosti-odjemalca/</div>
                        <h3 class="route-title">Funkcionalnosti odjemalca</h3>
                        <p class="route-desc">
                            HTML dokument z opisom uporabniških funkcionalnosti aplikacije KajDogaja
                            ter vključenim UML diagramom primerov uporabe.
                        </p>
                    </a>
                </div>

                <div class="route-card">
                    <a href="/posebnosti/">
                        <div class="route-path">/posebnosti/</div>
                        <h3 class="route-title">Tehnične posebnosti</h3>
                        <p class="route-desc">
                            Tekstovna predstavitev tehničnih zahtev odjemalskega dela, uporabe kamere,
                            geolokacije, offline podpore in drugih posebnosti implementacije.
                        </p>
                    </a>
                </div>

                <div class="route-card">
                    <a href="/funkcionalnosti-streznika/">
                        <div class="route-path">/funkcionalnosti-streznika/</div>
                        <h3 class="route-title">Funkcionalnosti strežnika</h3>
                        <p class="route-desc">
                            HTML dokument z opisom strežniških funkcionalnosti, kot so
                            JWT avtentikacija, upravljanje dogodkov, QR kode, obvestila in statistika.
                        </p>
                    </a>
                </div>

                <div class="route-card">
                    <a href="/tehnicne-zahteve-streznika/">
                        <div class="route-path">/tehnicne-zahteve-streznika/</div>
                        <h3 class="route-title">Tehnične zahteve strežnika</h3>
                        <p class="route-desc">
                            Tekstovni dokument z uporabo tehnologij Express, JWT, bcrypt,
                            knjižnice za QR generiranje in podatkovne baze.
                        </p>
                    </a>
                </div>

                <div class="route-card">
                    <a href="/podatkovni-model/">
                        <div class="route-path">/podatkovni-model/</div>
                        <h3 class="route-title">Podatkovni model</h3>
                        <p class="route-desc">
                            HTML dokument z entitetami, atributi, relacijami, dostopnostjo podatkov
                            (naprava / strežnik / sinhronizacija) in ER diagramom.
                        </p>
                    </a>
                </div>

                <div class="route-card">
                    <a href="/REST/">
                        <div class="route-path">/REST/</div>
                        <h3 class="route-title">REST API</h3>
                        <p class="route-desc">
                            Tekstovni dokument z naborom REST storitev in metod za podporo
                            hibridne namizne aplikacije.
                        </p>
                    </a>
                </div>

                <div class="route-card">
                    <a href="/img/uml_odjemalec.png">
                        <div class="route-path">/img/uml_odjemalec.png</div>
                        <h3 class="route-title">UML diagram</h3>
                        <p class="route-desc">
                            Neposreden dostop do slike UML diagrama primerov uporabe za odjemalski del aplikacije.
                        </p>
                    </a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(homePage);
    }
    else if (pathname === '/funkcionalnosti-odjemalca/' || pathname === '/funkcionalnosti-odjemalca') {
        const filePath = path.join(__dirname, 'pages', 'funkcionalnosti-odjemalca.html');
        sendFile(res, filePath, 'text/html; charset=utf-8');
    }

    else if (pathname === '/funkcionalnosti-streznika/' || pathname === '/funkcionalnosti-streznika') {
        const filePath = path.join(__dirname, 'pages', 'funkcionalnosti-streznika.html');
        sendFile(res, filePath, 'text/html; charset=utf-8');
    }

    else if (pathname === '/posebnosti/' || pathname === '/posebnosti') {
        const filePath = path.join(__dirname, 'texts', 'posebnosti.txt');
        sendFile(res, filePath, 'text/plain; charset=utf-8');
    }

    else if (pathname === '/tehnicne-zahteve-streznika/' || pathname === '/tehnicne-zahteve-streznika') {
        const filePath = path.join(__dirname, 'texts', 'tehnicne-zahteve-streznika.txt');
        sendFile(res, filePath, 'text/plain; charset=utf-8');
    }

    else if (pathname === '/podatkovni-model/' || pathname === '/podatkovni-model') {
        const filePath = path.join(__dirname, 'pages', 'podatkovni-model.html');
        sendFile(res, filePath, 'text/html; charset=utf-8');
    }

    else if (pathname === '/REST/' || pathname === '/REST') {
        const filePath = path.join(__dirname, 'texts', 'rest.txt');
        sendFile(res, filePath, 'text/plain; charset=utf-8');
    }

    else if (pathname === '/img/uml_odjemalec.png') {
        const filePath = path.join(__dirname, 'img', 'uml_odjemalec.png');
        sendFile(res, filePath, 'image/png');
    }

    else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Napaka 404: Stran ne obstaja.');
    }
});

server.listen(PORT, () => {
    console.log(`Strežnik deluje na naslovu: http://localhost:${PORT}`);
});