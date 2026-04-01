const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config');
const { zahtevajAvtentikacijo } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register – registracija novega uporabnika
router.post('/register', (req, res) => {
  const { uporabnisko_ime, email, geslo, vloga } = req.body;

  if (!uporabnisko_ime || !email || !geslo) {
    return res.status(400).json({ napaka: 'Polja uporabnisko_ime, email in geslo so obvezna.', koda: 400 });
  }

  if (geslo.length < 6) {
    return res.status(400).json({ napaka: 'Geslo mora imeti vsaj 6 znakov.', koda: 400 });
  }

  const dovoljeneVloge = ['uporabnik', 'organizator'];
  const vlogaUporabnika = vloga && dovoljeneVloge.includes(vloga) ? vloga : 'uporabnik';

  const gesloHash = bcrypt.hashSync(geslo, 10);

  try {
    const stmt = db.prepare(
      'INSERT INTO uporabniki (uporabnisko_ime, email, geslo_hash, vloga) VALUES (?, ?, ?, ?)'
    );
    const rezultat = stmt.run(uporabnisko_ime, email, gesloHash, vlogaUporabnika);

    const noviUporabnik = db.prepare('SELECT id, uporabnisko_ime, email, vloga, ustvarjen FROM uporabniki WHERE id = ?').get(rezultat.lastInsertRowid);

    return res.status(201).json({ sporocilo: 'Registracija uspešna.', uporabnik: noviUporabnik });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({ napaka: 'Uporabniško ime ali e-pošta že obstajata.', koda: 409 });
    }
    return res.status(500).json({ napaka: 'Napaka strežnika.', koda: 500 });
  }
});

// POST /api/auth/login – prijava in pridobitev JWT žetona
router.post('/login', (req, res) => {
  const { email, geslo } = req.body;

  if (!email || !geslo) {
    return res.status(400).json({ napaka: 'Polja email in geslo so obvezna.', koda: 400 });
  }

  const uporabnik = db.prepare('SELECT * FROM uporabniki WHERE email = ?').get(email);
  if (!uporabnik || !bcrypt.compareSync(geslo, uporabnik.geslo_hash)) {
    return res.status(401).json({ napaka: 'Napačen e-poštni naslov ali geslo.', koda: 401 });
  }

  const zeton = jwt.sign(
    { id: uporabnik.id, uporabnisko_ime: uporabnik.uporabnisko_ime, vloga: uporabnik.vloga },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  return res.json({
    sporocilo: 'Prijava uspešna.',
    zeton,
    uporabnik: {
      id: uporabnik.id,
      uporabnisko_ime: uporabnik.uporabnisko_ime,
      email: uporabnik.email,
      vloga: uporabnik.vloga
    }
  });
});

// POST /api/auth/logout – odjava (na strani odjemalca se izbriše žeton)
router.post('/logout', zahtevajAvtentikacijo, (req, res) => {
  // JWT je stateless; odjava se izvede na strani odjemalca z brisanjem žetona
  return res.json({ sporocilo: 'Odjava uspešna. Izbrišite žeton na strani odjemalca.' });
});

module.exports = router;
