import { Router, Request, Response } from "express";
import { InjectionParams, InjectionResponse } from "../types/api";
import { DatabaseConnector } from "../types/dal";
import { generateData } from "../helpers/generate_data";
import { measureTime } from "../helpers/measure_time";

export function createInjectionRouter(connectors: {
  postgres: DatabaseConnector;
  neo4j: DatabaseConnector;
}): Router {
  const router = Router();

  router.post("/", async (req: Request<object, object, InjectionParams>, res: Response) => {
    try {
      const { database, userCount, productCount, maxFollowers, maxPurchases } = req.body;

      const connector = connectors[database];
      if (!connector) {
        res.status(400).json({ error: `Unknown database: ${database}` });
        return;
      }

      const data = generateData({ userCount, productCount, maxFollowers, maxPurchases });

      await connector.clearData();
      await connector.initSchema();

      const { timeMs: usersTime } = await measureTime(() => connector.insertUsers(data.users));
      const { timeMs: productsTime } = await measureTime(() => connector.insertProducts(data.products));
      const { timeMs: followsTime } = await measureTime(() => connector.insertFollows(data.follows));
      const { timeMs: purchasesTime } = await measureTime(() => connector.insertPurchases(data.purchases));

      const response: InjectionResponse = {
        database,
        timings: {
          users: usersTime,
          products: productsTime,
          follows: followsTime,
          purchases: purchasesTime,
          total: usersTime + productsTime + followsTime + purchasesTime,
        },
        counts: {
          users: data.users.length,
          products: data.products.length,
          follows: data.follows.length,
          purchases: data.purchases.length,
        },
      };

      res.json(response);
    } catch (error) {
      console.error("Injection error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}
