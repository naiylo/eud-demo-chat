import type { DemoScriptContext } from "../components/WidgetPreviewDemo";
import { isAddVoteActionInput, isCreatePollActionInput, type AddVoteActionInput, type AddVoteActionOutput, type ConstraintInput, type CreatePollActionInput, type CreatePollActionOutput, type DeleteVoteActionInput, type DeleteVoteActionOutput } from "../exampleWidgets/examplepoll";

type Input = CreatePollActionInput | AddVoteActionInput | DeleteVoteActionInput;
type Output = CreatePollActionOutput | AddVoteActionOutput | DeleteVoteActionOutput;

export interface FuzzOptions {
    population?: number;
    generations?: number;
    maxLength?: number;
}

export type ConditionInput<I, O, D> = {
    previousAction: LogEntry<I, O>[];
    nextActions: LogEntry<I, O>[];
    data: D;
}

type LogEntry<I, O> = {
    action: string;
    input: I;
    output: O;
}

export function isPreConditionInput(input: ConditionInput<unknown, unknown, unknown>): input is ConditionInput<unknown, unknown, unknown> {
    return (input as ConditionInput<unknown, unknown, unknown>).previousAction !== undefined;
}
export interface Constraint<I, O, D> {
    name: string;
    description: string;
    validate: (input: ConditionInput<I, O, D>) => boolean;
}

export interface Action<I, O, D> {
    name: string;
    description: string;
    execute(input: I): Promise<O>;
    preConditions: Constraint<I, O, D>[];
    postConditions: Constraint<I, O, D>[];
}

type Poll = {
    id: string;
    options: { id: string; label: string }[];
}

const DEFAULT_OPTIONS: Required<FuzzOptions> = {
    population: 30,
    generations: 30,
    maxLength: 40,
};

const polls: Poll[] = [];

async function createPoll(actions: Action<Input, Output, ConstraintInput>[], creatorId: string): Promise<LogEntry<Input, Output> | undefined> {
    const action = actions.find(a => a.name === "createPoll");
    if (isCreatePollActionInput(action)) {
        const createPoll = action as Action<CreatePollActionInput, CreatePollActionOutput, ConstraintInput>;
        const options = [];
        const optionCount = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < optionCount; i++) {
            options.push({ id: `opt-${i + 1}`, label: `Option ${i + 1}` });
        }
        const id: string = await createPoll.execute({ authorId: creatorId, poll: { prompt: "Sample?", options } });
        polls.push({ id, options });
        return { action: "createPoll", input: { authorId: creatorId, poll: { prompt: "Sample?", options } }, output: id };
    }
}

async function createVote(actions: Action<Input, Output, ConstraintInput>[], authorId: string, pollId?: string, optionIndex?: number): Promise<LogEntry<Input, Output> | undefined> {
    const action = actions.find(a => a.name === "addVote");
    if (isAddVoteActionInput(action)) {
        const addVote = action as Action<AddVoteActionInput, AddVoteActionOutput, ConstraintInput>;
        const votePoll = pollId ? polls.find(p => p.id === pollId) : polls[Math.floor(Math.random() * polls.length)];
        if (!votePoll)
            return;
        const voteOptionIndex = optionIndex ?? Math.floor(Math.random() * votePoll.options.length);
        addVote.execute({ authorId, pollId: votePoll.id, optionId: votePoll.options[voteOptionIndex].id });
        return { action: "addVote", input: { authorId, pollId: votePoll.id, optionId: votePoll.options[voteOptionIndex].id }, output: undefined };
    }
}

async function randomLog(personas: string[], actions: Action<Input, Output, ConstraintInput>[], maxLen: number): Promise<LogEntry<Input, Output>[]> {
    const len = 3 + Math.floor(Math.random() * Math.min(12, maxLen));
    const stream: LogEntry<Input, Output>[] = [];
    for (let i = 0; i < len; i++) {
        let failedPreCondition = true;
        let failedPostCondition = true;
        let result: LogEntry<Input, Output> | undefined = undefined;
        while (failedPreCondition || failedPostCondition) {
            const who = personas[Math.floor(Math.random() * personas.length)];
            const pick = Math.random();
            const entry = pick < 0.5 ? await createPoll(actions, who) : await createVote(actions, who);

            if (entry) {
                const action = actions.find((act) => act.name === entry?.action);
                failedPreCondition = !action?.preConditions.every((constraint) =>
                    constraint.validate({
                        previousAction: [...stream, entry], 
                        nextActions: [], 
                        data: { 
                            authorId: entry.input.authorId, 
                            pollId: isCreatePollActionInput(entry) ? (entry.output as string) : (entry.input as AddVoteActionInput | DeleteVoteActionInput).pollId 
                        } 
                    })) || false;

                for (let j = 0; j < i; j++) {
                    for (const action of actions) {
                        failedPostCondition = !action?.postConditions.every((constraint) => 
                            constraint.validate({ 
                                previousAction: stream.slice(0, j), 
                                nextActions: [...stream.slice(j), entry], 
                                data: { 
                                    authorId: entry.input.authorId,
                                    pollId: isCreatePollActionInput(entry) ? (entry.output as string) : (entry.input as AddVoteActionInput | DeleteVoteActionInput).pollId 
                                } 
                            }));
                    }
                }
                result = entry;
            }
        }
        if (result)
            stream.push(result);
    }
    return stream;
}

export async function generatePollMessageStream(ctx: DemoScriptContext, personas: string[], actions: Action<Input, Output, ConstraintInput>[], options?: FuzzOptions): Promise<void> {
    const opts = { ...DEFAULT_OPTIONS, ...(options ?? {}) } as Required<FuzzOptions>;

    const log: LogEntry<Input, Output>[] = await randomLog(personas, actions, opts.maxLength);
    console.log("Generated log:", log);
}
