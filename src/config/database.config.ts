import { registerAs } from '@nestjs/config';

import { ENV_DEFAULTS } from './env.validation';

export const databaseConfig = registerAs('database', () => ({
  host: process.env['DB_HOST'] ?? ENV_DEFAULTS.DB_HOST,
  port: parseInt(process.env['DB_PORT'] ?? '', 10) || ENV_DEFAULTS.DB_PORT,
  username: process.env['DB_USERNAME'] ?? ENV_DEFAULTS.DB_USERNAME,
  password: process.env['DB_PASSWORD'] ?? ENV_DEFAULTS.DB_PASSWORD,
  database: process.env['DB_NAME'] ?? ENV_DEFAULTS.DB_NAME,
}));

export type DatabaseConfig = ReturnType<typeof databaseConfig>;
