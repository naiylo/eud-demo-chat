import { useEffect, useMemo, useState } from "react";
import {
  getPersonas,
  getMessages,
  addMessage,
  clearMessages,
  deleteMessage,
} from "./db/sqlite";
import type {
  Persona,
  Message,
} from "./db/sqlite";
import { PersonaSidebar } from "./components/PersonaSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { DataPanel } from "./components/DataPanel";
import { widgetRegistry } from "./widgets/registry";
import type { WidgetActionMap } from "./widgets/types";

import "./styles/styles.css";

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedAuthorId, setSelectedAuthorId] = useState("");
  const [showDataPanel, setShowDataPanel] = useState(false);

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
      type: "message",
      custom: [],
    };
    await addMessage(msg);
    setMessages((cur) => [...cur, msg]);
  };

  const widgetActions: WidgetActionMap = useMemo(() => {
    const deps = {
      addMessage,
      deleteMessage,
      setMessages,
      getMessagesSnapshot: () => messages,
    };
    return Object.fromEntries(
      widgetRegistry.map((w) => [w.type, w.createActions(deps)])
    ) as WidgetActionMap;
  }, [addMessage, deleteMessage, messages, setMessages]);

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
            onSend={handleSend}
            widgets={widgetRegistry}
            widgetActions={widgetActions}
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
            widgets={widgetRegistry}
            widgetActions={widgetActions}
          />
          <DataPanel
            data={{ personas, messages }}
            open={showDataPanel}
            onClose={() => setShowDataPanel(false)}
          />
        </div>
      </main>
    </div>
  );
}
