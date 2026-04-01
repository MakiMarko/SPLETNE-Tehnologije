const express = require('express');
const QRCode = require('qrcode');
const db = require('../db/database');
const { zahtevajAvtentikacijo, zahtevajOrganizatorja } = require('../middleware/auth');

const router = express.Router();

// Pomožna funkcija: pridobi polne podatke o dogodku
function pridobiDogodek(id) {
  return db.prepare(`
    SELECT d.*,
           k.naziv AS kategorija_naziv,
           m.naziv AS mesto_naziv,
           m.koordinate_lat AS mesto_lat,
           m.koordinate_lng AS mesto_lng,
           u.uporabnisko_ime AS organizator_ime,
           (SELECT COUNT(*) FROM prijave WHERE dogodek_id = d.id AND status = 'potrjena') AS stevilo_prijav
    FROM dogodki d
    LEFT JOIN kategorije k ON d.kategorija_id = k.id
    LEFT JOIN mesta m ON d.mesto_id = m.id
    LEFT JOIN uporabniki u ON d.organizator_id = u.id
    WHERE d.id = ?
  `).get(id);
}

// GET /api/events – seznam vseh dogodkov s filtriranjem
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

  if (mesto) {
    sql += ' AND m.naziv LIKE ?';
    params.push(`%${mesto}%`);
  }
  if (datum) {
    sql += ' AND d.datum = ?';
    params.push(datum);
  }
  if (kategorija) {
    sql += ' AND k.naziv LIKE ?';
    params.push(`%${kategorija}%`);
  }
  if (iskanje) {
    sql += ' AND (d.naziv LIKE ? OR d.opis LIKE ? OR d.lokacija LIKE ?)';
    params.push(`%${iskanje}%`, `%${iskanje}%`, `%${iskanje}%`);
  }

  sql += ' ORDER BY d.datum ASC, d.ura ASC';

  let dogodki = db.prepare(sql).all(...params);

  // Filtriranje po razdalji (geolokacija), če sta podana lat in lng
  if (lat && lng && razdalja) {
    const rLat = parseFloat(lat);
    const rLng = parseFloat(lng);
    const maxRazdalja = parseFloat(razdalja); // v kilometrih

    dogodki = dogodki.filter(d => {
      if (!d.koordinate_lat || !d.koordinate_lng) return false;
      const km = izracunajRazdaljo(rLat, rLng, d.koordinate_lat, d.koordinate_lng);
      return km <= maxRazdalja;
    });
  }

  return res.json({ skupaj: dogodki.length, dogodki });
});

// GET /api/events/:id – podrobnosti posameznega dogodka
router.get('/:id', (req, res) => {
  const dogodek = pridobiDogodek(req.params.id);
  if (!dogodek) {
    return res.status(404).json({ napaka: 'Dogodek ne obstaja.', koda: 404 });
  }
  return res.json(dogodek);
});

