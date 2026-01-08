import type { AnyWidgetDefinition } from "./types";
import { StandardPoll } from "./StandardPoll";
import { PollBrokenDeleteVoteFunction } from "./PollBrokenDeleteVoteFunction";
import { fuzzedPoll } from "./fuzzedPoll";

export const widgetRegistry: AnyWidgetDefinition[] = [
  StandardPoll,
  PollBrokenDeleteVoteFunction,
  fuzzedPoll,
];
