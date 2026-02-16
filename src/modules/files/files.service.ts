import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DataSource, Repository } from 'typeorm';

import { type JwtPayload } from '../auth/strategies/jwt.strategy';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { S3StorageService } from '../storage/s3-storage.service';
import { type CompleteResponseDto } from './dto/complete-response.dto';
import { type PresignResponseDto } from './dto/presign-response.dto';
import { FileRecord } from './entities/file-record.entity';
import { EntityType } from './enums/entity-type.enum';
import { FileStatus } from './enums/file-status.enum';

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

const ENTITY_PURPOSE: Record<EntityType, string> = {
  [EntityType.USER]: 'avatars',
  [EntityType.PRODUCT]: 'images',
  [EntityType.ORDER]: 'invoices',
};

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectRepository(FileRecord)
    private readonly fileRecordRepository: Repository<FileRecord>,
    private readonly storageService: S3StorageService,
    private readonly dataSource: DataSource,
  ) {}

  public async presign(
    dto: { entityType: EntityType; entityId: string; contentType: string },
    currentUser: JwtPayload,
  ): Promise<PresignResponseDto> {
    await this.validateEntityOwnership(dto.entityType, dto.entityId, currentUser);

    const ext = CONTENT_TYPE_EXTENSIONS[dto.contentType] ?? 'bin';
    const purpose = ENTITY_PURPOSE[dto.entityType];
    const key = `${dto.entityType}s/${dto.entityId}/${purpose}/${uuidv4()}.${ext}`;

    const fileRecord = this.fileRecordRepository.create({
      ownerId: currentUser.sub,
      entityId: dto.entityId,
      entityType: dto.entityType,
      key,
      contentType: dto.contentType,
      status: FileStatus.PENDING,
    });

    const saved = await this.fileRecordRepository.save(fileRecord);
    const uploadUrl = await this.storageService.generatePresignedUploadUrl(key, dto.contentType);

    this.logger.log(`Presigned upload for ${key} (fileId=${saved.id})`);

    return {
      fileId: saved.id,
      key: saved.key,
      uploadUrl,
      contentType: saved.contentType,
    };
  }

  public async complete(fileId: string, currentUser: JwtPayload): Promise<CompleteResponseDto> {
    const fileRecord = await this.fileRecordRepository.findOneBy({ id: fileId });

    if (fileRecord === null) {
      throw new NotFoundException(`File record ${fileId} not found`);
    }

    if (fileRecord.ownerId !== currentUser.sub && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only complete your own file uploads');
    }

    if (fileRecord.status !== FileStatus.PENDING) {
      throw new BadRequestException('File is already completed');
    }

    const headResult = await this.storageService.headObject(fileRecord.key);
    if (headResult === null) {
      throw new BadRequestException('File has not been uploaded to storage yet');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      fileRecord.status = FileStatus.READY;
      fileRecord.size = headResult.contentLength;
      await queryRunner.manager.save(FileRecord, fileRecord);

      if (fileRecord.entityType !== null && fileRecord.entityId !== null) {
        await this.linkToEntity(
          queryRunner.manager,
          fileRecord.entityType,
          fileRecord.entityId,
          fileRecord.id,
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `File completed: ${fileRecord.key} (size=${String(headResult.contentLength)})`,
      );

      return {
        fileId: fileRecord.id,
        url: this.storageService.getFileUrl(fileRecord.key),
        status: FileStatus.READY,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  public async findById(fileId: string): Promise<FileRecord | null> {
    return this.fileRecordRepository.findOneBy({ id: fileId });
  }

  public getFileUrl(key: string): string {
    return this.storageService.getFileUrl(key);
  }

  private async validateEntityOwnership(
    entityType: EntityType,
    entityId: string,
    currentUser: JwtPayload,
  ): Promise<void> {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    switch (entityType) {
      case EntityType.USER: {
        if (entityId !== currentUser.sub) {
          throw new ForbiddenException('You can only upload files for your own profile');
        }
        break;
      }
      case EntityType.PRODUCT: {
        throw new ForbiddenException('Only admins can upload product images');
      }
      case EntityType.ORDER: {
        const order = await this.dataSource.getRepository(Order).findOneBy({ id: entityId });
        if (order === null) {
          throw new NotFoundException(`Order ${entityId} not found`);
        }
        if (order.userId !== currentUser.sub) {
          throw new ForbiddenException('You can only upload files for your own orders');
        }
        break;
      }
    }
  }

  private async linkToEntity(
    manager: DataSource['manager'],
    entityType: EntityType,
    entityId: string,
    fileId: string,
  ): Promise<void> {
    switch (entityType) {
      case EntityType.USER:
        await manager.update(User, entityId, { avatarFileId: fileId });
        break;
      case EntityType.PRODUCT:
        await manager.update(Product, entityId, { imageFileId: fileId });
        break;
      case EntityType.ORDER:
        await manager.update(Order, entityId, { invoiceFileId: fileId });
        break;
    }
  }
}
