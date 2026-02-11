# Widget Creation (Short)

1) Create a widget file in `src/widgets/` (see example below).
2) Export a `ChatWidgetDefinition`.
3) Register it in `src/widgets/registry.ts`.

Minimal template:

```tsx
import type { ChatWidgetDefinition, WidgetActionDeps } from "./types";
import type { Action } from "../generics/actions";

const widgetType = "mywidget";

function createActions(_deps: WidgetActionDeps): Action[] {
  return [];
}

export const mywidget: ChatWidgetDefinition<Action[]> = {
  type: widgetType,
  registryName: "mywidget",
  elements: {
    render: () => <div>My widget</div>,
  },
  schemas: [],
  createActions,
};
```

Register it:

```ts
// src/widgets/registry.ts
import { mywidget } from "./mywidget";

export const widgetRegistry = [mywidget];
```

Optional:
- Hide helper messages: `hideMessage: (m) => m.type === "..."`.
- Disable heuristics per action: `disabledHeuristicsByAction: { all: ["rule-id"] }`.
