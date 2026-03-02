# TP NoSQL - Rapport

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

### Q1 - Produits achetés par le cercle de followers (niveau 1..n)

**PostgreSQL** (CTE récursive, déduplication par `DISTINCT`) :
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

**Neo4j** (traversée variable-length, `WITH DISTINCT`) :
```cypher
MATCH (u:User {id: $userId})-[:FOLLOWS*1..n]->(follower:User)
WITH DISTINCT follower
MATCH (follower)-[:PURCHASED]->(p:Product)
RETURN p.id, p.name, p.price, count(follower) AS count ORDER BY count DESC
```

### Q2 - Produit spécifique par cercle de followers

Même logique que Q1 avec un filtre supplémentaire sur `product_id` / `{id: $productId}`.

### Q3 - Viralité d'un produit à profondeur n

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

## 5. Résultats de performances (10 000 utilisateurs)

Jeu de données initial : **10 000 utilisateurs**, **1 000 produits**, ~100 000 relations follows (max 20/user), ~25 000 achats (max 5/user).

### 5.1 Injection

| Entité | Volumétrie | PostgreSQL | Neo4j |
|--------|-----------|-----------|-------|
| Users | 10 000 | 81 ms | 869 ms |
| Products | 1 000 | 8 ms | 95 ms |
| Follows | 100 030 | 1 310 ms | 3 018 ms |
| Purchases | 25 198 | 355 ms | 646 ms |
| **Total** | | **1 753 ms** | **4 628 ms** |

### 5.2 Requêtes (en ms)

**Q1 - Produits par cercle (userId=1)**

| Profondeur | PostgreSQL | Neo4j |
|-----------|-----------|-------|
| 1 | 239 ms | 294 ms |
| 2 | 18 ms | 107 ms |
| 3 | 33 ms | 102 ms |
| 5 | 73 ms | 127 ms |

**Q2 - Produit spécifique par cercle (userId=1, productId=1)**

| Profondeur | PostgreSQL | Neo4j |
|-----------|-----------|-------|
| 1 | 17 ms | 117 ms |
| 2 | 15 ms | 74 ms |
| 3 | 24 ms | 92 ms |
| 5 | 64 ms | 130 ms |

**Q3 - Viralité d'un produit (productId=1)**

| Profondeur | PostgreSQL | Neo4j |
|-----------|-----------|-------|
| 0 (baseline) | 9 ms | 48 ms |
| 1 | 165 ms | 125 ms |
| 2 | 88 ms | 101 ms |
| 3 | 118 ms | 132 ms |
| 5 | **770 ms** | **365 ms** |

---

## 6. Test de volumétrie (1 000 000 utilisateurs)

Pour valider le passage à l'échelle, un second benchmark a été réalisé avec un jeu de données **100x plus volumineux**.

Jeu de données : **1 000 000 utilisateurs**, **1 000 produits**, **7 494 275 relations follows**, **2 497 403 achats**.

### 6.1 Requêtes (en ms, userId=1, productId=1)

**Q1 - Produits par cercle**

| Profondeur | PostgreSQL | Neo4j | Ratio (PG/Neo4j) |
|-----------|-----------|-------|:---------:|
| 1 | 14,21 ms | 9,33 ms | 1,52x |
| 2 | 1,93 ms | 8,17 ms | 0,24x |
| 3 | 3,10 ms | 15,71 ms | 0,20x |
| 4 | 9,18 ms | 113,43 ms | 0,08x |
| 5 | 56,16 ms | 251,43 ms | 0,22x |

**Q2 - Produit spécifique par cercle**

| Profondeur | PostgreSQL | Neo4j | Ratio (PG/Neo4j) |
|-----------|-----------|-------|:---------:|
| 1 | 1,77 ms | 4,66 ms | 0,38x |
| 2 | 1,94 ms | 6,00 ms | 0,32x |
| 3 | 1,66 ms | 14,10 ms | 0,12x |
| 4 | 6,63 ms | 150,91 ms | 0,04x |
| 5 | 42,83 ms | 240,54 ms | 0,18x |

**Q3 - Viralité d'un produit**

| Profondeur | PostgreSQL | Neo4j | Ratio (PG/Neo4j) |
|-----------|-----------|-------|:---------:|
| 1 | 157 ms | 88,70 ms | 1,77x |
| 2 | 451,58 ms | 590,51 ms | 0,76x |
| 3 | 2 395 ms | 3 071 ms | 0,78x |
| 4 | 12 857 ms | 11 467 ms | 1,12x |
| 5 | **101 424 ms** | **69 053 ms** | **1,47x** |

> **Ratio** : >1 signifie Neo4j plus rapide, <1 signifie PostgreSQL plus rapide.

### 6.2 Observations clés