// POST /api/events – ustvari nov dogodek (samo organizator)
router.post('/', zahtevajAvtentikacijo, zahtevajOrganizatorja, async (req, res) => {
  const { naziv, opis, datum, ura, lokacija, koordinate_lat, koordinate_lng, kapaciteta, kategorija_id, mesto_id } = req.body;

  if (!naziv || !datum || !ura || !lokacija) {
    return res.status(400).json({ napaka: 'Polja naziv, datum, ura in lokacija so obvezna.', koda: 400 });
  }

  try {
    // Generiraj QR kodo (data URL)
    const qrVsebina = `kajdogaja://dogodek/${Date.now()}`;
    const qrKodaUrl = await QRCode.toDataURL(qrVsebina);

    const stmt = db.prepare(`
      INSERT INTO dogodki (naziv, opis, datum, ura, lokacija, koordinate_lat, koordinate_lng, kapaciteta, qr_koda_url, kategorija_id, mesto_id, organizator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const rezultat = stmt.run(
      naziv, opis || null, datum, ura, lokacija,
      koordinate_lat || null, koordinate_lng || null,
      kapaciteta || 0, qrKodaUrl,
      kategorija_id || null, mesto_id || null,
      req.uporabnik.id
    );

    const noviDogodek = pridobiDogodek(rezultat.lastInsertRowid);
    return res.status(201).json({ sporocilo: 'Dogodek uspešno ustvarjen.', dogodek: noviDogodek });
  } catch (err) {
    return res.status(500).json({ napaka: 'Napaka pri ustvarjanju dogodka.', koda: 500 });
  }
});

// PUT /api/events/:id – posodobi dogodek (samo lastnik organizator)
router.put('/:id', zahtevajAvtentikacijo, zahtevajOrganizatorja, (req, res) => {
  const { id } = req.params;
  const dogodek = db.prepare('SELECT * FROM dogodki WHERE id = ?').get(id);

  if (!dogodek) {
    return res.status(404).json({ napaka: 'Dogodek ne obstaja.', koda: 404 });
  }
  if (dogodek.organizator_id !== req.uporabnik.id) {
    return res.status(403).json({ napaka: 'Nimate pravice urejati tega dogodka.', koda: 403 });
  }

  const { naziv, opis, datum, ura, lokacija, koordinate_lat, koordinate_lng, kapaciteta, kategorija_id, mesto_id } = req.body;

  const stmt = db.prepare(`
    UPDATE dogodki SET
      naziv = COALESCE(?, naziv),
      opis = COALESCE(?, opis),
      datum = COALESCE(?, datum),
      ura = COALESCE(?, ura),
      lokacija = COALESCE(?, lokacija),
      koordinate_lat = COALESCE(?, koordinate_lat),
      koordinate_lng = COALESCE(?, koordinate_lng),
      kapaciteta = COALESCE(?, kapaciteta),
      kategorija_id = COALESCE(?, kategorija_id),
      mesto_id = COALESCE(?, mesto_id),
      posodobljen = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(naziv, opis, datum, ura, lokacija, koordinate_lat, koordinate_lng, kapaciteta, kategorija_id, mesto_id, id);

  // Ustvari obvestila vsem prijavljenim uporabnikom o spremembi
  const prijavljeni = db.prepare('SELECT uporabnik_id FROM prijave WHERE dogodek_id = ? AND status = ?').all(id, 'potrjena');
  const vstaviObvestilo = db.prepare(
    'INSERT INTO obvestila (uporabnik_id, dogodek_id, tip, vsebina) VALUES (?, ?, ?, ?)'
  );
  const posodobljenDogodek = pridobiDogodek(id);
  prijavljeni.forEach(p => {
    vstaviObvestilo.run(p.uporabnik_id, id, 'sprememba', `Dogodek "${posodobljenDogodek.naziv}" je bil posodobljen.`);
  });

  return res.json({ sporocilo: 'Dogodek uspešno posodobljen.', dogodek: posodobljenDogodek });
});

// DELETE /api/events/:id – izbriši dogodek (samo lastnik organizator)
router.delete('/:id', zahtevajAvtentikacijo, zahtevajOrganizatorja, (req, res) => {
  const { id } = req.params;
  const dogodek = db.prepare('SELECT * FROM dogodki WHERE id = ?').get(id);

  if (!dogodek) {
    return res.status(404).json({ napaka: 'Dogodek ne obstaja.', koda: 404 });
  }
  if (dogodek.organizator_id !== req.uporabnik.id) {
    return res.status(403).json({ napaka: 'Nimate pravice brisati tega dogodka.', koda: 403 });
  }

  // Ustvari obvestila o odpovedi pred brisanjem
  const prijavljeni = db.prepare('SELECT uporabnik_id FROM prijave WHERE dogodek_id = ? AND status = ?').all(id, 'potrjena');
  const vstaviObvestilo = db.prepare(
    'INSERT INTO obvestila (uporabnik_id, dogodek_id, tip, vsebina) VALUES (?, ?, ?, ?)'
  );
  prijavljeni.forEach(p => {
    vstaviObvestilo.run(p.uporabnik_id, id, 'odpoved', `Dogodek "${dogodek.naziv}" je bil odpovedani.`);
  });

  db.prepare('DELETE FROM dogodki WHERE id = ?').run(id);
  return res.json({ sporocilo: 'Dogodek uspešno izbrisan.' });
});

// GET /api/events/:id/qr – pridobi QR kodo dogodka
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

// Haversine formula za razdaljo med dvema točkama v km
function izracunajRazdaljo(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
