import type { Persona, Message } from "../db/sqlite";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

export function ChatWindow({
  personas,
  messages,
  selectedAuthorId,
  onAuthorChange,
  onSend,
}: {
  personas: Persona[];
  messages: Message[];
  selectedAuthorId: string;
  onAuthorChange: (id: string) => void;
  onSend: (text: string, authorId: string) => void;
}) {
  return (
    <section className="chat-window">
      <header className="chat-window__header">
        <h2>Conversation</h2>
      </header>
      <MessageList messages={messages} personas={personas} />
      <Composer
        personas={personas}
        selectedAuthorId={selectedAuthorId}
        onAuthorChange={onAuthorChange}
        onSend={onSend}
      />
    </section>
  );
}
