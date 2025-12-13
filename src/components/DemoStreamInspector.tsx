import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { Message, Persona } from "../db/sqlite";
import type { ChatWidgetDefinition } from "../widgets/types";

export type DemoInspectorVariant = "inspector" | "database" | "wire" | "personas";

export type DemoActionInsight = {
  id: string;
  action: string;
  added: Message[];
  deleted: Message[];
  beforeCount: number;
  afterCount: number;
  order: number;
  timestamp: number;
};

type HeuristicRule = {
  id: string;
  label: string;
  severity: "warn" | "weird";
  evaluate: (action: DemoActionInsight) => { hit: boolean; detail?: string };
};

type HeuristicFinding = {
  id: string;
  ruleId: string;
  label: string;
  severity: "warn" | "weird";
  detail?: string;
  actionId: string;
  actionOrder: number;
};

// Central place to adjust anomaly detection without touching rendering logic.
const HEURISTIC_RULES: HeuristicRule[] = [
  {
    id: "delete-multi-vote",
    label: "deleteVote removed multiple votes",
    severity: "weird",
    evaluate: (action) => {
      const removedVotes = action.deleted.filter((m) => m.type === "vote").length;
      return {
        hit: action.action === "deleteVote" && removedVotes > 1,
        detail: `Removed ${removedVotes} vote messages`,
      };
    },
  },
  {
    id: "addvote-noop",
    label: "addVote made no database change",
    severity: "warn",
    evaluate: (action) => ({
      hit:
        action.action === "addVote" &&
        action.added.length === 0 &&
        action.deleted.length === 0,
      detail: "Action executed without persisting a vote",
    }),
  },
  {
    id: "create-multi",
    label: "createPoll created multiple payloads",
    severity: "warn",
    evaluate: (action) => {
      const pollsCreated = action.added.filter((m) => m.type === "createPoll").length;
      return {
        hit: action.action === "createPoll" && pollsCreated > 1,
        detail: `Created ${pollsCreated} poll payloads`,
      };
    },
  },
];

