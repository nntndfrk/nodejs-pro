import { Injectable } from '@nestjs/common';

import { HealthResponseDto } from './common';

@Injectable()
export class AppService {
  public getHealth(): HealthResponseDto {
    return { status: 'ok' };
  }
}
