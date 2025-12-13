import type { AnyWidgetDefinition } from "./types";
import { StandardPoll } from "./StandardPoll";
import { PollBrokenDeleteVoteFunction } from "./PollBrokenDeleteVoteFunction";

export const widgetRegistry: AnyWidgetDefinition[] = [
  StandardPoll,
  PollBrokenDeleteVoteFunction,
];