- **Q1 & Q2** : PostgreSQL domine très nettement à grande échelle. À profondeur 4, le ratio descend à 0,04x–0,08x, soit PostgreSQL **12 à 25 fois plus rapide** que Neo4j. La CTE récursive avec index B-tree s'avère extrêmement efficace sur ces requêtes.
- **Q3 (viralité)** : Le schéma s'inverse à grande profondeur. Neo4j est déjà plus rapide à depth=1 (1,77x), perd légèrement à depth=2–3, puis reprend l'avantage à depth=4 (1,12x) et **depth=5 (1,47x)** — soit 101 secondes pour PostgreSQL contre 69 secondes pour Neo4j.
- **Explosion des temps** : À depth=5 sur Q3, les deux bases passent à des dizaines de secondes (contre <1 seconde sur 10K utilisateurs). Le volume de relations traversées croît exponentiellement.

---

## 7. Analyse et conclusions

### Injection (10K utilisateurs)

PostgreSQL injecte ~2,6x plus vite que Neo4j. L'insertion en masse dans des tables relationnelles (avec `INSERT ... VALUES ...` batchés) est bien optimisée. Neo4j doit créer des noeuds et des relations avec résolution d'identité (`UNWIND + MATCH + CREATE`), ce qui est intrinsèquement plus coûteux pour de l'injection séquentielle.

### Requêtes Q1 et Q2

Sur le jeu de 10K utilisateurs, PostgreSQL est généralement plus rapide. La CTE récursive profite du cache de plan de requête à partir de la profondeur 2.

**À 1M utilisateurs, l'écart se creuse considérablement en faveur de PostgreSQL.** Sur Q1 et Q2, PostgreSQL est jusqu'à **25 fois plus rapide** que Neo4j (ratio 0,04x à profondeur 4 pour Q2). Neo4j souffre de l'explosion du nombre de nœuds à traverser : à profondeur 5, il met ~250 ms là où PostgreSQL répond en ~50 ms. La CTE récursive combinée aux index B-tree de PostgreSQL se montre très efficace pour filtrer et agréger les résultats sur de grands volumes.

### Requête Q3 (viralité)

C'est la requête la plus discriminante entre les deux systèmes :

- **À 10K utilisateurs** : Neo4j est 2x plus rapide à depth=5 (365 ms vs 770 ms).
- **À 1M utilisateurs** : l'avantage de Neo4j se confirme à grande profondeur. À depth=5, Neo4j met **69 secondes** contre **101 secondes** pour PostgreSQL (1,47x plus rapide). Le point de bascule se situe à depth=4 (1,12x).

La requête Q3 est particulièrement gourmande car elle part de **tous les acheteurs** d'un produit (et non d'un seul utilisateur) pour explorer leur cercle de followers. L'explosion combinatoire est donc bien plus marquée. Neo4j gère mieux cette traversée massive grâce à son **index-free adjacency** : chaque nœud stocke un pointeur direct vers ses voisins, évitant les jointures coûteuses que doit réaliser PostgreSQL via sa CTE récursive.

### Synthèse comparative

| Critère | PostgreSQL | Neo4j |
|---------|-----------|-------|
| Injection en masse | Très rapide (~2,6x) | Plus lent |
| Q1/Q2 – profondeur faible (1-3) | Plus rapide | - |
| Q1/Q2 – profondeur élevée (4-5) à 1M | **Jusqu'à 25x plus rapide** | Dégradation |
| Q3 – viralité profonde (depth ≥ 4) | Dégradation exponentielle | **1,5x plus rapide** |
| Passage à l'échelle (10K → 1M) | Stable sur Q1/Q2, fragile sur Q3 | Fragile sur Q1/Q2, résilient sur Q3 |
| Modélisation réseau social | Possible (CTE récursive) | Natif (graphe) |

### Conclusion

Les tests à **1 000 000 d'utilisateurs** confirment et amplifient les tendances observées à petite échelle :

1. **PostgreSQL excelle sur les requêtes ciblées** (Q1, Q2) partant d'un seul utilisateur, même à grande profondeur. Les index relationnels et le planificateur de requêtes optimisent efficacement ces parcours.

2. **Neo4j s'impose sur les traversées massives** (Q3) qui partent d'un ensemble d'acheteurs et explorent leur réseau en profondeur. L'index-free adjacency évite l'explosion combinatoire des jointures.

3. **L'échelle amplifie les écarts** : les temps passent de centaines de millisecondes (10K) à des dizaines de secondes (1M) sur Q3 à depth=5, rendant le choix technologique critique en production.

Une **architecture hybride** reste la solution optimale : PostgreSQL pour les données transactionnelles et les requêtes ciblées, Neo4j pour l'analyse de réseau et la détection de viralité à grande profondeur.
