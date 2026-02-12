import type { Message, Persona } from "../db/sqlite";
import { generateRandomFlow } from "../generator/fuzzer";
import type { Action, ActionLogEntry } from "../generics/actions";
import {
  isObjectInstance,
  type ObjectInstance,
  type ObjectSchema,
  type PropertyDefinition,
} from "../generics/objects";
import type { HeuristicDisableMap } from "./types";

export const PREVIEW_PERSONAS: Persona[] = [
  { id: "designer", name: "Oskar", color: "#e86a92", bio: "" },
  { id: "engineer", name: "Sebastian", color: "#0075ff", bio: "" },
  { id: "chief", name: "Tom", color: "#00a676", bio: "" },
];

export type DemoActionImpact = {
  id: string;
  action: string;
  actors: string[];
  added: Message[];
  deleted: Message[];
  beforeCount: number;
  afterCount: number;
  order: number;
  timestamp: number;
};

export type HeuristicRule = {
  id: string;
  label: string;
  severity: "warn" | "weird";
  evaluate: (action: DemoActionImpact) => { hit: boolean; detail?: string };
};

export type HeuristicFinding = {
  id: string;
  ruleId: string;
  label: string;
  severity: "warn" | "weird";
  detail?: string;
  actionId: string;
  actionOrder: number;
};

export type DemoScriptContext = {
  actions: Action[];
  schemas: ObjectSchema[],
  wait: (ms: number) => Promise<void>;
  getMessages: () => Message[];
};

export type DemoStream = {
  id: string;
  label: string;
  summary: string;
  run: (context: DemoScriptContext) => Promise<ActionLogEntry[] | void>;
};

export const HEURISTIC_RULES: HeuristicRule[] = [
  {
    id: "deleted-multiple-messages",
    label: "Action removed multiple messages",
    severity: "weird",
    evaluate: (action) => {
      const removed = action.deleted.length;
      return {
        hit: removed > 1,
        detail: `Removed ${removed} messages`,
      };
    },
  },
  {
    id: "no-db-change",
    label: "Action executed without DB change",
    severity: "warn",
    evaluate: (action) => ({
      hit:
        action.added.length === 0 &&
        action.deleted.length === 0 &&
        action.beforeCount === action.afterCount,
      detail: "Action returned but did not persist a change to the database",
    }),
  },
  {
    id: "multiple-identical-messages",
    label: "Action created multiple identical messages",
    severity: "warn",
    evaluate: (action) => {
      const messagesCreated = action.added.length;
      return {
        hit: messagesCreated > 1 && new Set(action.added.map((m) => m.text)).size === 1,
        detail: `Created ${messagesCreated} identical messages`,
      };
    },
  },
  {
    id: "empty-message-created",
    label: "Action created empty message(s)",
    severity: "weird",
    evaluate: (action) => {
      const messagesCreated = action.added.length;
      return {
        hit: messagesCreated > 0 && action.added.some((m) => m.text.trim() === ""),
        detail: `Created ${messagesCreated} empty message(s)`,
      };
    },
  },
];

export const DEMO_STREAMS: DemoStream[] = [];

for (let i = 0; i < 100; i++) {
  DEMO_STREAMS.push({
    id: `random-stream-${i + 1}`,
    label: `Stream ${i + 1}`,
    summary: `Generates a randomized stream of actions for the widget.`,
    run: async (ctx) => {
      const personas = PREVIEW_PERSONAS.map((p) => p.id);
      return await generateRandomFlow(ctx, personas);
    }
  });
}

export class DemoDatabaseObserver {
  private getSnapshot: () => Message[];
  private onChange: (info: {
    action: string;
    added: Message[];
    deleted: Message[];
    beforeCount: number;
    afterCount: number;
  }) => void;

  constructor(
    getSnapshot: () => Message[],
    onChange: (info: {
      action: string;
      added: Message[];
      deleted: Message[];
      beforeCount: number;
      afterCount: number;
    }) => void
  ) {
    this.getSnapshot = getSnapshot;
    this.onChange = onChange;
  }

  wrap(actions: Action[]): Action[] {
    actions.forEach((action) => {
      const originalExecute = action.execute;
      action.execute = async (input) => {
        const before = [...this.getSnapshot()];
        const result = await originalExecute.call(action, input);
        const after = [...this.getSnapshot()];

        const added = after.filter((a) => !before.some((b) => b.id === a.id));
        const deleted = before.filter((b) => !after.some((a) => a.id === b.id));

        this.onChange({
          action: action.name,
          added,
          deleted,
          beforeCount: before.length,
          afterCount: after.length,
        });

        return result;
      };
    });

    return actions;
  }
}

