import type { AnyWidgetDefinition } from "./types";
import { messageWidget } from "./builtins/messageWidget";

export const widgetRegistry: AnyWidgetDefinition[] = [messageWidget];
