import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message, Persona } from "../db/sqlite";
import {
  DemoStreamInspector,
  type DemoActionInsight,
  type DemoInspectorVariant,
} from "./DemoStreamInspector";
import type { ChatWidgetDefinition } from "../widgets/types";

const PREVIEW_PERSONAS: Persona[] = [
  { id: "designer", name: "Oskar", color: "#e86a92", bio: "" },
  { id: "engineer", name: "Sebastian", color: "#0075ff", bio: "" },
  { id: "chief", name: "Tom", color: "#00a676", bio: "" },
];

class DemoDatabaseObserver {
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
        const before = this.getSnapshot();
        console.log("[DemoObserver]", key, "snapshot before", before);
        const result = await value(...args);
        // Let any queued state updates flush before taking the after snapshot.
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
        const after = this.getSnapshot();
        console.log("[DemoObserver]", key, "snapshot after", after);
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

type DemoScriptContext = {
  actions: unknown;
  wait: (ms: number) => Promise<void>;
  getMessages: () => Message[];
};

const DEMO_SCRIPTS: Record<string, (ctx: DemoScriptContext) => Promise<void>> =
  {
    createPoll: async ({ actions, wait, getMessages }) => {
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
      if (
        !pollActions.createPoll ||
        !pollActions.addVote ||
        !pollActions.deleteVote
      ) {
        console.warn("Poll demo missing required actions");
        return;
      }
      const prompt = "Product direction";
      const options = [
        { id: "opt-preview-a", label: "Ship MVP" },
        { id: "opt-preview-b", label: "Polish for two more weeks" },
      ];

      const createdId = await pollActions.createPoll(
        { prompt, options },
        "engineer"
      );
      const pollId =
        createdId ??
        getMessages().find(
          (m) =>
            m.type === "createPoll" &&
            typeof (m.custom as any)?.prompt === "string" &&
            (m.custom as any).prompt === prompt
        )?.id;
      if (!pollId) return;

      await wait(2000);
      await pollActions.addVote(pollId, "opt-preview-a", "engineer");
      await wait(2000);
      await pollActions.addVote(pollId, "opt-preview-b", "designer");
      await wait(2000);
      await pollActions.addVote(pollId, "opt-preview-a", "chief");
      await wait(2000);
      await pollActions.deleteVote(pollId, "designer");
      await wait(2000);
    },
  };

export function WidgetPreviewDemo({
  widget,
  onClose,
}: {
  widget: ChatWidgetDefinition;
  onClose: () => void;
}) {
  const [inspectorMessages, setInspectorMessages] = useState<Message[]>([]);
  const inspectorMessagesRef = useRef<Message[]>([]);
  const [inspectorInsights, setInspectorInsights] = useState<
    DemoActionInsight[]
  >([]);
  const [previewMessages, setPreviewMessages] = useState<Message[]>([]);
  const previewMessagesRef = useRef<Message[]>([]);
  const [previewInsights, setPreviewInsights] = useState<DemoActionInsight[]>(
    []
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [variant, setVariant] = useState<DemoInspectorVariant>("inspector");
  const [dbAlert, setDbAlert] = useState<string>("");
  const timeoutRef = useRef<number[]>([]);
  const hasLoadedInspectorRef = useRef(false);

  useEffect(() => {
    inspectorMessagesRef.current = inspectorMessages;
  }, [inspectorMessages]);

  useEffect(() => {
    previewMessagesRef.current = previewMessages;
  }, [previewMessages]);

  useEffect(() => {
    return () => {
      timeoutRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    setPreviewMessages([]);
    previewMessagesRef.current = [];
    setPreviewInsights([]);
    setInspectorMessages([]);
    inspectorMessagesRef.current = [];
    setInspectorInsights([]);
    hasLoadedInspectorRef.current = false;
    setDbAlert("");
  }, [widget.type]);

  const personaLookup = useMemo(
    () =>
      Object.fromEntries(PREVIEW_PERSONAS.map((p) => [p.id, p])) as Record<
        string,
        Persona
      >,
    []
  );

  const makeObservedActions = useCallback(
    (target: "inspector" | "preview"): Record<string, any> => {
      const setMessages =
        target === "inspector" ? setInspectorMessages : setPreviewMessages;
      const messagesRef =
        target === "inspector" ? inspectorMessagesRef : previewMessagesRef;
      const setInsights =
        target === "inspector" ? setInspectorInsights : setPreviewInsights;

      const syncSetMessages: typeof setMessages = (updater) =>
        setMessages((prev) => {
          const next =
            typeof updater === "function" ? (updater as any)(prev) : updater;
          messagesRef.current = next;
          return next;
        });

      const observer = new DemoDatabaseObserver(
        () => messagesRef.current,
        ({ action, added, deleted, beforeCount, afterCount }) => {
          const timestamp = Date.now();
          setInsights((cur) => [
            ...cur,
            {
              id: `${action}-${timestamp}-${cur.length + 1}`,
              action,
              added,
              deleted,
              beforeCount,
              afterCount,
              order: cur.length + 1,
              timestamp,
            },
          ]);
          const parts: string[] = [];
          if (added.length) {
            const typeSummary = Array.from(
              new Set(added.map((msg) => msg.type))
            ).join(", ");
            parts.push(`${added.length} added (${typeSummary})`);
          }
          if (deleted.length) {
            const typeSummary = Array.from(
              new Set(deleted.map((msg) => msg.type))
            ).join(", ");
            parts.push(`${deleted.length} removed (${typeSummary})`);
          }
          if (parts.length) {
            const msg = `Info: ${action} ${parts.join(" � ")}.`;
            setDbAlert(msg);
          }
        }
      );

      const baseActions = widget.createActions({
        addMessage: async () => {},
        deleteMessage: async (id) => {
          syncSetMessages((cur) => cur.filter((m) => m.id !== id));
        },
        getMessagesSnapshot: () => messagesRef.current,
        setMessages: syncSetMessages,
      }) as Record<string, any>;

      return observer.wrap(baseActions);
    },
    [widget]
  );
  const inspectorActions = useMemo(
    () => makeObservedActions("inspector"),
    [makeObservedActions]
  );
  const previewActions = useMemo(
    () => makeObservedActions("preview"),
    [makeObservedActions]
  );
  const canRunDemo = Boolean(DEMO_SCRIPTS[widget.type]);

  const runDemo = useCallback(() => {
    const script = DEMO_SCRIPTS[widget.type];
    if (!script) return;
    if (isPlaying) return;
    timeoutRef.current.forEach((id) => window.clearTimeout(id));
    timeoutRef.current = [];
    setPreviewMessages([]);
    setActionInsights([]);
    setDbAlert("");
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const handle = window.setTimeout(resolve, ms);
        timeoutRef.current.push(handle);
      });

    setIsPlaying(true);
    script({
      actions: previewActions,
      wait,
      getMessages: () => messagesRef.current,
    })
      .catch((err) => console.error("Demo script failed", err))
      .finally(() => setIsPlaying(false));
  }, [isPlaying, previewActions, widget.type]);

  useEffect(() => {
    if (!canRunDemo) return;
    if (variant !== "inspector") return;
    if (isPlaying) return;
    if (actionInsights.length > 0) return;
    runDemo();
  }, [canRunDemo, variant, isPlaying, actionInsights.length, runDemo]);

  const visibleMessages = useMemo(
    () =>
      previewMessages.filter(
        (msg) => !(widget.hideMessage?.(msg) ?? false)
      ) as Message[],
    [previewMessages, widget]
  );

  const dataPayload = useMemo(
    () =>
      previewMessages.length ? JSON.stringify(previewMessages, null, 2) : "[]",
    [previewMessages]
  );

  const describeAction = (msg: Message) => {
    if (msg.type === "message") {
      return msg.text ? `Sent “${msg.text}”` : "Sent a message";
    }
    if (msg.type === "createPoll") {
      const question = (msg.custom as any)?.prompt ?? msg.text ?? "New poll";
      return `Opened poll “${question}”`;
    }
    if (msg.type === "vote") {
      const vote = msg.custom as any;
      return `Voted for ${vote?.optionId ?? "an option"}`;
    }
    return `Triggered ${msg.type}`;
  };

  const renderDatabaseView = () => (
    <pre className="preview-data">
      <code>{dataPayload}</code>
    </pre>
  );

  const renderGhostStream = () => {
    if (!previewMessages.length) {
      return (
        <p className="widget-preview__placeholder">
          Ghost view shows all messages, even ones hidden by the widget.
        </p>
      );
    }

    return (
      <div className="preview-ghost-list">
        {previewMessages.map((msg) => {
          const persona = personaLookup[msg.authorId];
          const hidden = widget.hideMessage?.(msg) ?? false;
          const text = msg.text || (msg.custom as any)?.prompt;
          return (
            <div
              key={msg.id}
              className={`preview-ghost ${
                hidden ? "preview-ghost--hidden" : ""
              }`}
            >
              <div className="preview-ghost__header">
                <span className="preview-ghost__persona">
                  <span
                    className="preview-ghost__dot"
                    style={{ background: persona?.color ?? "#6b7280" }}
                  />
                  {persona?.name ?? msg.authorId}
                </span>
                <span className="preview-ghost__tag">
                  {hidden ? "hidden by widget" : msg.type}
                </span>
              </div>
              <p className="preview-ghost__body">
                {text || "(no text payload)"}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPersonaFocus = () => {
    const cards = PREVIEW_PERSONAS.map((persona) => {
      const owned = previewMessages.filter((m) => m.authorId === persona.id);
      const last = owned[owned.length - 1];
      const visibleCount = owned.filter(
        (m) => !(widget.hideMessage?.(m) ?? false)
      ).length;
      return {
        persona,
        total: owned.length,
        visible: visibleCount,
        lastAction: last ? describeAction(last) : "Waiting for first action",
        lastType: last?.type ?? null,
      };
    });

    return (
      <div className="preview-persona-grid">
        {cards.map((card) => (
          <div
            key={card.persona.id}
            className="preview-persona-card"
            style={{ borderColor: card.persona.color }}
          >
            <div className="preview-persona__header">
              <span
                className="preview-avatar"
                style={{ background: card.persona.color }}
              >
                {card.persona.name[0]}
              </span>
              <div>
                <p className="preview-action__title">{card.persona.name}</p>
                <small className="preview-action__subtitle">
                  {card.lastAction}
                </small>
              </div>
            </div>
            <div className="preview-persona__stats">
              <span className="preview-persona__stat">{card.total} total</span>
              <span className="preview-persona__stat">
                {card.visible} visible
              </span>
              <span className="preview-persona__stat">
                {card.lastType ?? "none"}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderVariant = () => {
    switch (variant) {
      case "inspector":
        return (
          <DemoStreamInspector
            widget={widget}
            personas={PREVIEW_PERSONAS}
            messages={previewMessages}
            visibleMessages={visibleMessages}
            actions={actionInsights}
            widgetActions={previewActions}
            onNavigateVariant={setVariant}
            onReplay={runDemo}
          />
        );
      case "database":
        return renderDatabaseView();
      case "wire":
        return renderGhostStream();
      case "personas":
        return renderPersonaFocus();
      default:
        return (
          <DemoStreamInspector
            widget={widget}
            personas={PREVIEW_PERSONAS}
            messages={previewMessages}
            visibleMessages={visibleMessages}
            actions={actionInsights}
            widgetActions={previewActions}
            onNavigateVariant={setVariant}
            onReplay={runDemo}
          />
        );
    }
  };

  const widgetDisplayName = widget.registryName;

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div
        className="preview-modal preview-modal--wide-inspector"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="preview-modal__header">
          <div>
            <p className="widget-preview__label" style={{ marginBottom: 4 }}>
              Demoing widget <strong>{widgetDisplayName}</strong>
            </p>
            <p className="widget-preview__hint">
              Inspector loads a full run automatically — no manual playback needed.
            </p>
          </div>
          <div className="preview-modal__actions">
            <button type="button" className="workbench-close" onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        {dbAlert && (
          <p
            className="widget-preview__alert"
            role="status"
            aria-live="assertive"
          >
            {dbAlert}
          </p>
        )}
        <div
          className="widget-preview__screen widget-preview__screen--modal widget-preview__screen--inspector"
          aria-live="polite"
        >
          {renderVariant()}
        </div>
      </div>
    </div>
  );
}
