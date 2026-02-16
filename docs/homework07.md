# Homework 07 — GraphQL for Orders + DataLoader

## Table of Contents

1. [Overview](#overview)
2. [Schema Approach — Code-First](#schema-approach--code-first)
3. [Architecture — Business Logic in Services](#architecture--business-logic-in-services)
4. [DataLoader Implementation](#dataloader-implementation)
5. [N+1 Proof — Before & After](#n1-proof--before--after)
6. [Pagination & Filtering](#pagination--filtering)
7. [Error Handling](#error-handling)
8. [Example Queries](#example-queries)

---

## Overview

This assignment adds a **GraphQL API** (alongside the existing REST API) for querying orders with:

- **Code-first schema** — types co-located with entity decorators
- **Thin resolvers** — business logic stays in the service layer
- **DataLoader** — batches product lookups to eliminate the N+1 problem
- **Pagination** — offset-based with `OrdersConnection { nodes, totalCount, pageInfo }`
- **Validation** — class-validator on inputs, enforced by the global `ValidationPipe`

### Stack

| Component        | Choice                                      |
|------------------|---------------------------------------------|
| GraphQL Driver   | `@nestjs/apollo` + `@apollo/server`         |
| Schema Approach  | Code-first (`autoSchemaFile: true`)         |
| Batching         | `dataloader` (request-scoped)               |
| Validation       | `class-validator` via NestJS `ValidationPipe` |

---

## Schema Approach — Code-First

**Choice:** Code-first with `@ObjectType()` / `@Field()` decorators directly on existing TypeORM entities.

**Reasoning:**

1. **Co-location** — GraphQL types live alongside the ORM entities. A single `Order` class is both the DB entity and the GraphQL type, so there is no mapping layer and no duplication.
2. **NestJS-idiomatic** — this is the approach recommended in the [NestJS GraphQL docs](https://docs.nestjs.com/graphql/quick-start#code-first). The framework generates the `.graphql` schema automatically at startup from the decorated classes.
3. **Refactoring safety** — renaming a field or changing a type updates both the DB and GraphQL layers in one place. With schema-first, you'd need to keep a `.graphql` file in sync manually.
4. **Selective exposure** — not every entity field is exposed. Internal fields like `userId`, `idempotencyKey`, `stock`, and `version` are omitted from the GraphQL schema simply by not adding `@Field()`.

---

## Architecture — Business Logic in Services

Resolvers are intentionally **thin** — they only call service methods and return results:

```
OrdersResolver.orders(filter, pagination)
  └─→ OrdersService.findAllPaginated(filter, pagination)
        └─→ QueryBuilder with .getManyAndCount()

OrderItemResolver.product(item)
  └─→ ProductLoader.load(item.productId)
        └─→ (batched) ProductsService.findByIds(ids)
```

**Why this matters:**

- The service layer is reusable — both REST and GraphQL endpoints use the same `OrdersService`
- Testing is straightforward — you can unit-test the service without GraphQL infrastructure
- The resolver has no conditional logic, no error handling — it's purely a transport adapter

---

## DataLoader Implementation

### Problem: N+1 Queries

When a GraphQL query requests `orders → items → product`, without DataLoader each `OrderItem` triggers a separate `SELECT * FROM products WHERE id = ?`. For 20 orders with 2 items each, that's 40 individual product queries.

### Solution: Request-Scoped DataLoader

**File:** `src/modules/products/product.loader.ts`

```typescript
@Injectable({ scope: Scope.REQUEST })
export class ProductLoader {
  private readonly loader: DataLoader<string, Product>;

  constructor(private readonly productsService: ProductsService) {
    this.loader = new DataLoader<string, Product>(async (ids) => {
      const products = await this.productsService.findByIds(ids as string[]);
      const productMap = new Map(products.map((p) => [p.id, p]));
      return ids.map(
        (id) => productMap.get(id) ?? new Error(`Product ${id} not found`),
      );
    });
  }

  public async load(id: string): Promise<Product> {
    return this.loader.load(id);
  }
}
```

**Key design decisions:**

| Decision | Reasoning |
|----------|-----------|
| `Scope.REQUEST` | Each request gets a fresh DataLoader instance — no stale cache across requests, no cross-user data leaks |
| `findByIds()` with `IN` clause | Single SQL query for all product IDs: `SELECT * FROM products WHERE id IN ($1, $2, ...)` |
| Map-based reordering | DataLoader requires results in the same order as input keys — the Map lookup guarantees this |
| Error per missing ID | If a product is deleted mid-request, the loader returns an `Error` for that specific ID instead of crashing the entire batch |

---

## N+1 Proof — Before & After

TypeORM SQL logging is enabled in development mode (`logging: true` in `app.module.ts`).

### Before DataLoader (without ProductLoader)

Running the query:
```graphql
{
  orders(pagination: { limit: 3 }) {
    nodes {
      id
      items {
        quantity
        product { id name price }
      }
    }
  }
}
```

Would produce (conceptually) N separate queries for products:
```sql
-- 1. Orders + items (single query from findAllPaginated)
SELECT "order".*, "item".* FROM "orders" "order"
  LEFT JOIN "order_items" "item" ON "item"."orderId" = "order"."id"
  ORDER BY "order"."createdAt" DESC LIMIT 3

-- 2. Product for item 1
SELECT * FROM "products" WHERE "id" = $1  -- uuid-aaa

-- 3. Product for item 2
SELECT * FROM "products" WHERE "id" = $2  -- uuid-bbb

-- 4. Product for item 3
SELECT * FROM "products" WHERE "id" = $3  -- uuid-aaa (duplicate!)

-- ... N more queries for N items
```

### After DataLoader

With `ProductLoader` wired into `OrderItemResolver`, the same query produces:
```sql
-- 1. Orders + items (unchanged)
SELECT "order".*, "item".* FROM "orders" "order"
  LEFT JOIN "order_items" "item" ON "item"."orderId" = "order"."id"
  ORDER BY "order"."createdAt" DESC LIMIT 3

-- 2. ALL products in a single batched query (deduplicated)
SELECT * FROM "products" WHERE "id" IN ($1, $2)  -- only unique IDs
```

**Result:** N individual queries collapsed into 1 batched query. DataLoader also deduplicates — if multiple items reference the same product, it's fetched only once.

---

## Pagination & Filtering

### Approach: Offset-Based with OrdersConnection

```graphql
type OrdersConnection {
  nodes: [Order!]!
  totalCount: Int!
  pageInfo: PageInfo!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
}
```

**Why offset-based (not cursor-based):**

- The admin/dashboard use case benefits from knowing `totalCount` and jumping to arbitrary pages
- The dataset is filtered by status + date range — typically returning hundreds, not millions of rows
- Simpler to implement and test; cursor-based can be added later if needed

### Validation

| Field   | Constraint | Behavior on violation |
|---------|------------|----------------------|
| `limit` | 1 ≤ limit ≤ 50 | GraphQL validation error (400) |
| `offset`| offset ≥ 0 | GraphQL validation error (400) |

Defaults: `limit = 20`, `offset = 0`.

### Available Filters

| Filter     | Type         | Description                |
|------------|--------------|----------------------------|
| `status`   | `OrderStatus` (enum) | Filter by order status |
| `dateFrom` | `DateTime`   | Orders created on or after |
| `dateTo`   | `DateTime`   | Orders created on or before |

All filters are optional. When omitted, no filtering is applied.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Invalid pagination (e.g. `limit: -1`) | `ValidationPipe` returns 400 with field-level error messages |
| No orders match filters | Returns `{ nodes: [], totalCount: 0, pageInfo: { hasNextPage: false, hasPreviousPage: false } }` |
| Database error | Caught by NestJS exception filter; logged server-side with `Logger`; client receives a generic GraphQL error |
| Product not found in DataLoader | `Error` returned for that specific item; other items in the batch still resolve |

---

## Example Queries

### List orders with filters and pagination

```graphql
query Orders($filter: OrdersFilterInput, $pagination: OrdersPaginationInput) {
  orders(filter: $filter, pagination: $pagination) {
    nodes {
      id
      status
      totalPrice
      createdAt
      items {
        id
        quantity
        price
        product {
          id
          name
          price
        }
      }
    }
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
  }
}
```

**Variables:**
```json
{
  "filter": {
    "status": "CONFIRMED",
    "dateFrom": "2025-01-01T00:00:00Z"
  },
  "pagination": {
    "limit": 10,
    "offset": 0
  }
}
```

### List all orders (defaults)

```graphql
{
  orders {
    nodes {
      id
      status
      createdAt
    }
    totalCount
  }
}
```

### Get orders with product details (tests DataLoader)

```graphql
{
  orders(pagination: { limit: 5 }) {
    nodes {
      id
      items {
        quantity
        product {
          id
          name
          price
        }
      }
    }
  }
}
```

---

## How to Test

1. Start the database and seed data:
   ```bash
   npm run db:up
   npm run migration:run
   npm run seed
   ```

2. Start the dev server:
   ```bash
   npm run start:dev
   ```

3. Open the GraphQL Playground at [http://localhost:3000/graphql](http://localhost:3000/graphql)

4. Run the example queries above

5. Check the server console for SQL logs — with DataLoader you should see a single `SELECT ... WHERE id IN (...)` for products instead of N individual queries
