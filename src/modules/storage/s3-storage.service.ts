import {
  CreateBucketCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { type S3Config, s3Config } from '../../config';

const PRESIGNED_URL_EXPIRY_SECONDS = 300;

export interface HeadObjectResult {
  contentLength: number;
  contentType: string;
}

@Injectable()
export class S3StorageService implements OnModuleInit {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly endpoint: string;
  private readonly cloudfrontBaseUrl: string | undefined;

  constructor(
    @Inject(s3Config.KEY)
    config: S3Config,
  ) {
    this.bucketName = config.bucketName;
    this.endpoint = config.endpoint;
    this.cloudfrontBaseUrl = config.cloudfrontBaseUrl;

    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  public async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  public async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = PRESIGNED_URL_EXPIRY_SECONDS,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  public async headObject(key: string): Promise<HeadObjectResult | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      return {
        contentLength: response.ContentLength ?? 0,
        contentType: response.ContentType ?? 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  public getFileUrl(key: string): string {
    if (this.cloudfrontBaseUrl !== undefined) {
      return `${this.cloudfrontBaseUrl}/${key}`;
    }

    return `${this.endpoint}/${this.bucketName}/${key}`;
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`Bucket "${this.bucketName}" exists`);
    } catch {
      this.logger.log(`Creating bucket "${this.bucketName}"...`);
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`Bucket "${this.bucketName}" created`);
    }
  }
}
