import { useMemo, useState } from "react";
import type { Message, Persona } from "../../db/sqlite";
import type {
  ChatWidgetDefinition,
  WidgetActionDeps,
  WidgetComposerProps,
  WidgetRenderProps,
} from "../types";

export interface PollCustom {
  prompt: string;
  options: string[];
}

export interface VoteCustom {
  pollId: string;
  optionIndex: number;
}

function isPollCustom(custom: unknown): custom is PollCustom {
  return (
    !!custom &&
    typeof custom === "object" &&
    Array.isArray((custom as PollCustom).options) &&
    typeof (custom as PollCustom).prompt === "string"
  );
}

function isVoteCustom(custom: unknown): custom is VoteCustom {
  return (
    !!custom &&
    typeof custom === "object" &&
    typeof (custom as VoteCustom).pollId === "string" &&
    typeof (custom as VoteCustom).optionIndex === "number"
  );
}

type PollActions = {
  createPoll: (
    poll: Pick<PollCustom, "prompt" | "options">,
    authorId: string
  ) => Promise<void>;
  submitVote: (
    pollId: string,
    optionIndex: number,
    authorId: string
  ) => Promise<void>;
};

function createActions({
  addMessage,
  deleteMessage,
  setMessages,
  getMessagesSnapshot,
}: WidgetActionDeps): PollActions {
  const createPoll: PollActions["createPoll"] = async (poll, authorId) => {
    const cleanOptions = poll.options.map((o) => o.trim()).filter(Boolean);
    if (!poll.prompt.trim() || cleanOptions.length < 2) return;

    const msg: Message = {
      id: `poll-${Date.now()}`,
      authorId,
      text: poll.prompt.trim(),
      timestamp: new Date().toISOString(),
      type: "createPoll",
      custom: {
        prompt: poll.prompt.trim(),
        options: cleanOptions,
      },
    };
    await addMessage(msg);
    setMessages((cur) => [...cur, msg]);
  };

  const submitVote: PollActions["submitVote"] = async (
    pollId,
    optionIndex,
    authorId
  ) => {
    const now = new Date().toISOString();
    const castVote: Message = {
      id: `vote-${Date.now()}`,
      authorId,
      text: "",
      timestamp: now,
      type: "vote",
      custom: { pollId, optionIndex } satisfies VoteCustom,
    };

    const votesToDelete = getMessagesSnapshot().filter(
      (m) =>
        m.type === "vote" &&
        (m.custom as VoteCustom)?.pollId === pollId &&
        m.authorId === authorId
    );
    for (const vote of votesToDelete) {
      await deleteMessage(vote.id);
    }

    setMessages((cur) =>
      cur
        .filter(
          (m) =>
            !(
              m.type === "vote" &&
              (m.custom as VoteCustom)?.pollId === pollId &&
              m.authorId === authorId
            )
        )
        .concat(castVote)
    );

    await addMessage(castVote);
  };
  return { createPoll, submitVote };
}

function PollComposer({
  actions,
  authorId,
  onClose,
}: WidgetComposerProps<PollActions>) {
  const [pollPrompt, setPollPrompt] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollAnonymous, setPollAnonymous] = useState(false);
  const [pollRevocable, setPollRevocable] = useState(true);

  const updateOption = (index: number, value: string) => {
    setPollOptions((opts) => opts.map((o, i) => (i === index ? value : o)));
  };

  const sendPoll = async () => {
    const cleanedOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollPrompt.trim() || cleanedOptions.length < 2) return;
    await actions.createPoll(
      {
        prompt: pollPrompt,
        options: cleanedOptions,
        allowMultiple: pollAllowMultiple,
        anonymous: pollAnonymous,
        voteRevocable: pollRevocable,
      },
      authorId
    );
    setPollPrompt("");
    setPollOptions(["", ""]);
    setPollAllowMultiple(false);
    setPollAnonymous(false);
    setPollRevocable(true);
    onClose();
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        placeholder="Poll question"
        value={pollPrompt}
        onChange={(e) => setPollPrompt(e.target.value)}
      />
      {pollOptions.map((opt, idx) => (
        <input
          key={idx}
          placeholder={`Option ${idx + 1}`}
          value={opt}
          onChange={(e) => updateOption(idx, e.target.value)}
        />
      ))}
      <button
        type="button"
        onClick={() => setPollOptions((opts) => [...opts, ""])}
        style={{ marginBottom: 4 }}
      >
        Add option
      </button>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={pollAllowMultiple}
          onChange={(e) => setPollAllowMultiple(e.target.checked)}
        />
        Allow multiple selections
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={pollAnonymous}
          onChange={(e) => setPollAnonymous(e.target.checked)}
        />
        Anonymous votes
      </label>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={pollRevocable}
          onChange={(e) => setPollRevocable(e.target.checked)}
        />
        Allow vote retraction
      </label>
      <div>
        <button
          type="button"
          onClick={sendPoll}
          disabled={!pollPrompt.trim() || pollOptions.filter((o) => o.trim()).length < 2}
        >
          Create Poll
        </button>
      </div>
    </div>
  );
}

