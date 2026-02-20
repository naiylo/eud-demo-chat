/**
 * Basic text composer used for plain chat messages.
 * Keeps author selection in sync with the sidebar selection.
 */
import { useState, useEffect } from "react";
import type { Persona } from "../db/sqlite";

export function Composer({
  personas,
  selectedAuthorId,
  onAuthorChange,
  onSend,
}: {
  personas: Persona[];
  selectedAuthorId: string;
  onAuthorChange: (id: string) => void;
  onSend: (text: string, authorId: string) => void;
}) {
  const [text, setText] = useState("");
  const [authorId, setAuthorId] = useState(
    selectedAuthorId || personas[0]?.id || "",
  );

  useEffect(() => {
    if (selectedAuthorId) setAuthorId(selectedAuthorId);
  }, [selectedAuthorId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t, authorId);
    setText("");
  };

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-row">
        <label>
          Author
          <select
            value={authorId}
            onChange={(e) => {
              const v = e.target.value;
              setAuthorId(v);
              onAuthorChange(v);
            }}
          >
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        placeholder="Type a message to add to the conversation..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
      />
      <div className="composer-actions">
        <button type="submit">Send</button>
      </div>
    </form>
  );
}
