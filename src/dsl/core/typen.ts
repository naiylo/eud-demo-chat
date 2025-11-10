// Rollen & Akteure

export type Rolle = "Nutzer" | "Ersteller";

export type AkteursMenge =
  | { art: "Alle" }
  | { art: "Ausser"; ausgeschlossen: Rolle[] }
  | { art: "Rolle"; rolle: Rolle };

// Logische Ausdrücke

export type LogikAusdruck =
  | { op: "Ja" }
  | { op: "Nein" }
  | { op: "Oder"; argumente: LogikAusdruck[] }
  | { op: "Und"; argumente: LogikAusdruck[] }
  | { op: "Darf"; rolle: Rolle; menge: AkteursMenge };

// Verhalten / Regeln

export type AuswahlModus = "einfach" | "mehrfach";

export type Verhalten = {
  anklickbar?: {
    modus?: AuswahlModus;
    gruppenId?: string;
    standardAngeklickt?: boolean;
  };
  abschliessbar?: {
    // Wann gilt das Element/Widget als "fertig"?
    wenn?: LogikAusdruck;
  };
  nutzbar?: {
    // Wer darf interagieren?
    wenn?: LogikAusdruck;
  };
  sichtbar?: {
    // Wann ist sichtbar?
    wenn?: LogikAusdruck;
  };
};

// Node-Typen

export type KnotenTyp =
  | "Nachricht"
  | "Zitat"
  | "Form"
  | "Kreis"
  | "Liste"
  | "Element"
  | "Medien"
  | "Text";

// Basis-Knoten

export interface WidgetKnotenBasis {
  id?: string;
  typ: KnotenTyp;
  verhalten?: Verhalten;
  kinder?: WidgetKnoten[];
}

// Spezialisierte Knoten

export interface TextKnoten extends WidgetKnotenBasis {
  typ: "Text" | "Nachricht" | "Zitat";
  text: string;
}

export interface MedienKnoten extends WidgetKnotenBasis {
  typ: "Medien";
  medienUrl: string;
  altText?: string;
}

export interface ListenKnoten extends WidgetKnotenBasis {
  typ: "Liste";
  titel?: string;
}

export interface ElementKnoten extends WidgetKnotenBasis {
  typ: "Element";
  beschriftung?: string;
  text?: string;
}

export interface FormularKnoten extends WidgetKnotenBasis {
  typ: "Form";
  titel?: string;
}

export interface KreisKnoten extends WidgetKnotenBasis {
  typ: "Kreis";
  titel?: string;
  untertitel?: string;
}

// Sammeltyp für alle Knoten

export type WidgetKnoten =
  | TextKnoten
  | MedienKnoten
  | ListenKnoten
  | ElementKnoten
  | FormularKnoten
  | KreisKnoten
  | WidgetKnotenBasis;

// Widget-Definition

export interface WidgetDefinition {
  id: string;
  titel: string;
  beschreibung?: string;
  wurzel: WidgetKnoten;
  rollen?: Rolle[];
}
