/**
 * OAuth 2.0 Token Endpoint (RFC 6749)
 * Podprti tipi dodelitve (grant_type):
 *   - password           : Resource Owner Password Credentials
 *   - refresh_token      : Osvežitev dostopnega žetona
 * Preklic žetona (RFC 7009):
 *   - POST /oauth/revoke
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db/database');
const { JWT_SECRET, ACCESS_TOKEN_EXPIRES, REFRESH_TOKEN_EXPIRES_DAYS } = require('../config');

const router = express.Router();

// Sprejem application/x-www-form-urlencoded in JSON
router.use(express.urlencoded({ extended: false }));

// ── Pomožni funkciji ──────────────────────────────────────────

function ustvariAccessToken(uporabnik) {
  return jwt.sign(
    { id: uporabnik.id, uporabnisko_ime: uporabnik.uporabnisko_ime, vloga: uporabnik.vloga },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
}

function ustvariRefreshToken(uporabnikId, clientId) {
  const token = crypto.randomBytes(32).toString('hex');
  const potecelDne = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  db.prepare(
    'INSERT INTO oauth_refresh_tokeni (token, uporabnik_id, client_id, potecel_dne) VALUES (?, ?, ?, ?)'
  ).run(token, uporabnikId, clientId, potecelDne);
  return token;
}

function preveriOdjemalca(clientId, clientSecret) {
  const odjemalec = db.prepare('SELECT * FROM oauth_odjemalci WHERE client_id = ?').get(clientId);
  return odjemalec && odjemalec.client_secret === clientSecret ? odjemalec : null;
}

// ── POST /oauth/token ─────────────────────────────────────────

router.post('/token', (req, res) => {
  const { grant_type, username, password, refresh_token, client_id, client_secret } = req.body;

  if (!grant_type) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Polje grant_type je obvezno.' });
  }

  // Preveritev odjemalca
  if (!preveriOdjemalca(client_id, client_secret)) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Neveljaven client_id ali client_secret.' });
  }

  // ── Grant type: password (Resource Owner Password Credentials) ──
  if (grant_type === 'password') {
    if (!username || !password) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Polja username in password so obvezna.' });
    }

    const uporabnik = db.prepare('SELECT * FROM uporabniki WHERE email = ?').get(username);
    if (!uporabnik || !bcrypt.compareSync(password, uporabnik.geslo_hash)) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Napačno uporabniško ime ali geslo.' });
    }

    const accessToken = ustvariAccessToken(uporabnik);
    const refreshToken = ustvariRefreshToken(uporabnik.id, client_id);

    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_EXPIRES,
      refresh_token: refreshToken,
      scope: 'read write'
    });
  }

  // ── Grant type: refresh_token ──
  if (grant_type === 'refresh_token') {
    if (!refresh_token) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Polje refresh_token je obvezno.' });
    }

    const zapisTokena = db.prepare(
      'SELECT * FROM oauth_refresh_tokeni WHERE token = ? AND client_id = ? AND preklican = 0'
    ).get(refresh_token, client_id);

    if (!zapisTokena) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Neveljaven ali preklican refresh_token.' });
    }

    if (new Date(zapisTokena.potecel_dne) < new Date()) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Refresh token je potekel.' });
    }

    const uporabnik = db.prepare('SELECT * FROM uporabniki WHERE id = ?').get(zapisTokena.uporabnik_id);
    if (!uporabnik) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Uporabnik ne obstaja več.' });
    }

    // Izda nov access token; refresh token ostane nespremenjen
    const accessToken = ustvariAccessToken(uporabnik);

    return res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_EXPIRES,
      refresh_token: refresh_token,
      scope: 'read write'
    });
  }

  return res.status(400).json({
    error: 'unsupported_grant_type',
    error_description: `Grant type '${grant_type}' ni podprt. Podprti: password, refresh_token.`
  });
});

// ── POST /oauth/revoke (RFC 7009) ─────────────────────────────

router.post('/revoke', (req, res) => {
  const { token, client_id, client_secret } = req.body;

  if (!preveriOdjemalca(client_id, client_secret)) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Neveljaven client_id ali client_secret.' });
  }

  if (!token) {
    return res.status(400).json({ error: 'invalid_request', error_description: 'Polje token je obvezno.' });
  }

  // Preklični refresh token; access tokeni so JWT in se ne morejo preklicati brez blockliste
  db.prepare(
    'UPDATE oauth_refresh_tokeni SET preklican = 1 WHERE token = ? AND client_id = ?'
  ).run(token, client_id);

  // RFC 7009: vedno vrni 200 OK
  return res.json({ sporocilo: 'Žeton je bil preklican.' });
});

module.exports = router;
