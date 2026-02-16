import { IsEnum, IsString, IsUUID, Matches } from 'class-validator';

import { EntityType } from '../enums/entity-type.enum';

export class PresignRequestDto {
  @IsEnum(EntityType)
  public entityType!: EntityType;

  @IsUUID()
  public entityId!: string;

  @IsString()
  @Matches(/^image\/(jpeg|png|gif|webp)$/, {
    message:
      'contentType must be a valid image MIME type (image/jpeg, image/png, image/gif, image/webp)',
  })
  public contentType!: string;
}
