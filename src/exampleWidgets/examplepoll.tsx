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
  ) => Promise<void>;
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
    const msg: Message = {
      id: `poll-${Date.now()}`,
      authorId,
      text: poll.prompt.trim(),
      timestamp: new Date().toISOString(),
      type: "createPoll",
      custom: poll,
    };
    await addMessage(msg);
    setMessages((cur) => [...cur, msg]);
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
        m.custom.pollId === pollId &&
        m.authorId === authorId
    );
    if (!votesToDelete.length) return;

    setMessages((cur) =>
      cur.filter(
        (m) =>
          !(
            m.type === "vote" &&
            isVoteCustom(m.custom) &&
            m.custom.pollId === pollId &&
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

export const examplepoll: ChatWidgetDefinition<PollActions> = {
  type: "createPoll",
  registryName: "examplepoll",
  elements: {
    render: (props) => <PollView {...props} />,
    composer: (props) => <PollComposer {...props} />,
  },
  createActions,
  hideMessage: (message) => message.type === "vote",
};
