import { useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "../db/sqlite";
import { messageWidget } from "../widgets/builtins/messageWidget";

export function AddWidget() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const exportName = useMemo(() => {
    const match = code.match(/export const\s+(\w+)/);
    return match?.[1] ?? "customWidget";
  }, [code]);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to save widget");
      }
      const payload = (await res.json()) as {
        slug: string;
        exportName: string;
      };
      setStatus("saved");
      setMessage(
        `Saved ${payload.exportName} as ${payload.slug}.tsx and updated registry.`
      );
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage(
        "Could not save widget. Make sure the dev server is running and you used export const <Name>."
      );
    }
  };

  return (
    <div className="add-widget-grid">
      <section className="add-widget-pane">
        <h4>Widget code</h4>
        <textarea
          className="add-widget-editor"
          placeholder="Paste your entire widget file here (e.g. pollWidget)..."
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
        />
        <div className="add-widget-footer">
          <small>
            {code.trim()
              ? `${code.split(/\r?\n/).length} lines · export "${exportName}"`
              : "Waiting for code..."}
          </small>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!code.trim() || status === "saving"}
          >
            {status === "saving" ? "Saving..." : "Submit widget"}
          </button>
        </div>
        {message && (
          <p
            className={`add-widget-helper ${
              status === "error" ? "add-widget-helper--error" : ""
            }`}
          >
            {message}
          </p>
        )}
      </section>
      <section className="add-widget-pane add-widget-pane--preview">
        <h4>Preview</h4>
        <WidgetPreviewSimulator />
      </section>
    </div>
  );
}

type DemoStep = {
  authorId: string;
  text: string;
};

const DEMO_STREAM: DemoStep[] = [
  {
    authorId: "designer",
    text: "Designer kicks off with a warm hello.",
  },
  {
    authorId: "engineer",
    text: "Engineer replies and acknowledges the brief.",
  },
  {
    authorId: "pm",
    text: "PM confirms the handoff and next steps.",
  },
];

function WidgetPreviewSimulator() {
  const [previewMessages, setPreviewMessages] = useState<Message[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const timeoutRef = useRef<number[]>([]);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = previewMessages;
  }, [previewMessages]);

  const previewActions = useMemo(
    () =>
      messageWidget.createActions({
        addMessage: async () => {},
        deleteMessage: async () => {},
        getMessagesSnapshot: () => messagesRef.current,
        setMessages: setPreviewMessages,
      }),
    []
  );

  useEffect(() => {
    return () => {
      timeoutRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const runDemo = () => {
    if (isPlaying) return;
    timeoutRef.current.forEach((id) => window.clearTimeout(id));
    timeoutRef.current = [];
    setPreviewMessages([]);
    setIsPlaying(true);

    DEMO_STREAM.forEach((step, index) => {
      const handle = window.setTimeout(async () => {
        await previewActions.sendMessage(step.text, step.authorId);
        if (index === DEMO_STREAM.length - 1) {
          setIsPlaying(false);
        }
      }, 400 + index * 900);
      timeoutRef.current.push(handle);
    });
  };

  return (
    <div className="widget-preview">
      <div className="widget-preview__controls">
        <div>
          <p className="widget-preview__label">
            Step-by-step: messages flow through the widget actions.
          </p>
          <p className="widget-preview__hint">
            Press play to see how <code>sendMessage</code> adds each entry.
          </p>
        </div>
        <button
          type="button"
          onClick={runDemo}
          disabled={isPlaying}
          className="widget-preview__play"
        >
          {isPlaying ? "Playing..." : "Play sample"}
        </button>
      </div>
      <div className="widget-preview__screen" aria-live="polite">
        {previewMessages.length === 0 ? (
          <p className="widget-preview__placeholder">
            A small feed will animate here.
          </p>
        ) : (
          previewMessages.map((msg) => (
            <div key={msg.id} className="widget-preview__message">
              {messageWidget.render({
                message: msg,
                allMessages: previewMessages,
                personas: [],
                currentActorId: msg.authorId,
                actions: previewActions,
              })}
              <span className="widget-preview__meta">{msg.authorId}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
