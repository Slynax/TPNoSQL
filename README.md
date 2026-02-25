# TP NoSQL - Comparaison PostgreSQL vs Neo4j

> **Rapport du TP : [rapport.md](./rapport.md)**

Application web permettant de comparer les performances de PostgreSQL et Neo4j sur un cas de réseau social avec analyse de comportement d'achat.

## Lancement

```bash
docker compose up -d
```

L'application est accessible sur `http://localhost`.

## Utilisation

1. **Injection** : Configurez la volumétrie (nombre d'utilisateurs, produits, max followers, max achats) et injectez les données dans PostgreSQL, Neo4j, ou les deux.
2. **Requêtes** : Exécutez les 3 requêtes d'analyse sur la base de votre choix avec les paramètres souhaités (userId, productId, profondeur).
3. **Benchmark** : Lancez un benchmark comparatif automatique des 3 requêtes sur les deux bases avec graphiques de performance.

## Architecture

```
backend/src/
├── types/          # Types TypeScript (models, DAL interface, API)
├── dal/            # Data Abstract Layer (PostgresConnector, Neo4jConnector)
├── routes/         # Routes Express (injection, query, benchmark)
└── helpers/        # Utilitaires (génération de données, mesure de temps)

frontend/src/
├── components/     # Composants UI (shadcn) + métier
├── pages/          # Pages (Injection, Requêtes, Benchmark)
├── helpers/        # Client API
└── types/          # Types partagés
```
