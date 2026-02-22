import { type FileStatus } from '../enums/file-status.enum';

export class CompleteResponseDto {
  public fileId!: string;
  public url!: string;
  public status!: FileStatus;
}
