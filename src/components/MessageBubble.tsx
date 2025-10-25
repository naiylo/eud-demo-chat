import type { Persona, Message } from "../db/sqlite";

export function MessageBubble({
  message,
  persona,
}: {
  message: Message;
  persona?: Persona;
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
          .slice(0, 2)}
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
        </header>
        <p>{message.text}</p>
      </div>
    </div>
  );
}
