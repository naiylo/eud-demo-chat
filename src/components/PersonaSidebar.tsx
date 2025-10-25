import React from "react";
import type { Persona } from "../db/sqlite";

export function PersonaSidebar({
  personas,
  selectedId,
  onSelect,
}: {
  personas: Persona[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-section">
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
    </aside>
  );
}
