/**
 * KajDogaja – Odjemalski REST API odjemalec
 * Avtentikacija: OAuth 2.0 Resource Owner Password Credentials (RFC 6749)
 * Testira odjemalske funkcionalnosti: iskanje in filtriranje dogodkov,
 * geolokacija, prijava na dogodke, profil, obvestila, QR kode.
 * Uporablja knjiznico axios.
 */

const axios = require('axios');
const { OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET } = require('./config');

const BASE_URL = 'http://localhost:3003/api';
const OAUTH_URL = 'http://localhost:3003/oauth';

// ── OAuth 2.0 upravljanje zetonov ──────────────────────────────

const shramba = {
  uporabnik: { access_token: null, refresh_token: null, expires_at: 0 }
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
  console.log(`  → refresh_token shranjen za avtomatsko osvežitev`);
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

async function testirajOAuth() {
  console.log('\n' + '═'.repeat(60));
  console.log('  1. OAUTH 2.0 – registracija in pridobitev zetonov');
  console.log('═'.repeat(60));

  // Registracija
  const reg = await zahtevek('POST', '/auth/register', {
    uporabnisko_ime: 'maja_k', email: 'maja@test.si', geslo: 'geslo123', vloga: 'uporabnik'
  });
  izpisi('POST /auth/register – registracija', reg.podatki, !reg.uspeh);

  // OAuth 2.0 ROPC – pridobi zeton
  console.log('\n─'.repeat(60));
  console.log('  OAuth 2.0 – pridobitev access_token (grant_type=password)');
  try {
    await prijaviOAuth('maja@test.si', 'geslo123', 'uporabnik');
    izpisi('POST /oauth/token – ROPC (uporabnik)', {
      access_token: '(shranjen)',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: '(shranjen)'
    });
  } catch (err) {
    izpisi('POST /oauth/token – napaka', { napaka: err.message }, true);
  }

  // Test napacnih podatkov
  try {
    await axios.post(`${OAUTH_URL}/token`,
      new URLSearchParams({ grant_type: 'password', username: 'napacen@email.si', password: 'napacno', client_id: OAUTH_CLIENT_ID, client_secret: OAUTH_CLIENT_SECRET }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch (err) {
    izpisi('POST /oauth/token – napacno geslo (401)', err.response?.data, false);
  }

  // Osvezitev zetona
  console.log('\n─'.repeat(60));
  console.log('  OAuth 2.0 – osvezitev access_token (grant_type=refresh_token)');
  try {
    await osveziToken('uporabnik');
    izpisi('POST /oauth/token – refresh_token grant', { access_token: '(nov, shranjen)', token_type: 'Bearer', expires_in: 3600 });
  } catch (err) {
    izpisi('POST /oauth/token – osvezitev', { napaka: err.message }, true);
  }
}

async function testirajReferencnePodatke() {
  console.log('\n' + '═'.repeat(60));
  console.log('  2. REFERENCNI PODATKI – kategorije in mesta');
  console.log('═'.repeat(60));

  const kategorije = await zahtevek('GET', '/categories');
  izpisi('GET /categories', { skupaj: kategorije.podatki?.skupaj, primeri: kategorije.podatki?.kategorije?.slice(0, 3).map(k => k.naziv) }, !kategorije.uspeh);

  const mesta = await zahtevek('GET', '/cities');
  izpisi('GET /cities', { skupaj: mesta.podatki?.skupaj, primeri: mesta.podatki?.mesta?.slice(0, 3).map(m => m.naziv) }, !mesta.uspeh);
}

async function testirajIskanjeInFiltriranje() {
  console.log('\n' + '═'.repeat(60));
  console.log('  3. ISKANJE IN FILTRIRANJE DOGODKOV');
  console.log('═'.repeat(60));

  const vsi = await zahtevek('GET', '/events');
  izpisi('GET /events – vsi dogodki', { skupaj: vsi.podatki?.skupaj }, !vsi.uspeh);
  if (vsi.uspeh && vsi.podatki.dogodki?.length > 0) idDogodka = vsi.podatki.dogodki[0].id;

  const poMestu = await zahtevek('GET', '/events?mesto=Ljubljana');
  izpisi('GET /events?mesto=Ljubljana', { skupaj: poMestu.podatki?.skupaj }, !poMestu.uspeh);

  const poKategoriji = await zahtevek('GET', '/events?kategorija=glasba');
  izpisi('GET /events?kategorija=glasba', { skupaj: poKategoriji.podatki?.skupaj }, !poKategoriji.uspeh);

  const iskanje = await zahtevek('GET', '/events?iskanje=jazz');
  izpisi('GET /events?iskanje=jazz', { skupaj: iskanje.podatki?.skupaj }, !iskanje.uspeh);

  const poDatumu = await zahtevek('GET', '/events?datum=2024-08-20');
  izpisi('GET /events?datum=2024-08-20', { skupaj: poDatumu.podatki?.skupaj }, !poDatumu.uspeh);

  const geo = await zahtevek('GET', '/events?lat=46.0569&lng=14.5058&razdalja=10');
  izpisi('GET /events?lat=46.06&lng=14.51&razdalja=10 – geolokacija', { skupaj: geo.podatki?.skupaj }, !geo.uspeh);
}

async function testirajPodrobnostiInQR() {
  console.log('\n' + '═'.repeat(60));
  console.log('  4. OGLED PODROBNOSTI IN QR KODE');
  console.log('═'.repeat(60));

  if (!idDogodka) { console.log('  ⚠ Ni razpolozljivih dogodkov.'); return; }

  const podrobnosti = await zahtevek('GET', `/events/${idDogodka}`);
  izpisi(`GET /events/${idDogodka} – podrobnosti (brez prijave)`, {
    naziv: podrobnosti.podatki?.naziv,
    datum: podrobnosti.podatki?.datum,
    lokacija: podrobnosti.podatki?.lokacija
  }, !podrobnosti.uspeh);

  const qr = await zahtevek('GET', `/events/${idDogodka}/qr`, null, 'uporabnik');
  izpisi(`GET /events/${idDogodka}/qr – QR koda (prijavljen)`, { qr_dolzina: qr.podatki?.qr_koda?.length }, !qr.uspeh);

  const qrBrez = await zahtevek('GET', `/events/${idDogodka}/qr`);
  izpisi(`GET /events/${idDogodka}/qr – brez prijave (401)`, qrBrez.podatki, qrBrez.uspeh);
}

async function testirajPrijaveNaDogodke() {
  console.log('\n' + '═'.repeat(60));
  console.log('  5. PRIJAVA NA DOGODEK IN MOJE PRIJAVE');
  console.log('═'.repeat(60));

  if (!idDogodka) { console.log('  ⚠ Ni razpolozljivih dogodkov.'); return; }

  const prijava = await zahtevek('POST', `/events/${idDogodka}/registrations`, null, 'uporabnik');
  izpisi(`POST .../registrations – prijava`, { status: prijava.podatki?.prijava?.status }, !prijava.uspeh);

  const dvojna = await zahtevek('POST', `/events/${idDogodka}/registrations`, null, 'uporabnik');
  izpisi('POST .../registrations – dvojna prijava (409)', dvojna.podatki, dvojna.uspeh);

  const mojePrijave = await zahtevek('GET', '/me/registrations', null, 'uporabnik');
  izpisi('GET /me/registrations – vse moje prijave', { skupaj: mojePrijave.podatki?.skupaj }, !mojePrijave.uspeh);

  const potrjene = await zahtevek('GET', '/me/registrations?status=potrjena', null, 'uporabnik');
  izpisi('GET /me/registrations?status=potrjena', { skupaj: potrjene.podatki?.skupaj }, !potrjene.uspeh);

  const odjava = await zahtevek('DELETE', `/events/${idDogodka}/registrations`, null, 'uporabnik');
  izpisi(`DELETE .../registrations – odjava`, odjava.podatki, !odjava.uspeh);
}

async function testirajProfil() {
  console.log('\n' + '═'.repeat(60));
  console.log('  6. PROFIL UPORABNIKA');
  console.log('═'.repeat(60));

  const profil = await zahtevek('GET', '/me', null, 'uporabnik');
  izpisi('GET /me – profil', profil.podatki, !profil.uspeh);

  const brezPrijave = await zahtevek('GET', '/me');
  izpisi('GET /me – brez prijave (401)', brezPrijave.podatki, brezPrijave.uspeh);
}

async function testirajObvestila() {
  console.log('\n' + '═'.repeat(60));
  console.log('  7. OBVESTILA');
  console.log('═'.repeat(60));

  const obvestila = await zahtevek('GET', '/notifications', null, 'uporabnik');
  izpisi('GET /notifications', { skupaj: obvestila.podatki?.skupaj }, !obvestila.uspeh);

  const neprebrana = await zahtevek('GET', '/notifications?prebrano=false', null, 'uporabnik');
  izpisi('GET /notifications?prebrano=false', { skupaj: neprebrana.podatki?.skupaj }, !neprebrana.uspeh);

  if (obvestila.uspeh && obvestila.podatki.obvestila?.length > 0) {
    const idObv = obvestila.podatki.obvestila[0].id;

    const prebrano = await zahtevek('PUT', `/notifications/${idObv}/read`, null, 'uporabnik');
    izpisi(`PUT /notifications/${idObv}/read`, prebrano.podatki, !prebrano.uspeh);

    const izbrisi = await zahtevek('DELETE', `/notifications/${idObv}`, null, 'uporabnik');
    izpisi(`DELETE /notifications/${idObv}`, izbrisi.podatki, !izbrisi.uspeh);
  } else {
    console.log('\n  ⚠ Ni obvestil za testiranje.');
  }
}

async function testirajOdjavo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  8. ODJAVA – preklic OAuth refresh_token (RFC 7009)');
  console.log('═'.repeat(60));

  // JWT odjava
  const odjava = await zahtevek('POST', '/auth/logout', null, 'uporabnik');
  izpisi('POST /api/auth/logout – JWT odjava', odjava.podatki, !odjava.uspeh);

  // OAuth preklic refresh_token
  console.log('\n─'.repeat(60));
  console.log('  OAuth 2.0 – preklic refresh_token (POST /oauth/revoke)');
  try {
    await prekliciToken('uporabnik');
    izpisi('POST /oauth/revoke – preklic (uporabnik)', { sporocilo: 'Zeton je bil preklican.' });
  } catch (err) {
    izpisi('POST /oauth/revoke – napaka', { napaka: err.message }, true);
  }
}

// ── Glavni program ─────────────────────────────────────────────

async function main() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'KajDogaja – Odjemalski REST API Odjemalec' + ' '.repeat(7) + '║');
  console.log('║' + ' '.repeat(8) + 'OAuth 2.0 (RFC 6749) – ROPC + Refresh Token' + ' '.repeat(7) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\nPovezujem se na: ${BASE_URL}`);

  try {
    await axios.get('http://localhost:3003/');
    console.log('✅ Streznik je dostopen.\n');
  } catch {
    console.error('❌ Streznik ni dostopen na http://localhost:3003');
    console.error('   Zazenite streznik z: node app.js\n');
    process.exit(1);
  }

  try {
    await testirajOAuth();
    await testirajReferencnePodatke();
    await testirajIskanjeInFiltriranje();
    await testirajPodrobnostiInQR();
    await testirajPrijaveNaDogodke();
    await testirajProfil();
    await testirajObvestila();
    await testirajOdjavo();

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Testiranje odjemalskih funkcionalnosti z OAuth 2.0 zakljuceno!');
    console.log('═'.repeat(60) + '\n');
  } catch (err) {
    console.error('\n❌ Kriticna napaka:', err.message);
    process.exit(1);
  }
}

main();
