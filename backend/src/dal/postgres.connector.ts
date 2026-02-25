import { Pool } from "pg";
import { DatabaseConnector, QueryResult, ViralCountResult } from "../types/dal";
import { User, Product, Follow, Purchase } from "../types/models";

export class PostgresConnector implements DatabaseConnector {
  private pool: Pool;

  constructor(config: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  }) {
    this.pool = new Pool(config);
  }

  async connect(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
  }

  async initSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10,2) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS follows (
        follower_id INTEGER REFERENCES users(id),
        followed_id INTEGER REFERENCES users(id),
        PRIMARY KEY (follower_id, followed_id)
      );
      CREATE TABLE IF NOT EXISTS purchases (
        user_id INTEGER REFERENCES users(id),
        product_id INTEGER REFERENCES products(id),
        PRIMARY KEY (user_id, product_id)
      );
      CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
      CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);
      CREATE INDEX IF NOT EXISTS idx_purchases_product ON purchases(product_id);
    `);
  }

  async clearData(): Promise<void> {
    await this.pool.query(`
      DROP TABLE IF EXISTS purchases CASCADE;
      DROP TABLE IF EXISTS follows CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
  }

  async insertUsers(users: User[]): Promise<number> {
    if (users.length === 0) return 0;
    const batchSize = 5000;
    for (let i = 0; i < users.length; i += batchSize) {
      const batch = users.slice(i, i + batchSize);
      const values: string[] = [];
      const params: (string | number)[] = [];
      batch.forEach((u, idx) => {
        const offset = idx * 2;
        values.push(`($${offset + 1}, $${offset + 2})`);
        params.push(u.id, u.name);
      });
      await this.pool.query(
        `INSERT INTO users (id, name) VALUES ${values.join(",")} ON CONFLICT DO NOTHING`,
        params
      );
    }
    return users.length;
  }

  async insertProducts(products: Product[]): Promise<number> {
    if (products.length === 0) return 0;
    const batchSize = 5000;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const values: string[] = [];
      const params: (string | number)[] = [];
      batch.forEach((p, idx) => {
        const offset = idx * 3;
        values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        params.push(p.id, p.name, p.price);
      });
      await this.pool.query(
        `INSERT INTO products (id, name, price) VALUES ${values.join(",")} ON CONFLICT DO NOTHING`,
        params
      );
    }
    return products.length;
  }

  async insertFollows(follows: Follow[]): Promise<number> {
    if (follows.length === 0) return 0;
    const batchSize = 5000;
    for (let i = 0; i < follows.length; i += batchSize) {
      const batch = follows.slice(i, i + batchSize);
      const values: string[] = [];
      const params: number[] = [];
      batch.forEach((f, idx) => {
        const offset = idx * 2;
        values.push(`($${offset + 1}, $${offset + 2})`);
        params.push(f.followerId, f.followedId);
      });
      await this.pool.query(
        `INSERT INTO follows (follower_id, followed_id) VALUES ${values.join(",")} ON CONFLICT DO NOTHING`,
        params
      );
    }
    return follows.length;
  }

  async insertPurchases(purchases: Purchase[]): Promise<number> {
    if (purchases.length === 0) return 0;
    const batchSize = 5000;
    for (let i = 0; i < purchases.length; i += batchSize) {
      const batch = purchases.slice(i, i + batchSize);
      const values: string[] = [];
      const params: number[] = [];
      batch.forEach((p, idx) => {
        const offset = idx * 2;
        values.push(`($${offset + 1}, $${offset + 2})`);
        params.push(p.userId, p.productId);
      });
      await this.pool.query(
        `INSERT INTO purchases (user_id, product_id) VALUES ${values.join(",")} ON CONFLICT DO NOTHING`,
        params
      );
    }
    return purchases.length;
  }

  async queryProductsByFollowers(params: {
    userId: number;
    depth: number;
  }): Promise<QueryResult> {
    const { userId, depth } = params;
    const result = await this.pool.query(
      `
      WITH RECURSIVE follower_circle AS (
        SELECT followed_id AS user_id, 1 AS level
        FROM follows
        WHERE follower_id = $1

        UNION

        SELECT f.followed_id, fc.level + 1
        FROM follows f
        INNER JOIN follower_circle fc ON f.follower_id = fc.user_id
        WHERE fc.level < $2
      ),
      distinct_followers AS (
        SELECT DISTINCT user_id FROM follower_circle
      )
      SELECT p.id, p.name, p.price, COUNT(pu.user_id)::int AS count
      FROM distinct_followers df
      JOIN purchases pu ON pu.user_id = df.user_id
      JOIN products p ON p.id = pu.product_id
      GROUP BY p.id, p.name, p.price
      ORDER BY count DESC
      `,
      [userId, depth]
    );

    const products = result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: parseFloat(r.price),
      count: r.count,
    }));

    return {
      products,
      totalCount: products.reduce((sum, p) => sum + p.count, 0),
    };
  }

  async queryProductByFollowers(params: {
    userId: number;
    productId: number;
    depth: number;
  }): Promise<QueryResult> {
    const { userId, productId, depth } = params;
    const result = await this.pool.query(
      `
      WITH RECURSIVE follower_circle AS (
        SELECT followed_id AS user_id, 1 AS level
        FROM follows
        WHERE follower_id = $1

        UNION

        SELECT f.followed_id, fc.level + 1
        FROM follows f
        INNER JOIN follower_circle fc ON f.follower_id = fc.user_id
        WHERE fc.level < $3
      ),
      distinct_followers AS (
        SELECT DISTINCT user_id FROM follower_circle
      )
      SELECT p.id, p.name, p.price, COUNT(pu.user_id)::int AS count
      FROM distinct_followers df
      JOIN purchases pu ON pu.user_id = df.user_id
      JOIN products p ON p.id = pu.product_id
      WHERE p.id = $2
      GROUP BY p.id, p.name, p.price
      `,
      [userId, productId, depth]
    );

    const products = result.rows.map((r) => ({
      id: r.id,
      name: r.name,
      price: parseFloat(r.price),
      count: r.count,
    }));

    return {
      products,
      totalCount: products.reduce((sum, p) => sum + p.count, 0),
    };
  }

  async queryProductViralCount(params: {
    productId: number;
    depth: number;
  }): Promise<ViralCountResult> {
    const { productId, depth } = params;

    // depth=0: baseline, count all buyers with no follower traversal
    if (depth === 0) {
      const result = await this.pool.query(
        `SELECT COUNT(*)::int AS count FROM purchases WHERE product_id = $1`,
        [productId]
      );
      return { productId, count: result.rows[0]?.count ?? 0, depth: 0 };
    }

    const result = await this.pool.query(
      `
      WITH RECURSIVE buyers AS (
        SELECT user_id FROM purchases WHERE product_id = $1
      ),
      follower_circle AS (
        SELECT f.followed_id AS user_id, f.follower_id AS origin, 1 AS level
        FROM follows f
        WHERE f.follower_id IN (SELECT user_id FROM buyers)

        UNION

        SELECT f.followed_id, fc.origin, fc.level + 1
        FROM follows f
        INNER JOIN follower_circle fc ON f.follower_id = fc.user_id
        WHERE fc.level < $2
      ),
      circle_members AS (
        SELECT DISTINCT user_id FROM follower_circle
      )
      SELECT COUNT(*)::int AS count
      FROM circle_members cm
      JOIN purchases pu ON pu.user_id = cm.user_id AND pu.product_id = $1
      `,
      [productId, depth]
    );

    return {
      productId,
      count: result.rows[0]?.count ?? 0,
      depth,
    };
  }
}
