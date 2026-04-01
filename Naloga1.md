Vse spodaj opredeljene zahteve najprej vsebinsko naslovite skupaj. Rezultate predstavite individualno v obliki strani HTML oz. teksta, ki ju boste prikazali preko http strežnika, narejenega s pomočjo node.js (pri tem uporabljajte samo privzete node.js module!). Definirajte usmerjevalnike (angl. routing), kjer vsak vrača pripadajočo vsebino.

Član 1:

/funkcionalnosti-odjemalca/ - vrne dokument HTML, ki opredeli nabor funkcionalnosti, ki jih bo vaša namizna aplikacija zagotavljala. Vsako funkcionalnost na kratko opišite (kaj omogoča, kaj so vhodi in izhodi, ...). Za boljši vpogled v nabor funkcionalnosti izdelajte tudi UML diagram primerov uporabe, ki bo prikazal funkcionalnosti, vloge uporabnikov itd. Sliko diagrama vključite v dokument HTML.
/posebnosti/ - vrne tekst, ki opredeli tehnične zahteve, povezane z implementacijo posameznih funkcionalnosti. Definirajte, če boste za implementacijo določenih funkcionalnosti potrebovali specifične tehnologije, oz. če bo morala naprava za polno delovanje obvezno zagotavljati katerega od senzorjev.
Član 2:

/podatkovni-model/ - vrne dokument HTML, ki opisuje podatkovni model. Definirajte glavne podatkovne entitete, njihove atribute, relacije med entitetami, itd. Opredelite, kateri podatki morajo biti na voljo vedno na napravi, kateri so na voljo samo na strežniku in katere podatke bo potrebno sinhronizirati s strežniškim delom (ter kdaj: vedno, samo ob določenih rokih, ...). Izdelajte tudi ER diagram, sliko pa vključite v dokument HTML.
/REST/ – vrne tekst, ki opredeli nabor storitev REST in metod, ki jih te storitve morajo omogočati, da boste podprli delovanje hibridne namizne aplikacije.
Član 3:

/funkcionalnosti-streznika/ - vrne dokument HTML, ki opredeli celoviti nabor funkcionalnosti, ki jih bo strežnik zagotavljal. Vsako funkcionalnost na kratko opišite (kaj omogoča, kaj so vhodi, kaj so izhodi, ...). Prav tako izdelate UML diagram primerov uporabe, ki bo pokazal funkcionalnosti strežnika, vloge uporabnikov, kdo kaj uporablja itd. Sliko diagrama vključite v dokument HTML.
/posebnosti/ - vrne tekst, ki opredeli tehnične zahteve, povezane z implementacijo strežnika.
Uporaba zunanjih povezav ni dovoljena. Vse datoteke (HTML, slike itd.) naj vrača node.js.