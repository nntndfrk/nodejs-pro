import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { type App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { appConfig, type DatabaseConfig, databaseConfig, validate } from '../src/config';
import { OrdersModule } from '../src/modules/orders';
import { ProductsModule } from '../src/modules/products';
import { Product } from '../src/modules/products/entities/product.entity';
import { UsersModule } from '../src/modules/users';
import { User } from '../src/modules/users/entities/user.entity';

const TEST_DB_NAME = 'nodejs_pro_test';

async function ensureTestDatabase(): Promise<void> {
  const adminDs = new DataSource({
    type: 'postgres',
    host: process.env['DB_HOST'] ?? 'localhost',
    port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
    username: process.env['DB_USERNAME'] ?? 'postgres',
    password: process.env['DB_PASSWORD'] ?? 'postgres',
    database: 'postgres',
  });

  await adminDs.initialize();
  const result = await adminDs.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [
    TEST_DB_NAME,
  ]);

  if ((result as unknown[]).length === 0) {
    await adminDs.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  }

  await adminDs.destroy();
}

function graphqlRequest(
  app: INestApplication<App>,
  query: string,
  variables?: Record<string, unknown>,
): ReturnType<ReturnType<typeof request>['post']> {
  const req = request(app.getHttpServer())
    .post('/graphql')
    .set('Content-Type', 'application/json')
    .send({ query, variables: variables ?? {} });
  return req;
}

