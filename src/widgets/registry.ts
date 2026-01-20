import type { AnyWidgetDefinition } from "./types";
import { StandardPoll } from "./StandardPoll";
import { examplepoll } from "./examplepoll";
import { brokenpoll } from "./brokenpoll";

export const widgetRegistry: AnyWidgetDefinition[] = [
  StandardPoll,
  examplepoll,
  brokenpoll,
];
