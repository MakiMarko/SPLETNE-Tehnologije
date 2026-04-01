/**
 * KajDogaja – Odjemalski REST API odjemalec
 * Testira funkcionalnosti odjemalca: registracija, iskanje in filtriranje
 * dogodkov, geolokacija, prijava na dogodke, profil, obvestila, QR kode.
 * Uporablja knjiznico axios.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3003/api';

let zetonUporabnika = null;
let idDogodka = null;

function izpisi(naslov, podatki, napaka = false) {
  const crta = '─'.repeat(60);
  console.log(`\n${crta}`);
  console.log(napaka ? `❌ ${naslov}` : `✅ ${naslov}`);
  console.log(crta);
  console.log(JSON.stringify(podatki, null, 2));
}

async function zahtevek(metoda, pot, podatki = null, zeton = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (zeton) headers['Authorization'] = `Bearer ${zeton}`;
  try {
    const moznosti = { method: metoda, url: `${BASE_URL}${pot}`, headers };
    if (podatki !== null) moznosti.data = podatki;
    const odgovor = await axios(moznosti);
    return { uspeh: true, status: odgovor.status, podatki: odgovor.data };
  } catch (err) {
    return { uspeh: false, status: err.response?.status, podatki: err.response?.data || { napaka: err.message } };
  }
}

// ============================================================
// 1. REGISTRACIJA IN PRIJAVA UPORABNIKA
// ============================================================
async function testirajRegistracijoInPrijavo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  1. REGISTRACIJA IN PRIJAVA UPORABNIKA');
  console.log('═'.repeat(60));

  // Registracija novega uporabnika
  const reg = await zahtevek('POST', '/auth/register', {
    uporabnisko_ime: 'maja_k',
    email: 'maja@test.si',
    geslo: 'geslo123',
    vloga: 'uporabnik'
  });
  izpisi('POST /auth/register – registracija', reg.podatki, !reg.uspeh);

  // Prijava
  const prijava = await zahtevek('POST', '/auth/login', {
    email: 'maja@test.si',
    geslo: 'geslo123'
  });
  izpisi('POST /auth/login – prijava uspesna', {
    uporabnisko_ime: prijava.podatki?.uporabnik?.uporabnisko_ime,
    vloga: prijava.podatki?.uporabnik?.vloga,
    zeton: prijava.podatki?.zeton ? '(prejet)' : '(manjka)'
  }, !prijava.uspeh);
  if (prijava.uspeh) zetonUporabnika = prijava.podatki.zeton;

  // Napacno geslo (401)
  const napacna = await zahtevek('POST', '/auth/login', { email: 'maja@test.si', geslo: 'napacno' });
  izpisi('POST /auth/login – napacno geslo (401)', napacna.podatki, napacna.uspeh);
}

// ============================================================
// 2. REFERENCNI PODATKI (KATEGORIJE IN MESTA)
// ============================================================
async function testirajReferencnePodatke() {
  console.log('\n' + '═'.repeat(60));
  console.log('  2. REFERENCNI PODATKI – kategorije in mesta');
  console.log('═'.repeat(60));

  const kategorije = await zahtevek('GET', '/categories');
  izpisi('GET /categories – vse kategorije', { skupaj: kategorije.podatki?.skupaj, primeri: kategorije.podatki?.kategorije?.slice(0, 3).map(k => k.naziv) }, !kategorije.uspeh);

  const mesta = await zahtevek('GET', '/cities');
  izpisi('GET /cities – vsa mesta s koordinatami', { skupaj: mesta.podatki?.skupaj, primeri: mesta.podatki?.mesta?.slice(0, 3).map(m => m.naziv) }, !mesta.uspeh);
}

// ============================================================
// 3. ISKANJE IN FILTRIRANJE DOGODKOV
// ============================================================
async function testirajIskanjeInFiltriranje() {
  console.log('\n' + '═'.repeat(60));
  console.log('  3. ISKANJE IN FILTRIRANJE DOGODKOV');
  console.log('═'.repeat(60));

  // Vsi dogodki (brez filtra)
  const vsi = await zahtevek('GET', '/events');
  izpisi('GET /events – vsi dogodki', { skupaj: vsi.podatki?.skupaj }, !vsi.uspeh);
  if (vsi.uspeh && vsi.podatki.dogodki.length > 0) {
    idDogodka = vsi.podatki.dogodki[0].id;
  }

  // Filtriranje po mestu
  const poMestu = await zahtevek('GET', '/events?mesto=Ljubljana');
  izpisi('GET /events?mesto=Ljubljana – filter po mestu', { skupaj: poMestu.podatki?.skupaj }, !poMestu.uspeh);

  // Filtriranje po kategoriji
  const poKategoriji = await zahtevek('GET', '/events?kategorija=glasba');
  izpisi('GET /events?kategorija=glasba – filter po kategoriji', { skupaj: poKategoriji.podatki?.skupaj }, !poKategoriji.uspeh);

  // Iskanje po besedilu
  const iskanje = await zahtevek('GET', '/events?iskanje=jazz');
  izpisi('GET /events?iskanje=jazz – iskanje po besedilu', { skupaj: iskanje.podatki?.skupaj }, !iskanje.uspeh);

  // Filtriranje po datumu
  const poDatumu = await zahtevek('GET', '/events?datum=2024-08-20');
  izpisi('GET /events?datum=2024-08-20 – filter po datumu', { skupaj: poDatumu.podatki?.skupaj }, !poDatumu.uspeh);

  // Geolokacija – dogodki v blizini Ljubljane (10 km)
  const geoFilter = await zahtevek('GET', '/events?lat=46.0569&lng=14.5058&razdalja=10');
  izpisi('GET /events?lat=46.06&lng=14.51&razdalja=10 – dogodki v blizini (10 km)', { skupaj: geoFilter.podatki?.skupaj }, !geoFilter.uspeh);
}

// ============================================================
// 4. OGLED PODROBNOSTI IN QR KODE
// ============================================================
async function testirajPodrobnostiInQR() {
  console.log('\n' + '═'.repeat(60));
  console.log('  4. OGLED PODROBNOSTI IN QR KODE');
  console.log('═'.repeat(60));

  if (!idDogodka) {
    console.log('  ⚠ Ni razpolozljivih dogodkov za ogled podrobnosti.');
    return;
  }

  // Podrobnosti dogodka (brez avtentikacije)
  const podrobnosti = await zahtevek('GET', `/events/${idDogodka}`);
  izpisi(`GET /events/${idDogodka} – podrobnosti (brez prijave)`, {
    naziv: podrobnosti.podatki?.naziv,
    datum: podrobnosti.podatki?.datum,
    lokacija: podrobnosti.podatki?.lokacija,
    kategorija: podrobnosti.podatki?.kategorija_naziv
  }, !podrobnosti.uspeh);

  // QR koda (zahteva JWT)
  const qr = await zahtevek('GET', `/events/${idDogodka}/qr`, null, zetonUporabnika);
  izpisi(`GET /events/${idDogodka}/qr – QR koda (prijavljen)`, {
    naziv: qr.podatki?.naziv,
    qr_dolzina: qr.podatki?.qr_koda?.length
  }, !qr.uspeh);

  // QR koda brez prijave (401)
  const qrBrez = await zahtevek('GET', `/events/${idDogodka}/qr`);
  izpisi(`GET /events/${idDogodka}/qr – brez prijave (401)`, qrBrez.podatki, qrBrez.uspeh);
}

// ============================================================
// 5. PRIJAVA NA DOGODEK IN MOJE PRIJAVE
// ============================================================
async function testirajPrijaveNaDogodke() {
  console.log('\n' + '═'.repeat(60));
  console.log('  5. PRIJAVA NA DOGODEK IN MOJE PRIJAVE');
  console.log('═'.repeat(60));

  if (!idDogodka) {
    console.log('  ⚠ Ni razpolozljivih dogodkov za prijavo.');
    return;
  }

  // Prijava na dogodek
  const prijava = await zahtevek('POST', `/events/${idDogodka}/registrations`, null, zetonUporabnika);
  izpisi(`POST /events/${idDogodka}/registrations – prijava na dogodek`, { status: prijava.podatki?.prijava?.status }, !prijava.uspeh);

  // Dvojna prijava (409)
  const dvojna = await zahtevek('POST', `/events/${idDogodka}/registrations`, null, zetonUporabnika);
  izpisi('POST registrations – dvojna prijava (409)', dvojna.podatki, dvojna.uspeh);

  // Moje prijave
  const mojePrijave = await zahtevek('GET', '/me/registrations', null, zetonUporabnika);
  izpisi('GET /me/registrations – vse moje prijave', { skupaj: mojePrijave.podatki?.skupaj }, !mojePrijave.uspeh);

  // Samo potrjene
  const potrjene = await zahtevek('GET', '/me/registrations?status=potrjena', null, zetonUporabnika);
  izpisi('GET /me/registrations?status=potrjena – samo potrjene', { skupaj: potrjene.podatki?.skupaj }, !potrjene.uspeh);

  // Odjava z dogodka
  const odjava = await zahtevek('DELETE', `/events/${idDogodka}/registrations`, null, zetonUporabnika);
  izpisi(`DELETE /events/${idDogodka}/registrations – odjava z dogodka`, odjava.podatki, !odjava.uspeh);
}

// ============================================================
// 6. PROFIL UPORABNIKA
// ============================================================
async function testirajProfil() {
  console.log('\n' + '═'.repeat(60));
  console.log('  6. PROFIL UPORABNIKA');
  console.log('═'.repeat(60));

  const profil = await zahtevek('GET', '/me', null, zetonUporabnika);
  izpisi('GET /me – profil trenutnega uporabnika', profil.podatki, !profil.uspeh);

  // Dostop brez prijave (401)
  const brezPrijave = await zahtevek('GET', '/me');
  izpisi('GET /me – brez prijave (401)', brezPrijave.podatki, brezPrijave.uspeh);
}

// ============================================================
// 7. OBVESTILA
// ============================================================
async function testirajObvestila() {
  console.log('\n' + '═'.repeat(60));
  console.log('  7. OBVESTILA');
  console.log('═'.repeat(60));

  // Vsa obvestila
  const obvestila = await zahtevek('GET', '/notifications', null, zetonUporabnika);
  izpisi('GET /notifications – vsa obvestila', { skupaj: obvestila.podatki?.skupaj }, !obvestila.uspeh);

  // Samo neprebrana
  const neprebrana = await zahtevek('GET', '/notifications?prebrano=false', null, zetonUporabnika);
  izpisi('GET /notifications?prebrano=false', { skupaj: neprebrana.podatki?.skupaj }, !neprebrana.uspeh);

  if (obvestila.uspeh && obvestila.podatki.obvestila.length > 0) {
    const idObv = obvestila.podatki.obvestila[0].id;

    const prebrano = await zahtevek('PUT', `/notifications/${idObv}/read`, null, zetonUporabnika);
    izpisi(`PUT /notifications/${idObv}/read – oznaci kot prebrano`, prebrano.podatki, !prebrano.uspeh);

    const izbrisi = await zahtevek('DELETE', `/notifications/${idObv}`, null, zetonUporabnika);
    izpisi(`DELETE /notifications/${idObv} – izbrisi`, izbrisi.podatki, !izbrisi.uspeh);
  } else {
    console.log('\n   Ni obvestil za testiranje.');
  }
}

// ============================================================
// 8. ODJAVA
// ============================================================
async function testirajOdjavo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  8. ODJAVA');
  console.log('═'.repeat(60));

  const odjava = await zahtevek('POST', '/auth/logout', null, zetonUporabnika);
  izpisi('POST /auth/logout – odjava', odjava.podatki, !odjava.uspeh);
}

// ============================================================
// GLAVNI PROGRAM
// ============================================================
async function main() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'KajDogaja – Odjemalski REST API Odjemalec' + ' '.repeat(7) + '║');
  console.log('║' + ' '.repeat(10) + 'Testiranje odjemalskih funkcionalnosti' + ' '.repeat(11) + '║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log(`\nPovezujem se na: ${BASE_URL}`);

  try {
    await axios.get('http://localhost:3003/');
    console.log(' Streznik je dostopen.\n');
  } catch {
    console.error(' Streznik ni dostopen na http://localhost:3003');
    console.error('   Zazenite streznik z: node app.js\n');
    process.exit(1);
  }

  try {
    await testirajRegistracijoInPrijavo();
    await testirajReferencnePodatke();
    await testirajIskanjeInFiltriranje();
    await testirajPodrobnostiInQR();
    await testirajPrijaveNaDogodke();
    await testirajProfil();
    await testirajObvestila();
    await testirajOdjavo();

    console.log('\n' + '═'.repeat(60));
    console.log(' Testiranje odjemalskih funkcionalnosti zakljuceno!');
    console.log('═'.repeat(60) + '\n');
  } catch (err) {
    console.error('\n Kriticna napaka:', err.message);
    process.exit(1);
  }
}

main();
