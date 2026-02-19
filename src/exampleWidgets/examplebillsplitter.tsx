import { useMemo, useState } from "react";
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
} from "../widgets/types";

const billSchema: ObjectSchema = {
  name: "billSplitterBill",
  properties: [
    {
      name: "title",
      type: "string",
      array: false,
      minLength: 1,
      maxLength: 80,
    },
    { name: "totalAmount", type: "number", array: false, minValue: 0.01 },
    {
      name: "splitCount",
      type: "number",
      array: false,
      minValue: 2,
      maxValue: 50,
    },
    { name: "authorId", type: "persona", array: false },
  ],
};

const contributionSchema: ObjectSchema = {
  name: "billSplitterContribution",
  properties: [
    {
      name: "billId",
      type: "reference",
      array: false,
      referenceSchema: billSchema.name,
    },
    { name: "authorId", type: "persona", array: false },
    { name: "amount", type: "number", array: false, minValue: 0.01 },
  ],
};

const billMessageType = "examplebillsplitterbill";
const contributionMessageType = "examplebillsplittercontribution";

const toMoney = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
};

const formatCurrency = (value: number) => `$${value.toFixed(2)}`;

function createActions({
  addMessage,
  setMessages,
  getMessagesSnapshot,
}: WidgetActionDeps): Action[] {
  const createBill: Action = {
    name: "createBill",
    description: "Create a new bill that can be split evenly.",
    preConditions: [],
    postConditions: [],
    inputDefinition: [
      {
        name: "bill",
        schema: billSchema,
        minCount: 1,
        maxCount: 1,
        uniqueInstance: true,
      },
    ],
    execute: async (input: Record<string, ObjectInstance[]>) => {
      const bill = input.bill?.[0];
      if (!bill) return;

      const title = String(bill.properties["title"] ?? "").trim();
      const totalAmount = toMoney(bill.properties["totalAmount"]);
      const splitCount = Math.floor(Number(bill.properties["splitCount"]));
      const authorId = String(bill.properties["authorId"] ?? "");

      if (!title || totalAmount <= 0 || splitCount < 2 || !authorId) return;

      const normalizedBill = newObjectInstance(billSchema, bill.id, {
        title,
        totalAmount,
        splitCount,
        authorId,
      });

      const msg: Message = {
        id: normalizedBill.id,
        authorId,
        text: `${title} (${formatCurrency(totalAmount)})`,
        timestamp: new Date().toISOString(),
        type: billMessageType,
        custom: normalizedBill,
      };

      await addMessage(msg);
      setMessages((cur) => [...cur, msg]);
    },
  };

  const addContribution: Action = {
    name: "addContribution",
    description: "Add one person's payment toward a bill.",
    preConditions: [
      {
        name: "billExists",
        description: "The bill must exist before adding a contribution.",
        validate: (previousActions, _nextActions, data) => {
          const contribution = data["contribution"]?.[0];
          if (!contribution) return false;
          const billId = String(contribution.properties["billId"] ?? "");
          if (!billId) return false;
          return previousActions.some(
            (action) =>
              action.action === "createBill" &&
              action.input["bill"]?.[0]?.id === billId,
          );
        },
      },
    ],
    postConditions: [],
    inputDefinition: [
      {
        name: "contribution",
        schema: contributionSchema,
        minCount: 1,
        maxCount: 1,
        uniqueInstance: true,
      },
    ],
    execute: async (input: Record<string, ObjectInstance[]>) => {
      const contribution = input.contribution?.[0];
      if (!contribution) return;

      const billId = String(contribution.properties["billId"] ?? "");
      const authorId = String(contribution.properties["authorId"] ?? "");
      const amount = toMoney(contribution.properties["amount"]);
      if (!billId || !authorId || amount <= 0) return;

      const billExists = getMessagesSnapshot().some(
        (msg) =>
          msg.type === billMessageType &&
          msg.custom &&
          isOfSchema(msg.custom, billSchema.name) &&
          msg.id === billId,
      );
      if (!billExists) return;

      const normalizedContribution = newObjectInstance(
        contributionSchema,
        contribution.id,
        { billId, authorId, amount },
      );

      const contributionMessage: Message = {
        id: normalizedContribution.id,
        authorId,
        text: `Paid ${formatCurrency(amount)}`,
        timestamp: new Date().toISOString(),
        type: contributionMessageType,
        custom: normalizedContribution,
      };

      setMessages((cur) => [...cur, contributionMessage]);
      await addMessage(contributionMessage);
    },
  };

  return [createBill, addContribution];
}

