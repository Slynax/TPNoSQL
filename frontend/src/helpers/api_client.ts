import type {
  InjectionParams,
  InjectionResponse,
  QueryParams,
  QueryResponse,
  BenchmarkParams,
  BenchmarkResponse,
} from "@/types/api";

const BASE_URL = "/api";

async function post<TReq, TRes>(url: string, body: TReq): Promise<TRes> {
  const response = await fetch(`${BASE_URL}${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Request failed");
  }
  return response.json();
}

export function injectData(params: InjectionParams): Promise<InjectionResponse[]> {
  return post("/inject", params);
}

export function executeQuery(params: QueryParams): Promise<QueryResponse> {
  return post("/query", params);
}

export function runBenchmark(params: BenchmarkParams): Promise<BenchmarkResponse> {
  return post("/benchmark", params);
}

export async function checkHealth(): Promise<Record<string, string>> {
  const response = await fetch(`${BASE_URL}/health`);
  return response.json();
}
