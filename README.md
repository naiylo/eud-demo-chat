# Change Impact Communication

Quick links:

- [Abstract](#abstract)
- [TL;DR](#tldr)
- [Repository Oversight](#repository-oversight)
- [Further Documentation](#further-documentation)

## Abstract

### Context

Messaging platforms have become central to everyday coordination and collaboration. Some platform providers are beginning to explore ways of empowering their userbases to create their own widgets, seeing this as a promising way to make the platform more engaging while enriching the overall platform experience. As end-user development tools and large language models lower the barrier to creating such widgets, non-technical users gain the ability to build interactive functionality without programming expertise. This shift levels the playing field for software creation but introduces significant new challenges.

### Inquiry

When non-programmers create widgets for messaging platforms, they face three core problems: they struggle to anticipate edge cases in their widget's behavior, they have limited ability to understand and debug errors when things go wrong, and they face uncertainty about how their widget will behave at runtime across different usage scenarios. Prior approaches to behavior analysis such as symbolic execution or LLM-based code inspection either prove too complex to apply efficiently to widget code or risk hallucinating incorrect results.

### Approach

We developed a system that simulates widget behavior through fuzzing combined with heuristic-based validation. The fuzzer automatically generates randomized but semantically valid sequences of action calls by analyzing the widget's data model and the dependencies between message types. These generated action logs are then passed through a heuristic checker that inspects message stream changes produced by each action, flagging behaviors that indicate likely defects such as an action deleting multiple messages at once, or producing duplicate messages.

### Knowledge

Our system demonstrates that fuzzing over a widget's action and data model, combined with lightweight stream-level heuristics, can surface suspicious widget behaviors. Critically, this approach operates purely on the message stream, making it applicable even when widget intent cannot be inferred from appearance alone. The system also generates concrete example streams that illustrate flagged behaviors, giving non-technical users an accessible entry point for understanding and correcting problems in their widgets. Beyond detection, our system supports users throughout the entire widget creation process by actively monitoring their widget for potential risks as it is being built. Individual heuristic warnings can be dismissed by the user, ensuring that they retain full control and final judgment over which flagged behaviors are genuinely problematic and which are intentional design decisions.

### Grounding

We implemented the system and evaluated it against a custom poll widget and a custom bill splitter widget as test applications. The fuzzer successfully generated diverse, minimal, and dependency-aware action logs, and the heuristic checker identified genuine behavioral anomalies. The demo revealed both the promise of the approach and its current limitations, including a rate of false positives arising from generic heuristics and the absence of real semantic content in generated examples.

### Importance

As end-user development matures, ensuring that non-programmers can build reliable interactive software becomes essential. This work establishes a foundation for automated debugging support proactively informing widget creators when their code exhibits potentially harmful or unintended behavior without burdening them with technical debugging tasks, while providing them with concrete usage examples.

### Outlook

Future improvements could include:

- Add labeling to individual functions that automatically load a partion fo the heuritics, giving the user a push into the right direction in terms of what heuritics may be be relevant for the certain action
- Adaptive context-aware heuristics
- Creating meta principles to for heuristic derivation out of data types

Potential impr

## TL;DR

- **What it does:** Lets you prototype, register, preview, and evaluate custom chat widgets.
- **Stack:** React 19, TypeScript, Vite
- **Persistence:** Personas and messages are stored in browser local storage via SQLite.
- **Widget model:** Widgets implement a `ChatWidgetDefinition` (`render`, optional `composer`, `createActions`, schemas, optional heuristics config).
- **How to run:**

```bash
npm install
npm run dev
```

Open the local Vite URL and use the sidebar to open the Widget Workbench.

## Repository Structure

This displays only the core structure.

```
src/
├── App.tsx                       # top-level React app shell and layout
├── components/...                # reusable UI components shared across features
├── db
.   └── sqlite.ts                 # SQLite connection and setup utilities
├── exampleWidgets/
.   └── brokenpoll.tsx            # intentionally broken widget for diagnostics
.   └── examplepoll.tsx           # baseline poll widget example
.   └── multiplechoicepoll.tsx    # multi-option poll widget example
├── generator/...                 # code and widget generation pipeline
├── generics/...                  # shared generic helpers and abstractions
├── styles/...                    # global and component-level styling assets
├── widgets/
.   └── demoDiagnostics.ts        # demo diagnostics and validation helpers
.   └── registry.ts               # widget registry and lookup map
.   └── types.ts                  # core widget TypeScript contracts
```

## Further Documentation

- Widget authoring and structure guide: `WIDGETS.md`
