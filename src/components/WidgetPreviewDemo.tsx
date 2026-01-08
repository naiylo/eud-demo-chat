import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message, Persona } from "../db/sqlite";
import type { ChatWidgetDefinition } from "../widgets/types";
import {
  DEMO_STREAMS,
  HEURISTIC_RULES,
  PREVIEW_PERSONAS,
  DemoDatabaseObserver,
  evaluateHeuristicFindings,
} from "../widgets/demoDiagnostics";
import type {
  DemoActionImpact,
  HeuristicFinding,
} from "../widgets/demoDiagnostics";

const summarizeTypes = (messages: Message[]) => {
  const counts = messages.reduce<Record<string, number>>((acc, msg) => {
    acc[msg.type] = (acc[msg.type] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");
};

const describeImpact = (action: DemoActionImpact) => {
  const parts: string[] = [];
  if (action.added.length)
    parts.push(
      `created ${action.added.length} (${summarizeTypes(action.added)})`
    );
  if (action.deleted.length)
    parts.push(
      `removed ${action.deleted.length} (${summarizeTypes(action.deleted)})`
    );
  return parts.length ? parts.join(" | ") : "no database impact recorded";
};



export function WidgetPreviewDemo({
  widget,
  onClose,
  onOpenDatabaseView,
  onOpenUserDemo,
  streamFilter,
  initialStreamId,
  activeRuleIds,
}: {
  widget: ChatWidgetDefinition;
  onClose: () => void;
  onOpenDatabaseView?: (payload: {
    messages: Message[];
    actions: DemoActionImpact[];
  }) => void;
  onOpenUserDemo?: () => void;
  streamFilter?: string[];
  initialStreamId?: string;
  activeRuleIds?: string[];
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const [actions, setActions] = useState<DemoActionImpact[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);
  const [streamIndex, setStreamIndex] = useState(0);
  const [switchNotice, setSwitchNotice] = useState<string | null>(null);
  const [acceptedStreamId, setAcceptedStreamId] = useState<string | null>(null);

  messagesRef.current = messages;

  const renderer = widget.elements?.render ?? (widget as any)?.render;
  const streamList = useMemo(() => {
    const streams = DEMO_STREAMS[widget.type] ?? [];
    if (!streamFilter?.length) return streams;
    return streams.filter((stream) => streamFilter.includes(stream.id));
  }, [widget.type, streamFilter]);
  const activeStream = streamList[streamIndex];
  const isLastStream =
    streamList.length > 0 && streamIndex === streamList.length - 1;

  const observedActions = useMemo(() => {
    const syncSetMessages: typeof setMessages = (updater) => {
      const next =
        typeof updater === "function"
          ? (updater as (prev: Message[]) => Message[])(messagesRef.current)
          : updater;
      messagesRef.current = next;
      setMessages(next);
    };

    const observer = new DemoDatabaseObserver(
      () => messagesRef.current,
      ({ action, added, deleted, beforeCount, afterCount }) => {
        const actors = Array.from(
          new Set([...added, ...deleted].map((m) => m.authorId).filter(Boolean))
        );

        setActions((prev) => [
          ...prev,
          {
            id: `${action}-${Date.now()}-${prev.length + 1}`,
            action,
            actors,
            added,
            deleted,
            beforeCount,
            afterCount,
            order: prev.length + 1,
            timestamp: Date.now(),
          },
        ]);
      }
    );

    const baseActions = widget.createActions({
      // In this diagnostic view we let setMessages drive the state to avoid double-writes.
      addMessage: async () => {},
      deleteMessage: async () => {},
      setMessages: syncSetMessages,
      getMessagesSnapshot: () => messagesRef.current,
    }) as Record<string, any>;

    return observer.wrap(baseActions);
  }, [widget]);

  const personaLookup = useMemo(
    () =>
      Object.fromEntries(PREVIEW_PERSONAS.map((p) => [p.id, p])) as Record<
        string,
        Persona
      >,
    []
  );

  const messageSourceMap = useMemo(() => {
    const map = new Map<string, DemoActionImpact>();
    actions.forEach((action) => {
      action.added.forEach((msg) => map.set(msg.id, action));
    });
    return map;
  }, [actions]);

  const heuristicFindings = useMemo(
    () => evaluateHeuristicFindings(actions, activeRuleIds),
    [actions, activeRuleIds]
  );

  const visibleHeuristicRules = useMemo(() => {
    if (!activeRuleIds) return HEURISTIC_RULES;
    const activeRuleSet = new Set(activeRuleIds);
    return HEURISTIC_RULES.filter((rule) => activeRuleSet.has(rule.id));
  }, [activeRuleIds]);

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
      perAction: actions.reduce<
        Record<string, { count: number; adds: number; dels: number }>
      >((acc, action) => {
        const bucket = acc[action.action] ?? { count: 0, adds: 0, dels: 0 };
        bucket.count += 1;
        bucket.adds += action.added.length;
        bucket.dels += action.deleted.length;
        acc[action.action] = bucket;
        return acc;
      }, {}),
    }),
    [actions]
  );

  const visibleMessages = useMemo(
    () => messages.filter((msg) => !(widget.hideMessage?.(msg) ?? false)),
    [messages, widget]
  );

  const canRunScript = Boolean(activeStream);

  const runSampleTrace = useCallback(async () => {
    if (!activeStream || isRunningRef.current) return;

    isRunningRef.current = true;
    setIsRunning(true);
    messagesRef.current = [];
    setMessages([]);
    setActions([]);
    setAcceptedStreamId(null);

    const script = activeStream?.run;
    if (script) {
      const wait = async (ms = 0) =>
        new Promise<void>((resolve) => setTimeout(resolve, ms));
      try {
        await script({
          actions: observedActions,
          wait,
          getMessages: () => messagesRef.current,
        });
      } catch (err) {
        console.error("Demo script failed", err);
      }
    }

    isRunningRef.current = false;
    setIsRunning(false);
  }, [activeStream, observedActions]);

  useEffect(() => {
    if (!activeStream) return;
    messagesRef.current = [];
    setMessages([]);
    setActions([]);
    setSwitchNotice(null);
    setAcceptedStreamId(null);
    runSampleTrace();
  }, [activeStream, runSampleTrace]);

  useEffect(() => {
    if (!streamList.length) {
      setStreamIndex(0);
      return;
    }
    if (initialStreamId) {
      const nextIndex = streamList.findIndex(
        (stream) => stream.id === initialStreamId
      );
      if (nextIndex >= 0) {
        setStreamIndex(nextIndex);
        return;
      }
    }
    setStreamIndex(0);
  }, [streamList, initialStreamId]);

  useEffect(() => {
    setSwitchNotice(null);
    setAcceptedStreamId(null);
    messagesRef.current = [];
    setMessages([]);
    setActions([]);
  }, [widget.type, streamList, initialStreamId]);

  const handleAccept = () => {
    if (!activeStream) return;
    setAcceptedStreamId(activeStream.id);
    setSwitchNotice(null);
  };

  const handleContinue = () => {
    if (!streamList.length || isLastStream) return;
    const nextIndex = streamIndex + 1;
    setStreamIndex(nextIndex);
    const nextStream = streamList[nextIndex];
    setSwitchNotice(
      `Switched to ${nextStream.label} (stream ${nextIndex + 1} of ${
        streamList.length
      })`
    );
    setAcceptedStreamId(null);
  };

  const handleOpenDatabaseView = () => {
    onOpenDatabaseView?.({ messages, actions });
  };

  const handleOpenUserDemo = () => {
    onOpenUserDemo?.();
  };

  const widgetDisplayName = widget.registryName ?? widget.type;

  return (
    <div className="analytics-overlay" onClick={onClose}>
      <div className="analytics-shell" onClick={(e) => e.stopPropagation()}>
        <div className="analytics-header">
          <div>
            <h2 className="analytics-title">
              Diagnostic view
              <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                {" "}
                — {widgetDisplayName}
              </span>
            </h2>
          </div>
          <div className="analytics-actions">
            <button className="analytics-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {canRunScript && activeStream && (
          <div
            className="analytics-banner"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span className="analytics-pill">
                Stream {streamIndex + 1}/{streamList.length}
              </span>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong>{activeStream.label}</strong>
                  {acceptedStreamId === activeStream.id && (
                    <span className="analytics-pill">Accepted</span>
                  )}
                </div>
                <p className="analytics-note" style={{ margin: 0 }}>
                  {activeStream.summary}
                </p>
              </div>
            </div>
          </div>
        )}

        {switchNotice && (
          <div
            className="analytics-banner"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>{switchNotice}</span>
            <button
              className="analytics-secondary"
              onClick={() => setSwitchNotice(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="analytics-grid">
          <div className="analytics-column analytics-column--left">
            <div className="analytics-panel">
              <div className="analytics-panel__header">
                <div>
                  <h3 className="analytics-label">Widget snapshot</h3>
                  <p className="analytics-note">
                    Fully rendered state. Look into the Action timeline so see
                    the order.
                  </p>
                </div>
              </div>

              <div className="widget-render-surface">
                {!renderer && (
                  <p className="analytics-placeholder">
                    Widget renderer missing.
                  </p>
                )}
                {renderer &&
                  visibleMessages.map((msg) => {
                    const source = messageSourceMap.get(msg.id);
                    const findings = source
                      ? heuristicsByAction.get(source.id) ?? []
                      : [];
                    const persona = personaLookup[msg.authorId];

                    return (
                      <div
                        key={msg.id}
                        className={`widget-render__item ${
                          findings.length > 0
                            ? "widget-render__item--alert"
                            : ""
                        }`}
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {renderer({
                          message: msg,
                          allMessages: messages,
                          personas: PREVIEW_PERSONAS,
                          currentActorId: msg.authorId,
                          actions: observedActions as any,
                        })}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="analytics-panel">
              <div className="analytics-panel__header">
                <div>
                  <h3 className="analytics-label">Aggregated stats</h3>
                  <p className="analytics-note">
                    Overview of database impact across the trace.
                  </p>
                </div>
              </div>

              <div className="analytics-stats"></div>
              <div className="analytics-impact-list">
                {actions.length === 0 && (
                  <p className="analytics-placeholder">
                    Actions will appear here after the automatic sample run.
                  </p>
                )}
                {Object.entries(totals.perAction).map(([actionName, info]) => (
                  <div key={actionName} className="analytics-impact-row">
                    <span className="analytics-pill">×{info.count}</span>
                    <div>
                      <p className="analytics-impact__title">{actionName}</p>
                      <p className="analytics-impact__desc">
                        {info.adds > 0 ? `${info.adds} created` : "0 created"} |{" "}
                        {info.dels > 0 ? `${info.dels} removed` : "0 removed"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="analytics-panel">
              <div className="analytics-panel__header">
                <div>
                  <h3 className="analytics-label">Heuristics</h3>
                  <p className="analytics-note">
                    General heuristics for this type of widget.
                  </p>
                </div>
              </div>

              <div className="heuristic-rules__list">
                {visibleHeuristicRules.length === 0 ? (
                  <p className="analytics-placeholder">
                    No heuristics selected.
                  </p>
                ) : (
                  visibleHeuristicRules.map((rule) => (
                    <div key={rule.id} className="heuristic-rule">
                      <span className="widget-pill">
                        {rule.severity === "weird" ? "alert" : "warn"}
                      </span>
                      {rule.label}
                    </div>
                  ))
                )}
              </div>

              <div className="heuristic-findings">
                {heuristicFindings.length === 0 ? (
                  <p className="analytics-placeholder">
                    No anomalies flagged yet.
                  </p>
                ) : (
                  <>
                    {heuristicFindings.map((finding) => (
                      <div
                        key={finding.id}
                        className={`heuristic-finding heuristic-finding--${
                          finding.severity === "weird" ? "alert" : "warn"
                        }`}
                      >
                        <div className="action-marker">
                          #{finding.actionOrder}
                        </div>
                        <div className="heuristic-finding__header">
                          {finding.label}
                        </div>
                        {finding.detail && (
                          <p className="heuristic-finding__detail">
                            {finding.detail}
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="analytics-column analytics-column--timeline">
            <div className="analytics-panel analytics-panel--tall">
              <div className="analytics-panel__header">
                <div>
                  <h3 className="analytics-label">Action timeline</h3>
                  <p className="analytics-note">
                    Chronological list of actions and their database effects.
                  </p>
                </div>
              </div>

              {!canRunScript && (
                <div className="analytics-banner">
                  No sample script registered
                </div>
              )}

              <div className="timeline">
                {actions.length === 0 && (
                  <p className="analytics-placeholder">
                    {isRunning
                      ? "Capturing timeline..."
                      : "Trace will populate here automatically."}
                  </p>
                )}
                {actions.map((action) => {
                  const findings = heuristicsByAction.get(action.id) ?? [];
                  const visibleAdded = action.added.filter(
                    (m) => !(widget.hideMessage?.(m) ?? false)
                  ).length;
                  const hiddenAdded = action.added.length - visibleAdded;

                  const widgetNotes: string[] = [];
                  if (visibleAdded) widgetNotes.push(`${visibleAdded} visible`);
                  if (hiddenAdded)
                    widgetNotes.push(`${hiddenAdded} suppressed`);
                  if (action.deleted.length)
                    widgetNotes.push(`${action.deleted.length} removed`);

                  return (
                    <div
                      key={action.id}
                      className={`timeline-item ${
                        findings.length > 0 ? "timeline-item--alert" : ""
                      }`}
                    >
                      <div className="timeline-order">#{action.order}</div>
                      <div className="timeline-body">
                        <div className="timeline-row">
                          <strong>{action.action}</strong>
                          <span className="analytics-pill">
                            Delta {action.afterCount - action.beforeCount}
                          </span>
                        </div>
                        {action.actors.length > 0 && (
                          <p className="timeline-actors">
                            By{" "}
                            {action.actors
                              .map((id) => personaLookup[id]?.name || id)
                              .join(", ")}
                          </p>
                        )}
                        <p className="timeline-impact">
                          {describeImpact(action)}
                        </p>
                        <p className="timeline-widget">
                          Widget:{" "}
                          {widgetNotes.length
                            ? widgetNotes.join(", ")
                            : "no visible change"}
                        </p>
                        {findings.length > 0 && (
                          <div className="timeline-findings">
                            {findings.map((finding) => (
                              <span
                                key={finding.id}
                                className={`analytics-pill analytics-pill--${
                                  finding.severity === "weird"
                                    ? "alert"
                                    : "warn"
                                }`}
                              >
                                {finding.label}
                                {finding.detail ? ` - ${finding.detail}` : ""}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="analytics-panel analytics-panel--nav">
              <div>
                <h3 className="analytics-label">Play demo</h3>
                <p className="analytics-note">
                  Accept keeps the current stream; Continue swaps in the next
                  one until you reach the final stream.
                </p>
              </div>
              <div className="analytics-nav">
                <button
                  className="analytics-secondary"
                  onClick={handleAccept}
                  disabled={!activeStream}
                >
                  Accept
                </button>
                <button
                  className="analytics-secondary"
                  onClick={handleContinue}
                  disabled={
                    !activeStream ||
                    streamList.length <= 1 ||
                    isLastStream ||
                    isRunning
                  }
                >
                  Continue
                </button>
              </div>
            </div>

            <div className="analytics-panel analytics-panel--nav">
              <div>
                <h3 className="analytics-label">Switch context</h3>
                <p className="analytics-note">
                  Navigate to the database or user-centric demo views to play
                  the demo.
                </p>
              </div>
              <div className="analytics-nav">
                <button
                  className="analytics-secondary"
                  onClick={handleOpenDatabaseView}
                >
                  Database view
                </button>
                <button
                  className="analytics-secondary"
                  onClick={handleOpenUserDemo}
                >
                  User demo view
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
