# Homework 05 — Transactions & SQL Optimization

## Table of Contents

1. [Overview](#overview)
2. [Transaction Implementation](#transaction-implementation)
3. [Concurrency Control — Pessimistic Locking](#concurrency-control--pessimistic-locking)
4. [Idempotency](#idempotency)
5. [SQL Optimization](#sql-optimization)
6. [E2E Testing](#e2e-testing)
7. [How to Run](#how-to-run)

---

## Overview

This assignment implements a transactional **order creation** flow with:

- **Atomic writes** — no partial data on failure (QueryRunner + try/catch/finally)
- **Pessimistic locking** — prevents overselling under concurrent requests
- **Idempotency** — duplicate POST requests return the same order
- **SQL optimization** — indexes added based on `EXPLAIN ANALYZE` evidence

### Entity Relationship

```
User 1──* Order 1──* OrderItem *──1 Product
```

| Entity    | Key columns                                           |
|-----------|-------------------------------------------------------|
| User      | id, email, name, createdAt                            |
| Product   | id, name, price, stock, version, createdAt, updatedAt |
| Order     | id, userId, totalPrice, status, idempotencyKey, createdAt |
| OrderItem | id, orderId, productId, quantity, price                |

---

## Transaction Implementation

**File:** `src/modules/orders/orders.service.ts` — `createOrder()`

The entire order creation runs inside a single PostgreSQL transaction managed by TypeORM's `QueryRunner`:

```
queryRunner = dataSource.createQueryRunner()
queryRunner.connect()
queryRunner.startTransaction()
try {
  1. Check idempotencyKey → return existing if found
  2. Validate user exists
  3. Lock product rows (FOR NO KEY UPDATE)
  4. Validate stock for each product
  5. Deduct stock (product.stock -= quantity)
  6. Save updated products
  7. Create Order + OrderItem records (cascade)
  8. commitTransaction()
} catch {
  rollbackTransaction()   ← guarantees no partial writes
  throw error
} finally {
  queryRunner.release()   ← always returns connection to pool
}
```

### Why QueryRunner instead of `@Transaction` decorator?

- **Explicit control** — we need pessimistic locks and conditional idempotency logic within the same transaction
- **Error granularity** — different exceptions (404, 409, 500) based on the failure point
- **Testability** — easier to reason about in e2e tests

### Guarantees

| Scenario                         | Behavior                                |
|----------------------------------|-----------------------------------------|
| Product stock < requested        | 409 Conflict, full rollback             |
| User or product not found        | 404 Not Found, full rollback            |
| Duplicate idempotencyKey         | 200 OK, returns existing order          |
| DB connection lost mid-tx        | Automatic rollback by PostgreSQL        |
| Unhandled error in catch block   | `finally` still releases QueryRunner    |

---

## Concurrency Control — Pessimistic Locking

### Lock type: `FOR NO KEY UPDATE`

```typescript
// src/modules/orders/orders.service.ts, line 97-102
const products = await queryRunner.manager
  .createQueryBuilder(Product, 'product')
  .setLock('pessimistic_write_or_fail')
  .where('product.id IN (:...ids)', { ids: productIds })
  .orderBy('product.id', 'ASC')   // ← deadlock prevention
  .getMany();
```

### Why `FOR NO KEY UPDATE` (not `FOR UPDATE`)?

| Lock mode          | Blocks                                      | Use case                        |
|--------------------|---------------------------------------------|---------------------------------|
| `FOR UPDATE`       | Other `SELECT FOR UPDATE/SHARE` + any write | Strongest; blocks FK checks too |
| `FOR NO KEY UPDATE`| Other `FOR UPDATE/NO KEY UPDATE` + non-key writes | Allows concurrent FK reads |
| `FOR SHARE`        | Only blocks writes                          | Read-heavy scenarios            |

We chose `FOR NO KEY UPDATE` because:

1. **We only modify `stock`** — a non-key column. We do not change the product's primary key.
2. **Foreign key reads are not blocked** — other transactions can still create `order_items` pointing to the same product (the FK constraint check uses `FOR KEY SHARE`, which is compatible with `FOR NO KEY UPDATE`).
3. **Sufficient protection** — two concurrent `createOrder()` calls for the same product will serialize on the stock deduction, preventing overselling.

### Deadlock prevention

Product rows are locked in **sorted order** (`ORDER BY product.id ASC`). If two concurrent transactions lock products `[A, B]` and `[B, A]` respectively, without sorting they could deadlock. By always acquiring locks in ascending ID order, we guarantee a consistent lock ordering.

### `pessimistic_write_or_fail`

TypeORM maps this to `FOR NO KEY UPDATE NOWAIT`. If the lock cannot be acquired immediately (another transaction holds it), PostgreSQL throws an error instead of waiting. This prevents long lock waits under high contention — the caller gets a fast 500 and can retry.

---

## Idempotency

### Mechanism

The `Order` entity has a `UNIQUE` constraint on `idempotencyKey`:

```typescript
// src/modules/orders/entities/order.entity.ts
@Column({ type: 'varchar', length: 255, unique: true })
public idempotencyKey!: string;
```

### Flow

1. Client sends `POST /orders` with a unique `idempotencyKey` in the body
2. Inside the transaction, before any mutations, we check:
   ```typescript
   const existingOrder = await queryRunner.manager.findOne(Order, {
     where: { idempotencyKey: dto.idempotencyKey },
     relations: ['items'],
   });
   if (existingOrder) {
     await queryRunner.commitTransaction();
     return existingOrder;  // ← no new writes
   }
   ```
3. If found, the existing order is returned with all its items — no stock deduction, no new records
4. If not found, the transaction proceeds to create a new order

### Why check inside the transaction?

The idempotency check runs within the same `startTransaction()` scope. This means:

- **No race condition** between the check and the insert — the UNIQUE constraint on `idempotencyKey` is the final safety net, but the check-first approach avoids unnecessary lock acquisition and stock operations
- If two concurrent requests with the same key both pass the check (unlikely but possible under extreme concurrency), the UNIQUE constraint will cause one to fail with a DB-level duplicate key error, which triggers a rollback

---

## SQL Optimization

### Hot queries identified

1. **List orders by status + date range** — the main dashboard/admin query:
   ```sql
   SELECT o.*, oi.*, p.name
   FROM orders o
   JOIN order_items oi ON oi."orderId" = o.id
   JOIN products p ON p.id = oi."productId"
   WHERE o.status = 'confirmed'
     AND o."createdAt" BETWEEN '2025-01-01' AND '2026-12-31'
   ORDER BY o."createdAt" DESC
   ```

2. **List orders by userId** — user profile / "my orders" page:
   ```sql
   SELECT o.*, oi.*
   FROM orders o
   JOIN order_items oi ON oi."orderId" = o.id
   WHERE o."userId" = :userId
   ORDER BY o."createdAt" DESC
   ```

3. **Single order by ID with items** — order detail page (uses `findById`)

### Indexes added

Migration: `src/migrations/1770549096000-AddOrderIndexes.ts`

| Index                          | Columns                         | Purpose                              |
|--------------------------------|---------------------------------|--------------------------------------|
| `IDX_orders_status_createdAt`  | `(status, createdAt DESC)`      | Composite for WHERE + ORDER BY       |
| `IDX_order_items_orderId`      | `(orderId)`                     | JOIN order_items ON orderId          |
| `IDX_orders_userId`            | `(userId)`                      | WHERE userId = :id filter            |

### EXPLAIN ANALYZE — Before vs. After

Full output: [`docs/explain-before.txt`](explain-before.txt) and [`docs/explain-after.txt`](explain-after.txt)

#### Query 1: status + date range filter

| Metric               | Before (no indexes)                | After (with indexes)                         |
|----------------------|------------------------------------|----------------------------------------------|
| Orders scan strategy | **Seq Scan** (all rows)            | **Bitmap Index Scan** on `IDX_orders_status_createdAt` |
| Rows removed by filter | 334 of 500 (67%)               | 0 — index directly locates matching rows     |
| Index buffers        | N/A                                | 61 shared_buffers for index lookup           |

**Planner choice explained:** With ~22% selectivity (11,413 of 50,500 rows), PostgreSQL chose **Bitmap Index Scan + Bitmap Heap Scan**. This is the optimal strategy for medium selectivity — it builds a bitmap of matching pages from the index, then fetches them in physical order to minimize random I/O. For narrower filters (~1.2% selectivity), the cost drops from 385 to 24.

#### Query 2: userId filter

| Metric               | Before (no indexes)                | After (with indexes)                         |
|----------------------|------------------------------------|----------------------------------------------|
| Orders scan strategy | **Seq Scan** (all 500 rows)        | **Index Scan** on `IDX_orders_userId`        |
| Buffers (orders)     | 9                                  | 10 (on 100x more data!)                     |
| Rows removed by filter | 500 (100%)                      | 0 — index directly locates user's rows       |

**Planner choice explained:** With ~1% selectivity (500 of 50,500), PostgreSQL chose a direct **Index Scan** — the most efficient strategy for high selectivity. The buffer count stays at 10 even with 100x more data, demonstrating O(log n) scaling.

#### Query 3: single order + items JOIN

| Metric               | Result                                                     |
|----------------------|------------------------------------------------------------|
| Strategy             | **Nested Loop** + **Index Scan** on `IDX_order_items_orderId` |
| Execution time       | **0.087 ms**                                               |
| Buffers              | 8 total (3 for order_items index)                          |

**Note on Hash Join for order_items:** In queries returning many orders (Q1, Q2), the planner correctly prefers Hash Join + Seq Scan on order_items over Nested Loop + Index Scan. This is because scanning 65k rows sequentially is faster than performing thousands of individual index lookups. The `IDX_order_items_orderId` index shines in single-order lookups (Q3) where the Nested Loop strategy is selected.

---

## E2E Testing

**File:** `test/orders.e2e-spec.ts`

The test suite:

1. **Creates a dedicated test database** (`nodejs_pro_test`) — isolated from development data
2. **Uses `synchronize: true, dropSchema: true`** — fresh schema on every run
3. **Seeds test data** — user + products with known stock levels

### Test scenarios covered

| Scenario                            | Expected                                  |
|-------------------------------------|-------------------------------------------|
| Create order with valid data        | 201, order with items returned            |
| Product stock is deducted           | DB reflects reduced stock                 |
| Idempotency (same key twice)        | Both return same order ID, stock deducted once |
| Insufficient stock                  | 409 Conflict with descriptive message     |
| Non-existent user                   | 404 Not Found                             |
| Non-existent product                | 404 Not Found                             |
| Empty items array                   | 400 Bad Request (ValidationPipe)          |
| Missing required fields             | 400 Bad Request (ValidationPipe)          |
| Concurrent orders on same product   | At most one succeeds per available stock  |

### Running tests

```bash
# Ensure DB container is running
npm run db:up

# Run e2e tests
npx jest -- orders.e2e-spec
```

---

## How to Run

### Prerequisites

- Node.js 20+
- Podman or Docker (for PostgreSQL container)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env.local

# 3. Start PostgreSQL container
npm run db:up

# 4. Run migrations
npm run migration:run

# 5. Seed test data
npm run seed

# 6. Start the application
npm run start:dev
```

### API Endpoints

| Method | Path          | Description                              |
|--------|---------------|------------------------------------------|
| POST   | /orders       | Create a new order (transactional)       |
| GET    | /orders       | List orders (filter: status, dateFrom, dateTo) |
| GET    | /orders/:id   | Get order by ID with items               |
| GET    | /products     | List all products                        |
| GET    | /products/:id | Get product by ID                        |

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

### NPM Scripts Reference

| Script               | Description                           |
|----------------------|---------------------------------------|
| `npm run db:up`      | Start PostgreSQL container            |
| `npm run db:down`    | Stop PostgreSQL container             |
| `npm run db:logs`    | View PostgreSQL container logs        |
| `npm run migration:run`    | Run pending migrations          |
| `npm run migration:revert` | Revert last migration           |
| `npm run migration:generate -- src/migrations/Name` | Generate migration from entity changes |
| `npm run seed`       | Seed database with test data          |
