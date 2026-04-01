/**
 * KajDogaja REST API - Node.js odjemalec
 * Testira vse metode: GET, POST, PUT, DELETE
 * Uporablja knjižnico axios
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

// Globalne spremenljivke za shranjevanje podatkov med testi
let zetonUporabnik = null;
let zetonOrganizator = null;
let idDogodka = null;
let idObvestila = null;

// Pomožna funkcija za izpis rezultatov
function izpisi(naslov, podatki, napaka = false) {
  const crta = '─'.repeat(60);
  console.log(`\n${crta}`);
  console.log(napaka ? `❌ ${naslov}` : `✅ ${naslov}`);
  console.log(crta);
  console.log(JSON.stringify(podatki, null, 2));
}

// Pomožna funkcija za zahtevke z obravnavo napak
async function zahtevek(metoda, pot, podatki = null, zeton = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (zeton) headers['Authorization'] = `Bearer ${zeton}`;

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

// ============================================================
// TESTNE FUNKCIJE
// ============================================================

async function testirajRegistracijoInPrijavo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  1. AVTENTIKACIJA – registracija in prijava');
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

  // Prijava uporabnika
  const prijaviUporabnik = await zahtevek('POST', '/auth/login', {
    email: 'uporabnik@test.si',
    geslo: 'geslo123'
  });
  izpisi('POST /auth/login – prijava uporabnika', prijaviUporabnik.podatki, !prijaviUporabnik.uspeh);
  if (prijaviUporabnik.uspeh) {
    zetonUporabnik = prijaviUporabnik.podatki.zeton;
    console.log('  → JWT žeton shranjen za nadaljnje teste');
  }

  // Prijava organizatorja
  const prijaviOrg = await zahtevek('POST', '/auth/login', {
    email: 'organizator@test.si',
    geslo: 'geslo456'
  });
  izpisi('POST /auth/login – prijava organizatorja', prijaviOrg.podatki, !prijaviOrg.uspeh);
  if (prijaviOrg.uspeh) {
    zetonOrganizator = prijaviOrg.podatki.zeton;
    console.log('  → JWT žeton organizatorja shranjen');
  }

  // Test napačnih podatkov
  const napacnaPrijava = await zahtevek('POST', '/auth/login', {
    email: 'napacen@email.si',
    geslo: 'napacsno'
  });
  izpisi('POST /auth/login – napačni podatki (401)', napacnaPrijava.podatki, napacnaPrijava.uspeh);
}

async function testirajKategorijeMesta() {
  console.log('\n' + '═'.repeat(60));
  console.log('  2. REFERENČNI PODATKI – kategorije in mesta');
  console.log('═'.repeat(60));

  const kategorije = await zahtevek('GET', '/categories');
  izpisi('GET /categories – seznam kategorij', kategorije.podatki, !kategorije.uspeh);

  const mesta = await zahtevek('GET', '/cities');
  izpisi('GET /cities – seznam mest', mesta.podatki, !mesta.uspeh);
}

async function testirajDogodke() {
  console.log('\n' + '═'.repeat(60));
  console.log('  3. DOGODKI – CRUD operacije');
  console.log('═'.repeat(60));

  // GET - seznam vseh dogodkov (brez avtentikacije)
  const vsiDogodki = await zahtevek('GET', '/events');
  izpisi('GET /events – vsi dogodki', vsiDogodki.podatki, !vsiDogodki.uspeh);

  // POST - ustvari nov dogodek (organizator)
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
  }, zetonOrganizator);
  izpisi('POST /events – ustvari dogodek (organizator)', noviDogodek.podatki, !noviDogodek.uspeh);

  if (noviDogodek.uspeh) {
    idDogodka = noviDogodek.podatki.dogodek.id;
    console.log(`  → ID novega dogodka: ${idDogodka}`);
  }

  // Poskus ustvarjanja brez organizatorske vloge
  const neuspelDogodek = await zahtevek('POST', '/events', {
    naziv: 'Nedovoljen dogodek',
    datum: '2024-08-01',
    ura: '18:00',
    lokacija: 'Nekje'
  }, zetonUporabnik);
  izpisi('POST /events – brez organizatorske vloge (403)', neuspelDogodek.podatki, neuspelDogodek.uspeh);

  if (!idDogodka) return;

  // GET - podrobnosti posameznega dogodka
  const enkratDogodek = await zahtevek('GET', `/events/${idDogodka}`);
  izpisi(`GET /events/${idDogodka} – podrobnosti dogodka`, enkratDogodek.podatki, !enkratDogodek.uspeh);

  // GET - filtriranje po mestu
  const filtriranoMesto = await zahtevek('GET', '/events?mesto=Ljubljana');
  izpisi('GET /events?mesto=Ljubljana – filtriranje po mestu', { skupaj: filtriranoMesto.podatki?.skupaj }, !filtriranoMesto.uspeh);

  // GET - filtriranje po kategoriji
  const filtriranoKat = await zahtevek('GET', '/events?kategorija=glasba');
  izpisi('GET /events?kategorija=glasba – filtriranje po kategoriji', { skupaj: filtriranoKat.podatki?.skupaj }, !filtriranoKat.uspeh);

  // GET - iskanje po besedilu
  const iskanje = await zahtevek('GET', '/events?iskanje=koncert');
  izpisi('GET /events?iskanje=koncert – iskanje', { skupaj: iskanje.podatki?.skupaj }, !iskanje.uspeh);

  // PUT - posodobi dogodek
  const posodobiDogodek = await zahtevek('PUT', `/events/${idDogodka}`, {
    naziv: 'Veliki koncert v parku',
    kapaciteta: 150,
    opis: 'Posodobljeni letni koncert pod zvezdami v Tivoliju.'
  }, zetonOrganizator);
  izpisi(`PUT /events/${idDogodka} – posodobi dogodek`, posodobiDogodek.podatki, !posodobiDogodek.uspeh);

  // GET - QR koda
  const qrKoda = await zahtevek('GET', `/events/${idDogodka}/qr`, null, zetonUporabnik);
  const qrPrikaz = qrKoda.uspeh
    ? { id: qrKoda.podatki.id, naziv: qrKoda.podatki.naziv, qr_koda: qrKoda.podatki.qr_koda?.substring(0, 50) + '...' }
    : qrKoda.podatki;
  izpisi(`GET /events/${idDogodka}/qr – QR koda (skrajšano)`, qrPrikaz, !qrKoda.uspeh);
}

async function testirajPrijave() {
  console.log('\n' + '═'.repeat(60));
  console.log('  4. PRIJAVE – registracija na dogodke');
  console.log('═'.repeat(60));

  if (!idDogodka) {
    console.log('  ⚠ ID dogodka ni na voljo, preskočim teste prijav.');
    return;
  }

  // POST - prijava uporabnika na dogodek
  const prijava = await zahtevek('POST', `/events/${idDogodka}/registrations`, null, zetonUporabnik);
  izpisi(`POST /events/${idDogodka}/registrations – prijava`, prijava.podatki, !prijava.uspeh);

  // Poskus dvojne prijave
  const dvojnaPrijava = await zahtevek('POST', `/events/${idDogodka}/registrations`, null, zetonUporabnik);
  izpisi(`POST /events/${idDogodka}/registrations – dvojna prijava (409)`, dvojnaPrijava.podatki, dvojnaPrijava.uspeh);

  // GET - seznam prijav (organizator)
  const seznamPrijav = await zahtevek('GET', `/events/${idDogodka}/registrations`, null, zetonOrganizator);
  izpisi(`GET /events/${idDogodka}/registrations – seznam prijav (organizator)`, seznamPrijav.podatki, !seznamPrijav.uspeh);

  // GET - moje prijave
  const mojePrijave = await zahtevek('GET', '/me/registrations', null, zetonUporabnik);
  izpisi('GET /me/registrations – moje prijave', mojePrijave.podatki, !mojePrijave.uspeh);

  // DELETE - odjava z dogodka
  const odjava = await zahtevek('DELETE', `/events/${idDogodka}/registrations`, null, zetonUporabnik);
  izpisi(`DELETE /events/${idDogodka}/registrations – odjava`, odjava.podatki, !odjava.uspeh);
}

async function testirajProfil() {
  console.log('\n' + '═'.repeat(60));
  console.log('  5. PROFIL UPORABNIKA');
  console.log('═'.repeat(60));

  // GET - profil trenutnega uporabnika
  const profil = await zahtevek('GET', '/me', null, zetonUporabnik);
  izpisi('GET /me – profil uporabnika', profil.podatki, !profil.uspeh);

  // Test brez žetona
  const brezZetona = await zahtevek('GET', '/me');
  izpisi('GET /me – brez avtentikacije (401)', brezZetona.podatki, brezZetona.uspeh);
}

async function testirajObvestila() {
  console.log('\n' + '═'.repeat(60));
  console.log('  6. OBVESTILA');
  console.log('═'.repeat(60));

  // GET - vsa obvestila
  const obvestila = await zahtevek('GET', '/notifications', null, zetonUporabnik);
  izpisi('GET /notifications – vsa obvestila', obvestila.podatki, !obvestila.uspeh);

  // GET - samo neprebrana
  const neprebrana = await zahtevek('GET', '/notifications?prebrano=false', null, zetonUporabnik);
  izpisi('GET /notifications?prebrano=false – neprebrana obvestila', neprebrana.podatki, !neprebrana.uspeh);

  if (obvestila.uspeh && obvestila.podatki.obvestila.length > 0) {
    idObvestila = obvestila.podatki.obvestila[0].id;

    // PUT - označi kot prebrano
    const prebrano = await zahtevek('PUT', `/notifications/${idObvestila}/read`, null, zetonUporabnik);
    izpisi(`PUT /notifications/${idObvestila}/read – označi kot prebrano`, prebrano.podatki, !prebrano.uspeh);

    // DELETE - izbriši obvestilo
    const izbrisi = await zahtevek('DELETE', `/notifications/${idObvestila}`, null, zetonUporabnik);
    izpisi(`DELETE /notifications/${idObvestila} – izbriši obvestilo`, izbrisi.podatki, !izbrisi.uspeh);
  } else {
    console.log('\n  ⚠ Ni obvestil za testiranje PUT/DELETE.');
  }
}

async function testirajStatistike() {
  console.log('\n' + '═'.repeat(60));
  console.log('  7. STATISTIKE DOGODKI');
  console.log('═'.repeat(60));

  if (!idDogodka) {
    console.log('  ⚠ ID dogodka ni na voljo, preskočim teste statistik.');
    return;
  }

  const statistike = await zahtevek('GET', `/events/${idDogodka}/stats`, null, zetonOrganizator);
  izpisi(`GET /events/${idDogodka}/stats – statistike`, statistike.podatki, !statistike.uspeh);

  // Test brez organizatorske vloge
  const neDovoljen = await zahtevek('GET', `/events/${idDogodka}/stats`, null, zetonUporabnik);
  izpisi(`GET /events/${idDogodka}/stats – navaden uporabnik (403)`, neDovoljen.podatki, neDovoljen.uspeh);
}

async function testirajBrisanjeDogodka() {
  console.log('\n' + '═'.repeat(60));
  console.log('  8. BRISANJE DOGODKA');
  console.log('═'.repeat(60));

  if (!idDogodka) return;

  // Ustvari nov dodatni dogodek za brisanje
  const dodatniDogodek = await zahtevek('POST', '/events', {
    naziv: 'Začasni dogodek za brisanje',
    datum: '2024-12-31',
    ura: '23:59',
    lokacija: 'Testna lokacija'
  }, zetonOrganizator);

  if (dodatniDogodek.uspeh) {
    const idZaBrisanje = dodatniDogodek.podatki.dogodek.id;
    const brisi = await zahtevek('DELETE', `/events/${idZaBrisanje}`, null, zetonOrganizator);
    izpisi(`DELETE /events/${idZaBrisanje} – izbriši dogodek`, brisi.podatki, !brisi.uspeh);
  }
}

async function testirajOdjavo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  9. ODJAVA');
  console.log('═'.repeat(60));

  const odjava = await zahtevek('POST', '/auth/logout', null, zetonUporabnik);
  izpisi('POST /auth/logout – odjava uporabnika', odjava.podatki, !odjava.uspeh);
}

// ============================================================
// GLAVNI PROGRAM
// ============================================================

async function zeniMain() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(15) + 'KajDogaja REST API Odjemalec' + ' '.repeat(15) + '║');
  console.log('║' + ' '.repeat(12) + 'Testiranje vseh HTTP metod' + ' '.repeat(20) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\nPovezujem se na: ${BASE_URL}`);

  // Preveri, ali strežnik teče
  try {
    await axios.get('http://localhost:3001/');
    console.log('✅ Strežnik je dostopen.\n');
  } catch {
    console.error('❌ Strežnik ni dostopen na http://localhost:3001');
    console.error('   Zaženite strežnik z: node app.js\n');
    process.exit(1);
  }

  try {
    await testirajRegistracijoInPrijavo();
    await testirajKategorijeMesta();
    await testirajDogodke();
    await testirajPrijave();
    await testirajProfil();
    await testirajObvestila();
    await testirajStatistike();
    await testirajBrisanjeDogodka();
    await testirajOdjavo();

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Testiranje zaključeno!');
    console.log('═'.repeat(60) + '\n');
  } catch (err) {
    console.error('\n❌ Kritična napaka:', err.message);
    process.exit(1);
  }
}

zeniMain();
