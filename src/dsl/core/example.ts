import { Alle, Karte, Liste, Nachricht, Nutzer, Text } from "./language";

let ersteller = new Nutzer("Sebastian");
let alle = new Alle([ersteller]);

let nachricht = new Nachricht({ abschliessbar: true}).von(ersteller);
let liste = new Liste();

let eintrag1 = new Text({ inhalt: "Eintrag 1", abhakbar: true });
let eintrag2 = new Text({ inhalt: "Eintrag 2", abhakbar: true });
let eintrag3 = new Text({ inhalt: "Eintrag 3", abhakbar: true });

liste.neuerEintrag(eintrag1);
liste.neuerEintrag(eintrag2);
liste.neuerEintrag(eintrag3);

nachricht.form(new Karte(liste));
ersteller.darf(nachricht).fuer(alle).abschliessen();
ersteller.darf(nachricht).fuer(alle).aufschliessen();

for nutzer in alle {
    nutzer.darf(eintrag1).fuer(nutzer).einfach().abhaken();
    nutzer.darf(eintrag2).fuer(nutzer).einfach().abhaken();
    nutzer.darf(eintrag3).fuer(nutzer).einfach().abhaken();
    nutzer.darf(liste).fuer(nutzer).einfach().abhaken(); // Pro Liste nur ein Element abhaken
}

nachricht.senden();
