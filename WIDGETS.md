# Widget Authoring Guide

This document explains how to structure a widget in this project and how to add one safely.

## 1. Widget Contract

Every widget must export a `ChatWidgetDefinition`.

```ts
import type { ChatWidgetDefinition } from "./types";
import type { Action } from "../generics/actions";

export const myWidget: ChatWidgetDefinition<Action[]> = {
  type: "my-widget-type",
  registryName: "myWidget",
  elements: {
    render: (props) => {
      /* render one message */
    },
    composer: (props) => {
      /* optional UI to create messages */
    },
  },
  schemas: [],
  createActions: (deps) => [
    /* Action objects */
  ],
};
```

Fields:

- `type`: message type this widget renders.
- `registryName` (optional): stable name used by workbench/demo lookup.
- `elements.render`: renderer for one message row.
- `elements.composer` (optional): UI shown in Widget Workbench.
- `schemas`: object schemas used by the widget and fuzzer.
- `createActions`: returns runtime actions that mutate messages.
- `hideMessage` (optional): suppress specific message types from main chat view.
- `disabledHeuristicsByAction` (optional): disable selected diagnostic heuristics.

## 2. Recommended File Structure

For one widget, keep everything in one file:

1. Imports.
2. Object schema definitions.
3. `createActions` function.
4. `Render` component.
5. Optional `Composer` component.
6. Exported widget definition.

Suggested location: `src/widgets/<widgetName>.tsx`.

## 3. Example: Normal Text Widget

The example below creates plain text messages with a small composer.

```tsx
import { useState } from "react";
import type { Message } from "../db/sqlite";
import type { Action } from "../generics/actions";
import {
  isOfSchema,
  newObjectInstance,
  type ObjectInstance,
  type ObjectSchema,
} from "../generics/objects";
import type {
  ChatWidgetDefinition,
  WidgetActionDeps,
  WidgetComposerProps,
  WidgetRenderProps,
} from "./types";

const textMessageSchema: ObjectSchema = {
  name: "textMessage",
  properties: [
    { name: "text", type: "string", array: false, minLength: 1 },
    { name: "authorId", type: "persona", array: false },
  ],
};

const textMessageType = "text-message";

function createActions({
  addMessage,
}: WidgetActionDeps): Action[] {
  const sendText: Action = {
    name: "sendText",
    description: "Create a plain text message",
    preConditions: [],
    postConditions: [],
    inputDefinition: [
      {
        name: "entry",
        schema: textMessageSchema,
        minCount: 1,
        maxCount: 1,
        uniqueInstance: true,
      },
    ],
    execute: async (input) => {
      const entry = input.entry?.[0];
      if (!entry) return;

      const text = String(entry.properties["text"] ?? "").trim();
      const authorId = String(entry.properties["authorId"] ?? "");
      if (!text || !authorId) return;

      const msg: Message = {
        id: entry.id,
        authorId,
        text,
        timestamp: new Date().toISOString(),
        type: textMessageType,
        custom: entry,
      };

      await addMessage(msg);
    },
  };

  return [sendText];
}

function TextComposer({
  actions,
  author,
  onClose,
}: WidgetComposerProps<Action[]>) {
  const [text, setText] = useState("");

  const send = async () => {
    const value = text.trim();
    if (!value) return;

    const action = actions.find((a) => a.name === "sendText");
    if (!action) return;

    await action.execute({
      entry: [
        newObjectInstance(textMessageSchema, `text-${Date.now()}`, {
          text: value,
          authorId: author.id,
        }),
      ],
    });

    setText("");
    onClose();
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input
        placeholder="Write a message"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button type="button" onClick={send} disabled={!text.trim()}>
        Send text
      </button>
    </div>
  );
}

function TextRender({ message }: WidgetRenderProps<Action[]>) {
  if (!message.custom || !isOfSchema(message.custom, "textMessage")) {
    return <p>{message.text}</p>;
  }

  const entry = message.custom as ObjectInstance;
  return <p>{String(entry.properties["text"] ?? "")}</p>;
}

export const textMessageWidget: ChatWidgetDefinition<Action[]> = {
  type: textMessageType,
  registryName: "textMessageWidget",
  elements: {
    render: (props) => <TextRender {...props} />,
    composer: (props) => <TextComposer {...props} />,
  },
  schemas: [textMessageSchema],
  createActions,
};
```

## 4. Register the Widget manually

Add the widget import and entry in `src/widgets/registry.ts`.

```ts
import type { AnyWidgetDefinition } from "./types";
import { textMessageWidget } from "./textMessageWidget";

export const widgetRegistry: AnyWidgetDefinition[] = [textMessageWidget];
```

## 5. Add Widgets Through the Workbench

Alternative flow (no manual registry edit):

1. Start dev server (`npm run dev`).
2. Open Widget Workbench.
3. Paste a full widget file into Add Widget.
4. Ensure it uses `export const <Name>`.
5. Submit.

The Vite dev middleware saves `src/widgets/<Name>.tsx` and updates `src/widgets/registry.ts` automatically.
