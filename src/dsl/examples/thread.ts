import { Akteure, Logik, VerhaltenBuilder } from "../core/vokabular";
import type { WidgetDefinition } from "../core/typen";

export const diskussionsThread: WidgetDefinition = {
  id: "diskussions-thread",
  titel: "Feedback zur Sitzung",
  beschreibung: "Eine Nachricht mit Kommentarthread darunter.",
  rollen: ["Nutzer", "Ersteller"],

  wurzel: {
    typ: "Nachricht",
    text: "Wie fandet ihr die Sitzung heute?",
    // Haupt-Nachricht kann z.B. Reaktionen erlauben:
    verhalten: VerhaltenBuilder.nurNutzbarWenn(
      Logik.darf("Nutzer", Akteure.alle())
    ),
    kinder: [
      // Reaktions-Leiste (optional)
      {
        typ: "Liste",
        titel: "Reaktionen",
        kinder: [
          {
            typ: "Element",
            beschriftung: "👍 Gefällt mir",
            verhalten: VerhaltenBuilder.anklickbarEinfach("reaktionen"),
          },
          {
            typ: "Element",
            beschriftung: "💡 Gute Idee",
            verhalten: VerhaltenBuilder.anklickbarEinfach("reaktionen"),
          },
        ],
      },

      // Kommentar-Liste
      {
        typ: "Liste",
        titel: "Kommentare",
        kinder: [
          {
            typ: "Nachricht",
            text: "Ich fand sie gut, vor allem den Teil über die DSL.",
          },
          {
            typ: "Nachricht",
            text: "Mir war der Anfang etwas zu schnell.",
            // Antwort auf den Kommentar (verschachtelt)
            kinder: [
              {
                typ: "Nachricht",
                text: "Stimme zu, ein Beispiel mehr wäre hilfreich gewesen.",
              },
            ],
          },
        ],
      },
    ],
  },
};
