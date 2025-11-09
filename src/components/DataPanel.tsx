import { useEffect, useMemo } from "react";

export function DataPanel({
  data,
  open,
  onClose,
}: {
  data: unknown;
  open: boolean;
  onClose: () => void;
}) {
  const formatted = useMemo(() => JSON.stringify(data, null, 2), [data]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="data-modal-overlay" onClick={onClose}>
      <div
        className="data-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="data-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <h3 id="data-modal-title">Conversation JSON</h3>
          <div className="panel-actions">
            <button type="button" onClick={onClose} aria-label="Close JSON panel">
              Close
            </button>
          </div>
        </header>
        <pre>
          <code>{formatted}</code>
        </pre>
      </div>
    </div>
  );
}
