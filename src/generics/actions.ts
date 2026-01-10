import type { ObjectInstance, ObjectSchema } from "./objects";

export type ActionLogEntry = {
    action: string;
    input: Record<string, ObjectInstance[]>;
}
export interface Constraint {
    name: string;
    description: string;
    validate: (previousAction: ActionLogEntry[], nextActions: ActionLogEntry[], data: Record<string, ObjectInstance[]>) => boolean;
}

export type InputDefinition = {
    name: string;
    schema: ObjectSchema;
    minCount?: number;
    maxCount?: number;
}

export interface Action {
    name: string;
    description: string;
    inputDefinition: InputDefinition[];
    execute(input: Record<string, ObjectInstance[]>): Promise<void>;
    preConditions: Constraint[];
    postConditions: Constraint[];
}
