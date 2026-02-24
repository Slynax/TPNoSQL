import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DbSelector } from "@/components/db-selector";
import { injectData } from "@/helpers/api_client";
import type { DatabaseType, InjectionResponse } from "@/types/api";
import { Loader2 } from "lucide-react";

export function InjectionPage() {
  const [database, setDatabase] = useState<DatabaseType>("postgres");
  const [both, setBoth] = useState(false);
  const [userCount, setUserCount] = useState(1000);
  const [productCount, setProductCount] = useState(100);
  const [maxFollowers, setMaxFollowers] = useState(10);
  const [maxPurchases, setMaxPurchases] = useState(5);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<InjectionResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleInject = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const targets: DatabaseType[] = both ? ["postgres", "neo4j"] : [database];
      const responses: InjectionResponse[] = [];
      for (const db of targets) {
        const res = await injectData({ database: db, userCount, productCount, maxFollowers, maxPurchases });
        responses.push(res);
      }
      setResults(responses);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Injection de données</h2>
        <p className="text-muted-foreground">Générer et injecter des données aléatoires dans les bases</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Paramètres</CardTitle>
            <CardDescription>Configurez la volumétrie des données à générer</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Base de données cible</Label>
              <DbSelector value={database} onChange={setDatabase} showBoth bothSelected={both} onBothChange={setBoth} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="userCount">Nombre d'utilisateurs</Label>
                <Input id="userCount" type="number" min={1} value={userCount} onChange={(e) => setUserCount(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productCount">Nombre de produits</Label>
                <Input id="productCount" type="number" min={1} value={productCount} onChange={(e) => setProductCount(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxFollowers">Max followers/user</Label>
                <Input id="maxFollowers" type="number" min={0} max={20} value={maxFollowers} onChange={(e) => setMaxFollowers(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPurchases">Max achats/user</Label>
                <Input id="maxPurchases" type="number" min={0} max={5} value={maxPurchases} onChange={(e) => setMaxPurchases(Number(e.target.value))} />
              </div>
            </div>

            <Button onClick={handleInject} disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Injection en cours..." : "Lancer l'injection"}
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Résultats</CardTitle>
            <CardDescription>Temps d'injection et volumes injectés</CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">Lancez une injection pour voir les résultats</p>
            )}
            {results.map((r) => (
              <div key={r.database} className="mb-4 space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <Badge variant={r.database === "postgres" ? "default" : "secondary"}>
                    {r.database === "postgres" ? "PostgreSQL" : "Neo4j"}
                  </Badge>
                  <span className="text-sm font-medium">Temps total: {r.timings.total.toFixed(0)} ms</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between rounded bg-muted px-3 py-1.5">
                    <span>Users ({r.counts.users})</span>
                    <span className="font-mono">{r.timings.users.toFixed(0)} ms</span>
                  </div>
                  <div className="flex justify-between rounded bg-muted px-3 py-1.5">
                    <span>Products ({r.counts.products})</span>
                    <span className="font-mono">{r.timings.products.toFixed(0)} ms</span>
                  </div>
                  <div className="flex justify-between rounded bg-muted px-3 py-1.5">
                    <span>Follows ({r.counts.follows})</span>
                    <span className="font-mono">{r.timings.follows.toFixed(0)} ms</span>
                  </div>
                  <div className="flex justify-between rounded bg-muted px-3 py-1.5">
                    <span>Purchases ({r.counts.purchases})</span>
                    <span className="font-mono">{r.timings.purchases.toFixed(0)} ms</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
