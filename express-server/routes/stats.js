const express = require('express');
const db = require('../db/database');
const { zahtevajAvtentikacijo, zahtevajOrganizatorja } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/events/:id/stats – statistike prijav za dogodek (samo organizator lastnik)
router.get('/', zahtevajAvtentikacijo, zahtevajOrganizatorja, (req, res) => {
  const { id } = req.params;

  const dogodek = db.prepare('SELECT * FROM dogodki WHERE id = ?').get(id);
  if (!dogodek) {
    return res.status(404).json({ napaka: 'Dogodek ne obstaja.', koda: 404 });
  }
  if (dogodek.organizator_id !== req.uporabnik.id) {
    return res.status(403).json({ napaka: 'Nimate dostopa do statistik tega dogodka.', koda: 403 });
  }

  const skupajPrijav = db.prepare('SELECT COUNT(*) AS st FROM prijave WHERE dogodek_id = ?').get(id).st;
  const potrjene = db.prepare('SELECT COUNT(*) AS st FROM prijave WHERE dogodek_id = ? AND status = ?').get(id, 'potrjena').st;
  const preklicane = db.prepare('SELECT COUNT(*) AS st FROM prijave WHERE dogodek_id = ? AND status = ?').get(id, 'preklicana').st;
  const cakalna = db.prepare('SELECT COUNT(*) AS st FROM prijave WHERE dogodek_id = ? AND status = ?').get(id, 'cakalna_vrsta').st;

  const zasedenostPct = dogodek.kapaciteta > 0
    ? Math.round((potrjene / dogodek.kapaciteta) * 100)
    : null;

  // Prijave po dneh (zadnjih 7 dni)
  const prijavePoDneh = db.prepare(`
    SELECT DATE(ustvarjena) AS dan, COUNT(*) AS prijave
    FROM prijave
    WHERE dogodek_id = ? AND ustvarjena >= DATE('now', '-7 days')
    GROUP BY dan
    ORDER BY dan ASC
  `).all(id);

  return res.json({
    dogodek_id: parseInt(id),
    naziv: dogodek.naziv,
    kapaciteta: dogodek.kapaciteta,
    statistike: {
      skupaj_prijav: skupajPrijav,
      potrjene,
      preklicane,
      cakalna_vrsta: cakalna,
      zasedenost_procent: zasedenostPct
    },
    prijave_po_dneh: prijavePoDneh
  });
});

module.exports = router;