function BillSplitterComposer({
  actions,
  author,
  onClose,
}: WidgetComposerProps<Action[]>) {
  const [title, setTitle] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [splitCount, setSplitCount] = useState("");

  const send = async () => {
    const action = actions.find((candidate) => candidate.name === "createBill");
    if (!action) return;

    const cleanTitle = title.trim();
    const parsedTotalAmount = toMoney(totalAmount);
    const parsedSplitCount = Math.floor(Number(splitCount));
    if (!cleanTitle || parsedTotalAmount <= 0 || parsedSplitCount < 2) return;

    await action.execute({
      bill: [
        newObjectInstance(billSchema, `bill-${Date.now()}`, {
          title: cleanTitle,
          totalAmount: parsedTotalAmount,
          splitCount: parsedSplitCount,
          authorId: author.id,
        }),
      ],
    });

    setTitle("");
    setTotalAmount("");
    setSplitCount("");
    onClose();
  };

  return (
    <div className="bill-splitter-composer">
      <label className="bill-splitter-composer__field">
        <span>Bill title</span>
        <input
          placeholder="Dinner at Rossi's"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="bill-splitter-composer__row">
        <label className="bill-splitter-composer__field">
          <span>Total amount</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
          />
        </label>
        <label className="bill-splitter-composer__field">
          <span>People</span>
          <input
            type="number"
            min={2}
            step={1}
            value={splitCount}
            onChange={(event) => setSplitCount(event.target.value)}
          />
        </label>
      </div>
      <button type="button" onClick={send} disabled={!title.trim()}>
        Create bill
      </button>
    </div>
  );
}