describe('Orders GraphQL E2E', () => {
  let app: INestApplication<App>;
  let testUser: User;
  let testProducts: Product[];

  beforeAll(async () => {
    await ensureTestDatabase();

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig, databaseConfig],
          validate,
          envFilePath: ['.env.local', '.env'],
        }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => {
            const db = configService.getOrThrow<DatabaseConfig>('database');

            return {
              type: 'postgres',
              host: db.host,
              port: db.port,
              username: db.username,
              password: db.password,
              database: TEST_DB_NAME,
              autoLoadEntities: true,
              synchronize: true,
              dropSchema: true,
            };
          },
        }),
        GraphQLModule.forRoot<ApolloDriverConfig>({
          driver: ApolloDriver,
          autoSchemaFile: true,
        }),
        UsersModule,
        ProductsModule,
        OrdersModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    const dataSource = moduleFixture.get(DataSource);
    const userRepo = dataSource.getRepository(User);
    const productRepo = dataSource.getRepository(Product);

    testUser = await userRepo.save(
      userRepo.create({ email: 'graphql-test@example.com', name: 'GraphQL Test User' }),
    );

    testProducts = await productRepo.save([
      productRepo.create({ name: 'Product A', price: 10.0, stock: 100 }),
      productRepo.create({ name: 'Product B', price: 25.5, stock: 50 }),
      productRepo.create({ name: 'Product C', price: 99.99, stock: 10 }),
    ]);

    // Seed orders via REST so we have data for GraphQL queries
    const server = app.getHttpServer();
    await request(server)
      .post('/orders')
      .send({
        userId: testUser.id,
        idempotencyKey: 'gql-order-1',
        items: [
          { productId: testProducts[0]!.id, quantity: 2 },
          { productId: testProducts[1]!.id, quantity: 1 },
        ],
      })
      .expect(201);
    await request(server)
      .post('/orders')
      .send({
        userId: testUser.id,
        idempotencyKey: 'gql-order-2',
        items: [{ productId: testProducts[0]!.id, quantity: 1 }],
      })
      .expect(201);
    await request(server)
      .post('/orders')
      .send({
        userId: testUser.id,
        idempotencyKey: 'gql-order-3',
        items: [
          { productId: testProducts[1]!.id, quantity: 1 },
          { productId: testProducts[2]!.id, quantity: 1 },
        ],
      })
      .expect(201);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  // ─── Basic query — connection shape ───────────────────────

  describe('orders query - basic', () => {
    const query = `
      query {
        orders {
          nodes {
            id
            status
            createdAt
            totalPrice
          }
          totalCount
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `;

    it('should return orders with connection shape', async () => {
      const res = await graphqlRequest(app, query).expect(200);

      expect(res.body.errors).toBeUndefined();
      const data = res.body.data as {
        orders: {
          nodes: unknown[];
          totalCount: number;
          pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
        };
      };
      expect(data.orders).toBeDefined();
      expect(Array.isArray(data.orders.nodes)).toBe(true);
      expect(data.orders.nodes.length).toBeGreaterThan(0);
      expect(typeof data.orders.totalCount).toBe('number');
      expect(data.orders.totalCount).toBeGreaterThanOrEqual(3);
      expect(data.orders.pageInfo).toBeDefined();
      expect(typeof data.orders.pageInfo.hasNextPage).toBe('boolean');
      expect(typeof data.orders.pageInfo.hasPreviousPage).toBe('boolean');
    });
  });

  // ─── Nested items + product (DataLoader) ───────────────────

  describe('orders query - items and product', () => {
    const query = `
      query {
        orders {
          nodes {
            id
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
        }
      }
    `;

    it('should resolve items with product via DataLoader', async () => {
      const res = await graphqlRequest(app, query).expect(200);

      expect(res.body.errors).toBeUndefined();
      const data = res.body.data as {
        orders: {
          nodes: {
            items?: { product?: { id: string; name: string; price: number } }[];
          }[];
        };
      };
      const nodes = data.orders.nodes;
      expect(nodes.length).toBeGreaterThan(0);

      for (const order of nodes) {
        if (order.items) {
          for (const item of order.items) {
            expect(item.product).toBeDefined();
            expect(item.product).toHaveProperty('id');
            expect(item.product).toHaveProperty('name');
            expect(item.product).toHaveProperty('price');
          }
        }
      }
    });
  });

  // ─── Filter by status ──────────────────────────────────────

  describe('orders query - filter by status', () => {
    it('should return only CONFIRMED orders when filtered', async () => {
      const query = `
        query Orders($filter: OrdersFilterInput) {
          orders(filter: $filter) {
            nodes { id status }
            totalCount
          }
        }
      `;
      const res = await graphqlRequest(app, query, {
        filter: { status: 'CONFIRMED' },
      }).expect(200);

      expect(res.body.errors).toBeUndefined();
      const data = res.body.data as {
        orders: { nodes: { status: string }[]; totalCount: number };
      };
      for (const order of data.orders.nodes) {
        expect(order.status).toBe('CONFIRMED');
      }
      expect(data.orders.totalCount).toBeGreaterThan(0);
    });

    it('should return empty nodes when status matches nothing', async () => {
      const query = `
        query Orders($filter: OrdersFilterInput) {
          orders(filter: $filter) {
            nodes { id }
            totalCount
          }
        }
      `;
      const res = await graphqlRequest(app, query, {
        filter: { status: 'CANCELLED' },
      }).expect(200);

      expect(res.body.errors).toBeUndefined();
      const data = res.body.data as { orders: { nodes: unknown[]; totalCount: number } };
      expect(data.orders.nodes).toEqual([]);
      expect(data.orders.totalCount).toBe(0);
    });
  });

  // ─── Filter by date range ─────────────────────────────────

  describe('orders query - filter by date range', () => {
    it('should return orders within dateFrom/dateTo', async () => {
      const query = `
        query Orders($filter: OrdersFilterInput) {
          orders(filter: $filter) {
            nodes { id createdAt }
            totalCount
          }
        }
      `;
      const res = await graphqlRequest(app, query, {
        filter: {
          dateFrom: '2020-01-01T00:00:00.000Z',
          dateTo: '2030-12-31T23:59:59.999Z',
        },
      }).expect(200);

      expect(res.body.errors).toBeUndefined();
      const data = res.body.data as {
        orders: { nodes: { createdAt: string }[]; totalCount: number };
      };
      expect(data.orders.totalCount).toBeGreaterThan(0);
      const from = new Date('2020-01-01T00:00:00.000Z').getTime();
      const to = new Date('2030-12-31T23:59:59.999Z').getTime();
      for (const order of data.orders.nodes) {
        const created = new Date(order.createdAt).getTime();
        expect(created).toBeGreaterThanOrEqual(from);
        expect(created).toBeLessThanOrEqual(to);
      }
    });
  });

  // ─── Pagination ───────────────────────────────────────────

  describe('orders query - pagination', () => {
    it('should respect limit and offset and set pageInfo', async () => {
      const query = `
        query Orders($pagination: OrdersPaginationInput) {
          orders(pagination: $pagination) {
            nodes { id }
            totalCount
            pageInfo { hasNextPage hasPreviousPage }
          }
        }
      `;
      const res = await graphqlRequest(app, query, {
        pagination: { limit: 2, offset: 0 },
      }).expect(200);

      expect(res.body.errors).toBeUndefined();
      const data = res.body.data as {
        orders: {
          nodes: unknown[];
          totalCount: number;
          pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
        };
      };
      expect(data.orders.nodes).toHaveLength(2);
      expect(data.orders.totalCount).toBeGreaterThanOrEqual(3);
      expect(data.orders.pageInfo.hasNextPage).toBe(true);
      expect(data.orders.pageInfo.hasPreviousPage).toBe(false);
    });

    it('should set hasNextPage false and hasPreviousPage true on last page', async () => {
      const query = `
        query Orders($pagination: OrdersPaginationInput) {
          orders(pagination: $pagination) {
            nodes { id }
            totalCount
            pageInfo { hasNextPage hasPreviousPage }
          }
        }
      `;
      const countRes = await graphqlRequest(
        app,
        `
        query { orders { totalCount } }
      `,
      ).expect(200);
      const totalCount = (countRes.body.data as { orders: { totalCount: number } }).orders
        .totalCount;
      const offset = Math.max(0, totalCount - 2);

      const res = await graphqlRequest(app, query, {
        pagination: { limit: 2, offset },
      }).expect(200);

      expect(res.body.errors).toBeUndefined();
      const data = res.body.data as {
        orders: {
          nodes: unknown[];
          pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
        };
      };
      expect(data.orders.pageInfo.hasNextPage).toBe(false);
      if (totalCount > 2) {
        expect(data.orders.pageInfo.hasPreviousPage).toBe(true);
      }
    });

    it('should use default limit when pagination not provided', async () => {
      const query = `
        query {
          orders {
            nodes { id }
            totalCount
          }
        }
      `;
      const res = await graphqlRequest(app, query).expect(200);

      expect(res.body.errors).toBeUndefined();
      const data = res.body.data as { orders: { nodes: unknown[]; totalCount: number } };
      expect(data.orders.nodes.length).toBeLessThanOrEqual(20);
      expect(data.orders.totalCount).toBeGreaterThanOrEqual(data.orders.nodes.length);
    });
  });

  // ─── Validation errors ───────────────────────────────────

  describe('orders query - validation', () => {
    it('should return errors for limit 0', async () => {
      const query = `
        query Orders($pagination: OrdersPaginationInput) {
          orders(pagination: $pagination) {
            nodes { id }
            totalCount
          }
        }
      `;
      const res = await graphqlRequest(app, query, {
        pagination: { limit: 0, offset: 0 },
      }).expect(200);

      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('should return errors for limit > 50', async () => {
      const query = `
        query Orders($pagination: OrdersPaginationInput) {
          orders(pagination: $pagination) {
            nodes { id }
            totalCount
          }
        }
      `;
      const res = await graphqlRequest(app, query, {
        pagination: { limit: 51, offset: 0 },
      }).expect(200);

      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });

    it('should return errors for negative offset', async () => {
      const query = `
        query Orders($pagination: OrdersPaginationInput) {
          orders(pagination: $pagination) {
            nodes { id }
            totalCount
          }
        }
      `;
      const res = await graphqlRequest(app, query, {
        pagination: { limit: 10, offset: -1 },
      }).expect(200);

      expect(res.body.errors).toBeDefined();
      expect(Array.isArray(res.body.errors)).toBe(true);
      expect(res.body.errors.length).toBeGreaterThan(0);
    });
  });

  // ─── Empty results — no error ────────────────────────────

  describe('orders query - empty results', () => {
    it('should return empty connection when filter matches nothing', async () => {
      const query = `
        query Orders($filter: OrdersFilterInput) {
          orders(filter: $filter) {
            nodes { id }
            totalCount
            pageInfo { hasNextPage hasPreviousPage }
          }
        }
      `;
      const res = await graphqlRequest(app, query, {
        filter: { status: 'CANCELLED' },
      }).expect(200);

      expect(res.body.errors).toBeUndefined();
      const data = res.body.data as {
        orders: {
          nodes: unknown[];
          totalCount: number;
          pageInfo: { hasNextPage: boolean; hasPreviousPage: boolean };
        };
      };
      expect(data.orders.nodes).toEqual([]);
      expect(data.orders.totalCount).toBe(0);
      expect(data.orders.pageInfo.hasNextPage).toBe(false);
      expect(data.orders.pageInfo.hasPreviousPage).toBe(false);
    });
  });
});
