/*
  Widgets operate on data types (`ObjectSchema`) and their instances (`ObjectInstance`) as a high-level abstraction of pure messages. This module defines these types and provides utility functions to create and manipulate them. The `ObjectInstance` type represents a specific instance of an `ObjectSchema`, with properties defined according to the schema.
*/

import { getLoremIpsumSnippet } from "../generator/text";

export type PropertyDefinition = {
  name: string;
  type:
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "object"
    | "persona"
    | "id"
    | "reference";
  schema?: Record<string, PropertyDefinition>;
  array: boolean;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
  defaultValue?: unknown;
  // Linked to property of another object referenced in the input, specified as "objectRelationName.propertyName". The value of this property will be used to determine the value of the current property, allowing for dynamic dependencies between properties.
  linkedTo?: string;
  referenceSchema?: string;
};

export type ObjectInstance = {
  id: string;
  schema: ObjectSchema;
  properties: Record<string, unknown>;
};

export type ObjectSchema = {
  name: string;
  properties: PropertyDefinition[];
};

export function newObjectInstance(
  schema: ObjectSchema,
  id: string,
  entries: Record<string, unknown>,
): ObjectInstance {
  const properties: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(entries)) {
    if (schema.properties.some((prop) => prop.name === key)) {
      properties[key] = value;
    } else {
      console.warn(`Property ${key} is not defined in schema ${schema.name}`);
    }
  }

  return {
    id,
    schema,
    properties,
  };
}

export function isObjectInstance(obj: any): obj is ObjectInstance {
  return (
    obj &&
    typeof obj === "object" &&
    "id" in obj &&
    "schema" in obj &&
    "properties" in obj
  );
}

export function isOfSchema(
  instance: ObjectInstance | null,
  schemaName: string,
): boolean {
  return instance !== null && instance.schema.name === schemaName;
}

function randomProperty(
  propDef: PropertyDefinition,
  personas: string[],
  currentState: Record<string, ObjectInstance[]>,
  rng: () => number,
): unknown {
  switch (propDef.type) {
    case "string":
      return getLoremIpsumSnippet(
        Math.floor(
          rng() * ((propDef.maxLength ?? 10) - (propDef.minLength ?? 1) + 1) +
            (propDef.minLength ?? 1),
        ),
      );
    case "number": {
      const min = propDef.minValue ?? 0;
      const max = propDef.maxValue ?? 100;
      return Math.floor(rng() * (max - min + 1) + min);
    }
    case "boolean":
      return rng() < 0.5;
    case "date": {
      const min = propDef.minValue ?? 0;
      const max = propDef.maxValue ?? 10000000000;
      return new Date(Date.now() - Math.floor(rng() * (max - min + 1) + min));
    }
    case "object":
      if (propDef.schema) {
        const obj: Record<string, unknown> = {};
        for (const subPropDef of Object.values(propDef.schema)) {
          obj[subPropDef.name] = randomProperty(
            subPropDef,
            personas,
            currentState,
            rng,
          );
        }
        return obj;
      }
      return {};
    case "persona":
      return personas[Math.floor(rng() * personas.length)];
    case "id":
      return rng().toString(36).substring(2, 10);
    case "reference":
      if (propDef.referenceSchema) {
        const targetObjects = currentState[propDef.referenceSchema];
        if (targetObjects && targetObjects.length > 0) {
          return targetObjects[Math.floor(rng() * targetObjects.length)].id;
        } else {
          console.warn(
            `No target objects available for reference to schema ${propDef.referenceSchema}`,
          );
          return null;
        }
      }
      return null;
    default:
      return null;
  }
}

export function randomObjectInstance(
  schema: ObjectSchema,
  id: string,
  personas: string[],
  currentState: Record<string, ObjectInstance[]>,
  rng: () => number,
): ObjectInstance {
  const properties: Record<string, unknown> = {};
  for (const propDef of schema.properties) {
    // Handling linked properties is quite complex..
    if (propDef.linkedTo) {
      const layers = propDef.linkedTo.split(".");

      let linkedReference: unknown | undefined = undefined;
      let currentProperties: Record<string, unknown> = properties;
      let currentSchema: ObjectSchema | undefined = schema;

      while (layers.length > 1) {
        const linkedProperty = layers.shift()!;
        linkedReference = currentProperties[linkedProperty];

        const nextSchemaName: string | undefined =
          currentSchema!.properties.find(
            (prop) => prop.name === linkedProperty && prop.type === "reference",
          )?.referenceSchema;
        const reference: ObjectInstance | undefined = currentState[
          nextSchemaName!
        ]?.find((obj) => obj.id === linkedReference);

        currentProperties = reference?.properties as Record<string, unknown>;
        currentSchema = reference?.schema;
      }

      const finalLayer = layers.shift()!;
      if (linkedReference) {
        const propValue = currentProperties[finalLayer];
        const minLength = propDef.minLength ?? 1;
        const maxLength =
          propDef.maxLength ??
          (propValue instanceof Array ? propValue!.length : minLength);

        let randomLength = Math.max(
          minLength,
          Math.floor(rng() * (maxLength - minLength + 1) + minLength),
        );

        const finalReferences: string[] = [];
        while (randomLength > 0) {
          finalReferences.push(
            propValue instanceof Array
              ? propValue[Math.floor(rng() * propValue.length)].id
              : (propValue as { id: string }).id,
          );
          randomLength--;
        }
        properties[propDef.name] = propDef.array
          ? finalReferences
          : finalReferences![0];
      }
    } else if (propDef.array) {
      const arrLen = Math.floor(
        rng() * ((propDef.maxLength ?? 10) - (propDef.minLength ?? 0) + 1) +
          (propDef.minLength ?? 0),
      );
      properties[propDef.name] = Array.from({ length: arrLen }, () =>
        randomProperty(propDef, personas, currentState, rng),
      );
    } else {
      properties[propDef.name] = randomProperty(
        propDef,
        personas,
        currentState,
        rng,
      );
    }
  }
  return {
    id,
    schema,
    properties: properties,
  };
}

export function collectReferencesFromProperty(
  propDef: PropertyDefinition,
  value: unknown,
  out: Set<string>,
) {
  if (value == null) return;

  if (propDef.type === "reference") {
    if (propDef.array && Array.isArray(value)) {
      value.forEach((entry) => {
        if (typeof entry === "string") out.add(entry);
      });
      return;
    }

    if (typeof value === "string") out.add(value);
    return;
  }
  if (propDef.type === "object" && propDef.schema) {
    if (propDef.array && Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry && typeof entry === "object") {
          Object.values(propDef.schema!).forEach((subProp) =>
            collectReferencesFromProperty(
              subProp,
              (entry as Record<string, unknown>)[subProp.name],
              out,
            ),
          );
        }
      });
      return;
    }
    if (value && typeof value === "object") {
      Object.values(propDef.schema).forEach((subProp) =>
        collectReferencesFromProperty(
          subProp,
          (value as Record<string, unknown>)[subProp.name],
          out,
        ),
      );
    }
  }
}

export function collectReferencesFromInstance(instance: ObjectInstance) {
  const refs = new Set<string>();
  instance.schema.properties.forEach((propDef) => {
    collectReferencesFromProperty(
      propDef,
      instance.properties[propDef.name],
      refs,
    );
  });
  return refs;
}