function PollView({
  message,
  allMessages,
  personas,
  currentActorId,
  actions,
}: WidgetRenderProps<PollActions>) {
  if (!isPollCustom(message.custom)) {
    return <p>Poll is missing configuration.</p>;
  }

  const personaLookup = useMemo(
    () =>
      Object.fromEntries(personas.map((p) => [p.id, p])) as Record<string, Persona>,
    [personas]
  );

  const options = message.custom.options;

  const votes = allMessages.filter(
    (m) => m.type === "vote" && isVoteCustom(m.custom) && m.custom.pollId === message.id
  );

  const totalVotes = votes.length;
  const myVotes = votes.filter((v) => v.authorId === currentActorId);
  const myChoice = new Set(myVotes.map((v) => (v.custom as VoteCustom).optionIndex));

  const handleVote = (optionIndex: number) => {
    if (!actions.submitVote) return;
    actions.submitVote(message.id, optionIndex, currentActorId);
  };

  return (
    <div className="poll-card">
      <div className="poll-header">
        <p className="poll-question">{message.custom.prompt}</p>
      </div>
      <div className="poll-options">
        {options.map((option, index) => {
          const optionVotes = votes.filter(
            (v) => (v.custom as VoteCustom).optionIndex === index
          );
          const percent = totalVotes
            ? Math.round((optionVotes.length / totalVotes) * 100)
            : 0;
          const checked = myChoice.has(index);
          return (
            <button
              key={`${index}-${option}`}
              type="button"
              className={`poll-option ${checked ? "poll-option--selected" : ""}`}
              onClick={() => handleVote(index)}
              aria-pressed={checked}
            >
              <div className="poll-option__row">
                <div className="poll-option__title">{option}</div>
                <div className="poll-option__meta">
                  <span className="pill pill--ghost">
                    {optionVotes.length} vote{optionVotes.length === 1 ? "" : "s"}
                  </span>
                  <span className="pill pill--ghost">{percent}%</span>
                </div>
              </div>
              <div className="poll-option__progress">
                <div style={{ width: `${percent}%` }} />
              </div>
              {optionVotes.length > 0 && (
                <div className="poll-votees">
                  {optionVotes.map((vote) => {
                    const persona = personaLookup[vote.authorId];
                    if (!persona) return null;
                    return (
                      <span
                        key={vote.id}
                        className="poll-votees__avatar"
                        style={{ background: persona.color }}
                        title={persona.name}
                      >
                        {persona.name[0]}
                      </span>
                    );
                  })}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <footer className="poll-footer">
        <small>{totalVotes} total vote{totalVotes === 1 ? "" : "s"}</small>
      </footer>
    </div>
  );
}

export const pollWidget: ChatWidgetDefinition<PollActions> = {
  type: "createPoll",
  render: (props) => <PollView {...props} />,
  createActions,
  composer: (props) => <PollComposer {...props} />,
  hideMessage: (message) => message.type === "vote" || message.type === "deleteVote",
};

// Scoped styles injected when the widget is used, so the widget is self-contained.
const pollStyles = `
.poll-card {
  display: grid;
  gap: 12px;
  padding: 12px;
  background: linear-gradient(180deg, rgba(29, 40, 74, 0.45), rgba(13, 18, 36, 0.8));
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
}
.poll-header { display: grid; gap: 8px; }
.poll-question { margin: 0; font-weight: 700; }
.pill-row { display: flex; flex-wrap: wrap; gap: 8px; }
.pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 999px; background: rgba(122, 162, 255, 0.2); border: 1px solid rgba(122, 162, 255, 0.35); font-size: 12px; }
.pill--ghost { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); }
.poll-options { display: grid; gap: 10px; }
.poll-option { width: 100%; text-align: left; background: rgba(15, 18, 32, 0.8); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px; display: grid; gap: 8px; }
.poll-option--selected { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(122, 162, 255, 0.25); }
.poll-option__row { display: flex; align-items: center; justify-content: space-between; }
.poll-option__title { font-weight: 600; }
.poll-option__meta { display: flex; gap: 8px; }
.poll-option__progress { height: 6px; background: rgba(255, 255, 255, 0.05); border-radius: 999px; overflow: hidden; }
.poll-option__progress > div { height: 100%; background: linear-gradient(90deg, #5fa8ff, #7aa2ff); border-radius: 999px; }
.poll-votees { display: flex; gap: 6px; flex-wrap: wrap; }
.poll-votees__avatar { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; color: #0a0e1a; font-weight: 700; }
.poll-actions { display: flex; justify-content: flex-end; }
.poll-footer { color: var(--muted); }
`;

if (typeof document !== "undefined" && !document.getElementById("poll-widget-styles")) {
  const tag = document.createElement("style");
  tag.id = "poll-widget-styles";
  tag.textContent = pollStyles;
  document.head.appendChild(tag);
}
