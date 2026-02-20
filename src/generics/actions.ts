/*
    Each widget can define multiple actions, which allow interactivity with the widget's content.
*/

import type { ObjectInstance, ObjectSchema } from "./objects";

export type ActionLogEntry = {
  action: string;
  input: Record<string, ObjectInstance[]>;
};
export interface Constraint {
  name: string;
  description: string;
  validate: (
    previousAction: ActionLogEntry[],
    nextActions: ActionLogEntry[],
    data: Record<string, ObjectInstance[]>,
  ) => boolean;
}

// Description of action input schema
export type ObjectRelation = {
  name: string;
  schema: ObjectSchema;
  minCount?: number;
  maxCount?: number;
  uniqueInstance: boolean;
};

export interface Action {
  name: string;
  description: string;
  inputDefinition: ObjectRelation[];
  execute(input: Record<string, ObjectInstance[]>): Promise<void>;
  preConditions: Constraint[];
  postConditions: Constraint[];
}
