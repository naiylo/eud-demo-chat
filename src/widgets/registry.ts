import type { AnyWidgetDefinition } from "./types";
import { examplepoll } from "./examplepoll";
import { isCreatePollActionInput } from "./isCreatePollActionInput";

export const widgetRegistry: AnyWidgetDefinition[] = [
  examplepoll,
  isCreatePollActionInput,
];
