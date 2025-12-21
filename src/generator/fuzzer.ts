import type { DemoScriptContext } from "../components/WidgetPreviewDemo";
import { isAddVoteActionInput, isCreatePollActionInput } from "../exampleWidgets/examplepoll";

export type ConditionInput = {
    previousAction: LogEntry[];
    nextActions: LogEntry[];
    data: Record<string, unknown>;
}

type LogEntry = {
    action: string;
    input: Record<string, unknown>;
}

export function isPreConditionInput(input: ConditionInput): input is ConditionInput {
    return (input as ConditionInput).previousAction !== undefined;
}
export interface Constraint {
    name: string;
    description: string;
    validate: (input: ConditionInput) => boolean;
}

export interface Action {
    name: string;
    description: string;
    execute(input: Record<string, unknown>): Promise<void>;
    preConditions: Constraint[];
    postConditions: Constraint[];
}

type Poll = {
    id: string;
    options: { id: string; label: string }[];
}

const polls: Poll[] = [];

async function createPoll(actions: Action[], creatorId: string): Promise<LogEntry | undefined> {
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

async function createVote(actions: Action[], authorId: string, pollId?: string, optionIndex?: number): Promise<LogEntry | undefined> {
    const action = actions.find(a => a.name === "addVote");
    if (isAddVoteActionInput(action)) {
        const votePoll = pollId ? polls.find(p => p.id === pollId) : polls[Math.floor(Math.random() * polls.length)];
        if (!votePoll)
            return;
        const voteOptionIndex = optionIndex ?? Math.floor(Math.random() * votePoll.options.length);
        return { action: "addVote", input: { authorId, pollId: votePoll.id, optionId: votePoll.options[voteOptionIndex].id }};
    }
}

async function randomLog(personas: string[], actions: Action[], maxLen: number): Promise<LogEntry[]> {
    const len = 3 + Math.floor(Math.random() * Math.min(12, maxLen));
    const stream: LogEntry[] = [];
    for (let i = 0; i < len; i++) {
        let failedPreCondition = true;
        let failedPostCondition = true;
        let result: LogEntry | undefined = undefined;
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
                        data: entry.input
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
                                    data: entry.input
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

export async function generatePollActions(ctx: DemoScriptContext, personas: string[], actions: Action[]): Promise<void> {
    console.log(actions);
    const log: LogEntry[] = await randomLog(personas, actions, 20);
    
    for (const entry of log) {
        const action = actions.find(a => a.name === entry.action);
        if (action) {
            await action.execute(entry.input);
        }
        await ctx.wait(2000);
    }


    console.log("Generated log:", log);
}
