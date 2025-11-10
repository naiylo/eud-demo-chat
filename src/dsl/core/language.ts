export class Nachricht {
    abschliessbar: Ja | Nein;
    abgeschlossen: Ja | Nein;
    zitiert: Nachricht | null = null;
    formVal: Form | null = null;
    ersteller: Nutzer | null = null;

    constructor(params: NachrichtParams) {
        this.abschliessbar = params.abschliessbar;
        this.abgeschlossen = false;
    }

    form(form: Form): Nachricht {
        this.formVal = form;
        return this;
    }

    von(ersteller: Nutzer): Nachricht {
        this.ersteller = ersteller;
        return this;
    }

    abschliessen() {
        if (this.abschliessbar) {
            this.abgeschlossen = true;
        }
    }

    aufschliessen() {
        if (this.abschliessbar) {
            this.abgeschlossen = false;
        }
    }

    zitieren(): Nachricht {
        const nachricht = new Nachricht(this.abschliessbar);
        nachricht.zitiert = this;
        return nachricht;
    }

    senden(): Nachricht {
        return this;
    }
}

export type NachrichtParams = {

    abschliessbar: Ja | Nein;
}

export type Ja = true;
export type Nein = false;

export interface Form {


}

export class Karte implements Form {

    element: Liste | Element;

    constructor(element: Liste | Element) {
        this.element = element;
    }
}

export class Kreis implements Form {

    element: Liste | Element;

    constructor(element: Liste | Element) {
        this.element = element;
    }
}

export class Liste {
    eintraege: Element[] = [];

    neuerEintrag(element: Element) {
        this.eintraege.push(element);
    }

    eintragEntfernen(element: Element) {
        const index = this.eintraege.indexOf(element);
        if (index > -1) {
            this.eintraege.splice(index, 1);
        }
    }
}

export abstract class Element {
    abhakbar: Ja | Nein;
    abgehakt: Ja | Nein = false;

    constructor(abhakbar: Ja | Nein) {
        this.abhakbar = abhakbar;
    }

    abhaken() {
        if (this.abhakbar) {
            this.abgehakt = true;
        }
    }

    hakenLoeschen() {
        if (this.abhakbar) {
            this.abgehakt = false;
        }
    }
}

export class Text extends Element {
    inhalt: string;

    constructor(params: TextParams) {
        super(params.abhakbar);
        this.inhalt = params.inhalt;
    }

}

export type TextParams = {
    inhalt: string;
    abhakbar: Ja | Nein;
}

export class Bild extends Element {
    url: string;

    constructor(url: string, abhakbar: Ja | Nein) {
        super(abhakbar);
        this.url = url;
    }
}



export const abhakbar = "abhakbar";
export const abschliessbar = "abschliessbar";

export type Eigenschaft = typeof abhakbar | typeof abschliessbar;
export type Komponente = "Liste" | "Element" | "Listenelement" | "Nachricht";

class EigenschaftSetzen {

    eigenschaft: Eigenschaft;
    wert: Ja | Nein;

    constructor(eigenschaft: Eigenschaft, wert: Ja | Nein) {
        this.eigenschaft = eigenschaft;
        this.wert = wert;
    }

    setzen() {}
}

export class DarfEigenschaft {

    eigenschaft: Eigenschaft;

    constructor(eigenschaft: Eigenschaft) {
        this.eigenschaft = eigenschaft;
    }

    ja(): EigenschaftSetzen {}

    nein(): EigenschaftSetzen {}

    fuer(nutzer: Nutzer | Alle): DarfEigenschaft {}
}

export class DarfAbschliessen {

    abschliessen() {}

    aufschliessen() fuer(nutzer: Nutzer | Alle): DarfAbschliessen {}

    fuer(nutzer: Nutzer | Alle): DarfAbschliessen {}

}

export class DarfAbhaken {

    abhaken() {}

    mehrfach(): DarfAbhaken {}

    einfach(): DarfAbhaken {}

    fuer(nutzer: Nutzer | Alle): DarfAbhaken {}
}

export class Nutzer {

    name: string;
    darfVal: string[][] = [];

    constructor(name: string) {
        this.name = name;
    }

    darf(eigenschaft: Eigenschaft): DarfEigenschaft {}
    
    darf(eigenschaft: Komponente): DarfAbschliessen {}

    darf(eigenschaft: Komponente): DarfAbhaken {}

}

export class Alle {

    nutzer: Nutzer[];

    constructor(nutzer: Nutzer[]) {
        this.nutzer = nutzer;
    }

    ausser(nutzer: Nutzer): Alle {
        const gefilterteNutzer = this.nutzer.filter(n => n !== nutzer);
        return new Alle(gefilterteNutzer);
    }

    duerfen(eigenschaft: Eigenschaft): DarfEigenschaft {}
    
    duerfen(eigenschaft: Komponente): DarfAbschliessen {}

    duerfen(eigenschaft: Komponente): DarfAbhaken {}
}
