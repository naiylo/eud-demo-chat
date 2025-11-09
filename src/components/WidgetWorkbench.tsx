import { useMemo, useState } from "react";

export function WidgetWorkbench({
  code,
  onChange,
  open,
  onClose,
}: {
  code: string;
  onChange: (code: string) => void;
  open: boolean;
  onClose: () => void;
  onSendMessage: (text: string, authorId: string) => void;
  onCreatePoll: (input: {
    question: string;
    options: string[];
    config: { multi: boolean };
  }) => Promise<void> | void;
  selectedAuthorId: string;
}) {
  const [mode, setMode] = useState<"message" | "widget">("message");
  const [messageText, setMessageText] = useState("");

  const compileOutcome = useMemo(() => {
    if (mode !== "widget" || !code.trim())
      return { ok: false, error: "" } as const;
    return { ok: false, error: "" } as const;
  }, [mode, code]);

  if (!open) return null;

  const sendMessage = () => {};

  const buildAndSendWidget = async () => {};

  return (
    <div className="data-modal-overlay" onClick={onClose}>
      <div
        className="workbench-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workbench-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="workbench-close"
          aria-label="Close workbench"
          onClick={onClose}
        >
          ✕
        </button>
        <div className="workbench-header">
          <h3 id="workbench-modal-title">Widget Workbench</h3>
        </div>

        <div className="workbench-mode-toggle">
          <label>
            <input
              type="radio"
              name="wb-mode"
              checked={mode === "message"}
              onChange={() => setMode("message")}
            />
            Message
          </label>
          <label>
            <input
              type="radio"
              name="wb-mode"
              checked={mode === "widget"}
              onChange={() => setMode("widget")}
            />
            Widget (DSL)
          </label>
        </div>

        {mode === "message" ? (
          <>
            <textarea
              className="workbench-editor"
              placeholder="Type a message to send..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
            />
            <div>
              <button type="button" onClick={sendMessage}>
                Send Message
              </button>
            </div>
          </>
        ) : (
          <>
            <textarea
              className="workbench-editor"
              value={code}
              onChange={(e) => onChange(e.target.value)}
            />
            {!compileOutcome.ok && compileOutcome.error && (
              <div className="workbench-error" role="alert">
                {compileOutcome.error}
              </div>
            )}
            <div>
              <button
                type="button"
                onClick={buildAndSendWidget}
                disabled={!compileOutcome.ok}
              >
                Build & Send Widget
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
