import { type LogLevel } from '@nestjs/common';

import { Environment } from './env.validation';

const PRODUCTION_LOG_LEVELS: LogLevel[] = ['error', 'warn', 'log'];
const DEVELOPMENT_LOG_LEVELS: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

export function getLogLevels(): LogLevel[] {
  const isProduction = process.env['NODE_ENV'] === Environment.PRODUCTION;

  return isProduction ? PRODUCTION_LOG_LEVELS : DEVELOPMENT_LOG_LEVELS;
}
