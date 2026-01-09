export type PropertyDefinition = {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "object" | "persona";
  schema?: Record<string, PropertyDefinition>;
  array: boolean;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  defaultValue?: unknown;
};

export type RelationshipDefinition = {
  cardinality: "1:1" | "1:N" | "N:1" | "M:N";
  propertyName: string;
  targetSchema: string;
  optional: boolean;
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
};

export function newObjectInstance(schema: ObjectSchema, id: string, entries: Record<string, unknown>): ObjectInstance {
  const properties: Record<string, unknown> = {};
  const references: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(entries)) {
    const propDef = schema.properties.find((p) => p.name === key);
    if (propDef) {
      properties[key] = value;
    } else {
      references[key] = value as string | string[];
    }
  }

  return {
    id,
    schema,
    properties,
    references
  }
}

export function isObjectInstance(obj: any): obj is ObjectInstance {
  return (
    obj &&  typeof obj === "object" &&
    "id" in obj &&
    "schema" in obj &&
    "properties" in obj &&
    "references" in obj
  );
}

export function isOfSchema(instance: ObjectInstance | null, schemaName: string): boolean {
  return instance !== null && instance.schema.name === schemaName;
}
  
function randomProperty(propDef: PropertyDefinition, personas: string[], rng: () => number): unknown {
  switch (propDef.type) {
    case "string":
      return rng().toString(36).substring(0, 10);
    case "number":
      { 
        const min = propDef.minValue ?? 0;
        const max = propDef.maxValue ?? 100;
        return  Math.floor(rng() * (max - min + 1) + min); 
      }
    case "boolean":
      return rng() < 0.5;
    case "date":
       { 
        const min = propDef.minValue ?? 0;
        const max = propDef.maxValue ?? 10000000000;
        return new Date(Date.now() - Math.floor(rng() * (max - min + 1) + min));
      }
    case "object":
      if (propDef.schema) {
        const obj: Record<string, unknown> = {};
        for (const subPropDef of Object.values(propDef.schema)) {
          obj[subPropDef.name] = randomProperty(subPropDef, personas, rng);
        }
        return obj;
      }
      return {};
    case "persona":
      return personas[Math.floor(rng() * personas.length)];
    default:
      return null;
  }
}

export function randomObjectInstance(schema: ObjectSchema, id: string, references: Record<string, string | string[]>, personas: string[], rng: () => number): ObjectInstance {
  const properties: Record<string, unknown> = {};
  for (const propDef of schema.properties) {
    if (propDef.array) {
      const arrLen = Math.floor(rng() * 5) + 1;
      properties[propDef.name] = Array.from({ length: arrLen }, () => randomProperty(propDef, personas, rng));
    } else {
      properties[propDef.name] = randomProperty(propDef, personas, rng);
    }
  }
  return {
    id,
    schema,
    properties,
    references
  }
}
