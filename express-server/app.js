const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');

// Inicializacija baze (ustvari tabele in vstavi zacetne podatke)
require('./db/database');

const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const registrationsRoutes = require('./routes/registrations');
const notificationsRoutes = require('./routes/notifications');
const referenceRoutes = require('./routes/reference');
const statsRoutes = require('./routes/stats');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Belezenje zahtevkov
app.use((req, res, next) => {
  const cas = new Date().toISOString();
  console.log(`[${cas}] ${req.method} ${req.path}`);
  next();
});

// Poti
app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/events/:id/registrations', registrationsRoutes);
app.use('/api/events/:id/stats', statsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', referenceRoutes);

// Korenski endpoint z informacijami o API-ju
app.get('/', (req, res) => {
  res.json({
    aplikacija: 'KajDogaja – Strezniski REST API',
    verzija: '1.0.0',
    opis: 'Strezniski del aplikacije KajDogaja: avtentikacija, upravljanje dogodkov, prijave, obvestila in statistike',
    endpoints: {
      avtentikacija: {
        'POST /api/auth/register': 'Registracija novega uporabnika (vlogi: uporabnik, organizator)',
        'POST /api/auth/login': 'Prijava in pridobitev JWT zetona',
        'POST /api/auth/logout': 'Odjava (zahteva JWT)'
      },
      dogodki: {
        'GET /api/events': 'Seznam vseh dogodkov (filtriranje: mesto, datum, kategorija, iskanje, geolokacija)',
        'GET /api/events/:id': 'Podrobnosti posameznega dogodka',
        'POST /api/events': 'Ustvari nov dogodek z avtomatsko QR kodo (samo organizator)',
        'PUT /api/events/:id': 'Posodobi dogodek in obvesti prijavljene (samo lastnik)',
        'DELETE /api/events/:id': 'Izbrisi dogodek in poslje obvestila (samo lastnik)',
        'GET /api/events/:id/qr': 'Pridobi QR kodo dogodka (zahteva JWT)'
      },
      prijave: {
        'GET /api/events/:id/registrations': 'Seznam vseh prijav za dogodek (samo organizator lastnik)',
        'POST /api/events/:id/registrations': 'Prijavi uporabnika (avtomatska cakalna vrsta ce kapaciteta polna)',
        'DELETE /api/events/:id/registrations': 'Odjavi uporabnika (avtomatska promocija iz cakalne vrste)'
      },
      obvestila: {
        'GET /api/notifications': 'Seznam obvestil (filter: prebrano=true/false)',
        'PUT /api/notifications/:id/read': 'Oznaci obvestilo kot prebrano',
        'DELETE /api/notifications/:id': 'Izbrisi obvestilo'
      },
      statistike: {
        'GET /api/events/:id/stats': 'Statistike prijav: stevilo, zasedenost, cakalna vrsta, casovni graf'
      },
      referenca: {
        'GET /api/categories': 'Seznam kategorij dogodkov',
        'GET /api/cities': 'Seznam mest s koordinatami'
      }
    }
  });
});

// Obravnava neobstojecih poti
app.use((req, res) => {
  res.status(404).json({ napaka: 'Pot ne obstaja.', koda: 404 });
});

// Centralna obravnava napak
app.use((err, req, res, next) => {
  console.error('Napaka streznika:', err);
  res.status(500).json({ napaka: 'Interna napaka streznika.', koda: 500 });
});

app.listen(PORT, () => {
  console.log(`\nKajDogaja Strezniski REST API tece na http://localhost:${PORT}`);
  console.log(`Dokumentacija API: http://localhost:${PORT}/\n`);
});

module.exports = app;
