# nodejs-pro

A production-ready NestJS application with modular architecture, strict TypeScript configuration, and industry-standard tooling.

## Tech Stack

- **Framework:** NestJS 11
- **Language:** TypeScript 5.7 (strict mode)
- **Runtime:** Node.js 24
- **Database:** PostgreSQL 17 + TypeORM 0.3
- **API:** REST + GraphQL (Apollo, code-first)
- **Containers:** Podman / Docker Compose
- **Linting:** ESLint 9 (strictTypeChecked + stylisticTypeChecked)
- **Formatting:** Prettier 3
- **Testing:** Jest 30
- **Git Hooks:** Husky 9

## Project Architecture

```
src/
├── config/                    # Application & database configuration
│   ├── app.config.ts          # Typed config with registerAs namespace
│   ├── database.config.ts     # PostgreSQL connection config
│   ├── env.validation.ts      # Environment validation & defaults
│   └── index.ts
├── migrations/                # TypeORM migrations
│   ├── ...-InitialSchema.ts   # Users, products, orders, order_items tables
│   └── ...-AddOrderIndexes.ts # Performance indexes
├── modules/                   # Feature modules
│   ├── users/                 # User entity & service
│   ├── products/              # Product entity, service, controller, DataLoader
│   │   └── product.loader.ts  # Request-scoped DataLoader for batching
│   └── orders/                # Order creation with transactions + GraphQL
│       ├── dto/               # REST DTOs + GraphQL input/connection types
│       ├── entities/          # Order & OrderItem entities (@Entity + @ObjectType)
│       ├── orders.service.ts  # Transactional order logic + paginated query
│       ├── orders.resolver.ts # GraphQL resolver (thin, delegates to service)
│       ├── order-item.resolver.ts # Resolves product field via DataLoader
│       ├── orders.controller.ts
│       └── orders.module.ts
├── seeds/                     # Database seed scripts
├── data-source.ts             # TypeORM CLI data source
├── app.module.ts              # Root module
└── main.ts                    # Application entry point
```

## Getting Started

### Prerequisites

- Node.js 24+
- npm 10+
- Podman or Docker (for PostgreSQL)

### Installation

```bash
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### Database Setup

```bash
# Start PostgreSQL + pgAdmin containers
npm run db:up

# Run migrations
npm run migration:run

# Seed test data (users + products)
npm run seed
```

Once running:

- **PostgreSQL** is available at `localhost:5432`
- **pgAdmin** (web GUI) is available at [http://localhost:5050](http://localhost:5050)

To connect pgAdmin to the database, add a server with:

| Setting  | Value              |
|----------|--------------------|
| Host     | `postgres`         |
| Port     | `5432`             |
| Database | `nodejs_pro`       |
| Username | `postgres`         |
| Password | `postgres`         |

> **Note:** Use the container hostname `postgres` (not `localhost`) because pgAdmin runs inside the Docker network.

### Running the Application

```bash
# Development (watch mode)
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Endpoints

### REST

| Method | Path            | Description                                        |
|--------|-----------------|----------------------------------------------------|
| POST   | `/orders`       | Create order (transactional, idempotent)           |
| GET    | `/orders`       | List orders (filter: `status`, `dateFrom`, `dateTo`) |
| GET    | `/orders/:id`   | Get order by ID with items                         |
| GET    | `/products`     | List all products                                  |
| GET    | `/products/:id` | Get product by ID                                  |
| GET    | `/`             | Health check                                       |

### GraphQL

**Endpoint:** `/graphql` (Playground enabled in development)

| Query    | Description                                                 |
|----------|-------------------------------------------------------------|
| `orders` | List orders with filters (`status`, `dateFrom`, `dateTo`), pagination (`limit`, `offset`), and nested items + products via DataLoader |

### Example: Create Order

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<user-uuid>",
    "items": [
      { "productId": "<product-uuid>", "quantity": 2 }
    ],
    "idempotencyKey": "unique-key-123"
  }'
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start in watch mode |
| `npm run start:prod` | Start production build |
| `npm run build` | Build the application |
| `npm run lint` | Lint and auto-fix |
| `npm run format` | Format with Prettier |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run db:up` | Start PostgreSQL + pgAdmin containers |
| `npm run db:down` | Stop containers |
| `npm run db:logs` | View PostgreSQL logs |
| `npm run migration:run` | Run pending migrations |
| `npm run migration:revert` | Revert last migration |
| `npm run migration:generate -- src/migrations/Name` | Generate migration from entity changes |
| `npm run seed` | Seed database with test data |

## Configuration

Environment variables are validated on startup. See `.env.example` for all options:

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment (`development`, `production`, `test`) |
| `PORT` | `3000` | Server port |
| `APP_NAME` | `nodejs-pro` | Application name |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |
| `DB_NAME` | `nodejs_pro` | PostgreSQL database name |
| `PGADMIN_PORT` | `5050` | pgAdmin web UI port |
| `PGADMIN_EMAIL` | `admin@local.dev` | pgAdmin login email |
| `PGADMIN_PASSWORD` | `admin` | pgAdmin login password |

## Documentation

- **[Homework 07 — GraphQL for Orders + DataLoader](docs/homework07.md)** — code-first schema, DataLoader batching, N+1 proof, example queries
- **[Homework 05 — Transactions & SQL Optimization](docs/homework05.md)** — transaction implementation, pessimistic locking, idempotency, and EXPLAIN ANALYZE comparison
- **[EXPLAIN Before](docs/explain-before.txt)** — query plans before indexing
- **[EXPLAIN After](docs/explain-after.txt)** — query plans after indexing

## Git Hooks

Husky enforces code quality:

- **Pre-commit:** `npm run format` + `npm run lint`
- **Pre-push:** `npm run test` + `npm run build`

## License

UNLICENSED
