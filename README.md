# TP NoSQL - Comparaison PostgreSQL vs Neo4j

Application web permettant de comparer les performances de PostgreSQL et Neo4j sur un cas de réseau social avec analyse de comportement d'achat.

## Prérequis

- Node.js 18+
- Docker & Docker Compose

## Lancement

### 1. Démarrer les bases de données

```bash
docker compose up -d
```

### 2. Démarrer le backend

```bash
cd backend
npm install
npm run dev
```

Le backend tourne sur `http://localhost:3001`.

### 3. Démarrer le frontend

```bash
cd frontend
npm install
npm run dev
```

Le frontend tourne sur `http://localhost:5173`.

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
