const express = require('express');
const db = require('../db/database');
const { zahtevajAvtentikacijo } = require('../middleware/auth');

const router = express.Router();

// Haversine formula za razdaljo med dvema tockama v km
function izracunajRazdaljo(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/events – seznam vseh dogodkov s filtriranjem in geolokacijo
router.get('/', (req, res) => {
  const { mesto, datum, kategorija, iskanje, lat, lng, razdalja } = req.query;

  let sql = `
    SELECT d.id, d.naziv, d.opis, d.datum, d.ura, d.lokacija,
           d.koordinate_lat, d.koordinate_lng, d.kapaciteta,
           k.naziv AS kategorija, m.naziv AS mesto,
           u.uporabnisko_ime AS organizator,
           (SELECT COUNT(*) FROM prijave WHERE dogodek_id = d.id AND status = 'potrjena') AS stevilo_prijav
    FROM dogodki d
    LEFT JOIN kategorije k ON d.kategorija_id = k.id
    LEFT JOIN mesta m ON d.mesto_id = m.id
    LEFT JOIN uporabniki u ON d.organizator_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (mesto) { sql += ' AND m.naziv LIKE ?'; params.push(`%${mesto}%`); }
  if (datum) { sql += ' AND d.datum = ?'; params.push(datum); }
  if (kategorija) { sql += ' AND k.naziv LIKE ?'; params.push(`%${kategorija}%`); }
  if (iskanje) {
    sql += ' AND (d.naziv LIKE ? OR d.opis LIKE ? OR d.lokacija LIKE ?)';
    params.push(`%${iskanje}%`, `%${iskanje}%`, `%${iskanje}%`);
  }

  sql += ' ORDER BY d.datum ASC, d.ura ASC';

  let dogodki = db.prepare(sql).all(...params);

  // Filtriranje po razdalji (geolokacija)
  if (lat && lng && razdalja) {
    const rLat = parseFloat(lat);
    const rLng = parseFloat(lng);
    const maxRazdalja = parseFloat(razdalja);

    dogodki = dogodki.filter(d => {
      if (!d.koordinate_lat || !d.koordinate_lng) return false;
      return izracunajRazdaljo(rLat, rLng, d.koordinate_lat, d.koordinate_lng) <= maxRazdalja;
    });
  }

  return res.json({ skupaj: dogodki.length, dogodki });
});

// GET /api/events/:id – podrobnosti posameznega dogodka
router.get('/:id', (req, res) => {
  const dogodek = db.prepare(`
    SELECT d.*,
           k.naziv AS kategorija_naziv,
           m.naziv AS mesto_naziv,
           u.uporabnisko_ime AS organizator_ime,
           (SELECT COUNT(*) FROM prijave WHERE dogodek_id = d.id AND status = 'potrjena') AS stevilo_prijav
    FROM dogodki d
    LEFT JOIN kategorije k ON d.kategorija_id = k.id
    LEFT JOIN mesta m ON d.mesto_id = m.id
    LEFT JOIN uporabniki u ON d.organizator_id = u.id
    WHERE d.id = ?
  `).get(req.params.id);

  if (!dogodek) {
    return res.status(404).json({ napaka: 'Dogodek ne obstaja.', koda: 404 });
  }
  return res.json(dogodek);
});

// GET /api/events/:id/qr – pridobi QR kodo dogodka (zahteva prijavo)
router.get('/:id/qr', zahtevajAvtentikacijo, (req, res) => {
  const dogodek = db.prepare('SELECT id, naziv, qr_koda_url FROM dogodki WHERE id = ?').get(req.params.id);

  if (!dogodek) {
    return res.status(404).json({ napaka: 'Dogodek ne obstaja.', koda: 404 });
  }
  if (!dogodek.qr_koda_url) {
    return res.status(404).json({ napaka: 'QR koda za ta dogodek ni na voljo.', koda: 404 });
  }

  return res.json({ id: dogodek.id, naziv: dogodek.naziv, qr_koda: dogodek.qr_koda_url });
});

module.exports = router;
