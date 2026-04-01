/**
 * KajDogaja – Strezniski REST API odjemalec
 * Testira strezniskie funkcionalnosti: avtentikacija, CRUD dogodkov,
 * upravljanje prijav, cakalna vrsta, obvestila, statistike, QR kode.
 * Uporablja knjiznico axios.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3002/api';

let zetonUporabnik1 = null;
let zetonUporabnik2 = null;
let zetonOrganizator = null;
let idDogodka = null;
let idDogodkaMalaKapaciteta = null;

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
// 1. AVTENTIKACIJA IN UPRAVLJANJE VLOG
// ============================================================
async function testirajAvtentikacijo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  1. AVTENTIKACIJA IN UPRAVLJANJE VLOG');
  console.log('═'.repeat(60));

  // Registracija organizatorja
  const regOrg = await zahtevek('POST', '/auth/register', {
    uporabnisko_ime: 'org_jana',
    email: 'jana@organizator.si',
    geslo: 'geslo123',
    vloga: 'organizator'
  });
  izpisi('POST /auth/register – registracija organizatorja', regOrg.podatki, !regOrg.uspeh);

  // Registracija dveh navadnih uporabnikov (za test kapacitete)
  const regU1 = await zahtevek('POST', '/auth/register', {
    uporabnisko_ime: 'user_ana',
    email: 'ana@test.si',
    geslo: 'geslo123',
    vloga: 'uporabnik'
  });
  izpisi('POST /auth/register – registracija uporabnika 1', regU1.podatki, !regU1.uspeh);

  const regU2 = await zahtevek('POST', '/auth/register', {
    uporabnisko_ime: 'user_bor',
    email: 'bor@test.si',
    geslo: 'geslo123',
    vloga: 'uporabnik'
  });
  izpisi('POST /auth/register – registracija uporabnika 2', regU2.podatki, !regU2.uspeh);

  // Prijava
  const prijaviOrg = await zahtevek('POST', '/auth/login', { email: 'jana@organizator.si', geslo: 'geslo123' });
  if (prijaviOrg.uspeh) zetonOrganizator = prijaviOrg.podatki.zeton;
  izpisi('POST /auth/login – organizator', { vloga: prijaviOrg.podatki?.uporabnik?.vloga, zeton: '(shranjen)' }, !prijaviOrg.uspeh);

  const prijaviU1 = await zahtevek('POST', '/auth/login', { email: 'ana@test.si', geslo: 'geslo123' });
  if (prijaviU1.uspeh) zetonUporabnik1 = prijaviU1.podatki.zeton;
  izpisi('POST /auth/login – uporabnik 1', { vloga: prijaviU1.podatki?.uporabnik?.vloga }, !prijaviU1.uspeh);

  const prijaviU2 = await zahtevek('POST', '/auth/login', { email: 'bor@test.si', geslo: 'geslo123' });
  if (prijaviU2.uspeh) zetonUporabnik2 = prijaviU2.podatki.zeton;
  izpisi('POST /auth/login – uporabnik 2', { vloga: prijaviU2.podatki?.uporabnik?.vloga }, !prijaviU2.uspeh);

  // Test napacnih podatkov
  const napacna = await zahtevek('POST', '/auth/login', { email: 'napacen@email.si', geslo: 'napacno' });
  izpisi('POST /auth/login – napacni podatki (401)', napacna.podatki, napacna.uspeh);

  // Test dostopa brez zetona
  const brezZetona = await zahtevek('POST', '/auth/logout');
  izpisi('POST /auth/logout – brez zetona (401)', brezZetona.podatki, brezZetona.uspeh);
}

// ============================================================
// 2. CRUD DOGODKOV IN QR KODE
// ============================================================
async function testirajDogodke() {
  console.log('\n' + '═'.repeat(60));
  console.log('  2. CRUD DOGODKOV IN QR KODE');
  console.log('═'.repeat(60));

  // POST – ustvari dogodek (generira QR kodo)
  const noviDogodek = await zahtevek('POST', '/events', {
    naziv: 'Jazzovski vecernik',
    opis: 'Glasbeni vecernik pod zvezdami.',
    datum: '2024-08-20',
    ura: '20:00',
    lokacija: 'Kongresni trg, Ljubljana',
    koordinate_lat: 46.0511,
    koordinate_lng: 14.5058,
    kapaciteta: 50,
    kategorija_id: 3,
    mesto_id: 1
  }, zetonOrganizator);
  izpisi('POST /events – ustvari dogodek z QR kodo (organizator)', {
    id: noviDogodek.podatki?.dogodek?.id,
    naziv: noviDogodek.podatki?.dogodek?.naziv,
    qr_koda_generirana: !!noviDogodek.podatki?.dogodek?.qr_koda_url
  }, !noviDogodek.uspeh);
  if (noviDogodek.uspeh) idDogodka = noviDogodek.podatki.dogodek.id;

  // POST – ustvari dogodek z majhno kapaciteto (za test cakalne vrste)
  const malaDogodek = await zahtevek('POST', '/events', {
    naziv: 'Delavnica keramike',
    datum: '2024-09-01',
    ura: '10:00',
    lokacija: 'Kulturni center',
    kapaciteta: 1,
    kategorija_id: 5,
    mesto_id: 1
  }, zetonOrganizator);
  if (malaDogodek.uspeh) idDogodkaMalaKapaciteta = malaDogodek.podatki.dogodek.id;
  izpisi('POST /events – ustvari dogodek s kapaciteto 1', { id: idDogodkaMalaKapaciteta }, !malaDogodek.uspeh);

  // Poskus ustvarjanja brez organizatorske vloge (403)
  const neUspel = await zahtevek('POST', '/events', { naziv: 'Neupravicen', datum: '2024-10-01', ura: '12:00', lokacija: 'Kjer koli' }, zetonUporabnik1);
  izpisi('POST /events – navadni uporabnik (403)', neUspel.podatki, neUspel.uspeh);

  if (!idDogodka) return;

  // GET – podrobnosti
  const podrobnosti = await zahtevek('GET', `/events/${idDogodka}`);
  izpisi(`GET /events/${idDogodka} – podrobnosti`, { naziv: podrobnosti.podatki?.naziv, kapaciteta: podrobnosti.podatki?.kapaciteta }, !podrobnosti.uspeh);

  // PUT – posodobi (sproze obvestila za prijavljene)
  const posodobi = await zahtevek('PUT', `/events/${idDogodka}`, { naziv: 'Jazzovski vecernik (posodobljeno)', kapaciteta: 60 }, zetonOrganizator);
  izpisi(`PUT /events/${idDogodka} – posodobi in sproze obvestila`, { naziv: posodobi.podatki?.dogodek?.naziv }, !posodobi.uspeh);

  // GET – QR koda
  const qr = await zahtevek('GET', `/events/${idDogodka}/qr`, null, zetonUporabnik1);
  izpisi(`GET /events/${idDogodka}/qr – QR koda`, {
    naziv: qr.podatki?.naziv,
    qr_koda_dolzina: qr.podatki?.qr_koda?.length
  }, !qr.uspeh);

  // Filtriranje
  const filter = await zahtevek('GET', '/events?mesto=Ljubljana&kategorija=glasba');
  izpisi('GET /events?mesto=Ljubljana&kategorija=glasba – filtriranje', { skupaj: filter.podatki?.skupaj }, !filter.uspeh);
}

// ============================================================
// 3. UPRAVLJANJE PRIJAV IN CAKALNA VRSTA
// ============================================================
async function testirajPrijaveInCakalnoVrsto() {
  console.log('\n' + '═'.repeat(60));
  console.log('  3. UPRAVLJANJE PRIJAV IN CAKALNA VRSTA');
  console.log('═'.repeat(60));

  if (!idDogodkaMalaKapaciteta) {
    console.log('  ⚠ ID dogodka z malo kapaciteto ni na voljo.');
    return;
  }

  // Uporabnik 1 se prijavi – kapaciteta se zapolni (1/1)
  const prijava1 = await zahtevek('POST', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, zetonUporabnik1);
  izpisi(`POST /events/${idDogodkaMalaKapaciteta}/registrations – uporabnik 1 (potrjena)`, { status: prijava1.podatki?.prijava?.status }, !prijava1.uspeh);

  // Uporabnik 2 se prijavi – kapaciteta polna, gre na cakalno vrsto
  const prijava2 = await zahtevek('POST', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, zetonUporabnik2);
  izpisi(`POST /events/${idDogodkaMalaKapaciteta}/registrations – uporabnik 2 (cakalna_vrsta)`, { status: prijava2.podatki?.prijava?.status }, !prijava2.uspeh);

  // Organizator pogleda seznam prijav
  const seznam = await zahtevek('GET', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, zetonOrganizator);
  izpisi(`GET /events/${idDogodkaMalaKapaciteta}/registrations – seznam prijav (organizator)`, {
    skupaj: seznam.podatki?.skupaj,
    statusi: seznam.podatki?.prijave?.map(p => ({ ime: p.uporabnisko_ime, status: p.status }))
  }, !seznam.uspeh);

  // Uporabnik 1 se odjavi – sistem avtomatsko promovira uporabnika 2 iz cakalne vrste
  const odjava = await zahtevek('DELETE', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, zetonUporabnik1);
  izpisi(`DELETE /events/${idDogodkaMalaKapaciteta}/registrations – odjava uporabnika 1`, odjava.podatki, !odjava.uspeh);

  // Preveri, da je uporabnik 2 sedaj potrjen
  const seznamPo = await zahtevek('GET', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, zetonOrganizator);
  izpisi('Stanje po promociji iz cakalne vrste', {
    prijave: seznamPo.podatki?.prijave?.map(p => ({ ime: p.uporabnisko_ime, status: p.status }))
  }, !seznamPo.uspeh);

  // Dvojna prijava (409)
  const dvojna = await zahtevek('POST', `/events/${idDogodkaMalaKapaciteta}/registrations`, null, zetonUporabnik2);
  izpisi('POST registrations – dvojna prijava (409)', dvojna.podatki, dvojna.uspeh);
}

// ============================================================
// 4. OBVESTILA (STREZNIK JIH GENERIRA AVTOMATSKO)
// ============================================================
async function testirajObvestila() {
  console.log('\n' + '═'.repeat(60));
  console.log('  4. OBVESTILA (GENERIRANA S STRANI STREZNIKA)');
  console.log('═'.repeat(60));

  // Pridobi obvestila za uporabnika 2 (obvestilo o promociji iz cakalne vrste)
  const obvestila = await zahtevek('GET', '/notifications', null, zetonUporabnik2);
  izpisi('GET /notifications – obvestila uporabnika 2 (promocija iz cakalne vrste)', {
    skupaj: obvestila.podatki?.skupaj,
    obvestila: obvestila.podatki?.obvestila?.map(o => ({ tip: o.tip, vsebina: o.vsebina, prebrano: o.prebrano }))
  }, !obvestila.uspeh);

  if (obvestila.uspeh && obvestila.podatki.obvestila.length > 0) {
    const idObvestila = obvestila.podatki.obvestila[0].id;

    // Oznaci kot prebrano
    const prebrano = await zahtevek('PUT', `/notifications/${idObvestila}/read`, null, zetonUporabnik2);
    izpisi(`PUT /notifications/${idObvestila}/read – oznaci kot prebrano`, prebrano.podatki, !prebrano.uspeh);

    // Preveri samo prebrana
    const samoPrebrana = await zahtevek('GET', '/notifications?prebrano=true', null, zetonUporabnik2);
    izpisi('GET /notifications?prebrano=true – samo prebrana', { skupaj: samoPrebrana.podatki?.skupaj }, !samoPrebrana.uspeh);

    // Izbrisi obvestilo
    const izbrisi = await zahtevek('DELETE', `/notifications/${idObvestila}`, null, zetonUporabnik2);
    izpisi(`DELETE /notifications/${idObvestila} – izbrisi obvestilo`, izbrisi.podatki, !izbrisi.uspeh);
  } else {
    console.log('\n  ⚠ Ni obvestil za testiranje.');
  }
}

// ============================================================
// 5. STATISTIKE PRIJAV
// ============================================================
async function testirajStatistike() {
  console.log('\n' + '═'.repeat(60));
  console.log('  5. STATISTIKE PRIJAV ZA DOGODEK');
  console.log('═'.repeat(60));

  if (!idDogodkaMalaKapaciteta) return;

  // Organizator pogleda statistike
  const stat = await zahtevek('GET', `/events/${idDogodkaMalaKapaciteta}/stats`, null, zetonOrganizator);
  izpisi(`GET /events/${idDogodkaMalaKapaciteta}/stats – statistike (organizator)`, stat.podatki, !stat.uspeh);

  // Navadni uporabnik nima dostopa (403)
  const statBrez = await zahtevek('GET', `/events/${idDogodkaMalaKapaciteta}/stats`, null, zetonUporabnik1);
  izpisi('GET /events/:id/stats – navadni uporabnik (403)', statBrez.podatki, statBrez.uspeh);
}

// ============================================================
// 6. BRISANJE DOGODKA IN OBVESTILA O ODPOVEDI
// ============================================================
async function testirajBrisanje() {
  console.log('\n' + '═'.repeat(60));
  console.log('  6. BRISANJE DOGODKA IN OBVESTILA O ODPOVEDI');
  console.log('═'.repeat(60));

  if (!idDogodka) return;

  // Najprej se prijavi uporabnik 1 na glavni dogodek
  await zahtevek('POST', `/events/${idDogodka}/registrations`, null, zetonUporabnik1);

  // Organizator izbrisi dogodek – streznik samodejno poslje obvestila
  const brisi = await zahtevek('DELETE', `/events/${idDogodka}`, null, zetonOrganizator);
  izpisi(`DELETE /events/${idDogodka} – izbrisi in poslje obvestila prijavljenim`, brisi.podatki, !brisi.uspeh);

  // Preveri, da je uporabnik 1 prejel obvestilo o odpovedi
  const obvestilaOdpoved = await zahtevek('GET', '/notifications', null, zetonUporabnik1);
  izpisi('Obvestila o odpovedi za uporabnika 1', {
    skupaj: obvestilaOdpoved.podatki?.skupaj,
    tipi: obvestilaOdpoved.podatki?.obvestila?.map(o => o.tip)
  }, !obvestilaOdpoved.uspeh);
}

// ============================================================
// 7. REFERENCNI PODATKI IN ODJAVA
// ============================================================
async function testirajReferencoInOdjavo() {
  console.log('\n' + '═'.repeat(60));
  console.log('  7. REFERENCNI PODATKI IN ODJAVA');
  console.log('═'.repeat(60));

  const kategorije = await zahtevek('GET', '/categories');
  izpisi('GET /categories', { skupaj: kategorije.podatki?.skupaj }, !kategorije.uspeh);

  const mesta = await zahtevek('GET', '/cities');
  izpisi('GET /cities', { skupaj: mesta.podatki?.skupaj }, !mesta.uspeh);

  const odjava = await zahtevek('POST', '/auth/logout', null, zetonOrganizator);
  izpisi('POST /auth/logout – odjava organizatorja', odjava.podatki, !odjava.uspeh);
}

// ============================================================
// GLAVNI PROGRAM
// ============================================================
async function main() {
  console.log('\n' + '╔' + '═'.repeat(58) + '╗');
  console.log('║' + ' '.repeat(10) + 'KajDogaja – Strezniski REST API Odjemalec' + ' '.repeat(7) + '║');
  console.log('║' + ' '.repeat(8) + 'Testiranje strezniskih funkcionalnosti' + ' '.repeat(12) + '║');
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
    console.log('✅ Testiranje strezniskih funkcionalnosti zakljuceno!');
    console.log('═'.repeat(60) + '\n');
  } catch (err) {
    console.error('\n❌ Kriticna napaka:', err.message);
    process.exit(1);
  }
}

main();
