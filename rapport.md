# TP NoSQL — Rapport

**Rémy LOURON · Killian PAVY**

---

## 1. Objectif

Modéliser, implémenter et comparer en volumétrie un service d'analyse du comportement d'achat au sein d'un réseau social. Les mêmes données et requêtes sont exécutées sur deux systèmes : **PostgreSQL** (SGBDR) et **Neo4j** (base orientée graphe).

---

## 2. Modèle de données

### 2.1 PostgreSQL (relationnel)

```sql
users        (id PK, name)
products     (id PK, name, price)
follows      (follower_id FK→users, followed_id FK→users)  -- lien orienté
purchases    (user_id FK→users, product_id FK→products)
```

Index ajoutés : `follows(follower_id)`, `follows(followed_id)`, `purchases(user_id)`, `purchases(product_id)`.

### 2.2 Neo4j (graphe)

```
(:User {id, name})
(:Product {id, name, price})
(:User)-[:FOLLOWS]->(:User)      -- lien orienté
(:User)-[:PURCHASED]->(:Product)
```

Contraintes d'unicité sur `User.id` et `Product.id`.

---

## 3. Architecture logicielle

```
frontend (React/Vite, port 80)
    └── nginx proxy /api → backend
backend (Express/Node, port 3001)
    ├── /api/inject   → InjectionRouter
    ├── /api/query    → QueryRouter
    ├── /api/benchmark → BenchmarkRouter
    └── DAL
        ├── PostgresConnector  implements DatabaseConnector
        └── Neo4jConnector     implements DatabaseConnector
```

La couche **DAL** (`DatabaseConnector`) expose une interface identique pour les deux bases. L'IHM sélectionne la base cible ; le reste du code est agnostique au moteur sous-jacent.

Déploiement complet via `docker compose up` : PostgreSQL, Neo4j, backend et frontend dans des conteneurs isolés.

---

## 4. Requêtes implémentées

### Q1 — Produits achetés par le cercle de followers (niveau 1…n)

**PostgreSQL** — CTE récursive, déduplication par `DISTINCT` :
```sql
WITH RECURSIVE follower_circle AS (
  SELECT followed_id AS user_id, 1 AS level FROM follows WHERE follower_id = $1
  UNION
  SELECT f.followed_id, fc.level + 1 FROM follows f
  JOIN follower_circle fc ON f.follower_id = fc.user_id WHERE fc.level < $2
),
distinct_followers AS (SELECT DISTINCT user_id FROM follower_circle)
SELECT p.id, p.name, p.price, COUNT(pu.user_id) AS count
FROM distinct_followers df JOIN purchases pu ON pu.user_id = df.user_id
JOIN products p ON p.id = pu.product_id
GROUP BY p.id, p.name, p.price ORDER BY count DESC
```

**Neo4j** — traversée variable-length, `WITH DISTINCT` :
```cypher
MATCH (u:User {id: $userId})-[:FOLLOWS*1..n]->(follower:User)
WITH DISTINCT follower
MATCH (follower)-[:PURCHASED]->(p:Product)
RETURN p.id, p.name, p.price, count(follower) AS count ORDER BY count DESC
```

### Q2 — Produit spécifique par cercle de followers

Même logique que Q1 avec un filtre supplémentaire sur `product_id` / `{id: $productId}`.

### Q3 — Viralité d'un produit à profondeur n

Compte le nombre d'acheteurs du produit dans le cercle de followers des autres acheteurs. `depth=0` fournit le baseline (total acheteurs sans traversée).

**PostgreSQL** :
```sql
-- depth=0 : SELECT COUNT(*)::int FROM purchases WHERE product_id = $1
-- depth>0 :
WITH RECURSIVE buyers AS (SELECT user_id FROM purchases WHERE product_id = $1),
follower_circle AS (
  SELECT f.followed_id AS user_id, 1 AS level FROM follows f
  WHERE f.follower_id IN (SELECT user_id FROM buyers)
  UNION
  SELECT f.followed_id, fc.level + 1 FROM follows f
  JOIN follower_circle fc ON f.follower_id = fc.user_id WHERE fc.level < $2
),
circle_members AS (SELECT DISTINCT user_id FROM follower_circle)
SELECT COUNT(*)::int FROM circle_members cm
JOIN purchases pu ON pu.user_id = cm.user_id AND pu.product_id = $1
```

