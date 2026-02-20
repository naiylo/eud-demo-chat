import { useEffect, useMemo, useRef, useState } from "react";
import {
  getPersonas,
  getMessages,
  addMessage as persistMessage,
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
  const messagesRef = useRef<Message[]>([]);
  const [selectedAuthorId, setSelectedAuthorId] = useState("");
  const [showDataPanel, setShowDataPanel] = useState(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    (async () => {
      const ps = await getPersonas();
      setPersonas(ps);
      setSelectedAuthorId(ps[0]?.id || "");
      setMessages(await getMessages("all")); // Always load full list
    })();
  }, []);

  const widgetActions: WidgetActionMap = useMemo(() => {
    const deps = {
      addMessage: async (msg: Message) => {
        await persistMessage(msg);
        setMessages((cur) => [...cur, msg]);
      },
      getMessagesSnapshot: () => messagesRef.current,
    };
    return Object.fromEntries(
      widgetRegistry.map((w) => [
        w.registryName ?? w.type,
        w.createActions(deps),
      ])
    ) as WidgetActionMap;
  }, []);

  // Message sending is now handled by the message widget actions (registry-based)
  const handleSend = async (text: string, authorId: string) => {
    const actions = widgetActions["message"] as
      | { sendMessage: (text: string, authorId: string) => Promise<void> }
      | undefined;
    await actions?.sendMessage(text, authorId);
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
