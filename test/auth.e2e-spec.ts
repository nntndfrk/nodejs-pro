import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type App } from 'supertest/types';
import { type DataSource } from 'typeorm';

import { UserRole } from '../src/modules/users/entities/user.entity';
import {
  authHeader,
  createTestApp,
  ensureTestDatabase,
  registerAndLogin,
  seedUser,
} from './helpers/test-setup';

describe('Auth E2E', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    await ensureTestDatabase();
    ({ app, dataSource } = await createTestApp());
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  // ─── POST /auth/register ─────────────────────────────────

  describe('POST /auth/register', () => {
    it('should register a new user and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'new@test.com', password: 'password123', name: 'New User' })
        .expect(201);

      const body = res.body as { accessToken: string; refreshToken: string };
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.refreshToken).toBe('string');
    });

    it('should return 409 for duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@test.com', password: 'password123', name: 'Dup' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'dup@test.com', password: 'password123', name: 'Dup 2' })
        .expect(409);
    });

    it('should return 400 for missing email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ password: 'password123', name: 'No Email' })
        .expect(400);
    });

    it('should return 400 for missing password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'nopw@test.com', name: 'No PW' })
        .expect(400);
    });

    it('should return 400 for short password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'short@test.com', password: '123', name: 'Short PW' })
        .expect(400);
    });

    it('should return 400 for invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'password123', name: 'Bad Email' })
        .expect(400);
    });

    it('should not return passwordHash in response', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'nohash@test.com', password: 'password123', name: 'No Hash' })
        .expect(201);

      expect(res.body).not.toHaveProperty('passwordHash');
    });
  });

  // ─── POST /auth/login ────────────────────────────────────

  describe('POST /auth/login', () => {
    beforeAll(async () => {
      await seedUser(dataSource, {
        email: 'login@test.com',
        password: 'correctpass',
      });
    });

    it('should login with valid credentials and return tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@test.com', password: 'correctpass' })
        .expect(200);

      const body = res.body as { accessToken: string; refreshToken: string };
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });

    it('should return 401 for wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@test.com', password: 'wrongpass' })
        .expect(401);
    });

    it('should return 401 for non-existent email', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'doesnotexist@test.com', password: 'password123' })
        .expect(401);
    });

    it('should return 400 for missing fields', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'login@test.com' })
        .expect(400);
    });
  });

  // ─── POST /auth/refresh ──────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('should return new tokens from valid refreshToken', async () => {
      const tokens = await registerAndLogin(app, 'refresh@test.com', 'password123');

      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      const body = res.body as { accessToken: string; refreshToken: string };
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });

    it('should return 401 for invalid refreshToken', async () => {
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  // ─── Protected routes ────────────────────────────────────

  describe('Protected routes', () => {
    it('should return 401 for requests without auth header', async () => {
      await request(app.getHttpServer()).get('/orders').expect(401);
    });

    it('should return 401 for invalid JWT', async () => {
      await request(app.getHttpServer())
        .get('/orders')
        .set(authHeader('invalid.jwt.token'))
        .expect(401);
    });

    it('POST /auth/register should be accessible without auth (@Public)', async () => {
      const res = await request(app.getHttpServer()).post('/auth/register').send({});

      expect(res.status).toBe(400);
    });

    it('GET /products should work without auth', async () => {
      const res = await request(app.getHttpServer()).get('/products').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── Role-based access ───────────────────────────────────

  describe('Role-based access', () => {
    it('admin user should have admin role in JWT payload', async () => {
      await seedUser(dataSource, {
        email: 'admin@test.com',
        password: 'admin123',
        role: UserRole.ADMIN,
      });

      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@test.com', password: 'admin123' })
        .expect(200);

      const body = res.body as { accessToken: string };
      const payload = JSON.parse(
        Buffer.from(body.accessToken.split('.')[1]!, 'base64').toString(),
      ) as { role: string };

      expect(payload.role).toBe('admin');
    });
  });
});
