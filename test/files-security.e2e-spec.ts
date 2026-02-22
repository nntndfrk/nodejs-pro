import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type App } from 'supertest/types';
import { type DataSource } from 'typeorm';

import { FileRecord } from '../src/modules/files/entities/file-record.entity';
import { type User, UserRole } from '../src/modules/users/entities/user.entity';
import {
  type AuthTokens,
  authHeader,
  createTestApp,
  ensureTestDatabase,
  loginAs,
  seedUser,
} from './helpers/test-setup';

describe('Files Security E2E', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let userA: User;
  let userB: User;
  let adminUser: User;
  let userATokens: AuthTokens;
  let userBTokens: AuthTokens;
  let adminTokens: AuthTokens;

  beforeAll(async () => {
    await ensureTestDatabase();
    ({ app, dataSource } = await createTestApp());

    userA = await seedUser(dataSource, {
      email: 'sec-usera@test.com',
      password: 'password123',
      role: UserRole.USER,
    });
    userB = await seedUser(dataSource, {
      email: 'sec-userb@test.com',
      password: 'password123',
      role: UserRole.USER,
    });
    adminUser = await seedUser(dataSource, {
      email: 'sec-admin@test.com',
      password: 'admin123',
      role: UserRole.ADMIN,
    });

    userATokens = await loginAs(app, userA.email, 'password123');
    userBTokens = await loginAs(app, userB.email, 'password123');
    adminTokens = await loginAs(app, adminUser.email, 'admin123');
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  // ─── Backend key generation ──────────────────────────────

  describe('Backend key generation', () => {
    it('key should contain entityType prefix, entityId, and UUID segment', async () => {
      const res = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { key } = res.body as { key: string };

      expect(key).toMatch(/^users\//);
      expect(key).toContain(userA.id);
      // UUID v4 pattern in the filename
      expect(key).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/);
    });

    it('different presign calls should produce different keys', async () => {
      const send = () =>
        request(app.getHttpServer())
          .post('/files/presign')
          .set(authHeader(userATokens.accessToken))
          .send({
            entityType: 'user',
            entityId: userA.id,
            contentType: 'image/jpeg',
          })
          .expect(201);

      const [res1, res2] = await Promise.all([send(), send()]);
      const key1 = (res1.body as { key: string }).key;
      const key2 = (res2.body as { key: string }).key;

      expect(key1).not.toBe(key2);
    });
  });

  // ─── Ownership & prefix isolation ────────────────────────

  describe('Ownership checks', () => {
    it('userA cannot presign with entityId of userB', async () => {
      await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userB.id,
          contentType: 'image/jpeg',
        })
        .expect(403);
    });

    it('userA cannot complete a file owned by userB', async () => {
      // userB presigns
      const res = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userBTokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userB.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { fileId } = res.body as { fileId: string };

      // userA tries to complete
      await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(userATokens.accessToken))
        .send({ fileId })
        .expect(403);
    });

    it('userA cannot presign with entityType=product (non-admin)', async () => {
      await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'product',
          entityId: '00000000-0000-0000-0000-000000000000',
          contentType: 'image/jpeg',
        })
        .expect(403);
    });
  });

  // ─── Status lifecycle ────────────────────────────────────

  describe('FileRecord status lifecycle', () => {
    it('newly created FileRecord must have status=pending', async () => {
      const res = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { fileId } = res.body as { fileId: string };
      const record = await dataSource.getRepository(FileRecord).findOneBy({ id: fileId });

      expect(record!.status).toBe('pending');
    });

    it('cannot complete a file that was never uploaded to S3', async () => {
      const res = await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(userATokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      const { fileId } = res.body as { fileId: string };

      await request(app.getHttpServer())
        .post('/files/complete')
        .set(authHeader(userATokens.accessToken))
        .send({ fileId })
        .expect(400);
    });
  });

  // ─── Role-based access ───────────────────────────────────

  describe('Role-based access', () => {
    it('unauthenticated user cannot access file endpoints', async () => {
      await request(app.getHttpServer())
        .post('/files/presign')
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(401);

      await request(app.getHttpServer())
        .post('/files/complete')
        .send({ fileId: '00000000-0000-0000-0000-000000000000' })
        .expect(401);

      await request(app.getHttpServer())
        .get('/files/00000000-0000-0000-0000-000000000000')
        .expect(401);
    });

    it('admin can presign for any entityType/entityId', async () => {
      await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(adminTokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userA.id,
          contentType: 'image/jpeg',
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/files/presign')
        .set(authHeader(adminTokens.accessToken))
        .send({
          entityType: 'user',
          entityId: userB.id,
          contentType: 'image/jpeg',
        })
        .expect(201);
    });

    it("admin can view any user's file", async () => {
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
        .get(`/files/${fileId}`)
        .set(authHeader(adminTokens.accessToken))
        .expect(200);
    });
  });
});
