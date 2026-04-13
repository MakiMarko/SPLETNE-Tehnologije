/**
 * KajDogaja – Strezniski REST API odjemalec
 * Avtentikacija: OAuth 2.0 Resource Owner Password Credentials (RFC 6749)
 * Testira strezniskie funkcionalnosti: CRUD dogodkov, prijave, cakalna vrsta,
 * obvestila, statistike, QR kode.
 * Uporablja knjiznico axios.
 */

const axios = require('axios');
const { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } = require('./config');

const BASE_URL = 'http://localhost:3002/api';
const OAUTH_URL = 'http://localhost:3002/oauth';

// ── OAuth 2.0 upravljanje zetonov ──────────────────────────────

const shramba = {
  organizator: { access_token: null, refresh_token: null, expires_at: 0 },
  uporabnik1:  { access_token: null, refresh_token: null, expires_at: 0 },
  uporabnik2:  { access_token: null, refresh_token: null, expires_at: 0 }
};

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
  shramba[vloga] = { access_token, refresh_token, expires_at: Date.now() + expires_in * 1000 };
  console.log(`  → OAuth access_token shranjen (${vloga}), poteče čez ${expires_in}s`);
  return access_token;
}

async function osveziToken(vloga) {
  const odgovor = await axios.post(
    `${OAUTH_URL}/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: shramba[vloga].refresh_token,
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

async function veljavniZeton(vloga) {
  const s = shramba[vloga];
  if (!s.access_token) return null;
  if (Date.now() >= s.expires_at - 60_000) await osveziToken(vloga);
  return s.access_token;
}

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

// ── Pomozne funkcije ───────────────────────────────────────────

let idDogodka = null;
let idDogodkaMalaKapaciteta = null;

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
    return { uspeh: false, status: err.response?.status, podatki: err.response?.data || { napaka: err.message } };
  }
}

// ── Testne funkcije ────────────────────────────────────────────

async function testirajAvtentikacijo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  1. OAUTH 2.0 AVTENTIKACIJA IN UPRAVLJANJE VLOG');
  console.log('═'.repeat(60));

  // Registracija
  const regOrg = await zahtevek('POST', '/auth/register', {
    uporabnisko_ime: 'org_jana', email: 'jana@organizator.si', geslo: 'geslo123', vloga: 'organizator'
  });
  izpisi('POST /auth/register – organizator', regOrg.podatki, !regOrg.uspeh);

  const regU1 = await zahtevek('POST', '/auth/register', {
    uporabnisko_ime: 'user_ana', email: 'ana@test.si', geslo: 'geslo123', vloga: 'uporabnik'
  });
  izpisi('POST /auth/register – uporabnik 1', regU1.podatki, !regU1.uspeh);

  const regU2 = await zahtevek('POST', '/auth/register', {
    uporabnisko_ime: 'user_bor', email: 'bor@test.si', geslo: 'geslo123', vloga: 'uporabnik'
  });
  izpisi('POST /auth/register – uporabnik 2', regU2.podatki, !regU2.uspeh);

  // OAuth 2.0 ROPC – pridobi zetone
  console.log('\n─'.repeat(60));
  console.log('  OAuth 2.0 – pridobitev access_token (grant_type=password)');
  try {
    await prijaviOAuth('jana@organizator.si', 'geslo123', 'organizator');
    izpisi('POST /oauth/token – organizator', { access_token: '(shranjen)', token_type: 'Bearer', expires_in: 3600, refresh_token: '(shranjen)' });
  } catch (err) {
    izpisi('POST /oauth/token – organizator', { napaka: err.message }, true);
  }

  try {
    await prijaviOAuth('ana@test.si', 'geslo123', 'uporabnik1');
    izpisi('POST /oauth/token – uporabnik 1', { access_token: '(shranjen)', token_type: 'Bearer', expires_in: 3600, refresh_token: '(shranjen)' });
  } catch (err) {
    izpisi('POST /oauth/token – uporabnik 1', { napaka: err.message }, true);
  }

  try {
    await prijaviOAuth('bor@test.si', 'geslo123', 'uporabnik2');
    izpisi('POST /oauth/token – uporabnik 2', { access_token: '(shranjen)', token_type: 'Bearer', expires_in: 3600, refresh_token: '(shranjen)' });
  } catch (err) {
    izpisi('POST /oauth/token – uporabnik 2', { napaka: err.message }, true);
  }

  // Test napacnih podatkov
  try {
    await axios.post(`${OAUTH_URL}/token`,
      new URLSearchParams({ grant_type: 'password', username: 'napacen@email.si', password: 'napacno', client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch (err) {
    izpisi('POST /oauth/token – napacni podatki (401)', err.response?.data, false);
  }

  // Dostop brez zetona
  const brezZetona = await zahtevek('POST', '/auth/logout');
  izpisi('POST /auth/logout – brez zetona (401)', brezZetona.podatki, brezZetona.uspeh);
}

async function testirajDogodke() {
  console.log('\n' + '═'.repeat(60));
  console.log('  2. CRUD DOGODKOV IN QR KODE');
  console.log('═'.repeat(60));

  const noviDogodek = await zahtevek('POST', '/events', {
    naziv: 'Jazzovski vecernik', opis: 'Glasbeni vecernik pod zvezdami.',
    datum: '2024-08-20', ura: '20:00', lokacija: 'Kongresni trg, Ljubljana',
    koordinate_lat: 46.0511, koordinate_lng: 14.5058,
    kapaciteta: 50, kategorija_id: 3, mesto_id: 1
  }, 'organizator');
  izpisi('POST /events – ustvari dogodek z QR kodo (organizator)', {
    id: noviDogodek.podatki?.dogodek?.id,
    naziv: noviDogodek.podatki?.dogodek?.naziv,
    qr_generirana: !!noviDogodek.podatki?.dogodek?.qr_koda_url
  }, !noviDogodek.uspeh);
  if (noviDogodek.uspeh) idDogodka = noviDogodek.podatki.dogodek.id;

  const malaDogodek = await zahtevek('POST', '/events', {
    naziv: 'Delavnica keramike', datum: '2024-09-01', ura: '10:00',
    lokacija: 'Kulturni center', kapaciteta: 1, kategorija_id: 5, mesto_id: 1
  }, 'organizator');
  if (malaDogodek.uspeh) idDogodkaMalaKapaciteta = malaDogodek.podatki.dogodek.id;
  izpisi('POST /events – dogdoek s kapaciteto 1', { id: idDogodkaMalaKapaciteta }, !malaDogodek.uspeh);

  const neUspel = await zahtevek('POST', '/events', { naziv: 'Neupravicen', datum: '2024-10-01', ura: '12:00', lokacija: 'Kjer koli' }, 'uporabnik1');
  izpisi('POST /events – navadni uporabnik (403)', neUspel.podatki, neUspel.uspeh);

  if (!idDogodka) return;

  const podrobnosti = await zahtevek('GET', `/events/${idDogodka}`);
  izpisi(`GET /events/${idDogodka} – podrobnosti`, { naziv: podrobnosti.podatki?.naziv }, !podrobnosti.uspeh);

  const posodobi = await zahtevek('PUT', `/events/${idDogodka}`, { naziv: 'Jazzovski vecernik (pos.)', kapaciteta: 60 }, 'organizator');
  izpisi(`PUT /events/${idDogodka} – posodobi`, { naziv: posodobi.podatki?.dogodek?.naziv }, !posodobi.uspeh);

  const qr = await zahtevek('GET', `/events/${idDogodka}/qr`, null, 'uporabnik1');
  izpisi(`GET /events/${idDogodka}/qr – QR koda`, { qr_dolzina: qr.podatki?.qr_koda?.length }, !qr.uspeh);

  const filter = await zahtevek('GET', '/events?mesto=Ljubljana&kategorija=glasba');
  izpisi('GET /events?mesto=Ljubljana&kategorija=glasba', { skupaj: filter.podatki?.skupaj }, !filter.uspeh);
}

async function testirajPrijaveInCakalnoVrsto() {
  console.log('\n' + '═'.repeat(60));
  console.log('  3. UPRAVLJANJE PRIJAV IN CAKALNA VRSTA');
  console.log('═'.repeat(60));

  if (!idDogodkaMalaKapaciteta) { console.log('  ⚠ ID dogodka z malo kapaciteto ni na voljo.'); return; }

  const prijava1 = await zahtevek('POST', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, 'uporabnik1');
  izpisi(`POST .../registrations – uporabnik 1 (potrjena)`, { status: prijava1.podatki?.prijava?.status }, !prijava1.uspeh);

  const prijava2 = await zahtevek('POST', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, 'uporabnik2');
  izpisi(`POST .../registrations – uporabnik 2 (cakalna_vrsta)`, { status: prijava2.podatki?.prijava?.status }, !prijava2.uspeh);

  const seznam = await zahtevek('GET', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, 'organizator');
  izpisi('GET .../registrations – seznam (organizator)', {
    skupaj: seznam.podatki?.skupaj,
    statusi: seznam.podatki?.prijave?.map(p => ({ ime: p.uporabnisko_ime, status: p.status }))
  }, !seznam.uspeh);

  const odjava = await zahtevek('DELETE', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, 'uporabnik1');
  izpisi('DELETE .../registrations – odjava upor. 1 (promocija upor. 2)', odjava.podatki, !odjava.uspeh);

  const seznamPo = await zahtevek('GET', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, 'organizator');
  izpisi('Stanje po promociji', {
    prijave: seznamPo.podatki?.prijave?.map(p => ({ ime: p.uporabnisko_ime, status: p.status }))
  }, !seznamPo.uspeh);

  const dvojna = await zahtevek('POST', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, 'uporabnik2');
  izpisi('POST .../registrations – dvojna prijava (409)', dvojna.podatki, dvojna.uspeh);
}

async function testirajObvestila() {
  console.log('\n' + '═'.repeat(60));
  console.log('  4. OBVESTILA (GENERIRANA S STRANI STREZNIKA)');
  console.log('═'.repeat(60));

  const obvestila = await zahtevek('GET', '/notifications', null, 'uporabnik2');
  izpisi('GET /notifications – obvestila upor. 2 (promocija)', {
    skupaj: obvestila.podatki?.skupaj,
    obvestila: obvestila.podatki?.obvestila?.map(o => ({ tip: o.tip, vsebina: o.vsebina }))
  }, !obvestila.uspeh);

  if (obvestila.uspeh && obvestila.podatki.obvestila?.length > 0) {
    const idObvestila = obvestila.podatki.obvestila[0].id;

    const prebrano = await zahtevek('PUT', `/notifications/${idObvestila}/read`, null, 'uporabnik2');
    izpisi(`PUT /notifications/${idObvestila}/read`, prebrano.podatki, !prebrano.uspeh);

    const samoPrebrana = await zahtevek('GET', '/notifications?prebrano=true', null, 'uporabnik2');
    izpisi('GET /notifications?prebrano=true', { skupaj: samoPrebrana.podatki?.skupaj }, !samoPrebrana.uspeh);

    const izbrisi = await zahtevek('DELETE', `/notifications/${idObvestila}`, null, 'uporabnik2');
    izpisi(`DELETE /notifications/${idObvestila}`, izbrisi.podatki, !izbrisi.uspeh);
  } else {
    console.log('\n  ⚠ Ni obvestil za testiranje.');
  }
}

async function testirajStatistike() {
  console.log('\n' + '═'.repeat(60));
  console.log('  5. STATISTIKE PRIJAV ZA DOGODEK');
  console.log('═'.repeat(60));

  if (!idDogodkaMalaKapaciteta) return;

  const stat = await zahtevek('GET', `/events/${idDogodkaMalaKapaciteta}/stats`, null, 'organizator');
  izpisi(`GET .../stats – statistike (organizator)`, stat.podatki, !stat.uspeh);

  const statBrez = await zahtevek('GET', `/events/${idDogodkaMalaKapaciteta}/stats`, null, 'uporabnik1');
  izpisi('GET .../stats – navadni upor. (403)', statBrez.podatki, statBrez.uspeh);
}

async function testirajBrisanje() {
  console.log('\n' + '═'.repeat(60));
  console.log('  6. BRISANJE DOGODKA IN OBVESTILA O ODPOVEDI');
  console.log('═'.repeat(60));

  if (!idDogodka) return;

  await zahtevek('POST', `/events/${idDogodka}/registrations`, null, 'uporabnik1');

  const brisi = await zahtevek('DELETE', `/events/${idDogodka}`, null, 'organizator');
  izpisi(`DELETE /events/${idDogodka} – izbrisi in poslje obvestila`, brisi.podatki, !brisi.uspeh);

  const obvestilaOdpoved = await zahtevek('GET', '/notifications', null, 'uporabnik1');
  izpisi('Obvestila o odpovedi za upor. 1', {
    skupaj: obvestilaOdpoved.podatki?.skupaj,
    tipi: obvestilaOdpoved.podatki?.obvestila?.map(o => o.tip)
  }, !obvestilaOdpoved.uspeh);
}

async function testirajReferencoInOdjavo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  7. REFERENCNI PODATKI IN ODJAVA (OAuth 2.0 preklic)');
  console.log('═'.repeat(60));

  const kategorije = await zahtevek('GET', '/categories');
  izpisi('GET /categories', { skupaj: kategorije.podatki?.skupaj }, !kategorije.uspeh);

  const mesta = await zahtevek('GET', '/cities');
  izpisi('GET /cities', { skupaj: mesta.podatki?.skupaj }, !mesta.uspeh);

  // OAuth 2.0 preklic refresh_tokenov (RFC 7009)
  console.log('\n─'.repeat(60));
  console.log('  OAuth 2.0 – preklic refresh_token (POST /oauth/revoke)');
  for (const vloga of ['organizator', 'uporabnik1', 'uporabnik2']) {
    try {
      await prekliciToken(vloga);
      izpisi(`POST /oauth/revoke – preklic (${vloga})`, { sporocilo: 'Zeton je bil preklican.' });
    } catch (err) {
      izpisi(`POST /oauth/revoke – napaka (${vloga})`, { napaka: err.message }, true);
    }
  }
}

// ── Glavni program ─────────────────────────────────────────────

async function main() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'KajDogaja – Strezniski REST API Odjemalec' + ' '.repeat(7) + '║');
  console.log('║' + ' '.repeat(8) + 'OAuth 2.0 (RFC 6749) – ROPC + Refresh Token' + ' '.repeat(7) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\nPovezujem se na: ${BASE_URL}`);

  try {
    await axios.get('http://localhost:3002/');
    console.log('✅ Streznik je dostopen.\n');
  } catch {
    console.error('❌ Streznik ni dostopen na http://localhost:3002');
    console.error('   Zazenite streznik z: node app.js\n');
    process.exit(1);
  }

  try {
    await testirajAvtentikacijo();
    await testirajDogodke();
    await testirajPrijaveInCakalnoVrsto();
    await testirajObvestila();
    await testirajStatistike();
    await testirajBrisanje();
    await testirajReferencoInOdjavo();

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Testiranje strezniskih funkcionalnosti z OAuth 2.0 zakljuceno!');
    console.log('═'.repeat(60) + '\n');
  } catch (err) {
    console.error('\n❌ Kriticna napaka:', err.message);
    process.exit(1);
  }
}

main();
