import type { DemoScriptContext } from "../components/WidgetPreviewDemo";
import { isAddVoteActionInput, isCreatePollActionInput, type AddVoteActionInput,type ConstraintInput, type CreatePollActionInput, type DeleteVoteActionInput, type PollActionInput } from "../exampleWidgets/examplepoll";

export type ConditionInput<I, D> = {
    previousAction: LogEntry<I>[];
    nextActions: LogEntry<I>[];
    data: D;
}

type LogEntry<I> = {
    action: string;
    input: I;
}

export function isPreConditionInput(input: ConditionInput<unknown, unknown>): input is ConditionInput<unknown, unknown> {
    return (input as ConditionInput<unknown, unknown>).previousAction !== undefined;
}
export interface Constraint<I, D> {
    name: string;
    description: string;
    validate: (input: ConditionInput<I, D>) => boolean;
}

export interface Action<I, D> {
    name: string;
    description: string;
    execute(input: I): Promise<void>;
    preConditions: Constraint<I, D>[];
    postConditions: Constraint<I, D>[];
}

type Poll = {
    id: string;
    options: { id: string; label: string }[];
}

const polls: Poll[] = [];

async function createPoll(actions: Action<PollActionInput, ConstraintInput>[], creatorId: string): Promise<LogEntry<PollActionInput> | undefined> {
    const action = actions.find(a => a.name === "createPoll");
    if (isCreatePollActionInput(action)) {
        const options = [];
        const optionCount = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < optionCount; i++) {
            options.push({ id: `opt-${i + 1}`, label: `Option ${i + 1}` });
        }
        const id = `poll-${polls.length + 1}`;
        polls.push({ id, options });
        return { action: "createPoll", input: { authorId: creatorId, poll: { prompt: "Sample?", options }, id }};
    }
}

async function createVote(actions: Action<PollActionInput, ConstraintInput>[], authorId: string, pollId?: string, optionIndex?: number): Promise<LogEntry<PollActionInput> | undefined> {
    const action = actions.find(a => a.name === "addVote");
    if (isAddVoteActionInput(action)) {
        const votePoll = pollId ? polls.find(p => p.id === pollId) : polls[Math.floor(Math.random() * polls.length)];
        if (!votePoll)
            return;
        const voteOptionIndex = optionIndex ?? Math.floor(Math.random() * votePoll.options.length);
        return { action: "addVote", input: { authorId, pollId: votePoll.id, optionId: votePoll.options[voteOptionIndex].id }};
    }
}

async function randomLog(personas: string[], actions: Action<PollActionInput, ConstraintInput>[], maxLen: number): Promise<LogEntry<PollActionInput>[]> {
    const len = 3 + Math.floor(Math.random() * Math.min(12, maxLen));
    const stream: LogEntry<PollActionInput>[] = [];
    for (let i = 0; i < len; i++) {
        let failedPreCondition = true;
        let failedPostCondition = true;
        let result: LogEntry<PollActionInput> | undefined = undefined;
        while (failedPreCondition || failedPostCondition) {
            const who = personas[Math.floor(Math.random() * personas.length)];
            const pick = Math.random();
            const entry = pick < 0.5 ? await createPoll(actions, who) : await createVote(actions, who);
            console.log("Generated entry:", entry);

            if (entry) {
                const action = actions.find((act) => act.name === entry?.action);
                failedPreCondition = !action?.preConditions.every((constraint) =>
                    constraint.validate({
                        previousAction: [...stream, entry], 
                        nextActions: [],
                        data: { 
                            authorId: entry.input.authorId, 
                            pollId: isCreatePollActionInput(entry) ? (entry.input as CreatePollActionInput).id : (entry.input as AddVoteActionInput | DeleteVoteActionInput).pollId 
                        } 
                    }
                ));
                console.log("PreCondition check:", failedPreCondition);
                if (action?.postConditions.length || 0 > 0) {
                    for (let j = 0; j < i; j++) {
                        for (const action of actions) {
                            failedPostCondition = !action?.postConditions.every((constraint) => 
                                constraint.validate({ 
                                    previousAction: stream.slice(0, j), 
                                    nextActions: [...stream.slice(j), entry], 
                                    data: { 
                                        authorId: entry.input.authorId,
                                        pollId: isCreatePollActionInput(entry) ? (entry.input as CreatePollActionInput).id : (entry.input as AddVoteActionInput | DeleteVoteActionInput).pollId 
                                    } 
                                }
                            ));
                        }
                    }
                } else {
                    failedPostCondition = false;
                }
                
                result = entry;
            }
        }
        if (result)
            stream.push(result);
    }
    return stream;
}

export async function generatePollActions(ctx: DemoScriptContext, personas: string[], actions: Action<PollActionInput, ConstraintInput>[]): Promise<void> {
    console.log(actions);
    const log: LogEntry<PollActionInput>[] = await randomLog(personas, actions, 20);
    
    for (const entry of log) {
        const action = actions.find(a => a.name === entry.action);
        if (action) {
            await action.execute(entry.input);
        }
        await ctx.wait(2000);
    }


    console.log("Generated log:", log);
}
