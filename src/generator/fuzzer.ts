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
): Promise<ObjectInstance | string> {
    const references: Record<string, string | string[]> = {};

    if (schema.relationships.length > 0) {
        const requiredRels = schema.relationships.filter((rel) => !rel.optional);
        for (const rel of requiredRels) {
            const targetObjects = objects[rel.targetSchema];
            if (!targetObjects || targetObjects.length === 0) {
                // Cannot create this object yet, missing required relationships
                return rel.targetSchema;
            }

            references[rel.propertyName] =
                targetObjects[Math.floor(rng() * targetObjects.length)].id;
        }
    }

    const instance = randomObjectInstance(
        schema,
        rng().toString(36).substring(0, REFERENCE_ID_LENGTH),
        references,
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

async function generateDependencies(
    schema: string,
    schemas: ObjectSchema[],
    personas: string[],
    rng: () => number
): Promise<void> {
    let result: ObjectInstance | string = schema;

    if (!objects[schema]) {
        objects[schema] = [];
    }

    while (typeof result === "string") {
        result = await createNextObjectInstance(
            schemas.find((s) => s.name === result)!,
            personas,
            rng
        );
        if (typeof result !== "string") {
            objects[result.schema.name].push(result);
        }
    }
}

async function generateAction(
    action: Action,
    personas: string[],
    schemas: ObjectSchema[],
    rng: () => number
): Promise<ActionLogEntry> {
    const input: Record<string, ObjectInstance[]> = {};
    for (const def of action.inputDefinition) {
        if (def.uniqueInstance || !objects[def.schema.name] || objects[def.schema.name].length === 0)  {
            const amount = Math.floor(rng() * ((def.maxCount ?? 1) - (def.minCount ?? 0) + 1) + (def.minCount ?? 0));
            input[def.name] = [];
            for (let i = 0; i < amount; i++) {
                let objInstance = await createNextObjectInstance(def.schema, personas, rng);
                if (typeof objInstance === "string") {
                    await generateDependencies(objInstance, schemas, personas, rng);
                    objInstance = await createNextObjectInstance(def.schema, personas, rng);
                }
                input[def.name].push(objInstance as ObjectInstance);
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
    schemas: ObjectSchema[],
    actions: Action[],
    maxLen: number,
    rng: () => number
): Promise<ActionLogEntry[]> {
    const len = 10 + Math.floor(rng() * Math.min(12, maxLen));
    const stream: ActionLogEntry[] = [];
    for (let i = 0; i < len; i++) {
        let failedPreCondition = true;
        let failedPostCondition = true;
        let result: ActionLogEntry | undefined = undefined;
        while (failedPreCondition || failedPostCondition) {
            const action = actions[Math.floor(rng() * actions.length)];
            const entry = await generateAction(action, personas, schemas, rng);

            failedPreCondition = !action?.preConditions.every((constraint) => {
                const result = constraint.validate(stream, [], entry.input);
                return result;
            }
                
            );

            if (action?.postConditions.length || 0 > 0) {
                for (let j = 0; j < i; j++) {
                    for (const action of actions) {
                        failedPostCondition = !action?.postConditions.every((constraint) =>
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

            result = entry;
            //console.log(`Used action ${action.name}, failedPreCondition: ${failedPreCondition}, failedPostCondition: ${failedPostCondition}`);
        }
        if (result) stream.push(result);
    }
    return stream;
}

export async function generateRandomFlow(
    ctx: DemoScriptContext,
    personas: string[]
): Promise<void> {
    objects = {};
    const actions = ctx.actions as Action[];
    const addVote = actions.find((a) => a.name === "addVote");
    const deleteVote = actions.find((a) => a.name === "deleteVote");
    for (let i = 0; i < 25; i++) {
        actions.push(addVote!);
        actions.push(deleteVote!);
    }
    const rng = mulberry32(Math.floor(Math.random() * 1000000));
    const log: ActionLogEntry[] = await randomLog(personas, ctx.schemas, actions, 50, rng);

    for (const entry of log) {
        const action = actions.find((a) => a.name === entry.action);
        if (action) {
            await action.execute(entry.input);
        }
        await ctx.wait(1);
    }
}
