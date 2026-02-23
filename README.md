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
- **Containers:** Docker Compose (multi-stage Dockerfile with prod & distroless targets)
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

- Node.js 24+ (local development without Docker)
- npm 10+
- Docker with Compose v2 (or Podman)

### Environment Setup

```bash
cp .env.example .env
# Edit .env with your values (especially JWT_SECRET in production)
```

For local (non-Docker) development, also create `.env.local` — NestJS loads it first.

---

## Docker Workflow

### Architecture

```
compose.yml            — production-like stack (api + postgres + rustfs)
compose.dev.yml        — dev override (hot reload, bind mount, exposed ports)
Dockerfile             — multi-stage: deps → build → dev | prod | prod-distroless
```

Services and networking:

```
┌─────────────── public network ───────────────┐
│  api :8080                                   │
└──────┬───────────────────────────────────────┘
       │
┌──────┴───────── private network (internal) ──┐
│  api ←→ postgres :5432                       │
│       ←→ rustfs  :9000                       │
│  migrate (one-off)                           │
│  seed    (one-off)                           │
│  pgadmin :5050  (--profile debug)            │
└──────────────────────────────────────────────┘
```

Postgres and RustFS are **not** exposed to the host in prod mode.

### Production-Like Launch

```bash
# Build & start API + Postgres + RustFS
docker compose -f compose.yml up --build

# Run migrations (one-off, exits when done)
docker compose run --rm migrate

# Seed test data (one-off, exits when done)
docker compose run --rm seed
```

API is available at [http://localhost:8080](http://localhost:8080).

### Development Launch (Hot Reload)

```bash
docker compose -f compose.yml -f compose.dev.yml up --build
```

- Code changes are picked up automatically (bind mount + `nest start --watch`)
- Postgres exposed at `localhost:5432`, RustFS at `localhost:9000`/`9001`
- Node inspector at `localhost:9229`
- `node_modules` inside the container is preserved via anonymous volume

### Distroless Launch

```bash
# Build and run with distroless target
docker compose up --build \
  --build-arg DOCKER_BUILDKIT=1 \
  --no-deps api

# Or build the image directly
docker build --target prod-distroless -t nodejs-pro:distroless .
docker run --env-file .env -p 8080:3000 nodejs-pro:distroless
```

### Migrate & Seed

Migrations and seed run as one-off job containers (profile `tools`):

```bash
docker compose run --rm migrate    # runs TypeORM migration:run, then exits
docker compose run --rm seed       # inserts seed data, then exits
```

They connect to postgres over the private network and use the same prod image.

### Optional Tools

```bash
# pgAdmin (database GUI)
docker compose --profile debug up pgadmin
```

### Dockerfile Targets

| Target            | Base Image                                      | Contents                                  |
|-------------------|-------------------------------------------------|-------------------------------------------|
| `deps`            | `node:22-slim`                                  | Production `node_modules` only            |
| `build`           | `node:22-slim`                                  | All deps + compiled `dist/`               |
| `dev`             | `node:22-slim`                                  | All deps + source, `npm run start:dev`    |
| `prod`            | `node:22-slim`                                  | `dist/` + prod `node_modules`, `USER node`|
| `prod-distroless` | `gcr.io/distroless/nodejs22-debian12:nonroot`   | `dist/` + prod `node_modules`, UID 65532  |

### Image Size Comparison

After building all targets, compare sizes:

```bash
docker build --target dev             -t nodejs-pro:dev .
docker build --target prod            -t nodejs-pro:prod .
docker build --target prod-distroless -t nodejs-pro:distroless .

docker image ls --filter "reference=nodejs-pro"
```

Expected output (approximate):

```
REPOSITORY   TAG          SIZE
nodejs-pro   dev          ~500MB
nodejs-pro   prod         ~300MB
nodejs-pro   distroless   ~230MB
```

To inspect layers:

```bash
docker history nodejs-pro:prod
docker history nodejs-pro:distroless
```

**Why prod-distroless is smaller and more secure:**

- No package manager, no shell, no OS utilities — only the Node.js runtime and your code
- Smaller attack surface: if the container is compromised, the attacker has no tools to escalate
- Runs as `nonroot` (UID 65532) by default — no possibility of root access
- Fewer CVEs: minimal base image means fewer packages that can have vulnerabilities

### Non-Root Verification

**prod target** — runs as `node` user (UID 1000):

```bash
docker run --rm nodejs-pro:prod id
# uid=1000(node) gid=1000(node) groups=1000(node)

docker run --rm nodejs-pro:prod whoami
# node
```

**prod-distroless target** — runs as `nonroot` (UID 65532). Distroless has no shell, so `id`/`whoami` won't work. The non-root guarantee comes from:

1. The base image `gcr.io/distroless/nodejs22-debian12:nonroot` sets `USER 65532`
2. The Dockerfile does not override `USER` back to root
3. Verify by inspecting the image config:

```bash
docker inspect nodejs-pro:distroless | grep -A2 '"User"'
# "User": "65532"
```

---

## Local Development (without Docker)

### Installation

```bash
npm install
```

### Database & Storage Setup

```bash
cp .env.example .env.local

# Start only Postgres + RustFS for local dev
npm run db:up

# Run migrations
npm run migration:run

# Seed test data (users with passwords + products)
npm run seed
```

`npm run db:up` uses `compose.dev.yml` overrides, so Postgres and RustFS are published to the host (`localhost:5432`, `localhost:9000`, `localhost:9001`).

### Running the Application

```bash
npm run start:dev    # watch mode
npm run start:prod   # production (requires npm run build first)
```

Once running:

- **PostgreSQL** is available at `localhost:5432`
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
| `npm run start:dev` | Start in watch mode (local) |
| `npm run start:prod` | Start production build (local) |
| `npm run build` | Build the application |
| `npm run lint` | Lint and auto-fix |
| `npm run format` | Format with Prettier |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run db:up` | Start Postgres + RustFS containers (local dev) |
| `npm run db:down` | Stop containers |
| `npm run db:logs` | View PostgreSQL logs |
| `npm run migration:run` | Run pending migrations (local) |
| `npm run migration:revert` | Revert last migration (local) |
| `npm run migration:generate -- src/migrations/Name` | Generate migration from entity changes |
| `npm run seed` | Seed database with test data (local) |
| `npm run docker:dev` | Docker dev mode with hot reload |
| `npm run docker:prod` | Docker prod-like stack |
| `npm run docker:migrate` | Run migrations in Docker |
| `npm run docker:seed` | Seed database in Docker |

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
