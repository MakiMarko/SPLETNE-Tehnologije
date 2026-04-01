const express = require('express');
const db = require('../db/database');
const { zahtevajAvtentikacijo, zahtevajOrganizatorja } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/events/:id/registrations – seznam prijav za dogodek (samo organizator lastnik)
router.get('/', zahtevajAvtentikacijo, zahtevajOrganizatorja, (req, res) => {
  const { id } = req.params;

  const dogodek = db.prepare('SELECT * FROM dogodki WHERE id = ?').get(id);
  if (!dogodek) {
    return res.status(404).json({ napaka: 'Dogodek ne obstaja.', koda: 404 });
  }
  if (dogodek.organizator_id !== req.uporabnik.id) {
    return res.status(403).json({ napaka: 'Nimate dostopa do prijav tega dogodka.', koda: 403 });
  }

  const prijave = db.prepare(`
    SELECT p.id, p.status, p.ustvarjena,
           u.id AS uporabnik_id, u.uporabnisko_ime, u.email
    FROM prijave p
    JOIN uporabniki u ON p.uporabnik_id = u.id
    WHERE p.dogodek_id = ?
    ORDER BY p.ustvarjena ASC
  `).all(id);

  return res.json({ skupaj: prijave.length, prijave });
});

// POST /api/events/:id/registrations – prijavi trenutnega uporabnika na dogodek
router.post('/', zahtevajAvtentikacijo, (req, res) => {
  const { id } = req.params;
  const uporabnikId = req.uporabnik.id;

  const dogodek = db.prepare('SELECT * FROM dogodki WHERE id = ?').get(id);
  if (!dogodek) {
    return res.status(404).json({ napaka: 'Dogodek ne obstaja.', koda: 404 });
  }

  // Preveri, ali je kapaciteta polna
  const steviloPrijav = db.prepare(
    'SELECT COUNT(*) AS st FROM prijave WHERE dogodek_id = ? AND status = ?'
  ).get(id, 'potrjena').st;

  const obstojecaPrijava = db.prepare(
    'SELECT * FROM prijave WHERE uporabnik_id = ? AND dogodek_id = ?'
  ).get(uporabnikId, id);

  if (obstojecaPrijava) {
    if (obstojecaPrijava.status === 'potrjena') {
      return res.status(409).json({ napaka: 'Na ta dogodek ste že prijavljeni.', koda: 409 });
    }
    // Reaktiviraj preklicano prijavo
    db.prepare('UPDATE prijave SET status = ?, ustvarjena = CURRENT_TIMESTAMP WHERE id = ?')
      .run(steviloPrijav >= dogodek.kapaciteta && dogodek.kapaciteta > 0 ? 'cakalna_vrsta' : 'potrjena', obstojecaPrijava.id);
    const posodobljenaPrijava = db.prepare('SELECT * FROM prijave WHERE id = ?').get(obstojecaPrijava.id);
    return res.json({ sporocilo: 'Prijava obnovljena.', prijava: posodobljenaPrijava });
  }

  // Določi status glede na kapaciteto
  const status = (dogodek.kapaciteta > 0 && steviloPrijav >= dogodek.kapaciteta) ? 'cakalna_vrsta' : 'potrjena';

  try {
    const rezultat = db.prepare(
      'INSERT INTO prijave (uporabnik_id, dogodek_id, status) VALUES (?, ?, ?)'
    ).run(uporabnikId, id, status);

    const novaPrijava = db.prepare('SELECT * FROM prijave WHERE id = ?').get(rezultat.lastInsertRowid);
    const sporocilo = status === 'cakalna_vrsta'
      ? 'Dodani ste na čakalno vrsto.'
      : 'Prijava uspešna.';

    return res.status(201).json({ sporocilo, prijava: novaPrijava });
  } catch (err) {
    return res.status(500).json({ napaka: 'Napaka pri prijavi.', koda: 500 });
  }
});

// DELETE /api/events/:id/registrations – odjavi trenutnega uporabnika z dogodka
router.delete('/', zahtevajAvtentikacijo, (req, res) => {
  const { id } = req.params;
  const uporabnikId = req.uporabnik.id;

  const prijava = db.prepare(
    'SELECT * FROM prijave WHERE uporabnik_id = ? AND dogodek_id = ?'
  ).get(uporabnikId, id);

  if (!prijava || prijava.status === 'preklicana') {
    return res.status(404).json({ napaka: 'Prijava na ta dogodek ne obstaja.', koda: 404 });
  }

  db.prepare('UPDATE prijave SET status = ? WHERE id = ?').run('preklicana', prijava.id);

  // Preveri čakalno vrsto in potrdi prvega čakajočega
  const prviCakajoci = db.prepare(
    'SELECT * FROM prijave WHERE dogodek_id = ? AND status = ? ORDER BY ustvarjena ASC LIMIT 1'
  ).get(id, 'cakalna_vrsta');

  if (prviCakajoci) {
    db.prepare('UPDATE prijave SET status = ? WHERE id = ?').run('potrjena', prviCakajoci.id);
    // Obvestilo o potrditvi
    const dogodek = db.prepare('SELECT naziv FROM dogodki WHERE id = ?').get(id);
    db.prepare('INSERT INTO obvestila (uporabnik_id, dogodek_id, tip, vsebina) VALUES (?, ?, ?, ?)')
      .run(prviCakajoci.uporabnik_id, id, 'sprememba', `Vaša prijava na "${dogodek.naziv}" je bila potrjena.`);
  }

  return res.json({ sporocilo: 'Odjava z dogodka uspešna.' });
});

module.exports = router;
