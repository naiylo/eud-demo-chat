import { useMemo, useState } from "react";
import type { Message } from "../db/sqlite";
import type {
  ChatWidgetDefinition,
  WidgetActionDeps,
  WidgetComposerProps,
  WidgetRenderProps,
} from "../widgets/types";

export interface ChecklistCustom {
  title: string;
  items: string[];
}

export interface ChecklistUpdate {
  checklistId: string;
  itemIndex: number;
  checked: boolean;
}

function isChecklistCustom(custom: unknown): custom is ChecklistCustom {
  return (
    !!custom &&
    typeof custom === "object" &&
    Array.isArray((custom as ChecklistCustom).items) &&
    typeof (custom as ChecklistCustom).title === "string"
  );
}

function isChecklistUpdate(custom: unknown): custom is ChecklistUpdate {
  return (
    !!custom &&
    typeof custom === "object" &&
    typeof (custom as ChecklistUpdate).checklistId === "string" &&
    typeof (custom as ChecklistUpdate).itemIndex === "number" &&
    typeof (custom as ChecklistUpdate).checked === "boolean"
  );
}

type ChecklistActions = {
  createChecklist: (data: ChecklistCustom, authorId: string) => Promise<void>;
  toggleItem: (
    checklistId: string,
    itemIndex: number,
    checked: boolean,
    authorId: string
  ) => Promise<void>;
};

function createActions({
  addMessage,
  setMessages,
}: WidgetActionDeps): ChecklistActions {
  const createChecklist: ChecklistActions["createChecklist"] = async (
    data,
    authorId
  ) => {
    const cleanedItems = data.items.map((i) => i.trim()).filter(Boolean);
    if (!data.title.trim() || cleanedItems.length === 0) return;
    const msg: Message = {
      id: `checklist-${Date.now()}`,
      authorId,
      text: data.title.trim(),
      timestamp: new Date().toISOString(),
      type: "checklist",
      custom: {
        title: data.title.trim(),
        items: cleanedItems,
      },
    };
    await addMessage(msg);
    setMessages((cur) => [...cur, msg]);
  };

  const toggleItem: ChecklistActions["toggleItem"] = async (
    checklistId,
    itemIndex,
    checked,
    authorId
  ) => {
    const update: Message = {
      id: `checklist-update-${Date.now()}`,
      authorId,
      text: "",
      timestamp: new Date().toISOString(),
      type: "checklistUpdate",
      custom: { checklistId, itemIndex, checked } as ChecklistUpdate,
    };
    setMessages((cur) => [...cur, update]);
    await addMessage(update);
  };

  return { createChecklist, toggleItem };
}

function ChecklistComposer({
  actions,
  authorId,
  onClose,
}: WidgetComposerProps<ChecklistActions>) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<string[]>(["", ""]);

  const updateItem = (idx: number, value: string) => {
    setItems((cur) => cur.map((item, i) => (i === idx ? value : item)));
  };

  const addRow = () => setItems((cur) => [...cur, ""]);

  const save = async () => {
    await actions.createChecklist({ title, items }, authorId);
    setTitle("");
    setItems(["", ""]);
    onClose();
  };

  const valid = title.trim() && items.some((i) => i.trim());

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        placeholder="Checklist title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      {items.map((item, idx) => (
        <input
          key={idx}
          placeholder={`Item ${idx + 1}`}
          value={item}
          onChange={(e) => updateItem(idx, e.target.value)}
        />
      ))}
      <button type="button" onClick={addRow} style={{ justifySelf: "start" }}>
        Add item
      </button>
      <button type="button" onClick={save} disabled={!valid}>
        Create Checklist
      </button>
    </div>
  );
}

function ChecklistView({
  message,
  allMessages,
  personas,
  currentActorId,
  actions,
}: WidgetRenderProps<ChecklistActions>) {
  if (!isChecklistCustom(message.custom)) {
    return <p>Checklist missing configuration.</p>;
  }

  const owner = personas.find((p) => p.id === message.authorId);
  const updates = useMemo(
    () =>
      allMessages.filter(
        (m) =>
          m.type === "checklistUpdate" &&
          isChecklistUpdate(m.custom) &&
          m.custom.checklistId === message.id
      ),
    [allMessages, message.id]
  );

  const checked = new Set<number>();
  for (const u of updates) {
    if (isChecklistUpdate(u.custom) && u.custom.checked) {
      checked.add(u.custom.itemIndex);
    } else if (isChecklistUpdate(u.custom)) {
      checked.delete(u.custom.itemIndex);
    }
  }

  const toggle = (index: number) => {
    actions.toggleItem(message.id, index, !checked.has(index), currentActorId);
  };

  return (
    <div className="checklist-card">
      <div className="checklist-header">
        <p className="checklist-title">{message.custom.title}</p>
        {owner && <span className="pill pill--ghost">Owner: {owner.name}</span>}
      </div>
      <ul className="checklist-items">
        {message.custom.items.map((item, idx) => (
          <li key={idx}>
            <label>
              <input
                type="checkbox"
                checked={checked.has(idx)}
                onChange={() => toggle(idx)}
              />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const checklistWidget: ChatWidgetDefinition<ChecklistActions> = {
  type: "checklist",
  registryName: "examplechecklist",
  render: (props) => <ChecklistView {...props} />,
  createActions,
  composer: (props) => <ChecklistComposer {...props} />,
  hideMessage: (message) => message.type === "checklistUpdate",
};

const checklistStyles = `
.checklist-card { display: grid; gap: 12px; padding: 12px; background: rgba(16,20,35,0.7); border: 1px solid var(--border); border-radius: var(--radius-md); }
.checklist-header { display: flex; align-items: center; gap: 10px; justify-content: space-between; }
.checklist-title { margin: 0; font-weight: 700; }
.checklist-items { margin: 0; padding-left: 16px; display: grid; gap: 8px; list-style: none; }
.checklist-items li { background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px; }
.checklist-items label { display: flex; gap: 10px; align-items: center; cursor: pointer; }
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("checklist-widget-styles")
) {
  const tag = document.createElement("style");
  tag.id = "checklist-widget-styles";
  tag.textContent = checklistStyles;
  document.head.appendChild(tag);
}
