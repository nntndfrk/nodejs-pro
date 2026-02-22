import { type CustomDecorator, SetMetadata } from '@nestjs/common';

import { type UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';

// eslint-disable-next-line @typescript-eslint/naming-convention -- NestJS decorator convention
export const Roles = (...roles: UserRole[]): CustomDecorator => SetMetadata(ROLES_KEY, roles);
