import { useState } from "react";

export function AddWidget() {
  const [code, setCode] = useState("");

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
          <small>{code.trim() ? `${code.split(/\r?\n/).length} lines` : "Waiting for code..."}</small>
          <button type="button">Submit widget</button>
        </div>
      </section>
      <section className="add-widget-pane add-widget-pane--preview">
        <h4>Preview</h4>
      </section>
    </div>
  );
}
