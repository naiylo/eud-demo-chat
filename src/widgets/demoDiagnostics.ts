import type { Message, Persona } from "../db/sqlite";
import { generateRandomFlow } from "../generator/fuzzer";
import type { Action } from "../generics/actions";
import type { ObjectSchema } from "../generics/objects";
import { widgetRegistry } from "./registry";

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
  run: (context: DemoScriptContext) => Promise<void>;
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

export const DEMO_STREAMS: Record<string, DemoStream[]> = {};

widgetRegistry.forEach((widget) => {
  DEMO_STREAMS[widget.type] = [];

  for (let i = 0; i < 10; i++) {
    DEMO_STREAMS[widget.type].push({
      id: `random-stream-${i + 1}`,
      label: `Random stream flow ${i + 1}`,
      summary: `Generates a randomized stream of actions for the widget.`,
      run: async (ctx) => {
        const personas = PREVIEW_PERSONAS.map((p) => p.id);
        await generateRandomFlow(ctx, personas);
      }
    });
  }
});

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
        await Promise.resolve();
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
  activeRuleIds?: string[]
): HeuristicFinding[] => {
  const activeRuleSet = activeRuleIds
    ? new Set(activeRuleIds)
    : null;

  return actions.flatMap((action) =>
    HEURISTIC_RULES.filter((rule) =>
      activeRuleSet ? activeRuleSet.has(rule.id) : true
    ).map((rule) => {
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
    }).filter(Boolean) as HeuristicFinding[]
  );
};
