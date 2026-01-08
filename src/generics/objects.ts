export type RelationshipCardinality = "1:1" | "1:N" | "N:1" | "N:M";

export type PropertyDefinition = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "array" | "object";
  required?: boolean;
  defaultValue?: unknown;
  description?: string;
};

export type RelationshipDefinition = {
  cardinality: RelationshipCardinality;
  foreignKeyProperty: string;
  isBidirectional?: boolean;
  inverseProperty?: string;
  description?: string;
};

export type ObjectInstance = {
  id: string;
  schema: ObjectSchema;
  properties: Record<string, unknown>;
  references: Record<string, string | string[]>;
};

export type ObjectSchema = {
  name: string;
  properties: PropertyDefinition[];
  relationships: RelationshipDefinition[];
  description?: string;
};
