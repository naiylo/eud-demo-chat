/**
 * Scrollable message timeline with automatic scroll-to-bottom behavior.
 * Filters hidden widget message types before rendering bubbles.
 */
import { useEffect, useMemo, useRef } from "react";
import type { Persona, Message } from "../db/sqlite";
import { MessageBubble } from "./MessageBubble";
import type { ChatWidgetDefinition, WidgetActionMap } from "../widgets/types";

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
  currentActorId,
  onDeleteMessage,
  widgets,
  widgetActions,
}: {
  messages: Message[];
  personas: Persona[];
  currentActorId: string;
  onDeleteMessage?: (id: string) => void;
  widgets: ChatWidgetDefinition[];
  widgetActions: WidgetActionMap;
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

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (m) => !widgets.some((w) => w.hideMessage?.(m))
      ) as Message[],
    [messages, widgets]
  );

  return (
    <section className="message-stream" ref={ref}>
      {visibleMessages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          persona={byId[m.authorId]}
          personas={personas}
          currentActorId={currentActorId}
          onDelete={onDeleteMessage}
          allMessages={messages}
          widgets={widgets}
          widgetActions={widgetActions}
        />
      ))}
      {visibleMessages.length === 0 && (
        <div className="empty-state">
          <h3>No messages yet.</h3>
          <p>Pick an author in the sidebar and send your first message.</p>
        </div>
      )}
    </section>
  );
}
