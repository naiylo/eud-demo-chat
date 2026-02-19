# Change Impact Communication

Quick links:

- [Abstract](#abstract)
- [TL;DR](#tldr)
- [Repository Oversight](#repository-oversight)
- [Further Documentation](#further-documentation)

## Abstract

### Context

Software systems are rarely static as they evolve continuously, and every change carries the risk of unintended consequences. Change impact analysis, the process of identifying how a modification to one part of a system affects its broader behavior, is a well-established concern in software engineering. This challenge becomes particularly acute in the context of end-user development, where non-technical users create and modify code without the debugging knowledge that professional developers rely on. As low-code or no-code tools and large language models lower the barrier to software creation, understanding and communicating the behavioral impact of code changes becomes essential. We explore this challenge in the context of user-created widgets for messaging platforms, where non-technical users build and iteratively modify interactive functionality that directly manipulates shared message streams making undetected behavioral regressions particularly consequential.

### Inquiry

When non-programmers create widgets for messaging platforms, they face three core problems: they struggle to anticipate edge cases in their widget's behavior, they have limited ability to understand and debug errors when things go wrong, and they face uncertainty about how their widget will behave at runtime across different usage scenarios. Prior approaches to change impact analysis such as symbolic execution or LLM-based code inspection either seem too complex to apply efficiently or risk producing hallucinated results. Prior work in end-user programming suggests that uncertainty about how a program will behave in general is a key barrier to adoption. FlashProg, for instance, introduced Program Navigation and Conversational Clarification interfaces to help users resolve ambiguity by surfacing alternative program behaviors and asking targeted, example-driven questions (Soares et al., 2015). Systems like Whyline have similarly focused on making program behavior interpretable to non-programmers, though they largely depend on users initiating queries after something has already gone wrong, rather than surfacing potential issues ahead of time (Ko and Myers, 2008). Our work takes a different approach, rather than waiting for failures or requiring users to write test cases or read code, we aim to give users grounded, proactive feedback about how changes affect messaging widget behavior automatically generating varied action traces and flagging unexpected effects on message streams before problems arise in the actual runtime.

### Approach

We developed a system that automatically detects and communicates the behavioral impact of widget changes through fuzzing combined with heuristic-based validation. Upon each code change, a fuzzer generates randomized but semantically valid sequences ("logs") of action calls by analyzing the widget's data model and the dependencies between action types. These generated action logs are passed through a heuristic checker that inspects message stream changes produced by each action, flagging behaviors that indicate likely defects such as an action deleting multiple messages at once, or producing duplicate messages.

### Knowledge

Our system demonstrates that fuzzing over a widget's action and data model, combined with lightweight stream-level heuristics, can surface suspicious widget behaviors. Critically, this approach operates purely on the message stream, making it applicable even when widget intent cannot be inferred from appearance alone. The system also generates concrete example streams that illustrate heuristically flagged behaviors, giving non-technical users an accessible entry point for understanding and correcting problems in their widgets. Beyond detection, our system supports users throughout the entire widget creation process by actively monitoring their widget for potential risks as it is being built. Individual heuristic warnings can be dismissed by the user, ensuring that they retain full control and final judgment over which flagged behaviors are genuinely problematic and which are intentional design decisions.

### Grounding

We implemented the system and evaluated it against a custom poll widget and a custom bill splitter widget as test applications. The fuzzer successfully generated diverse, minimal, and dependency-aware action logs, and the heuristic checker identified genuine behavioral anomalies. The tests revealed both the promise of the approach and its current limitations, including a rate of false positives arising from generic heuristics and the absence of real semantic content in generated examples.

### Importance

As end-user development matures, ensuring that non-programmers can build reliable interactive software becomes essential. This work establishes a foundation for automated debugging support proactively informing widget creators when their code exhibits potentially harmful or unintended behavior without burdening them with technical debugging tasks, while providing them with concrete usage examples.

### Outlook

Future improvements could include:

#### Make assumption about actions described by the user

- Add labeling to individual functions that automatically load a partion of the heuritics, giving the user a push into the right direction in terms of which heuritics may be be relevant for the certain action
- For example: action naming could reveal whether it is a CRUD operation

#### General (outwritten) principles to derive generic heuristics for message streams

- What does a malicious message stream look like? Can we extract principles to derive heuristics automatically?
- Empty messages? Wrong author? Timestamp differences? ...

## TL;DR

- **What it does:** Lets you prototype, register, preview, and evaluate custom chat widgets.
- **Stack:** React 19, TypeScript, Vite
- **Persistence:** Personas and messages are stored in browser local storage via a SQLite database.
- **Widget model:** Widgets implement a `ChatWidgetDefinition` (`render`, optional `composer`, `createActions`, schemas, optional heuristics config). For this prototype, we assume users generated widgets according to the described structure using e.g. LLMs or are able to write TypeScript code by themselves.

## How to run

```bash
npm install
npm run dev
```

Or using the provided Dockerfile:

```bash
docker build -t eud-demo-chat:local .
docker run --rm -p 8080:8080 eud-demo-chat:local
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
.   └── examplebillsplitter.tsx   # basic bill splitter widget example
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
