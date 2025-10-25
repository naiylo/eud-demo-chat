import React, { useEffect, useState } from "react";
import "./styles/styles.css";
import { getPersonas, getMessages, addMessage } from "./db/sqlite";
import type { Persona, Message } from "./db/sqlite";
import { PersonaSidebar } from "./components/PersonaSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { DataPanel } from "./components/DataPanel";
import { CodeWorkbench } from "./components/CodeWorkbench";

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedAuthorId, setSelectedAuthorId] = useState("");

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

  return (
    <div className="app app--wide">
      <header className="app-header">
        <div>
          <h1>Chat Personas Studio</h1>
          <p>
            A cleaner layout with sidebar author switching, a real chat window,
            a separate code input area, and an expandable JSON view.
          </p>
        </div>
      </header>

      <main className="layout layout--with-sidebar">
        <div className="layout__sidebar">
          <PersonaSidebar
            personas={personas}
            selectedId={selectedAuthorId}
            onSelect={setSelectedAuthorId}
          />
          <CodeWorkbench />
        </div>
        <div className="layout__main">
          <ChatWindow
            personas={personas}
            messages={messages}
            selectedAuthorId={selectedAuthorId}
            onAuthorChange={setSelectedAuthorId}
            onSend={handleSend}
          />
          <DataPanel data={{ personas, messages }} />
        </div>
      </main>
    </div>
  );
}
