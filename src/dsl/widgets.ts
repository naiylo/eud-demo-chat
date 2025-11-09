export type WidgetKind = "poll" | "list" | "contact";

export type ParsedWidget =
  | { kind: "poll"; question: string; options: string[]; multi?: boolean }
  | { kind: "list"; title: string; items: string[] }
  | { kind: "contact"; name: string; email?: string; phone?: string };

function parseLineKV(line: string): [string, string] | null {
  const m = line.match(/^\s*([a-zA-Z][\w-]*)\s*:\s*(.+)\s*$/);
  if (!m) return null;
  let value = m[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [m[1].toLowerCase(), value];
}

function splitList(s: string): string[] {
  // supports comma or pipe separated values, with optional quotes
  return s
    .split(/\||,/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'")) ? p.slice(1, -1) : p);
}

export function parseWidgetDSL(input: string): ParsedWidget {
  const text = input.trim();
  if (!text) throw new Error("Empty widget DSL");

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  // Determine kind from first token/line
  const first = lines[0].toLowerCase();
  let kind: WidgetKind | null = null;
  if (first.startsWith("poll")) kind = "poll";
  else if (first.startsWith("list")) kind = "list";
  else if (first.startsWith("contact")) kind = "contact";
  if (!kind) throw new Error("Unknown widget kind. Start with 'poll', 'list', or 'contact'.");

  // Parse remaining key: value lines
  const kvs = new Map<string, string>();
  for (const ln of lines.slice(1)) {
    const kv = parseLineKV(ln);
    if (kv) kvs.set(kv[0], kv[1]);
  }

  if (kind === "poll") {
    const question = kvs.get("question") || "";
    const optionsRaw = kvs.get("options") || "";
    const options = splitList(optionsRaw);
    const multi = /^true$/i.test(kvs.get("multi") || "false");
    if (!question) throw new Error("poll: 'question' is required");
    if (!options.length) throw new Error("poll: 'options' is required");
    return { kind, question, options, multi };
  }

  if (kind === "list") {
    const title = kvs.get("title") || "";
    const items = splitList(kvs.get("items") || "");
    if (!title) throw new Error("list: 'title' is required");
    if (!items.length) throw new Error("list: 'items' is required");
    return { kind, title, items };
  }

  // contact
  const name = kvs.get("name") || "";
  const email = kvs.get("email") || undefined;
  const phone = kvs.get("phone") || undefined;
  if (!name) throw new Error("contact: 'name' is required");
  return { kind: "contact", name, email, phone };
}

export function widgetMessageText(widget: ParsedWidget): string {
  if (widget.kind === "poll") {
    // Polls are persisted separately; message contains a marker.
    // The caller should replace this with the actual poll id once created.
    return `poll:pending`;
  }
  const payload = JSON.stringify(widget);
  return `widget:${widget.kind} ${payload}`;
}

