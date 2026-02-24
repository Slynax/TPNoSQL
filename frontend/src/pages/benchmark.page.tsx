import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { runBenchmark } from "@/helpers/api_client";
import type { BenchmarkResult } from "@/types/api";
import { Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const QUERY_LABELS: Record<number, string> = {
  1: "Q1: Produits par followers",
  2: "Q2: Produit spécifique",
  3: "Q3: Viralité produit",
};

export function BenchmarkPage() {
  const [userId, setUserId] = useState(1);
  const [productId, setProductId] = useState(1);
  const [depthsStr, setDepthsStr] = useState("1,2,3");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const depths = depthsStr.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
      if (depths.length === 0) {
        setError("Veuillez saisir au moins une profondeur valide");
        setLoading(false);
        return;
      }
      const res = await runBenchmark({ userId, productId, depths });
      setResults(res.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const groupedByQuery = [1, 2, 3].map((qId) => ({
    queryId: qId,
    label: QUERY_LABELS[qId],
    data: results
      .filter((r) => r.queryId === qId)
      .map((r) => ({
        depth: `Profondeur ${r.depth}`,
        PostgreSQL: r.postgres,
        Neo4j: r.neo4j,
      })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Benchmark comparatif</h2>
        <p className="text-muted-foreground">Comparez les performances PostgreSQL vs Neo4j sur les 3 requêtes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Paramètres du benchmark</CardTitle>
          <CardDescription>Configurez les paramètres puis lancez le benchmark sur les deux bases</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="bmUserId">User ID</Label>
              <Input id="bmUserId" type="number" min={1} className="w-32" value={userId} onChange={(e) => setUserId(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bmProductId">Product ID</Label>
              <Input id="bmProductId" type="number" min={1} className="w-32" value={productId} onChange={(e) => setProductId(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bmDepths">Profondeurs (séparées par des virgules)</Label>
              <Input id="bmDepths" className="w-48" value={depthsStr} onChange={(e) => setDepthsStr(e.target.value)} placeholder="1,2,3" />
            </div>
            <Button onClick={handleRun} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Benchmark en cours..." : "Lancer le benchmark"}
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-3">
          {groupedByQuery.map(({ queryId, label, data }) => (
            <Card key={queryId}>
              <CardHeader>
                <CardTitle className="text-base">{label}</CardTitle>
                <CardDescription>Temps d'exécution en ms</CardDescription>
              </CardHeader>
              <CardContent>
                {data.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="depth" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="PostgreSQL" fill="hsl(221, 83%, 53%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Neo4j" fill="hsl(142, 71%, 45%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Pas de données</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Résultats détaillés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left">Requête</th>
                    <th className="px-4 py-2 text-right">Profondeur</th>
                    <th className="px-4 py-2 text-right">PostgreSQL (ms)</th>
                    <th className="px-4 py-2 text-right">Neo4j (ms)</th>
                    <th className="px-4 py-2 text-right">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const ratio = r.neo4j > 0 ? (r.postgres / r.neo4j).toFixed(2) : "-";
                    return (
                      <tr key={i} className="border-t">
                        <td className="px-4 py-2">{QUERY_LABELS[r.queryId]}</td>
                        <td className="px-4 py-2 text-right">{r.depth}</td>
                        <td className="px-4 py-2 text-right font-mono">{r.postgres.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-mono">{r.neo4j.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-mono">{ratio}x</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