export const evaluateHeuristicFindings = (
  actions: DemoActionImpact[],
  activeRuleIds?: string[],
  disabledHeuristicsByAction?: HeuristicDisableMap
): HeuristicFinding[] => {
  const activeRuleSet = activeRuleIds
    ? new Set(activeRuleIds)
    : null;

  return actions.flatMap((action) => {
    const disabledForAll = disabledHeuristicsByAction?.all ?? [];
    const disabledForAction = disabledHeuristicsByAction?.[action.action] ?? [];
    const disabledRuleSet =
      disabledForAll.length || disabledForAction.length
        ? new Set([...disabledForAll, ...disabledForAction])
        : null;

    return HEURISTIC_RULES.filter((rule) =>
      activeRuleSet ? activeRuleSet.has(rule.id) : true
    )
      .filter((rule) => !(disabledRuleSet?.has(rule.id) ?? false))
      .map((rule) => {
        const result = rule.evaluate(action);
        if (!result.hit) return null;
        return {
          id: `${rule.id}-${action.id}`,
          ruleId: rule.id,
          label: rule.label,
          severity: rule.severity,
          detail: result.detail,
          actionId: action.id,
          actionOrder: action.order,
        } as HeuristicFinding;
      })
      .filter(Boolean) as HeuristicFinding[];
  });
};

export const minimizeActionLog = (
  actions: DemoActionImpact[],
  findings: HeuristicFinding[]
): DemoActionImpact[] => {
  if (findings.length === 0) return actions;

  const actionById = new Map(actions.map((action) => [action.id, action]));
  const messageCreationMap = new Map<string, string>();
  actions.forEach((action) => {
    action.added.forEach((msg) => {
      messageCreationMap.set(msg.id, action.id);
    });
  });
  const selectedActionIds = new Set<string>();
  const selectedRuleIds = new Set<string>();
  const orderedFindings = [...findings].sort(
    (left, right) => left.actionOrder - right.actionOrder
  );

  for (const finding of orderedFindings) {
    if (selectedRuleIds.has(finding.ruleId)) continue;
    const action = actionById.get(finding.actionId);
    if (!action) continue;
    selectedActionIds.add(action.id);
    selectedRuleIds.add(finding.ruleId);
  }

  if (selectedActionIds.size === 0) return actions;

  const collectReferencesFromProperty = (
    propDef: PropertyDefinition,
    value: unknown,
    out: Set<string>
  ) => {
    if (value == null) return;
    if (propDef.type === "reference") {
      if (propDef.array && Array.isArray(value)) {
        value.forEach((entry) => {
          if (typeof entry === "string") out.add(entry);
        });
        return;
      }
      if (typeof value === "string") out.add(value);
      return;
    }
    if (propDef.type === "object" && propDef.schema) {
      if (propDef.array && Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === "object") {
            Object.values(propDef.schema!).forEach((subProp) =>
              collectReferencesFromProperty(
                subProp,
                (entry as Record<string, unknown>)[subProp.name],
                out
              )
            );
          }
        });
        return;
      }
      if (value && typeof value === "object") {
        Object.values(propDef.schema).forEach((subProp) =>
          collectReferencesFromProperty(
            subProp,
            (value as Record<string, unknown>)[subProp.name],
            out
          )
        );
      }
    }
  };

  const collectReferencesFromInstance = (instance: ObjectInstance) => {
    const refs = new Set<string>();
    instance.schema.properties.forEach((propDef) => {
      collectReferencesFromProperty(
        propDef,
        instance.properties[propDef.name],
        refs
      );
    });
    return refs;
  };

  const collectDependencyActionIds = (action: DemoActionImpact) => {
    const deps = new Set<string>();
    const inspectMessage = (message: Message) => {
      if (!message.custom || !isObjectInstance(message.custom)) return;
      const refs = collectReferencesFromInstance(message.custom);
      refs.forEach((refId) => {
        const creatorId = messageCreationMap.get(refId);
        if (creatorId) deps.add(creatorId);
      });
    };

    action.added.forEach(inspectMessage);
    action.deleted.forEach((message) => {
      const creatorId = messageCreationMap.get(message.id);
      if (creatorId) deps.add(creatorId);
      inspectMessage(message);
    });

    return deps;
  };

  const queue = Array.from(selectedActionIds);
  while (queue.length > 0) {
    const actionId = queue.shift();
    if (!actionId) continue;
    const action = actionById.get(actionId);
    if (!action) continue;
    const deps = collectDependencyActionIds(action);
    deps.forEach((depId) => {
      if (selectedActionIds.has(depId)) return;
      selectedActionIds.add(depId);
      queue.push(depId);
    });
  }

  return actions.filter((action) => selectedActionIds.has(action.id));
};
