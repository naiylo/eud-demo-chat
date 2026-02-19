/**
 * Sidebar for selecting the active persona and opening the widget workbench.
 * Passes widget registry/actions through to workbench tools.
 */
import { useState } from "react";
import type { Persona } from "../db/sqlite";
import { WidgetWorkbench } from "./WidgetWorkbench";
import type { ChatWidgetDefinition, WidgetActionMap } from "../widgets/types";

export function PersonaSidebar({
  personas,
  selectedId,
  onSelect,
  widgets,
  widgetActions,
}: {
  personas: Persona[];
  selectedId: string;
  onSelect: (id: string) => void;
  widgets: ChatWidgetDefinition[];
  widgetActions: WidgetActionMap;
}) {
  const [showWorkbench, setShowWorkbench] = useState(false);

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-section sidebar-section--personas">
          <h3>Personas</h3>
          <div className="persona-list">
            {personas.map((p) => (
              <button
                key={p.id}
                className={`persona-item ${
                  selectedId === p.id ? "persona-item--active" : ""
                }`}
                style={{ borderColor: p.color }}
                onClick={() => onSelect(p.id)}
              >
                <span
                  className="persona-dot"
                  style={{ backgroundColor: p.color }}
                />
                <div className="persona-meta">
                  <strong>{p.name}</strong>
                  <small>{p.bio}</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="workbench-trigger"
          onClick={() => setShowWorkbench((v) => !v)}
          aria-expanded={showWorkbench}
          aria-controls="widget-workbench"
        >
          {showWorkbench ? "Hide Workbench" : "Open Widget Workbench"}
        </button>
      </aside>
      <WidgetWorkbench
        open={showWorkbench}
        onClose={() => setShowWorkbench(false)}
        widgets={widgets}
        widgetActions={widgetActions}
        selectedAuthor={personas.find((p) => p.id === selectedId)!}
      />
    </>
  );
}
