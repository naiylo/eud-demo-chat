import { parseWidgetDSL, widgetMessageText, type ParsedWidget } from "./widgets";

export type CompileResult =
  | { kind: "message"; text: string }
  | { kind: "createPoll"; question: string; options: string[]; config: { multi: boolean } };

export type CompileOutcome =
  | { ok: true; result: CompileResult }
  | { ok: false; error: string };

export function compileDSLToAction(input: string): CompileResult {
  const widget: ParsedWidget = parseWidgetDSL(input);
  if (widget.kind === "poll") {
    return {
      kind: "createPoll",
      question: widget.question,
      options: widget.options,
      config: { multi: !!widget.multi },
    };
  }
  return { kind: "message", text: widgetMessageText(widget) };
}

export function safeCompile(input: string): CompileOutcome {
  try {
    const result = compileDSLToAction(input);
    return { ok: true, result };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export const EXAMPLE_DSL =
  'Examples:\n' +
  'poll\nquestion: "Your question?"\noptions: "A" | "B" | "C"\nmulti: false\n\n' +
  'list\ntitle: "Groceries"\nitems: "milk", "bread", "eggs"\n\n' +
  'contact\nname: "Ada"\nemail: "ada@example.com"\nphone: "+1 555 0100"';

