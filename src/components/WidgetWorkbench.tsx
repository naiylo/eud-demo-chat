export function WidgetWorkbench({
  code,
  onChange,
  open,
  onClose,
}: {
  code: string;
  onChange: (code: string) => void;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="data-modal-overlay" onClick={onClose}>
      <div
        className="workbench-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workbench-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="workbench-header">
          <h3 id="workbench-modal-title">Widget Workbench</h3>
          <div className="panel-actions">
            <button type="button" onClick={onClose} aria-label="Close workbench">
              Close
            </button>
          </div>
        </div>
        <textarea
          className="workbench-editor"
          placeholder="Write or paste widget code here..."
          value={code}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
