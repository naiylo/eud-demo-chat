declare module "@babel/standalone" {
  export type TransformOptions = {
    filename?: string;
    presets?: Array<string | [string, Record<string, unknown>]>;
    sourceType?: "module" | "script";
  };

  export type TransformResult = {
    code?: string | null;
    map?: unknown;
  };

  export function transform(
    code: string,
    options?: TransformOptions,
  ): TransformResult;
}
