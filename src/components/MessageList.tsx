import { useEffect, useMemo, useRef } from "react";
import type { Persona, Message } from "../db/sqlite";
import { MessageBubble } from "./MessageBubble";

function useAutoScroll(deps: any[]) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, deps);
  return ref;
}

export function MessageList({
  messages,
  personas,
}: {
  messages: Message[];
  personas: Persona[];
}) {
  const ref = useAutoScroll([messages.length]);
  const byId = useMemo(
    () =>
      Object.fromEntries(personas.map((p) => [p.id, p])) as Record<
        string,
        Persona
      >,
    [personas]
  );

  return (
    <section className="message-stream" ref={ref}>
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} persona={byId[m.authorId]} />
      ))}
      {messages.length === 0 && (
        <div className="empty-state">
          <h3>No messages yet.</h3>
          <p>Pick an author in the sidebar and send your first message.</p>
        </div>
      )}
    </section>
  );
}
