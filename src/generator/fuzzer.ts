import type { Action, ActionLogEntry } from "../generics/actions";
import {
    randomObjectInstance,
    type ObjectInstance,
    type ObjectSchema,
} from "../generics/objects";
import type { DemoScriptContext } from "../widgets/demoDiagnostics";
import { mulberry32 } from "./prng";

const REFERENCE_ID_LENGTH = 16;

let objects: Record<string, ObjectInstance[]> = {};

async function createNextObjectInstance(
    schema: ObjectSchema,
    personas: string[],
    rng: () => number
): Promise<ObjectInstance> {
    const instance = randomObjectInstance(
        schema,
        rng().toString(36).substring(0, REFERENCE_ID_LENGTH),
        personas,
        objects,
        rng
    );

    if (!objects[schema.name]) {
        objects[schema.name] = [];
    }
    objects[schema.name].push(instance);

    return instance;
}

async function generateAction(
    action: Action,
    personas: string[],
    rng: () => number
): Promise<ActionLogEntry> {
    const input: Record<string, ObjectInstance[]> = {};
    for (const def of action.inputDefinition) {
        if (def.uniqueInstance || !objects[def.schema.name] || objects[def.schema.name].length === 0)  {
            const amount = Math.floor(rng() * ((def.maxCount ?? 1) - (def.minCount ?? 0) + 1) + (def.minCount ?? 0));
            input[def.name] = [];
            for (let i = 0; i < amount; i++) {
                input[def.name].push(await createNextObjectInstance(def.schema, personas, rng));
            }
        } else {
            const existingCount = objects[def.schema.name].length;
            const amount = Math.floor(rng() * ((def.maxCount ?? existingCount) - (def.minCount ?? 0) + 1) + (def.minCount ?? 0));
            input[def.name] = [];
            for (let i = 0; i < amount; i++) {
                const objInstance = objects[def.schema.name][Math.floor(rng() * existingCount)];
                input[def.name].push(objInstance);
            }
        }
    }

    return {
        action: action.name,
        input: input,
    };
}

async function randomLog(
    personas: string[],
    actions: Action[],
    maxLen: number,
    rng: () => number
): Promise<ActionLogEntry[]> {
    const len = actions.length + Math.floor(rng() * Math.min(12, maxLen));
    const stream: ActionLogEntry[] = [];

    for (let i = 0; i < len; i++) {
        let failedPreCondition = true;
        let failedPostCondition = true;
        let result: ActionLogEntry | undefined = undefined;
        let attempts = 0;
        while (failedPreCondition || failedPostCondition) {
            const action = actions[(i + attempts) < actions.length ? (i + attempts) : Math.floor(rng() * actions.length)];
            const entry = await generateAction(action, personas, rng);

            failedPreCondition = !action?.preConditions.every(
                constraint => {
                    const result = constraint.validate(stream, [], entry.input);
                    return result;
                }
            );

            if (action?.postConditions.length || 0 > 0) {
                for (let j = 0; j < i; j++) {
                    for (const action of actions) {
                        failedPostCondition = !action?.postConditions.every(
                            constraint =>
                                constraint.validate(
                                    stream.slice(0, j),
                                    [...stream.slice(j), entry],
                                    entry.input
                                )
                            );
                    }
                }
            } else {
                failedPostCondition = false;
            }
            attempts++;
            result = entry;
            //console.log(`Used action ${action.name}, failedPreCondition: ${failedPreCondition}, failedPostCondition: ${failedPostCondition}`);
        }
        if (result) stream.push(result);
    }
    return stream;
}

export function analyzeDependencies(actions: Action[]): Action[] | undefined {
    const dependencies: Record<string, string[]> = {};
    const produces: Record<string, string[]> = {};

    for(const action of actions) {
        dependencies[action.name] = [...new Set(action.inputDefinition.flatMap((ref, _, others) => ref.schema.properties.filter(p => p.type === "reference" && !others.find(o => o.schema.name === p.referenceSchema)).map(p => p.referenceSchema!)))];
        produces[action.name] = action.inputDefinition.map(o => o.schema.name);
    }

    // [["poll", "vote"], ["vote", "option"], []]
    let backlog = actions;
    const result: Action[] = [];

    while (backlog.length > 0) {
        const remaining = [];
        for (const action of backlog) {
            if (dependencies[action.name].every(dep => result.find(a => produces[a.name].includes(dep)))) {
                result.push(action);
            } else {
                remaining.push(action);
            }
        }
        if (backlog.length == remaining.length) {
            console.error("Unable to create dependency graph!");
            return undefined;
        }
        backlog = remaining;
    }

    console.log("Action execution order:", result.map(a => a.name));

    return result;
}


export async function generateRandomFlow(
    ctx: DemoScriptContext,
    personas: string[]
): Promise<void> {
    objects = {};
    const actions = ctx.actions as Action[];
    const rng = mulberry32(Math.floor(Math.random() * 1000000));
    const log: ActionLogEntry[] = await randomLog(personas, actions, 50, rng);

    for (const entry of log) {
        const action = actions.find((a) => a.name === entry.action);
        if (action) {
            await action.execute(entry.input);
        }
        await ctx.wait(1);
    }
}
