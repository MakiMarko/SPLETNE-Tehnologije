const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');

// Inicializacija baze (ustvari tabele in vstavi začetne podatke)
require('./db/database');

const oauthRoutes = require('./routes/oauth');
const authRoutes = require('./routes/auth');
const eventsRoutes = require('./routes/events');
const registrationsRoutes = require('./routes/registrations');
const meRoutes = require('./routes/me');
const notificationsRoutes = require('./routes/notifications');
const referenceRoutes = require('./routes/reference');
const statsRoutes = require('./routes/stats');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Beleženje zahtevkov
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
app.use('/api/events/:id/stats', statsRoutes);
app.use('/api/me', meRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api', referenceRoutes);

// Korenski endpoint z informacijami o API-ju
app.get('/', (req, res) => {
  res.json({
    aplikacija: 'KajDogaja REST API',
    verzija: '1.0.0',
    opis: 'REST API za upravljanje lokalnih dogodkov',
    endpoints: {
      oauth2: {
        'POST /oauth/token': 'Pridobi access_token (grant_type: password | refresh_token)',
        'POST /oauth/revoke': 'Prekliči refresh_token (RFC 7009)'
      },
      avtentikacija: {
        'POST /api/auth/register': 'Registracija novega uporabnika',
        'POST /api/auth/login': 'Prijava in pridobitev JWT žetona',
        'POST /api/auth/logout': 'Odjava (zahteva JWT)'
      },
      dogodki: {
        'GET /api/events': 'Seznam vseh dogodkov (filtriranje: mesto, datum, kategorija, iskanje, lat/lng/razdalja)',
        'GET /api/events/:id': 'Podrobnosti posameznega dogodka',
        'POST /api/events': 'Ustvari nov dogodek (samo organizator)',
        'PUT /api/events/:id': 'Posodobi dogodek (samo lastnik)',
        'DELETE /api/events/:id': 'Izbriši dogodek (samo lastnik)',
        'GET /api/events/:id/qr': 'Pridobi QR kodo (zahteva JWT)'
      },
      prijave: {
        'GET /api/events/:id/registrations': 'Seznam prijav za dogodek (samo organizator lastnik)',
        'POST /api/events/:id/registrations': 'Prijavi trenutnega uporabnika',
        'DELETE /api/events/:id/registrations': 'Odjavi trenutnega uporabnika'
      },
      profil: {
        'GET /api/me': 'Profil trenutnega uporabnika',
        'GET /api/me/registrations': 'Moje prijave na dogodke'
      },
      obvestila: {
        'GET /api/notifications': 'Seznam obvestil (filter: prebrano=true/false)',
        'PUT /api/notifications/:id/read': 'Označi kot prebrano',
        'DELETE /api/notifications/:id': 'Izbriši obvestilo'
      },
      statistike: {
        'GET /api/events/:id/stats': 'Statistike prijav za dogodek (samo organizator lastnik)'
      },
      referenca: {
        'GET /api/categories': 'Seznam kategorij',
        'GET /api/cities': 'Seznam mest s koordinatami'
      }
    }
  });
});

// Obravnava neobstoječih poti
app.use((req, res) => {
  res.status(404).json({ napaka: 'Pot ne obstaja.', koda: 404 });
});

// Centralna obravnava napak
app.use((err, req, res, next) => {
  console.error('Napaka strežnika:', err);
  res.status(500).json({ napaka: 'Interna napaka strežnika.', koda: 500 });
});

app.listen(PORT, () => {
  console.log(`\nKajDogaja REST API strežnik teče na http://localhost:${PORT}`);
  console.log(`Dokumentacija API: http://localhost:${PORT}/\n`);
});

module.exports = app;
