import type { Dispatch, SetStateAction, ReactNode } from "react";
import type { Message, MessageType, Persona } from "../db/sqlite";

export type WidgetActionDeps = {
  addMessage: (msg: Message) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  getMessagesSnapshot: () => Message[];
};

export type WidgetRenderProps<TActions> = {
  message: Message;
  allMessages: Message[];
  personas: Persona[];
  currentActorId: string;
  actions: TActions;
};

export type WidgetComposerProps<TActions> = {
  actions: TActions;
  authorId: string;
  onClose: () => void;
};

export interface ChatWidgetDefinition<TActions = unknown> {
  type: MessageType;
  render: (props: WidgetRenderProps<TActions>) => ReactNode;
  createActions: (deps: WidgetActionDeps) => TActions;
  composer?: (props: WidgetComposerProps<TActions>) => ReactNode;
  hideMessage?: (message: Message) => boolean;
}

export type WidgetActionMap = Partial<Record<MessageType, unknown>>;
