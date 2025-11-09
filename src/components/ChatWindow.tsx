import type { Persona, Message } from "../db/sqlite";
import { MessageList } from "./MessageList";

export function ChatWindow({
  personas,
  messages,
  selectedAuthorId,
  onOpenData,
}: {
  personas: Persona[];
  messages: Message[];
  selectedAuthorId: string;
  onAuthorChange: (id: string) => void;
  onSend: (text: string, authorId: string) => void;
  onOpenData?: () => void;
}) {
  return (
    <section className="chat-window">
      <header className="chat-window__header">
        <h2>Conversation</h2>
        {onOpenData && (
          <button
            type="button"
            onClick={onOpenData}
            aria-label="View JSON data"
          >
            View JSON
          </button>
        )}
      </header>
      <MessageList
        messages={messages}
        personas={personas}
        currentActorId={selectedAuthorId}
      />
    </section>
  );
}
