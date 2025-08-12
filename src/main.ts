import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Configuration CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });
  
  // Configuration du port
  const port = process.env.PORT || 3003;
  await app.listen(port);
  
  console.log(`🚀 Diploma service is running on port ${port}`);
}
bootstrap();
