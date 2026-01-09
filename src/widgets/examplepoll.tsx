import { useMemo, useState } from "react";
import type { Message, Persona } from "../db/sqlite";
import type {
  ChatWidgetDefinition,
  WidgetActionDeps,
  WidgetComposerProps,
  WidgetRenderProps,
} from "../widgets/types";
import type { Action } from "../generics/actions";
import { isOfSchema, newObjectInstance, type ObjectInstance, type ObjectSchema } from "../generics/objects";

type PollOption = { id: string; label: string };

// export interface PollCustom {
//   prompt: string;
//   options: PollOption[];
// }

// export interface VoteCustom {
//   pollId: string;
//   optionId: string;
// }

// const isPollCustom = (custom: unknown): custom is PollCustom =>
//   !!custom &&
//   typeof (custom as PollCustom).prompt === "string" &&
//   Array.isArray((custom as PollCustom).options);

// const isVoteCustom = (custom: unknown): custom is VoteCustom =>
//   !!custom &&
//   typeof (custom as VoteCustom).pollId === "string" &&
//   typeof (custom as VoteCustom).optionId === "string";

// type PollActions = {
//   createPoll: (
//     poll: Pick<PollCustom, "prompt" | "options">,
//     authorId: string
//   ) => Promise<void>;
//   addVote: (
//     pollId: string,
//     optionId: string,
//     authorId: string
//   ) => Promise<void>;
//   deleteVote: (pollId: string, authorId: string) => Promise<void>;
// };

const pollSchema: ObjectSchema = {
  name: "poll",
  properties: [
    { name: "prompt", type: "string", array: false },
    { 
      name: "options", 
      type: "object", 
      array: true, 
      schema: {
        id: { name: "id", type: "string", array: false },
        label: { name: "label", type: "string", array: false },
      } 
    },
  ],
  relationships: [
    {
      cardinality: "N:1",
      propertyName: "authorId",
      targetSchema: "author",
      optional: false,
    }
  ],
};

const voteSchema: ObjectSchema = {
  name: "vote",
  properties: [
    { name: "optionId", type: "string", array: false },
  ],
  relationships: [
    {
      cardinality: "N:1",
      propertyName: "pollId",
      targetSchema: "poll",
      optional: false,
    },
    {
      cardinality: "N:1",
      propertyName: "authorId",
      targetSchema: "author",
      optional: false,
    }
  ],
};

const authorSchema: ObjectSchema = {
  name: "author",
  properties: [
    { name: "name", type: "persona", array: false },
  ],
  relationships: [],
};


function createActions({
  addMessage,
  deleteMessage,
  setMessages,
  getMessagesSnapshot,
}: WidgetActionDeps): Action[] {
  const createPoll: Action = {
      name: "createPoll",
      description: "Create a new poll with options",
      preConditions: [],
      postConditions: [],
      inputSchemas: {
        poll: pollSchema,
        author: authorSchema
      },
      execute: async (input: Record<string, ObjectInstance[]>) => {
        if (!input.poll || !input.author) 
          return;

        const poll = input.poll[0];
        const author = input.author[0];

        if (poll.properties["prompt"] && Array.isArray(poll.properties["options"])) {
          const prompt = poll.properties["prompt"] as string;
          const options = poll.properties["options"] as PollOption[];
          if (!prompt.trim() || options.length < 2) 
            return;
          const msg: Message = {
            id: poll.id,
            authorId: author.id,
            text: prompt.trim(),
            timestamp: new Date().toISOString(),
            type: "createPoll",
            custom: poll,
          };
          await addMessage(msg);
          setMessages((cur) => [...cur, msg]);
        }
      }
    };
  
    const addVote: Action = {
      name: "addVote",
      description: "Add a vote to a poll",
      preConditions: [],
      postConditions: [],
      inputSchemas: {
        vote: voteSchema,
      },
      execute: async (input: Record<string, ObjectInstance[]>) => {
        const vote = input["vote"]?.[0];
        const alreadyVoted = getMessagesSnapshot().some(
        (m) =>
          m.type === "vote" &&
          m.custom &&
          isOfSchema(m.custom, "vote") &&
          m.custom.references["pollId"] === vote.references["pollId"] &&
          m.authorId === vote.references["authorId"]
        );
        if (alreadyVoted) return;
  
        const voteMsg: Message = {
          id: `vote-${Date.now()}`,
          authorId: vote.references["authorId"] as string,
          text: "",
          timestamp: new Date().toISOString(),
          type: "vote",
          custom: vote,
        };
        setMessages((cur) => [...cur, voteMsg]);
        await addMessage(voteMsg);
      }
    };
  
    const deleteVote: Action = {
      name: "deleteVote",
      description: "Delete a vote from a poll",
      preConditions: [],
      postConditions: [],
      inputSchemas: {
        vote: voteSchema,
      },
      execute: async (input: Record<string, ObjectInstance[]>) => {
        const vote = input["vote"]?.[0];
        const votesToDelete = getMessagesSnapshot().filter(
          (m) =>
            m.type === "vote" &&
            m.custom &&
            isOfSchema(m.custom, "vote") &&
            m.custom.references["pollId"] === vote.references["pollId"] &&
            m.authorId === vote.references["authorId"]
        );
        if (!votesToDelete.length) return;
  
        setMessages((cur) =>
          cur.filter(
            (m) =>
              !(
                m.type === "vote" &&
                m.custom &&
                isOfSchema(m.custom, "vote") &&
                m.custom.references["pollId"] === vote.references["pollId"] &&
                m.authorId === vote.references["authorId"]
              )
          )
        );
  
        for (const vote of votesToDelete) {
          await deleteMessage(vote.id);
        }
      }
    };

  return [createPoll, addVote, deleteVote];
}

