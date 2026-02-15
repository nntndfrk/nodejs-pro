import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  public email!: string;

  @IsString()
  @MinLength(1)
  public name!: string;

  @IsString()
  @MinLength(8)
  public password!: string;
}
