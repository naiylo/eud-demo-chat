import type { AnyWidgetDefinition } from "./types";
import { StandardPoll } from "./StandardPoll";
import { PollBrokenDeleteVoteFunction } from "./PollBrokenDeleteVoteFunction";
import { examplepoll } from "./examplepoll";

export const widgetRegistry: AnyWidgetDefinition[] = [
  StandardPoll,
  PollBrokenDeleteVoteFunction,
  examplepoll,
];
