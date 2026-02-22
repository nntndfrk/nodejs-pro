import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { type App } from 'supertest/types';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

import {
  appConfig,
  type DatabaseConfig,
  databaseConfig,
  jwtConfig,
  s3Config,
  validate,
} from '../../src/config';
import { AuthModule } from '../../src/modules/auth';
import { FilesModule } from '../../src/modules/files';
import { OrdersModule } from '../../src/modules/orders';
import { ProductsModule } from '../../src/modules/products';
import { StorageModule } from '../../src/modules/storage';
import { User, UserRole } from '../../src/modules/users/entities/user.entity';
import { UsersModule } from '../../src/modules/users';

export const TEST_DB_NAME = 'nodejs_pro_test';
const BCRYPT_SALT_ROUNDS = 10;

export async function ensureTestDatabase(): Promise<void> {
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

export async function createTestApp(): Promise<{
  app: INestApplication<App>;
  dataSource: DataSource;
}> {
  const moduleFixture = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [appConfig, databaseConfig, jwtConfig, s3Config],
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
      AuthModule,
      StorageModule,
      FilesModule,
      UsersModule,
      ProductsModule,
      OrdersModule,
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  const dataSource = moduleFixture.get(DataSource);

  return { app, dataSource };
}

export async function seedUser(
  dataSource: DataSource,
  overrides: Partial<User> & { password?: string } = {},
): Promise<User> {
  const userRepo = dataSource.getRepository(User);
  const password = overrides.password ?? 'password123';
  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  const { password: _pw, ...rest } = overrides;

  return userRepo.save(
    userRepo.create({
      email: `user-${String(Date.now())}-${Math.random().toString(36).slice(2)}@test.com`,
      name: 'Test User',
      role: UserRole.USER,
      passwordHash,
      ...rest,
    }),
  );
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

export async function registerAndLogin(
  app: INestApplication<App>,
  email: string,
  password: string,
  name = 'Test User',
): Promise<AuthTokens> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ email, password, name })
    .expect(201);

  const body = res.body as { accessToken: string; refreshToken: string };

  const payload = JSON.parse(Buffer.from(body.accessToken.split('.')[1]!, 'base64').toString()) as {
    sub: string;
  };

  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    userId: payload.sub,
  };
}

export async function loginAs(
  app: INestApplication<App>,
  email: string,
  password: string,
): Promise<AuthTokens> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);

  const body = res.body as { accessToken: string; refreshToken: string };

  const payload = JSON.parse(Buffer.from(body.accessToken.split('.')[1]!, 'base64').toString()) as {
    sub: string;
  };

  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    userId: payload.sub,
  };
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