function PollComposer({
  actions,
  author,
  onClose,
}: WidgetComposerProps<Action[]>) {
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
    const poll = actions.find((a) => a.name === "createPoll");
    if (!poll) return;
    await poll.execute({ 
      poll: [newObjectInstance(pollSchema, `poll-${Date.now()}`, { prompt: prompt.trim(), options: trimmedOptions })],
      author: [newObjectInstance(authorSchema, author.id, { name: author.name })]
    });
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
}: WidgetRenderProps<Action[]>) {
  if (!message.custom || !isOfSchema(message.custom, "poll")) {
    return <p>{JSON.stringify(message.custom)}</p>;
  }

  const personaLookup = useMemo(
    () =>
      Object.fromEntries(personas.map((p) => [p.id, p])) as Record<
        string,
        Persona
      >,
    [personas]
  );

  const poll = message.custom as ObjectInstance;

  const options = poll.properties["options"] as PollOption[];
  const votes = allMessages.filter(
    (m): m is Message & { custom: ObjectInstance } =>
      m.type === "vote" &&
      isOfSchema(m.custom, "vote") &&
      m.custom?.references["pollId"] === message.id
  );
  const totalVotes = votes.length;
  const myVote = votes.find((v) => v.authorId === currentActorId);

  const handleVote = async (optionId: string) => {
    const addVoteAction = actions.find((a) => a.name === "addVote");
    const deleteVoteAction = actions.find((a) => a.name === "deleteVote");
    if (!addVoteAction || !deleteVoteAction) return;
    if (!myVote) {
      await addVoteAction.execute({
        vote: [newObjectInstance(voteSchema, `vote-${Date.now()}`, {
          optionId,
          pollId: message.id,
          authorId: currentActorId,
        })],
      });
      return;
    }
    if (myVote.custom.properties["optionId"] === optionId) {
      await deleteVoteAction.execute({
        vote: [myVote.custom],
      } );
      return;
    }
    await deleteVoteAction.execute({
      vote: [myVote.custom],
    });
    await addVoteAction.execute({
      vote: [newObjectInstance(voteSchema, `vote-${Date.now()}`, {
        optionId,
        pollId: message.id,
        authorId: currentActorId,
      })],
    });
  };

  return (
    <div className="poll-card">
      <div className="poll-header">
        <p className="poll-question">{message.custom.properties["prompt"] as string}</p>
      </div>
      <div className="poll-options">
        {options.map((option) => {
          const optionVotes = votes.filter(
            (v) => v.custom.properties["optionId"] === option.id
          );
          const percent = totalVotes
            ? Math.round((optionVotes.length / totalVotes) * 100)
            : 0;
          const checked = myVote?.custom.properties["optionId"] === option.id;
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

export const examplepoll: ChatWidgetDefinition<Action[]> = {
  type: "createPoll",
  registryName: "examplepoll",
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
): Array<Message & { custom: ObjectInstance }> =>
  messages.filter(
    (m): m is Message & { custom: ObjectInstance } =>
      m.type === "vote" &&
        isOfSchema(m.custom, "vote") &&
        m.custom?.references["pollId"] === pollId &&
        m.custom?.references["authorId"] === authorId
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
