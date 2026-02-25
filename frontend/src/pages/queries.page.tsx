import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DbSelector } from "@/components/db-selector";
import { executeQuery } from "@/helpers/api_client";
import type { DatabaseType, QueryResponse } from "@/types/api";
import { Loader2 } from "lucide-react";

const QUERY_DESCRIPTIONS = [
  { id: 1 as const, label: "Produits par cercle de followers", desc: "Liste et nombre de produits commandés par les cercles de followers d'un individu", needsUser: true, needsProduct: false },
  { id: 2 as const, label: "Produit spécifique par cercle", desc: "Même requête mais pour un produit particulier", needsUser: true, needsProduct: true },
  { id: 3 as const, label: "Viralité d'un produit", desc: "Nombre de personnes ayant commandé un produit dans un cercle de followers de niveau n", needsUser: false, needsProduct: true },
];

export function QueriesPage() {
  const [database, setDatabase] = useState<DatabaseType>("postgres");
  const [queryId, setQueryId] = useState<1 | 2 | 3>(1);
  const [userId, setUserId] = useState(1);
  const [productId, setProductId] = useState(1);
  const [depth, setDepth] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedQuery = QUERY_DESCRIPTIONS.find((q) => q.id === queryId)!;

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await executeQuery({
        database,
        queryId,
        userId: selectedQuery.needsUser ? userId : undefined,
        productId: selectedQuery.needsProduct ? productId : undefined,
        depth,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Requêtes d'analyse</h2>
        <p className="text-muted-foreground">Exécutez les 3 requêtes du sujet et visualisez les résultats</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Paramètres</CardTitle>
            <CardDescription>Sélectionnez la requête et ses paramètres</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Base de données</Label>
              <DbSelector value={database} onChange={setDatabase} />
            </div>

            <div className="space-y-2">
              <Label>Requête</Label>
              <div className="flex flex-col gap-2">
                {QUERY_DESCRIPTIONS.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => setQueryId(q.id)}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                      queryId === q.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                    }`}
                  >
                    <div className="font-medium">Q{q.id}: {q.label}</div>
                    <div className="text-xs text-muted-foreground">{q.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {selectedQuery.needsUser && (
                <div className="space-y-2">
                  <Label htmlFor="userId">User ID</Label>
                  <Input id="userId" type="number" min={1} value={userId} onChange={(e) => setUserId(Number(e.target.value))} />
                </div>
              )}
              {selectedQuery.needsProduct && (
                <div className="space-y-2">
                  <Label htmlFor="productId">Product ID</Label>
                  <Input id="productId" type="number" min={1} value={productId} onChange={(e) => setProductId(Number(e.target.value))} />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="depth">Profondeur</Label>
                <Input id="depth" type="number" min={0} max={10} value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
              </div>
            </div>

            <Button onClick={handleExecute} disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Exécution..." : "Exécuter la requête"}
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Résultats</CardTitle>
            {result && (
              <CardDescription>
                <Badge variant={result.database === "postgres" ? "default" : "secondary"}>
                  {result.database === "postgres" ? "PostgreSQL" : "Neo4j"}
                </Badge>
                <span className="ml-2">Temps: {result.executionTimeMs.toFixed(2)} ms</span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!result && !loading && (
              <p className="text-sm text-muted-foreground">Exécutez une requête pour voir les résultats</p>
            )}
            {result && result.result.products && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Total: {result.result.totalCount} achat(s) sur {result.result.products.length} produit(s)
                </p>
                <div className="max-h-96 overflow-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">ID</th>
                        <th className="px-3 py-2 text-left">Produit</th>
                        <th className="px-3 py-2 text-right">Prix</th>
                        <th className="px-3 py-2 text-right">Acheteurs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.result.products.map((p) => (
                        <tr key={p.id} className="border-t">
                          <td className="px-3 py-2">{p.id}</td>
                          <td className="px-3 py-2">{p.name}</td>
                          <td className="px-3 py-2 text-right">{p.price.toFixed(2)} EUR</td>
                          <td className="px-3 py-2 text-right font-mono">{p.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {result && result.result.count !== undefined && (
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold">{result.result.count}</p>
                <p className="text-sm text-muted-foreground">
                  personnes ayant acheté le produit #{result.result.productId} dans le cercle de profondeur {result.result.depth}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
