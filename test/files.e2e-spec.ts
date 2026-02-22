import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type App } from 'supertest/types';
import { type DataSource } from 'typeorm';

import { FileRecord } from '../src/modules/files/entities/file-record.entity';
import { Order, OrderStatus } from '../src/modules/orders/entities/order.entity';
import { OrderItem } from '../src/modules/orders/entities/order-item.entity';
import { Product } from '../src/modules/products/entities/product.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import {
  type AuthTokens,
  authHeader,
  createTestApp,
  ensureTestDatabase,
  loginAs,
  seedUser,
} from './helpers/test-setup';

// 1x1 red pixel JPEG (~631 bytes)
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIA' +
    'AhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAA' +
    'AAAAAAAAAAAAAAAAAAAB/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=',
  'base64',
);

describe('Files E2E', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let userA: User;
  let userATokens: AuthTokens;
  let adminUser: User;
  let adminTokens: AuthTokens;
  let testProduct: Product;

  beforeAll(async () => {
    await ensureTestDatabase();
    ({ app, dataSource } = await createTestApp());

    userA = await seedUser(dataSource, {
      email: 'usera@test.com',
      name: 'User A',
      password: 'password123',
      role: UserRole.USER,
    });

    adminUser = await seedUser(dataSource, {
      email: 'admin-files@test.com',
      name: 'Admin',
      password: 'admin123',
      role: UserRole.ADMIN,
    });

    testProduct = await dataSource.getRepository(Product).save(
      dataSource.getRepository(Product).create({
        name: 'Test Product',
        price: 10.0,
        stock: 100,
      }),
    );

    userATokens = await loginAs(app, 'usera@test.com', 'password123');
    adminTokens = await loginAs(app, 'admin-files@test.com', 'admin123');
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  // ─── POST /files/presign ──────────────────────────────────

  describe('POST /files/presign', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/files/presign')
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(401);
    });

    it('should return presign response with fileId, key, uploadUrl, contentType', async () => {
      const res = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const body = res.body as {
        fileId: string;
        key: string;
        uploadUrl: string;
        contentType: string;
      };
      expect(body.fileId).toBeDefined();
      expect(body.key).toContain(`users/${userA.id}/avatars/`);
      expect(body.key).toMatch(/\.jpg$/);
      expect(body.uploadUrl).toContain('http');
      expect(body.contentType).toBe('image/jpeg');
    });

    it('should create FileRecord in DB with status=pending', async () => {
      const res = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/png',
        })
        .expect(201);

      const body = res.body as { fileId: string };
      const record = await dataSource.getRepository(FileRecord).findOneBy({ id: body.fileId });

      expect(record).not.toBeNull();
      expect(record!.status).toBe('pending');
      expect(record!.ownerId).toBe(userA.id);
      expect(record!.entityId).toBe(userA.id);
      expect(record!.entityType).toBe('user');
    });

    it('should generate key on backend, not from client input', async () => {
      const res = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const body = res.body as { key: string };
      expect(body.key).toMatch(/^users\/[0-9a-f-]+\/avatars\/[0-9a-f-]+\.jpg$/);
    });

    it('should reject invalid contentType', async () => {
      await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'application/exe',
        })
        .expect(400);
    });

    it('should reject invalid entityType', async () => {
      await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'invalid',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('should reject request where entityId does not belong to current user', async () => {
      await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: adminUser.id,
          contentType: 'image/jpeg',
        })
        .expect(403);
    });

    it('admin should be able to presign for any user entity', async () => {
      await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(adminTokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);
    });

    it('regular user should not be able to presign for product entity', async () => {
      await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'product',
          entityId: testProduct.id,
          contentType: 'image/jpeg',
        })
        .expect(403);
    });

    it('admin should be able to presign for product entity', async () => {
      const res = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(adminTokens.accessToken))
        .send({
          entityType: 'product',
          entityId: testProduct.id,
          contentType: 'image/png',
        })
        .expect(201);

      const body = res.body as { key: string };
      expect(body.key).toContain(`products/${testProduct.id}/images/`);
    });
  });

  // ─── POST /files/complete ─────────────────────────────────

  describe('POST /files/complete', () => {
    it('should return 401 without auth token', async () => {
      await request(app.getHttpServer())
        .post('/files/complete')
        .send({ fileId: '00000000-0000-0000-0000-000000000000' })
        .expect(401);
    });

    it('should return 404 for non-existent fileId', async () => {
      await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(userATokens.accessToken))
        .send({ fileId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('should reject completing a file that was never uploaded', async () => {
      const presignRes = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { fileId } = presignRes.body as { fileId: string };

      await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(userATokens.accessToken))
        .send({ fileId })
        .expect(400);
    });

    it("should reject completing someone else's file", async () => {
      const presignRes = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(adminTokens.accessToken))
        .send({
          entityType: 'user',
          entityId: adminUser.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { fileId } = presignRes.body as { fileId: string };

      await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(userATokens.accessToken))
        .send({ fileId })
        .expect(403);
    });
  });

  // ─── Full presign → upload → complete flow ───────────────

  describe('Full upload lifecycle', () => {
    it('should complete the entire flow: presign → PUT to S3 → complete', async () => {
      // 1. Presign
      const presignRes = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const presignBody = presignRes.body as {
        fileId: string;
        key: string;
        uploadUrl: string;
      };

      // 2. Upload to S3 via presigned URL
      const uploadRes = await fetch(presignBody.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: TINY_JPEG,
      });
      expect(uploadRes.ok).toBe(true);

      // 3. Complete
      const completeRes = await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(userATokens.accessToken))
        .send({ fileId: presignBody.fileId })
        .expect(200);

      const completeBody = completeRes.body as {
        fileId: string;
        url: string;
        status: string;
      };

      expect(completeBody.status).toBe('ready');
      expect(completeBody.url).toBeDefined();
      expect(completeBody.fileId).toBe(presignBody.fileId);

      // 4. Verify DB record
      const record = await dataSource
        .getRepository(FileRecord)
        .findOneBy({ id: presignBody.fileId });
      expect(record).not.toBeNull();
      expect(record!.status).toBe('ready');
      expect(record!.size).not.toBeNull();
      expect(Number(record!.size)).toBeGreaterThan(0);
    });

    it('should reject completing an already-completed file', async () => {
      // Presign + upload + complete
      const presignRes = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { fileId, uploadUrl } = presignRes.body as {
        fileId: string;
        uploadUrl: string;
      };

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: TINY_JPEG,
      });

      await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(userATokens.accessToken))
        .send({ fileId })
        .expect(200);

      // Second complete should fail
      await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(userATokens.accessToken))
        .send({ fileId })
        .expect(400);
    });
  });

  // ─── User avatar integration ──────────────────────────────

  describe('User avatar integration', () => {
    it('should set avatarFileId on User after complete', async () => {
      const presignRes = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { fileId, uploadUrl } = presignRes.body as {
        fileId: string;
        uploadUrl: string;
      };

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: TINY_JPEG,
      });

      await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(userATokens.accessToken))
        .send({ fileId })
        .expect(200);

      const user = await dataSource.getRepository(User).findOneBy({ id: userA.id });
      expect(user!.avatarFileId).toBe(fileId);
    });
  });

  // ─── Product image integration ────────────────────────────

  describe('Product image integration', () => {
    it('admin should set imageFileId on Product after complete', async () => {
      const presignRes = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(adminTokens.accessToken))
        .send({
          entityType: 'product',
          entityId: testProduct.id,
          contentType: 'image/png',
        })
        .expect(201);

      const { fileId, uploadUrl } = presignRes.body as {
        fileId: string;
        uploadUrl: string;
      };

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: TINY_JPEG,
      });

      await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(adminTokens.accessToken))
        .send({ fileId })
        .expect(200);

      const product = await dataSource.getRepository(Product).findOneBy({ id: testProduct.id });
      expect(product!.imageFileId).toBe(fileId);
    });
  });

  // ─── Order invoice integration ────────────────────────────

  describe('Order invoice integration', () => {
    let testOrder: Order;

    beforeAll(async () => {
      testOrder = await dataSource.getRepository(Order).save(
        dataSource.getRepository(Order).create({
          userId: userA.id,
          totalPrice: 100,
          status: OrderStatus.CONFIRMED,
          idempotencyKey: `invoice-test-${String(Date.now())}`,
          items: [
            dataSource.getRepository(OrderItem).create({
              productId: testProduct.id,
              quantity: 1,
              price: 100,
            }),
          ],
        }),
      );
    });

    it('order owner should presign and complete an invoice', async () => {
      const presignRes = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'order',
          entityId: testOrder.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { fileId, uploadUrl, key } = presignRes.body as {
        fileId: string;
        uploadUrl: string;
        key: string;
      };

      expect(key).toContain(`orders/${testOrder.id}/invoices/`);

      await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: TINY_JPEG,
      });

      await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(userATokens.accessToken))
        .send({ fileId })
        .expect(200);

      const order = await dataSource.getRepository(Order).findOneBy({ id: testOrder.id });
      expect(order!.invoiceFileId).toBe(fileId);
    });

    it('other users should not presign for orders they do not own', async () => {
      const userB = await seedUser(dataSource, {
        email: 'userb-order@test.com',
        password: 'password123',
      });
      const userBTokens = await loginAs(app, userB.email, 'password123');

      await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userBTokens.accessToken))
        .send({
          entityType: 'order',
          entityId: testOrder.id,
          contentType: 'image/jpeg',
        })
        .expect(403);
    });
  });

  // ─── GET /files/:id ───────────────────────────────────────

  describe('GET /files/:id', () => {
    it('should return file metadata and URL for owner', async () => {
      const presignRes = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { fileId } = presignRes.body as { fileId: string };

      const res = await request(app.getHttpServer())
        .get(`/files/${fileId}`)
        .set(authHeader(userATokens.accessToken))
        .expect(200);

      const body = res.body as { id: string; key: string; contentType: string; url: string };
      expect(body.id).toBe(fileId);
      expect(body.key).toBeDefined();
      expect(body.contentType).toBe('image/jpeg');
      expect(body.url).toBeDefined();
    });

    it("should return 404 for another user's file", async () => {
      const presignRes = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(adminTokens.accessToken))
        .send({
          entityType: 'user',
          entityId: adminUser.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { fileId } = presignRes.body as { fileId: string };

      await request(app.getHttpServer())
        .get(`/files/${fileId}`)
        .set(authHeader(userATokens.accessToken))
        .expect(404);
    });
  });
});
