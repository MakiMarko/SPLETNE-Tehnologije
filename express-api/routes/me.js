const express = require('express');
const db = require('../db/database');
const { zahtevajAvtentikacijo } = require('../middleware/auth');

const router = express.Router();

// GET /api/me – profil trenutnega uporabnika
router.get('/', zahtevajAvtentikacijo, (req, res) => {
  const uporabnik = db.prepare(
    'SELECT id, uporabnisko_ime, email, vloga, ustvarjen FROM uporabniki WHERE id = ?'
  ).get(req.uporabnik.id);

  if (!uporabnik) {
    return res.status(404).json({ napaka: 'Uporabnik ne obstaja.', koda: 404 });
  }

  return res.json(uporabnik);
});

// GET /api/me/registrations – moje prijave na dogodke
router.get('/registrations', zahtevajAvtentikacijo, (req, res) => {
  const { status } = req.query;

  let sql = `
    SELECT p.id AS prijava_id, p.status, p.ustvarjena,
           d.id AS dogodek_id, d.naziv, d.datum, d.ura, d.lokacija,
           k.naziv AS kategorija, m.naziv AS mesto
    FROM prijave p
    JOIN dogodki d ON p.dogodek_id = d.id
    LEFT JOIN kategorije k ON d.kategorija_id = k.id
    LEFT JOIN mesta m ON d.mesto_id = m.id
    WHERE p.uporabnik_id = ?
  `;
  const params = [req.uporabnik.id];

  if (status) {
    sql += ' AND p.status = ?';
    params.push(status);
  }

  sql += ' ORDER BY d.datum ASC';

  const prijave = db.prepare(sql).all(...params);
  return res.json({ skupaj: prijave.length, prijave });
});

module.exports = router;
