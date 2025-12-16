import { useEffect, useMemo, useRef, useState } from "react";
import type { Message, Persona } from "../db/sqlite";
import type { ChatWidgetDefinition } from "../widgets/types";
import { generatePollActions, type Action} from "../generator/fuzzer";
import { type ConstraintInput, type PollActionInput } from "../exampleWidgets/examplepoll";

const PREVIEW_PERSONAS: Persona[] = [
  { id: "designer", name: "Oskar", color: "#e86a92", bio: "" },
  { id: "engineer", name: "Sebastian", color: "#0075ff", bio: "" },
  { id: "chief", name: "Tom", color: "#00a676", bio: "" },
];

const DEMO_VARIANTS = [
  {
    id: "widget",
    label: "Widget view",
    description: "Shows the widget renderer and hides what the widget hides.",
  },
  {
    id: "actions",
    label: "Action log",
    description:
      "Focuses on the actions being fired instead of the rendered UI.",
  },
  {
    id: "database",
    label: "Data view",
    description: "Displays the live JSON payloads that would hit the database.",
  },
  {
    id: "wire",
    label: "Ghost stream",
    description:
      "Shows every message in the stream, even the ones the widget suppresses.",
  },
  {
    id: "personas",
    label: "Persona focus",
    description: "Highlights who acted last and what each persona is doing.",
  },
] as const;

class DemoDatabaseObserver {
  constructor(
    private getSnapshot: () => Message[],
    private onChange: (info: {
      action: string;
      added: Message[];
      deleted: Message[];
    }) => void
  ) {}

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
        if (added.length || deleted.length) {
          this.onChange({ action: key, added, deleted });
        }
        return result;
      };
    });
    return wrapped as T;
  }
}

export type DemoScriptContext = {
  actions: unknown;
  wait: (ms: number) => Promise<void>;
  getMessages: () => Message[];
};

const DEMO_SCRIPTS: Record<string, (ctx: DemoScriptContext) => Promise<void>> =
  {
    createPoll: async ({ actions, wait, getMessages }) => {
      const pollActions = actions as { [key: string]: Action<
        PollActionInput,
        ConstraintInput
      >};
      const addVoteAction =  pollActions["addVote"];
      const deleteVoteAction = pollActions["deleteVote"];
      const createPollAction = pollActions["createPoll"];
      if (
        !createPollAction ||
        !addVoteAction ||
        !deleteVoteAction
      ) {
        console.warn("Poll demo missing required actions");
        return;
      }
      await generatePollActions(
        { actions, wait, getMessages },
        PREVIEW_PERSONAS.map((p) => p.id),
        [createPollAction, addVoteAction, deleteVoteAction]
      ).catch((err) =>
        console.error("Error running poll demo script:", err)
      );
    },
  };

