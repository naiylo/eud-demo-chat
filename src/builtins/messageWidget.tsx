import { useState } from "react";
import type { Message } from "../../db/sqlite";
import type {
  ChatWidgetDefinition,
  WidgetActionDeps,
  WidgetComposerProps,
  WidgetRenderProps,
} from "../types";

type MessageActions = {
  sendMessage: (text: string, authorId: string) => Promise<void>;
};

function createActions({
  addMessage,
  setMessages,
}: WidgetActionDeps): MessageActions {
  const sendMessage: MessageActions["sendMessage"] = async (text, authorId) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const msg: Message = {
      id: `msg-${Date.now()}`,
      authorId,
      text: trimmed,
      timestamp: new Date().toISOString(),
      type: "message",
      custom: [],
    };

    await addMessage(msg);
    setMessages((cur) => [...cur, msg]);
  };

  return { sendMessage };
}

function MessageView({ message }: WidgetRenderProps<MessageActions>) {
  return (
    <div className="message-widget">
      <p className="message-widget__text">{message.text}</p>
    </div>
  );
}

function MessageComposer({
  actions,
  authorId,
  onClose,
}: WidgetComposerProps<MessageActions>) {
  const [text, setText] = useState("");

  const handleSend = async () => {
    await actions.sendMessage(text, authorId);
    setText("");
    onClose();
  };

  return (
    <div className="message-widget-composer">
      <textarea
        placeholder="Type a message..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <div className="message-widget-composer__actions">
        <button type="button" onClick={handleSend} disabled={!text.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export const messageWidget: ChatWidgetDefinition<MessageActions> = {
  type: "message",
  render: (props) => <MessageView {...props} />,
  createActions,
  composer: (props) => <MessageComposer {...props} />,
};

const messageWidgetStyles = `
.message-widget { display: block; }
.message-widget__text { margin: 0; white-space: pre-wrap; }
.message-widget-composer { display: grid; gap: 8px; }
.message-widget-composer textarea {
  width: 100%;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: #161c2a;
  color: #f7fbff;
  padding: 10px;
  resize: vertical;
}
.message-widget-composer__actions { display: flex; justify-content: flex-end; }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("message-widget-styles")
) {
  const tag = document.createElement("style");
  tag.id = "message-widget-styles";
  tag.textContent = messageWidgetStyles;
  document.head.appendChild(tag);
}
