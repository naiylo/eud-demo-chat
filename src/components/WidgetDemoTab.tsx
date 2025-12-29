import { useEffect, useMemo, useState } from "react";
import type { ChatWidgetDefinition } from "../widgets/types";
import { WidgetPreviewDemo } from "./WidgetPreviewDemo";

export function WidgetDemoTab({ widgets }: { widgets: ChatWidgetDefinition[] }) {
  const [previewKey, setPreviewKey] = useState("");
  const [previewKeyEdited, setPreviewKeyEdited] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!widgets.length || previewKeyEdited) return;
    setPreviewKey(widgets[0]?.registryName ?? widgets[0]?.type ?? "");
  }, [widgets, previewKeyEdited]);

  const availableNames = useMemo(
    () => widgets.map((w) => w.registryName ?? w.type).filter(Boolean),
    [widgets]
  );
  const normalizedKey = previewKey.trim();
  const matchedWidget = useMemo(
    () =>
      widgets.find(
        (w) => w.registryName === normalizedKey || w.type === normalizedKey
      ),
    [widgets, normalizedKey]
  );
  const showMissing = Boolean(normalizedKey) && !matchedWidget;

  return (
    <div className="workbench-demo">
      <section className="add-widget-pane">
        <h4>Sample demo</h4>
        <label className="add-widget-helper" style={{ display: "grid", gap: 6 }}>
          Preview widget (registry name)
          <input
            type="text"
            value={previewKey}
            onChange={(e) => {
              setPreviewKeyEdited(true);
              setPreviewKey(e.target.value);
            }}
            placeholder="e.g. examplepoll"
            className="add-widget-preview-input"
          />
          <small>
            Available registry names:{" "}
            {availableNames.length ? availableNames.join(", ") : "None yet"}
          </small>
          {showMissing && (
            <small className="workbench-error">
              No widget named "{normalizedKey}".
            </small>
          )}
        </label>
        <button
          type="button"
          className="widget-preview__play"
          onClick={() => setPreviewOpen(true)}
          disabled={!matchedWidget}
        >
          Open sample demo
        </button>
        <p className="add-widget-helper" style={{ marginTop: 8 }}>
          The demo opens a roomy modal and scales the widget down to fit while
          keeping its styling intact.
        </p>
      </section>

      {previewOpen && matchedWidget && (
        <WidgetPreviewDemo
          widget={matchedWidget}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
