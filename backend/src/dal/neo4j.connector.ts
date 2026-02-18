import neo4j, { Driver, Integer, Session } from "neo4j-driver";
import { DatabaseConnector, QueryResult, ViralCountResult } from "../types/dal";
import { User, Product, Follow, Purchase } from "../types/models";

function toNumber(value: unknown): number {
  if (neo4j.isInt(value as Integer)) return (value as Integer).toNumber();
  return Number(value);
}

export class Neo4jConnector implements DatabaseConnector {
  private driver: Driver;
  private uri: string;
  private user: string;
  private password: string;

  constructor(config: { uri: string; user: string; password: string }) {
    this.uri = config.uri;
    this.user = config.user;
    this.password = config.password;
    this.driver = neo4j.driver(this.uri, neo4j.auth.basic(this.user, this.password));
  }

  private getSession(): Session {
    return this.driver.session();
  }

  async connect(): Promise<void> {
    await this.driver.verifyConnectivity();
  }

  async disconnect(): Promise<void> {
    await this.driver.close();
  }

  async initSchema(): Promise<void> {
    const session = this.getSession();
    try {
      await session.run("CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE");
      await session.run("CREATE CONSTRAINT product_id IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE");
      await session.run("CREATE INDEX user_name_idx IF NOT EXISTS FOR (u:User) ON (u.name)");
    } finally {
      await session.close();
    }
  }

  async clearData(): Promise<void> {
    const session = this.getSession();
    try {
      await session.run("MATCH (n) DETACH DELETE n");
    } finally {
      await session.close();
    }
  }

  async insertUsers(users: User[]): Promise<number> {
    if (users.length === 0) return 0;
    const session = this.getSession();
    try {
      const batchSize = 5000;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        await session.run(
          "UNWIND $batch AS row CREATE (u:User {id: row.id, name: row.name})",
          { batch }
        );
      }
      return users.length;
    } finally {
      await session.close();
    }
  }

  async insertProducts(products: Product[]): Promise<number> {
    if (products.length === 0) return 0;
    const session = this.getSession();
    try {
      const batchSize = 5000;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        await session.run(
          "UNWIND $batch AS row CREATE (p:Product {id: row.id, name: row.name, price: row.price})",
          { batch }
        );
      }
      return products.length;
    } finally {
      await session.close();
    }
  }

  async insertFollows(follows: Follow[]): Promise<number> {
    if (follows.length === 0) return 0;
    const session = this.getSession();
    try {
      const batchSize = 5000;
      for (let i = 0; i < follows.length; i += batchSize) {
        const batch = follows.slice(i, i + batchSize);
        await session.run(
          `UNWIND $batch AS row
           MATCH (a:User {id: row.followerId})
           MATCH (b:User {id: row.followedId})
           CREATE (a)-[:FOLLOWS]->(b)`,
          { batch }
        );
      }
      return follows.length;
    } finally {
      await session.close();
    }
  }

  async insertPurchases(purchases: Purchase[]): Promise<number> {
    if (purchases.length === 0) return 0;
    const session = this.getSession();
    try {
      const batchSize = 5000;
      for (let i = 0; i < purchases.length; i += batchSize) {
        const batch = purchases.slice(i, i + batchSize);
        await session.run(
          `UNWIND $batch AS row
           MATCH (u:User {id: row.userId})
           MATCH (p:Product {id: row.productId})
           CREATE (u)-[:PURCHASED]->(p)`,
          { batch }
        );
      }
      return purchases.length;
    } finally {
      await session.close();
    }
  }

  async queryProductsByFollowers(params: {
    userId: number;
    depth: number;
  }): Promise<QueryResult> {
    const session = this.getSession();
    try {
      const depth = Math.max(1, Math.floor(params.depth));
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:FOLLOWS*1..${depth}]->(follower:User)
         WITH DISTINCT follower
         MATCH (follower)-[:PURCHASED]->(p:Product)
         RETURN p.id AS id, p.name AS name, p.price AS price, count(follower) AS count
         ORDER BY count DESC`,
        { userId: neo4j.int(params.userId) }
      );

      const products = result.records.map((r) => ({
        id: toNumber(r.get("id")),
        name: r.get("name") as string,
        price: toNumber(r.get("price")),
        count: toNumber(r.get("count")),
      }));

      return {
        products,
        totalCount: products.reduce((sum, p) => sum + p.count, 0),
      };
    } finally {
      await session.close();
    }
  }

  async queryProductByFollowers(params: {
    userId: number;
    productId: number;
    depth: number;
  }): Promise<QueryResult> {
    const session = this.getSession();
    try {
      const depth = Math.max(1, Math.floor(params.depth));
      const result = await session.run(
        `MATCH (u:User {id: $userId})-[:FOLLOWS*1..${depth}]->(follower:User)
         WITH DISTINCT follower
         MATCH (follower)-[:PURCHASED]->(p:Product {id: $productId})
         RETURN p.id AS id, p.name AS name, p.price AS price, count(follower) AS count`,
        {
          userId: neo4j.int(params.userId),
          productId: neo4j.int(params.productId),
        }
      );

      const products = result.records.map((r) => ({
        id: toNumber(r.get("id")),
        name: r.get("name") as string,
        price: toNumber(r.get("price")),
        count: toNumber(r.get("count")),
      }));

      return {
        products,
        totalCount: products.reduce((sum, p) => sum + p.count, 0),
      };
    } finally {
      await session.close();
    }
  }

  async queryProductViralCount(params: {
    productId: number;
    depth: number;
  }): Promise<ViralCountResult> {
    const session = this.getSession();
    try {
      const depth = Math.max(1, Math.floor(params.depth));
      const result = await session.run(
        `MATCH (buyer:User)-[:PURCHASED]->(p:Product {id: $productId})
         WITH buyer, p
         MATCH (buyer)-[:FOLLOWS*1..${depth}]->(follower:User)
         WITH DISTINCT follower, p
         MATCH (follower)-[:PURCHASED]->(p)
         RETURN count(follower) AS count`,
        { productId: neo4j.int(params.productId) }
      );

      return {
        productId: params.productId,
        count: result.records[0] ? toNumber(result.records[0].get("count")) : 0,
        depth: params.depth,
      };
    } finally {
      await session.close();
    }
  }
}
