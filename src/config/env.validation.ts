import { Transform, plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
  TEST = 'test',
}

export const ENV_DEFAULTS = {
  NODE_ENV: Environment.DEVELOPMENT,
  PORT: 3000,
  APP_NAME: 'nodejs-pro',
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USERNAME: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'nodejs_pro',
  JWT_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  AWS_REGION: 'us-east-1',
  S3_BUCKET_NAME: 'nodejs-pro-files',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_FORCE_PATH_STYLE: true,
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

  @IsString()
  @IsOptional()
  public DB_HOST = ENV_DEFAULTS.DB_HOST;

  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(0)
  @Max(65535)
  @IsOptional()
  public DB_PORT = ENV_DEFAULTS.DB_PORT;

  @IsString()
  @IsOptional()
  public DB_USERNAME = ENV_DEFAULTS.DB_USERNAME;

  @IsString()
  @IsOptional()
  public DB_PASSWORD = ENV_DEFAULTS.DB_PASSWORD;

  @IsString()
  @IsOptional()
  public DB_NAME = ENV_DEFAULTS.DB_NAME;

  // JWT
  @IsString()
  public JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  public JWT_EXPIRES_IN: string = ENV_DEFAULTS.JWT_EXPIRES_IN;

  @IsString()
  @IsOptional()
  public JWT_REFRESH_EXPIRES_IN: string = ENV_DEFAULTS.JWT_REFRESH_EXPIRES_IN;

  // S3 / RustFS
  @IsString()
  @IsOptional()
  public AWS_REGION: string = ENV_DEFAULTS.AWS_REGION;

  @IsString()
  public AWS_ACCESS_KEY_ID!: string;

  @IsString()
  public AWS_SECRET_ACCESS_KEY!: string;

  @IsString()
  @IsOptional()
  public S3_BUCKET_NAME: string = ENV_DEFAULTS.S3_BUCKET_NAME;

  @IsString()
  @IsOptional()
  public S3_ENDPOINT: string = ENV_DEFAULTS.S3_ENDPOINT;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  @IsOptional()
  public S3_FORCE_PATH_STYLE: boolean = ENV_DEFAULTS.S3_FORCE_PATH_STYLE;

  @IsString()
  @IsOptional()
  public CLOUDFRONT_BASE_URL?: string;
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
