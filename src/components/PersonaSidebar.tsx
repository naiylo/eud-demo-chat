import { useState } from "react";
import type { Persona } from "../db/sqlite";
import { WidgetWorkbench } from "./WidgetWorkbench";
import type { PollConfig } from "../db/sqlite";

export function PersonaSidebar({
  personas,
  selectedId,
  onSelect,
  workbenchCode,
  onWorkbenchChange,
  onSend,
  onCreatePoll,
}: {
  personas: Persona[];
  selectedId: string;
  onSelect: (id: string) => void;
  workbenchCode: string;
  onWorkbenchChange: (code: string) => void;
  onSend: (text: string, authorId: string) => void;
  onCreatePoll: (input: { question: string; options: string[]; config: PollConfig }) => Promise<void> | void;
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
        code={workbenchCode}
        onChange={onWorkbenchChange}
        open={showWorkbench}
        onClose={() => setShowWorkbench(false)}
        onSendMessage={onSend}
        onCreatePoll={({ question, options, config: { multi } }) =>
          onCreatePoll({
            question,
            options,
            config: {
              visibility: { resultsVisibleTo: "all" },
              eligibility: {},
              voting: { multiple: !!multi, allowChangeVote: true },
            },
          })
        }
        selectedAuthorId={selectedId}
      />
    </>
  );
}
