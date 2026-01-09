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
  author: Persona;
  onClose: () => void;
};

export type WidgetElements<TActions> = {
  /**
   * How a widget paints a message row.
   */
  render: (props: WidgetRenderProps<TActions>) => ReactNode;
  /**
   * Optional: a composer shown in the workbench to create/send messages.
   */
  composer?: (props: WidgetComposerProps<TActions>) => ReactNode;
};

export interface ChatWidgetDefinition<TActions = unknown> {
  type: MessageType;
  elements: WidgetElements<TActions>;
  createActions: (deps: WidgetActionDeps) => TActions;
  hideMessage?: (message: Message) => boolean;
  /** Optional: name used in registry/file management */
  registryName?: string;
}

export type WidgetKey = string;
export type WidgetActionMap = Record<WidgetKey, unknown>;
export type AnyWidgetDefinition = ChatWidgetDefinition<any>;
