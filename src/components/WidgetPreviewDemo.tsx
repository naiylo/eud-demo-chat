import { useEffect, useMemo, useRef, useState } from "react";
import type { Message, Persona } from "../db/sqlite";
import type { ChatWidgetDefinition } from "../widgets/types";

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
    private onDeletion: (info: { action: string; deleted: Message[] }) => void
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
        const result = await value(...args);
        const after = this.getSnapshot();
        const deleted = before.filter((b) => !after.some((a) => a.id === b.id));
        if (deleted.length) {
          this.onDeletion({ action: key, deleted });
        }
        return result;
      };
    });
    return wrapped as T;
  }
}

const SAMPLE_STREAMS: Record<string, Message[]> = {
  message: [
    {
      id: "m-demo-1",
      authorId: "designer",
      text: "Designer kicks off with a warm hello.",
      timestamp: new Date().toISOString(),
      type: "message",
      custom: [],
    },
    {
      id: "m-demo-2",
      authorId: "engineer",
      text: "Engineer replies and acknowledges the brief.",
      timestamp: new Date().toISOString(),
      type: "message",
      custom: [],
    },
    {
      id: "m-demo-3",
      authorId: "chief",
      text: "PM confirms the handoff and next steps.",
      timestamp: new Date().toISOString(),
      type: "message",
      custom: [],
    },
  ],
  createPoll: [
    {
      id: "poll-1764507520662",
      authorId: "engineer",
      text: "Product direction",
      timestamp: "2025-11-30T12:58:40.662Z",
      type: "createPoll",
      custom: {
        prompt: "Product direction",
        options: [
          { id: "opt-preview-a", label: "Ship MVP" },
          { id: "opt-preview-b", label: "Polish for two more weeks" },
        ],
      },
    },
    {
      id: "poll-1764507529387",
      authorId: "engineer",
      text: "Frontend stack",
      timestamp: "2025-11-30T12:58:49.387Z",
      type: "createPoll",
      custom: {
        prompt: "Frontend stack",
        options: [
          { id: "opt-preview-c", label: "Stay with React" },
          { id: "opt-preview-d", label: "Try a lighter UI lib" },
        ],
      },
    },
    {
      id: "vote-1764507537425",
      authorId: "engineer",
      text: "",
      timestamp: "2025-11-30T12:58:57.425Z",
      type: "vote",
      custom: { pollId: "poll-1764507520662", optionId: "opt-preview-a" },
    },
    {
      id: "vote-1764507538116",
      authorId: "engineer",
      text: "",
      timestamp: "2025-11-30T12:58:58.116Z",
      type: "vote",
      custom: { pollId: "poll-1764507529387", optionId: "opt-preview-d" },
    },
    {
      id: "vote-1764507539453",
      authorId: "designer",
      text: "",
      timestamp: "2025-11-30T12:58:59.453Z",
      type: "vote",
      custom: { pollId: "poll-1764507520662", optionId: "opt-preview-b" },
    },
    {
      id: "vote-1764507540057",
      authorId: "designer",
      text: "",
      timestamp: "2025-11-30T12:59:00.057Z",
      type: "vote",
      custom: { pollId: "poll-1764507529387", optionId: "opt-preview-c" },
    },
    {
      id: "vote-1764507541499",
      authorId: "chief",
      text: "",
      timestamp: "2025-11-30T12:59:01.499Z",
      type: "vote",
      custom: { pollId: "poll-1764507520662", optionId: "opt-preview-a" },
    },
    {
      id: "vote-1764507544073",
      authorId: "chief",
      text: "",
      timestamp: "2025-11-30T12:59:04.073Z",
      type: "vote",
      custom: { pollId: "poll-1764507529387", optionId: "opt-preview-c" },
    },
  ],
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
    const observer = new DemoDatabaseObserver(
      () => messagesRef.current,
      ({ action, deleted }) => {
        setDbAlert(
          `⚠️ ${action} removed ${deleted.length} record${
            deleted.length === 1 ? "" : "s"
          } from the demo data.`
        );
      }
    );
    const baseActions = widget.createActions({
      addMessage: async () => {},
      deleteMessage: async (id) => {
        setPreviewMessages((cur) => cur.filter((m) => m.id !== id));
      },
      getMessagesSnapshot: () => messagesRef.current,
      setMessages: setPreviewMessages,
    });
    return observer.wrap(baseActions);
  }, [widget]);

  const runDemo = () => {
    if (isPlaying) return;
    timeoutRef.current.forEach((id) => window.clearTimeout(id));
    timeoutRef.current = [];
    setPreviewMessages([]);
    setDbAlert("");
    setIsPlaying(true);

    const stream = SAMPLE_STREAMS[widget.type] ?? SAMPLE_STREAMS.message ?? [];
    stream.forEach((msg, index) => {
      const handle = window.setTimeout(() => {
        setPreviewMessages((cur) => [...cur, msg]);
        if (index === stream.length - 1) {
          setIsPlaying(false);
        }
      }, 300 + index * 600);
      timeoutRef.current.push(handle);
    });

    if (!stream.length) {
      setIsPlaying(false);
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
              Demoing widget type <strong>{widget.type}</strong>
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
