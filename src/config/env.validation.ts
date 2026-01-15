import { Transform, plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

export const ENV_DEFAULTS = {
  NODE_ENV: Environment.DEVELOPMENT,
  PORT: 3000,
  APP_NAME: 'nodejs-pro',
} as const;

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  public NODE_ENV: Environment = ENV_DEFAULTS.NODE_ENV;

  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  public PORT = ENV_DEFAULTS.PORT;

  @IsString()
  @IsOptional()
  public APP_NAME = ENV_DEFAULTS.APP_NAME;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
