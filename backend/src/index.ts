import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PostgresConnector } from "./dal/postgres.connector";
import { Neo4jConnector } from "./dal/neo4j.connector";
import { createInjectionRouter } from "./routes/injection.routes";
import { createQueryRouter } from "./routes/query.routes";
import { createBenchmarkRouter } from "./routes/benchmark.routes";

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json());

const postgresConnector = new PostgresConnector({
  host: process.env.POSTGRES_HOST || "localhost",
  port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
  user: process.env.POSTGRES_USER || "tpnosql",
  password: process.env.POSTGRES_PASSWORD || "tpnosql",
  database: process.env.POSTGRES_DB || "tpnosql",
});

const neo4jConnector = new Neo4jConnector({
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  user: process.env.NEO4J_USER || "neo4j",
  password: process.env.NEO4J_PASSWORD || "tpnosql123",
});

const connectors = { postgres: postgresConnector, neo4j: neo4jConnector };

app.use("/api/inject", createInjectionRouter(connectors));
app.use("/api/query", createQueryRouter(connectors));
app.use("/api/benchmark", createBenchmarkRouter(connectors));

app.get("/api/health", async (_req, res) => {
  const status: Record<string, string> = {};
  try {
    await postgresConnector.connect();
    status.postgres = "connected";
  } catch {
    status.postgres = "disconnected";
  }
  try {
    await neo4jConnector.connect();
    status.neo4j = "connected";
  } catch {
    status.neo4j = "disconnected";
  }
  res.json(status);
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
