import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { type JwtConfig, jwtConfig } from '../../config';
import { UsersService } from '../users/users.service';
import { type AuthResponseDto } from './dto';
import { type JwtPayload } from './strategies/jwt.strategy';

const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwt: JwtConfig,
  ) {}

  public async register(email: string, name: string, password: string): Promise<AuthResponseDto> {
    const existing = await this.usersService.findByEmail(email);
    if (existing !== null) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const user = await this.usersService.create({ email, name, passwordHash });

    return this.generateTokens({ sub: user.id, email: user.email, role: user.role });
  }

  public async login(email: string, password: string): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmail(email);
    if (user === null) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens({ sub: user.id, email: user.email, role: user.role });
  }

  public async refresh(payload: JwtPayload): Promise<AuthResponseDto> {
    const user = await this.usersService.findById(payload.sub);
    if (user === null) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.generateTokens({ sub: user.id, email: user.email, role: user.role });
  }

  private generateTokens(payload: JwtPayload): AuthResponseDto {
    const accessOpts = { expiresIn: this.jwt.expiresIn } as JwtSignOptions;
    const refreshOpts = { expiresIn: this.jwt.refreshExpiresIn } as JwtSignOptions;

    return {
      accessToken: this.jwtService.sign({ ...payload }, accessOpts),
      refreshToken: this.jwtService.sign({ ...payload }, refreshOpts),
    };
  }
}
