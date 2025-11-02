import type { Persona, Message } from "../db/sqlite";
import { PollCard } from "./PollCard";

export function MessageBubble({
  message,
  persona,
  currentActorId,
  personas,
}: {
  message: Message;
  persona?: Persona;
  currentActorId: string;
  personas: Persona[];
}) {
  if (!persona) return null;
  // Render poll card if this message links a poll
  if (message.text.startsWith("poll:")) {
    const pollId = message.text.slice("poll:".length).trim();
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
          <PollCard pollId={pollId} currentActorId={currentActorId} personas={personas} />
        </div>
      </div>
    );
  }
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
