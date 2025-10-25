import React, { useState } from "react";

export function CodeWorkbench() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{
    status: "idle" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  // This is intentionally a passive input area. If you want, you can wire it up to a sandboxed evaluator later.
  const handleSave = () => {
    try {
      localStorage.setItem("workbench:snippet", code);
      setResult({ status: "success", message: "Snippet saved locally." });
    } catch (e: any) {
      setResult({ status: "error", message: e?.message || "Could not save." });
    }
  };

  return (
    <section className="code-workbench">
      <header className="panel-header">
        <h3>Code Input</h3>
        <p>
          Paste or write code here. This is separate from the chat composer.
        </p>
      </header>
      <textarea
        className="code-textarea"
        placeholder="// Your code snippet..."
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={10}
      />
      <div className="composer-actions">
        <button type="button" onClick={handleSave}>
          Save snippet
        </button>
      </div>
      {result.status !== "idle" && (
        <div
          className={`workbench-result ${
            result.status === "success"
              ? "workbench-result--success"
              : "workbench-result--error"
          }`}
        >
          {result.message}
        </div>
      )}
    </section>
  );
}
