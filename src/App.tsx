import { useEffect, useState } from "react";
import { getPersonas, getMessages, addMessage, createPoll, clearMessages, deleteMessage } from "./db/sqlite";
import type { Persona, Message, Poll, PollConfig } from "./db/sqlite";
import { PersonaSidebar } from "./components/PersonaSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { DataPanel } from "./components/DataPanel";

import "./styles/styles.css";

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedAuthorId, setSelectedAuthorId] = useState("");
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [workbenchCode, setWorkbenchCode] = useState("");

  useEffect(() => {
    (async () => {
      const ps = await getPersonas();
      setPersonas(ps);
      setSelectedAuthorId(ps[0]?.id || "");
      setMessages(await getMessages("all")); // Always load full list
    })();
  }, []);

  const handleSend = async (text: string, authorId: string) => {
    const msg: Message = {
      id: `msg-${Date.now()}`,
      authorId,
      text,
      timestamp: new Date().toISOString(),
    };
    await addMessage(msg);
    setMessages((cur) => [...cur, msg]);
  };

  const handleCreatePoll = async ({
    question,
    options,
    config,
  }: {
    question: string;
    options: string[];
    config: PollConfig;
  }) => {
    const poll: Poll = {
      id: `poll-${Date.now()}`,
      creatorId: selectedAuthorId,
      question,
      options,
      config,
      timestamp: new Date().toISOString(),
    };
    await createPoll(poll);
    const msg: Message = {
      id: `msg-${Date.now()}-poll`,
      authorId: selectedAuthorId,
      text: `poll:${poll.id}`,
      timestamp: new Date().toISOString(),
    };
    await addMessage(msg);
    setMessages((cur) => [...cur, msg]);
  };

  const handleClearMessages = async () => {
    await clearMessages();
    setMessages([]);
  };

  const handleDeleteMessage = async (id: string) => {
    await deleteMessage(id);
    setMessages((cur) => cur.filter((m) => m.id !== id));
  };

  return (
    <div className="app app--wide">
      <main className="layout layout--with-sidebar">
        <div className="layout__sidebar">
          <PersonaSidebar
            personas={personas}
            selectedId={selectedAuthorId}
            onSelect={setSelectedAuthorId}
            workbenchCode={workbenchCode}
            onWorkbenchChange={setWorkbenchCode}
            onSend={handleSend}
            onCreatePoll={handleCreatePoll}
          />
        </div>
        <div className="layout__main">
          <ChatWindow
            personas={personas}
            messages={messages}
            selectedAuthorId={selectedAuthorId}
            onAuthorChange={setSelectedAuthorId}
            onSend={handleSend}
            onOpenData={() => setShowDataPanel(true)}
            onClearMessages={handleClearMessages}
            onDeleteMessage={handleDeleteMessage}
          />
          <DataPanel
            data={{ personas, messages, workbench: { code: workbenchCode } }}
            open={showDataPanel}
            onClose={() => setShowDataPanel(false)}
          />
        </div>
      </main>
    </div>
  );
}
