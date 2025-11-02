import { useEffect, useMemo, useState } from "react";
import type { Persona, Poll, Vote } from "../db/sqlite";
import {
  getPollById,
  getVotesByPollId,
  upsertVote,
  deleteVote,
} from "../db/sqlite";

export function PollCard({
  pollId,
  currentActorId,
  personas,
}: {
  pollId: string;
  currentActorId: string; // the selected persona acting as the user
  personas: Persona[];
}) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [votes, setVotes] = useState<Vote[]>([]);
  const me = currentActorId;

  useEffect(() => {
    (async () => {
      const p = await getPollById(pollId);
      setPoll(p);
      if (p) setVotes(await getVotesByPollId(p.id));
    })();
  }, [pollId]);

  const myVotes = useMemo(
    () => votes.filter((v) => v.voterId === me).map((v) => v.optionIndex),
    [votes, me]
  );

  const canVote = useMemo(() => {
    if (!poll) return false;
    const allowed = poll.config.eligibility?.allowedPersonaIds;
    return !allowed || allowed.length === 0 || allowed.includes(me);
  }, [poll, me]);

  const showResults = useMemo(() => {
    if (!poll) return false;
    const vis = poll.config.visibility?.resultsVisibleTo || "all";
    if (vis === "all") return true;
    if (vis === "voters") return myVotes.length > 0;
    if (vis === "creatorOnly") return me === poll.creatorId;
    return false;
  }, [poll, myVotes, me]);

  const counts = useMemo(() => {
    if (!poll) return [] as number[];
    const arr = Array(poll.options.length).fill(0) as number[];
    votes.forEach((v) => {
      if (v.optionIndex >= 0 && v.optionIndex < arr.length) arr[v.optionIndex]++;
    });
    return arr;
  }, [votes, poll]);

  if (!poll) return <div className="poll-card">Loading poll…</div>;

  const toggleSelect = async (idx: number) => {
    if (!canVote) return;
    const has = myVotes.includes(idx);
    const multi = poll.config.voting.multiple;
    const canChange = poll.config.voting.allowChangeVote;

    if (!multi) {
      // If already voted at all and cannot change, block
      if (myVotes.length > 0 && !canChange) return;
      if (has && !canChange) return; // cannot change
      if (has && canChange) {
        // unvote
        await deleteVote(poll.id, me, idx);
        setVotes((vs) => vs.filter((v) => !(v.voterId === me && v.optionIndex === idx)));
        return;
      }
      // cast single-choice vote (replaces others)
      await upsertVote(poll, me, idx);
      setVotes((vs) => {
        const filtered = vs.filter((v) => v.voterId !== me);
        return [
          ...filtered,
          { pollId: poll.id, voterId: me, optionIndex: idx, timestamp: new Date().toISOString() },
        ];
      });
      return;
    }

    // multiple choice
    if (has) {
      if (!canChange) return;
      await deleteVote(poll.id, me, idx);
      setVotes((vs) => vs.filter((v) => !(v.voterId === me && v.optionIndex === idx)));
    } else {
      await upsertVote(poll, me, idx);
      setVotes((vs) => [
        ...vs,
        { pollId: poll.id, voterId: me, optionIndex: idx, timestamp: new Date().toISOString() },
      ]);
    }
  };

  const totalVotes = votes.length;
  const actorName = (personas.find((p) => p.id === me)?.name || me);

  return (
    <div className="poll-card">
      <div className="poll-card__header">
        <strong>Poll</strong>
        <small>
          by {personas.find((p) => p.id === poll.creatorId)?.name || poll.creatorId}
        </small>
      </div>
      <h4 className="poll-card__question">{poll.question}</h4>
      <ul className="poll-card__options">
        {poll.options.map((opt, idx) => {
          const selected = myVotes.includes(idx);
          const c = counts[idx] || 0;
          const pct = totalVotes ? Math.round((c / totalVotes) * 100) : 0;
          return (
            <li key={idx} className={`poll-option ${selected ? "poll-option--selected" : ""}`}>
              <button
                type="button"
                className="poll-option__btn"
                onClick={() => toggleSelect(idx)}
                disabled={!canVote}
                aria-pressed={selected}
              >
                {opt}
              </button>
              {showResults && (
                <div className="poll-option__result">
                  <span className="poll-option__count">{c} vote{c === 1 ? "" : "s"}</span>
                  <div className="poll-option__bar">
                    <div className="poll-option__bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="poll-card__footer">
        <small>
          {canVote
            ? `You are voting as ${actorName}. ${
                poll.config.voting.multiple ? "Multiple choices allowed." : "Single choice."
              }`
            : "You are not eligible to vote in this poll."}
        </small>
      </div>
    </div>
  );
}
