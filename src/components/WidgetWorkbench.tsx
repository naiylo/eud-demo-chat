import { useState } from "react";

export function WidgetWorkbench({
  open,
  onClose,
  onSendMessage,
  selectedAuthorId,
}: {
  open: boolean;
  onClose: () => void;
  onSendMessage: (text: string, authorId: string) => void;
  selectedAuthorId: string;
}) {
  const [messageText, setMessageText] = useState("");

  if (!open) return null;

  const sendMessage = () => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed, selectedAuthorId);
    setMessageText("");
    onClose();
  };

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
          X
        </button>
        <div className="workbench-header">
          <h3 id="workbench-modal-title">Message Workbench</h3>
        </div>

        <textarea
          className="workbench-editor"
          placeholder="Type a message to send..."
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
        />
        <div>
          <button
            type="button"
            onClick={sendMessage}
            disabled={!messageText.trim()}
          >
            Send Message
          </button>
        </div>
      </div>
    </div>
  );
}
