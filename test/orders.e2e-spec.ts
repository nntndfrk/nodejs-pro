import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { type App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { appConfig, type DatabaseConfig, databaseConfig, validate } from '../src/config';
import { OrdersModule } from '../src/modules/orders';
import { type Order, OrderStatus } from '../src/modules/orders/entities/order.entity';
import { ProductsModule } from '../src/modules/products';
import { Product } from '../src/modules/products/entities/product.entity';
import { UsersModule } from '../src/modules/users';
import { User } from '../src/modules/users/entities/user.entity';

const TEST_DB_NAME = 'nodejs_pro_test';

/**
 * Create the test database if it doesn't exist.
 * Connects to the default 'postgres' database to issue CREATE DATABASE.
 */
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

describe('Orders E2E', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let testUser: User;
  let testProducts: Product[];

  beforeAll(async () => {
    // 1. Ensure test database exists
    await ensureTestDatabase();

    // 2. Build NestJS testing module pointing to test DB
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

    dataSource = moduleFixture.get(DataSource);

    // 3. Seed test data
    const userRepo = dataSource.getRepository(User);
    const productRepo = dataSource.getRepository(Product);

    testUser = await userRepo.save(
      userRepo.create({ email: 'test@example.com', name: 'Test User' }),
    );

    testProducts = await productRepo.save([
      productRepo.create({ name: 'Product A', price: 10.0, stock: 100 }),
      productRepo.create({ name: 'Product B', price: 25.5, stock: 5 }),
      productRepo.create({ name: 'Product C', price: 99.99, stock: 1 }),
    ]);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  // ─── Successful order creation ────────────────────────────

  describe('POST /orders - successful creation', () => {
    it('should create an order and return 201', async () => {
      const dto = {
        userId: testUser.id,
        idempotencyKey: 'order-success-1',
        items: [
          { productId: testProducts[0]!.id, quantity: 2 },
          { productId: testProducts[1]!.id, quantity: 1 },
        ],
      };

      const res = await request(app.getHttpServer()).post('/orders').send(dto).expect(201);

      expect(res.body).toMatchObject({
        userId: testUser.id,
        status: OrderStatus.CONFIRMED,
        idempotencyKey: 'order-success-1',
      });
      expect(res.body.items).toHaveLength(2);
      expect(res.body.id).toBeDefined();

      // Verify stock was deducted
      const productA = await dataSource
        .getRepository(Product)
        .findOneBy({ id: testProducts[0]!.id });
      expect(productA!.stock).toBe(98); // 100 - 2
    });

    it('should calculate totalPrice correctly', async () => {
      const dto = {
        userId: testUser.id,
        idempotencyKey: 'order-price-check',
        items: [{ productId: testProducts[0]!.id, quantity: 3 }],
      };

      const res = await request(app.getHttpServer()).post('/orders').send(dto).expect(201);

      // Product A price=10.00, quantity=3 => 30.00
      expect(parseFloat(res.body.totalPrice)).toBeCloseTo(30.0);
    });

    it('should accept same product in multiple line items and deduct stock once per quantity', async () => {
      const product = testProducts[0]!;
      const stockBefore = (await dataSource.getRepository(Product).findOneBy({ id: product.id }))!
        .stock;

      const dto = {
        userId: testUser.id,
        idempotencyKey: 'order-duplicate-product-lines',
        items: [
          { productId: product.id, quantity: 1 },
          { productId: product.id, quantity: 2 },
        ],
      };

      const res = await request(app.getHttpServer()).post('/orders').send(dto).expect(201);

      expect(res.body.items).toHaveLength(2);
      // Product A price=10.00: 1*10 + 2*10 = 30.00
      expect(parseFloat(res.body.totalPrice)).toBeCloseTo(30.0);

      const stockAfter = (await dataSource.getRepository(Product).findOneBy({ id: product.id }))!
        .stock;
      expect(stockAfter).toBe(stockBefore - 3); // 1 + 2 deducted once per line
    });
  });

  // ─── Idempotency ─────────────────────────────────────────

  describe('POST /orders - idempotency', () => {
    it('should return the same order for duplicate idempotencyKey', async () => {
      const dto = {
        userId: testUser.id,
        idempotencyKey: 'idempotent-key-1',
        items: [{ productId: testProducts[0]!.id, quantity: 1 }],
      };

      const first = await request(app.getHttpServer()).post('/orders').send(dto).expect(201);

      const second = await request(app.getHttpServer()).post('/orders').send(dto).expect(201);

      expect(first.body.id).toBe(second.body.id);
      expect(first.body.idempotencyKey).toBe(second.body.idempotencyKey);
    });

    it('should not deduct stock twice for duplicate requests', async () => {
      const stockBefore = (await dataSource.getRepository(Product).findOneBy({
        id: testProducts[0]!.id,
      }))!.stock;

      const dto = {
        userId: testUser.id,
        idempotencyKey: 'idempotent-no-double-deduct',
        items: [{ productId: testProducts[0]!.id, quantity: 5 }],
      };

      await request(app.getHttpServer()).post('/orders').send(dto).expect(201);
      await request(app.getHttpServer()).post('/orders').send(dto).expect(201);

      const stockAfter = (await dataSource.getRepository(Product).findOneBy({
        id: testProducts[0]!.id,
      }))!.stock;

      expect(stockAfter).toBe(stockBefore - 5); // deducted only once
    });
  });

  // ─── Insufficient stock ──────────────────────────────────

  describe('POST /orders - insufficient stock', () => {
    it('should return 409 when stock is insufficient', async () => {
      const dto = {
        userId: testUser.id,
        idempotencyKey: 'stock-conflict-1',
        items: [{ productId: testProducts[2]!.id, quantity: 999 }],
      };

      const res = await request(app.getHttpServer()).post('/orders').send(dto).expect(409);

      expect(res.body.message).toContain('Insufficient stock');
    });

    it('should not deduct stock on failed order', async () => {
      const stockBefore = (await dataSource.getRepository(Product).findOneBy({
        id: testProducts[2]!.id,
      }))!.stock;

      const dto = {
        userId: testUser.id,
        idempotencyKey: 'stock-conflict-no-deduct',
        items: [{ productId: testProducts[2]!.id, quantity: 999 }],
      };

      await request(app.getHttpServer()).post('/orders').send(dto).expect(409);

      const stockAfter = (await dataSource.getRepository(Product).findOneBy({
        id: testProducts[2]!.id,
      }))!.stock;

      expect(stockAfter).toBe(stockBefore); // unchanged
    });
  });

  // ─── Concurrent orders (oversell protection) ─────────────

  describe('POST /orders - concurrent orders', () => {
    it('should not oversell when two concurrent orders compete for limited stock', async () => {
      // Product C has stock=1 (or whatever remains). Reset it to exactly 1.
      await dataSource.getRepository(Product).update(testProducts[2]!.id, { stock: 1 });

      const makeOrder = (key: string) =>
        request(app.getHttpServer())
          .post('/orders')
          .send({
            userId: testUser.id,
            idempotencyKey: key,
            items: [{ productId: testProducts[2]!.id, quantity: 1 }],
          });

      const [res1, res2] = await Promise.all([
        makeOrder('concurrent-1'),
        makeOrder('concurrent-2'),
      ]);

      const statuses = [res1.status, res2.status].sort();

      // One should succeed (201), one should fail (409 or 500 from lock)
      expect(statuses).toContain(201);
      expect(statuses.some((s) => s !== 201)).toBe(true);

      // Stock should be exactly 0
      const product = await dataSource.getRepository(Product).findOneBy({
        id: testProducts[2]!.id,
      });
      expect(product!.stock).toBe(0);
    });
  });

  // ─── Validation errors ───────────────────────────────────

  describe('POST /orders - validation', () => {
    it('should return 400 for missing userId', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          idempotencyKey: 'val-1',
          items: [{ productId: testProducts[0]!.id, quantity: 1 }],
        })
        .expect(400);
    });

    it('should return 400 for invalid UUID in userId', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: 'not-a-uuid',
          idempotencyKey: 'val-2',
          items: [{ productId: testProducts[0]!.id, quantity: 1 }],
        })
        .expect(400);
    });

    it('should return 400 for empty items array', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: testUser.id,
          idempotencyKey: 'val-3',
          items: [],
        })
        .expect(400);
    });

    it('should return 400 for quantity < 1', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: testUser.id,
          idempotencyKey: 'val-4',
          items: [{ productId: testProducts[0]!.id, quantity: 0 }],
        })
        .expect(400);
    });

    it('should return 400 for missing idempotencyKey', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: testUser.id,
          items: [{ productId: testProducts[0]!.id, quantity: 1 }],
        })
        .expect(400);
    });
  });

  // ─── Not found errors ────────────────────────────────────

  describe('POST /orders - not found', () => {
    it('should return 404 for non-existent user', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: '00000000-0000-0000-0000-000000000000',
          idempotencyKey: 'nf-user-1',
          items: [{ productId: testProducts[0]!.id, quantity: 1 }],
        })
        .expect(404);

      expect(res.body.message).toContain('User');
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          userId: testUser.id,
          idempotencyKey: 'nf-product-1',
          items: [{ productId: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
        })
        .expect(404);

      expect(res.body.message).toContain('Products not found');
    });
  });

  // ─── GET /orders ─────────────────────────────────────────

  describe('GET /orders', () => {
    it('should return all orders', async () => {
      const res = await request(app.getHttpServer()).get('/orders').expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .query({ status: OrderStatus.CONFIRMED })
        .expect(200);

      for (const order of res.body as Order[]) {
        expect(order.status).toBe(OrderStatus.CONFIRMED);
      }
    });
  });

  // ─── GET /orders/:id ─────────────────────────────────────

  describe('GET /orders/:id', () => {
    it('should return an order by id with items', async () => {
      const allOrders = await request(app.getHttpServer()).get('/orders').expect(200);
      const orderId = (allOrders.body as Order[])[0]!.id;

      const res = await request(app.getHttpServer()).get(`/orders/${orderId}`).expect(200);

      expect(res.body.id).toBe(orderId);
      expect(res.body.items).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      await request(app.getHttpServer())
        .get('/orders/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
