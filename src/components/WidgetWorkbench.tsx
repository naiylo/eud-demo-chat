/**
 * Modal hub for widget authoring and testing.
 * Hosts add-widget flow, demo tab, and per-widget composer UIs.
 */
import { useState } from "react";
import type { ChatWidgetDefinition, WidgetActionMap } from "../widgets/types";
import { AddWidget } from "./AddWidget";
import { WidgetDemoTab } from "./WidgetDemoTab";
import type { Persona } from "../db/sqlite";

export function WidgetWorkbench({
  open,
  onClose,
  widgets,
  widgetActions,
  selectedAuthor,
}: {
  open: boolean;
  onClose: () => void;
  widgets: ChatWidgetDefinition[];
  widgetActions: WidgetActionMap;
  selectedAuthor: Persona;
}) {
  const ADD_WIDGET_KEY = "addWidget";
  const DEMO_TAB_KEY = "__demo__";
  const composerWidgets = widgets.filter(
    (w) => w.elements?.composer ?? (w as any)?.composer
  );
  const defaultKey =
    composerWidgets[0]?.registryName ??
    composerWidgets[0]?.type ??
    ADD_WIDGET_KEY;
  const [mode, setMode] = useState<string>(defaultKey);
  const [, setRemoveNotice] = useState<string>("");

  if (!open) return null;

  const currentComposer = composerWidgets.find(
    (w) => (w.registryName ?? w.type) === mode
  );

  const modalClass =
    "workbench-modal" +
    (mode === ADD_WIDGET_KEY ? " workbench-modal--wide" : "");

  const renderComposer = () => {
    if (mode === ADD_WIDGET_KEY) {
      return <AddWidget />;
    }
    if (mode === DEMO_TAB_KEY) {
      return <WidgetDemoTab widgets={widgets} />;
    }
    if (!currentComposer) return null;

    if (!currentComposer.elements?.composer) return null;
    const key = currentComposer.registryName ?? currentComposer.type;
    return currentComposer.elements.composer({
      actions: widgetActions[key],
      author: selectedAuthor,
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
      if (mode === (registryName || type)) setMode(defaultKey);
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
          Close
        </button>
        <div className="workbench-header">
          <h3 id="workbench-modal-title">Message Workbench</h3>
          <div className="pill-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className={`pill-toggle ${
                mode === ADD_WIDGET_KEY ? "pill-toggle--active" : ""
              }`}
              onClick={() => setMode(ADD_WIDGET_KEY)}
            >
              ➕
            </button>
            <button
              type="button"
              className={`pill-toggle ${
                mode === DEMO_TAB_KEY ? "pill-toggle--active" : ""
              }`}
              onClick={() => setMode(DEMO_TAB_KEY)}
            >
              🔎
            </button>
            {composerWidgets.map((w) => (
              <div
                className={`pill-toggle pill-toggle-group ${
                  mode === (w.registryName ?? w.type)
                    ? "pill-toggle--active"
                    : ""
                }`}
                key={w.registryName || w.type}
              >
                <button
                  type="button"
                  className="pill-group__label"
                  onClick={() => setMode(w.registryName ?? w.type)}
                  aria-label={`Open ${w.registryName as string} composer`}
                >
                  {w.registryName}
                </button>
                <button
                  type="button"
                  className="pill-group__remove"
                  aria-label={`Remove ${w.registryName as string} widget`}
                  onClick={() => handleRemoveWidget(w.type, w.registryName)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {renderComposer()}
      </div>
    </div>
  );
}
