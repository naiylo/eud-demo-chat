import { useMemo, useState } from "react";
import type { Message, Persona } from "../db/sqlite";
import type {
  ChatWidgetDefinition,
  WidgetActionDeps,
  WidgetComposerProps,
  WidgetRenderProps,
} from "../widgets/types";

type PollOption = { id: string; label: string };

export interface PollCustom {
  prompt: string;
  options: PollOption[];
}

export interface VoteCustom {
  pollId: string;
  optionId: string;
}

const isPollCustom = (custom: unknown): custom is PollCustom =>
  !!custom &&
  typeof (custom as PollCustom).prompt === "string" &&
  Array.isArray((custom as PollCustom).options);

const isVoteCustom = (custom: unknown): custom is VoteCustom =>
  !!custom &&
  typeof (custom as VoteCustom).pollId === "string" &&
  typeof (custom as VoteCustom).optionId === "string";

type PollActions = {
  createPoll: (
    poll: Pick<PollCustom, "prompt" | "options">,
    authorId: string
  ) => Promise<string | undefined>;
  addVote: (
    pollId: string,
    optionId: string,
    authorId: string
  ) => Promise<void>;
  deleteVote: (pollId: string, authorId: string) => Promise<void>;
};

function createActions({
  addMessage,
  deleteMessage,
  setMessages,
  getMessagesSnapshot,
}: WidgetActionDeps): PollActions {
  const createPoll: PollActions["createPoll"] = async (poll, authorId) => {
    if (!poll.prompt.trim() || poll.options.length < 2) return;
    const id = `poll-${Date.now()}`;
    const msg: Message = {
      id,
      authorId,
      text: poll.prompt.trim(),
      timestamp: new Date().toISOString(),
      type: "createPoll",
      custom: poll,
    };
    await addMessage(msg);
    setMessages((cur) => [...cur, msg]);
    return id;
  };

  const addVote: PollActions["addVote"] = async (
    pollId,
    optionId,
    authorId
  ) => {
    const alreadyVoted = getMessagesSnapshot().some(
      (m) =>
        m.type === "vote" &&
        isVoteCustom(m.custom) &&
        m.custom.pollId === pollId &&
        m.authorId === authorId
    );
    if (alreadyVoted) return;

    const vote: Message = {
      id: `vote-${Date.now()}`,
      authorId,
      text: "",
      timestamp: new Date().toISOString(),
      type: "vote",
      custom: { pollId, optionId } satisfies VoteCustom,
    };
    setMessages((cur) => [...cur, vote]);
    await addMessage(vote);
  };

  const deleteVote: PollActions["deleteVote"] = async (pollId, authorId) => {
    const votesToDelete = getMessagesSnapshot().filter(
      (m) =>
        m.type === "vote" &&
        isVoteCustom(m.custom) &&
        m.authorId === authorId
    );
    if (!votesToDelete.length) return;

    setMessages((cur) =>
      cur.filter(
        (m) =>
          !(
            m.type === "vote" &&
            isVoteCustom(m.custom) &&
            m.authorId === authorId
          )
      )
    );

    for (const vote of votesToDelete) {
      await deleteMessage(vote.id);
    }
  };

  return { createPoll, addVote, deleteVote };
}

