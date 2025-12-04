import { useState } from "react";
import type { ChatWidgetDefinition, WidgetActionMap } from "../widgets/types";
import { AddWidget } from "./AddWidget";

export function WidgetWorkbench({
  open,
  onClose,
  widgets,
  widgetActions,
  selectedAuthorId,
}: {
  open: boolean;
  onClose: () => void;
  widgets: ChatWidgetDefinition[];
  widgetActions: WidgetActionMap;
  selectedAuthorId: string;
}) {
  const composerWidgets = widgets.filter(
    (w) => w.elements?.composer ?? (w as any)?.composer
  );
  const [mode, setMode] = useState<string>("message");
  const [removeNotice, setRemoveNotice] = useState<string>("");

  if (!open) return null;

  const currentComposer = composerWidgets.find((w) => w.type === mode);

  const modalClass =
    "workbench-modal" + (mode === "addWidget" ? " workbench-modal--wide" : "");

  const renderComposer = () => {
    if (mode === "addWidget") {
      return <AddWidget widgets={widgets} />;
    }
    if (!currentComposer) return null;

    if (!currentComposer.elements?.composer) return null;
    return currentComposer.elements.composer({
      actions: widgetActions[currentComposer.type],
      authorId: selectedAuthorId,
      onClose,
    });
  };

  const handleRemoveWidget = async (type: string, registryName?: string) => {
    const target = registryName || type;
    setRemoveNotice("");
    try {
      const res = await fetch(
        `/api/widgets?name=${encodeURIComponent(target)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to delete widget");
      }
      setRemoveNotice(`Removed ${target}. Reload to see changes.`);
      if (mode === type) setMode("message");
    } catch (err) {
      console.error(err);
      setRemoveNotice("Could not remove widget. Ensure dev server is running.");
    }
  };

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
              <div
                className={`pill-toggle pill-toggle-group ${
                  mode === w.type ? "pill-toggle--active" : ""
                }`}
                key={w.registryName || w.type}
              >
                <button
                  type="button"
                  className="pill-group__label"
                  onClick={() => setMode(w.type)}
                  aria-label={`Open ${w.type} composer`}
                >
                  {w.type}
                </button>
                <button
                  type="button"
                  className="pill-group__remove"
                  aria-label={`Remove ${w.registryName || w.type} widget`}
                  onClick={() => handleRemoveWidget(w.type, w.registryName)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {removeNotice && (
            <p className="workbench-helper">{removeNotice}</p>
          )}
        </div>

        {renderComposer()}
      </div>
    </div>
  );
}
