export type DatabaseType = "postgres" | "neo4j";
export type InjectionDatabase = DatabaseType | "both";

export interface InjectionParams {
  database: InjectionDatabase;
  userCount: number;
  productCount: number;
  maxFollowers: number;
  maxPurchases: number;
}

export interface InjectionResponse {
  database: DatabaseType;
  timings: {
    users: number;
    products: number;
    follows: number;
    purchases: number;
    total: number;
  };
  counts: {
    users: number;
    products: number;
    follows: number;
    purchases: number;
  };
}

export interface QueryParams {
  database: DatabaseType;
  queryId: 1 | 2 | 3;
  userId?: number;
  productId?: number;
  depth: number;
}

export interface QueryResponse {
  database: DatabaseType;
  queryId: number;
  executionTimeMs: number;
  result: unknown;
}

export interface BenchmarkParams {
  userId: number;
  productId: number;
  depths: number[];
}

export interface BenchmarkResult {
  queryId: number;
  depth: number;
  postgres: number;
  neo4j: number;
}

export interface BenchmarkResponse {
  results: BenchmarkResult[];
}
