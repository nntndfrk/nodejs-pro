import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { type AppConfig } from './config';
import { getLogLevels } from './config/logger.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: getLogLevels(),
  });
  const logger = new Logger('Bootstrap');

  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>('app');

  await app.listen(appConfig.port);

  logger.log(`Server is running on port ${String(appConfig.port)}`);
}

void bootstrap();
