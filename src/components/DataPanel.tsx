import React, { useMemo, useState } from "react";

export function DataPanel({ data }: { data: unknown }) {
  const formatted = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const [expanded, setExpanded] = useState(false);

  return (
    <section className={`data-panel ${expanded ? "data-panel--expanded" : ""}`}>
      <header className="panel-header">
        <h3>Conversation JSON</h3>
        <div className="panel-actions">
          <button type="button" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Close" : "Expand"}
          </button>
        </div>
      </header>
      <pre>
        <code>{formatted}</code>
      </pre>
    </section>
  );
}
