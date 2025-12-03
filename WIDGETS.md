# Widgets: How to add a new one

The chat supports pluggable widgets. Each widget lives in **one file** under `src/widgets/` and registers itself through `src/widgets/registry.ts`. Think of a widget as a tiny class with clearly separated elements:
- Its message type(s) and custom payload interfaces
- Its create/toggle/send actions
- Its `elements.render` (how a row is painted)
- Its optional `elements.composer` (UI shown in the workbench)
- Its own injected styles (keeps global CSS clean)

## Quick steps
1) Create `src/widgets/<yourWidget>.tsx` that exports a `ChatWidgetDefinition` with an `elements` block.
2) Add the widget to `widgetRegistry` in `src/widgets/registry.ts`.
3) Done. The app will render your widget messages, hide any helper/system messages you mark, and expose your composer in the workbench.

## Widget file template
```ts
import { useState } from "react";
import type { Message, Persona } from "../db/sqlite";
import type { ChatWidgetDefinition, WidgetActionDeps, WidgetRenderProps, WidgetComposerProps } from "./types";

// 1) Define custom payloads owned by the widget
export interface MyCustom { /* ... */ }

// 2) (Optional) Type guards for safety when reading message.custom
function isMyCustom(x: unknown): x is MyCustom { /* ... */ }

// 3) Actions (createActions) get DB/state helpers via deps
type MyActions = { /* functions you need in render/composer */ };
function createActions({ addMessage, deleteMessage, setMessages, getMessagesSnapshot }: WidgetActionDeps): MyActions {
  // build and return your widget-specific actions
}

// 4) Composer: optional UI shown in the workbench tab for this widget
function MyComposer({ actions, authorId, onClose }: WidgetComposerProps<MyActions>) { /* ... */ }

// 5) Render: how a message of this widget type is displayed
function MyView(props: WidgetRenderProps<MyActions>) { /* ... */ }

// 6) Export the definition with elements
export const myWidget: ChatWidgetDefinition<MyActions> = {
  type: "<yourMessageType>",
  createActions,
  elements: {
    render: (props) => <MyView {...props} />,
    composer: (props) => <MyComposer {...props} />, // optional
  },
  hideMessage: (message) => /* return true for helper/system rows to hide */,
  registryName: "<optional-registry-name>",
};

// 7) (Optional) Inject styles so the widget is self-contained
const myStyles = `...css...`;
if (typeof document !== "undefined" && !document.getElementById("my-widget-styles")) {
  const tag = document.createElement("style");
  tag.id = "my-widget-styles";
  tag.textContent = myStyles;
  document.head.appendChild(tag);
}
```

### Registry
```ts
// src/widgets/registry.ts
import { myWidget } from "./myWidget";
export const widgetRegistry = [myWidget /*, other widgets */];
```

### Notes
- `MessageType` in the DB is open (`"message" | string`), so widgets can introduce new types without touching the DB schema.
- If your widget emits helper/system messages (like votes or updates), use `hideMessage` to keep them out of the main stream.
- Keep all widget styling in the widget file to avoid leaking CSS across widgets.