export function WidgetPreviewDemo({
  widget,
  onClose,
}: {
  widget: ChatWidgetDefinition;
  onClose: () => void;
}) {
  const [previewMessages, setPreviewMessages] = useState<Message[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [variant, setVariant] =
    useState<(typeof DEMO_VARIANTS)[number]["id"]>("widget");
  const [dbAlert, setDbAlert] = useState<string>("");
  const timeoutRef = useRef<number[]>([]);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = previewMessages;
  }, [previewMessages]);

  useEffect(() => {
    return () => {
      timeoutRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    setPreviewMessages([]);
  }, [widget.type]);

  const personaLookup = useMemo(
    () =>
      Object.fromEntries(PREVIEW_PERSONAS.map((p) => [p.id, p])) as Record<
        string,
        Persona
      >,
    []
  );

  const previewActions = useMemo(() => {
    const syncSetMessages: typeof setPreviewMessages = (updater) =>
      setPreviewMessages((prev) => {
        const next =
          typeof updater === "function" ? (updater as any)(prev) : updater;
        messagesRef.current = next;
        return next;
      });

    const observer = new DemoDatabaseObserver(
      () => messagesRef.current,
      ({ action, added, deleted }) => {
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
          const msg = `Info: ${action} ${parts.join(" · ")}.`;
          console.log("[DemoObserver] setDbAlert ->", msg, {
            added,
            deleted,
          });
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
    });
    return observer.wrap(baseActions);
  }, [widget]);

  const runDemo = () => {
    if (isPlaying) return;
    timeoutRef.current.forEach((id) => window.clearTimeout(id));
    timeoutRef.current = [];
    setPreviewMessages([]);
    setDbAlert("");
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const handle = window.setTimeout(resolve, ms);
        timeoutRef.current.push(handle);
      });

    const script = DEMO_SCRIPTS[widget.type];
    if (script) {
      setIsPlaying(true);
      script({
        actions: previewActions,
        wait,
        getMessages: () => messagesRef.current,
      })
        .catch((err) => console.error("Demo script failed", err))
        .finally(() => setIsPlaying(false));
      return;
    }
  };

  const renderer = widget.elements?.render ?? (widget as any)?.render;
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

  const renderWidgetView = () => {
    if (!renderer) {
      return (
        <p className="widget-preview__placeholder">
          Widget does not expose a renderer.
        </p>
      );
    }
    if (!previewMessages.length) {
      return (
        <p className="widget-preview__placeholder">
          Hit play to see how this widget paints messages.
        </p>
      );
    }

    if (!visibleMessages.length) {
      return (
        <p className="widget-preview__placeholder">
          All current messages are hidden by this widget&apos;s hideMessage
          rule.
        </p>
      );
    }

    return visibleMessages.map((msg) => (
      <div
        key={msg.id}
        className="widget-preview__message widget-preview__message--modal"
      >
        {renderer({
          message: msg,
          allMessages: previewMessages,
          personas: PREVIEW_PERSONAS,
          currentActorId: msg.authorId,
          actions: previewActions,
        })}
        <span className="widget-preview__meta">{msg.authorId}</span>
      </div>
    ));
  };

  const renderActionLog = () => {
    if (!previewMessages.length) {
      return (
        <p className="widget-preview__placeholder">
          Actions will appear here as the sample stream plays.
        </p>
      );
    }
    return (
      <div className="preview-action-list">
        {previewMessages.map((msg) => {
          const persona = personaLookup[msg.authorId];
          const hidden = widget.hideMessage?.(msg) ?? false;
          return (
            <div
              key={msg.id}
              className={`preview-action ${
                hidden ? "preview-action--hidden" : ""
              }`}
            >
              <div className="preview-action__meta">
                <span
                  className="preview-avatar"
                  style={{ background: persona?.color ?? "#3a445f" }}
                >
                  {persona?.name?.[0] ?? "?"}
                </span>
                <div>
                  <p className="preview-action__title">
                    {persona?.name ?? msg.authorId}
                  </p>
                  <small className="preview-action__subtitle">
                    {describeAction(msg)}
                  </small>
                </div>
              </div>
              <span className="preview-action__tag">
                {hidden ? "hidden" : msg.type}
              </span>
            </div>
          );
        })}
      </div>
    );
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
                {card.lastType ?? "–"}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderVariant = () => {
    switch (variant) {
      case "actions":
        return renderActionLog();
      case "database":
        return renderDatabaseView();
      case "wire":
        return renderGhostStream();
      case "personas":
        return renderPersonaFocus();
      case "widget":
      default:
        return renderWidgetView();
    }
  };

  const variantDetails =
    DEMO_VARIANTS.find((opt) => opt.id === variant) ?? DEMO_VARIANTS[0];

  const widgetDisplayName = widget.registryName;

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div
        className="preview-modal"
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
              Messages animate in via this widget&apos;s actions and styling.
            </p>
          </div>
          <div className="preview-modal__actions">
            <button
              type="button"
              className="widget-preview__play"
              onClick={runDemo}
              disabled={isPlaying}
            >
              {isPlaying ? "Playing..." : "Play sample"}
            </button>
            <button type="button" className="workbench-close" onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <div
          className="widget-preview__variants"
          role="tablist"
          aria-label="Demo variants"
        >
          {DEMO_VARIANTS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={variant === opt.id}
              className={`preview-variant ${
                variant === opt.id ? "preview-variant--active" : ""
              }`}
              onClick={() => setVariant(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="widget-preview__hint widget-preview__variant-hint">
          {variantDetails.description}
        </p>
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
          className="widget-preview__screen widget-preview__screen--modal"
          aria-live="polite"
        >
          {renderVariant()}
        </div>
      </div>
    </div>
  );
}
