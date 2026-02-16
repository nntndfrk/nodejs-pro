import { IsUUID } from 'class-validator';

export class CompleteRequestDto {
  @IsUUID()
  public fileId!: string;
}
