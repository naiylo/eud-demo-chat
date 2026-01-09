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

export interface Action {
    name: string;
    description: string;
    inputSchemas: Record<string, ObjectSchema>;
    execute(input: Record<string, ObjectInstance[]>): Promise<void>;
    preConditions: Constraint[];
    postConditions: Constraint[];
}
