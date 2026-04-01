const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');

// Middleware: preveri JWT žeton in nastavi req.uporabnik
function zahtevajAvtentikacijo(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ napaka: 'Manjka avtentikacijski žeton.', koda: 401 });
  }

  const zeton = authHeader.slice(7);
  try {
    const podatki = jwt.verify(zeton, JWT_SECRET);
    req.uporabnik = podatki;
    next();
  } catch {
    return res.status(401).json({ napaka: 'Neveljavni ali potekel žeton.', koda: 401 });
  }
}

// Middleware: zahteva vlogo 'organizator'
function zahtevajOrganizatorja(req, res, next) {
  if (!req.uporabnik || req.uporabnik.vloga !== 'organizator') {
    return res.status(403).json({ napaka: 'Dostop je dovoljen samo organizatorjem.', koda: 403 });
  }
  next();
}

module.exports = { zahtevajAvtentikacijo, zahtevajOrganizatorja };
