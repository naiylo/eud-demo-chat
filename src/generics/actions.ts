import type { ObjectInstance } from "./objects";

export type ActionLogEntry = {
    action: string;
    input: Record<string, unknown>;
}
export interface Constraint {
    name: string;
    description: string;
    validate: (previousAction: ActionLogEntry[], nextActions: ActionLogEntry[], data: Record<string, ObjectInstance[]>) => boolean;
}

export interface Action {
    name: string;
    description: string;
    execute(input: Record<string, ObjectInstance[]>): Promise<void>;
    preConditions: Constraint[];
    postConditions: Constraint[];
}
