import { Router, Request, Response } from "express";
import { BenchmarkParams, BenchmarkResponse, BenchmarkResult } from "../types/api";
import { DatabaseConnector } from "../types/dal";
import { measureTime } from "../helpers/measure_time";

export function createBenchmarkRouter(connectors: {
  postgres: DatabaseConnector;
  neo4j: DatabaseConnector;
}): Router {
  const router = Router();

  router.post("/", async (req: Request<object, object, BenchmarkParams>, res: Response) => {
    try {
      const { userId, productId, depths } = req.body;
      const results: BenchmarkResult[] = [];

      for (const depth of depths) {
        for (const queryId of [1, 2, 3] as const) {
          let pgTime = 0;
          let neoTime = 0;

          if (queryId === 1) {
            const pg = await measureTime(() =>
              connectors.postgres.queryProductsByFollowers({ userId, depth })
            );
            const neo = await measureTime(() =>
              connectors.neo4j.queryProductsByFollowers({ userId, depth })
            );
            pgTime = pg.timeMs;
            neoTime = neo.timeMs;
          } else if (queryId === 2) {
            const pg = await measureTime(() =>
              connectors.postgres.queryProductByFollowers({ userId, productId, depth })
            );
            const neo = await measureTime(() =>
              connectors.neo4j.queryProductByFollowers({ userId, productId, depth })
            );
            pgTime = pg.timeMs;
            neoTime = neo.timeMs;
          } else {
            const pg = await measureTime(() =>
              connectors.postgres.queryProductViralCount({ productId, depth })
            );
            const neo = await measureTime(() =>
              connectors.neo4j.queryProductViralCount({ productId, depth })
            );
            pgTime = pg.timeMs;
            neoTime = neo.timeMs;
          }

          results.push({ queryId, depth, postgres: pgTime, neo4j: neoTime });
        }
      }

      const response: BenchmarkResponse = { results };
      res.json(response);
    } catch (error) {
      console.error("Benchmark error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}
