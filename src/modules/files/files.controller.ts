import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/decorators';
import { type JwtPayload } from '../auth/strategies/jwt.strategy';
import { UserRole } from '../users/entities/user.entity';
import {
  CompleteRequestDto,
  type CompleteResponseDto,
  PresignRequestDto,
  type PresignResponseDto,
} from './dto';
import { FilesService } from './files.service';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign')
  public async presign(
    @Body() dto: PresignRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<PresignResponseDto> {
    return this.filesService.presign(dto, user);
  }

  @Post('complete')
  public async complete(
    @Body() dto: CompleteRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<CompleteResponseDto> {
    return this.filesService.complete(dto.fileId, user);
  }

  @Get(':id')
  public async findById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<{
    id: string;
    key: string;
    contentType: string;
    size: number | null;
    status: string;
    url: string;
  }> {
    const file = await this.filesService.findById(id);

    if (file === null) {
      throw new NotFoundException(`File ${id} not found`);
    }

    if (file.ownerId !== user.sub && user.role !== UserRole.ADMIN) {
      throw new NotFoundException(`File ${id} not found`);
    }

    return {
      id: file.id,
      key: file.key,
      contentType: file.contentType,
      size: file.size,
      status: file.status,
      url: this.filesService.getFileUrl(file.key),
    };
  }
}
