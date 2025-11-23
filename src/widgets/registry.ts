import { pollWidget } from "./pollWidget";
import { messageWidget } from "./messageWidget";
import type { ChatWidgetDefinition } from "./types";

export const widgetRegistry: ChatWidgetDefinition[] = [
  messageWidget,
  pollWidget,
];
