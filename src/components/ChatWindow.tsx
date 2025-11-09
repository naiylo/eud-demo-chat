import type { Persona, Message } from "../db/sqlite";
import { MessageList } from "./MessageList";

export function ChatWindow({
  personas,
  messages,
  selectedAuthorId,
  onOpenData,
  onClearMessages,
  onDeleteMessage,
}: {
  personas: Persona[];
  messages: Message[];
  selectedAuthorId: string;
  onAuthorChange: (id: string) => void;
  onSend: (text: string, authorId: string) => void;
  onOpenData?: () => void;
  onClearMessages?: () => void;
  onDeleteMessage?: (id: string) => void;
}) {
  return (
    <section className="chat-window">
      <header className="chat-window__header">
        <h2>Conversation</h2>
        <div style={{ display: "flex", gap: 12 }}>
          {onOpenData && (
            <button
              type="button"
              onClick={onOpenData}
              aria-label="View JSON data"
            >
              View JSON
            </button>
          )}
          {onClearMessages && (
            <button
              type="button"
              onClick={onClearMessages}
              aria-label="Clear all messages"
            >
              Clear Messages
            </button>
          )}
        </div>
      </header>
      <MessageList
        messages={messages}
        personas={personas}
        currentActorId={selectedAuthorId}
        onDeleteMessage={onDeleteMessage}
      />
    </section>
  );
}
