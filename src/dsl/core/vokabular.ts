import type { LogikAusdruck, Rolle, AkteursMenge, Verhalten } from "./typen";

// Akteure

export const Akteure = {
  alle(): AkteursMenge {
    return { art: "Alle" };
  },
  ausser(...ausgeschlossen: Rolle[]): AkteursMenge {
    return { art: "Ausser", ausgeschlossen };
  },
  rolle(rolle: Rolle): AkteursMenge {
    return { art: "Rolle", rolle };
  },
};

// Logische Kombinatoren

export const Logik = {
  ja(): LogikAusdruck {
    return { op: "Ja" };
  },
  nein(): LogikAusdruck {
    return { op: "Nein" };
  },
  und(...argumente: LogikAusdruck[]): LogikAusdruck {
    return { op: "Und", argumente };
  },
  oder(...argumente: LogikAusdruck[]): LogikAusdruck {
    return { op: "Oder", argumente };
  },
  darf(rolle: Rolle, menge: AkteursMenge): LogikAusdruck {
    return { op: "Darf", rolle, menge };
  },
};

// Verhalten

function kombiniereVerhalten(
  ...werte: (Verhalten | undefined)[]
): Verhalten | undefined {
  const ergebnis: Verhalten = {};
  for (const v of werte) {
    if (!v) continue;
    ergebnis.anklickbar = {
      ...(ergebnis.anklickbar || {}),
      ...(v.anklickbar || {}),
    };
    ergebnis.abschliessbar = {
      ...(ergebnis.abschliessbar || {}),
      ...(v.abschliessbar || {}),
    };
    ergebnis.nutzbar = {
      ...(ergebnis.nutzbar || {}),
      ...(v.nutzbar || {}),
    };
    ergebnis.sichtbar = {
      ...(ergebnis.sichtbar || {}),
      ...(v.sichtbar || {}),
    };
  }
  return Object.keys(ergebnis).length ? ergebnis : undefined;
}

export const VerhaltenBuilder = {
  anklickbarEinfach(gruppenId?: string): Verhalten {
    return { anklickbar: { modus: "einfach", gruppenId } };
  },

  anklickbarMehrfach(gruppenId?: string): Verhalten {
    return { anklickbar: { modus: "mehrfach", gruppenId } };
  },

  abschliessbar(wenn?: LogikAusdruck): Verhalten {
    return { abschliessbar: { wenn } };
  },

  nurSichtbarWenn(expr: LogikAusdruck): Verhalten {
    return { sichtbar: { wenn: expr } };
  },

  nurNutzbarWenn(expr: LogikAusdruck): Verhalten {
    return { nutzbar: { wenn: expr } };
  },

  kombi(...werte: (Verhalten | undefined)[]): Verhalten | undefined {
    return kombiniereVerhalten(...werte);
  },
};
