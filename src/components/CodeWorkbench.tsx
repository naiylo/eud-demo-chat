import { useEffect, useState } from "react";
import type { Persona, PollConfig } from "../db/sqlite";

const DEFAULT_POLL_JSON = `{
  "question": "Where should we go for lunch?",
  "options": ["Sushi", "Pizza", "Salad"],
  "visibility": { "resultsVisibleTo": "all" },
  "eligibility": { "allowedPersonaIds": [] },
  "voting": { "multiple": false, "allowChangeVote": true }
}`;

export function CodeWorkbench({
  personas,
  onCreatePoll,
}: {
  personas: Persona[];
  onCreatePoll: (config: {
    question: string;
    options: string[];
    config: PollConfig;
  }) => void;
}) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{
    status: "idle" | "success" | "error";
    message?: string;
  }>({ status: "idle" });

  useEffect(() => {
    const saved = localStorage.getItem("workbench:pollTemplate");
    setCode(saved || DEFAULT_POLL_JSON);
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem("workbench:pollTemplate", code);
      setResult({ status: "success", message: "Poll template saved locally." });
    } catch (e: any) {
      setResult({ status: "error", message: e?.message || "Could not save." });
    }
  };

  const handleCreatePoll = () => {
    try {
      const parsed = JSON.parse(code);
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");
      const question = String(parsed.question || "").trim();
      const options = Array.isArray(parsed.options)
        ? parsed.options.map((o: any) => String(o)).filter((s: string) => s.trim())
        : [];
      if (!question) throw new Error("Missing 'question'.");
      if (options.length < 2) throw new Error("Provide at least two options.");
      const config: PollConfig = {
        visibility: {
          resultsVisibleTo: parsed?.visibility?.resultsVisibleTo ?? "all",
        },
        eligibility: {
          allowedPersonaIds: parsed?.eligibility?.allowedPersonaIds ?? [],
        },
        voting: {
          multiple: !!parsed?.voting?.multiple,
          allowChangeVote: parsed?.voting?.allowChangeVote !== false,
        },
      };
      onCreatePoll({ question, options, config });
      setResult({ status: "success", message: "Poll created and posted to chat." });
      // persist template for convenience
      localStorage.setItem("workbench:pollTemplate", code);
    } catch (e: any) {
      setResult({ status: "error", message: e?.message || "Invalid poll JSON." });
    }
  };

  return (
    <section className="code-workbench">
      <header className="panel-header">
        <h3>Poll Builder</h3>
        <p>Define your poll via JSON and post it into chat.</p>
      </header>
      <textarea
        className="code-textarea"
        placeholder={DEFAULT_POLL_JSON}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={10}
      />
      <div className="composer-actions">
        <button type="button" onClick={handleSave}>
          Save template
        </button>
        <button type="button" onClick={handleCreatePoll}>
          Create poll in chat
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
