declare module "sql.js" {
  export interface SqlJsModule {
    Database: new (data?: Uint8Array | ArrayLike<number>) => Database;
  }

  export interface QueryExecResult {
    columns: string[];
    values: Array<Array<string | number | null>>;
  }

  export interface Statement {
    bind(values?: unknown[] | Record<string, unknown>): void;
    step(): boolean;
    getAsObject(): Record<string, unknown>;
    free(): void;
  }

  export interface Database {
    run(sql: string, params?: unknown[] | Record<string, unknown>): void;
    exec(sql: string, params?: unknown[] | Record<string, unknown>): QueryExecResult[];
    prepare(sql: string, params?: unknown[] | Record<string, unknown>): Statement;
    export(): Uint8Array;
  }

  export interface InitSqlJsOptions {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(
    options?: InitSqlJsOptions
  ): Promise<SqlJsModule>;
}

