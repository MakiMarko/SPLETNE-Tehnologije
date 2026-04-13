/**
 * KajDogaja REST API - Node.js odjemalec
 * Avtentikacija: OAuth 2.0 Resource Owner Password Credentials (RFC 6749)
 * Testira vse metode: GET, POST, PUT, DELETE
 * Uporablja knjižnico axios
 */

const axios = require('axios');
const { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } = require('./config');

const BASE_URL = 'http://localhost:3001/api';
const OAUTH_URL = 'http://localhost:3001/oauth';

// ── OAuth 2.0 upravljanje žetonov ──────────────────────────────

/**
 * Shramba žetonov za uporabnika in organizatorja.
 * access_token  : JWT za zahtevke API
 * refresh_token : dolgoživečni žeton za pridobitev novega access_token
 * expires_at    : čas poteka v ms (Unix)
 */
const shramba = {
  uporabnik: { access_token: null, refresh_token: null, expires_at: 0 },
  organizator: { access_token: null, refresh_token: null, expires_at: 0 }
};

/**
 * Pridobi access_token prek OAuth 2.0 ROPC (password grant).
 * Vrne access_token in shrani refresh_token za kasnejšo osvežitev.
 */
async function prijaviOAuth(email, geslo, vloga) {
  const odgovor = await axios.post(
    `${OAUTH_URL}/token`,
    new URLSearchParams({
      grant_type: 'password',
      username: email,
      password: geslo,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, refresh_token, expires_in } = odgovor.data;
  shramba[vloga] = {
    access_token,
    refresh_token,
    expires_at: Date.now() + expires_in * 1000
  };

  console.log(`  → OAuth access_token shranjen (${vloga}), poteče čez ${expires_in}s`);
  console.log(`  → refresh_token shranjen za avtomatsko osvežitev`);
  return access_token;
}

/**
 * Osveži access_token z refresh_token (refresh_token grant).
 */
async function osveziToken(vloga) {
  const { refresh_token } = shramba[vloga];
  const odgovor = await axios.post(
    `${OAUTH_URL}/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const { access_token, expires_in } = odgovor.data;
  shramba[vloga].access_token = access_token;
  shramba[vloga].expires_at = Date.now() + expires_in * 1000;
  return access_token;
}

/**
 * Vrne veljavni access_token; po potrebi ga samodejno osveži.
 */
async function veljavniZeton(vloga) {
  const s = shramba[vloga];
  if (!s.access_token) return null;
  // Osveži 60 sekund pred potekom
  if (Date.now() >= s.expires_at - 60_000) {
    await osveziToken(vloga);
  }
  return s.access_token;
}

/**
 * Prekliči refresh_token (odjava – RFC 7009).
 */
async function prekliciToken(vloga) {
  const { refresh_token } = shramba[vloga];
  if (!refresh_token) return;
  await axios.post(
    `${OAUTH_URL}/revoke`,
    new URLSearchParams({
      token: refresh_token,
      client_id: OAUTH_CLIENT_ID,
      client_secret: OAUTH_CLIENT_SECRET
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  shramba[vloga] = { access_token: null, refresh_token: null, expires_at: 0 };
}

// ── Pomožne funkcije ───────────────────────────────────────────

let idDogodka = null;
let idObvestila = null;

function izpisi(naslov, podatki, napaka = false) {
  const crta = '─'.repeat(60);
  console.log(`\n${crta}`);
  console.log(napaka ? `❌ ${naslov}` : `✅ ${naslov}`);
  console.log(crta);
  console.log(JSON.stringify(podatki, null, 2));
}

async function zahtevek(metoda, pot, podatki = null, vloga = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (vloga) {
    const zeton = await veljavniZeton(vloga);
    if (zeton) headers['Authorization'] = `Bearer ${zeton}`;
  }
  try {
    const moznosti = { method: metoda, url: `${BASE_URL}${pot}`, headers };
    if (podatki !== null) moznosti.data = podatki;
    const odgovor = await axios(moznosti);
    return { uspeh: true, status: odgovor.status, podatki: odgovor.data };
  } catch (err) {
    return {
      uspeh: false,
      status: err.response?.status,
      podatki: err.response?.data || { napaka: err.message }
    };
  }
}

// ── Testne funkcije ────────────────────────────────────────────

async function testirajOAuth() {
  console.log('\n' + '═'.repeat(60));
  console.log('  1. OAUTH 2.0 – registracija in pridobitev žetonov');
  console.log('═'.repeat(60));

  // Registracija navadnega uporabnika
  const regUporabnik = await zahtevek('POST', '/auth/register', {
    uporabnisko_ime: 'testni_uporabnik',
    email: 'uporabnik@test.si',
    geslo: 'geslo123',
    vloga: 'uporabnik'
  });
  izpisi('POST /auth/register – registracija uporabnika', regUporabnik.podatki, !regUporabnik.uspeh);

  // Registracija organizatorja
  const regOrg = await zahtevek('POST', '/auth/register', {
    uporabnisko_ime: 'testni_organizator',
    email: 'organizator@test.si',
    geslo: 'geslo456',
    vloga: 'organizator'
  });
  izpisi('POST /auth/register – registracija organizatorja', regOrg.podatki, !regOrg.uspeh);

  // OAuth 2.0: pridobi žeton za uporabnika (ROPC grant)
  console.log('\n─'.repeat(60));
  console.log('  OAuth 2.0 – pridobitev access_token (grant_type=password)');
  try {
    await prijaviOAuth('uporabnik@test.si', 'geslo123', 'uporabnik');
    izpisi('POST /oauth/token – ROPC (uporabnik)', {
      access_token: '(shranjen)',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: '(shranjen)'
    });
  } catch (err) {
    izpisi('POST /oauth/token – ROPC (uporabnik)', { napaka: err.message }, true);
  }

  // OAuth 2.0: pridobi žeton za organizatorja
  try {
    await prijaviOAuth('organizator@test.si', 'geslo456', 'organizator');
    izpisi('POST /oauth/token – ROPC (organizator)', {
      access_token: '(shranjen)',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: '(shranjen)'
    });
  } catch (err) {
    izpisi('POST /oauth/token – ROPC (organizator)', { napaka: err.message }, true);
  }

  // OAuth 2.0: test napačnih poverilnic
  try {
    await axios.post(
      `${OAUTH_URL}/token`,
      new URLSearchParams({
        grant_type: 'password',
        username: 'napacen@email.si',
        password: 'napacno',
        client_id: OAUTH_CLIENT_ID,
        client_secret: OAUTH_CLIENT_SECRET
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch (err) {
    izpisi('POST /oauth/token – napačni podatki (401)', err.response?.data, false);
  }

  // OAuth 2.0: osvežitev žetona (refresh_token grant)
  console.log('\n─'.repeat(60));
  console.log('  OAuth 2.0 – osvežitev access_token (grant_type=refresh_token)');
  try {
    const noviZeton = await osveziToken('uporabnik');
    izpisi('POST /oauth/token – refresh_token grant (uporabnik)', {
      access_token: '(nov, shranjen)',
      token_type: 'Bearer',
      expires_in: 3600
    });
  } catch (err) {
    izpisi('POST /oauth/token – refresh_token grant', { napaka: err.message }, true);
  }
}

async function testirajKategorijeMesta() {
  console.log('\n' + '═'.repeat(60));
  console.log('  2. REFERENČNI PODATKI – kategorije in mesta');
  console.log('═'.repeat(60));

  const kategorije = await zahtevek('GET', '/categories');
  izpisi('GET /categories', kategorije.podatki, !kategorije.uspeh);

  const mesta = await zahtevek('GET', '/cities');
  izpisi('GET /cities', mesta.podatki, !mesta.uspeh);
}

async function testirajDogodke() {
  console.log('\n' + '═'.repeat(60));
  console.log('  3. DOGODKI – CRUD operacije');
  console.log('═'.repeat(60));

  const vsi = await zahtevek('GET', '/events');
  izpisi('GET /events – vsi dogodki', { skupaj: vsi.podatki?.skupaj }, !vsi.uspeh);

  const noviDogodek = await zahtevek('POST', '/events', {
    naziv: 'Koncert v parku',
    opis: 'Letni koncert pod zvezdami v Tivoliju.',
    datum: '2024-07-15',
    ura: '20:00',
    lokacija: 'Park Tivoli, Ljubljana',
    koordinate_lat: 46.0512,
    koordinate_lng: 14.4956,
    kapaciteta: 100,
    kategorija_id: 3,
    mesto_id: 1
  }, 'organizator');
  izpisi('POST /events – ustvari dogodek (organizator)', noviDogodek.podatki, !noviDogodek.uspeh);
  if (noviDogodek.uspeh) {
    idDogodka = noviDogodek.podatki.dogodek.id;
    console.log(`  → ID novega dogodka: ${idDogodka}`);
  }

  const neuspel = await zahtevek('POST', '/events', { naziv: 'Nedovoljen', datum: '2024-08-01', ura: '18:00', lokacija: 'Nekje' }, 'uporabnik');
  izpisi('POST /events – brez org. vloge (403)', neuspel.podatki, neuspel.uspeh);

  if (!idDogodka) return;

  const podrobnosti = await zahtevek('GET', `/events/${idDogodka}`);
  izpisi(`GET /events/${idDogodka} – podrobnosti`, { naziv: podrobnosti.podatki?.naziv }, !podrobnosti.uspeh);

  const filter = await zahtevek('GET', '/events?mesto=Ljubljana');
  izpisi('GET /events?mesto=Ljubljana', { skupaj: filter.podatki?.skupaj }, !filter.uspeh);

  const posodobi = await zahtevek('PUT', `/events/${idDogodka}`, { naziv: 'Veliki koncert v parku', kapaciteta: 150 }, 'organizator');
  izpisi(`PUT /events/${idDogodka} – posodobi`, { naziv: posodobi.podatki?.dogodek?.naziv }, !posodobi.uspeh);

  const qr = await zahtevek('GET', `/events/${idDogodka}/qr`, null, 'uporabnik');
  izpisi(`GET /events/${idDogodka}/qr – QR koda`, {
    naziv: qr.podatki?.naziv,
    qr_koda: qr.podatki?.qr_koda ? qr.podatki.qr_koda.substring(0, 50) + '...' : null
  }, !qr.uspeh);
}

async function testirajPrijave() {
  console.log('\n' + '═'.repeat(60));
  console.log('  4. PRIJAVE – registracija na dogodke');
  console.log('═'.repeat(60));

  if (!idDogodka) { console.log('  ⚠ ID dogodka ni na voljo.'); return; }

  const prijava = await zahtevek('POST', `/events/${idDogodka}/registrations`, null, 'uporabnik');
  izpisi(`POST /events/${idDogodka}/registrations – prijava`, prijava.podatki, !prijava.uspeh);

  const dvojna = await zahtevek('POST', `/events/${idDogodka}/registrations`, null, 'uporabnik');
  izpisi('POST registrations – dvojna prijava (409)', dvojna.podatki, dvojna.uspeh);

  const seznam = await zahtevek('GET', `/events/${idDogodka}/registrations`, null, 'organizator');
  izpisi(`GET /events/${idDogodka}/registrations – seznam (org.)`, { skupaj: seznam.podatki?.skupaj }, !seznam.uspeh);

  const moje = await zahtevek('GET', '/me/registrations', null, 'uporabnik');
  izpisi('GET /me/registrations – moje prijave', { skupaj: moje.podatki?.skupaj }, !moje.uspeh);

  const odjava = await zahtevek('DELETE', `/events/${idDogodka}/registrations`, null, 'uporabnik');
  izpisi(`DELETE /events/${idDogodka}/registrations – odjava`, odjava.podatki, !odjava.uspeh);
}

async function testirajProfil() {
  console.log('\n' + '═'.repeat(60));
  console.log('  5. PROFIL UPORABNIKA');
  console.log('═'.repeat(60));

  const profil = await zahtevek('GET', '/me', null, 'uporabnik');
  izpisi('GET /me – profil', profil.podatki, !profil.uspeh);

  const brezZetona = await zahtevek('GET', '/me');
  izpisi('GET /me – brez avtentikacije (401)', brezZetona.podatki, brezZetona.uspeh);
}

async function testirajObvestila() {
  console.log('\n' + '═'.repeat(60));
  console.log('  6. OBVESTILA');
  console.log('═'.repeat(60));

  const obvestila = await zahtevek('GET', '/notifications', null, 'uporabnik');
  izpisi('GET /notifications', { skupaj: obvestila.podatki?.skupaj }, !obvestila.uspeh);

  const neprebrana = await zahtevek('GET', '/notifications?prebrano=false', null, 'uporabnik');
  izpisi('GET /notifications?prebrano=false', { skupaj: neprebrana.podatki?.skupaj }, !neprebrana.uspeh);

  if (obvestila.uspeh && obvestila.podatki.obvestila?.length > 0) {
    idObvestila = obvestila.podatki.obvestila[0].id;

    const prebrano = await zahtevek('PUT', `/notifications/${idObvestila}/read`, null, 'uporabnik');
    izpisi(`PUT /notifications/${idObvestila}/read`, prebrano.podatki, !prebrano.uspeh);

    const izbrisi = await zahtevek('DELETE', `/notifications/${idObvestila}`, null, 'uporabnik');
    izpisi(`DELETE /notifications/${idObvestila}`, izbrisi.podatki, !izbrisi.uspeh);
  } else {
    console.log('\n  ⚠ Ni obvestil za testiranje PUT/DELETE.');
  }
}

async function testirajStatistike() {
  console.log('\n' + '═'.repeat(60));
  console.log('  7. STATISTIKE DOGODKOV');
  console.log('═'.repeat(60));

  if (!idDogodka) { console.log('  ⚠ ID dogodka ni na voljo.'); return; }

  const stat = await zahtevek('GET', `/events/${idDogodka}/stats`, null, 'organizator');
  izpisi(`GET /events/${idDogodka}/stats – statistike (org.)`, stat.podatki, !stat.uspeh);

  const statBrez = await zahtevek('GET', `/events/${idDogodka}/stats`, null, 'uporabnik');
  izpisi(`GET /events/${idDogodka}/stats – navadni upor. (403)`, statBrez.podatki, statBrez.uspeh);
}

async function testirajBrisanjeDogodka() {
  console.log('\n' + '═'.repeat(60));
  console.log('  8. BRISANJE DOGODKA');
  console.log('═'.repeat(60));

  if (!idDogodka) return;

  const zacasni = await zahtevek('POST', '/events', {
    naziv: 'Začasni dogodek za brisanje',
    datum: '2024-12-31',
    ura: '23:59',
    lokacija: 'Testna lokacija'
  }, 'organizator');

  if (zacasni.uspeh) {
    const idBrisanje = zacasni.podatki.dogodek.id;
    const brisi = await zahtevek('DELETE', `/events/${idBrisanje}`, null, 'organizator');
    izpisi(`DELETE /events/${idBrisanje} – izbriši dogodek`, brisi.podatki, !brisi.uspeh);
  }
}

async function testirajOdjavo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  9. ODJAVA – preklic OAuth refresh_token (RFC 7009)');
  console.log('═'.repeat(60));

  // Odjava prek klasičnega endpointa (JWT odjava na strani odjemalca)
  const odjava = await zahtevek('POST', '/auth/logout', null, 'uporabnik');
  izpisi('POST /api/auth/logout – odjava (JWT)', odjava.podatki, !odjava.uspeh);

  // OAuth preklic refresh_token za oba
  console.log('\n─'.repeat(60));
  console.log('  OAuth 2.0 – preklic refresh_token (POST /oauth/revoke)');
  try {
    await prekliciToken('uporabnik');
    izpisi('POST /oauth/revoke – preklic (uporabnik)', { sporocilo: 'Žeton je bil preklican.' });
  } catch (err) {
    izpisi('POST /oauth/revoke – napaka', { napaka: err.message }, true);
  }

  try {
    await prekliciToken('organizator');
    izpisi('POST /oauth/revoke – preklic (organizator)', { sporocilo: 'Žeton je bil preklican.' });
  } catch (err) {
    izpisi('POST /oauth/revoke – napaka', { napaka: err.message }, true);
  }
}

// ── Glavni program ─────────────────────────────────────────────

async function main() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(15) + 'KajDogaja REST API Odjemalec' + ' '.repeat(15) + '║');
  console.log('║' + ' '.repeat(10) + 'OAuth 2.0 (RFC 6749) – ROPC + Refresh Token' + ' '.repeat(5) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\nPovezujem se na: ${BASE_URL}`);

  try {
    await axios.get('http://localhost:3001/');
    console.log('✅ Strežnik je dostopen.\n');
  } catch {
    console.error('❌ Strežnik ni dostopen na http://localhost:3001');
    console.error('   Zaženite strežnik z: node app.js\n');
    process.exit(1);
  }

  try {
    await testirajOAuth();
    await testirajKategorijeMesta();
    await testirajDogodke();
    await testirajPrijave();
    await testirajProfil();
    await testirajObvestila();
    await testirajStatistike();
    await testirajBrisanjeDogodka();
    await testirajOdjavo();

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Testiranje z OAuth 2.0 zaključeno!');
    console.log('═'.repeat(60) + '\n');
  } catch (err) {
    console.error('\n❌ Kritična napaka:', err.message);
    process.exit(1);
  }
}

main();
