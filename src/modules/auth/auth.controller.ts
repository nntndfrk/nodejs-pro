import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { CurrentUser } from './decorators';
import { Public } from './decorators/public.decorator';
import { type AuthResponseDto, LoginDto, RefreshDto, RegisterDto } from './dto';
import { type JwtPayload } from './strategies/jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  public async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto.email, dto.name, dto.password);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  public async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  public async refresh(
    @Body() _dto: RefreshDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<AuthResponseDto> {
    return this.authService.refresh(user);
  }
}
