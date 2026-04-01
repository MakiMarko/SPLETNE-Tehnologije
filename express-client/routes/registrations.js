const express = require('express');
const db = require('../db/database');
const { zahtevajAvtentikacijo } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// POST /api/events/:id/registrations – prijavi trenutnega uporabnika na dogodek
router.post('/', zahtevajAvtentikacijo, (req, res) => {
  const { id } = req.params;
  const uporabnikId = req.uporabnik.id;

  const dogodek = db.prepare('SELECT * FROM dogodki WHERE id = ?').get(id);
  if (!dogodek) {
    return res.status(404).json({ napaka: 'Dogodek ne obstaja.', koda: 404 });
  }

  const steviloPrijav = db.prepare(
    'SELECT COUNT(*) AS st FROM prijave WHERE dogodek_id = ? AND status = ?'
  ).get(id, 'potrjena').st;

  const obstojecaPrijava = db.prepare(
    'SELECT * FROM prijave WHERE uporabnik_id = ? AND dogodek_id = ?'
  ).get(uporabnikId, id);

  if (obstojecaPrijava) {
    if (obstojecaPrijava.status === 'potrjena') {
      return res.status(409).json({ napaka: 'Na ta dogodek ste ze prijavljeni.', koda: 409 });
    }
    const novStatus = (dogodek.kapaciteta > 0 && steviloPrijav >= dogodek.kapaciteta) ? 'cakalna_vrsta' : 'potrjena';
    db.prepare('UPDATE prijave SET status = ?, ustvarjena = CURRENT_TIMESTAMP WHERE id = ?').run(novStatus, obstojecaPrijava.id);
    const posodobljenaPrijava = db.prepare('SELECT * FROM prijave WHERE id = ?').get(obstojecaPrijava.id);
    return res.json({ sporocilo: 'Prijava obnovljena.', prijava: posodobljenaPrijava });
  }

  const status = (dogodek.kapaciteta > 0 && steviloPrijav >= dogodek.kapaciteta) ? 'cakalna_vrsta' : 'potrjena';

  try {
    const rezultat = db.prepare(
      'INSERT INTO prijave (uporabnik_id, dogodek_id, status) VALUES (?, ?, ?)'
    ).run(uporabnikId, id, status);

    const novaPrijava = db.prepare('SELECT * FROM prijave WHERE id = ?').get(rezultat.lastInsertRowid);
    const sporocilo = status === 'cakalna_vrsta' ? 'Dodani ste na cakalno vrsto.' : 'Prijava uspesna.';
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

  // Promotaj prvega iz cakalne vrste
  const prviCakajoci = db.prepare(
    'SELECT * FROM prijave WHERE dogodek_id = ? AND status = ? ORDER BY ustvarjena ASC LIMIT 1'
  ).get(id, 'cakalna_vrsta');

  if (prviCakajoci) {
    db.prepare('UPDATE prijave SET status = ? WHERE id = ?').run('potrjena', prviCakajoci.id);
    const dogodek = db.prepare('SELECT naziv FROM dogodki WHERE id = ?').get(id);
    db.prepare('INSERT INTO obvestila (uporabnik_id, dogodek_id, tip, vsebina) VALUES (?, ?, ?, ?)')
      .run(prviCakajoci.uporabnik_id, id, 'sprememba', `Vasa prijava na "${dogodek.naziv}" je bila potrjena.`);
  }

  return res.json({ sporocilo: 'Odjava z dogodka uspesna.' });
});

module.exports = router;
