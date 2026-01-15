import { registerAs } from '@nestjs/config';

import { ENV_DEFAULTS, Environment } from './env.validation';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env['NODE_ENV'] ?? ENV_DEFAULTS.NODE_ENV,
  name: process.env['APP_NAME'] ?? ENV_DEFAULTS.APP_NAME,
  port: parseInt(process.env['PORT'] ?? '', 10) || ENV_DEFAULTS.PORT,
  isProduction: process.env['NODE_ENV'] === Environment.PRODUCTION,
  isDevelopment:
    process.env['NODE_ENV'] === Environment.DEVELOPMENT || process.env['NODE_ENV'] === undefined,
  isTest: process.env['NODE_ENV'] === Environment.TEST,
}));

export type AppConfig = ReturnType<typeof appConfig>;
