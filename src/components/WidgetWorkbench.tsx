import { useState } from "react";
import type { ChatWidgetDefinition, WidgetActionMap } from "../widgets/types";
import { AddWidget } from "./AddWidget";

export function WidgetWorkbench({
  open,
  onClose,
  onSendMessage,
  widgets,
  widgetActions,
  selectedAuthorId,
}: {
  open: boolean;
  onClose: () => void;
  onSendMessage: (text: string, authorId: string) => void;
  widgets: ChatWidgetDefinition[];
  widgetActions: WidgetActionMap;
  selectedAuthorId: string;
}) {
  const [messageText, setMessageText] = useState("");
  const composerWidgets = widgets.filter((w) => w.composer);
  const [mode, setMode] = useState<string>("message");

  if (!open) return null;

  const sendMessage = () => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    onSendMessage(trimmed, selectedAuthorId);
    setMessageText("");
    onClose();
  };

  const currentComposer =
    mode === "message" ? null : composerWidgets.find((w) => w.type === mode);

  const modalClass =
    "workbench-modal" + (mode === "addWidget" ? " workbench-modal--wide" : "");

  return (
    <div className="data-modal-overlay" onClick={onClose}>
      <div
        className={modalClass}
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
          <div className="pill-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className={`pill-toggle ${
                mode === "addWidget" ? "pill-toggle--active" : ""
              }`}
              onClick={() => setMode("addWidget")}
            >
              +
            </button>
            {composerWidgets.map((w) => (
              <button
                key={w.type}
                type="button"
                className={`pill-toggle ${
                  mode === w.type ? "pill-toggle--active" : ""
                }`}
                onClick={() => setMode(w.type)}
              >
                {w.type}
              </button>
            ))}
          </div>
        </div>

        {mode === "addWidget" ? (
          <AddWidget />
        ) : currentComposer?.composer ? (
          currentComposer.composer({
            actions: widgetActions[currentComposer.type],
            authorId: selectedAuthorId,
            onClose,
          })
        ) : null}
      </div>
    </div>
  );
}
