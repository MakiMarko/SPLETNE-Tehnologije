const express = require('express');
const db = require('../db/database');
const { zahtevajAvtentikacijo } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications – seznam obvestil trenutnega uporabnika
router.get('/', zahtevajAvtentikacijo, (req, res) => {
  const { prebrano } = req.query;

  let sql = `
    SELECT o.id, o.tip, o.vsebina, o.prebrano, o.ustvarjeno,
           d.id AS dogodek_id, d.naziv AS dogodek_naziv
    FROM obvestila o
    LEFT JOIN dogodki d ON o.dogodek_id = d.id
    WHERE o.uporabnik_id = ?
  `;
  const params = [req.uporabnik.id];

  if (prebrano !== undefined) {
    sql += ' AND o.prebrano = ?';
    params.push(prebrano === 'true' || prebrano === '1' ? 1 : 0);
  }

  sql += ' ORDER BY o.ustvarjeno DESC';

  const obvestila = db.prepare(sql).all(...params);
  return res.json({ skupaj: obvestila.length, obvestila });
});

// PUT /api/notifications/:id/read – označi obvestilo kot prebrano
router.put('/:id/read', zahtevajAvtentikacijo, (req, res) => {
  const obvestilo = db.prepare(
    'SELECT * FROM obvestila WHERE id = ? AND uporabnik_id = ?'
  ).get(req.params.id, req.uporabnik.id);

  if (!obvestilo) {
    return res.status(404).json({ napaka: 'Obvestilo ne obstaja.', koda: 404 });
  }

  db.prepare('UPDATE obvestila SET prebrano = 1 WHERE id = ?').run(req.params.id);
  return res.json({ sporocilo: 'Obvestilo označeno kot prebrano.' });
});

// DELETE /api/notifications/:id – izbriši obvestilo
router.delete('/:id', zahtevajAvtentikacijo, (req, res) => {
  const obvestilo = db.prepare(
    'SELECT * FROM obvestila WHERE id = ? AND uporabnik_id = ?'
  ).get(req.params.id, req.uporabnik.id);

  if (!obvestilo) {
    return res.status(404).json({ napaka: 'Obvestilo ne obstaja.', koda: 404 });
  }

  db.prepare('DELETE FROM obvestila WHERE id = ?').run(req.params.id);
  return res.json({ sporocilo: 'Obvestilo izbrisano.' });
});

module.exports = router;
