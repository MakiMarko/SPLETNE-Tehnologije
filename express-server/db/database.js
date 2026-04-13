const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'kajdogaja.db'));

// Omogoči tuje ključe
db.pragma('foreign_keys = ON');

// Ustvari tabele
db.exec(`
  CREATE TABLE IF NOT EXISTS oauth_odjemalci (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT UNIQUE NOT NULL,
    client_secret TEXT NOT NULL,
    naziv TEXT NOT NULL,
    ustvarjen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS oauth_refresh_tokeni (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    uporabnik_id INTEGER NOT NULL REFERENCES uporabniki(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    preklican INTEGER DEFAULT 0,
    potecel_dne DATETIME NOT NULL,
    ustvarjen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS uporabniki (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uporabnisko_ime TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    geslo_hash TEXT NOT NULL,
    vloga TEXT DEFAULT 'uporabnik' CHECK(vloga IN ('uporabnik', 'organizator')),
    ustvarjen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS kategorije (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naziv TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS mesta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naziv TEXT UNIQUE NOT NULL,
    koordinate_lat REAL,
    koordinate_lng REAL
  );

  CREATE TABLE IF NOT EXISTS dogodki (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    naziv TEXT NOT NULL,
    opis TEXT,
    datum DATE NOT NULL,
    ura TEXT NOT NULL,
    lokacija TEXT NOT NULL,
    koordinate_lat REAL,
    koordinate_lng REAL,
    kapaciteta INTEGER DEFAULT 0,
    qr_koda_url TEXT,
    kategorija_id INTEGER REFERENCES kategorije(id),
    mesto_id INTEGER REFERENCES mesta(id),
    organizator_id INTEGER REFERENCES uporabniki(id),
    ustvarjen DATETIME DEFAULT CURRENT_TIMESTAMP,
    posodobljen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prijave (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uporabnik_id INTEGER NOT NULL REFERENCES uporabniki(id) ON DELETE CASCADE,
    dogodek_id INTEGER NOT NULL REFERENCES dogodki(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'potrjena' CHECK(status IN ('potrjena', 'preklicana', 'cakalna_vrsta')),
    ustvarjena DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(uporabnik_id, dogodek_id)
  );

  CREATE TABLE IF NOT EXISTS obvestila (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uporabnik_id INTEGER NOT NULL REFERENCES uporabniki(id) ON DELETE CASCADE,
    dogodek_id INTEGER REFERENCES dogodki(id) ON DELETE SET NULL,
    tip TEXT NOT NULL CHECK(tip IN ('sprememba', 'odpoved', 'opomnik')),
    vsebina TEXT NOT NULL,
    prebrano INTEGER DEFAULT 0,
    ustvarjeno DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Vstavi privzetega OAuth 2.0 odjemalca, če še ne obstaja
const { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } = require('../config');
const oauthStmt = db.prepare('SELECT COUNT(*) as st FROM oauth_odjemalci');
if (oauthStmt.get().st === 0) {
  db.prepare('INSERT INTO oauth_odjemalci (client_id, client_secret, naziv) VALUES (?, ?, ?)').run(
    OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, 'KajDogaja Namizna Aplikacija'
  );
}

// Vstavi začetne podatke (kategorije in mesta), če še niso
const katStmt = db.prepare('SELECT COUNT(*) as st FROM kategorije');
if (katStmt.get().st === 0) {
  const vstaviKat = db.prepare('INSERT INTO kategorije (naziv) VALUES (?)');
  ['šport', 'kultura', 'glasba', 'festival', 'izobraževanje', 'zabava', 'narava', 'gastronomija'].forEach(k => vstaviKat.run(k));
}

const mestaStmt = db.prepare('SELECT COUNT(*) as st FROM mesta');
if (mestaStmt.get().st === 0) {
  const vstaviMesto = db.prepare('INSERT INTO mesta (naziv, koordinate_lat, koordinate_lng) VALUES (?, ?, ?)');
  [
    ['Ljubljana', 46.0569, 14.5058],
    ['Maribor', 46.5547, 15.6459],
    ['Celje', 46.2299, 15.2685],
    ['Koper', 45.5483, 13.7301],
    ['Kranj', 46.2392, 14.3556],
    ['Novo Mesto', 45.8016, 15.1715],
    ['Velenje', 46.3592, 15.1108],
    ['Murska Sobota', 46.6638, 16.1662]
  ].forEach(([naziv, lat, lng]) => vstaviMesto.run(naziv, lat, lng));
}

module.exports = db;
