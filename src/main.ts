import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1')
  app.enableCors();
  // const config = new DocumentBuilder()
  //   .setTitle('Examiner AI')
  //   .setDescription(
  //     `The examiner api integrates with open AI's assistant help students study and prepare for their exams better`,
  //   )
  //   .setVersion('1.0')
  //   .addTag('ai')
  //   .build();
  // const document = SwaggerModule.createDocument(app, config);
  // SwaggerModule.setup('api', app, document);
  await app.listen(3000);
}
bootstrap();
