const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');

// Inicializacija baze
require('./db/database');

const oauthRoutes = require('./routes/oauth');
const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const registrationsRoutes = require('./routes/registrations');
const meRoutes = require('./routes/me');
const notificationsRoutes = require('./routes/notifications');
const referenceRoutes = require('./routes/reference');

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
app.use('/oauth', oauthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/events/:id/registrations', registrationsRoutes);
app.use('/api/me', meRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', referenceRoutes);

// Korenski endpoint
app.get('/', (req, res) => {
  res.json({
    aplikacija: 'KajDogaja – Odjemalski REST API',
    verzija: '1.0.0',
    opis: 'Odjemalski del aplikacije KajDogaja: iskanje dogodkov, prijave, profil, obvestila',
    endpoints: {
      oauth2: {
        'POST /oauth/token': 'Pridobi access_token (grant_type: password | refresh_token)',
        'POST /oauth/revoke': 'Preklici refresh_token (RFC 7009)'
      },
      avtentikacija: {
        'POST /api/auth/register': 'Registracija novega uporabnika',
        'POST /api/auth/login': 'Prijava in pridobitev JWT zetona',
        'POST /api/auth/logout': 'Odjava'
      },
      dogodki: {
        'GET /api/events': 'Seznam dogodkov (filtri: mesto, datum, kategorija, iskanje, lat/lng/razdalja)',
        'GET /api/events/:id': 'Podrobnosti posameznega dogodka',
        'GET /api/events/:id/qr': 'Pridobi QR kodo dogodka (zahteva JWT)'
      },
      prijave: {
        'POST /api/events/:id/registrations': 'Prijavi se na dogodek',
        'DELETE /api/events/:id/registrations': 'Odjavi se z dogodka'
      },
      profil: {
        'GET /api/me': 'Profil trenutnega uporabnika',
        'GET /api/me/registrations': 'Moje prijave (filter: status)'
      },
      obvestila: {
        'GET /api/notifications': 'Seznam obvestil (filter: prebrano=true/false)',
        'PUT /api/notifications/:id/read': 'Oznaci kot prebrano',
        'DELETE /api/notifications/:id': 'Izbrisi obvestilo'
      },
      referenca: {
        'GET /api/categories': 'Seznam kategorij',
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
  console.log(`\nKajDogaja Odjemalski REST API tece na http://localhost:${PORT}`);
  console.log(`Dokumentacija API: http://localhost:${PORT}/\n`);
});

module.exports = app;