function PollComposer({
  actions,
  authorId,
  onClose,
}: WidgetComposerProps<PollActions>) {
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState<PollOption[]>([
    { id: "opt-0", label: "" },
    { id: "opt-1", label: "" },
  ]);

  const updateOption = (id: string, label: string) => {
    setOptions((cur) =>
      cur.map((opt) => (opt.id === id ? { ...opt, label } : opt))
    );
  };

  const addOption = () =>
    setOptions((cur) => [
      ...cur,
      { id: `opt-${cur.length}-${Date.now()}`, label: "" },
    ]);

  const send = async () => {
    const trimmedOptions = options
      .map((opt) => ({ ...opt, label: opt.label.trim() }))
      .filter((opt) => opt.label);
    if (!prompt.trim() || trimmedOptions.length < 2) return;
    await actions.createPoll(
      { prompt: prompt.trim(), options: trimmedOptions },
      authorId
    );
    setPrompt("");
    setOptions([
      { id: "opt-0", label: "" },
      { id: "opt-1", label: "" },
    ]);
    onClose();
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <input
        placeholder="Poll question"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      {options.map((opt, idx) => (
        <input
          key={opt.id}
          placeholder={`Option ${idx + 1}`}
          value={opt.label}
          onChange={(e) => updateOption(opt.id, e.target.value)}
        />
      ))}
      <button type="button" onClick={addOption} style={{ marginBottom: 4 }}>
        Add option
      </button>
      <button
        type="button"
        onClick={send}
        disabled={
          !prompt.trim() || options.filter((o) => o.label.trim()).length < 2
        }
      >
        Create Poll
      </button>
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
      Object.fromEntries(personas.map((p) => [p.id, p])) as Record<
        string,
        Persona
      >,
    [personas]
  );

  const options = message.custom.options;
  const votes = allMessages.filter(
    (m): m is Message & { custom: VoteCustom } =>
      m.type === "vote" &&
      isVoteCustom(m.custom) &&
      m.custom.pollId === message.id
  );
  const totalVotes = votes.length;
  const myVote = votes.find((v) => v.authorId === currentActorId);

  const handleVote = async (optionId: string) => {
    if (!actions.addVote || !actions.deleteVote) return;
    if (!myVote) {
      await actions.addVote(message.id, optionId, currentActorId);
      return;
    }
    if (myVote.custom.optionId === optionId) {
      await actions.deleteVote(message.id, currentActorId);
      return;
    }
    await actions.deleteVote(message.id, currentActorId);
    await actions.addVote(message.id, optionId, currentActorId);
  };

  return (
    <div className="poll-card">
      <div className="poll-header">
        <p className="poll-question">{message.custom.prompt}</p>
      </div>
      <div className="poll-options">
        {options.map((option) => {
          const optionVotes = votes.filter(
            (v) => v.custom.optionId === option.id
          );
          const percent = totalVotes
            ? Math.round((optionVotes.length / totalVotes) * 100)
            : 0;
          const checked = myVote?.custom.optionId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              className={`poll-option ${
                checked ? "poll-option--selected" : ""
              }`}
              onClick={() => handleVote(option.id)}
              aria-pressed={checked}
            >
              <div className="poll-option__row">
                <div className="poll-option__title">{option.label}</div>
                <div className="poll-option__meta">
                  <span className="pill pill--ghost">
                    {optionVotes.length} vote
                    {optionVotes.length === 1 ? "" : "s"}
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
      <footer className="poll-footer"></footer>
    </div>
  );
}

const pollWidgetStyles = `
.poll-card {
  background: linear-gradient(180deg, #121831 0%, #0c1224 100%);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 24px;
  padding: 16px;
  box-shadow: 0 18px 46px rgba(2, 6, 20, 0.55);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.poll-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.poll-question {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.poll-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.poll-option {
  width: 100%;
  text-align: left;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.02);
  padding: 12px 14px;
  box-shadow: none;
}

.poll-option--selected {
  border-color: #7aa2ff;
  background: rgba(122, 162, 255, 0.12);
}

.poll-option__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 8px;
}

.poll-option__title {
  font-weight: 600;
}

.poll-option__meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: #9aa9c6;
}

.poll-option__meta .pill {
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
}

.poll-option__progress {
  width: 100%;
  height: 8px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 8px;
}

.poll-option__progress > div {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #7aa2ff, #5af3ff);
  transition: width 200ms ease;
}

.poll-votees {
  display: flex;
  align-items: center;
  gap: 6px;
}

.poll-votees__avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: #050914;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.16);
}

.poll-footer {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 12px;
  font-size: 12px;
  color: #9aa9c6;
  min-height: 14px;
}
`;

if (
  typeof document !== "undefined" &&
  !document.getElementById("poll-widget-styles")
) {
  const style = document.createElement("style");
  style.id = "poll-widget-styles";
  style.textContent = pollWidgetStyles;
  document.head.appendChild(style);
}

export const PollBrokenDeleteVoteFunction: ChatWidgetDefinition<PollActions> = {
  type: "createPoll",
  registryName: "PollBrokenDeleteVoteFunction",
  elements: {
    render: (props) => <PollView {...props} />,
    composer: (props) => <PollComposer {...props} />,
  },
  createActions,
  hideMessage: (message) => message.type === "vote",
};

// Get all vote messages for author
const getVotesForAuthor = (
  messages: Message[],
  pollId: string,
  authorId: string
): Array<Message & { custom: VoteCustom }> =>
  messages.filter(
    (m): m is Message & { custom: VoteCustom } =>
      m.type === "vote" &&
      isVoteCustom(m.custom) &&
      m.custom.pollId === pollId &&
      m.authorId === authorId
  );

// Check if there is a vote on the poll already
// Is basically also checkPostAddVote as the Pre expects false (no vote) and post expects true (a vote)
export const checkPreAddVote = (
  messages: Message[],
  pollId: string,
  authorId: string
): boolean => getVotesForAuthor(messages, pollId, authorId).length === 0;

export const checkPostAddVote = (
  prevMessages: Message[],
  nextMessages: Message[],
  pollId: string,
  authorId: string
): boolean => {
  const prevVotes = getVotesForAuthor(prevMessages, pollId, authorId).length;
  const nextVotes = getVotesForAuthor(nextMessages, pollId, authorId).length;
  return prevVotes === 0 && nextVotes === 1;
};

// Pre there needs to be at least one vote from the author on the poll to delete
export const checkPreDeleteVote = (
  messages: Message[],
  pollId: string,
  authorId: string
): boolean => getVotesForAuthor(messages, pollId, authorId).length > 0;

export const checkPostDeleteVote = (
  prevMessages: Message[],
  nextMessages: Message[],
  pollId: string,
  authorId: string
): boolean => {
  const prevVotes = getVotesForAuthor(prevMessages, pollId, authorId).length;
  const nextVotes = getVotesForAuthor(nextMessages, pollId, authorId).length;
  return prevVotes > 0 && nextVotes === 0;
};
