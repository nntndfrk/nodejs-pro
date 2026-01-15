import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { type AppConfig } from './config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const appConfig = configService.getOrThrow<AppConfig>('app');

  await app.listen(appConfig.port);

  if (appConfig.isDevelopment) {
    //eslint-disable-next-line no-console
    console.log('Server is running on port', appConfig.port);
  }
}

void bootstrap();
