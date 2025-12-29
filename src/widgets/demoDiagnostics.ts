import type { Message, Persona } from "../db/sqlite";

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
  actions: unknown;
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
    id: "deleteVote-multi",
    label: "deleteVote removed multiple votes",
    severity: "weird",
    evaluate: (action) => {
      const removedVotes = action.deleted.filter(
        (m) => m.type === "vote"
      ).length;
      return {
        hit: action.action === "deleteVote" && removedVotes > 1,
        detail: `Removed ${removedVotes} vote messages`,
      };
    },
  },
  {
    id: "addVote-noop",
    label: "addVote executed without DB change",
    severity: "warn",
    evaluate: (action) => ({
      hit:
        action.action === "addVote" &&
        action.added.length === 0 &&
        action.deleted.length === 0 &&
        action.beforeCount === action.afterCount,
      detail: "Action returned but did not persist a vote",
    }),
  },
  {
    id: "createPoll-multi",
    label: "createPoll produced multiple records",
    severity: "warn",
    evaluate: (action) => {
      const pollsCreated = action.added.filter(
        (m) => m.type === "createPoll"
      ).length;
      return {
        hit: action.action === "createPoll" && pollsCreated > 1,
        detail: `Created ${pollsCreated} poll payloads`,
      };
    },
  },
];

export const DEMO_STREAMS: Record<string, DemoStream[]> = {
  createPoll: [
    {
      id: "one-poll",
      label: "Single poll flow",
      summary: "Creates a poll, collects votes, and deletes one vote.",
      run: async ({ actions, wait, getMessages }) => {
        const pollActions = actions as {
          createPoll?: (
            poll: { prompt: string; options: { id: string; label: string }[] },
            authorId: string
          ) => Promise<string | undefined>;
          addVote?: (
            pollId: string,
            optionId: string,
            authorId: string
          ) => Promise<void>;
          deleteVote?: (pollId: string, authorId: string) => Promise<void>;
        };

        const prompt = "Product direction";
        const options = [
          { id: "opt-preview-a", label: "Ship MVP" },
          { id: "opt-preview-b", label: "Polish for two more weeks" },
        ];

        const createAndResolveId = async (
          p: string,
          opts: { id: string; label: string }[]
        ) => {
          const createdId = await pollActions.createPoll(
            { prompt: p, options: opts },
            "engineer"
          );
          return (
            createdId ??
            getMessages().find(
              (m) =>
                m.type === "createPoll" &&
                typeof (m.custom as any)?.prompt === "string" &&
                (m.custom as any).prompt === p
            )?.id
          );
        };

        const pollId = await createAndResolveId(prompt, options);

        await wait(5);
        await pollActions.addVote(pollId, "opt-preview-a", "engineer");
        await wait(5);
        await pollActions.addVote(pollId, "opt-preview-b", "designer");
        await wait(5);
        await pollActions.addVote(pollId, "opt-preview-a", "chief");
        await wait(5);
        await pollActions.deleteVote(pollId, "designer");
        await wait(0);
      },
    },
    {
      id: "two-polls",
      label: "Two polls flow",
      summary: "Creates two polls with votes across both threads.",
      run: async ({ actions, wait, getMessages }) => {
        const pollActions = actions as {
          createPoll?: (
            poll: { prompt: string; options: { id: string; label: string }[] },
            authorId: string
          ) => Promise<string | undefined>;
          addVote?: (
            pollId: string,
            optionId: string,
            authorId: string
          ) => Promise<void>;
          deleteVote?: (pollId: string, authorId: string) => Promise<void>;
        };

        const prompt = "Product direction";
        const options = [
          { id: "opt-preview-a", label: "Ship MVP" },
          { id: "opt-preview-b", label: "Polish for two more weeks" },
        ];

        const prompt2 = "Design direction";
        const options2 = [
          { id: "opt-preview-c", label: "Keep current look" },
          { id: "opt-preview-d", label: "Refresh theme" },
        ];

        const createAndResolveId = async (
          p: string,
          opts: { id: string; label: string }[]
        ) => {
          const createdId = await pollActions.createPoll(
            { prompt: p, options: opts },
            "engineer"
          );
          return (
            createdId ??
            getMessages().find(
              (m) =>
                m.type === "createPoll" &&
                typeof (m.custom as any)?.prompt === "string" &&
                (m.custom as any).prompt === p
            )?.id
          );
        };

        const pollId = await createAndResolveId(prompt, options);
        await wait(5);
        const pollId2 = await createAndResolveId(prompt2, options2);

        await wait(5);
        await pollActions.addVote(pollId, "opt-preview-a", "engineer");
        await wait(5);
        await pollActions.addVote(pollId, "opt-preview-b", "designer");
        await wait(5);
        await pollActions.addVote(pollId, "opt-preview-a", "chief");
        await wait(5);
        await pollActions.addVote(pollId2, "opt-preview-d", "designer");
        await wait(5);
        await pollActions.addVote(pollId2, "opt-preview-d", "chief");
        await wait(5);
        await pollActions.deleteVote(pollId, "designer");
        await wait(0);
      },
    },
  ],
};

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

  wrap<T extends Record<string, any>>(actions: T): T {
    const wrapped: Record<string, any> = {};

    Object.entries(actions).forEach(([key, value]) => {
      if (typeof value !== "function") {
        wrapped[key] = value;
        return;
      }

      wrapped[key] = async (...args: any[]) => {
        const before = [...this.getSnapshot()];
        const result = await value(...args);
        await Promise.resolve();
        const after = [...this.getSnapshot()];

        const added = after.filter((a) => !before.some((b) => b.id === a.id));
        const deleted = before.filter((b) => !after.some((a) => a.id === b.id));

        this.onChange({
          action: key,
          added,
          deleted,
          beforeCount: before.length,
          afterCount: after.length,
        });

        return result;
      };
    });

    return wrapped as T;
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
