import { Akteure, Logik, VerhaltenBuilder } from "../core/vokabular";
import type { WidgetDefinition } from "../core/typen";

// 🧺 Beispiel: Einkaufsliste
// -------------------------------------------------------
// Beschreibung:
// Eine Nachricht, die eine Liste von Elementen enthält.
// Jedes Element ist "einfach" anklickbar (also ein Hakenfeld),
// und darf von allen Nutzer*innen betätigt werden.
// -------------------------------------------------------

export const einkaufsliste: WidgetDefinition = {
  id: "einkaufsliste",
  titel: "Einkaufsliste",
  beschreibung: "Eine einfache Liste zum gemeinsamen Abhaken von Artikeln.",
  rollen: ["Nutzer", "Ersteller"],

  wurzel: {
    typ: "Nachricht",
    kinder: [
      {
        typ: "Liste",
        titel: "Zu besorgen",
        kinder: [
          {
            typ: "Element",
            beschriftung: "Milch",
            verhalten: VerhaltenBuilder.kombi(
              VerhaltenBuilder.anklickbarEinfach("einkauf"),
              VerhaltenBuilder.nurNutzbarWenn(
                Logik.darf("Nutzer", Akteure.alle())
              )
            ),
          },
          {
            typ: "Element",
            beschriftung: "Brot",
            verhalten: VerhaltenBuilder.kombi(
              VerhaltenBuilder.anklickbarEinfach("einkauf"),
              VerhaltenBuilder.nurNutzbarWenn(
                Logik.darf("Nutzer", Akteure.alle())
              )
            ),
          },
          {
            typ: "Element",
            beschriftung: "Butter",
            verhalten: VerhaltenBuilder.kombi(
              VerhaltenBuilder.anklickbarEinfach("einkauf"),
              VerhaltenBuilder.nurNutzbarWenn(
                Logik.darf("Nutzer", Akteure.alle())
              )
            ),
          },
        ],
      },
    ],
  },
};
