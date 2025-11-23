import type { Message } from "../db/sqlite";
import type {
  ChatWidgetDefinition,
  WidgetActionDeps,
  WidgetRenderProps,
} from "./types";

type MessageActions = {
  sendMessage: (text: string, authorId: string) => Promise<void>;
};

function createActions({ addMessage, setMessages }: WidgetActionDeps): MessageActions {
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

function MessageView({
  message,
}: WidgetRenderProps<MessageActions>) {
  return <p>{message.text}</p>;
}

export const messageWidget: ChatWidgetDefinition<MessageActions> = {
  type: "message",
  render: (props) => <MessageView {...props} />,
  createActions,
};
