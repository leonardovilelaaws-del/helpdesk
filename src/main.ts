import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { configureSwagger } from './app/configure-swagger';
import { configureApp } from './app/configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  configureSwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