const summarizeTypes = (messages: Message[]) => {
  const counts = messages.reduce<Record<string, number>>((acc, msg) => {
    acc[msg.type] = (acc[msg.type] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");
};

const describeImpact = (action: DemoActionInsight) => {
  const pieces: string[] = [];
  if (action.added.length) {
    pieces.push(`added ${action.added.length} (${summarizeTypes(action.added)})`);
  }
  if (action.deleted.length) {
    pieces.push(
      `removed ${action.deleted.length} (${summarizeTypes(action.deleted)})`
    );
  }
  if (!pieces.length) return "no database impact recorded";
  return pieces.join(" | ");
};

export function DemoStreamInspector({
  widget,
  personas,
  messages,
  visibleMessages,
  actions,
  onNavigateVariant,
  onReplay,
  widgetActions,
}: {
  widget: ChatWidgetDefinition;
  personas: Persona[];
  messages: Message[];
  visibleMessages: Message[];
  actions: DemoActionInsight[];
  onNavigateVariant: Dispatch<SetStateAction<DemoInspectorVariant>>;
  onReplay: () => void;
  widgetActions: unknown;
}) {
  const renderer = widget.elements?.render ?? (widget as any)?.render;

  const personaLookup = useMemo(
    () =>
      Object.fromEntries(personas.map((p) => [p.id, p])) as Record<
        string,
        Persona
      >,
    [personas]
  );

  const messageSourceMap = useMemo(() => {
    const map = new Map<string, DemoActionInsight>();
    actions.forEach((action) => {
      action.added.forEach((msg) => map.set(msg.id, action));
    });
    return map;
  }, [actions]);

  const heuristicFindings = useMemo<HeuristicFinding[]>(() => {
    return actions.flatMap((action) =>
      HEURISTIC_RULES.map((rule) => {
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
  }, [actions]);

  const heuristicsByAction = useMemo(() => {
    const map = new Map<string, HeuristicFinding[]>();
    heuristicFindings.forEach((finding) => {
      const bucket = map.get(finding.actionId) ?? [];
      bucket.push(finding);
      map.set(finding.actionId, bucket);
    });
    return map;
  }, [heuristicFindings]);

  const totals = useMemo(
    () => ({
      actions: actions.length,
      added: actions.reduce((sum, action) => sum + action.added.length, 0),
      removed: actions.reduce((sum, action) => sum + action.deleted.length, 0),
    }),
    [actions]
  );

  const renderSnapshot = () => {
    if (!renderer) {
      return <p className="widget-preview__placeholder">Widget renderer missing.</p>;
    }
    if (!messages.length) {
      return (
        <p className="widget-preview__placeholder">
          Run the sample to capture a snapshot of the rendered widget.
        </p>
      );
    }
    if (!visibleMessages.length) {
      return (
        <p className="widget-preview__placeholder">
          All current messages are hidden by this widget&apos;s rules.
        </p>
      );
    }

    return visibleMessages.map((msg) => {
      const source = messageSourceMap.get(msg.id);
      const flagged =
        source ? (heuristicsByAction.get(source.id)?.length ?? 0) > 0 : false;
      const hidden = widget.hideMessage?.(msg) ?? false;
      const persona = personaLookup[msg.authorId];
      return (
        <div
          key={msg.id}
          className={`demo-inspector__message ${
            hidden ? "demo-inspector__message--hidden" : ""
          } ${flagged ? "demo-inspector__message--alert" : ""}`}
        >
          <span className="demo-inspector__badge">#{source?.order ?? "•"}</span>
          {renderer({
            message: msg,
            allMessages: messages,
            personas,
            currentActorId: msg.authorId,
            actions: widgetActions as any,
          })}
          <div className="demo-inspector__message-meta">
            <span className="demo-inspector__tag">{msg.type}</span>
            <span className="demo-inspector__meta-pill">
              {persona?.name ?? msg.authorId}
            </span>
          </div>
        </div>
      );
    });
  };

  const renderTimeline = () => {
    if (!actions.length) {
      return (
        <p className="widget-preview__placeholder">
          Timeline will list every demo action with its database and widget impact.
        </p>
      );
    }

    return actions.map((action) => {
      const findings = heuristicsByAction.get(action.id) ?? [];
      const visibleAdded = action.added.filter(
        (m) => !(widget.hideMessage?.(m) ?? false)
      ).length;
      const hiddenAdded = action.added.length - visibleAdded;
      const visibleRemoved = action.deleted.filter(
        (m) => !(widget.hideMessage?.(m) ?? false)
      ).length;
      const widgetNotes: string[] = [];
      if (visibleAdded) widgetNotes.push(`${visibleAdded} visible`);
      if (hiddenAdded) widgetNotes.push(`${hiddenAdded} suppressed`);
      if (visibleRemoved) widgetNotes.push(`${visibleRemoved} removed from view`);
      const widgetNote = widgetNotes.length
        ? widgetNotes.join(", ")
        : "no visible change";

      return (
        <div
          key={action.id}
          className={`demo-timeline__item ${
            findings.length ? "demo-timeline__item--alert" : ""
          }`}
        >
          <div className="demo-timeline__order">#{action.order}</div>
          <div className="demo-timeline__content">
            <div className="demo-timeline__row">
              <strong>{action.action}</strong>
              <span className="demo-inspector__pill">
                Δ {action.afterCount - action.beforeCount}
              </span>
            </div>
            <p className="demo-timeline__impact">{describeImpact(action)}</p>
            <p className="demo-timeline__widget">Widget: {widgetNote}</p>
            {!!findings.length && (
              <div className="demo-timeline__findings">
                {findings.map((finding) => (
                  <span
                    key={finding.id}
                    className={`demo-heuristic ${
                      finding.severity === "weird"
                        ? "demo-heuristic--alert"
                        : "demo-heuristic--warn"
                    }`}
                  >
                    {finding.label}
                    {finding.detail ? ` — ${finding.detail}` : ""}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <div className="demo-inspector demo-inspector--split">
      <div className="demo-inspector__left">
        <header className="demo-inspector__headline">
          <div>
            <p className="widget-preview__label">Demo stream inspector</p>
            <p className="widget-preview__hint">
              Purpose-built for traceability: database stats, heuristics, and a
              widget-linked action trail.
            </p>
          </div>
          <div className="demo-inspector__cta">
            <button
              type="button"
              className="widget-preview__play"
              onClick={onReplay}
            >
              Replay demo
            </button>
          </div>
        </header>

        <section className="demo-inspector__section demo-inspector__section--snapshot">
          <div className="demo-inspector__snapshot">{renderSnapshot()}</div>
          <div className="demo-inspector__stat-panel">
            <div className="demo-inspector__stat-cards">
              <div className="demo-stat-card">
                <p className="demo-stat-card__label">Actions run</p>
                <p className="demo-stat-card__value">{totals.actions}</p>
              </div>
              <div className="demo-stat-card">
                <p className="demo-stat-card__label">Records created</p>
                <p className="demo-stat-card__value">{totals.added}</p>
              </div>
              <div className="demo-stat-card">
                <p className="demo-stat-card__label">Records removed</p>
                <p className="demo-stat-card__value">{totals.removed}</p>
              </div>
              <div className="demo-stat-card">
                <p className="demo-stat-card__label">Net change</p>
                <p className="demo-stat-card__value">
                  {totals.added - totals.removed}
                </p>
              </div>
            </div>

            <div className="demo-inspector__stat-list">
              <h4>Database impact per action</h4>
              <div className="demo-inspector__stat-rows">
                {actions.length === 0 && (
                  <p className="widget-preview__placeholder">
                    No actions recorded yet. Run the demo to populate this table.
                  </p>
                )}
                {actions.map((action) => (
                  <div key={action.id} className="demo-stat-row">
                    <span className="demo-inspector__badge">#{action.order}</span>
                    <div>
                      <p className="demo-stat-row__title">{action.action}</p>
                      <p className="demo-stat-row__desc">
                        {describeImpact(action)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="demo-inspector__section demo-inspector__section--heuristics">
          <div className="demo-inspector__section-header">
            <h4>Heuristics</h4>
            <p className="demo-inspector__note">
              Rules run on every action; flagged items appear immediately.
            </p>
          </div>
          {heuristicFindings.length === 0 ? (
            <p className="widget-preview__placeholder">
              No anomalies flagged. Adjust rules inside the inspector component to
              track other behaviors.
            </p>
          ) : (
            <div className="demo-inspector__heuristics-grid">
              {heuristicFindings.map((finding) => (
                <div
                  key={finding.id}
                  className={`demo-heuristic ${
                    finding.severity === "weird"
                      ? "demo-heuristic--alert"
                      : "demo-heuristic--warn"
                  }`}
                >
                  <div className="demo-heuristic__header">
                    <span className="demo-inspector__badge">
                      #{finding.actionOrder}
                    </span>
                    <span className="demo-heuristic__label">
                      {finding.label}
                    </span>
                  </div>
                  {finding.detail && (
                    <p className="demo-heuristic__detail">{finding.detail}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="demo-inspector__section demo-inspector__section--nav">
          <div>
            <h4>Jump to existing demo views</h4>
            <p className="demo-inspector__note">
              Navigate with the same run and dataset — context is preserved.
            </p>
          </div>
          <div className="demo-inspector__nav-buttons">
            <button type="button" onClick={() => onNavigateVariant("database")}>
              Open database view
            </button>
            <button type="button" onClick={() => onNavigateVariant("wire")}>
              Open wire view
            </button>
            <button type="button" onClick={() => onNavigateVariant("personas")}>
              Open persona focus
            </button>
          </div>
        </section>
      </div>

      <aside className="demo-inspector__timeline-pane">
        <div className="demo-inspector__section-header demo-inspector__timeline-header">
          <div>
            <h4>Action timeline</h4>
            <p className="demo-inspector__note">
              Chronological list of the actions that produced the snapshot with
              explicit database and widget impact.
            </p>
          </div>
          <span className="demo-inspector__pill">Total {actions.length}</span>
        </div>
        <div className="demo-inspector__timeline">{renderTimeline()}</div>
      </aside>
    </div>
  );
}
