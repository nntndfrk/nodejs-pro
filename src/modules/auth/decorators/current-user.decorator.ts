import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { type JwtPayload } from '../strategies/jwt.strategy';

// eslint-disable-next-line @typescript-eslint/naming-convention -- NestJS decorator convention
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
