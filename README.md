# nodejs-pro

A production-ready NestJS application with modular architecture, strict TypeScript configuration, and industry-standard tooling.

## Tech Stack

- **Framework:** NestJS 11
- **Language:** TypeScript 5.7 (strict mode)
- **Runtime:** Node.js 24
- **Database:** PostgreSQL 17 + TypeORM 0.3
- **Object Storage:** RustFS (S3-compatible) via AWS SDK v3
- **Authentication:** JWT (access + refresh tokens) with Passport
- **API:** REST + GraphQL (Apollo, code-first)
- **Containers:** Podman / Docker Compose
- **Linting:** ESLint 9 (strictTypeChecked + stylisticTypeChecked)
- **Formatting:** Prettier 3
- **Testing:** Jest 30
- **Git Hooks:** Husky 9

## Project Architecture

```
src/
├── config/                    # Application, database, JWT, S3 configuration
│   ├── app.config.ts          # Typed config with registerAs namespace
│   ├── database.config.ts     # PostgreSQL connection config
│   ├── jwt.config.ts          # JWT secret, expiry settings
│   ├── s3.config.ts           # S3/RustFS bucket, endpoint, credentials
│   ├── env.validation.ts      # Environment validation & defaults
│   └── index.ts
├── migrations/                # TypeORM migrations
│   ├── ...-InitialSchema.ts   # Users, products, orders, order_items tables
│   ├── ...-AddOrderIndexes.ts # Performance indexes
│   └── ...-AddAuthAndFiles.ts # Auth fields, file_records table, domain FKs
├── modules/
│   ├── auth/                  # JWT authentication & authorization
│   │   ├── strategies/        # jwt.strategy.ts, jwt-refresh.strategy.ts
│   │   ├── guards/            # JwtAuthGuard (global), RolesGuard
│   │   ├── decorators/        # @CurrentUser, @Public, @Roles
│   │   ├── dto/               # register, login, refresh DTOs
│   │   ├── auth.service.ts    # Register, login, refresh, token generation
│   │   └── auth.controller.ts # POST /auth/register, /login, /refresh
│   ├── storage/               # S3/RustFS abstraction layer
│   │   └── s3-storage.service.ts  # Presigned URLs, headObject, file URLs
│   ├── files/                 # File upload management
│   │   ├── entities/          # FileRecord entity
│   │   ├── enums/             # FileStatus, FileVisibility, EntityType
│   │   ├── dto/               # Presign/complete request/response DTOs
│   │   ├── files.service.ts   # Presign, complete, ownership validation
│   │   └── files.controller.ts # POST /files/presign, /complete, GET /:id
│   ├── users/                 # User entity & service
│   ├── products/              # Product entity, service, controller, DataLoader
│   └── orders/                # Order creation with transactions + GraphQL
├── seeds/                     # Database seed scripts
├── data-source.ts             # TypeORM CLI data source
├── app.module.ts              # Root module
└── main.ts                    # Application entry point
```

## Getting Started

### Prerequisites

- Node.js 24+
- npm 10+
- Podman or Docker (for PostgreSQL + RustFS)

### Installation

```bash
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### Database & Storage Setup

```bash
# Start PostgreSQL + pgAdmin + RustFS containers
npm run db:up

# Run migrations
npm run migration:run

# Seed test data (users with passwords + products)
npm run seed
```

Once running:

- **PostgreSQL** is available at `localhost:5432`
- **pgAdmin** (web GUI) is available at [http://localhost:5050](http://localhost:5050)
- **RustFS** (S3-compatible storage) API at `localhost:9000`, console at [http://localhost:9001](http://localhost:9001)

Seed users all have password `password123`. The first user (alice@example.com) has the `admin` role.

## API Endpoints

### Authentication

| Method | Path             | Auth     | Description                    |
|--------|------------------|----------|--------------------------------|
| POST   | `/auth/register` | Public   | Register new user              |
| POST   | `/auth/login`    | Public   | Login, returns JWT tokens      |
| POST   | `/auth/refresh`  | Refresh  | Refresh access token           |

### File Upload (Presigned URL Flow)

| Method | Path              | Auth     | Description                          |
|--------|-------------------|----------|--------------------------------------|
| POST   | `/files/presign`  | JWT      | Get presigned S3 upload URL          |
| POST   | `/files/complete` | JWT      | Confirm upload, transition to ready  |
| GET    | `/files/:id`      | JWT      | Get file metadata + URL              |

### REST

| Method | Path            | Auth     | Description                                        |
|--------|-----------------|----------|----------------------------------------------------|
| POST   | `/orders`       | JWT      | Create order (transactional, idempotent)           |
| GET    | `/orders`       | JWT      | List orders (filter: `status`, `dateFrom`, `dateTo`) |
| GET    | `/orders/:id`   | JWT      | Get order by ID with items                         |
| GET    | `/products`     | Public   | List all products                                  |
| GET    | `/products/:id` | Public   | Get product by ID                                  |
| GET    | `/health`       | Public   | Health check                                       |

### GraphQL

**Endpoint:** `/graphql` (Playground enabled in development)

| Query    | Description                                                 |
|----------|-------------------------------------------------------------|
| `orders` | List orders with filters, pagination, nested items + products via DataLoader |

## File Upload Flow

### Presign → Upload → Complete

```
1. Client → POST /files/presign
   Body: { entityType: "user", entityId: "<userId>", contentType: "image/jpeg" }
   Auth: Bearer <accessToken>

   Response: { fileId, key, uploadUrl, contentType }