function BillSplitterView({
  message,
  allMessages,
  personas,
  currentActorId,
  actions,
}: WidgetRenderProps<Action[]>) {
  if (!message.custom || !isOfSchema(message.custom, billSchema.name)) {
    return <p>{message.text}</p>;
  }

  const bill = message.custom as ObjectInstance;
  const title = String(bill.properties["title"] ?? "Untitled bill");
  const totalAmount = Math.max(0, toMoney(bill.properties["totalAmount"]));
  const splitCount = Math.max(
    1,
    Math.floor(Number(bill.properties["splitCount"])),
  );
  const sharePerPerson = toMoney(totalAmount / splitCount);

  const contributionMessages = allMessages.filter(
    (entry): entry is Message & { custom: ObjectInstance } =>
      entry.type === contributionMessageType &&
      entry.custom !== null &&
      isOfSchema(entry.custom, contributionSchema.name) &&
      entry.custom.properties["billId"] === bill.id,
  );

  const paidByAuthor = contributionMessages.reduce<Record<string, number>>(
    (acc, entry) => {
      const amount = toMoney(entry.custom.properties["amount"]);
      if (amount <= 0) return acc;
      acc[entry.authorId] = toMoney((acc[entry.authorId] ?? 0) + amount);
      return acc;
    },
    {},
  );

  const totalPaid = toMoney(
    Object.values(paidByAuthor).reduce((sum, value) => sum + value, 0),
  );
  const remainingTotal = Math.max(0, toMoney(totalAmount - totalPaid));
  const myPaid = paidByAuthor[currentActorId] ?? 0;
  const myRemaining = Math.max(0, toMoney(sharePerPerson - myPaid));
  const contributionAction = actions.find(
    (candidate) => candidate.name === "addContribution",
  );

  const topContributors = Object.entries(paidByAuthor)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5);

  const personaById = useMemo(
    () =>
      Object.fromEntries(
        personas.map((persona) => [persona.id, persona]),
      ) as Record<
        string,
        { id: string; name: string; color: string; bio: string }
      >,
    [personas],
  );

  const resolvePersonaName = (id: string) => personaById[id]?.name ?? id;
  const resolvePersonaColor = (id: string) =>
    personaById[id]?.color ?? "#a3afc2";
  const progress =
    totalAmount > 0 ? Math.min(100, (totalPaid / totalAmount) * 100) : 0;
  const statusLabel =
    remainingTotal === 0 ? "Settled" : `${formatCurrency(remainingTotal)} left`;

  const payMyShare = async () => {
    if (!contributionAction || myRemaining <= 0) return;
    await contributionAction.execute({
      contribution: [
        newObjectInstance(
          contributionSchema,
          `contribution-${Date.now()}-${currentActorId}`,
          {
            billId: bill.id,
            authorId: currentActorId,
            amount: myRemaining,
          },
        ),
      ],
    });
  };

  return (
    <div className="bill-splitter-card">
      <header className="bill-splitter-card__header">
        <div>
          <p className="bill-splitter-card__eyebrow">Bill splitter</p>
          <h4>{title}</h4>
        </div>
        <span className="bill-splitter-chip">{statusLabel}</span>
      </header>

      <div className="bill-splitter-progress">
        <div style={{ width: `${progress}%` }} />
      </div>

      <div className="bill-splitter-metrics">
        <p>
          <span>Total</span>
          <strong>{formatCurrency(totalAmount)}</strong>
        </p>
        <p>
          <span>Each</span>
          <strong>{formatCurrency(sharePerPerson)}</strong>
        </p>
        <p>
          <span>Paid</span>
          <strong>{formatCurrency(totalPaid)}</strong>
        </p>
      </div>

      <button
        className="bill-splitter-pay"
        type="button"
        onClick={payMyShare}
        disabled={myRemaining <= 0}
      >
        {myRemaining > 0
          ? `Pay my share (${formatCurrency(myRemaining)})`
          : "Your share is settled"}
      </button>

      <div className="bill-splitter-contributors">
        {topContributors.length === 0 && <small>No contributions yet.</small>}
        {topContributors.map(([authorId, amount]) => (
          <div key={authorId} className="bill-splitter-contributor">
            <span
              className="bill-splitter-contributor__avatar"
              style={{ background: resolvePersonaColor(authorId) }}
              title={resolvePersonaName(authorId)}
            >
              {resolvePersonaName(authorId).slice(0, 1)}
            </span>
            <small>
              {resolvePersonaName(authorId)} paid {formatCurrency(amount)}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

const billSplitterStyles = `
.bill-splitter-card {
  display: grid;
  gap: 14px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, #121831 0%, #0c1224 100%);
  box-shadow: 0 18px 46px rgba(2, 6, 20, 0.55);
  padding: 16px;
  color: #eef4ff;
}

.bill-splitter-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.bill-splitter-card__header h4 {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
}

.bill-splitter-card__eyebrow {
  margin: 0 0 4px 0;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #9aa9c6;
}

.bill-splitter-chip {
  border-radius: 999px;
  border: 1px solid rgba(122, 162, 255, 0.5);
  background: rgba(122, 162, 255, 0.16);
  color: #dbe7ff;
  font-size: 12px;
  padding: 4px 10px;
  white-space: nowrap;
}

.bill-splitter-progress {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.bill-splitter-progress > div {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #7aa2ff, #5af3ff);
  transition: width 220ms ease;
}

.bill-splitter-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.bill-splitter-metrics p {
  margin: 0;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.03);
  padding: 8px 10px;
  display: grid;
  gap: 2px;
}

.bill-splitter-metrics span {
  font-size: 11px;
  color: #9aa9c6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.bill-splitter-metrics strong {
  font-size: 14px;
}

.bill-splitter-pay {
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: linear-gradient(90deg, #7aa2ff, #5af3ff);
  color: #050914;
  font-weight: 700;
  padding: 9px 12px;
}

.bill-splitter-pay:disabled {
  opacity: 0.6;
}

.bill-splitter-contributors {
  display: grid;
  gap: 6px;
}

.bill-splitter-contributor {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bill-splitter-contributor__avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  color: #050914;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.16);
}

.bill-splitter-composer {
  display: grid;
  gap: 10px;
}

.bill-splitter-composer__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.bill-splitter-composer__field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: #9aa9c6;
}

.bill-splitter-composer__field span {
  font-weight: 600;
}

.bill-splitter-composer__field input {
  width: 100%;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: #eef4ff;
  padding: 8px 10px;
}

.bill-splitter-composer button {
  border: 0;
  border-radius: 12px;
  padding: 9px 12px;
  background: linear-gradient(90deg, #7aa2ff, #5af3ff);
  color: #050914;
  font-weight: 700;
}

.bill-splitter-composer button:disabled {
  opacity: 0.6;
}
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("example-bill-splitter-styles")
) {
  const style = document.createElement("style");
  style.id = "example-bill-splitter-styles";
  style.textContent = billSplitterStyles;
  document.head.appendChild(style);
}

export const examplebillsplitter: ChatWidgetDefinition<Action[]> = {
  type: billMessageType,
  registryName: "examplebillsplitter",
  elements: {
    render: (props) => <BillSplitterView {...props} />,
    composer: (props) => <BillSplitterComposer {...props} />,
  },
  schemas: [billSchema, contributionSchema],
  createActions,
  hideMessage: (message) => message.type === contributionMessageType,
  disabledHeuristicsByAction: {
    all: [],
    createBill: [],
    addContribution: [],
  },
};