**Neo4j** :
```cypher
-- depth=0 : MATCH (b:User)-[:PURCHASED]->(p:Product {id:$id}) RETURN count(b)
-- depth>0 :
MATCH (buyer:User)-[:PURCHASED]->(p:Product {id: $productId})
WITH buyer, p
MATCH (buyer)-[:FOLLOWS*1..n]->(follower:User)
WITH DISTINCT follower, p
MATCH (follower)-[:PURCHASED]->(p)
RETURN count(follower) AS count
```

---

## 5. Résultats de performances

Jeu de données : **10 000 utilisateurs**, **1 000 produits**, ~100 000 relations follows (max 20/user), ~25 000 achats (max 5/user).

### 5.1 Injection

| Entité | Volumétrie | PostgreSQL | Neo4j |
|--------|-----------|-----------|-------|
| Users | 10 000 | 81 ms | 869 ms |
| Products | 1 000 | 8 ms | 95 ms |
| Follows | 100 030 | 1 310 ms | 3 018 ms |
| Purchases | 25 198 | 355 ms | 646 ms |
| **Total** | | **1 753 ms** | **4 628 ms** |

### 5.2 Requêtes (en ms)

**Q1 — Produits par cercle (userId=1)**

| Profondeur | PostgreSQL | Neo4j |
|-----------|-----------|-------|
| 1 | 239 ms | 294 ms |
| 2 | 18 ms | 107 ms |
| 3 | 33 ms | 102 ms |
| 5 | 73 ms | 127 ms |

**Q2 — Produit spécifique par cercle (userId=1, productId=1)**

| Profondeur | PostgreSQL | Neo4j |
|-----------|-----------|-------|
| 1 | 17 ms | 117 ms |
| 2 | 15 ms | 74 ms |
| 3 | 24 ms | 92 ms |
| 5 | 64 ms | 130 ms |

**Q3 — Viralité d'un produit (productId=1)**

| Profondeur | PostgreSQL | Neo4j |
|-----------|-----------|-------|
| 0 (baseline) | 9 ms | 48 ms |
| 1 | 165 ms | 125 ms |
| 2 | 88 ms | 101 ms |
| 3 | 118 ms | 132 ms |
| 5 | **770 ms** | **365 ms** |

---

## 6. Analyse et conclusions

### Injection

PostgreSQL injecte ~2,6× plus vite que Neo4j. L'insertion en masse dans des tables relationnelles (avec `INSERT … VALUES …` batchés) est bien optimisée. Neo4j doit créer des nœuds et des relations avec résolution d'identité (`UNWIND + MATCH + CREATE`), ce qui est intrinsèquement plus coûteux pour de l'injection séquentielle.

### Requêtes Q1 et Q2

PostgreSQL est généralement plus rapide sur ce jeu de données. La CTE récursive profite du cache de plan de requête à partir de la profondeur 2 (le saut de 239 ms → 18 ms entre depth=1 et depth=2 correspond au premier appel à froid). Neo4j reste constant (~100-130 ms) car il recalcule la traversée à chaque requête sans hot cache de résultats.

### Requête Q3 (viralité)

Le résultat le plus intéressant : **à profondeur 5, Neo4j est 2× plus rapide que PostgreSQL** (365 ms vs 770 ms). La récursion profonde sur les relations de suivi est le cas d'usage natif d'une base graphe. La CTE récursive de PostgreSQL peine à gérer l'explosion combinatoire à grande profondeur, tandis que Neo4j traverse les arêtes en mémoire via son index-free adjacency.

### Conclusion

| Critère | PostgreSQL | Neo4j |
|---------|-----------|-------|
| Injection en masse | ✅ Très rapide | ❌ Plus lent |
| Requêtes peu profondes (depth 1-3) | ✅ Plus rapide | — |
| Traversées profondes (depth ≥ 5) | ❌ Dégradation | ✅ Plus efficace |
| Modélisation réseau social | Possible (CTE récursive) | Natif (graphe) |

Pour une application nécessitant des **analyses de type graphe à grande profondeur** (chaînes d'influence, détection de communautés), Neo4j est le choix adapté. Pour des **charges d'écriture importantes ou des requêtes peu profondes**, PostgreSQL reste plus performant. Une architecture hybride — PostgreSQL pour les données transactionnelles, Neo4j pour l'analyse de réseau — représenterait la solution optimale à l'échelle de la production (1 M utilisateurs).
