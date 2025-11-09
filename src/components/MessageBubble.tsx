import type { Persona, Message } from "../db/sqlite";

export function MessageBubble({
  message,
  persona,
  onDelete,
}: {
  message: Message;
  persona?: Persona;
  currentActorId: string;
  personas: Persona[];
  onDelete?: (id: string) => void;
}) {
  if (!persona) return null;
  return (
    <div className="message">
      <div
        className="message-avatar"
        style={{ backgroundColor: persona.color }}
      >
        {persona.name
          .split(" ")
          .map((c) => c[0])
          .join("")
          .slice(0, 1)}
      </div>
      <div className="message-content">
        <header>
          <strong>{persona.name}</strong>
          <time>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(message.id)}
              aria-label="Delete message"
              style={{ marginLeft: 12 }}
            >
              Delete
            </button>
          )}
        </header>
        <p>{message.text}</p>
      </div>
    </div>
  );
}
