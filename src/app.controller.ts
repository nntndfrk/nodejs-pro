import { Controller, Get } from '@nestjs/common';

import { HealthResponseDto } from './common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('/health')
  public getHealth(): HealthResponseDto {
    return this.appService.getHealth();
  }
}
