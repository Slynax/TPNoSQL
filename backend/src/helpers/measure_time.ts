export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; timeMs: number }> {
  const start = performance.now();
  const result = await fn();
  const timeMs = parseFloat((performance.now() - start).toFixed(2));
  return { result, timeMs };
}
