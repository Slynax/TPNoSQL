import { User, Product, Follow, Purchase } from "./models";

export interface QueryResult {
  products: { id: number; name: string; price: number; count: number }[];
  totalCount: number;
}

export interface ViralCountResult {
  productId: number;
  count: number;
  depth: number;
}

export interface InjectionTimings {
  users: number;
  products: number;
  follows: number;
  purchases: number;
  total: number;
}

export interface DatabaseConnector {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  initSchema(): Promise<void>;
  clearData(): Promise<void>;
  insertUsers(users: User[]): Promise<number>;
  insertProducts(products: Product[]): Promise<number>;
  insertFollows(follows: Follow[]): Promise<number>;
  insertPurchases(purchases: Purchase[]): Promise<number>;
  queryProductsByFollowers(params: {
    userId: number;
    depth: number;
  }): Promise<QueryResult>;
  queryProductByFollowers(params: {
    userId: number;
    productId: number;
    depth: number;
  }): Promise<QueryResult>;
  queryProductViralCount(params: {
    productId: number;
    depth: number;
  }): Promise<ViralCountResult>;
}
