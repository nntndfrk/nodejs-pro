import { IsString } from 'class-validator';

export class RefreshDto {
  @IsString()
  public refreshToken!: string;
}
