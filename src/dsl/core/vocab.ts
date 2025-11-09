import type { LogicExpr, Role, ActorSet, Behavior } from "./types";

// Akteure

export const Akteure = {
  alle(): ActorSet {
    return { kind: "Alle" };
  },
  außer(...except: Role[]): ActorSet {
    return { kind: "Außer", except };
  },
  rolle(role: Role): ActorSet {
    return { kind: "Rolle", role };
  },
};

// Logische kombinatoren

export const Logik = {
  ja(): LogicExpr {
    return { op: "Ja" };
  },
  nein(): LogicExpr {
    return { op: "Nein" };
  },
  und(...args: LogicExpr[]): LogicExpr {
    return { op: "Und", args };
  },
  oder(...args: LogicExpr[]): LogicExpr {
    return { op: "Oder", args };
  },
  darf(role: Role, set: ActorSet): LogicExpr {
    return { op: "Darf", role, set };
  },
};

// Verhalten

function mergeBehavior(
  ...behaviors: (Behavior | undefined)[]
): Behavior | undefined {
  const result: Behavior = {};
  for (const b of behaviors) {
    if (!b) continue;
    result.checkable = { ...(result.checkable || {}), ...(b.checkable || {}) };
    result.completable = {
      ...(result.completable || {}),
      ...(b.completable || {}),
    };
    result.eligibility = {
      ...(result.eligibility || {}),
      ...(b.eligibility || {}),
    };
    result.visibility = {
      ...(result.visibility || {}),
      ...(b.visibility || {}),
    };
  }
  return Object.keys(result).length ? result : undefined;
}

export const Verhalten = {
  anklickbarSingle(groupId?: string): Behavior {
    return { checkable: { mode: "einfach", groupId } };
  },
  anklickbarMulti(groupId?: string): Behavior {
    return { checkable: { mode: "mehrfach", groupId } };
  },

  abschließbar(completeWhen?: LogicExpr): Behavior {
    return { completable: { completeWhen } };
  },

  nurSichtbarWenn(expr: LogicExpr): Behavior {
    return { visibility: { visibleWhen: expr } };
  },

  nurNutzbarWenn(expr: LogicExpr): Behavior {
    return { eligibility: { canActWhen: expr } };
  },

  kombi(...behaviors: (Behavior | undefined)[]): Behavior | undefined {
    return mergeBehavior(...behaviors);
  },
};
