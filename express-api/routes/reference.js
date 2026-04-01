const express = require('express');
const db = require('../db/database');

const router = express.Router();

// GET /api/categories – seznam kategorij
router.get('/categories', (req, res) => {
  const kategorije = db.prepare('SELECT * FROM kategorije ORDER BY naziv ASC').all();
  return res.json({ skupaj: kategorije.length, kategorije });
});

// GET /api/cities – seznam mest s koordinatami
router.get('/cities', (req, res) => {
  const mesta = db.prepare('SELECT * FROM mesta ORDER BY naziv ASC').all();
  return res.json({ skupaj: mesta.length, mesta });
});

// GET /api/events/:id/stats – statistike prijav za dogodek (samo organizator lastnik)
router.get('/events/:id/stats', (req, res) => {
  // Opomba: ta pot je dodana v app.js z ustreznim middleware
  // Tu je samo referenca – dejanska implementacija je v app.js
});

module.exports = router;
