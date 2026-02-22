import { registerAs } from '@nestjs/config';

import { ENV_DEFAULTS } from './env.validation';

export const jwtConfig = registerAs('jwt', () => {
  const secret = process.env['JWT_SECRET'];
  if (secret === undefined || secret === '') {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return {
    secret,
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? ENV_DEFAULTS.JWT_EXPIRES_IN,
    refreshExpiresIn: process.env['JWT_REFRESH_EXPIRES_IN'] ?? ENV_DEFAULTS.JWT_REFRESH_EXPIRES_IN,
  };
});

export type JwtConfig = ReturnType<typeof jwtConfig>;
