import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './EnvironmentVariables';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.enableCors();
  await app.listen(EnvironmentVariables.config.port || 3000, '0.0.0.0', () => {
    console.log(`Server running on port: ${EnvironmentVariables.config.port}`);
  });
}
bootstrap();
