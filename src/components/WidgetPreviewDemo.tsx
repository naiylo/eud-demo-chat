import { useEffect, useMemo, useRef, useState } from "react";
import type { Message, Persona } from "../db/sqlite";
import type { ChatWidgetDefinition } from "../widgets/types";

const PREVIEW_PERSONAS: Persona[] = [
  { id: "designer", name: "Riley", color: "#e86a92", bio: "" },
  { id: "engineer", name: "Noah", color: "#0075ff", bio: "" },
  { id: "pm", name: "Sasha", color: "#00a676", bio: "" },
];

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
      authorId: "pm",
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
      authorId: "pm",
      text: "",
      timestamp: "2025-11-30T12:59:01.499Z",
      type: "vote",
      custom: { pollId: "poll-1764507520662", optionId: "opt-preview-a" },
    },
    {
      id: "vote-1764507544073",
      authorId: "pm",
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

  const previewActions = useMemo(
    () =>
      widget.createActions({
        addMessage: async () => {},
        deleteMessage: async (id) => {
          setPreviewMessages((cur) => cur.filter((m) => m.id !== id));
        },
        getMessagesSnapshot: () => messagesRef.current,
        setMessages: setPreviewMessages,
      }),
    [widget]
  );

  const runDemo = () => {
    if (isPlaying) return;
    timeoutRef.current.forEach((id) => window.clearTimeout(id));
    timeoutRef.current = [];
    setPreviewMessages([]);
    setIsPlaying(true);

    const sampleStream = SAMPLE_STREAMS[widget.type];

    const stream = sampleStream ?? [];
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
          className="widget-preview__screen widget-preview__screen--modal"
          aria-live="polite"
        >
          {previewMessages.length === 0 ? (
            <p className="widget-preview__placeholder">
              Hit play to see how this widget paints messages.
            </p>
          ) : (
            previewMessages
              .filter((msg) => !(widget.hideMessage?.(msg) ?? false))
              .map((msg) => {
                const renderer =
                  widget.elements?.render ?? (widget as any)?.render;
                return (
                  <div
                    key={msg.id}
                    className="widget-preview__message widget-preview__message--modal"
                  >
                    {renderer ? (
                      renderer({
                        message: msg,
                        allMessages: previewMessages,
                        personas: PREVIEW_PERSONAS,
                        currentActorId: msg.authorId,
                        actions: previewActions,
                      })
                    ) : (
                      <p>Widget does not expose a renderer.</p>
                    )}
                    <span className="widget-preview__meta">
                      {msg.authorId}
                    </span>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
