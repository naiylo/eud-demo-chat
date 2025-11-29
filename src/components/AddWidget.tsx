import { useMemo, useState } from "react";

export function AddWidget() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  const exportName = useMemo(() => {
    const match = code.match(/export const\s+(\w+)/);
    return match?.[1] ?? "customWidget";
  }, [code]);

  const handleSubmit = async () => {
    if (!code.trim()) return;
    setStatus("saving");
    setMessage("");
    try {
      const res = await fetch("/api/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to save widget");
      }
      const payload = (await res.json()) as {
        slug: string;
        exportName: string;
      };
      setStatus("saved");
      setMessage(
        `Saved ${payload.exportName} as ${payload.slug}.tsx and updated registry.`
      );
    } catch (err) {
      console.error(err);
      setStatus("error");
      setMessage(
        "Could not save widget. Make sure the dev server is running and you used export const <Name>."
      );
    }
  };

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
          <small>
            {code.trim()
              ? `${code.split(/\r?\n/).length} lines · export "${exportName}"`
              : "Waiting for code..."}
          </small>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!code.trim() || status === "saving"}
          >
            {status === "saving" ? "Saving..." : "Submit widget"}
          </button>
        </div>
        {message && (
          <p
            className={`add-widget-helper ${
              status === "error" ? "add-widget-helper--error" : ""
            }`}
          >
            {message}
          </p>
        )}
      </section>
      <section className="add-widget-pane add-widget-pane--preview">
        <h4>Preview</h4>
      </section>
    </div>
  );
}
