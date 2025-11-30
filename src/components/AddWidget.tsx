import { useEffect, useMemo, useState } from "react";
import type { ChatWidgetDefinition } from "../widgets/types";
import { messageWidget } from "../widgets/builtins/messageWidget";
import { pollWidget } from "../widgets/hidereadyWidgets/pollWidget";
import { WidgetPreviewDemo } from "./WidgetPreviewDemo";

export function AddWidget({ widgets }: { widgets: ChatWidgetDefinition[] }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState("message");
  const [previewTypeEdited, setPreviewTypeEdited] = useState(false);

  const exportName = useMemo(() => {
    const match = code.match(/export const\s+(\w+)/);
    return match?.[1] ?? "customWidget";
  }, [code]);

  const inferredWidgetType = useMemo(() => {
    const match = code.match(/type:\s*["'`](\w+)["'`]/);
    return match?.[1] ?? "message";
  }, [code]);

  useEffect(() => {
    if (!previewTypeEdited) {
      setPreviewType(inferredWidgetType);
    }
  }, [inferredWidgetType, previewTypeEdited]);

  const knownWidgets = useMemo(() => {
    const seen = new Set<string>();
    const list = [messageWidget, pollWidget, ...widgets].filter((w) => {
      if (seen.has(w.type)) return false;
      seen.add(w.type);
      return true;
    });
    return list;
  }, [widgets]);

  const matchedWidget = knownWidgets.find((w) => w.type === previewType);
  const fallbackWidget =
    knownWidgets.find((w) => w.type === inferredWidgetType) ?? messageWidget;
  const previewWidget = matchedWidget ?? fallbackWidget;

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
    <>
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
                ? `${code.split(/\r?\n/).length} lines - export "${exportName}"`
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
          <label className="add-widget-helper" style={{ display: "grid", gap: 6 }}>
            Preview type (editable)
            <input
              type="text"
              value={previewType}
              onChange={(e) => {
                setPreviewTypeEdited(true);
                setPreviewType(e.target.value.trim());
              }}
              placeholder="e.g. createPoll"
              className="add-widget-preview-input"
            />
            <small>
              Inferred from code: <strong>{inferredWidgetType}</strong>
              {matchedWidget
                ? " · Found matching widget"
                : " · Not registered yet, preview uses closest match"}
            </small>
          </label>
          <button
            type="button"
            className="widget-preview__play"
            onClick={() => setPreviewOpen(true)}
          >
            Open sample demo
          </button>
          <p className="add-widget-helper" style={{ marginTop: 8 }}>
            The demo opens a roomy modal and scales the widget down to fit while
            keeping its styling intact.
          </p>
          {!matchedWidget && previewType && (
            <p className="add-widget-helper" style={{ color: "var(--muted)" }}>
              Widget type <strong>{previewType}</strong> is not registered in
              this session. Submit and reload to preview its real styling.
            </p>
          )}
        </section>
      </div>

      {previewOpen && (
        <WidgetPreviewDemo
          widget={previewWidget}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </>
  );
}
