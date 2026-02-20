// Minimal type declarations for sql.js used in this project

declare module "sql.js" {
  export interface QueryExecResult {
    columns: string[];
    values: any[][];
  }

  export interface Statement {
    getAsObject(): Record<string, any>;
    step(): boolean;
    bind(params?: any[] | Record<string, any>): void;
    run(params?: any[] | Record<string, any>): void;
    free(): void;
  }

  export interface Database {
    exec(sql: string): QueryExecResult[];
    prepare(sql: string): Statement;
    export(): Uint8Array;
    close?(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => Database;
  }
}

declare module "sql.js/dist/sql-wasm.js" {
  import type { SqlJsStatic } from "sql.js";

  export interface InitSqlJsConfig {
    locateFile?: (file: string) => string;
  }

  const initSqlJs: (config?: InitSqlJsConfig) => Promise<SqlJsStatic>;
  export default initSqlJs;
}
