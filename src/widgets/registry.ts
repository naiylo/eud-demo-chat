import { pollWidget } from "./pollWidget";
import { messageWidget } from "./messageWidget";
import { checklistWidget } from "./checklistWidget";
import type { AnyWidgetDefinition } from "./types";

export const widgetRegistry: AnyWidgetDefinition[] = [
  messageWidget,
  pollWidget,
  checklistWidget,
];