2. Client → PUT <uploadUrl> (direct to S3/RustFS)
   Headers: Content-Type: image/jpeg
   Body: <binary file data>

3. Client → POST /files/complete
   Body: { fileId: "<fileId>" }
   Auth: Bearer <accessToken>

   Response: { fileId, url, status: "ready" }
```

### Domain Integration

Files are integrated into three domains:

- **Users** — avatar upload (`entityType: "user"`, key: `users/{userId}/avatars/{uuid}.jpg`)
- **Products** — product image (`entityType: "product"`, key: `products/{productId}/images/{uuid}.png`)
- **Orders** — invoice/receipt (`entityType: "order"`, key: `orders/{orderId}/invoices/{uuid}.jpg`)

### Access Control

- **Key generation:** Backend-only. Client provides only `contentType` and `entityType/entityId`.
- **Ownership validation on presign:**
  - `user` entities: only own profile (or admin)
  - `product` entities: admin only
  - `order` entities: only own orders (or admin)
- **Ownership validation on complete:** Only file owner or admin can complete.
- **File URL delivery:** CloudFront URL if configured, otherwise direct RustFS/S3 endpoint.
- **Bucket security:** RustFS configured with credentials, not publicly accessible.

### File URL Delivery

URLs are formed using:
- `CLOUDFRONT_BASE_URL/{key}` if the env var is set
- `S3_ENDPOINT/{bucket}/{key}` as dev fallback (direct RustFS access)

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
| `npm run db:up` | Start PostgreSQL + pgAdmin + RustFS containers |
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
| `NODE_ENV` | `development` | Environment |
| `PORT` | `3000` | Server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USERNAME` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | `postgres` | PostgreSQL password |
| `DB_NAME` | `nodejs_pro` | PostgreSQL database name |
| `JWT_SECRET` | *required* | JWT signing secret |
| `JWT_EXPIRES_IN` | `15m` | Access token expiry |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiry |
| `AWS_REGION` | `us-east-1` | S3 region |
| `AWS_ACCESS_KEY_ID` | *required* | S3/RustFS access key |
| `AWS_SECRET_ACCESS_KEY` | *required* | S3/RustFS secret key |
| `S3_BUCKET_NAME` | `nodejs-pro-files` | S3 bucket name |
| `S3_ENDPOINT` | `http://localhost:9000` | S3/RustFS endpoint |
| `S3_FORCE_PATH_STYLE` | `true` | Path-style addressing (required for RustFS/MinIO) |
| `CLOUDFRONT_BASE_URL` | *empty* | CloudFront distribution URL for file delivery |

## E2E Tests

The project includes comprehensive e2e tests covering all new functionality:

| Test file | Coverage |
|-----------|----------|
| `test/auth.e2e-spec.ts` | Register, login, refresh, protected routes, roles |
| `test/files.e2e-spec.ts` | Full presign→upload→complete lifecycle, domain integration |
| `test/files-security.e2e-spec.ts` | Key generation, ownership, prefix isolation, status lifecycle |
| `test/orders.e2e-spec.ts` | Order creation, idempotency, stock validation, concurrency |
| `test/orders-graphql.e2e-spec.ts` | GraphQL queries, pagination, filtering |

Tests require PostgreSQL and RustFS running (`npm run db:up`).

## Documentation

- **[Homework 07 — GraphQL for Orders + DataLoader](docs/homework07.md)** — code-first schema, DataLoader batching, N+1 proof, example queries
- **[Homework 05 — Transactions & SQL Optimization](docs/homework05.md)** — transaction implementation, pessimistic locking, idempotency, and EXPLAIN ANALYZE comparison

## Git Hooks

Husky enforces code quality:

- **Pre-commit:** `npm run format` + `npm run lint`
- **Pre-push:** `npm run test` + `npm run build`

## License

UNLICENSED
