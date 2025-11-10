import { VerhaltenBuilder, Logik, Akteure } from "../core/vokabular";
import type { WidgetDefinition } from "../core/typen";

export const einfacheNachricht: WidgetDefinition = {
  id: "willkommen",
  titel: "Willkommensnachricht",
  beschreibung: "Begrüßungstext für alle Nutzer*innen.",
  rollen: ["Nutzer", "Ersteller"],

  wurzel: {
    typ: "Nachricht",
    text: "Willkommen bei unserem Projekt! Schön, dass du da bist.",
    // Optionales Verhalten (hier sichtbar für alle):
    verhalten: VerhaltenBuilder.nurSichtbarWenn(
      Logik.darf("Nutzer", Akteure.alle())
    ),
  },
};
