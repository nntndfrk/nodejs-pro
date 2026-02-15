import { registerAs } from '@nestjs/config';

import { ENV_DEFAULTS } from './env.validation';

export const s3Config = registerAs('s3', () => {
  const accessKeyId = process.env['AWS_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];

  if (
    accessKeyId === undefined ||
    accessKeyId === '' ||
    secretAccessKey === undefined ||
    secretAccessKey === ''
  ) {
    throw new Error(
      'AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required',
    );
  }

  const cloudfrontBaseUrl = process.env['CLOUDFRONT_BASE_URL'];

  return {
    region: process.env['AWS_REGION'] ?? ENV_DEFAULTS.AWS_REGION,
    accessKeyId,
    secretAccessKey,
    bucketName: process.env['S3_BUCKET_NAME'] ?? ENV_DEFAULTS.S3_BUCKET_NAME,
    endpoint: process.env['S3_ENDPOINT'] ?? ENV_DEFAULTS.S3_ENDPOINT,
    forcePathStyle:
      (process.env['S3_FORCE_PATH_STYLE'] ?? String(ENV_DEFAULTS.S3_FORCE_PATH_STYLE)) === 'true',
    cloudfrontBaseUrl:
      cloudfrontBaseUrl !== undefined && cloudfrontBaseUrl.length > 0
        ? cloudfrontBaseUrl
        : undefined,
  };
});

export type S3Config = ReturnType<typeof s3Config>;
