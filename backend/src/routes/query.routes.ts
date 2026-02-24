import { Router, Request, Response } from "express";
import { QueryParams, QueryResponse } from "../types/api";
import { DatabaseConnector } from "../types/dal";
import { measureTime } from "../helpers/measure_time";

export function createQueryRouter(connectors: {
  postgres: DatabaseConnector;
  neo4j: DatabaseConnector;
}): Router {
  const router = Router();

  router.post("/", async (req: Request<object, object, QueryParams>, res: Response) => {
    try {
      const { database, queryId, userId, productId, depth } = req.body;

      const connector = connectors[database];
      if (!connector) {
        res.status(400).json({ error: `Unknown database: ${database}` });
        return;
      }

      let queryResult: { result: unknown; timeMs: number };

      switch (queryId) {
        case 1:
          if (!userId) {
            res.status(400).json({ error: "userId is required for query 1" });
            return;
          }
          queryResult = await measureTime(() =>
            connector.queryProductsByFollowers({ userId, depth })
          );
          break;

        case 2:
          if (!userId || !productId) {
            res.status(400).json({ error: "userId and productId are required for query 2" });
            return;
          }
          queryResult = await measureTime(() =>
            connector.queryProductByFollowers({ userId, productId, depth })
          );
          break;

        case 3:
          if (!productId) {
            res.status(400).json({ error: "productId is required for query 3" });
            return;
          }
          queryResult = await measureTime(() =>
            connector.queryProductViralCount({ productId, depth })
          );
          break;

        default:
          res.status(400).json({ error: `Unknown queryId: ${queryId}` });
          return;
      }

      const response: QueryResponse = {
        database,
        queryId,
        executionTimeMs: queryResult.timeMs,
        result: queryResult.result,
      };

      res.json(response);
    } catch (error) {
      console.error("Query error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}
