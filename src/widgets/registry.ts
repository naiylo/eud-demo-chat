import type { AnyWidgetDefinition } from "./types";
import { pollWidget } from "./pollWidget";

export const widgetRegistry: AnyWidgetDefinition[] = [pollWidget];
