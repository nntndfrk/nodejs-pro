import { Controller, Get } from '@nestjs/common';

import { HealthResponseDto } from './common';
import { AppService } from './app.service';
import { Public } from './modules/auth/decorators';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('/health')
  public getHealth(): HealthResponseDto {
    return this.appService.getHealth();
  }
}
